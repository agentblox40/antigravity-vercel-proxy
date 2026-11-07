import fs from 'node:fs';
import path from 'node:path';

// Read .env.local
function getRefreshToken() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^OPENCODE_ACCOUNT_1_REFRESH_TOKEN=(.+)$/m);
    if (match) return match[1].trim();
  }
  return null;
}

function updateRotatedToken(newToken) {
  const envPaths = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve('c:/Users/yashv/antigravity-proxies/prototype-1-nextjs/.env.local'),
    path.resolve('c:/Users/yashv/antigravity-proxies/antigravity-openai-proxy/.env.local'),
  ];
  for (const p of new Set(envPaths)) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
      const updated = content.replace(/^OPENCODE_ACCOUNT_1_REFRESH_TOKEN=.*$/m, `OPENCODE_ACCOUNT_1_REFRESH_TOKEN=${newToken}`);
      fs.writeFileSync(p, updated, 'utf8');
    }
  }
}

const OPENCODE_OFFICIAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a bash command in the terminal.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read',
      description: 'Read contents of a file.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
];

const MODELS = [
  'big-pickle',
  'beam-free',
  'flint-40b-free',
  'mimo-v2.6-flash-free',
  'nemotron-3.5-super-vl-free',
  'nemotron-3.5-lightning-free',
  'deepseek-v4.1-flash-free',
  'glm-5.3-flash-free',
  'iceman-free',
  'inkling-2-small-free',
];

async function main() {
  const refreshToken = getRefreshToken();
  console.log(`[i] Refresh Token from .env.local: ${refreshToken ? refreshToken.slice(0, 15) + '...' : 'NOT FOUND'}`);
  if (!refreshToken) {
    console.error('[X] No refresh token found.');
    process.exit(1);
  }

  // 1. Exchange refresh token
  console.log('[i] Exchanging refresh token for access token...');
  const tokenRes = await fetch('https://opencode.ai/console/auth/device/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'opencode/2.0.26 ai-sdk/provider-utils/4.0.21 runtime/bun/1.4.2',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'opencode-cli',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error(`[X] Token exchange failed (${tokenRes.status}): ${errText}`);
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const orgId = tokenData.org_id || 'org_01M37HRZAHC8XB2CCEG95JZG3X';
  console.log(`[✓] Access token acquired: ${accessToken.slice(0, 15)}... (org: ${orgId})`);

  if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
    console.log(`[i] Refresh token rotated to: ${tokenData.refresh_token.slice(0, 15)}... (persisting to .env.local)`);
    updateRotatedToken(tokenData.refresh_token);
  }

  console.log(`\n======================================================`);
  console.log(`  Benchmarking 10 OpenCode Free Models`);
  console.log(`======================================================\n`);

  const results = [];

  for (const model of MODELS) {
    process.stdout.write(`Testing ${model.padEnd(28)} ... `);
    const start = Date.now();
    let ttft = null;
    let text = '';
    let reasoning = '';
    let status = 0;
    let errMsg = '';

    const sessionId = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'opencode/2.0.26 ai-sdk/provider-utils/4.0.21 runtime/bun/1.4.2',
          'x-opencode-client': 'cli',
          'x-opencode-project': orgId,
          'x-opencode-session': sessionId,
          'x-opencode-request': requestId,
        },
        body: JSON.stringify({
          model: model,
          stream: true,
          messages: [
            {
              role: 'system',
              content: 'You are in direct chat mode. Do not use tools. State your model name in one short sentence.',
            },
            {
              role: 'user',
              content: 'What is your model name?',
            },
          ],
          tools: OPENCODE_OFFICIAL_TOOLS,
        }),
      });

      status = res.status;
      if (!res.ok) {
        errMsg = (await res.text()).slice(0, 120);
        console.log(`[X ${status}] ${errMsg}`);
        results.push({ model, status, ttft: null, total: Date.now() - start, error: errMsg });
        continue;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: rDone } = await reader.read();
        done = rDone;
        if (value) {
          if (ttft === null) {
            ttft = Date.now() - start;
          }
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) text += delta.content;
                if (delta?.reasoning_content) reasoning += delta.reasoning_content;
              } catch (_) {}
            }
          }
        }
      }

      const total = Date.now() - start;
      const cleanSnippet = text.trim().replace(/[\r\n]+/g, ' ').slice(0, 50) || (reasoning ? `[Reasoning: ${reasoning.slice(0, 35)}...]` : '(empty response)');
      console.log(`[✓ 200 OK] TTFT: ${ttft}ms | Total: ${total}ms | "${cleanSnippet}"`);
      results.push({ model, status: 200, ttft, total, text: cleanSnippet });
    } catch (err) {
      console.log(`[X Network Error] ${err.message}`);
      results.push({ model, status: 0, ttft: null, total: Date.now() - start, error: err.message });
    }
  }

  console.log(`\n======================================================`);
  console.log(`  SUMMARY BENCHMARK`);
  console.log(`======================================================`);
  console.table(results);
}

main().catch(err => console.error(err));
