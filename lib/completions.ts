import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  getAccounts,
  pickAccount,
  getAccessToken,
  transformOpenAIToAntigravity,
  resolveWireModel,
} from './antigravity';
import {
  deriveChatFingerprint,
  getOrCreateChatSession,
  saveChatSession,
  recordTurnsIntoSession,
  extractInjectedLore,
} from './memory';

const UPSTREAM_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
  'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
];

export function checkAuth(req: NextRequest): boolean {
  const proxyKey = process.env.PROXY_API_KEY;
  if (!proxyKey) return true;
  const authHeader = req.headers.get('authorization') || '';
  const customKey = req.headers.get('api-key') || req.headers.get('x-api-key') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : customKey.trim();
  return token === proxyKey.trim();
}

export async function handleOptions() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, x-api-key, x-chat-id, x-character-name, x-disable-memory',
    },
  });
}

export async function handleChatCompletions(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Invalid or missing Proxy API Key.', type: 'invalid_request_error', code: 'unauthorized' } },
      {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid JSON request body.' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const stream = body.stream === true;
  const requestedModel = (body.model || 'gemini-3.7-flash').trim();
  const resolved = resolveWireModel(requestedModel);

  if (!resolved) {
    return NextResponse.json(
      {
        error: {
          message: `[Model Not Found]: '${requestedModel}' is not a valid or supported model on Antigravity Proxy. Supported models: gemini-3.7-flash, gemini-3.7-flash-high, gemini-3.7-flash-max, gemini-3.7-flash-low, gemini-3.1-pro, gemini-3.5-flash, claude-opus-4-6-thinking, claude-sonnet-4-6.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
          requested_model: requestedModel,
          available_models: [
            'gemini-3.7-flash',
            'gemini-3.7-flash-high',
            'gemini-3.7-flash-max',
            'gemini-3.7-flash-medium',
            'gemini-3.7-flash-low',
            'gemini-3.1-pro',
            'gemini-3.5-flash',
            'claude-opus-4-6-thinking',
            'claude-sonnet-4-6'
          ]
        }
      },
      { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const modelId = requestedModel;
  const accounts = getAccounts();

  // Extract raw system text & latest user text for background logging
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let rawSystemText = '';
  let latestUserText = '';

  for (const m of messages) {
    if (!m) continue;
    let t = typeof m.content === 'string' ? m.content : '';
    if (Array.isArray(m.content)) {
      t = m.content.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('\n');
    }
    t = t.trim();
    if (m.role === 'system') {
      rawSystemText = rawSystemText ? `${rawSystemText}\n\n${t}` : t;
    } else if (m.role === 'user') {
      latestUserText = t;
    }
  }

  // Background passive session identification (for Logged Chats dashboard tab only)
  let session: any = null;
  const disableMemory = req.headers.get('x-disable-memory') === 'true' || body.disable_memory === true;

  if (!disableMemory) {
    try {
      const { characterId, characterName, chatId, sessionTitle } = deriveChatFingerprint(
        messages,
        rawSystemText,
        req.headers
      );
      session = await getOrCreateChatSession(chatId, characterId, characterName, sessionTitle);
      if (rawSystemText) {
        session.systemPrompt = rawSystemText;
      }
    } catch (memErr) {
      console.warn('Memory engine non-blocking warning:', memErr);
    }
  }

  const now = Date.now();
  const availableAccounts = accounts.filter(a => a.cooldownUntil <= now);

  // If all accounts are currently in cooldown, return immediate 429 WITHOUT prematurely hitting Google (which resets the timer)
  if (availableAccounts.length === 0 && accounts.length > 0) {
    const remainingTimes = accounts.map(a => Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000)));
    const minCooldownSec = Math.min(...remainingTimes);
    const refreshTimeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(now + minCooldownSec * 1000)) + ' IST';

    const accountBreakdown = accounts.map(a => `${a.name}: Cooldown (${Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))}s)`).join(' | ');

    return NextResponse.json(
      {
        error: {
          message: `[Proxy Rate Limit]: All Google accounts in pool are cooling down. [${accountBreakdown}]. Refreshing in ${minCooldownSec}s (Ready at ${refreshTimeStr}). Please wait ${minCooldownSec}s before retrying.`,
          type: 'upstream_rate_limit',
          code: 429,
          retry_after: minCooldownSec,
          refresh_in_seconds: minCooldownSec,
          ready_at: refreshTimeStr,
          accounts_status: accounts.map(a => ({
            name: a.name,
            status: 'Cooldown',
            cooldown_remaining_sec: Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))
          }))
        }
      },
      {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(minCooldownSec),
        },
      }
    );
  }

  // 50/50 Round-Robin Account Balancing
  let primaryAccount: any;
  try {
    primaryAccount = pickAccount();
  } catch {
    primaryAccount = accounts[0];
  }
  const otherAccounts = accounts.filter(a => a.id !== primaryAccount?.id);
  const orderedAccounts = primaryAccount ? [primaryAccount, ...otherAccounts] : accounts;
  const accountsToTry = availableAccounts.length > 0
    ? orderedAccounts.filter(a => availableAccounts.some(avail => avail.id === a.id))
    : orderedAccounts;

  const attemptLogs: { account: string; status: number; error: string }[] = [];

  for (const account of accountsToTry) {
    try {
      const accessToken = await getAccessToken(account);
      const envelope = transformOpenAIToAntigravity(body, resolved, account.projectId, rawSystemText);

      let upstreamRes: Response | null = null;
      for (const upstreamUrl of UPSTREAM_URLS) {
        try {
          const res = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              'User-Agent': 'antigravity/ide/2.1.1 darwin/arm64',
            },
            body: JSON.stringify(envelope),
          });

          if (res.ok) {
            upstreamRes = res;
            break;
          } else if (res.status === 429) {
            attemptLogs.push({ account: account.name, status: 429, error: `Rate limited on ${upstreamUrl}` });
            continue;
          } else {
            const errText = await res.text();
            attemptLogs.push({ account: account.name, status: res.status, error: errText.slice(0, 300) });
            console.warn(`Upstream ${upstreamUrl} returned ${res.status} for model ${resolved.wireModel}: ${errText}`);
          }
        } catch (e: any) {
          attemptLogs.push({ account: account.name, status: 500, error: e.message || 'Connection error' });
          console.warn(`Error connecting to ${upstreamUrl}:`, e);
        }
      }

      if (!upstreamRes) {
        account.failCount++;
        const hasRateLimit = attemptLogs.some(l => l.account === account.name && (l.status === 429 || l.status === 503));
        if (hasRateLimit) {
          account.cooldownUntil = Date.now() + 20000;
        }
        continue;
      }

      account.failCount = 0;
      account.cooldownUntil = 0;


      // Streaming response with clean reasoning_content routing for Janitor AI
      if (stream) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const chatcmplId = `chatcmpl-${crypto.randomUUID().slice(0, 8)}`;

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
                  if (line.startsWith('data: ')) {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      const cand = parsed.response?.candidates?.[0];
                      const parts = cand?.content?.parts || [];

                      for (const part of parts) {
                        const isThought = part.thought === true;
                        const text = part.text || '';
                        if (!text) continue;

                        if (isThought) {
                          fullThoughtContent += text;
                          controller.enqueue(
                            encoder.encode(
                              `data: ${JSON.stringify({
                                id: chatcmplId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: modelId,
                                choices: [
                                  {
                                    index: 0,
                                    delta: { reasoning_content: text },
                                    finish_reason: null,
                                  },
                                ],
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
                                choices: [
                                  {
                                    index: 0,
                                    delta: { content: text },
                                    finish_reason: null,
                                  },
                                ],
                              })}\n\n`
                            )
                          );
                        }
                      }
                    } catch {}
                  }
                }
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    id: chatcmplId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: modelId,
                    choices: [
                      {
                        index: 0,
                        delta: {},
                        finish_reason: 'stop',
                      },
                    ],
                  })}\n\n`
                )
              );
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();

              // Record asynchronously into memory with dynamic Lorebary injections
              if (session) {
                const injectedLore = extractInjectedLore(messages, rawSystemText);
                recordTurnsIntoSession(session, messages, fullAssistantContent, fullThoughtContent, injectedLore).catch(() => {});
              }
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new NextResponse(customStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Non-streaming JSON response
      const rawText = await upstreamRes.text();
      let contentText = '';
      let thoughtText = '';

      const lines = rawText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const cand = parsed.response?.candidates?.[0];
            const parts = cand?.content?.parts || [];
            for (const part of parts) {
              if (part.thought) thoughtText += part.text || '';
              else contentText += part.text || '';
            }
          } catch {}
        }
      }

      // Record asynchronously into memory with dynamic Lorebary injections
      if (session) {
        const injectedLore = extractInjectedLore(messages, rawSystemText);
        recordTurnsIntoSession(session, messages, contentText, thoughtText, injectedLore).catch(() => {});
      }

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
                reasoning_content: thoughtText.trim() || undefined,
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (err: any) {
      attemptLogs.push({ account: account.name, status: 500, error: err.message || 'Execution error' });
      console.error(`Attempt failed on ${account.name}:`, err.message);
    }
  }

  const lastErr = attemptLogs[attemptLogs.length - 1];
  const allRateLimits = attemptLogs.length > 0 && attemptLogs.every(l => l.status === 429 || l.status === 503);

  // If upstream explicitly rejected the model/payload with 400, 404, etc., return the exact upstream error
  if (!allRateLimits && lastErr && lastErr.status !== 429) {
    return NextResponse.json(
      {
        error: {
          message: `[Upstream Error]: Request for model '${requestedModel}' failed with HTTP ${lastErr.status}: ${lastErr.error}`,
          type: 'upstream_error',
          code: lastErr.status,
          model: requestedModel,
          wire_model: resolved.wireModel,
          attempt_history: attemptLogs
        }
      },
      {
        status: lastErr.status >= 400 && lastErr.status < 600 ? lastErr.status : 502,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }

  const endNow = Date.now();
  const remainingTimes = accounts.map(a => Math.max(1, Math.ceil((a.cooldownUntil - endNow) / 1000)));
  const minCooldownSec = Math.min(...remainingTimes);
  const refreshTimeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(new Date(endNow + minCooldownSec * 1000)) + ' IST';

  const accountsSummary = accounts.map(a => {
    const sec = Math.max(1, Math.ceil((a.cooldownUntil - endNow) / 1000));
    return `${a.name}: Cooldown (${sec}s)`;
  }).join(' | ');

  return NextResponse.json(
    {
      error: {
        message: `[Proxy Rate Limit]: All Google accounts in pool rate-limited. [${accountsSummary}]. Earliest account ready in ${minCooldownSec}s at ${refreshTimeStr}.`,
        type: 'upstream_rate_limit',
        code: 429,
        retry_after: minCooldownSec,
        refresh_in_seconds: minCooldownSec,
        ready_at: refreshTimeStr,
        attempt_history: attemptLogs,
        accounts_status: accounts.map(a => ({
          name: a.name,
          cooldown_remaining_sec: Math.max(1, Math.ceil((a.cooldownUntil - endNow) / 1000))
        }))
      }
    },
    {
      status: 429,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Retry-After': String(minCooldownSec),
      },
    }
  );
}
