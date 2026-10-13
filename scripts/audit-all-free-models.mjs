import { generateSessionId, generateMessageId, OPENCODE_OFFICIAL_TOOLS } from './test-contract.mjs';
import fs from 'node:fs';

const CANDIDATES = [
  // 1. From upstream models catalog
  'big-pickle',
  'space-bunny-free',
  'snow-bunny', // alias test
  'cat-jam-free',
  'mimo-v2.6-flash-free',
  'mimo-v2.5-free',
  'ling-3.1-flash-free',
  'ling-3.0-flash-fin-free',
  'longcat-2.5-preview-free',
  'step-5-preview-free',
  'nemotron-3.5-lightning-free',
  'nemotron-3-ultra-free',
  'muse-spark-1.3-contributor-free',
  'muse-spark-1.2-contributor-free',
  'jev-1.13-free',
  // 2. Stealth / Other potential free models
  'exo-free',
  'fledge-alpha-free',
  'x-preview-f-free',
  'laguna-s-2.1-free',
  'glm-4.7-free',
  'glm-5-free',
  'ring-2.6-1t-free',
  'north-mini-code-free',
  'trinity-large-preview-free',
  'deepseek-v4-flash-free',
  'hy3-free',
  'kimi-k2.5-free',
  'minimax-m2.5-free',
  'minimax-m3-free',
  'qwen3.6-plus-free'
];

async function testModel(modelId, endpoint = 'https://opencode.ai/zen/v1/chat/completions') {
  const sessionId = generateSessionId();
  const requestId = generateMessageId();
  const headers = {
    'Authorization': 'Bearer public',
    'User-Agent': 'opencode/2.0.26 ai-sdk/provider-utils/4.0.21 runtime/bun/1.4.2',
    'Content-Type': 'application/json',
    'x-opencode-client': 'cli',
    'x-opencode-project': 'global',
    'x-opencode-session': sessionId,
    'x-opencode-request': requestId,
  };

  const payload = {
    model: modelId,
    messages: [{ role: 'user', content: 'Say hello in 3 words.' }],
    stream: true,
    tools: OPENCODE_OFFICIAL_TOOLS,
  };

  const start = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const duration = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr = errText;
      try {
        const j = JSON.parse(errText);
        parsedErr = j.error?.message || j.message || errText;
      } catch {}
      return {
        modelId,
        endpoint,
        status: res.status,
        duration,
        ok: false,
        hasReasoning: false,
        sampleOutput: '',
        error: parsedErr.slice(0, 100)
      };
    }

    // Read SSE stream chunks
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let fullContent = '';
    let fullReasoning = '';

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      done = streamDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const json = JSON.parse(trimmed.slice(6));
              const delta = json.choices?.[0]?.delta;
              if (delta) {
                if (delta.content) fullContent += delta.content;
                if (delta.reasoning_content) fullReasoning += delta.reasoning_content;
                if (delta.reasoning) fullReasoning += delta.reasoning;
              }
            } catch {}
          }
        }
      }
      // If we already collected sufficient response and it's long, don't wait forever
      if (fullContent.length > 50 && fullReasoning.length > 50) {
        // Can continue or let it finish naturally
      }
    }

    return {
      modelId,
      endpoint,
      status: res.status,
      duration,
      ok: true,
      hasReasoning: fullReasoning.length > 0,
      sampleOutput: fullContent.trim().slice(0, 80),
      reasoningSnippet: fullReasoning.trim().slice(0, 60),
      error: ''
    };
  } catch (err) {
    return {
      modelId,
      endpoint,
      status: 0,
      duration: Date.now() - start,
      ok: false,
      hasReasoning: false,
      sampleOutput: '',
      error: err.message
    };
  }
}

async function run() {
  console.log(`Starting audit of ${CANDIDATES.length} model candidates...`);
  const results = [];

  for (const model of CANDIDATES) {
    process.stdout.write(`Testing ${model}... `);
    // Prefer zen/v1 first
    let res = await testModel(model, 'https://opencode.ai/zen/v1/chat/completions');
    if (!res.ok && res.status === 404) {
      // Try inference/v1 if 404 on zen
      const infRes = await testModel(model, 'https://opencode.ai/inference/v1/chat/completions');
      if (infRes.ok) {
        res = infRes;
      }
    }
    results.push(res);
    console.log(`${res.ok ? '✓ 200 OK' : '✗ ' + res.status} (${res.duration}ms) Reasoning: ${res.hasReasoning ? 'YES' : 'NO'}`);
    if (res.ok) {
      console.log(`   Output: "${res.sampleOutput}"`);
    } else {
      console.log(`   Error: ${res.error}`);
    }
    // Small pause to avoid tripping rapid spam rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  fs.writeFileSync('scripts/audit-results.json', JSON.stringify(results, null, 2));
  console.log('\nWrote all results to scripts/audit-results.json');
}

run();
