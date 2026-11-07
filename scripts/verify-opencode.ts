import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

import {
  OPENCODE_MODELS,
  resolveOpenCodeModel,
  getOpenCodeAccounts,
  resetOpenCodeAccountCache,
  getOpenCodeAccessToken,
  pickOpenCodeAccount,
  executeOpenCodeCompletion,
  generateOpenCodeSessionId,
  generateOpenCodeRequestId,
  OPENCODE_OFFICIAL_TOOLS,
} from '../lib/opencode';

import {
  CLIENT_ID,
  normalizeVerificationUrl,
  findNextOpenCodeSlot,
  updateEnvFile,
  pollDeviceToken,
  fetchUserAndOrg,
} from './auth-opencode-account.mjs';

import { getAntigravityLiveModels } from '../lib/antigravity';
import { SUPPORTED_MODELS } from '../lib/models';

async function runTestSuite() {
  console.log('======================================================');
  console.log('🧪 OPENCODE MULTI-ACCOUNT & MODEL RECOVERY TEST SUITE');
  console.log('======================================================\n');

  // -----------------------------------------------------------
  // TEST 1: 10 ACTIVE FREE CHAT MODELS & 10 FAST VARIANTS IN CATALOG
  // -----------------------------------------------------------
  console.log('Test 1: Model Catalog Registration & Context Windows');
  const expectedModels = [
    { id: 'big-pickle', fast: false, ctx: '200K Context', window: 204800 },
    { id: 'big-pickle-fast', fast: true, ctx: '200K Context', window: 204800 },
    { id: 'beam-free', fast: false, ctx: '1M Context', window: 1048576 },
    { id: 'beam-free-fast', fast: true, ctx: '1M Context', window: 1048576 },
    { id: 'flint-40b-free', fast: false, ctx: '262K Context', window: 262144 },
    { id: 'flint-40b-free-fast', fast: true, ctx: '262K Context', window: 262144 },
    { id: 'mimo-v2.6-flash-free', fast: false, ctx: '200K Context', window: 204800 },
    { id: 'mimo-v2.6-flash-free-fast', fast: true, ctx: '200K Context', window: 204800 },
    { id: 'nemotron-3.5-super-vl-free', fast: false, ctx: '1M Context', window: 1048576 },
    { id: 'nemotron-3.5-super-vl-free-fast', fast: true, ctx: '1M Context', window: 1048576 },
    { id: 'nemotron-3.5-lightning-free', fast: false, ctx: '262K Context', window: 262144 },
    { id: 'nemotron-3.5-lightning-free-fast', fast: true, ctx: '262K Context', window: 262144 },
    { id: 'deepseek-v4.1-flash-free', fast: false, ctx: '200K Context', window: 204800 },
    { id: 'deepseek-v4.1-flash-free-fast', fast: true, ctx: '200K Context', window: 204800 },
    { id: 'glm-5.3-flash-free', fast: false, ctx: '200K Context', window: 204800 },
    { id: 'glm-5.3-flash-free-fast', fast: true, ctx: '200K Context', window: 204800 },
    { id: 'iceman-free', fast: false, ctx: '262K Context', window: 262144 },
    { id: 'iceman-free-fast', fast: true, ctx: '262K Context', window: 262144 },
    { id: 'inkling-2-small-free', fast: false, ctx: '1M Context', window: 1048576 },
    { id: 'inkling-2-small-free-fast', fast: true, ctx: '1M Context', window: 1048576 },
  ];

  assert.strictEqual(OPENCODE_MODELS.length, 20, 'Catalog must contain exactly 20 entries (10 base + 10 fast)');

  for (const exp of expectedModels) {
    const found = OPENCODE_MODELS.find(m => m.id === exp.id);
    assert.ok(found, `Model ${exp.id} must exist in OPENCODE_MODELS`);
    assert.strictEqual(found.isFast, exp.fast, `${exp.id} isFast must be ${exp.fast}`);
    assert.strictEqual(found.context, exp.ctx, `${exp.id} context label must be ${exp.ctx}`);
    assert.strictEqual(found.contextWindow, exp.window, `${exp.id} contextWindow must be ${exp.window}`);
  }
  console.log('  ✓ All 20 models registered with correct context windows and thinking flags.\n');

  // -----------------------------------------------------------
  // TEST 2: MODEL RESOLUTION & DEPRECATED ALIAS MAPPING
  // -----------------------------------------------------------
  console.log('Test 2: Model Resolution & Deprecated Alias Mapping');
  const resolutionCases = [
    // Standard 10 active models
    { input: 'big-pickle', expectedWire: 'big-pickle', expectedFast: false, expectedId: 'big-pickle' },
    { input: 'beam-free', expectedWire: 'beam-free', expectedFast: false, expectedId: 'beam-free' },
    { input: 'flint-40b-free', expectedWire: 'flint-40b-free', expectedFast: false, expectedId: 'flint-40b-free' },
    { input: 'mimo-v2.6-flash-free', expectedWire: 'mimo-v2.6-flash-free', expectedFast: false, expectedId: 'mimo-v2.6-flash-free' },
    { input: 'nemotron-3.5-super-vl-free', expectedWire: 'nemotron-3.5-super-vl-free', expectedFast: false, expectedId: 'nemotron-3.5-super-vl-free' },
    { input: 'nemotron-3.5-lightning-free', expectedWire: 'nemotron-3.5-lightning-free', expectedFast: false, expectedId: 'nemotron-3.5-lightning-free' },
    { input: 'deepseek-v4.1-flash-free', expectedWire: 'deepseek-v4.1-flash-free', expectedFast: false, expectedId: 'deepseek-v4.1-flash-free' },
    { input: 'glm-5.3-flash-free', expectedWire: 'glm-5.3-flash-free', expectedFast: false, expectedId: 'glm-5.3-flash-free' },
    { input: 'iceman-free', expectedWire: 'iceman-free', expectedFast: false, expectedId: 'iceman-free' },
    { input: 'inkling-2-small-free', expectedWire: 'inkling-2-small-free', expectedFast: false, expectedId: 'inkling-2-small-free' },

    // Fast variants
    { input: 'big-pickle-fast', expectedWire: 'big-pickle', expectedFast: true, expectedId: 'big-pickle-fast' },
    { input: 'beam-free-fast', expectedWire: 'beam-free', expectedFast: true, expectedId: 'beam-free-fast' },
    { input: 'flint-40b-free:fast', expectedWire: 'flint-40b-free', expectedFast: true, expectedId: 'flint-40b-free-fast' },
    { input: 'mimo-v2.6-flash-free-off', expectedWire: 'mimo-v2.6-flash-free', expectedFast: true, expectedId: 'mimo-v2.6-flash-free-fast' },
    { input: 'nemotron-3.5-super-vl-free-zero', expectedWire: 'nemotron-3.5-super-vl-free', expectedFast: true, expectedId: 'nemotron-3.5-super-vl-free-fast' },

    // Deprecated alias: mimo-v2.5-free -> mimo-v2.6-flash-free
    { input: 'mimo-v2.5-free', expectedWire: 'mimo-v2.6-flash-free', expectedFast: false, expectedId: 'mimo-v2.6-flash-free' },
    { input: 'mimo-v2.5-free-fast', expectedWire: 'mimo-v2.6-flash-free', expectedFast: true, expectedId: 'mimo-v2.6-flash-free-fast' },
    { input: 'mimo-v2.5', expectedWire: 'mimo-v2.6-flash-free', expectedFast: false, expectedId: 'mimo-v2.6-flash-free' },

    // Deprecated alias: space-bunny-free / snow-bunny -> beam-free
    { input: 'space-bunny-free', expectedWire: 'beam-free', expectedFast: false, expectedId: 'beam-free' },
    { input: 'snow-bunny', expectedWire: 'beam-free', expectedFast: false, expectedId: 'beam-free' },
    { input: 'space-bunny-free-fast', expectedWire: 'beam-free', expectedFast: true, expectedId: 'beam-free-fast' },

    // Deprecated alias: cat-jam-free -> flint-40b-free
    { input: 'cat-jam-free', expectedWire: 'flint-40b-free', expectedFast: false, expectedId: 'flint-40b-free' },
    { input: 'cat-jam-free-fast', expectedWire: 'flint-40b-free', expectedFast: true, expectedId: 'flint-40b-free-fast' },

    // Deprecated alias: longcat-2.5-preview-free -> deepseek-v4.1-flash-free
    { input: 'longcat-2.5-preview-free', expectedWire: 'deepseek-v4.1-flash-free', expectedFast: false, expectedId: 'deepseek-v4.1-flash-free' },
    { input: 'longcat-2.5-preview-free-fast', expectedWire: 'deepseek-v4.1-flash-free', expectedFast: true, expectedId: 'deepseek-v4.1-flash-free-fast' },

    // Deprecated alias: step-5-preview-free -> glm-5.3-flash-free
    { input: 'step-5-preview-free', expectedWire: 'glm-5.3-flash-free', expectedFast: false, expectedId: 'glm-5.3-flash-free' },
    { input: 'step-5-preview-free-fast', expectedWire: 'glm-5.3-flash-free', expectedFast: true, expectedId: 'glm-5.3-flash-free-fast' },

    // Deprecated alias: nemotron-3-ultra-free -> nemotron-3.5-lightning-free
    { input: 'nemotron-3-ultra-free', expectedWire: 'nemotron-3.5-lightning-free', expectedFast: false, expectedId: 'nemotron-3.5-lightning-free' },
    { input: 'nemotron-3-ultra-free-fast', expectedWire: 'nemotron-3.5-lightning-free', expectedFast: true, expectedId: 'nemotron-3.5-lightning-free-fast' },

    // Deprecated alias: ling-3.0-flash-fin-free / ling-3.1-flash-free -> inkling-2-small-free
    { input: 'ling-3.0-flash-fin-free', expectedWire: 'inkling-2-small-free', expectedFast: false, expectedId: 'inkling-2-small-free' },
    { input: 'ling-3.1-flash-free', expectedWire: 'inkling-2-small-free', expectedFast: false, expectedId: 'inkling-2-small-free' },
    { input: 'ling-3.0-flash-fin-free-fast', expectedWire: 'inkling-2-small-free', expectedFast: true, expectedId: 'inkling-2-small-free-fast' },

    // Provider prefix stripping (opencode/..., models/...)
    { input: 'opencode/big-pickle', expectedWire: 'big-pickle', expectedFast: false, expectedId: 'big-pickle' },
    { input: 'models/beam-free-fast', expectedWire: 'beam-free', expectedFast: true, expectedId: 'beam-free-fast' },
  ];

  for (const tc of resolutionCases) {
    const res = resolveOpenCodeModel(tc.input);
    assert.ok(res, `Model '${tc.input}' must resolve`);
    assert.strictEqual(res.wireModel, tc.expectedWire, `Input '${tc.input}' expected wireModel '${tc.expectedWire}', got '${res.wireModel}'`);
    assert.strictEqual(res.isFast, tc.expectedFast, `Input '${tc.input}' expected isFast ${tc.expectedFast}, got ${res.isFast}`);
    assert.strictEqual(res.canonicalId, tc.expectedId, `Input '${tc.input}' expected canonicalId '${tc.expectedId}', got '${res.canonicalId}'`);
  }
  console.log('  ✓ All 32 resolution and deprecated alias test cases passed.\n');

  // -----------------------------------------------------------
  // TEST 3: OAUTH DEVICE FLOW CONTRACT HELPERS
  // -----------------------------------------------------------
  console.log('Test 3: Device Flow Contract & URL Normalization');
  assert.strictEqual(CLIENT_ID, 'opencode-cli');

  // Relative vs absolute URL normalization
  assert.strictEqual(normalizeVerificationUrl('/console/device'), 'https://opencode.ai/console/device');
  assert.strictEqual(
    normalizeVerificationUrl('/console/device?user_code=ABCD-1234&client_id=opencode-cli'),
    'https://opencode.ai/console/device?user_code=ABCD-1234&client_id=opencode-cli'
  );
  assert.strictEqual(normalizeVerificationUrl('https://custom.ai/verify'), 'https://custom.ai/verify');

  // Next slot detection
  const envSample = `
# Existing Google Accounts
ACCOUNT_1_NAME=user1@gmail.com
ACCOUNT_1_REFRESH_TOKEN=token1

# Existing OpenCode Accounts
OPENCODE_ACCOUNT_1_NAME=user1@opencode.ai
OPENCODE_ACCOUNT_1_REFRESH_TOKEN=opencode_token1
OPENCODE_ACCOUNT_2_NAME=user2@opencode.ai
OPENCODE_ACCOUNT_2_REFRESH_TOKEN=opencode_token2
`;
  const nextSlot = findNextOpenCodeSlot(envSample);
  assert.strictEqual(nextSlot, 3, 'findNextOpenCodeSlot should find next index = 3');

  // Device token poll error handling simulation
  let pollAttempts = 0;
  const mockFetchPendingThenSuccess = async (url: string, opts: any) => {
    pollAttempts++;
    if (pollAttempts === 1) {
      return {
        ok: false,
        json: async () => ({ error: 'authorization_pending' }),
      } as any;
    }
    if (pollAttempts === 2) {
      return {
        ok: false,
        json: async () => ({ error: 'slow_down' }),
      } as any;
    }
    return {
      ok: true,
      json: async () => ({
        access_token: 'mock_access_token_123',
        refresh_token: 'mock_refresh_token_456',
        token_type: 'bearer',
        expires_in: 3600,
      }),
    } as any;
  };

  const pollResult = await pollDeviceToken('test_code', 0.01, 10, mockFetchPendingThenSuccess);
  assert.strictEqual(pollResult.access_token, 'mock_access_token_123');
  assert.strictEqual(pollResult.refresh_token, 'mock_refresh_token_456');

  // User and org fetching
  const mockFetchUserOrg = async (url: string) => {
    if (url.includes('/api/user')) {
      return {
        ok: true,
        json: async () => ({ email: 'verified@opencode.ai', name: 'OpenCode Dev' }),
      } as any;
    }
    if (url.includes('/api/orgs')) {
      return {
        ok: true,
        json: async () => [{ id: 'org_enterprise_999', name: 'Dev Org' }],
      } as any;
    }
    throw new Error('Unknown URL');
  };

  const userOrg = await fetchUserAndOrg('token', mockFetchUserOrg);
  assert.strictEqual(userOrg.email, 'verified@opencode.ai');
  assert.strictEqual(userOrg.orgId, 'org_enterprise_999');
  console.log('  ✓ Device flow contract, retry backoff, and user extraction asserted.\n');

  // -----------------------------------------------------------
  // TEST 4: DYNAMIC MULTI-ACCOUNT POOL LOADER & FALLBACKS
  // -----------------------------------------------------------
  console.log('Test 4: Account Pool Loader & Fallbacks');

  // Backup original env
  const origEnv = { ...process.env };

  try {
    // Clear all OPENCODE envs
    for (let i = 1; i <= 20; i++) {
      delete process.env[`OPENCODE_ACCOUNT_${i}_NAME`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_REFRESH_TOKEN`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_ORG_ID`];
    }
    delete process.env.OPENCODE_REFRESH_TOKEN;
    delete process.env.OPENCODE_ACCOUNT_NAME;
    resetOpenCodeAccountCache();

    // With 0 accounts
    const emptyAccounts = getOpenCodeAccounts(true);
    assert.strictEqual(emptyAccounts.length, 0, 'Should be 0 accounts when env is empty');

    // With multiple indexed accounts
    process.env.OPENCODE_ACCOUNT_1_NAME = 'alice@opencode.ai';
    process.env.OPENCODE_ACCOUNT_1_REFRESH_TOKEN = 'rt_alice_123';
    process.env.OPENCODE_ACCOUNT_1_ORG_ID = 'org_alice';

    process.env.OPENCODE_ACCOUNT_2_NAME = 'bob@opencode.ai';
    process.env.OPENCODE_ACCOUNT_2_REFRESH_TOKEN = 'rt_bob_456';

    process.env.OPENCODE_ACCOUNT_3_NAME = 'charlie@opencode.ai';
    process.env.OPENCODE_ACCOUNT_3_REFRESH_TOKEN = 'rt_charlie_789';

    resetOpenCodeAccountCache();
    const loaded = getOpenCodeAccounts(true);
    assert.strictEqual(loaded.length, 3, 'Should load 3 accounts');
    assert.strictEqual(loaded[0].id, 'opencode-account-1');
    assert.strictEqual(loaded[0].name, 'alice@opencode.ai');
    assert.strictEqual(loaded[0].refreshToken, 'rt_alice_123');
    assert.strictEqual(loaded[0].orgId, 'org_alice');
    assert.strictEqual(loaded[1].id, 'opencode-account-2');
    assert.strictEqual(loaded[2].id, 'opencode-account-3');

    // Round robin selection
    const firstPick = pickOpenCodeAccount();
    const secondPick = pickOpenCodeAccount();
    const thirdPick = pickOpenCodeAccount();
    const fourthPick = pickOpenCodeAccount();

    assert.ok(firstPick && secondPick && thirdPick && fourthPick);
    assert.notStrictEqual(firstPick.id, secondPick.id, 'Picks must cycle round-robin');
    assert.strictEqual(fourthPick.id, firstPick.id, 'Fourth pick must cycle back to first');

    // Fallback to OPENCODE_REFRESH_TOKEN if no indexed accounts
    for (let i = 1; i <= 20; i++) {
      delete process.env[`OPENCODE_ACCOUNT_${i}_NAME`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_REFRESH_TOKEN`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_ORG_ID`];
    }
    process.env.OPENCODE_REFRESH_TOKEN = 'rt_single_fallback_token';
    process.env.OPENCODE_ACCOUNT_NAME = 'fallback@opencode.ai';
    resetOpenCodeAccountCache();

    const fallbackAccounts = getOpenCodeAccounts(true);
    assert.strictEqual(fallbackAccounts.length, 1, 'Should fallback to 1 single account');
    assert.strictEqual(fallbackAccounts[0].refreshToken, 'rt_single_fallback_token');
    assert.strictEqual(fallbackAccounts[0].name, 'fallback@opencode.ai');

  } finally {
    process.env = origEnv;
    resetOpenCodeAccountCache();
  }
  console.log('  ✓ Multi-account pool loader and single fallback asserted.\n');

  // -----------------------------------------------------------
  // TEST 5: TOKEN REFRESH & UPSTREAM REFRESH TOKEN ROTATION
  // -----------------------------------------------------------
  console.log('Test 5: Token Refresh, Caching & Upstream Token Rotation');

  const testAccount = {
    id: 'opencode-account-1',
    name: 'test@opencode.ai',
    refreshToken: 'initial_refresh_token_001',
    accessToken: null,
    expiresAt: 0,
    cooldownUntil: 0,
    failCount: 0,
    successCount: 0,
  };

  let tokenPostCalls = 0;
  let receivedRefreshToken = '';

  const mockTokenRefreshFetch = async (url: string, opts: any) => {
    tokenPostCalls++;
    const body = JSON.parse(opts.body);
    receivedRefreshToken = body.refresh_token;

    return {
      ok: true,
      json: async () => ({
        access_token: 'new_access_token_xyz',
        refresh_token: 'rotated_refresh_token_002', // Upstream rotated refresh token!
        expires_in: 3600,
      }),
    } as any;
  };

  const token1 = await getOpenCodeAccessToken(testAccount, mockTokenRefreshFetch);
  assert.strictEqual(token1, 'new_access_token_xyz');
  assert.strictEqual(tokenPostCalls, 1);
  assert.strictEqual(receivedRefreshToken, 'initial_refresh_token_001');

  // Assert rotation was captured:
  assert.strictEqual(testAccount.refreshToken, 'rotated_refresh_token_002', 'Account refresh token must be rotated');

  // Assert caching works (second call within expiresAt returns cached without calling fetch)
  const token2 = await getOpenCodeAccessToken(testAccount, mockTokenRefreshFetch);
  assert.strictEqual(token2, 'new_access_token_xyz');
  assert.strictEqual(tokenPostCalls, 1, 'Second token request must use cache and not call upstream');

  console.log('  ✓ Token refresh, caching, and upstream token rotation asserted.\n');

  // -----------------------------------------------------------
  // TEST 6: EXECUTION CONTRACT, 401 SETUP ERROR & 429 FAILOVER
  // -----------------------------------------------------------
  console.log('Test 6: Execution Contract, 401 Setup Error & 429 Failover');

  // When 0 accounts configured:
  const backupEnv2 = { ...process.env };
  try {
    for (let i = 1; i <= 20; i++) {
      delete process.env[`OPENCODE_ACCOUNT_${i}_NAME`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_REFRESH_TOKEN`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_ORG_ID`];
    }
    delete process.env.OPENCODE_REFRESH_TOKEN;
    resetOpenCodeAccountCache();

    const noAccRes = await executeOpenCodeCompletion({
      body: { model: 'beam-free', messages: [{ role: 'user', content: 'test' }] },
      modelId: 'beam-free',
      resolvedModel: { wireModel: 'beam-free', isFast: false, canonicalId: 'beam-free' },
    });

    assert.strictEqual(noAccRes.status, 401, 'Must return 401 when 0 accounts configured');
    const noAccJson = await noAccRes.json();
    assert.strictEqual(noAccJson.error.type, 'authentication_error');
    assert.ok(noAccJson.error.message.includes('No OpenCode accounts configured'));

    // When all accounts in pool are in cooldown:
    process.env.OPENCODE_ACCOUNT_1_REFRESH_TOKEN = 'mock_rt_1';
    process.env.OPENCODE_ACCOUNT_1_NAME = 'user1@opencode.ai';
    resetOpenCodeAccountCache();

    const accounts = getOpenCodeAccounts(true);
    accounts[0].cooldownUntil = Date.now() + 15000; // 15s cooldown

    const cooldownRes = await executeOpenCodeCompletion({
      body: { model: 'beam-free', messages: [{ role: 'user', content: 'test' }] },
      modelId: 'beam-free',
      resolvedModel: { wireModel: 'beam-free', isFast: false, canonicalId: 'beam-free' },
    });

    assert.strictEqual(cooldownRes.status, 429, 'Must return 429 when all accounts in cooldown');
    const cooldownJson = await cooldownRes.json();
    assert.strictEqual(cooldownJson.error.type, 'upstream_rate_limit');
    assert.ok(cooldownJson.error.ready_at.includes('IST'), 'Must contain Indian Standard Time countdown');
    assert.ok(cooldownJson.error.refresh_in_seconds > 0);
  } finally {
    process.env = backupEnv2;
    resetOpenCodeAccountCache();
  }
  console.log('  ✓ 401 authentication prompt and 429 IST countdown cooldown asserted.\n');

  // -----------------------------------------------------------
  // TEST 7: STATUS & MODELS INTEGRATION
  // -----------------------------------------------------------
  console.log('Test 7: Status Route & Models Parity');
  const liveModels = await getAntigravityLiveModels();
  assert.ok(liveModels.length > 20, 'Models catalog must include Google + OpenCode models');

  for (const m of OPENCODE_MODELS) {
    const foundInLive = liveModels.find(lm => lm.id === m.id);
    assert.ok(foundInLive, `OpenCode model '${m.id}' must be in live models catalog`);
    assert.ok(foundInLive.tier.includes('OpenCode'), `OpenCode model '${m.id}' tier must include 'OpenCode'`);
  }

  assert.ok(SUPPORTED_MODELS.length >= liveModels.length, 'SUPPORTED_MODELS must export unified catalog');
  console.log('  ✓ Models registered in getAntigravityLiveModels() and SUPPORTED_MODELS.\n');

  // -----------------------------------------------------------
  // TEST 8: MOCKED END-TO-END CHAT COMPLETION EXECUTION SUITE
  // -----------------------------------------------------------
  console.log('Test 8: Mocked End-to-End Chat Completion Execution Suite');

  function createMockSseResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      }
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const backupEnv3 = { ...process.env };
  try {
    for (let i = 1; i <= 20; i++) {
      delete process.env[`OPENCODE_ACCOUNT_${i}_NAME`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_REFRESH_TOKEN`];
      delete process.env[`OPENCODE_ACCOUNT_${i}_ORG_ID`];
    }
    delete process.env.OPENCODE_REFRESH_TOKEN;
    resetOpenCodeAccountCache();

    process.env.OPENCODE_ACCOUNT_1_NAME = 'acc1@opencode.ai';
    process.env.OPENCODE_ACCOUNT_1_REFRESH_TOKEN = 'rt_test_1';
    resetOpenCodeAccountCache();

    // 8.1 Streaming SSE Execution with reasoning tokens
    let capturedPayload: any = null;
    let finishContent = '';
    let finishThinking = '';

    const sseChunks = [
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"reasoning_content":"Thinking deeply..."}}]}\n\n',
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Hello! "}}]}\n\n',
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"How can I help you?"}}]}\n\n',
      'data: {"id":"chatcmpl-1","choices":[{"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const mockFetchStreaming = async (url: string, opts: any) => {
      if (url.includes('/auth/device/token')) {
        return new Response(JSON.stringify({ access_token: 'acc1_access_token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/chat/completions')) {
        capturedPayload = JSON.parse(opts.body);
        return createMockSseResponse(sseChunks);
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const streamRes = await executeOpenCodeCompletion({
      body: {
        model: 'beam-free',
        stream: true,
        messages: [{ role: 'user', content: 'Hi there' }],
      },
      modelId: 'beam-free',
      resolvedModel: resolveOpenCodeModel('beam-free')!,
      onFinish: (c, t) => {
        finishContent = c;
        finishThinking = t;
      },
      fetchFn: mockFetchStreaming as any,
    });

    assert.strictEqual(streamRes.status, 200, 'Streaming response must be 200 OK');
    assert.ok(streamRes.headers.get('content-type')?.includes('text/event-stream'));

    const reader = streamRes.body?.getReader();
    assert.ok(reader);
    const decoder = new TextDecoder();
    let streamText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamText += decoder.decode(value);
    }

    assert.ok(streamText.includes('data: [DONE]'), 'Must stream data: [DONE]');
    assert.strictEqual(finishContent, 'Hello! How can I help you?');
    assert.strictEqual(finishThinking, 'Thinking deeply...');
    assert.ok(capturedPayload.tools?.length > 0, 'Must inject official tools when downstream has no tools');
    assert.ok(
      capturedPayload.messages[0].content.includes('[Direct Chat Constraint]'),
      'Must inject Direct Chat Constraint into system prompt'
    );
    console.log('  ✓ 8.1 Streaming SSE execution with reasoning tokens passed.');

    // 8.2 Non-streaming JSON completion buffering
    const nonStreamRes = await executeOpenCodeCompletion({
      body: {
        model: 'flint-40b-free',
        stream: false,
        messages: [{ role: 'user', content: 'Say hello' }],
      },
      modelId: 'flint-40b-free',
      resolvedModel: resolveOpenCodeModel('flint-40b-free')!,
      fetchFn: mockFetchStreaming as any,
    });

    assert.strictEqual(nonStreamRes.status, 200, 'Non-streaming response must be 200 OK');
    const nonStreamJson = await nonStreamRes.json();
    assert.strictEqual(nonStreamJson.object, 'chat.completion');
    assert.strictEqual(nonStreamJson.choices[0].message.content, 'Hello! How can I help you?');
    assert.strictEqual(nonStreamJson.choices[0].message.reasoning_content, 'Thinking deeply...');
    assert.strictEqual(nonStreamJson.choices[0].finish_reason, 'stop');
    assert.ok(nonStreamJson.usage.total_tokens > 0);
    console.log('  ✓ 8.2 Non-streaming buffered JSON completion passed.');

    // 8.3 Single-account 401 token refresh recovery
    resetOpenCodeAccountCache();
    process.env.OPENCODE_ACCOUNT_1_REFRESH_TOKEN = 'rt_refresh_test';
    const acc1 = getOpenCodeAccounts(true)[0];
    acc1.accessToken = 'expired_mock_token_123';
    acc1.expiresAt = Date.now() + 100000;

    let callCount = 0;
    let tokenRefreshed = false;

    const mockFetch401Recovery = async (url: string, opts: any) => {
      if (url.includes('/auth/device/token')) {
        tokenRefreshed = true;
        return new Response(JSON.stringify({ access_token: 'brand_new_token_456', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/chat/completions')) {
        callCount++;
        const auth = opts.headers['Authorization'];
        if (auth === 'Bearer expired_mock_token_123') {
          return new Response(JSON.stringify({ error: 'token_expired' }), { status: 401 });
        }
        if (auth === 'Bearer brand_new_token_456') {
          return createMockSseResponse(sseChunks);
        }
      }
      throw new Error(`Unexpected call to ${url}`);
    };

    const recoveryRes = await executeOpenCodeCompletion({
      body: {
        model: 'beam-free',
        stream: true,
        messages: [{ role: 'user', content: 'test' }],
      },
      modelId: 'beam-free',
      resolvedModel: resolveOpenCodeModel('beam-free')!,
      fetchFn: mockFetch401Recovery as any,
    });

    assert.strictEqual(recoveryRes.status, 200, '401 recovery must succeed with 200 OK');
    assert.strictEqual(tokenRefreshed, true, 'Token refresh must have fired');
    assert.strictEqual(callCount, 2, 'Upstream must have been retried on the same account');
    assert.strictEqual(acc1.accessToken, 'brand_new_token_456', 'Account must store refreshed token');
    console.log('  ✓ 8.3 Single-account 401 token refresh recovery passed.');

    // 8.4 Multi-account 429 instant failover
    resetOpenCodeAccountCache();
    process.env.OPENCODE_ACCOUNT_1_REFRESH_TOKEN = 'rt_acc1';
    process.env.OPENCODE_ACCOUNT_2_REFRESH_TOKEN = 'rt_acc2';
    const accList = getOpenCodeAccounts(true);

    const mockFetch429Failover = async (url: string, opts: any) => {
      if (url.includes('/auth/device/token')) {
        const body = JSON.parse(opts.body);
        const token = body.refresh_token === 'rt_acc1' ? 'token_acc1' : 'token_acc2';
        return new Response(JSON.stringify({ access_token: token, expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/chat/completions')) {
        const auth = opts.headers['Authorization'];
        if (auth === 'Bearer token_acc1') {
          return new Response(JSON.stringify({ error: 'rate_limited' }), {
            status: 429,
            headers: { 'retry-after': '25' },
          });
        }
        if (auth === 'Bearer token_acc2') {
          return createMockSseResponse(sseChunks);
        }
      }
      throw new Error(`Unexpected call to ${url}`);
    };

    const failoverRes = await executeOpenCodeCompletion({
      body: {
        model: 'beam-free',
        stream: true,
        messages: [{ role: 'user', content: 'test failover' }],
      },
      modelId: 'beam-free',
      resolvedModel: resolveOpenCodeModel('beam-free')!,
      fetchFn: mockFetch429Failover as any,
    });

    assert.strictEqual(failoverRes.status, 200, 'Failover to account 2 must succeed with 200 OK');
    assert.ok(accList[0].cooldownUntil > Date.now() + 20000, 'Account 1 must have 25s cooldown');
    console.log('  ✓ 8.4 Multi-account 429 instant failover passed.');

    // 8.5 Fast / No-think parameter enforcement
    let fastCapturedPayload: any = null;
    const mockFetchFast = async (url: string, opts: any) => {
      if (url.includes('/auth/device/token')) {
        return new Response(JSON.stringify({ access_token: 'fast_token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/chat/completions')) {
        fastCapturedPayload = JSON.parse(opts.body);
        return createMockSseResponse(sseChunks);
      }
      throw new Error(`Unexpected call to ${url}`);
    };

    await executeOpenCodeCompletion({
      body: {
        model: 'big-pickle-fast',
        stream: true,
        thinking_budget: 16000,
        messages: [{ role: 'user', content: 'fast test' }],
      },
      modelId: 'big-pickle-fast',
      resolvedModel: resolveOpenCodeModel('big-pickle-fast')!,
      fetchFn: mockFetchFast as any,
    });

    assert.strictEqual(fastCapturedPayload.reasoning_effort, 'none');
    assert.deepStrictEqual(fastCapturedPayload.thinking, { type: 'disabled' });
    assert.strictEqual(fastCapturedPayload.max_thinking_tokens, undefined);
    console.log('  ✓ 8.5 Fast/No-think parameter enforcement passed.');

    // 8.6 Tool-calls finish_reason sanitization for direct chat
    const sseChunksWithToolCalls = [
      'data: {"id":"chatcmpl-2","choices":[{"delta":{"content":"Here is your answer."},"finish_reason":"tool_calls"}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const mockFetchSanitization = async (url: string, opts: any) => {
      if (url.includes('/auth/device/token')) {
        return new Response(JSON.stringify({ access_token: 'sanit_token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/chat/completions')) {
        return createMockSseResponse(sseChunksWithToolCalls);
      }
      throw new Error(`Unexpected call to ${url}`);
    };

    const sanitRes = await executeOpenCodeCompletion({
      body: {
        model: 'beam-free',
        stream: true,
        messages: [{ role: 'user', content: 'test tool sanitization' }],
      },
      modelId: 'beam-free',
      resolvedModel: resolveOpenCodeModel('beam-free')!,
      fetchFn: mockFetchSanitization as any,
    });

    const sanitReader = sanitRes.body?.getReader();
    assert.ok(sanitReader);
    let sanitText = '';
    while (true) {
      const { done, value } = await sanitReader.read();
      if (done) break;
      sanitText += decoder.decode(value);
    }

    assert.ok(!sanitText.includes('"finish_reason":"tool_calls"'), 'tool_calls finish_reason must be converted');
    assert.ok(sanitText.includes('"finish_reason":"stop"'), 'Must emit finish_reason: stop');
    console.log('  ✓ 8.6 Tool-calls finish_reason sanitization passed.\n');

  } finally {
    process.env = backupEnv3;
    resetOpenCodeAccountCache();
  }

  console.log('======================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (8/8 TEST SUITES OK)');
  console.log('======================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
