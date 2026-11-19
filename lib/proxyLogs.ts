import crypto from 'node:crypto';

export interface UpstreamEventLog {
  id: string;
  timestamp: number;
  istTime: string;
  provider: 'cloudcode-pa' | 'gemini-studio' | 'opencode';
  model: string;
  wireModel?: string;
  accountOrKey: string;
  status: number;
  trapFlagged: boolean;
  retryAfterHeader: string | null;
  upstreamUrl: string;
  errorSnippet: string;
}

const REDIS_LOGS_KEY = 'antigravity:upstream_logs_v1';
const MAX_LOGS = 200;
const memoryLogs: UpstreamEventLog[] = [];

function formatIST(ts: number): string {
  try {
    return (
      new Date(ts).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' IST'
    );
  } catch {
    return new Date(ts).toISOString();
  }
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
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function logUpstreamEvent(
  input: Omit<UpstreamEventLog, 'id' | 'timestamp' | 'istTime'>
): Promise<void> {
  const now = Date.now();
  const entry: UpstreamEventLog = {
    id: `log_${crypto.randomUUID().slice(0, 8)}`,
    timestamp: now,
    istTime: formatIST(now),
    ...input,
    errorSnippet: (input.errorSnippet || '').slice(0, 1200),
  };

  memoryLogs.unshift(entry);
  if (memoryLogs.length > MAX_LOGS) {
    memoryLogs.length = MAX_LOGS;
  }

  await redisPipeline([
    ['LPUSH', REDIS_LOGS_KEY, JSON.stringify(entry)],
    ['LTRIM', REDIS_LOGS_KEY, 0, MAX_LOGS - 1],
  ]);
}

export async function getUpstreamLogs(
  limit = 50,
  opts?: { status?: number; trapOnly?: boolean }
): Promise<UpstreamEventLog[]> {
  const capped = Math.max(1, Math.min(MAX_LOGS, limit));
  let items: UpstreamEventLog[] = [];

  const res = await redisPipeline([['LRANGE', REDIS_LOGS_KEY, 0, MAX_LOGS - 1]]);
  const rawList = res?.[0]?.result;
  if (Array.isArray(rawList)) {
    for (const raw of rawList) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed.status === 'number') {
          items.push(parsed);
        }
      } catch {}
    }
  } else {
    items = [...memoryLogs];
  }

  if (opts?.status !== undefined && Number.isFinite(opts.status)) {
    items = items.filter((l) => l.status === opts.status);
  }
  if (opts?.trapOnly) {
    items = items.filter((l) => l.trapFlagged);
  }

  return items.slice(0, capped);
}

export async function clearUpstreamLogs(): Promise<void> {
  memoryLogs.length = 0;
  await redisPipeline([['DEL', REDIS_LOGS_KEY]]);
}
