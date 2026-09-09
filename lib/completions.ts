import { NextRequest, NextResponse, after } from 'next/server';
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
import {
  getActiveInjectionsFormatted,
  detectInChatCommand,
  executeInChatCommand
} from './injections';
import {
  resolveOpenCodeModel,
  executeOpenCodeCompletion,
} from './opencode';
import {
  DEFAULT_GENERATION_SETTINGS,
  getGlobalGenSettings,
  getCachedSessionGenSettings,
  setCachedSessionGenSettings,
  executeGenSettingsCommand,
  mergeGenerationSettings,
  GenerationSettings,
} from './genSettings';

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
  const openCodeResolved = resolveOpenCodeModel(requestedModel);
  const resolved = openCodeResolved ? null : resolveWireModel(requestedModel);

  if (!openCodeResolved && !resolved) {
    return NextResponse.json(
      {
        error: {
          message: `[Model Not Found]: '${requestedModel}' is not a valid or supported model on Antigravity Proxy. Supported models: gemini-3.8-flash, gemini-3.7-flash, gemini-3.1-pro, gemini-3.1-pro-low, gemini-3.1-pro-fast, big-pickle, big-pickle-fast, mimo-v2.5-free, mimo-v2.5-free-fast, ling-3.0-flash-fin-free, ling-3.0-flash-fin-free-fast, nemotron-3-ultra-free, nemotron-3-ultra-free-fast, nemotron-3.5-lightning-free, nemotron-3.5-lightning-free-fast.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
          requested_model: requestedModel,
          available_models: [
            'gemini-3.8-flash',
            'gemini-3.8-flash-high',
            'gemini-3.8-flash-max',
            'gemini-3.8-flash-fast',
            'gemini-3.7-flash',
            'gemini-3.7-flash-high',
            'gemini-3.7-flash-max',
            'gemini-3.7-flash-medium',
            'gemini-3.7-flash-low',
            'gemini-3.1-pro',
            'gemini-3.1-pro-low',
            'gemini-3.1-pro-fast',
            'gemini-3.5-flash',
            'claude-opus-4-6-thinking',
            'claude-sonnet-4-6',
            'big-pickle',
            'big-pickle-fast',
            'mimo-v2.5-free',
            'mimo-v2.5-free-fast',
            'ling-3.0-flash-fin-free',
            'ling-3.0-flash-fin-free-fast',
            'nemotron-3-ultra-free',
            'nemotron-3-ultra-free-fast',
            'nemotron-3.5-lightning-free',
            'nemotron-3.5-lightning-free-fast'
          ]
        }
      },
      { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const modelId = requestedModel;

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
  let currentChatId: string | null = null;
  let sessionPromise: Promise<any> | null = null;
  const disableMemory = req.headers.get('x-disable-memory') === 'true' || body.disable_memory === true;

  if (!disableMemory) {
    try {
      const { characterId, characterName, chatId, sessionTitle } = deriveChatFingerprint(
        messages,
        rawSystemText,
        req.headers
      );
      currentChatId = chatId;
      // Non-blocking: execute session lookup in the background parallel to Google call
      sessionPromise = getOrCreateChatSession(chatId, characterId, characterName, sessionTitle).then(s => {
        if (rawSystemText && s) s.systemPrompt = rawSystemText;
        return s;
      }).catch(err => {
        console.warn('Memory engine non-blocking warning:', err);
        return null;
      });
    } catch (memErr) {
      console.warn('Memory fingerprint non-blocking warning:', memErr);
    }
  }

  // Check for In-Chat Roleplay Control Commands (<MYSETTINGS>, <GENSETTINGS>, <SET: ...>, <RESET_SETTINGS>, <ENABLE: ...>, <DISABLE: ...>)
  const inChatCmd = detectInChatCommand(latestUserText);
  if (inChatCmd) {
    let menuOutput = '';
    if (inChatCmd.type === 'view_gen' || inChatCmd.type === 'set_gen' || inChatCmd.type === 'reset_gen') {
      let session: any = null;
      if (sessionPromise) {
        session = await sessionPromise.catch(() => null);
      }
      menuOutput = await executeGenSettingsCommand(inChatCmd, session);
    } else {
      menuOutput = await executeInChatCommand(inChatCmd);
    }

    // Record command exchange into session asynchronously for visibility in dashboard
    if (sessionPromise) {
      const recordTask = async () => {
        try {
          const session = await sessionPromise;
          if (session) {
            await recordTurnsIntoSession(session, messages, menuOutput, undefined, undefined, undefined);
          }
        } catch {}
      };
      try {
        if (typeof after === 'function') {
          after(recordTask);
        } else {
          recordTask().catch(() => {});
        }
      } catch {
        recordTask().catch(() => {});
      }
    }

    if (body.stream) {
      return buildImmediateCommandStreamResponse(menuOutput, modelId);
    } else {
      return buildImmediateCommandJsonResponse(menuOutput, modelId);
    }
  }

  // Resolve effective generation settings (Defaults -> Global Settings -> Client Body -> Session Overrides)
  const globalGenSettings = await getGlobalGenSettings();
  let sessionGenSettings: Partial<GenerationSettings> | undefined = undefined;
  if (currentChatId) {
    const cached = getCachedSessionGenSettings(currentChatId);
    if (cached !== undefined) {
      sessionGenSettings = cached || undefined;
    }
  }

  // Populate cache asynchronously in background, NEVER block hot-path inference
  if (currentChatId && sessionPromise && getCachedSessionGenSettings(currentChatId) === undefined) {
    sessionPromise.then(session => {
      if (currentChatId && getCachedSessionGenSettings(currentChatId) === undefined) {
        setCachedSessionGenSettings(currentChatId, session?.generationSettings || null);
      }
    }).catch(() => {});
  }
  const effectiveSettings = mergeGenerationSettings(
    DEFAULT_GENERATION_SETTINGS,
    globalGenSettings,
    body,
    sessionGenSettings
  );

  const enhancedBody = {
    ...body,
    ...effectiveSettings,
  };

  // ROUTE TO OPENCODE FREE MODELS IF MATCHED
  if (openCodeResolved) {
    const turnCount = Math.max(1, messages.filter(m => m && m.role === 'user').length);
    const bypassInjections = body.bypass_injections === true || req.headers.get('x-bypass-injections') === 'true';
    const { userInjectionsText: rawUserInj, systemInjectionsText: rawSysInj, attachedInjections: rawAttachedInj } = await getActiveInjectionsFormatted(turnCount);
    const userInjectionsText = bypassInjections ? '' : rawUserInj;
    const systemInjectionsText = bypassInjections ? '' : rawSysInj;
    const attachedInjections = bypassInjections ? [] : rawAttachedInj;
    const injectedLore = extractInjectedLore(messages, rawSystemText);

    // Sanitize past in-chat settings commands and proxy menu outputs from upstream wire history
    const sanitizedMessages = messages.filter(m => {
      if (!m) return false;
      const text = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n') : '');
      if (m.role === 'user' && detectInChatCommand(text)) return false;
      if (m.role === 'assistant' && (
        text.includes('[ANTIGRAVITY PROXY SETTINGS MENU]') ||
        text.includes('[ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]') ||
        text.includes('[ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]') ||
        text.startsWith('⚙️ [ANTIGRAVITY PROXY SETTINGS MENU]') ||
        text.startsWith('⚙️ [ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]') ||
        text.startsWith('📖 [ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]')
      )) return false;
      return true;
    });

    // Apply active prompt injections to messages copy if present
    let preparedMessages = sanitizedMessages.map(m => ({ ...m }));
    if (systemInjectionsText && systemInjectionsText.trim()) {
      const firstSys = preparedMessages.find(m => m.role === 'system');
      if (firstSys) {
        firstSys.content = typeof firstSys.content === 'string'
          ? `${firstSys.content}\n\n${systemInjectionsText.trim()}`
          : systemInjectionsText.trim();
      } else {
        preparedMessages.unshift({ role: 'system', content: systemInjectionsText.trim() });
      }
    }
    if (userInjectionsText && userInjectionsText.trim()) {
      for (let i = preparedMessages.length - 1; i >= 0; i--) {
        if (preparedMessages[i].role === 'user') {
          preparedMessages[i].content = typeof preparedMessages[i].content === 'string'
            ? `${preparedMessages[i].content}\n\n${userInjectionsText.trim()}`
            : userInjectionsText.trim();
          break;
        }
      }
    }

    return executeOpenCodeCompletion({
      body: { ...enhancedBody, messages: preparedMessages },
      modelId: requestedModel,
      resolvedModel: openCodeResolved,
      onFinish: (content, thinking) => {
        if (sessionPromise) {
          const saveTask = async () => {
            try {
              const session = await sessionPromise;
              if (session) {
                await recordTurnsIntoSession(
                  session,
                  messages,
                  content,
                  thinking || undefined,
                  injectedLore,
                  attachedInjections
                );
              }
            } catch {}
          };
          try {
            if (typeof after === 'function') {
              after(saveTask);
            } else {
              saveTask().catch(() => {});
            }
          } catch {
            saveTask().catch(() => {});
          }
        }
      }
    });
  }

  const accounts = getAccounts();
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
  const turnCount = Math.max(1, messages.filter(m => m && m.role === 'user').length);
  const bypassInjections = body.bypass_injections === true || req.headers.get('x-bypass-injections') === 'true';
  const { userInjectionsText: rawUserInj, systemInjectionsText: rawSysInj, attachedInjections: rawAttachedInj } = await getActiveInjectionsFormatted(turnCount);
  const userInjectionsText = bypassInjections ? '' : rawUserInj;
  const systemInjectionsText = bypassInjections ? '' : rawSysInj;
  const attachedInjections = bypassInjections ? [] : rawAttachedInj;

  for (const account of accountsToTry) {
    try {
      const accessToken = await getAccessToken(account);
      const envelope = transformOpenAIToAntigravity(
        enhancedBody,
        resolved,
        account.projectId,
        rawSystemText,
        userInjectionsText,
        systemInjectionsText
      );

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

        let resolveStreamDone: () => void;
        const streamDonePromise = new Promise<void>(resolve => {
          resolveStreamDone = resolve;
        });

        // Register background save task in active request scope before returning response
        if (sessionPromise) {
          const saveTask = async () => {
            try {
              await streamDonePromise;
              const session = await sessionPromise;
              if (session) {
                const injectedLore = extractInjectedLore(messages, rawSystemText);
                await recordTurnsIntoSession(
                  session,
                  messages,
                  fullAssistantContent,
                  fullThoughtContent,
                  injectedLore,
                  attachedInjections
                );
              }
            } catch {}
          };
          try {
            if (typeof after === 'function') {
              after(saveTask);
            } else {
              saveTask().catch(() => {});
            }
          } catch {
            saveTask().catch(() => {});
          }
        }

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
                                    delta: { reasoning_content: text, reasoning: text },
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

              // Flush TextDecoder & drain any remaining buffer content on stream EOF before closing
              buffer += decoder.decode();
              if (buffer.trim()) {
                const remainingLines = buffer.split('\n');
                for (const line of remainingLines) {
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
                                    delta: { reasoning_content: text, reasoning: text },
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
                buffer = '';
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
            } catch (err) {
              controller.error(err);
            } finally {
              resolveStreamDone!();
            }
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

      // Record asynchronously into memory with dynamic Lorebary injections & proxy prompt injections
      if (sessionPromise) {
        const saveTask = async () => {
          try {
            const session = await sessionPromise;
            if (session) {
              const injectedLore = extractInjectedLore(messages, rawSystemText);
              await recordTurnsIntoSession(session, messages, contentText, thoughtText, injectedLore, attachedInjections);
            }
          } catch {}
        };
        try {
          if (typeof after === 'function') {
            after(saveTask);
          } else {
            saveTask().catch(() => {});
          }
        } catch {
          saveTask().catch(() => {});
        }
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
                reasoning: thoughtText.trim() || undefined,
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

function buildImmediateCommandStreamResponse(content: string, modelId: string) {
  const encoder = new TextEncoder();
  const id = `chatcmpl-cmd-${crypto.randomUUID().slice(0, 8)}`;
  const created = Math.floor(Date.now() / 1000);

  const customStream = new ReadableStream({
    start(controller) {
      const chunk1 = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: modelId,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content },
            finish_reason: null,
          },
        ],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk1)}\n\n`));

      const chunkDone = {
        id,
        object: 'chat.completion.chunk',
        created,
        model: modelId,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkDone)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
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

function buildImmediateCommandJsonResponse(content: string, modelId: string) {
  return NextResponse.json(
    {
      id: `chatcmpl-cmd-${crypto.randomUUID().slice(0, 8)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: Math.max(1, Math.floor(content.length / 4)),
        total_tokens: 10 + Math.max(1, Math.floor(content.length / 4)),
      },
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
