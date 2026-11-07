import fs from 'node:fs';

const PROXY_1 = 'https://antigravity-vercel-proxy-three.vercel.app';
const PROXY_2 = 'https://antigravity-openai-proxy.vercel.app';
const API_KEY = process.env.PROXY_API_KEY || 'KARS-2010915';

async function testProxy(name, baseUrl) {
  console.log('========================================================================');
  console.log(` Testing ${name}: ${baseUrl}`);
  console.log(' Target Model: gemini-3.8-flash');
  console.log('========================================================================\n');

  for (let i = 1; i <= 8; i++) {
    const start = Date.now();
    try {
      const res = await fetch(baseUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + API_KEY
        },
        body: JSON.stringify({
          model: 'gemini-3.8-flash',
          messages: [{ role: 'user', content: 'Say hello in two words.' }],
          max_tokens: 30
        })
      });
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      const content = parsed?.choices?.[0]?.message?.content || text.slice(0, 150);
      console.log(`[Req #${i}] HTTP ${res.status} (${Date.now() - start}ms) => ${content.trim().replace(/\n/g, ' ')}`);
    } catch (err) {
      console.log(`[Req #${i}] Network Error: ${err.message}`);
    }
  }

  // Check /api/status after
  try {
    const sRes = await fetch(baseUrl + '/api/status', {
      headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    const sData = await sRes.json();
    console.log(`\n--- Live Accounts Status on ${name} ---`);
    for (const acc of (sData.accounts || [])) {
      const cd = acc.cooldownRemainingSec || 0;
      const status = acc.status || (acc.isCoolingDown ? 'Cooldown' : 'Ready');
      console.log(`  ${acc.name.padEnd(35)} | Status: ${status.padEnd(10)} | Cooldown: ${cd}s | FailCount: ${acc.failCount || 0}`);
    }
  } catch (err) {
    console.error('Status fetch error:', err.message);
  }
  console.log('\n');
}

async function testDirectAccounts() {
  console.log('========================================================================');
  console.log(' Testing All Known Local Accounts Directly on Google Upstream Wire');
  console.log(' Target Wire Model: gemini-3.8-flash-tiered');
  console.log('========================================================================\n');

  const envContent = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  const client_id = envContent.match(/^GOOGLE_CLIENT_ID=(.*)$/m)?.[1]?.trim() || '';
  const client_secret = envContent.match(/^GOOGLE_CLIENT_SECRET=(.*)$/m)?.[1]?.trim() || '';

  const accounts = [];
  for (let i = 1; i <= 20; i++) {
    const token = envContent.match(new RegExp(`^ACCOUNT_${i}_REFRESH_TOKEN=(.*)$`, 'm'))?.[1]?.trim();
    if (!token) continue;
    const name = envContent.match(new RegExp(`^ACCOUNT_${i}_NAME=(.*)$`, 'm'))?.[1]?.trim() || `Account ${i}`;
    const projectId = envContent.match(new RegExp(`^ACCOUNT_${i}_PROJECT_ID=(.*)$`, 'm'))?.[1]?.trim() || 'aicode-consumers';
    accounts.push({ id: `ACCOUNT_${i}`, name, token, projectId });
  }

  for (const acc of accounts) {
    process.stdout.write(`Testing ${acc.name.padEnd(35)} (Slot: ${acc.id}) ... `);
    const start = Date.now();
    try {
      const tRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id,
          client_secret,
          refresh_token: acc.token,
          grant_type: 'refresh_token'
        }).toString()
      });

      if (!tRes.ok) {
        const errText = await tRes.text();
        console.log(`[X OAuth Failed ${tRes.status}] ${errText.slice(0, 100)}`);
        continue;
      }

      const tData = await tRes.json();
      const accessToken = tData.access_token;

      // Query quota on daily-cloudcode-pa
      const qRes = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/2.29.0 windows/amd64',
          'X-Goog-Api-Client': 'gl-node/20.18.0 gccl/2.29.0'
        }
      });
      let quotaInfo = '';
      if (qRes.ok) {
        const qData = await qRes.json();
        const geminiBucket = (qData.buckets || []).find(b => b.modelId?.includes('gemini') || b.modelFamily?.includes('gemini'));
        if (geminiBucket) {
          quotaInfo = `Quota: ${Math.round((geminiBucket.remainingFraction || 0) * 100)}%`;
        }
      }

      // Test wire generate content on gemini-3.8-flash-tiered
      const genRes = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'User-Agent': 'antigravity/2.29.0 windows/amd64',
          'X-Goog-Api-Client': 'gl-node/20.18.0 gccl/2.29.0'
        },
        body: JSON.stringify({
          project: acc.projectId,
          requestId: 'agent/' + Date.now(),
          userAgent: 'antigravity',
          requestType: 'agent',
          model: 'gemini-3.8-flash-tiered',
          request: {
            sessionId: '-' + Date.now(),
            contents: [{ role: 'user', parts: [{ text: 'Say hi in two words.' }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 128 }
          }
        })
      });

      const latency = Date.now() - start;
      if (genRes.ok) {
        console.log(`[✓ ACTIVE 200 OK] Latency: ${latency}ms | ${quotaInfo || 'OK'}`);
      } else {
        const bodyErr = await genRes.text();
        console.log(`[X FLAGGED/ERROR ${genRes.status}] Latency: ${latency}ms | ${bodyErr.slice(0, 120)}`);
      }
    } catch (err) {
      console.log(`[X EXCEPTION] ${err.message}`);
    }
  }
}

await testDirectAccounts();
await testProxy('Proxy 1: antigravity-vercel-proxy-three', PROXY_1);
await testProxy('Proxy 2: antigravity-openai-proxy', PROXY_2);
