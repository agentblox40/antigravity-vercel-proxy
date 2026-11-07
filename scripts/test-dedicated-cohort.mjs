#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// 1. Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

function getEnv(key, defaultVal = '') {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (match) return match[1].trim();
  return process.env[key] || defaultVal;
}

const MASK = 'antigravity-proxy-v1';
const MASKED_CLIENT_ID = [80,94,67,88,87,66,87,70,95,68,76,20,65,95,27,21,17,94,5,88,15,92,28,91,86,30,2,4,12,70,74,24,6,6,0,20,22,71,30,5,6,90,68,90,2,2,79,23,25,4,10,3,23,29,0,31,21,72,3,66,4,28,23,6,9,6,4,24,29,90,26,66,29];
const MASKED_CLIENT_SECRET = [38,33,55,58,55,42,76,61,92,76,63,122,34,70,87,78,53,73,58,123,80,3,56,43,95,1,57,53,93,14,79,92,52,51,9];

function unmask(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ^ MASK.charCodeAt(i % MASK.length));
  }
  return out;
}

const ANTIGRAVITY_USER_AGENT = 'antigravity/2.29.0 windows/amd64';
const ANTIGRAVITY_API_CLIENT = 'gl-node/20.18.0 gccl/2.29.0';

const CLIENT_ID = getEnv('GOOGLE_CLIENT_ID', unmask(MASKED_CLIENT_ID));
const CLIENT_SECRET = getEnv('GOOGLE_CLIENT_SECRET', unmask(MASKED_CLIENT_SECRET));
const REFRESH_TOKEN = getEnv('ACCOUNT_8_REFRESH_TOKEN');
const ACCOUNT_NAME = getEnv('ACCOUNT_8_NAME', 'geminifourargon@gmail.com');

console.log('========================================================================');
console.log(' Dedicated Cohort Verification & Benchmark (Account #8: ' + ACCOUNT_NAME + ')');
console.log(' Target Mode: Strictly LOW Thinking (2,048 Thinking Budget)');
console.log('========================================================================\n');

if (!REFRESH_TOKEN) {
  console.error('[X] Error: ACCOUNT_8_REFRESH_TOKEN not found in .env.local');
  process.exit(1);
}

// 2. Exchange refresh token for fresh access token
console.log('[1/3] Exchanging refresh token for Google OAuth access token...');
const tokenParams = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  refresh_token: REFRESH_TOKEN,
  grant_type: 'refresh_token'
});

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': ANTIGRAVITY_USER_AGENT,
    'X-Goog-Api-Client': ANTIGRAVITY_API_CLIENT
  },
  body: tokenParams.toString()
});

if (!tokenRes.ok) {
  const errText = await tokenRes.text();
  console.error('[X] Token refresh failed:', errText);
  process.exit(1);
}

const tokenData = await tokenRes.json();
const accessToken = tokenData.access_token;
console.log('[✓] Access token acquired successfully!\n');

// 3. Discover project ID
console.log('[2/3] Resolving CloudCode Project ID...');
let projectId = getEnv('ACCOUNT_8_PROJECT_ID') || '';
if (!projectId) {
  try {
    const metaRes = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssistMetadata', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': ANTIGRAVITY_USER_AGENT,
        'X-Goog-Api-Client': ANTIGRAVITY_API_CLIENT
      },
      body: JSON.stringify({ metadata: { ideType: 'VSCODE', ideVersion: '1.96.0' } })
    });
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      projectId = metaData.cloudaicompanionProject || metaData.projectId || '';
      console.log(`[✓] Auto-discovered project ID: ${projectId}`);
    }
  } catch (err) {
    console.warn('[!] Project discovery warning:', err.message);
  }
}
if (!projectId) projectId = 'aicode-consumers';
console.log(`[✓] Using Project ID: ${projectId}\n`);

// Ensure onboarded on daily-cloudcode-pa
try {
  await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:onboardUser', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': ANTIGRAVITY_USER_AGENT,
      'X-Goog-Api-Client': ANTIGRAVITY_API_CLIENT
    },
    body: JSON.stringify({
      tierId: 'free-tier',
      metadata: { ideType: 'ANTIGRAVITY', ideVersion: '2.29.0' }
    })
  });
} catch (_) {}

// 4. Test Models strictly with Low thinking (2048 budget)
const testModels = [
  {
    modelId: 'gemini-4-argon-low',
    wireModel: 'gemini-3.8-flash-low',
    thinkingBudget: 2048,
    name: 'Gemini 4 Argon (Low)',
  },
  {
    modelId: 'claude-opus-5-5-low',
    wireModel: 'claude-opus-5-5-low',
    thinkingBudget: 2048,
    name: 'Claude Opus 5.5 (Low)',
  },
  {
    modelId: 'claude-sonnet-5-5-low',
    wireModel: 'claude-sonnet-5-5-low',
    thinkingBudget: 2048,
    name: 'Claude Sonnet 5.5 (Low)',
  }
];

const UPSTREAM_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
  'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse'
];

async function testSingleModel(item) {
  console.log(`--- Testing ${item.modelId} (Wire: ${item.wireModel} | Thinking: ${item.thinkingBudget}) ---`);
  
  const payload = {
    project: projectId,
    requestId: 'agent/' + Date.now() + '/' + crypto.randomUUID().slice(0, 8),
    userAgent: 'antigravity',
    requestType: 'agent',
    model: item.wireModel,
    request: {
      sessionId: `-${Date.now()}`,
      contents: [
        {
          role: 'user',
          parts: [{ text: `Hello! Please introduce yourself briefly and explain how you are doing in 1-2 sentences.` }]
        }
      ],
      systemInstruction: {
        role: 'system',
        parts: [{ text: 'You are an advanced AI assistant.' }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048 + 512,
        topK: 40,
        topP: 1,
        thinkingConfig: {
          thinkingBudget: item.thinkingBudget,
          includeThoughts: true
        }
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
      ]
    }
  };

  const startTime = Date.now();
  let ttft = 0;
  let status = 0;
  let textOutput = '';
  let thoughtOutput = '';
  let errorMsg = '';
  let usedUrl = '';

  for (const url of UPSTREAM_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'User-Agent': ANTIGRAVITY_USER_AGENT,
          'X-Goog-Api-Client': ANTIGRAVITY_API_CLIENT
        },
        body: JSON.stringify(payload)
      });

      status = res.status;
      usedUrl = url.includes('daily') ? 'daily-cloudcode-pa' : 'cloudcode-pa';

      if (!res.ok) {
        const bodyErr = await res.text();
        errorMsg = `HTTP ${res.status}: ${bodyErr.slice(0, 300)}`;
        if (res.status === 503 || res.status === 404) {
          console.warn(`    [!] ${usedUrl} returned ${res.status}, trying fallback endpoint...`);
          continue;
        }
        break;
      }

      // Stream read
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!ttft) ttft = Date.now() - startTime;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const candidates = parsed.response?.candidates || parsed.candidates || [];
              for (const cand of candidates) {
                const parts = cand.content?.parts || [];
                for (const part of parts) {
                  if (part.thought) {
                    thoughtOutput += (typeof part.thought === 'string' ? part.thought : part.thought.text || '');
                  } else if (part.text) {
                    textOutput += part.text;
                  }
                }
              }
            } catch (_) {}
          }
        }
      }

      errorMsg = '';
      break;
    } catch (netErr) {
      errorMsg = netErr.message;
    }
  }

  const totalTime = Date.now() - startTime;
  const success = status === 200 && (textOutput.length > 0 || thoughtOutput.length > 0);

  return {
    modelId: item.modelId,
    name: item.name,
    wireModel: item.wireModel,
    thinkingBudget: item.thinkingBudget,
    status,
    success,
    ttft,
    totalTime,
    thoughtLength: thoughtOutput.length,
    textLength: textOutput.length,
    thoughtPreview: thoughtOutput.trim().slice(0, 100),
    textPreview: textOutput.trim().slice(0, 150),
    error: errorMsg,
    endpoint: usedUrl
  };
}

console.log('[3/3] Running tests on dedicated models strictly with LOW thinking...\n');
const results = [];

for (const model of testModels) {
  const result = await testSingleModel(model);
  results.push(result);
  console.log(`  Status: ${result.success ? '✓ 200 OK' : '✗ FAILED (' + result.status + ')'}`);
  console.log(`  TTFT: ${result.ttft}ms | Total Latency: ${result.totalTime}ms`);
  if (result.thoughtPreview) {
    console.log(`  Thinking Preview (${result.thoughtLength} chars): "${result.thoughtPreview.replace(/\n/g, ' ')}..."`);
  }
  if (result.textPreview) {
    console.log(`  Output Preview (${result.textLength} chars): "${result.textPreview.replace(/\n/g, ' ')}..."`);
  }
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }
  console.log('');
}

console.log('\n========================================================================');
console.log(' BENCHMARK SUMMARY TABLE (Strictly LOW Thinking / 2K Budget)');
console.log('========================================================================');
console.table(results.map(r => ({
  'Model ID': r.modelId,
  'Wire Model': r.wireModel,
  'Thinking': `${r.thinkingBudget} (Low)`,
  'Status': r.success ? '200 OK' : `ERR ${r.status}`,
  'TTFT (ms)': r.ttft,
  'Total (ms)': r.totalTime,
  'Thinking Chars': r.thoughtLength,
  'Text Chars': r.textLength
})));
