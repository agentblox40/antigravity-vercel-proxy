import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  transformOpenAIToAntigravity,
  createGroundingCollector,
  recordGroundingMetadata,
  formatGroundingMarkdown,
} from './antigravity';

export interface GeminiStudioKeyState {
  id: string;
  key: string;
  keyHash: string;
  maskedKey: string;
  cooldownUntil: number;
  failCount: number;
  successCount: number;
  lastUsedAt: number;
  lastError?: string;
}

export interface GeminiStudioResolvedModel {
  wireModel: string;
}

const GEMINI_STUDIO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REDIS_RR_KEY = 'antigravity:gemini_studio:rr';
const REDIS_CD_PREFIX = 'antigravity:gemini_studio:cd:';

const GEMINI_STUDIO_OFF_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'OFF' },
];

let cachedEnvSignature = '';
let cachedKeyPool: GeminiStudioKeyState[] = [];
let localRoundRobinCursor = 0;

function maskApiKey(key: string): string {
  if (key.length <= 12) return `${key.slice(0, 4)}...`;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

/**
 * Loads and deduplicates Google AI Studio / Gemini Developer API keys from
 * `GEMINI_API_KEYS` (comma/newline/whitespace-separated) and `GEMINI_API_KEY_1..50`.
 */
export function getGeminiStudioKeys(): GeminiStudioKeyState[] {
  const rawKeys: string[] = [];

  if (process.env.GEMINI_API_KEYS) {
    for (const part of process.env.GEMINI_API_KEYS.split(/[\s,;]+/)) {
      const trimmed = part.trim();
      if (trimmed) rawKeys.push(trimmed);
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const trimmed = process.env.GEMINI_API_KEY.trim();
    if (trimmed) rawKeys.push(trimmed);
  }

  for (let i = 1; i <= 50; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) rawKeys.push(k);
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const k of rawKeys) {
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(k);
    }
  }

  const signature = deduped.join('|');
  if (signature === cachedEnvSignature && cachedKeyPool.length === deduped.length) {
    return cachedKeyPool;
  }

  const prevByHash = new Map(cachedKeyPool.map((item) => [item.keyHash, item]));
  cachedKeyPool = deduped.map((key, idx) => {
    const keyHash = hashApiKey(key);
    const prev = prevByHash.get(keyHash);
    return {
      id: `gemini-key-${idx + 1}`,
      key,
      keyHash,
      maskedKey: maskApiKey(key),
      cooldownUntil: prev?.cooldownUntil ?? 0,
      failCount: prev?.failCount ?? 0,
      successCount: prev?.successCount ?? 0,
      lastUsedAt: prev?.lastUsedAt ?? 0,
      lastError: prev?.lastError,
    };
  });
  cachedEnvSignature = signature;
  return cachedKeyPool;
}

/**
 * Resolves a requested model ID to a Gemini Developer API model if it belongs
 * to the Google AI Studio key-pool route (`gemini-4-hydrogen`).
 */
export function resolveGeminiStudioModel(modelId?: string): GeminiStudioResolvedModel | null {
  if (!modelId) return null;
  const clean = modelId.trim().toLowerCase();
  if (clean === 'gemini-4-hydrogen' || clean === 'gemni-4-hydrogen') {
    return { wireModel: 'gemini-4-hydrogen' };
  }
  return null;
}

async function redisPipeline(commands: (string | number)[][]): Promise<any[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(700),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function syncRotationAndCooldowns(pool: GeminiStudioKeyState[]): Promise<number> {
  const now = Date.now();
  const fallbackIdx = localRoundRobinCursor++ % Math.max(1, pool.length);

  const cdKeys = pool.map((k) => `${REDIS_CD_PREFIX}${k.keyHash}`);
  const results = await redisPipeline([['INCR', REDIS_RR_KEY], ['MGET', ...cdKeys]]);
  if (!results) return fallbackIdx;

  const rrVal = Number(results[0]?.result);
  const cdArray = Array.isArray(results[1]?.result) ? results[1].result : null;

  if (cdArray) {
    for (let i = 0; i < pool.length && i < cdArray.length; i++) {
      const until = Number(cdArray[i]);
      if (Number.isFinite(until) && until > now && until > pool[i].cooldownUntil) {
        pool[i].cooldownUntil = until;
      }
    }
  }

  return Number.isFinite(rrVal) && rrVal >= 0 ? rrVal % Math.max(1, pool.length) : fallbackIdx;
}

function persistKeyCooldown(keyState: GeminiStudioKeyState, durationMs: number): void {
  const until = Date.now() + durationMs;
  if (until > keyState.cooldownUntil) {
    keyState.cooldownUntil = until;
  }
  redisPipeline([['SET', `${REDIS_CD_PREFIX}${keyState.keyHash}`, String(keyState.cooldownUntil), 'PX', durationMs]]).catch(
    () => {}
  );
}

function parseRetryAfterMs(res: Response, errorBody: string): number {
  const header = res.headers.get('retry-after');
  if (header) {
    const sec = Number(header);
    if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000) + 1500;
  }
  const match = errorBody.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i) || errorBody.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) {
    const sec = Number(match[1]);
    if (Number.isFinite(sec) && sec > 0) return Math.ceil(sec * 1000) + 1500;
  }
  // Daily quota exhausted -> longer cooldown so we don't keep burning attempts on it
  if (/perday|per_day|per day|rpd/i.test(errorBody)) {
    return 15 * 60 * 1000;
  }
  return 60 * 1000;
}

function formatISTTime(timestampMs: number): string {
  try {
    return (
      new Date(timestampMs).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' IST'
    );
  } catch {
    return new Date(timestampMs).toISOString();
  }
}

function applyClientThinkingLevel(generationConfig: any, body: any): void {
  const rawEffort =
    typeof body.thinking_level === 'string'
      ? body.thinking_level
      : typeof body.reasoning_effort === 'string'
      ? body.reasoning_effort
      : '';
  const effort = rawEffort.trim().toLowerCase();

  if (effort === 'off' || effort === 'none' || body.thinking?.type === 'disabled') {
    delete generationConfig.thinkingConfig;
    return;
  }

  if (effort === 'low' || effort === 'minimal') {
    generationConfig.thinkingConfig = { thinkingLevel: 'low', includeThoughts: true };
    return;
  }
  if (effort === 'medium' || effort === 'med') {
    generationConfig.thinkingConfig = { thinkingLevel: 'medium', includeThoughts: true };
    return;
  }
  if (effort === 'high') {
    generationConfig.thinkingConfig = { thinkingLevel: 'high', includeThoughts: true };
    return;
  }
  if (effort === 'xhigh' || effort === 'extra' || effort === 'max') {
    generationConfig.thinkingConfig = { thinkingLevel: 'xhigh', includeThoughts: true };
    return;
  }

  if (typeof body.thinking_budget === 'number' && body.thinking_budget > 0) {
    generationConfig.thinkingConfig = {
      thinkingBudget: Math.min(65535, body.thinking_budget),
      includeThoughts: true,
    };
    return;
  }

  if (typeof body.thinking?.budget_tokens === 'number' && body.thinking.budget_tokens > 0) {
    generationConfig.thinkingConfig = {
      thinkingBudget: Math.min(65535, body.thinking.budget_tokens),
      includeThoughts: true,
    };
    return;
  }

  // Let Gemini 4 Hydrogen use its native default effort while still surfacing thoughts
  generationConfig.thinkingConfig = { includeThoughts: true };
}

export interface ExecuteGeminiStudioOptions {
  body: any;
  modelId: string;
  resolved: GeminiStudioResolvedModel;
  userInjectionsText?: string;
  systemInjectionsText?: string;
  clampedContext?: boolean;
  stream: boolean;
  onFinish?: (content: string, thinking: string) => void;
  onStreamDone?: () => void;
}

/**
 * Executes a chat completion against `generativelanguage.googleapis.com` using
 * round-robin key rotation, shared Redis cooldown state, and instant failover on 429/503.
 */
export async function executeGeminiStudioCompletion(opts: ExecuteGeminiStudioOptions): Promise<NextResponse> {
  const { body, modelId, resolved, userInjectionsText, systemInjectionsText, clampedContext, stream, onFinish, onStreamDone } =
    opts;

  const pool = getGeminiStudioKeys();
  if (pool.length === 0) {
    return NextResponse.json(
      {
        error: {
          message:
            '[Configuration Error]: No Google AI Studio API keys configured. Set GEMINI_API_KEYS or GEMINI_API_KEY_1..N in environment variables.',
          type: 'configuration_error',
          code: 'missing_gemini_api_keys',
        },
      },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const startIdx = await syncRotationAndCooldowns(pool);
  const now = Date.now();

  // Build ordered rotation starting from startIdx, skipping keys currently on cooldown
  const orderedHealthy: GeminiStudioKeyState[] = [];
  for (let offset = 0; offset < pool.length; offset++) {
    const candidate = pool[(startIdx + offset) % pool.length];
    if (candidate.cooldownUntil <= now) {
      orderedHealthy.push(candidate);
    }
  }

  if (orderedHealthy.length === 0) {
    const earliestReadyAt = Math.min(...pool.map((k) => k.cooldownUntil));
    const retryAfterSec = Math.max(1, Math.ceil((earliestReadyAt - now) / 1000));
    return NextResponse.json(
      {
        error: {
          message: `[Gemini API Rate Limit]: All ${pool.length} Google AI Studio keys are in cooldown. Earliest key ready in ${retryAfterSec}s at ${formatISTTime(earliestReadyAt)}.`,
          type: 'upstream_rate_limit',
          code: 429,
          retry_after: retryAfterSec,
          ready_at: formatISTTime(earliestReadyAt),
        },
      },
      {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(retryAfterSec),
        },
      }
    );
  }

  // Reuse Antigravity's pure pass-through message/injection/safety transformer
  const transformed = transformOpenAIToAntigravity(
    body,
    { wireModel: resolved.wireModel, defaultThinkingBudget: 0 },
    'google-ai-studio',
    undefined,
    userInjectionsText,
    systemInjectionsText,
    { clampedContext }
  );

  const wirePayload: any = {
    contents: transformed.request.contents,
    systemInstruction: transformed.request.systemInstruction,
    generationConfig: { ...transformed.request.generationConfig },
    safetySettings: GEMINI_STUDIO_OFF_SAFETY_SETTINGS,
  };

  if (transformed.request.tools) {
    wirePayload.tools = transformed.request.tools;
  }

  applyClientThinkingLevel(wirePayload.generationConfig, body);

  const endpointAction = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const upstreamUrl = `${GEMINI_STUDIO_BASE_URL}/${encodeURIComponent(resolved.wireModel)}:${endpointAction}`;

  const attemptLogs: { key: string; status: number; error: string }[] = [];
  let upstreamRes: Response | null = null;
  let activeKey: GeminiStudioKeyState | null = null;

  for (const keyState of orderedHealthy) {
    keyState.lastUsedAt = Date.now();
    try {
      let res = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': keyState.key,
        },
        body: JSON.stringify(wirePayload),
      });

      // Auto-recover if upstream rejects penalty fields on this model without wasting the key
      if (res.status === 400) {
        const errText = await res.text();
        if (/penalty/i.test(errText) && (wirePayload.generationConfig.presencePenalty !== undefined || wirePayload.generationConfig.frequencyPenalty !== undefined)) {
          delete wirePayload.generationConfig.presencePenalty;
          delete wirePayload.generationConfig.frequencyPenalty;
          res = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': keyState.key,
            },
            body: JSON.stringify(wirePayload),
          });
        } else if (/API_KEY_INVALID|API key not valid/i.test(errText)) {
          keyState.failCount++;
          keyState.lastError = errText.slice(0, 300);
          persistKeyCooldown(keyState, 60 * 60 * 1000);
          attemptLogs.push({ key: keyState.maskedKey, status: 400, error: errText.slice(0, 300) });
          continue;
        } else {
          return NextResponse.json(
            {
              error: {
                message: `[Upstream Error]: Request for model '${modelId}' failed with HTTP 400: ${errText}`,
                type: 'invalid_request_error',
                code: 400,
              },
            },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }

      if (res.status === 429) {
        const errText = await res.text();
        keyState.failCount++;
        keyState.lastError = errText.slice(0, 300);
        const cooldownMs = parseRetryAfterMs(res, errText);
        persistKeyCooldown(keyState, cooldownMs);
        attemptLogs.push({ key: keyState.maskedKey, status: 429, error: errText.slice(0, 300) });
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        const errText = await res.text();
        keyState.failCount++;
        keyState.lastError = errText.slice(0, 300);
        persistKeyCooldown(keyState, 60 * 60 * 1000);
        attemptLogs.push({ key: keyState.maskedKey, status: res.status, error: errText.slice(0, 300) });
        continue;
      }

      if (res.status >= 500) {
        const errText = await res.text();
        keyState.failCount++;
        keyState.lastError = errText.slice(0, 300);
        persistKeyCooldown(keyState, 20 * 1000);
        attemptLogs.push({ key: keyState.maskedKey, status: res.status, error: errText.slice(0, 300) });
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          {
            error: {
              message: `[Upstream Error]: Request for model '${modelId}' failed with HTTP ${res.status}: ${errText}`,
              type: 'upstream_error',
              code: res.status,
              key: keyState.maskedKey,
            },
          },
          { status: res.status, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      keyState.successCount++;
      keyState.failCount = 0;
      keyState.cooldownUntil = 0;
      upstreamRes = res;
      activeKey = keyState;
      break;
    } catch (err: any) {
      keyState.failCount++;
      keyState.lastError = err?.message || 'Network error';
      persistKeyCooldown(keyState, 15 * 1000);
      attemptLogs.push({ key: keyState.maskedKey, status: 502, error: keyState.lastError! });
    }
  }

  if (!upstreamRes || !activeKey) {
    const anyRateLimited = attemptLogs.some((a) => a.status === 429);
    const earliestReadyAt = Math.min(...pool.map((k) => k.cooldownUntil || Date.now() + 20000));
    const retryAfterSec = Math.max(1, Math.ceil((earliestReadyAt - Date.now()) / 1000));
    const status = anyRateLimited ? 429 : 503;

    return NextResponse.json(
      {
        error: {
          message: `[Gemini API Pool Exhausted]: All ${orderedHealthy.length} available keys failed (${attemptLogs
            .map((a) => `${a.key}: ${a.status}`)
            .join(', ')}).`,
          type: anyRateLimited ? 'upstream_rate_limit' : 'upstream_error',
          code: status,
          retry_after: retryAfterSec,
          ready_at: formatISTTime(earliestReadyAt),
          attempt_history: attemptLogs,
        },
      },
      {
        status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          ...(anyRateLimited ? { 'Retry-After': String(retryAfterSec) } : {}),
        },
      }
    );
  }

  if (stream) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const chatcmplId = `chatcmpl-${crypto.randomUUID().slice(0, 8)}`;
    const groundingCollector = createGroundingCollector();

    let fullAssistantContent = '';
    let fullThoughtContent = '';

    const customStream = new ReadableStream({
      async start(controller) {
        try {
          const reader = upstreamRes!.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const rawData = line.slice(6).trim();
              if (!rawData || rawData === '[DONE]') continue;
              try {
                const parsed = JSON.parse(rawData);
                const cand = parsed.candidates?.[0] || parsed.response?.candidates?.[0];
                const gm = cand?.groundingMetadata || parsed.groundingMetadata || parsed.response?.groundingMetadata;
                if (gm) {
                  recordGroundingMetadata(gm, groundingCollector);
                }
                const parts = cand?.content?.parts || [];
                for (const part of parts) {
                  const text = part?.text || '';
                  if (!text) continue;
                  if (part.thought === true) {
                    fullThoughtContent += text;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          id: chatcmplId,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: modelId,
                          choices: [{ index: 0, delta: { reasoning_content: text, reasoning: text }, finish_reason: null }],
                        })}\n\n`
                      )
                    );
                  } else {
                    fullAssistantContent += text;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          id: chatcmplId,
                          object: 'chat.completion.chunk',
                          created: Math.floor(Date.now() / 1000),
                          model: modelId,
                          choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                        })}\n\n`
                      )
                    );
                  }
                }
              } catch {}
            }
          }

          const sourcesMarkdown = formatGroundingMarkdown(groundingCollector);
          if (sourcesMarkdown) {
            fullAssistantContent += sourcesMarkdown;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: chatcmplId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: modelId,
                  choices: [{ index: 0, delta: { content: sourcesMarkdown }, finish_reason: null }],
                })}\n\n`
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: chatcmplId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: modelId,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              })}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          onFinish?.(fullAssistantContent, fullThoughtContent);
          onStreamDone?.();
        }
      },
      cancel() {
        onFinish?.(fullAssistantContent, fullThoughtContent);
        onStreamDone?.();
      },
    });

    return new NextResponse(customStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Non-streaming JSON response
  const data = await upstreamRes.json();
  const cand = data.candidates?.[0] || data.response?.candidates?.[0];
  const groundingCollector = createGroundingCollector();
  const gm = cand?.groundingMetadata || data.groundingMetadata || data.response?.groundingMetadata;
  if (gm) {
    recordGroundingMetadata(gm, groundingCollector);
  }

  let contentText = '';
  let thoughtText = '';
  for (const part of cand?.content?.parts || []) {
    if (part?.thought) thoughtText += part.text || '';
    else contentText += part.text || '';
  }

  const sourcesMarkdown = formatGroundingMarkdown(groundingCollector);
  if (sourcesMarkdown && !contentText.includes(sourcesMarkdown.trim())) {
    const trimmed = contentText.trimEnd();
    contentText = trimmed ? `${trimmed}\n\n${sourcesMarkdown.trimStart()}` : sourcesMarkdown.trimStart();
  }

  onFinish?.(contentText, thoughtText);
  onStreamDone?.();

  return NextResponse.json(
    {
      id: `chatcmpl-${crypto.randomUUID().slice(0, 8)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: contentText,
            ...(thoughtText ? { reasoning_content: thoughtText, reasoning: thoughtText } : {}),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata?.totalTokenCount || 0,
      },
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
