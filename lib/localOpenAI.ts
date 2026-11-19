import { NextResponse } from 'next/server';
import { detectInChatCommand } from './injections';

const REDIS_LOCAL_OPENAI_URL_KEY = 'antigravity:local_openai_base_url';
const CACHE_TTL_MS = 15_000;

let cachedBaseUrl: string | null = null;
let cachedAt = 0;

function normalizeBaseUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
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
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function getLocalOpenAIBaseUrl(forceRefresh = false): Promise<string | null> {
  const envUrl = normalizeBaseUrl(process.env.LOCAL_OPENAI_BASE_URL);
  const now = Date.now();
  if (!forceRefresh && cachedAt > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedBaseUrl || envUrl;
  }

  const res = await redisPipeline([['GET', REDIS_LOCAL_OPENAI_URL_KEY]]);
  const redisRaw = typeof res?.[0]?.result === 'string' ? res[0].result : null;
  cachedBaseUrl = normalizeBaseUrl(redisRaw);
  cachedAt = now;
  return cachedBaseUrl || envUrl;
}

export async function setLocalOpenAIBaseUrl(url: string): Promise<string> {
  const normalized = normalizeBaseUrl(url);
  if (!normalized) {
    throw new Error('Invalid base URL');
  }
  await redisPipeline([['SET', REDIS_LOCAL_OPENAI_URL_KEY, normalized]]);
  cachedBaseUrl = normalized;
  cachedAt = Date.now();
  return normalized;
}

export async function clearLocalOpenAIBaseUrl(): Promise<void> {
  await redisPipeline([['DEL', REDIS_LOCAL_OPENAI_URL_KEY]]);
  cachedBaseUrl = null;
  cachedAt = Date.now();
}

export async function fetchLocalOpenAIModels(): Promise<{ id: string; name?: string; owned_by?: string }[]> {
  const baseUrl = await getLocalOpenAIBaseUrl();
  if (!baseUrl) return [];

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${process.env.LOCAL_OPENAI_API_KEY || 'local-proxy'}`,
      },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

function prepareMessagesForOpenAI(
  messages: any[],
  userInjectionsText?: string,
  systemInjectionsText?: string
): any[] {
  const sanitized = messages.filter((m) => {
    if (!m) return false;
    const text =
      typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
        ? m.content.map((p: any) => p?.text || '').join('\n')
        : '';
    if (m.role === 'user' && detectInChatCommand(text)) return false;
    if (
      m.role === 'assistant' &&
      (text.includes('[ANTIGRAVITY PROXY SETTINGS MENU]') ||
        text.includes('[ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]') ||
        text.includes('[ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]') ||
        text.includes('[ANTIGRAVITY ROLEPLAY SAMPLING]') ||
        text.includes('[ANTIGRAVITY ROLEPLAY COMMANDS GUIDE]') ||
        text.startsWith('⚙️ [ANTIGRAVITY PROXY SETTINGS MENU]') ||
        text.startsWith('⚙️ [ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]') ||
        text.startsWith('⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]') ||
        text.startsWith('📖 [ANTIGRAVITY ROLEPLAY COMMANDS'))
    ) {
      return false;
    }
    return true;
  });

  const prepared = sanitized.map((m) => ({ ...m }));

  if (systemInjectionsText && systemInjectionsText.trim()) {
    const firstSys = prepared.find((m) => m.role === 'system');
    if (firstSys) {
      if (typeof firstSys.content === 'string') {
        firstSys.content = `${firstSys.content}\n\n${systemInjectionsText.trim()}`;
      } else if (Array.isArray(firstSys.content)) {
        firstSys.content = [...firstSys.content, { type: 'text', text: systemInjectionsText.trim() }];
      } else {
        firstSys.content = systemInjectionsText.trim();
      }
    } else {
      prepared.unshift({ role: 'system', content: systemInjectionsText.trim() });
    }
  }

  if (userInjectionsText && userInjectionsText.trim()) {
    for (let i = prepared.length - 1; i >= 0; i--) {
      if (prepared[i].role !== 'user') continue;
      if (typeof prepared[i].content === 'string') {
        prepared[i].content = `${prepared[i].content}\n\n${userInjectionsText.trim()}`;
      } else if (Array.isArray(prepared[i].content)) {
        const arr = [...prepared[i].content];
        let lastTextPart: any = null;
        for (let j = arr.length - 1; j >= 0; j--) {
          if (arr[j] && (typeof arr[j] === 'string' || (arr[j].type === 'text' && typeof arr[j].text === 'string'))) {
            lastTextPart = arr[j];
            break;
          }
        }
        if (lastTextPart) {
          if (typeof lastTextPart === 'string') {
            const idx = arr.lastIndexOf(lastTextPart);
            arr[idx] = `${lastTextPart}\n\n${userInjectionsText.trim()}`;
          } else {
            lastTextPart.text = `${lastTextPart.text}\n\n${userInjectionsText.trim()}`;
          }
        } else {
          arr.push({ type: 'text', text: userInjectionsText.trim() });
        }
        prepared[i].content = arr;
      } else {
        prepared[i].content = userInjectionsText.trim();
      }
      break;
    }
  }

  return prepared;
}

export interface ExecuteLocalOpenAIOptions {
  baseUrl: string;
  body: any;
  modelId: string;
  userInjectionsText?: string;
  systemInjectionsText?: string;
  stream: boolean;
  onFinish?: (content: string, thinking: string) => void;
  onStreamDone?: () => void;
}

export async function executeLocalOpenAICompletion(opts: ExecuteLocalOpenAIOptions): Promise<NextResponse> {
  const { baseUrl, body, modelId, userInjectionsText, systemInjectionsText, stream, onFinish, onStreamDone } = opts;

  const wireModel = modelId.replace(/^local\//i, '').trim();
  const messages = prepareMessagesForOpenAI(
    Array.isArray(body.messages) ? body.messages : [],
    userInjectionsText,
    systemInjectionsText
  );

  const forwardBody = {
    ...body,
    model: wireModel,
    messages,
    stream,
  };

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LOCAL_OPENAI_API_KEY || 'local-proxy'}`,
      },
      body: JSON.stringify(forwardBody),
    });
  } catch (err: any) {
    onStreamDone?.();
    return NextResponse.json(
      {
        error: {
          message: `[Local OpenAI Bridge Error]: Could not reach ${baseUrl}/chat/completions (${err?.message || 'connection failed'}). Make sure your local proxy and tunnel are running.`,
          type: 'upstream_connection_error',
          code: 502,
        },
      },
      { status: 502, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (!upstreamRes.ok) {
    const errText = await upstreamRes.text().catch(() => '');
    onStreamDone?.();
    return NextResponse.json(
      {
        error: {
          message: `[Local OpenAI Upstream ${upstreamRes.status}]: ${errText || upstreamRes.statusText}`,
          type: 'upstream_error',
          code: upstreamRes.status,
        },
      },
      { status: upstreamRes.status, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (stream) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullThinking = '';

    const passThrough = new ReadableStream({
      async start(controller) {
        try {
          const reader = upstreamRes.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === '[DONE]') continue;
              try {
                const parsed = JSON.parse(raw);
                const delta = parsed?.choices?.[0]?.delta;
                if (typeof delta?.content === 'string') fullContent += delta.content;
                if (typeof delta?.reasoning_content === 'string') fullThinking += delta.reasoning_content;
                else if (typeof delta?.reasoning === 'string') fullThinking += delta.reasoning;
              } catch {}
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          onFinish?.(fullContent, fullThinking);
          onStreamDone?.();
        }
      },
      cancel() {
        onFinish?.(fullContent, fullThinking);
        onStreamDone?.();
      },
    });

    return new NextResponse(passThrough, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const data = await upstreamRes.json();
  const msg = data?.choices?.[0]?.message;
  const content = typeof msg?.content === 'string' ? msg.content : '';
  const thinking =
    typeof msg?.reasoning_content === 'string'
      ? msg.reasoning_content
      : typeof msg?.reasoning === 'string'
      ? msg.reasoning
      : '';
  onFinish?.(content, thinking);
  onStreamDone?.();

  return NextResponse.json(data, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}
