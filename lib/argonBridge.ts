import https from 'node:https';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { NextResponse } from 'next/server';

export interface LanguageServerInfo {
  port: number;
  csrfToken: string;
}

let cachedInfo: LanguageServerInfo | null = null;
let lastDiscoveryTime = 0;

export function isArgonBridgeModel(modelId?: string): boolean {
  if (!modelId) return false;
  const clean = modelId
    .toLowerCase()
    .trim()
    .replace(/^([a-z0-9_\-.]+\/)+/, '')
    .replace(/^(models\/|publishers\/google\/models\/)/, '')
    .replace(/:[a-z0-9_\-.]+$/, '')
    .replace(/_/g, '-');

  return (
    clean === 'gemini-4-argon' ||
    clean === 'gemini-4' ||
    clean === 'argon' ||
    clean === 'argon-tiered' ||
    clean === 'argon-high' ||
    clean === 'argon-max' ||
    clean === 'argon-medium' ||
    clean === 'argon-low' ||
    clean === 'argon-fast' ||
    clean === 'gemini-4-argon-low' ||
    clean === 'gemini-4-argon-fast' ||
    clean === 'gemini-4-argon-medium' ||
    clean === 'gemini-4-argon-high' ||
    clean === 'gemini-4-argon-max' ||
    clean === 'gemini-4-low' ||
    clean === 'gemini-4-fast' ||
    clean === 'gemini-4-medium' ||
    clean === 'gemini-4-high' ||
    clean.startsWith('claude-opus-5-5') ||
    clean.startsWith('opus-5-5') ||
    clean.startsWith('claude-sonnet-5-5') ||
    clean.startsWith('sonnet-5-5') ||
    clean.startsWith('gpt-oss-120b')
  );
}

export function resolveArgonPlanModel(modelId?: string): string {
  const clean = (modelId || '').toLowerCase().trim();

  // Claude 5.5
  if (clean.includes('opus-5-5') || clean.includes('opus-5.5')) {
    if (clean.includes('low') || clean.includes('fast')) return 'MODEL_PLACEHOLDER_M400';
    if (clean.includes('high') || clean.includes('max')) return 'MODEL_PLACEHOLDER_M402';
    return 'MODEL_PLACEHOLDER_M401';
  }
  if (clean.includes('sonnet-5-5') || clean.includes('sonnet-5.5')) {
    if (clean.includes('low') || clean.includes('fast')) return 'MODEL_PLACEHOLDER_M403';
    if (clean.includes('high') || clean.includes('max')) return 'MODEL_PLACEHOLDER_M405';
    return 'MODEL_PLACEHOLDER_M404';
  }

  // GPT-OSS 120B
  if (clean.includes('gpt-oss')) {
    return 'MODEL_OPENAI_GPT_OSS_120B_MEDIUM';
  }

  // Gemini 4 Argon
  if (clean.includes('low') || clean.includes('fast') || clean.endsWith('-low') || clean.endsWith('-fast')) {
    return 'MODEL_PLACEHOLDER_M419';
  }
  if (clean.includes('high') || clean.includes('max') || clean.endsWith('-high') || clean.endsWith('-max')) {
    return 'MODEL_PLACEHOLDER_M417';
  }

  // Default Argon Medium
  return 'MODEL_PLACEHOLDER_M418';
}

export function discoverLanguageServer(): LanguageServerInfo | null {
  const now = Date.now();
  if (cachedInfo && (now - lastDiscoveryTime < 60000)) {
    return cachedInfo;
  }

  // 1. Environment variables override
  const envPort = process.env.LOCAL_LS_PORT;
  const envToken = process.env.LOCAL_LS_CSRF_TOKEN;
  if (envPort && envToken) {
    cachedInfo = { port: parseInt(envPort, 10), csrfToken: envToken.trim() };
    lastDiscoveryTime = now;
    return cachedInfo;
  }

  // 2. Discover from Windows process table
  try {
    const cmdLineOut = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'language_server.exe\'\\" | Select-Object -Property ProcessId, CommandLine | ConvertTo-Json"', { encoding: 'utf8', timeout: 5000 });
    if (!cmdLineOut || !cmdLineOut.trim()) return null;

    let procData: any = JSON.parse(cmdLineOut);
    if (Array.isArray(procData)) procData = procData[0];
    if (!procData || !procData.CommandLine) return null;

    const pid = procData.ProcessId;
    const cmdLine = procData.CommandLine;

    // Extract csrf token: --csrf_token <token>
    const matchToken = cmdLine.match(/--csrf_token\s+([a-f0-9\-]+)/i);
    const csrfToken = matchToken ? matchToken[1] : null;
    if (!csrfToken) return null;

    // Find listening port for this PID
    const netstatOut = execSync(`cmd /c "netstat -ano | findstr ${pid}"`, { encoding: 'utf8', timeout: 5000 });
    const listeningLines = netstatOut.split('\n').filter(l => l.includes('LISTENING') && l.includes('127.0.0.1:'));

    const ports: number[] = [];
    for (const l of listeningLines) {
      const matchPort = l.match(/127\.0\.0\.1:(\d+)/);
      if (matchPort) ports.push(parseInt(matchPort[1], 10));
    }
    ports.sort((a, b) => a - b);
    if (ports.length === 0) return null;

    cachedInfo = { port: ports[0], csrfToken };
    lastDiscoveryTime = now;
    return cachedInfo;
  } catch (e: any) {
    console.warn('[Argon Bridge]: Language server discovery warning:', e.message);
    return null;
  }
}

export function callLanguageServerRpc(info: LanguageServerInfo, method: string, body: any, timeoutMs: number = 30000): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: '127.0.0.1',
      port: info.port,
      path: `/exa.language_server_pb.LanguageServerService/${method}`,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': info.csrfToken,
        'Connect-Protocol-Version': '1',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout calling LanguageServerService.${method}`));
    });
    req.write(postData);
    req.end();
  });
}

export function formatMessagesForArgon(messages: any[], userInjectionsText?: string, systemInjectionsText?: string): string {
  let systemParts: string[] = [];
  let conversationTurns: string[] = [];
  let lastUserText = '';

  for (const m of messages) {
    if (!m) continue;
    let text = typeof m.content === 'string' ? m.content : '';
    if (Array.isArray(m.content)) {
      text = m.content.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('\n');
    }
    text = text.trim();
    if (!text) continue;

    if (m.role === 'system') {
      systemParts.push(text);
    } else if (m.role === 'user') {
      conversationTurns.push(`User: ${text}`);
      lastUserText = text;
    } else if (m.role === 'assistant') {
      conversationTurns.push(`Assistant: ${text}`);
    }
  }

  if (systemInjectionsText && systemInjectionsText.trim()) {
    systemParts.push(systemInjectionsText.trim());
  }

  let finalPrompt = '';

  if (systemParts.length > 0) {
    finalPrompt += `[System Instructions & Character Persona]:\n${systemParts.join('\n\n')}\n\n`;
  }

  if (conversationTurns.length > 1) {
    finalPrompt += `[Dialogue History]:\n${conversationTurns.slice(0, -1).join('\n\n')}\n\n`;
  }

  finalPrompt += `[Current Scenario Turn]:\nUser: ${lastUserText || 'Continue the scenario naturally.'}\n`;

  if (userInjectionsText && userInjectionsText.trim()) {
    finalPrompt += `\n[Active Persona & Formatting Directives]:\n${userInjectionsText.trim()}\n`;
  }

  finalPrompt += `\nAssistant:`;

  return finalPrompt;
}

export interface ExecuteArgonCompletionOptions {
  body: any;
  modelId: string;
  userInjectionsText?: string;
  systemInjectionsText?: string;
  onFinish?: (content: string, thinking: string) => void;
  onStreamDone?: () => void;
}

export async function executeArgonCompletion(options: ExecuteArgonCompletionOptions): Promise<NextResponse> {
  const { body, modelId, userInjectionsText, systemInjectionsText, onFinish, onStreamDone } = options;
  const isStream = body.stream === true || body.stream === 'true';

  const lsInfo = discoverLanguageServer();
  if (!lsInfo) {
    return NextResponse.json(
      {
        error: {
          message: `[Gemini 4 Argon]: Antigravity Language Server (language_server.exe) is not running on this machine or could not be detected. Please ensure Antigravity IDE is open to enable local Gemini 4 Argon routing.`,
          type: 'upstream_unavailable',
          code: 503,
          model: modelId
        }
      },
      { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const planModelEnum = resolveArgonPlanModel(modelId);
  const formattedPrompt = formatMessagesForArgon(body.messages || [], userInjectionsText, systemInjectionsText);

  // 1. Start Cascade
  let cascadeId: string;
  try {
    const startRes = await callLanguageServerRpc(lsInfo, 'StartCascade', {
      source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT',
      requestedModel: planModelEnum
    });
    cascadeId = startRes.cascadeId;
    if (!cascadeId) throw new Error('StartCascade returned no cascadeId');
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          message: `[Gemini 4 Argon]: Failed to start cascade session: ${err.message}`,
          type: 'upstream_error',
          code: 500,
          model: modelId
        }
      },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // 2. Send User Message with Argon Model Config
  try {
    await callLanguageServerRpc(lsInfo, 'SendUserCascadeMessage', {
      cascadeId,
      cascadeConfig: {
        plannerConfig: {
          planModel: planModelEnum
        }
      },
      items: [
        { text: formattedPrompt }
      ]
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          message: `[Gemini 4 Argon]: Failed to dispatch message to Argon model: ${err.message}`,
          type: 'upstream_error',
          code: 500,
          model: modelId
        }
      },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // 3. Trajectory Polling Engine
  const chatcmplId = `chatcmpl-argon-${crypto.randomUUID().slice(0, 8)}`;
  const created = Math.floor(Date.now() / 1000);

  // Helper to fetch final completed step
  async function waitForArgonResponse(): Promise<{ content: string; thinking: string }> {
    const startTime = Date.now();
    const timeoutMs = 60000;
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 250));
      try {
        const stepsRes = await callLanguageServerRpc(lsInfo, 'GetCascadeTrajectorySteps', { cascadeId });
        const steps = stepsRes.steps || [];
        for (const s of steps) {
          const isDone = s.status === 'CORTEX_STEP_STATUS_DONE' || s.status === 2 || Boolean(s.plannerResponse?.stopReason);
          if (s.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE' && s.plannerResponse && isDone) {
            let rawContent = s.plannerResponse.response || s.plannerResponse.modifiedResponse || '';
            let thinking = s.plannerResponse.thinkingSignature || '';

            // Extract <think>...</think> if emitted inline by the reasoning model
            const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/i);
            if (thinkMatch) {
              thinking = thinking ? `${thinking}\n${thinkMatch[1].trim()}` : thinkMatch[1].trim();
              rawContent = thinkMatch[2].trim();
            }

            return { content: rawContent, thinking };
          }
          if (s.type === 'CORTEX_STEP_TYPE_ERROR_MESSAGE' && s.errorMessage) {
            throw new Error(`Argon model error: ${JSON.stringify(s.errorMessage)}`);
          }
        }
      } catch (pollErr: any) {
        if (pollErr.message?.includes('Argon model error')) throw pollErr;
      }
    }
    throw new Error('Timeout waiting for Gemini 4 Argon response from local Language Server.');
  }

  if (!isStream) {
    try {
      const { content, thinking } = await waitForArgonResponse();
      if (onFinish) onFinish(content, thinking);

      const promptTokens = Math.max(1, Math.floor(formattedPrompt.length / 4));
      const completionTokens = Math.max(1, Math.floor(content.length / 4));

      return NextResponse.json(
        {
          id: chatcmplId,
          object: 'chat.completion',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content,
                reasoning_content: thinking || undefined
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
          }
        },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    } catch (err: any) {
      return NextResponse.json(
        {
          error: {
            message: `[Gemini 4 Argon]: Generation failed: ${err.message}`,
            type: 'upstream_error',
            code: 500,
            model: modelId
          }
        },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
  }

  // Streaming Response (SSE)
  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      try {
        const { content, thinking } = await waitForArgonResponse();

        if (onFinish) onFinish(content, thinking);

        // Emit thinking tokens first if present
        if (thinking) {
          const thinkingChunk = {
            id: chatcmplId,
            object: 'chat.completion.chunk',
            created,
            model: modelId,
            choices: [
              {
                index: 0,
                delta: {
                  role: 'assistant',
                  reasoning_content: thinking,
                  thought: thinking
                },
                finish_reason: null
              }
            ]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(thinkingChunk)}\n\n`));
        }

        // Stream content smoothly in word-sized tokens
        const words = content.split(/(\s+)/);
        for (const w of words) {
          if (!w) continue;
          const chunk = {
            id: chatcmplId,
            object: 'chat.completion.chunk',
            created,
            model: modelId,
            choices: [
              {
                index: 0,
                delta: {
                  content: w
                },
                finish_reason: null
              }
            ]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        // Terminal stop chunk
        const stopChunk = {
          id: chatcmplId,
          object: 'chat.completion.chunk',
          created,
          model: modelId,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }
          ]
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(stopChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err: any) {
        controller.error(err);
      } finally {
        if (onStreamDone) onStreamDone();
      }
    },
    cancel() {
      if (onStreamDone) onStreamDone();
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
