#!/usr/bin/env node
import http from 'node:http';
import readline from 'node:readline';
import { exec } from 'node:child_process';

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

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || unmask(MASKED_CLIENT_ID);
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || unmask(MASKED_CLIENT_SECRET);
const REDIRECT_URI = 'http://localhost:51121/oauth-callback';
const PORT = 51121;

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
].join(' ');

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\n======================================================');
console.log('  Google Antigravity OAuth Account Provisioner');
console.log('======================================================\n');
console.log('1. Open this URL in your browser with your 3rd Google account:\n');
console.log(authUrl.toString());
console.log('\n------------------------------------------------------');

// Try opening automatically in browser
const startCmd = process.platform === 'win32' ? `start "" "${authUrl.toString()}"` : process.platform === 'darwin' ? `open "${authUrl.toString()}"` : `xdg-open "${authUrl.toString()}"`;
exec(startCmd, () => {});

let resolved = false;

async function handleCode(authCode) {
  if (resolved) return;
  resolved = true;
  console.log('\n[✓] Authorization code captured! Exchanging for tokens...');

  try {
    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('\n[X] Failed to exchange code for tokens:', errText);
      process.exit(1);
    }

    const tokenData = await res.json();
    const refreshToken = tokenData.refresh_token;
    const accessToken = tokenData.access_token;

    if (!refreshToken) {
      console.error('\n[!] Warning: Google did not return a refresh token.');
      console.error('    Ensure prompt=consent was used and access_type=offline.');
      console.log('    Response was:', JSON.stringify(tokenData));
      process.exit(1);
    }

    // Try to get user email
    let userEmail = 'new-account@gmail.com';
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.email) userEmail = userData.email;
      }
    } catch (_) {}

    // Discover Project ID
    let projectId = '';
    try {
      console.log(`[i] Discovering CloudCode project for ${userEmail}...`);
      const metaRes = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssistMetadata', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/ide/2.1.1 darwin/arm64'
        },
        body: JSON.stringify({ metadata: { ideType: 'VSCODE', ideVersion: '1.96.0' } })
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        projectId = metaData.cloudaicompanionProject || metaData.projectId || '';
      }
    } catch (_) {}

    console.log('\n======================================================');
    console.log('  SUCCESS! 3RD ACCOUNT READY');
    console.log('======================================================\n');
    console.log('Add these environment variables to Vercel:\n');
    console.log(`ACCOUNT_3_NAME=${userEmail}`);
    console.log(`ACCOUNT_3_REFRESH_TOKEN=${refreshToken}`);
    if (projectId) {
      console.log(`ACCOUNT_3_PROJECT_ID=${projectId}`);
    } else {
      console.log('# ACCOUNT_3_PROJECT_ID: (Auto-discovered on first request)');
    }
    console.log('\n------------------------------------------------------');
    console.log('Next step: Go to Vercel -> Settings -> Environment Variables,');
    console.log('paste the 3 variables above, and click Redeploy!');
    console.log('------------------------------------------------------\n');
    process.exit(0);
  } catch (err) {
    console.error('\n[X] Error during authorization exchange:', err.message);
    process.exit(1);
  }
}

// Start local callback server
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  if (reqUrl.pathname === '/oauth-callback') {
    const code = reqUrl.searchParams.get('code');
    const error = reqUrl.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
      console.error('\n[X] OAuth Error from Google:', error);
      process.exit(1);
    }

    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication Successful!</h1><p>You can close this window and return to your terminal.</p>');
      server.close();
      handleCode(code);
    }
  }
});

server.on('error', (err) => {
  console.log(`\n[i] Note: Local callback server could not listen on port ${PORT} (${err.code}).`);
  console.log('    That is completely fine! You can copy the code manually below.\n');
});

server.listen(PORT, () => {
  console.log(`[i] Listening for browser callback on http://localhost:${PORT}/oauth-callback ...`);
});

// Setup manual readline input fallback
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nIf the browser doesn\'t redirect automatically, paste the redirect URL or code here:\n> ', (input) => {
  const trimmed = input.trim();
  if (!trimmed) return;
  let code = trimmed;
  if (trimmed.includes('code=')) {
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `http://localhost?${trimmed}`);
      code = parsed.searchParams.get('code') || trimmed;
    } catch (_) {}
  }
  rl.close();
  handleCode(code);
});
