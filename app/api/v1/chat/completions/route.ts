import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  getAccounts,
  pickAccount,
  getAccessToken,
  transformOpenAIToAntigravity,
} from '@/lib/antigravity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
  'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
];

function checkAuth(req: NextRequest): boolean {
  const proxyKey = process.env.PROXY_API_KEY;
  if (!proxyKey) return true;
  const authHeader = req.headers.get('authorization') || '';
  const customKey = req.headers.get('api-key') || req.headers.get('x-api-key') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : customKey.trim();
  return token === proxyKey.trim();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, x-api-key',
    },
  });
}

export async function POST(req: NextRequest) {
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
  const modelId = body.model || 'gemini-3.7-flash';
  const accounts = getAccounts();

  let lastError: any = null;
  for (let attempt = 0; attempt < Math.max(1, accounts.length); attempt++) {
    const account = pickAccount();
    try {
      const accessToken = await getAccessToken(account);
      const envelope = transformOpenAIToAntigravity(body, modelId, account.projectId);

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
            continue;
          } else {
            const errText = await res.text();
            console.warn(`Upstream ${upstreamUrl} returned ${res.status}: ${errText}`);
          }
        } catch (e) {
          console.warn(`Error connecting to ${upstreamUrl}:`, e);
        }
      }

      if (!upstreamRes) {
        account.failCount++;
        account.cooldownUntil = Date.now() + 30000;
        continue;
      }

      account.failCount = 0;

      // Streaming response with <think> tag & reasoning_content handling
      if (stream) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const chatcmplId = `chatcmpl-${crypto.randomUUID().slice(0, 8)}`;

        const customStream = new ReadableStream({
          async start(controller) {
            const reader = upstreamRes!.body?.getReader();
            if (!reader) {
              controller.close();
              return;
            }

            let inThinking = false;
            let hasThoughtStarted = false;
            let hasThoughtEnded = false;
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
                        if (!hasThoughtStarted) {
                          hasThoughtStarted = true;
                          inThinking = true;
                          controller.enqueue(
                            encoder.encode(
                              `data: ${JSON.stringify({
                                id: chatcmplId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: modelId,
                                choices: [{ index: 0, delta: { content: '<think>\n', reasoning_content: '' }, finish_reason: null }],
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
                              choices: [{ index: 0, delta: { content: text, reasoning_content: text }, finish_reason: null }],
                            })}\n\n`
                          )
                        );
                      } else {
                        if (inThinking && !hasThoughtEnded) {
                          inThinking = false;
                          hasThoughtEnded = true;
                          controller.enqueue(
                            encoder.encode(
                              `data: ${JSON.stringify({
                                id: chatcmplId,
                                object: 'chat.completion.chunk',
                                created: Math.floor(Date.now() / 1000),
                                model: modelId,
                                choices: [{ index: 0, delta: { content: '\n</think>\n\n' }, finish_reason: null }],
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
                              choices: [{ index: 0, delta: { content: text }, finish_reason: cand.finishReason || null }],
                            })}\n\n`
                          )
                        );
                      }
                    }
                  } catch {}
                }
              }
            }

            if (inThinking && !hasThoughtEnded) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    id: chatcmplId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: modelId,
                    choices: [{ index: 0, delta: { content: '\n</think>\n\n' }, finish_reason: 'stop' }],
                  })}\n\n`
                )
              );
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });

        return new NextResponse(customStream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Non-streaming response with <think> tag & reasoning_content handling
      const fullText = await upstreamRes.text();
      let thoughtText = '';
      let contentText = '';
      const lines = fullText.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const parts = parsed.response?.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.thought === true) {
                thoughtText += part.text || '';
              } else {
                contentText += part.text || '';
              }
            }
          } catch {}
        }
      }

      let finalContent = contentText;
      if (thoughtText.trim()) {
        finalContent = `<think>\n${thoughtText.trim()}\n</think>\n\n${contentText.trimStart()}`;
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
                content: finalContent,
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
      lastError = err;
      console.error(`Attempt failed on ${account.name}:`, err.message);
    }
  }

  return NextResponse.json(
    { error: { message: lastError ? lastError.message : 'All configured accounts failed or rate limited.' } },
    {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
