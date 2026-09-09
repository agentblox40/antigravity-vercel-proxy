import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface OpenCodeModelSpec {
  id: string;
  name: string;
  tier: string;
  badge: string;
  thinking: string;
  context: string;
  desc: string;
  wireModel: string;
  isFast: boolean;
}

export interface OpenCodeGuestAccount {
  id: string;
  name: string;
  sessionId: string;
  cooldownUntil: number;
  failCount: number;
  successCount: number;
}

// Verified working OpenCode free models & their no-think / fast variants
export const OPENCODE_MODELS: OpenCodeModelSpec[] = [
  // 1. Big Pickle (DeepSeek Thinking & Fast)
  {
    id: 'big-pickle',
    name: 'Big Pickle (DeepSeek Thinking)',
    tier: 'OpenCode / DeepSeek',
    badge: 'DeepSeek Thinking',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'DeepSeek reasoning model on OpenCode with deep chain-of-thought analysis.',
    wireModel: 'big-pickle',
    isFast: false,
  },
  {
    id: 'big-pickle-fast',
    name: 'Big Pickle (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Big Pickle with reasoning disabled for instantaneous response speed.',
    wireModel: 'big-pickle',
    isFast: true,
  },

  // 2. Xiaomi MiMo v2.5 Free & Fast
  {
    id: 'mimo-v2.5-free',
    name: 'Xiaomi MiMo v2.5 Free',
    tier: 'OpenCode / Xiaomi',
    badge: 'MiMo Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Xiaomi MiMo v2.5 flagship multimodal reasoning model on OpenCode.',
    wireModel: 'mimo-v2.5-free',
    isFast: false,
  },
  {
    id: 'mimo-v2.5-free-fast',
    name: 'Xiaomi MiMo v2.5 Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Xiaomi MiMo v2.5 with reasoning disabled for rapid dialog generation.',
    wireModel: 'mimo-v2.5-free',
    isFast: true,
  },

  // 3. Ling 3.0 Flash Free & Fast
  {
    id: 'ling-3.0-flash-fin-free',
    name: 'Ling 3.0 Flash Free',
    tier: 'OpenCode / Ling',
    badge: 'Ling Reasoning',
    thinking: 'Enabled',
    context: '128K Context',
    desc: 'Ling 3.0 Flash financial and general intelligence reasoning model on OpenCode.',
    wireModel: 'ling-3.0-flash-fin-free',
    isFast: false,
  },
  {
    id: 'ling-3.0-flash-fin-free-fast',
    name: 'Ling 3.0 Flash Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: 'No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '128K Context',
    desc: 'Ling 3.0 Flash with reasoning disabled for high-speed streaming.',
    wireModel: 'ling-3.0-flash-fin-free',
    isFast: true,
  },

  // 4. NVIDIA Nemotron 3 Ultra Free (1M Context) & Fast
  {
    id: 'nemotron-3-ultra-free',
    name: 'NVIDIA Nemotron 3 Ultra Free',
    tier: 'OpenCode / NVIDIA',
    badge: '1M Context Reasoning',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3 Ultra with massive 1M context and deep reasoning on OpenCode.',
    wireModel: 'nemotron-3-ultra-free',
    isFast: false,
  },
  {
    id: 'nemotron-3-ultra-free-fast',
    name: 'NVIDIA Nemotron 3 Ultra Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3 Ultra with 1M context and reasoning disabled for low latency.',
    wireModel: 'nemotron-3-ultra-free',
    isFast: true,
  },

  // 5. NVIDIA Nemotron 3.5 Lightning Free (1M Context) & Fast
  {
    id: 'nemotron-3.5-lightning-free',
    name: 'NVIDIA Nemotron 3.5 Lightning Free',
    tier: 'OpenCode / NVIDIA',
    badge: '1M Context Lightning',
    thinking: 'Enabled',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3.5 Lightning high-throughput 1M context model on OpenCode.',
    wireModel: 'nemotron-3.5-lightning-free',
    isFast: false,
  },
  {
    id: 'nemotron-3.5-lightning-free-fast',
    name: 'NVIDIA Nemotron 3.5 Lightning Free (Fast / No-Think)',
    tier: 'OpenCode / Fast',
    badge: '1M Context No-Think',
    thinking: 'Disabled (0 Tokens)',
    context: '1M Context',
    desc: 'NVIDIA Nemotron 3.5 Lightning with 1M context and reasoning disabled.',
    wireModel: 'nemotron-3.5-lightning-free',
    isFast: true,
  },
];

// 16 persistent guest sessions with valid RFC4122 v4 UUIDs
export const OPENCODE_GUEST_ACCOUNTS: OpenCodeGuestAccount[] = [
  { id: 'opencode-guest-1', name: 'OpenCode Guest 1', sessionId: '3303e814-8561-4baf-a01a-a97a8431e672', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-2', name: 'OpenCode Guest 2', sessionId: '3770d8b1-14dc-4a8b-8e81-97a3c6f39b41', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-3', name: 'OpenCode Guest 3', sessionId: '27ac6e7c-00a7-4f17-8799-612ce7b65a3a', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-4', name: 'OpenCode Guest 4', sessionId: '0a5b1f29-df24-40ec-bfb6-65ebc9880f61', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-5', name: 'OpenCode Guest 5', sessionId: '4e82c538-7b59-48a1-b9ca-7f0f64b9c1e8', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-6', name: 'OpenCode Guest 6', sessionId: 'b9f62bc9-a498-4126-b81e-10dbf590ed68', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-7', name: 'OpenCode Guest 7', sessionId: 'dc3767b5-21d1-4070-9e3f-297fd106978c', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-8', name: 'OpenCode Guest 8', sessionId: '49e06623-74bb-4d4a-bc3a-4b93e96ce83b', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-9', name: 'OpenCode Guest 9', sessionId: '50cc645f-bb95-48aa-8a9b-5919262c46b9', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-10', name: 'OpenCode Guest 10', sessionId: '75895cf9-b774-402a-b4c8-ab89700dd7fe', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-11', name: 'OpenCode Guest 11', sessionId: '337af0f2-29fe-47f4-9311-064c1ede530e', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-12', name: 'OpenCode Guest 12', sessionId: 'f8d63aae-e5ec-460e-af89-790fd1950e6f', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-13', name: 'OpenCode Guest 13', sessionId: 'c4415758-5ee0-4c65-b177-16687ace9509', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-14', name: 'OpenCode Guest 14', sessionId: 'af65da7f-7f46-46d5-9d18-3bbf583c88b7', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-15', name: 'OpenCode Guest 15', sessionId: '31230694-7e1f-4b73-8958-a74a0bd706af', cooldownUntil: 0, failCount: 0, successCount: 0 },
  { id: 'opencode-guest-16', name: 'OpenCode Guest 16', sessionId: '2b3c3ed1-6797-487a-a2df-cea32bba38b5', cooldownUntil: 0, failCount: 0, successCount: 0 },
];

let nextGuestIdx = 0;

export function getOpenCodeAccounts(): OpenCodeGuestAccount[] {
  return OPENCODE_GUEST_ACCOUNTS;
}

export function pickOpenCodeAccount(): OpenCodeGuestAccount {
  const now = Date.now();
  for (let i = 0; i < OPENCODE_GUEST_ACCOUNTS.length; i++) {
    const idx = (nextGuestIdx + i) % OPENCODE_GUEST_ACCOUNTS.length;
    const acc = OPENCODE_GUEST_ACCOUNTS[idx];
    if (acc.cooldownUntil <= now) {
      nextGuestIdx = (idx + 1) % OPENCODE_GUEST_ACCOUNTS.length;
      return acc;
    }
  }
  let best = OPENCODE_GUEST_ACCOUNTS[0];
  for (const acc of OPENCODE_GUEST_ACCOUNTS) {
    if (acc.cooldownUntil < best.cooldownUntil) best = acc;
  }
  return best;
}

export interface ResolvedOpenCodeModel {
  wireModel: string;
  isFast: boolean;
  canonicalId: string;
}

export function resolveOpenCodeModel(modelId?: string): ResolvedOpenCodeModel | null {
  if (!modelId || !modelId.trim()) return null;
  let clean = modelId.trim().toLowerCase();

  // Strip common provider prefixes (e.g. opencode/big-pickle, models/mimo-v2.5-free)
  clean = clean.replace(/^(models\/|opencode\/)/, '');

  // Exclude non-working or delisted models explicitly
  if (clean.includes('deepseek-v4-flash') || clean.includes('muse-spark')) {
    return null;
  }

  // Exact ID match from catalog
  const exact = OPENCODE_MODELS.find(m => m.id === clean);
  if (exact) {
    return {
      wireModel: exact.wireModel,
      isFast: exact.isFast,
      canonicalId: exact.id,
    };
  }

  // Helper to detect fast/no-think suffix variant
  const isFastSuffix = (suffix: string) => {
    return /^(fast|off|no-?think|no_think|zero)$/i.test(suffix);
  };

  // Helper to detect thinking suffix
  const isThinkingSuffix = (suffix: string) => {
    return /^(thinking|think|thought|deep)$/i.test(suffix);
  };

  // Helper to match a base model and its separator
  const matchModelVariant = (
    baseNames: string[],
    wireModel: string,
    canonicalBase: string
  ): ResolvedOpenCodeModel | null => {
    for (const base of baseNames) {
      if (clean === base) {
        return { wireModel, isFast: false, canonicalId: canonicalBase };
      }
      if (clean.startsWith(base + '-') || clean.startsWith(base + ':')) {
        const suffix = clean.slice(base.length + 1);
        if (isFastSuffix(suffix)) {
          return { wireModel, isFast: true, canonicalId: `${canonicalBase}-fast` };
        }
        if (isThinkingSuffix(suffix)) {
          return { wireModel, isFast: false, canonicalId: canonicalBase };
        }
      }
    }
    return null;
  };

  // 1. Big Pickle
  const bigPickleMatch = matchModelVariant(
    ['big-pickle'],
    'big-pickle',
    'big-pickle'
  );
  if (bigPickleMatch) return bigPickleMatch;

  // 2. Xiaomi MiMo v2.5 Free
  const mimoMatch = matchModelVariant(
    ['mimo-v2.5-free', 'mimo-v2.5', 'mimo-2.5-free', 'mimo-2.5'],
    'mimo-v2.5-free',
    'mimo-v2.5-free'
  );
  if (mimoMatch) return mimoMatch;

  // 3. Ling 3.0 Flash Free
  const lingMatch = matchModelVariant(
    ['ling-3.0-flash-fin-free', 'ling-3.0-flash-free', 'ling-3.0-flash-fin', 'ling-3.0-flash'],
    'ling-3.0-flash-fin-free',
    'ling-3.0-flash-fin-free'
  );
  if (lingMatch) return lingMatch;

  // 4. NVIDIA Nemotron 3 Ultra Free
  const nemotronUltraMatch = matchModelVariant(
    ['nemotron-3-ultra-free', 'nemotron-3-ultra', 'nemotron-ultra-free', 'nemotron-ultra'],
    'nemotron-3-ultra-free',
    'nemotron-3-ultra-free'
  );
  if (nemotronUltraMatch) return nemotronUltraMatch;

  // 5. NVIDIA Nemotron 3.5 Lightning Free
  const nemotronLightningMatch = matchModelVariant(
    ['nemotron-3.5-lightning-free', 'nemotron-3.5-lightning', 'nemotron-lightning-free', 'nemotron-lightning'],
    'nemotron-3.5-lightning-free',
    'nemotron-3.5-lightning-free'
  );
  if (nemotronLightningMatch) return nemotronLightningMatch;

  return null;
}

export interface ExecuteOpenCodeOptions {
  body: any;
  modelId: string;
  resolvedModel: ResolvedOpenCodeModel;
  onFinish?: (content: string, reasoning: string) => void;
}

export async function executeOpenCodeCompletion({
  body,
  modelId,
  resolvedModel,
  onFinish,
}: ExecuteOpenCodeOptions): Promise<NextResponse> {
  const isStream = body.stream === true;
  const now = Date.now();
  const availableAccounts = OPENCODE_GUEST_ACCOUNTS.filter(a => a.cooldownUntil <= now);

  if (availableAccounts.length === 0) {
    const minCooldownSec = Math.min(...OPENCODE_GUEST_ACCOUNTS.map(a => Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))));
    const refreshTimeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(now + minCooldownSec * 1000)) + ' IST';

    const accountBreakdown = OPENCODE_GUEST_ACCOUNTS.map(a => `${a.name}: Cooldown (${Math.max(1, Math.ceil((a.cooldownUntil - now) / 1000))}s)`).join(' | ');

    return NextResponse.json(
      {
        error: {
          message: `[OpenCode Rate Limit]: All 16 OpenCode guest accounts are rate-limited. [${accountBreakdown}]. Refreshing in ${minCooldownSec}s (Ready at ${refreshTimeStr}). Please wait ${minCooldownSec}s before retrying.`,
          type: 'upstream_rate_limit',
          code: 429,
          retry_after: minCooldownSec,
          refresh_in_seconds: minCooldownSec,
          ready_at: refreshTimeStr,
        }
      },
      {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(minCooldownSec),
        }
      }
    );
  }

  // Construct pure OpenAI compatible payload for OpenCode
  const opencodePayload: any = { ...body };
  opencodePayload.model = resolvedModel.wireModel;

  // Strip proxy-internal flags
  delete opencodePayload.bypass_injections;
  delete opencodePayload.disable_memory;

  // Handle No-Think / Fast parameter configuration
  const shouldDisableThinking =
    resolvedModel.isFast ||
    body.reasoning_effort === 'none' ||
    body.reasoning_effort === 'off' ||
    body.thinking_budget === 0 ||
    body.thinking?.type === 'disabled' ||
    body.max_thinking_tokens === 0;

  if (shouldDisableThinking) {
    opencodePayload.reasoning_effort = 'none';
    opencodePayload.thinking = { type: 'disabled' };
    delete opencodePayload.max_thinking_tokens;
  } else {
    if (body.reasoning_effort && body.reasoning_effort !== 'off') {
      opencodePayload.reasoning_effort = body.reasoning_effort;
    }
    if (typeof body.thinking_budget === 'number' && body.thinking_budget > 0) {
      opencodePayload.max_thinking_tokens = body.thinking_budget;
    }
  }

  // Parameter alias normalization for vLLM / llama.cpp / Aphrodite
  if (typeof opencodePayload.tfs === 'number' && opencodePayload.tfs_z === undefined) {
    opencodePayload.tfs_z = opencodePayload.tfs;
  }

  // Cyclic round-robin order starting from picked account
  const primaryAccount = pickOpenCodeAccount();
  const primaryIdx = OPENCODE_GUEST_ACCOUNTS.findIndex(a => a.id === primaryAccount.id);
  const orderedAccounts: OpenCodeGuestAccount[] = [];
  for (let i = 0; i < OPENCODE_GUEST_ACCOUNTS.length; i++) {
    const idx = (primaryIdx + i) % OPENCODE_GUEST_ACCOUNTS.length;
    orderedAccounts.push(OPENCODE_GUEST_ACCOUNTS[idx]);
  }
  const candidateAccounts = orderedAccounts.filter(a => a.cooldownUntil <= Date.now());

  const maxAttempts = candidateAccounts.length;
  let lastError = '';
  let lastStatus = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const account = candidateAccounts[attempt];
    const requestId = crypto.randomUUID();

    try {
      const abortCtrl = new AbortController();
      const timeoutMs = modelId.includes('nemotron') ? 95000 : 50000;
      const timeoutId = setTimeout(() => abortCtrl.abort(), timeoutMs);

      const upstreamRes = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'opencode-cli/1.0.0',
          'x-opencode-client': 'cli',
          'x-opencode-project': 'global',
          'x-opencode-session': account.sessionId,
          'x-opencode-request': requestId,
        },
        body: JSON.stringify(opencodePayload),
        signal: abortCtrl.signal,
      });
      clearTimeout(timeoutId);

      if (upstreamRes.status === 429) {
        account.cooldownUntil = Date.now() + 20000;
        account.failCount++;
        lastStatus = 429;
        lastError = `Rate limited on OpenCode (429)`;
        continue;
      }

      if (upstreamRes.status >= 500) {
        account.failCount++;
        lastStatus = upstreamRes.status;
        const errorText = await upstreamRes.text().catch(() => '');
        lastError = `Server error on OpenCode (${upstreamRes.status}) - ${errorText.slice(0, 200)}`;

        // Allow up to 3-4 attempts with backoff before aborting, preventing false lockouts during GPU cold starts
        if (attempt >= Math.min(candidateAccounts.length - 1, 3)) {
          return NextResponse.json(
            {
              error: {
                message: `[OpenCode Upstream Error]: ${upstreamRes.status} ${upstreamRes.statusText} - ${errorText.slice(0, 300)}`,
                type: 'upstream_error',
                code: upstreamRes.status,
                model: modelId,
              }
            },
            { status: upstreamRes.status, headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }

        // Asynchronous backoff delay (1000ms * (attempt + 1) + jitter) to allow upstream container warm-up
        const backoffMs = 1000 * (attempt + 1) + Math.floor(Math.random() * 300);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      if (!upstreamRes.ok) {
        const errorText = await upstreamRes.text();
        return NextResponse.json(
          {
            error: {
              message: `[OpenCode Upstream Error]: ${upstreamRes.status} ${upstreamRes.statusText} - ${errorText.slice(0, 300)}`,
              type: 'upstream_error',
              code: upstreamRes.status,
              model: modelId,
            }
          },
          { status: upstreamRes.status, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      // Success: reset failCount
      account.failCount = 0;
      account.successCount++;

      // 1. STREAMING SSE RESPONSE
      if (isStream) {
        const reader = upstreamRes.body?.getReader();
        if (!reader) {
          throw new Error('Failed to get readable stream from OpenCode.');
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let fullContent = '';
        let fullThinking = '';
        let hasTerminated = false;

        const customStream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) {
                    if (!hasTerminated) {
                      controller.enqueue(encoder.encode('\n'));
                    }
                    continue;
                  }

                  if (trimmed.startsWith(':')) {
                    // Pass-through SSE comments (e.g. : keep-alive)
                    if (!hasTerminated) {
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                    continue;
                  }

                  if (trimmed === 'data: [DONE]') {
                    if (!hasTerminated) {
                      hasTerminated = true;
                      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    }
                    continue;
                  }

                  // Drop any post-[DONE] metadata chunks from upstream
                  if (hasTerminated) {
                    continue;
                  }

                  if (trimmed.startsWith('data: ')) {
                    try {
                      const json = JSON.parse(trimmed.slice(6));
                      // Skip empty choices chunks without usage data
                      if (Array.isArray(json.choices) && json.choices.length === 0 && !json.usage) {
                        continue;
                      }

                      // Normalize model name to client's requested model
                      json.model = modelId;

                      const delta = json.choices?.[0]?.delta;
                      if (delta) {
                        // Preserve and dual-map thinking tokens
                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                        if (reasoning) {
                          delta.reasoning_content = reasoning;
                          delta.reasoning = reasoning;
                          fullThinking += reasoning;
                        }
                        if (delta.content) {
                          fullContent += delta.content;
                        }
                      }

                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`));
                    } catch {
                      controller.enqueue(encoder.encode(line + '\n'));
                    }
                  } else {
                    controller.enqueue(encoder.encode(line + '\n'));
                  }
                }
              }

              // Flush remaining buffer
              if (buffer.trim() && !hasTerminated) {
                const trimmed = buffer.trim();
                if (trimmed === 'data: [DONE]') {
                  hasTerminated = true;
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } else if (trimmed.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(trimmed.slice(6));
                    if (!Array.isArray(json.choices) || json.choices.length > 0 || json.usage) {
                      json.model = modelId;
                      const delta = json.choices?.[0]?.delta;
                      if (delta) {
                        const reasoning = delta.reasoning_content || delta.reasoning || '';
                        if (reasoning) {
                          delta.reasoning_content = reasoning;
                          delta.reasoning = reasoning;
                          fullThinking += reasoning;
                        }
                        if (delta.content) fullContent += delta.content;
                      }
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`));
                    }
                  } catch {
                    controller.enqueue(encoder.encode(buffer + '\n'));
                  }
                }
              }

              // Guarantee terminal [DONE] event
              if (!hasTerminated) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                hasTerminated = true;
              }

              controller.close();

              if (onFinish) {
                try {
                  onFinish(fullContent, fullThinking);
                } catch {}
              }
            } catch (streamErr) {
              controller.error(streamErr);
            }
          }
        });

        return new NextResponse(customStream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }

      // 2. NON-STREAMING JSON RESPONSE
      const json: any = await upstreamRes.json();
      json.model = modelId;

      const choice = json.choices?.[0];
      if (choice?.message) {
        const reasoning = choice.message.reasoning_content || choice.message.reasoning || '';
        if (reasoning) {
          choice.message.reasoning_content = reasoning;
          choice.message.reasoning = reasoning;
        }
        if (onFinish) {
          try {
            onFinish(choice.message.content || '', reasoning);
          } catch {}
        }
      }

      return NextResponse.json(json, {
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });

    } catch (err: any) {
      account.failCount++;
      lastError = err.message || 'Network error';
    }
  }

  // All attempted accounts failed
  return NextResponse.json(
    {
      error: {
        message: `[OpenCode Error]: Request for model '${modelId}' failed across all attempted guest accounts. Last error: ${lastError}`,
        type: 'upstream_error',
        code: lastStatus,
      }
    },
    { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502, headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
