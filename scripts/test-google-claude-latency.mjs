import fs from 'node:fs';

const BASE_URL = 'https://antigravity-openai-proxy.vercel.app/v1/chat/completions';
const API_KEY = 'KARS-2010915';

const MODELS = [
  'gemini-3.8-flash-fast',
  'gemini-3.8-flash',
  'gemini-3.8-flash-high',
  'gemini-3.8-flash-max',
  'gemini-3.8-flash-search',
  'gemini-3.8-flash-high-search',
  'claude-sonnet-4-6',
  'claude-opus-4-6-thinking',
];

async function testModel(modelId) {
  const startTime = Date.now();
  let ttft = null;
  let text = '';
  let errorMsg = null;
  let status = 0;

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Reply in one short sentence: What is your model name and capabilities?' }],
        stream: true,
        max_tokens: 60,
      }),
    });

    status = res.status;
    if (!res.ok) {
      const errText = await res.text();
      return { modelId, status, errorMsg: errText.slice(0, 100), ttft: null, totalMs: Date.now() - startTime, text: '' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        if (ttft === null) {
          ttft = Date.now() - startTime;
        }
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.delta?.text || '';
              text += delta;
            } catch (_) {}
          }
        }
      }
    }

    const totalMs = Date.now() - startTime;
    return { modelId, status: 200, ttft: ttft || totalMs, totalMs, text: text.trim().replace(/\n/g, ' ').slice(0, 80) };
  } catch (err) {
    return { modelId, status: 0, errorMsg: err.message, ttft: null, totalMs: Date.now() - startTime, text: '' };
  }
}

async function run() {
  console.log(`Testing Live Gateway Models at ${BASE_URL}...\n`);
  for (const model of MODELS) {
    process.stdout.write(`Testing ${model.padEnd(30)} ... `);
    const result = await testModel(model);
    if (result.status === 200) {
      console.log(`[✓ 200 OK] TTFT: ${result.ttft}ms | Total: ${result.totalMs}ms | "${result.text.slice(0, 45)}..."`);
    } else {
      console.log(`[X ${result.status}] Error: ${result.errorMsg || 'Failed'} (${result.totalMs}ms)`);
    }
  }
}

run();
