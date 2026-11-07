#!/usr/bin/env node
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const CLIENT_ID = 'opencode-cli';
export const DEVICE_CODE_ENDPOINT = 'https://opencode.ai/console/auth/device/code';
export const DEVICE_TOKEN_ENDPOINT = 'https://opencode.ai/console/auth/device/token';
export const USER_INFO_ENDPOINT = 'https://opencode.ai/console/api/user';
export const ORGS_ENDPOINT = 'https://opencode.ai/console/api/orgs';

export function normalizeVerificationUrl(uri, base = 'https://opencode.ai') {
  if (!uri) return '';
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  return `${base}${uri.startsWith('/') ? '' : '/'}${uri}`;
}

export function findNextOpenCodeSlot(envContent = '') {
  let maxSlot = 0;
  const regex = /OPENCODE_ACCOUNT_(\d+)_/g;
  let match;
  while ((match = regex.exec(envContent)) !== null) {
    const slot = parseInt(match[1], 10);
    if (!isNaN(slot) && slot > maxSlot) maxSlot = slot;
  }
  return maxSlot + 1;
}

export async function initiateDeviceFlow(fetchFn = fetch) {
  const res = await fetchFn(DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'opencode/2.0.26',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      supports_org_scope: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to initiate device code grant: ${res.status} ${errText}`);
  }

  const data = await res.json();
  let completeUrl = data.verification_uri_complete || '';
  if (!completeUrl && data.verification_uri && data.user_code) {
    completeUrl = `${data.verification_uri}?user_code=${encodeURIComponent(data.user_code)}&client_id=${CLIENT_ID}`;
  }
  completeUrl = normalizeVerificationUrl(completeUrl || data.verification_uri);

  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: normalizeVerificationUrl(data.verification_uri),
    verification_uri_complete: completeUrl,
    interval: typeof data.interval === 'number' && data.interval > 0 ? data.interval : 5,
    expires_in: typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 600,
  };
}

export async function pollDeviceToken(deviceCode, initialInterval = 5, expiresIn = 600, fetchFn = fetch, onTick = () => {}) {
  let interval = initialInterval;
  const deadline = Date.now() + expiresIn * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    onTick({ interval });

    try {
      const res = await fetchFn(DEVICE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'opencode/2.0.26',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      if (res.ok) {
        return await res.json();
      }

      const errJson = await res.json().catch(() => ({}));
      const err = errJson.error || '';

      if (err === 'authorization_pending') {
        continue;
      } else if (err === 'slow_down') {
        interval += 5;
        continue;
      } else if (err === 'expired_token') {
        throw new Error('Device authorization expired. Please re-run the provisioner.');
      } else {
        throw new Error(`Device token authorization error: ${err} - ${errJson.error_description || res.statusText}`);
      }
    } catch (pollErr) {
      if (pollErr.message && (pollErr.message.includes('expired') || pollErr.message.includes('authorization error'))) {
        throw pollErr;
      }
    }
  }

  throw new Error('Timed out waiting for device authorization.');
}

export async function fetchUserAndOrg(accessToken, fetchFn = fetch) {
  let email = '';
  let orgId = '';

  try {
    const userRes = await fetchFn(USER_INFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'opencode/2.0.26',
      },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      email = userData.email || userData.user?.email || userData.name || userData.username || '';
    }
  } catch (_) {}

  try {
    const orgsRes = await fetchFn(ORGS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'opencode/2.0.26',
      },
    });
    if (orgsRes.ok) {
      const orgsData = await orgsRes.json();
      if (Array.isArray(orgsData) && orgsData.length > 0) {
        orgId = orgsData[0].id || orgsData[0].orgID || '';
      } else if (orgsData && typeof orgsData === 'object') {
        orgId = orgsData.orgID || orgsData.defaultOrgId || orgsData.orgs?.[0]?.id || '';
      }
    }
  } catch (_) {}

  return { email, orgId };
}

export function updateEnvFile(envPath, targetIndex, email, refreshToken, orgId) {
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n');
  }

  const slotStr = String(targetIndex).trim();
  const prefix = `OPENCODE_ACCOUNT_${slotStr}_`;
  const commentLine = `# OpenCode Account ${slotStr}`;

  const lines = envContent
    .split('\n')
    .filter((l) => !l.startsWith(prefix) && !l.includes(commentLine));

  lines.push('');
  lines.push(`# OpenCode Account ${slotStr} (${email})`);
  lines.push(`OPENCODE_ACCOUNT_${slotStr}_NAME=${email}`);
  lines.push(`OPENCODE_ACCOUNT_${slotStr}_REFRESH_TOKEN=${refreshToken}`);
  if (orgId) {
    lines.push(`OPENCODE_ACCOUNT_${slotStr}_ORG_ID=${orgId}`);
  }

  const updated = lines.join('\n').trim() + '\n';
  fs.writeFileSync(envPath, updated, 'utf8');
}

// CLI runner
async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  let currentEnv = '';
  if (fs.existsSync(envPath)) {
    try {
      currentEnv = fs.readFileSync(envPath, 'utf8');
    } catch (_) {}
  }

  const argSlot = process.argv[2];
  const targetAccountIndex = argSlot ? String(parseInt(argSlot, 10)) : String(findNextOpenCodeSlot(currentEnv));

  console.log('\n======================================================');
  console.log(`  OpenCode OAuth Account Provisioner (Account #${targetAccountIndex})`);
  console.log('======================================================\n');

  try {
    console.log('[i] Initiating OAuth 2.0 Device Code grant with OpenCode...');
    const flow = await initiateDeviceFlow();

    console.log(`\n1. Verification URL: ${flow.verification_uri_complete}`);
    console.log(`2. User Code:        ${flow.user_code}`);
    console.log(`3. Expiration:       ${flow.expires_in}s\n`);
    console.log('------------------------------------------------------');
    console.log('Opening browser for authentication...');

    const startCmd =
      process.platform === 'win32'
        ? `start "" "${flow.verification_uri_complete}"`
        : process.platform === 'darwin'
        ? `open "${flow.verification_uri_complete}"`
        : `xdg-open "${flow.verification_uri_complete}"`;

    exec(startCmd, () => {});

    process.stdout.write('[i] Waiting for browser confirmation (polling)');
    const tokenData = await pollDeviceToken(flow.device_code, flow.interval, flow.expires_in, fetch, () => {
      process.stdout.write('.');
    });
    console.log('\n[✓] Device authorization approved!');

    const { access_token, refresh_token } = tokenData;
    if (!refresh_token) {
      console.error('\n[X] Upstream did not return a refresh token.');
      process.exit(1);
    }

    console.log('[i] Querying user profile and default organization...');
    const { email: fetchedEmail, orgId } = await fetchUserAndOrg(access_token);
    const email = fetchedEmail || `opencode-account-${targetAccountIndex}@opencode.ai`;

    console.log('\n======================================================');
    console.log(`  SUCCESS! OPENCODE ACCOUNT #${targetAccountIndex} READY`);
    console.log('======================================================\n');
    console.log(`OPENCODE_ACCOUNT_${targetAccountIndex}_NAME=${email}`);
    console.log(`OPENCODE_ACCOUNT_${targetAccountIndex}_REFRESH_TOKEN=${refresh_token}`);
    if (orgId) {
      console.log(`OPENCODE_ACCOUNT_${targetAccountIndex}_ORG_ID=${orgId}`);
    }

    try {
      updateEnvFile(envPath, targetAccountIndex, email, refresh_token, orgId);
      console.log(`\n[✓] Automatically written to .env.local!`);
    } catch (writeErr) {
      console.warn('[!] Failed to update .env.local automatically:', writeErr.message);
    }

    console.log('\n------------------------------------------------------');
    console.log('Next step: Add these environment variables to Vercel');
    console.log(`Settings -> Environment Variables and redeploy.\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n[X] Provisioning failed:', err.message);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('auth-opencode-account.mjs') || process.argv[1].includes('auth-opencode-account'));
if (isDirectRun && !process.env.TEST_HARNESS) {
  main();
}
