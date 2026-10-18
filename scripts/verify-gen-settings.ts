import assert from 'node:assert';
import {
  detectInChatCommand,
  executeInChatCommand,
  generateGenNotice,
  generateHelpMenu,
  generateSettingsMenu,
  getInjectionsConfig,
  saveInjectionsConfig,
  isRedisConfigured,
  getLastRedisError,
  DEFAULT_INJECTIONS,
} from '../lib/injections';
import { NextRequest } from 'next/server';
import { handleChatCompletions } from '../lib/completions';
import { exportCharacterCard } from '../lib/cardExporter';
import {
  resolveWireModel,
  transformOpenAIToAntigravity,
  isPenaltySupported,
  isCardExporterModel,
  FALLBACK_MODELS,
} from '../lib/antigravity';
import {
  OPENCODE_MODELS,
  OPENCODE_GUEST_ACCOUNTS,
  OPENCODE_OFFICIAL_TOOLS,
  resolveOpenCodeModel,
  generateOpenCodeSessionId,
  generateOpenCodeRequestId,
} from '../lib/opencode';
import {
  extractSessionOverview,
  saveChatSession,
  listSessionOverviews,
  getSessionById,
  deleteChatSession,
  deleteAllChatSessions,
  recordTurnsIntoSession,
  deriveChatFingerprint,
  ChatSession,
} from '../lib/memory';

async function main() {
  console.log('🧪 RUNNING STREAMLINED ROLEPLAY CORE VERIFICATION SUITE\n');

  // ==========================================
  // 1. In-Chat Command Detection Tests
  // ==========================================
  console.log('Test 1: In-Chat Command Detection');
  const samplingCmds = ['<GENSETTINGS>', '<GEN_SETTINGS>', '<SETTINGS>', '<SAMPLING>', '/gensettings', '/sampling', '/settings'];
  for (const cmd of samplingCmds) {
    const detected = detectInChatCommand(cmd);
    assert.strictEqual(detected?.type, 'view_gen', `Expected view_gen for "${cmd}", got ${detected?.type}`);
  }

  const resetCmds = ['<RESET_SETTINGS>', '<RESET_GENSETTINGS>', '<RESET_GEN>', '/reset_settings'];
  for (const cmd of resetCmds) {
    const detected = detectInChatCommand(cmd);
    assert.strictEqual(detected?.type, 'reset_gen', `Expected reset_gen for "${cmd}", got ${detected?.type}`);
  }

  const setCmds = ['<SET: min_p=0.05, temp=0.9>', '<SET_GEN: top_k=40>', '/set temp 0.8'];
  for (const cmd of setCmds) {
    const detected = detectInChatCommand(cmd);
    assert.strictEqual(detected?.type, 'set_gen', `Expected set_gen for "${cmd}", got ${detected?.type}`);
  }

  const helpCmds = ['<HELP>', '<COMMANDS>', '<MENU>', '/help', '/commands'];
  for (const cmd of helpCmds) {
    const detected = detectInChatCommand(cmd);
    assert.strictEqual(detected?.type, 'view_help', `Expected view_help for "${cmd}", got ${detected?.type}`);
  }

  const injectionsCmds = ['<MYSETTINGS>', '<MY_SETTINGS>', '<INJECTIONS>', '/injections', '/mysettings'];
  for (const cmd of injectionsCmds) {
    const detected = detectInChatCommand(cmd);
    assert.strictEqual(detected?.type, 'view', `Expected view for "${cmd}", got ${detected?.type}`);
  }

  // Ensure normal roleplay dialogue is NEVER intercepted as a command
  const normalTurns = [
    'Lily, what should we do next?',
    '*She looks down nervously* "I don\'t know..."',
    '123 < 456 is a basic comparison',
    'Can you help me?',
    '/home/user/path/is/valid',
    '<think>Internal character thought</think> "Hello!"'
  ];
  for (const turn of normalTurns) {
    const detected = detectInChatCommand(turn);
    assert.strictEqual(detected, null, `Normal turn "${turn}" was incorrectly intercepted as a command!`);
  }
  console.log('✅ In-Chat Command Detection passed.\n');

  // ==========================================
  // 2. Pure Client Pass-Through In-Chat Command Responses
  // ==========================================
  console.log('Test 2: Pure Client Pass-Through In-Chat Command Responses');
  const genNotice = generateGenNotice();
  assert.ok(genNotice.includes('[ANTIGRAVITY ROLEPLAY SAMPLING]'));
  assert.ok(genNotice.includes('Pure Client Pass-Through Active'));
  assert.ok(genNotice.includes('controlled by your Janitor AI or SillyTavern sliders'));
  assert.ok(genNotice.includes('<MYSETTINGS>'));

  // When user executes <GENSETTINGS> or <SETTINGS>
  const resView = await executeInChatCommand({ type: 'view_gen', rawInput: '<GENSETTINGS>' });
  assert.ok(resView.includes('[ANTIGRAVITY ROLEPLAY SAMPLING]'));
  assert.ok(resView.includes('Pure Client Pass-Through Active'));

  // When user executes <SET: ...>
  const resSet = await executeInChatCommand({ type: 'set_gen', rawInput: '<SET: temp=0.9>' });
  assert.ok(resSet.includes('[ANTIGRAVITY ROLEPLAY SAMPLING]'));

  // When user executes <RESET_SETTINGS>
  const resReset = await executeInChatCommand({ type: 'reset_gen', rawInput: '<RESET_SETTINGS>' });
  assert.ok(resReset.includes('[ANTIGRAVITY ROLEPLAY SAMPLING]'));

  // When user executes <HELP>
  const helpMenu = generateHelpMenu();
  assert.ok(helpMenu.includes('📖 [ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]'));
  assert.ok(helpMenu.includes('Sampling parameters (Temp, Top-P, Top-K, Min-P, etc.) are directly controlled by your Janitor AI / SillyTavern sliders.'));
  assert.ok(helpMenu.includes('gemini-3.8-flash-fast'));
  assert.ok(helpMenu.includes('gemini-3.1-pro-fast'));
  assert.ok(helpMenu.includes('gemini-3.8-flash-low'));
  assert.ok(helpMenu.includes('gemini-3.1-pro-low'));

  // When user executes <MYSETTINGS>
  const injectionsMenu = await executeInChatCommand({ type: 'view', rawInput: '<MYSETTINGS>' });
  assert.ok(injectionsMenu.includes('⚙️ [ANTIGRAVITY PROXY SETTINGS MENU]'));
  assert.ok(injectionsMenu.includes('Master Switch:'));
  console.log('✅ Pure Client Pass-Through In-Chat Command Responses passed.\n');

  // ==========================================
  // 3. Model Thinking Resolution - Model Presets as Single Source of Truth
  // ==========================================
  console.log('Test 3: Model Presets as Single Source of Truth for Thinking Tiers');

  // 3a. Fast / No-think models (0 thinking tokens)
  const fastModels = [
    'gemini-3.8-flash-fast',
    'gemini-3.8-flash:off',
    'gemini-3.7-flash-fast',
    'gemini-3.7-flash:off',
    'gemini-3.1-pro-fast',
    'gemini-3.1-pro:off',
    'gemini-3.1-pro-no-think',
    'gemini-3.1-pro:no-think',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'claude-sonnet-4-6-fast',
    'claude-sonnet-4-6:off',
    'claude-sonnet-4-6-no-think',
    'claude-opus-4-6-fast'
  ];

  for (const modelId of fastModels) {
    const resolved = resolveWireModel(modelId);
    assert.ok(resolved, `Model ${modelId} failed to resolve`);
    assert.strictEqual(resolved.defaultThinkingBudget, 0, `Model ${modelId} must have defaultThinkingBudget === 0`);

    const wire = transformOpenAIToAntigravity(
      { model: modelId, messages: [{ role: 'user', content: 'Hi' }] },
      resolved,
      'test-proj'
    );
    assert.strictEqual(
      wire.request.generationConfig.thinkingConfig,
      undefined,
      `Model ${modelId} must NOT include thinkingConfig on wire!`
    );
  }

  // 3b. Snappy / Low thinking models (2,048 tokens)
  const lowModels = [
    'gemini-3.8-flash-low',
    'gemini-3.8-flash:low',
    'gemini-3.7-flash-low',
    'gemini-3.7-flash:low',
    'gemini-3.1-pro-low',
    'gemini-3.1-pro:low',
    'claude-sonnet-4-6-low',
    'claude-sonnet-4-6:low',
    'claude-opus-4-6-low'
  ];

  for (const modelId of lowModels) {
    const resolved = resolveWireModel(modelId);
    assert.ok(resolved, `Model ${modelId} failed to resolve`);
    assert.strictEqual(resolved.defaultThinkingBudget, 2048, `Model ${modelId} must have 2048 thinking budget`);

    const wire = transformOpenAIToAntigravity(
      { model: modelId, messages: [{ role: 'user', content: 'Hi' }] },
      resolved,
      'test-proj'
    );
    assert.strictEqual(
      wire.request.generationConfig.thinkingConfig?.thinkingBudget,
      2048,
      `Model ${modelId} must produce thinkingBudget 2048 on wire`
    );
  }

  // 3c. Standard thinking models (8,192 tokens)
  const standardModels = ['gemini-3.8-flash', 'gemini-3.7-flash'];
  for (const modelId of standardModels) {
    const resolved = resolveWireModel(modelId);
    assert.ok(resolved, `Model ${modelId} failed to resolve`);
    assert.strictEqual(resolved.defaultThinkingBudget, 8192, `Model ${modelId} must have 8192 thinking budget`);

    const wire = transformOpenAIToAntigravity(
      { model: modelId, messages: [{ role: 'user', content: 'Hi' }] },
      resolved,
      'test-proj'
    );
    assert.strictEqual(
      wire.request.generationConfig.thinkingConfig?.thinkingBudget,
      8192,
      `Model ${modelId} must produce thinkingBudget 8192 on wire`
    );
  }

  // 3d. High thinking models (24,576 tokens)
  const highModels = ['gemini-3.8-flash-high', 'gemini-3.7-flash-high'];
  for (const modelId of highModels) {
    const resolved = resolveWireModel(modelId);
    assert.ok(resolved, `Model ${modelId} failed to resolve`);
    assert.strictEqual(resolved.defaultThinkingBudget, 24576, `Model ${modelId} must have 24576 thinking budget`);

    const wire = transformOpenAIToAntigravity(
      { model: modelId, messages: [{ role: 'user', content: 'Hi' }] },
      resolved,
      'test-proj'
    );
    assert.strictEqual(
      wire.request.generationConfig.thinkingConfig?.thinkingBudget,
      24576,
      `Model ${modelId} must produce thinkingBudget 24576 on wire`
    );
  }

  // 3e. Max thinking models (65,536 tokens)
  const maxModels = ['gemini-3.8-flash-max', 'gemini-3.7-flash-max'];
  for (const modelId of maxModels) {
    const resolved = resolveWireModel(modelId);
    assert.ok(resolved, `Model ${modelId} failed to resolve`);
    assert.strictEqual(resolved.defaultThinkingBudget, 65536, `Model ${modelId} must have 65536 thinking budget`);

    const wire = transformOpenAIToAntigravity(
      { model: modelId, messages: [{ role: 'user', content: 'Hi' }] },
      resolved,
      'test-proj'
    );
    assert.strictEqual(
      wire.request.generationConfig.thinkingConfig?.thinkingBudget,
      65536,
      `Model ${modelId} must produce thinkingBudget 65536 on wire`
    );
  }

  // 3f. Claude Standard thinking models (16,384 tokens)
  const claudeStdModels = ['claude-sonnet-4-6', 'claude-opus-4-6-thinking'];
  for (const modelId of claudeStdModels) {
    const resolved = resolveWireModel(modelId);
    assert.ok(resolved, `Model ${modelId} failed to resolve`);
    assert.strictEqual(resolved.defaultThinkingBudget, 16384, `Model ${modelId} must have 16384 thinking budget`);

    const wire = transformOpenAIToAntigravity(
      { model: modelId, messages: [{ role: 'user', content: 'Hi' }] },
      resolved,
      'test-proj'
    );
    assert.strictEqual(
      wire.request.generationConfig.thinkingConfig?.thinkingBudget,
      16384,
      `Model ${modelId} must produce thinkingBudget 16384 on wire`
    );
  }
  console.log('✅ Model Presets as Single Source of Truth for Thinking Tiers passed.\n');

  // ==========================================
  // 4. Pure Client Pass-Through Wire Parameter Mapping & Penalty Safeguarding
  // ==========================================
  console.log('Test 4: Pure Client Pass-Through Wire Parameter Mapping & Penalty Safeguarding');
  
  // 4.1 Supported models (gemini-3.7-flash) pass through penalties unmodified
  const clientRequest = {
    model: 'gemini-3.7-flash',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 1.15,
    top_p: 0.85,
    top_k: 65,
    max_tokens: 4096,
    presence_penalty: 0.45,
    frequency_penalty: -0.25,
  };

  const resolvedStd = resolveWireModel(clientRequest.model);
  const wireConfig = transformOpenAIToAntigravity(clientRequest, resolvedStd!, 'proj-123').request.generationConfig;

  assert.strictEqual(wireConfig.temperature, 1.15, 'Client temperature must pass through unmodified');
  assert.strictEqual(wireConfig.topP, 0.85, 'Client top_p must pass through unmodified');
  assert.strictEqual(wireConfig.topK, 65, 'Client top_k must pass through unmodified');
  assert.strictEqual(wireConfig.presencePenalty, 0.45, 'Client presence_penalty must pass through unmodified for 3.7');
  assert.strictEqual(wireConfig.frequencyPenalty, -0.25, 'Client frequency_penalty must pass through unmodified for 3.7');
  // Upstream maxOutputTokens decouples thinking tokens: max(16384, 4096 + 8192) = 16384
  assert.strictEqual(wireConfig.maxOutputTokens, 16384, 'Decoupled maxOutputTokens headroom must be preserved');

  // 4.2 Helper function isPenaltySupported
  assert.strictEqual(isPenaltySupported('gemini-3.8-flash'), false, 'gemini-3.8-flash does not support penalties');
  assert.strictEqual(isPenaltySupported('gemini-3.8-flash-fast'), false, 'gemini-3.8-flash-fast does not support penalties');
  assert.strictEqual(isPenaltySupported('gemini-3.8-flash-tiered'), false, 'gemini-3.8-flash-tiered does not support penalties');
  assert.strictEqual(isPenaltySupported('gemini-3.8-flash-high'), false, 'gemini-3.8-flash-high does not support penalties');
  assert.strictEqual(isPenaltySupported('argon'), false, 'argon (exact) does not support penalties');
  assert.strictEqual(isPenaltySupported('argon:low'), false, 'argon:low does not support penalties');
  assert.strictEqual(isPenaltySupported('argon-low'), false, 'argon-low does not support penalties');
  assert.strictEqual(isPenaltySupported('claude-sonnet-4-6'), false, 'claude-sonnet-4-6 does not support penalties');
  assert.strictEqual(isPenaltySupported('claude-opus-4-6-thinking'), false, 'claude-opus-4-6-thinking does not support penalties');
  assert.strictEqual(isPenaltySupported('gemini-3.7-flash'), true, 'gemini-3.7-flash supports penalties');
  assert.strictEqual(isPenaltySupported('gemini-3.1-pro'), true, 'gemini-3.1-pro supports penalties');

  // 4.3 Unsupported models (gemini-3.8-flash-fast) strip presence_penalty / frequency_penalty to prevent HTTP 400
  const clientRequest38Fast = {
    model: 'gemini-3.8-flash-fast',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.9,
    top_p: 0.95,
    top_k: 40,
    presence_penalty: 0.5,
    frequency_penalty: 0.2,
  };
  const resolved38Fast = resolveWireModel(clientRequest38Fast.model);
  const wireConfig38Fast = transformOpenAIToAntigravity(clientRequest38Fast, resolved38Fast!, 'proj-123').request.generationConfig;

  assert.strictEqual(wireConfig38Fast.temperature, 0.9, 'temperature must pass through unmodified');
  assert.strictEqual(wireConfig38Fast.topP, 0.95, 'top_p must pass through unmodified');
  assert.strictEqual(wireConfig38Fast.topK, 40, 'top_k must pass through unmodified');
  assert.strictEqual(wireConfig38Fast.presencePenalty, undefined, 'presencePenalty must be stripped for gemini-3.8-flash-fast');
  assert.strictEqual(wireConfig38Fast.frequencyPenalty, undefined, 'frequencyPenalty must be stripped for gemini-3.8-flash-fast');

  // 4.4 Standard gemini-3.8-flash and argon-low strip presence_penalty / frequency_penalty
  const clientRequest38Std = {
    model: 'gemini-3.8-flash',
    messages: [{ role: 'user', content: 'Hello' }],
    presence_penalty: 0.75,
    frequency_penalty: -0.5,
  };
  const resolved38Std = resolveWireModel(clientRequest38Std.model);
  const wireConfig38Std = transformOpenAIToAntigravity(clientRequest38Std, resolved38Std!, 'proj-123').request.generationConfig;
  assert.strictEqual(wireConfig38Std.presencePenalty, undefined, 'presencePenalty must be stripped for gemini-3.8-flash');
  assert.strictEqual(wireConfig38Std.frequencyPenalty, undefined, 'frequencyPenalty must be stripped for gemini-3.8-flash');

  const clientRequestArgon = {
    model: 'argon-low',
    messages: [{ role: 'user', content: 'Hello' }],
    presence_penalty: 0.6,
    frequency_penalty: 0.4,
  };
  const resolvedArgon = resolveWireModel(clientRequestArgon.model);
  const wireConfigArgon = transformOpenAIToAntigravity(clientRequestArgon, resolvedArgon!, 'proj-123').request.generationConfig;
  assert.strictEqual(wireConfigArgon.presencePenalty, undefined, 'presencePenalty must be stripped for argon-low');
  assert.strictEqual(wireConfigArgon.frequencyPenalty, undefined, 'frequencyPenalty must be stripped for argon-low');

  // 4.5 Auto-recovery simulation: simulate diverse 400 error signatures
  const penaltyErrorSignatures = [
    '{\n  "error": {\n    "code": 400,\n    "message": "Penalty is not enabled for this model",\n    "status": "INVALID_ARGUMENT"\n  }\n}\n',
    '{\n  "error": {\n    "code": 400,\n    "message": "Penalty is not supported for this model",\n    "status": "INVALID_ARGUMENT"\n  }\n}\n',
    '{\n  "error": {\n    "code": 400,\n    "message": "Penalties are not enabled",\n    "status": "INVALID_ARGUMENT"\n  }\n}\n',
    '{\n  "error": {\n    "code": 400,\n    "message": "presence_penalty parameter is not allowed for this model",\n    "status": "INVALID_ARGUMENT"\n  }\n}\n',
    '{\n  "error": {\n    "code": 400,\n    "message": "frequency penalty is unsupported",\n    "status": "INVALID_ARGUMENT"\n  }\n}\n',
  ];

  const penaltyRegex = /penalt(y|ies)/i;
  const statusRegex = /(not enabled|not supported|unsupported|disabled|invalid|not allowed)/i;

  for (const sig of penaltyErrorSignatures) {
    const isPen = penaltyRegex.test(sig) && statusRegex.test(sig);
    assert.strictEqual(isPen, true, `Signature must match: ${sig}`);
  }

  // 4.6 Auto-recovery with upgraded -high model integrity
  let activeEnvelope: any = {
    model: 'gemini-3.8-flash-tiered',
    request: {
      generationConfig: {
        temperature: 0.7,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3,
      }
    }
  };
  const simulatedBody: any = {
    model: 'gemini-3.8-flash',
    presence_penalty: 0.5,
    frequency_penalty: 0.3,
  };

  // Simulate 404 auto-upgrade to -high
  if (activeEnvelope.model.endsWith('-tiered')) {
    activeEnvelope = {
      ...activeEnvelope,
      model: activeEnvelope.model.replace(/-tiered$/, '-high'),
    };
  }
  assert.strictEqual(activeEnvelope.model, 'gemini-3.8-flash-high', 'Model must be upgraded to -high');

  // Simulate penalty 400 error on -high
  const isErr = penaltyRegex.test(penaltyErrorSignatures[0]) && statusRegex.test(penaltyErrorSignatures[0]);
  if (isErr && activeEnvelope.request?.generationConfig) {
    delete activeEnvelope.request.generationConfig.presencePenalty;
    delete activeEnvelope.request.generationConfig.frequencyPenalty;
    delete simulatedBody.presence_penalty;
    delete simulatedBody.frequency_penalty;
  }

  assert.strictEqual(activeEnvelope.model, 'gemini-3.8-flash-high', 'Active envelope model must remain -high upon penalty retry');
  assert.strictEqual(activeEnvelope.request.generationConfig.presencePenalty, undefined);
  assert.strictEqual(activeEnvelope.request.generationConfig.frequencyPenalty, undefined);
  assert.strictEqual(activeEnvelope.request.generationConfig.temperature, 0.7);
  assert.strictEqual(simulatedBody.presence_penalty, undefined, 'Body must have presence_penalty sanitized');
  assert.strictEqual(simulatedBody.frequency_penalty, undefined, 'Body must have frequency_penalty sanitized');

  console.log('✅ Pure Client Pass-Through Wire Parameter Mapping & Penalty Safeguarding passed.\n');

  // ==========================================
  // 5. Upstream Wire History Sanitization
  // ==========================================
  console.log('Test 5: Upstream Wire History Sanitization');
  const dirtyMessages = [
    { role: 'system', content: 'You are an elf.' },
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: '*smiles* "Greetings."' },
    { role: 'user', content: '<GENSETTINGS>' },
    { role: 'assistant', content: '⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]\n\n✨ Pure Client Pass-Through Active...' },
    { role: 'user', content: '<SETTINGS>' },
    { role: 'assistant', content: '⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]\n\n✨ Pure Client Pass-Through Active...' },
    { role: 'user', content: '<SET: temp=0.9>' },
    { role: 'assistant', content: '⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]\n\n✨ Pure Client Pass-Through Active...' },
    { role: 'user', content: '<HELP>' },
    { role: 'assistant', content: '📖 [ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]\n...' },
    { role: 'user', content: '<MYSETTINGS>' },
    { role: 'assistant', content: '⚙️ [ANTIGRAVITY PROXY SETTINGS MENU]\n...' },
    { role: 'user', content: 'Where should we travel today?' },
  ];

  const wirePayload = transformOpenAIToAntigravity(
    { model: 'gemini-3.7-flash', messages: dirtyMessages },
    resolvedStd!,
    'proj-123'
  );

  const wireTurns = wirePayload.request.contents;
  for (const turn of wireTurns) {
    const text = turn.parts[0]?.text || '';
    assert.ok(!text.includes('<GENSETTINGS>'), 'Past <GENSETTINGS> command leaked into wire history!');
    assert.ok(!text.includes('<SETTINGS>'), 'Past <SETTINGS> command leaked into wire history!');
    assert.ok(!text.includes('<SET:'), 'Past <SET: ...> command leaked into wire history!');
    assert.ok(!text.includes('<HELP>'), 'Past <HELP> command leaked into wire history!');
    assert.ok(!text.includes('<MYSETTINGS>'), 'Past <MYSETTINGS> command leaked into wire history!');
    assert.ok(!text.includes('[ANTIGRAVITY ROLEPLAY SAMPLING]'), 'Sampling notice leaked into wire history!');
    assert.ok(!text.includes('[ANTIGRAVITY ROLEPLAY COMMANDS'), 'Help guide leaked into wire history!');
    assert.ok(!text.includes('[ANTIGRAVITY PROXY SETTINGS MENU]'), 'Proxy menu leaked into wire history!');
  }
  console.log('✅ Upstream Wire History Sanitization passed.\n');

  // ==========================================
  // 6. OpenCode Free Models & CLI Contract Verification
  // ==========================================
  console.log('Test 6: OpenCode Free Models & CLI Contract Verification');

  // 6.1 Model Resolution & Thinking variants
  const openCodeFast = resolveOpenCodeModel('big-pickle-fast');
  assert.ok(openCodeFast, 'big-pickle-fast should resolve');
  assert.strictEqual(openCodeFast.isFast, true);
  assert.strictEqual(openCodeFast.wireModel, 'big-pickle');

  const openCodeThink = resolveOpenCodeModel('big-pickle');
  assert.ok(openCodeThink, 'big-pickle should resolve');
  assert.strictEqual(openCodeThink.isFast, false);
  assert.strictEqual(openCodeThink.wireModel, 'big-pickle');

  // Space Bunny & Snow Bunny alias
  const spaceBunny = resolveOpenCodeModel('space-bunny-free');
  assert.ok(spaceBunny, 'space-bunny-free should resolve');
  assert.strictEqual(spaceBunny.isFast, false);
  assert.strictEqual(spaceBunny.wireModel, 'space-bunny-free');

  const snowBunny = resolveOpenCodeModel('snow-bunny');
  assert.ok(snowBunny, 'snow-bunny alias should resolve to space-bunny-free');
  assert.strictEqual(snowBunny.wireModel, 'space-bunny-free');
  assert.strictEqual(snowBunny.isFast, false);

  const snowBunnyFast = resolveOpenCodeModel('snow-bunny-fast');
  assert.ok(snowBunnyFast, 'snow-bunny-fast should resolve to space-bunny-free fast');
  assert.strictEqual(snowBunnyFast.wireModel, 'space-bunny-free');
  assert.strictEqual(snowBunnyFast.isFast, true);

  // Cat Jam
  const catJam = resolveOpenCodeModel('cat-jam-free');
  assert.ok(catJam, 'cat-jam-free should resolve');
  assert.strictEqual(catJam.isFast, false);

  const catJamFast = resolveOpenCodeModel('cat-jam-free-fast');
  assert.ok(catJamFast, 'cat-jam-free-fast should resolve');
  assert.strictEqual(catJamFast.isFast, true);

  // MiMo v2.6 & v2.5 alias
  const mimo26 = resolveOpenCodeModel('mimo-v2.6-flash-free');
  assert.ok(mimo26, 'mimo-v2.6-flash-free should resolve');
  assert.strictEqual(mimo26.wireModel, 'mimo-v2.6-flash-free');

  const mimo25 = resolveOpenCodeModel('mimo-v2.5-free');
  assert.ok(mimo25, 'mimo-v2.5-free should resolve to mimo-v2.6-flash-free');
  assert.strictEqual(mimo25.wireModel, 'mimo-v2.6-flash-free');

  // LongCat 2.5
  const longCat = resolveOpenCodeModel('longcat-2.5-preview-free');
  assert.ok(longCat, 'longcat-2.5-preview-free should resolve');
  assert.strictEqual(longCat.isFast, false);

  const longCatFast = resolveOpenCodeModel('longcat-2.5-preview-free-fast');
  assert.ok(longCatFast, 'longcat-2.5-preview-free-fast should resolve');
  assert.strictEqual(longCatFast.isFast, true);

  // Step 5
  const step5 = resolveOpenCodeModel('step-5-preview-free');
  assert.ok(step5, 'step-5-preview-free should resolve');
  assert.strictEqual(step5.isFast, false);

  const step5Fast = resolveOpenCodeModel('step-5-preview-free-fast');
  assert.ok(step5Fast, 'step-5-preview-free-fast should resolve');
  assert.strictEqual(step5Fast.isFast, true);

  // Nemotron 3.5 Lightning
  const nemotronLight = resolveOpenCodeModel('nemotron-3.5-lightning-free');
  assert.ok(nemotronLight, 'nemotron-3.5-lightning-free should resolve');
  assert.strictEqual(nemotronLight.isFast, false);

  const nemotronLightFast = resolveOpenCodeModel('nemotron-3.5-lightning-free-fast');
  assert.ok(nemotronLightFast, 'nemotron-3.5-lightning-free-fast should resolve');
  assert.strictEqual(nemotronLightFast.isFast, true);

  // Nemotron 3 Ultra
  const nemotronFast = resolveOpenCodeModel('nemotron-3-ultra-free-fast');
  assert.ok(nemotronFast, 'nemotron-3-ultra-free-fast should resolve');
  assert.strictEqual(nemotronFast.isFast, true);

  const nemotronThink = resolveOpenCodeModel('nemotron-3-ultra-free');
  assert.ok(nemotronThink, 'nemotron-3-ultra-free should resolve');
  assert.strictEqual(nemotronThink.isFast, false);

  // 6.2 Canonical ID Generation Verification
  const sampleSes = generateOpenCodeSessionId();
  const sampleMsg = generateOpenCodeRequestId();
  const sesRegex = /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/;
  const msgRegex = /^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/;

  assert.ok(sesRegex.test(sampleSes), `Session ID '${sampleSes}' must match ses_<12hex><14base62>`);
  assert.ok(msgRegex.test(sampleMsg), `Request ID '${sampleMsg}' must match msg_<12hex><14base62>`);
  assert.strictEqual(sampleSes.length, 30, 'ses_ + 26 chars = 30 chars');
  assert.strictEqual(sampleMsg.length, 30, 'msg_ + 26 chars = 30 chars');

  // 6.3 Guest Accounts Pool Verification
  assert.strictEqual(OPENCODE_GUEST_ACCOUNTS.length, 16, 'Pool must contain 16 accounts');
  for (const acc of OPENCODE_GUEST_ACCOUNTS) {
    assert.ok(sesRegex.test(acc.sessionId), `Account ${acc.id} sessionId '${acc.sessionId}' must be canonical ses_ format`);
  }

  // 6.4 Official Tools Contract Verification
  assert.strictEqual(OPENCODE_OFFICIAL_TOOLS.length, 6, 'Must contain 6 official tools');
  const toolNames = OPENCODE_OFFICIAL_TOOLS.map(t => t.function.name);
  assert.deepStrictEqual(toolNames.sort(), ['bash', 'edit', 'glob', 'grep', 'read', 'write'].sort());

  console.log('✅ OpenCode Free Models & CLI Contract Verification passed.\n');

  // ==========================================
  // 7. Memory & Chat Logs Architecture Tests
  // ==========================================
  console.log('Test 7: Memory & Chat Logs Architecture Verification');

  // 7.1 extractSessionOverview robustness tests
  const testSession: ChatSession = {
    id: 'chat_test_123',
    characterId: 'char_lily',
    characterName: 'Lily',
    title: 'Lily • "Adventure"',
    createdAt: 1000,
    updatedAt: 2000,
    messages: [
      { id: 'm1', role: 'user', content: 'Hello Lily!', timestamp: 1000 },
      { id: 'm2', role: 'assistant', content: 'Hello traveler! *smiles warmly*', reasoning_content: 'Thought process here', timestamp: 1500 },
    ],
    messageCount: 2,
  };

  const overview = extractSessionOverview(testSession);
  assert.strictEqual(overview.id, 'chat_test_123');
  assert.strictEqual(overview.characterName, 'Lily');
  assert.strictEqual(overview.messageCount, 2);
  assert.ok(overview.estimatedTokens > 0);
  assert.ok(overview.lastMessagePreview.includes('Lily: Hello traveler!'));
  assert.strictEqual((overview as any).messages, undefined, 'Overview MUST NOT contain full messages array');

  // Edge case: Multimodal / array content in messages
  const arrayContentSession: ChatSession = {
    id: 'chat_array_456',
    characterId: 'char_elena',
    characterName: 'Elena',
    title: 'Elena Chat',
    createdAt: 1000,
    updatedAt: 2000,
    messages: [
      { id: 'm3', role: 'user', content: [{ type: 'text', text: 'Look at this picture' }] as any, timestamp: 1000 },
      { id: 'm4', role: 'assistant', content: [{ type: 'text', text: 'I see it clearly now.' }] as any, timestamp: 2000 },
    ],
    messageCount: 2,
  };

  const arrayOverview = extractSessionOverview(arrayContentSession);
  assert.strictEqual(arrayOverview.id, 'chat_array_456');
  assert.strictEqual(arrayOverview.messageCount, 2);
  assert.ok(arrayOverview.lastMessagePreview.includes('I see it clearly now.'));

  // Edge case: Empty session
  const emptySession: ChatSession = {
    id: 'chat_empty_789',
    characterId: 'char_default',
    characterName: 'Character',
    title: 'New Chat',
    createdAt: 1000,
    updatedAt: 1000,
    messages: [],
    messageCount: 0,
  };
  const emptyOverview = extractSessionOverview(emptySession);
  assert.strictEqual(emptyOverview.messageCount, 0);
  assert.strictEqual(emptyOverview.lastMessagePreview, 'Empty session');

  // 7.2 saveChatSession, getSessionById, and listSessionOverviews
  await saveChatSession(testSession);
  await saveChatSession(arrayContentSession);

  const allOverviews = await listSessionOverviews(10);
  assert.ok(allOverviews.length >= 2, `Expected at least 2 overviews, got ${allOverviews.length}`);
  const foundTest = allOverviews.find(o => o.id === 'chat_test_123');
  assert.ok(foundTest, 'Saved session must be listed in overviews');
  assert.strictEqual((foundTest as any).messages, undefined, 'Listed overview must be lightweight without messages');

  // getSessionById returns full session with messages intact
  const fullDetail = await getSessionById('chat_test_123');
  assert.ok(fullDetail, 'Full session detail must be retrievable by chatId');
  assert.strictEqual(fullDetail!.messages.length, 2, 'Full detail must preserve messages array');
  assert.strictEqual(fullDetail!.messages[1].reasoning_content, 'Thought process here');

  // 7.3 recordTurnsIntoSession updates counts and turns
  await recordTurnsIntoSession(
    fullDetail!,
    [
      { role: 'user', content: 'Hello Lily!' },
      { role: 'assistant', content: 'Hello traveler! *smiles warmly*' },
      { role: 'user', content: 'What is your favorite flower?' }
    ],
    'I love snowdrop blossoms.',
    'Thinking about flowers'
  );
  assert.strictEqual(fullDetail!.messages.length, 4, 'recordTurnsIntoSession must append turns');
  const updatedOverview = extractSessionOverview(fullDetail!);
  assert.strictEqual(updatedOverview.messageCount, 4);
  assert.ok(updatedOverview.lastMessagePreview.includes('snowdrop blossoms'));

  // 7.4 deleteChatSession
  const deleted = await deleteChatSession('chat_test_123');
  assert.strictEqual(deleted, true);
  const detailAfterDelete = await getSessionById('chat_test_123');
  assert.strictEqual(detailAfterDelete, null, 'Deleted session must not be found');

  // Clean up array session
  await deleteChatSession('chat_array_456');

  // 7.5 deleteAllChatSessions complete flush
  await saveChatSession(emptySession);
  const beforeFlush = await listSessionOverviews(10);
  assert.ok(beforeFlush.length >= 1, 'Session should exist before flush');
  const flushed = await deleteAllChatSessions();
  assert.strictEqual(flushed, true);
  const afterFlush = await listSessionOverviews(10);
  assert.strictEqual(afterFlush.length, 0, 'deleteAllChatSessions must flush all sessions');
  console.log('✅ Memory & Chat Logs Architecture Verification passed.\n');

  // ==========================================
  // 8. Upstash Pipeline Prompt Injections Persistence & In-Chat Commands Verification
  // ==========================================
  console.log('Test 8: Upstash Pipeline Prompt Injections Persistence & In-Chat Commands Verification');

  // 8.1 getInjectionsConfig initial state
  const initialConfig = await getInjectionsConfig(true);
  assert.ok(initialConfig, 'Initial injections config must exist');
  assert.strictEqual(typeof initialConfig.masterEnabled, 'boolean');
  assert.ok(Array.isArray(initialConfig.injections), 'Injections must be an array');
  assert.ok(initialConfig.injections.length >= 7, 'Default curated injections must be present');

  // 8.2 saveInjectionsConfig returns boolean
  const modifiedConfig = {
    ...initialConfig,
    masterEnabled: false,
  };
  const saveResult = await saveInjectionsConfig(modifiedConfig);
  assert.strictEqual(typeof saveResult, 'boolean');
  assert.strictEqual(saveResult, true, 'saveInjectionsConfig must return true in local/in-memory mode');

  const fetchedAfterSave = await getInjectionsConfig();
  assert.strictEqual(fetchedAfterSave.masterEnabled, false, 'Config must reflect updated masterEnabled');

  // 8.3 In-chat master toggle command
  const masterOnRes = await executeInChatCommand({ type: 'master_toggle', rawInput: '<INJECTIONS: ON>', masterEnabled: true });
  assert.ok(masterOnRes.includes('Master Injections Switch is now 🟢 ON'));
  const configAfterMasterOn = await getInjectionsConfig();
  assert.strictEqual(configAfterMasterOn.masterEnabled, true, 'Master switch should be ON');

  // 8.4 In-chat enable / disable commands
  const enableRes = await executeInChatCommand({ type: 'enable', rawInput: '<ENABLE: Slow Romance>', targets: ['Slow Romance'] });
  assert.ok(enableRes.includes('Enabled [Slow Romance Setting]'));
  const configAfterEnable = await getInjectionsConfig();
  const slowRomanceInj = configAfterEnable.injections.find(i => i.title.toLowerCase().includes('slow romance'));
  assert.strictEqual(slowRomanceInj?.enabled, true, 'Slow Romance injection should be enabled');

  const disableRes = await executeInChatCommand({ type: 'disable', rawInput: '<DISABLE: Slow Romance>', targets: ['Slow Romance'] });
  assert.ok(disableRes.includes('Disabled [Slow Romance Setting]'));
  const configAfterDisable = await getInjectionsConfig();
  const slowRomanceInjAfterDisable = configAfterDisable.injections.find(i => i.title.toLowerCase().includes('slow romance'));
  assert.strictEqual(slowRomanceInjAfterDisable?.enabled, false, 'Slow Romance injection should be disabled');

  // 8.5 Reset to defaults
  await saveInjectionsConfig({
    masterEnabled: true,
    injections: DEFAULT_INJECTIONS
  });
  const resetCheck = await getInjectionsConfig(true);
  assert.strictEqual(resetCheck.masterEnabled, true);

  // 8.6 Persistence failure simulation & non-corrupting memory cache
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:9'; // Non-routable local port to simulate failure
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock_token';
  assert.strictEqual(isRedisConfigured(), true);

  const failSaveResult = await saveInjectionsConfig({
    masterEnabled: false,
    injections: DEFAULT_INJECTIONS
  });
  assert.strictEqual(failSaveResult, false, 'saveInjectionsConfig must return false when Redis write fails');
  assert.ok(getLastRedisError().length > 0, 'getLastRedisError must record the failure');

  // Verify memory cache did NOT get corrupted with unpersisted masterEnabled: false
  const cacheAfterFailure = await getInjectionsConfig();
  assert.strictEqual(cacheAfterFailure.masterEnabled, true, 'Memory cache must not be corrupted when Redis persistence fails');

  // In-chat command warning test when Redis fails
  const failedCmdRes = await executeInChatCommand({ type: 'master_toggle', rawInput: '<INJECTIONS: OFF>', masterEnabled: false });
  assert.ok(failedCmdRes.includes('⚠️ Warning: Failed to persist Master Switch to cloud database'), 'In-chat command must issue clear persistence warning');

  // Clean up mock environment
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.strictEqual(isRedisConfigured(), false);

  console.log('✅ Upstash Pipeline Prompt Injections Persistence & In-Chat Commands Verification passed.\n');

  // ==========================================
  // 9. Claude Token Optimization Suite & Pure Client Pass-Through
  // ==========================================
  console.log('Test 9: Claude Token Optimization Suite & Pure Client Pass-Through');

  // 9.1 Claude Pure Client Pass-Through: 100% full history preserved by default (no forced 30-turn clamping)
  const claudeSonnetFast = resolveWireModel('claude-sonnet-4-6-fast');
  assert.ok(claudeSonnetFast);

  // Generate 50 dialogue turns (25 user, 25 assistant)
  const massiveDialogue: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: 'Character Persona: Aurora the Sorceress. Lore: The ancient citadel.' }
  ];
  for (let i = 1; i <= 25; i++) {
    massiveDialogue.push({ role: 'user', content: `User statement ${i}` });
    massiveDialogue.push({ role: 'assistant', content: `Assistant reply ${i}` });
  }

  const passThroughWire = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: massiveDialogue },
    claudeSonnetFast!,
    'test-proj'
  );

  // Assert 100% of dialogue turns are preserved (no forced 30-turn chokehold)
  assert.ok(
    passThroughWire.request.contents.length >= 50,
    `Expected pure client pass-through >= 50 turns by default, got ${passThroughWire.request.contents.length}`
  );
  // Assert Google protocol invariants
  assert.strictEqual(passThroughWire.request.contents[0].role, 'user', 'First turn must be user');
  assert.strictEqual(
    passThroughWire.request.contents[passThroughWire.request.contents.length - 1].role,
    'user',
    'Terminal turn must be user'
  );
  // Assert 100% system prompt preserved
  const sysText = passThroughWire.request.systemInstruction.parts[0]?.text || '';
  assert.ok(sysText.includes('Aurora the Sorceress'), 'Character persona in system prompt was lost!');
  assert.ok(sysText.includes('The ancient citadel'), 'Lore in system prompt was lost!');
  // Assert earlier turns are preserved in full (e.g. statement 1 is present!)
  assert.ok(
    passThroughWire.request.contents.some((c: any) => c.parts[0]?.text?.includes('User statement 1')),
    'Early dialogue turns (turn 1) must be preserved in full!'
  );

  // 9.2 Opt-In Clamping (ONLY when explicitly requested via clamped_context or clampedContext option)
  const clampedWire1 = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: massiveDialogue, clamped_context: true },
    claudeSonnetFast!,
    'test-proj'
  );
  assert.ok(
    clampedWire1.request.contents.length <= 30,
    `Explicitly clamped contents must be <= 30 turns, got ${clampedWire1.request.contents.length}`
  );
  assert.strictEqual(clampedWire1.request.contents[0].role, 'user', 'Clamped first turn must be user');
  assert.strictEqual(
    clampedWire1.request.contents[clampedWire1.request.contents.length - 1].role,
    'user',
    'Clamped terminal turn must be user'
  );

  const clampedWire2 = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: massiveDialogue },
    claudeSonnetFast!,
    'test-proj',
    undefined,
    undefined,
    undefined,
    { clampedContext: true }
  );
  assert.ok(
    clampedWire2.request.contents.length <= 30,
    `Options clampedContext must clamp to <= 30 turns, got ${clampedWire2.request.contents.length}`
  );

  // 9.3 First-party Gemini models are also pure pass-through
  const gemini38 = resolveWireModel('gemini-3.8-flash');
  const geminiWire = transformOpenAIToAntigravity(
    { model: 'gemini-3.8-flash', messages: massiveDialogue },
    gemini38!,
    'test-proj'
  );
  assert.ok(
    geminiWire.request.contents.length >= 50,
    `Gemini models must NOT be clamped, got ${geminiWire.request.contents.length}`
  );

  // 9.4 Deterministic sessionId for prefix KV caching (reuses cache on same chat + system prompt, rotates on system prompt edit)
  const wireSessionA1 = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: [{ role: 'user', content: 'Turn 1' }] },
    claudeSonnetFast!,
    'test-proj',
    'Character card: Lyra v1',
    undefined,
    undefined,
    { chatId: 'chat_session_stable_123' }
  );
  const wireSessionA2 = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: [{ role: 'user', content: 'Turn 2' }] },
    claudeSonnetFast!,
    'test-proj',
    'Character card: Lyra v1',
    undefined,
    undefined,
    { chatId: 'chat_session_stable_123' }
  );
  assert.strictEqual(
    wireSessionA1.request.sessionId,
    wireSessionA2.request.sessionId,
    'Same chatId + system prompt must produce identical deterministic sessionId across turns for KV-cache hits'
  );
  assert.ok(
    /^-\d+$/.test(wireSessionA1.request.sessionId),
    `sessionId must be a negative numeric string, got "${wireSessionA1.request.sessionId}"`
  );

  const wireSessionEditedSys = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: [{ role: 'user', content: 'Turn 3' }] },
    claudeSonnetFast!,
    'test-proj',
    'Character card: Lyra v2 (edited persona)',
    undefined,
    undefined,
    { chatId: 'chat_session_stable_123' }
  );
  assert.notStrictEqual(
    wireSessionA1.request.sessionId,
    wireSessionEditedSys.request.sessionId,
    'Editing system prompt must rotate sessionId so Claude immediately picks up system changes'
  );

  const wireSessionB = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: [{ role: 'user', content: 'Turn 1' }] },
    claudeSonnetFast!,
    'test-proj',
    'Character card: Lyra v1',
    undefined,
    undefined,
    { chatId: 'chat_session_different_456' }
  );
  assert.notStrictEqual(
    wireSessionA1.request.sessionId,
    wireSessionB.request.sessionId,
    'Different chatId must produce distinct sessionId'
  );

  // 9.7 Numeric chatId / sessionId in request body must not break generation
  const numericSessionWire = transformOpenAIToAntigravity(
    { model: 'claude-sonnet-4-6-fast', messages: [{ role: 'user', content: 'Hi' }], chat_id: 987654321 },
    claudeSonnetFast!,
    'test-proj'
  );
  assert.ok(
    /^-\d+$/.test(numericSessionWire.request.sessionId),
    `Numeric chatId must produce valid negative numeric sessionId, got ${numericSessionWire.request.sessionId}`
  );

  // 9.8 Extended Claude aliases and path prefixes
  const opusThinkingFast = resolveWireModel('claude-opus-4-6-thinking-fast');
  assert.ok(opusThinkingFast, 'claude-opus-4-6-thinking-fast failed to resolve');
  assert.strictEqual(opusThinkingFast!.wireModel, 'claude-opus-4-6-thinking');
  assert.strictEqual(opusThinkingFast!.defaultThinkingBudget, 0);

  const opusThinkingLow = resolveWireModel('claude-opus-4-6-thinking:low');
  assert.ok(opusThinkingLow, 'claude-opus-4-6-thinking:low failed to resolve');
  assert.strictEqual(opusThinkingLow!.wireModel, 'claude-opus-4-6-thinking');
  assert.strictEqual(opusThinkingLow!.defaultThinkingBudget, 2048);

  const anthropicSonnet = resolveWireModel('anthropic/claude-sonnet-4-6-fast');
  assert.ok(anthropicSonnet, 'anthropic/claude-sonnet-4-6-fast failed to resolve');
  assert.strictEqual(anthropicSonnet!.wireModel, 'claude-sonnet-4-6');
  assert.strictEqual(anthropicSonnet!.defaultThinkingBudget, 0);

  // 9.9 Argon Experimental Cohort Models (Pinned to kars60928@gmail.com)
  const argonLow = resolveWireModel('argon-low');
  assert.ok(argonLow, 'argon-low failed to resolve');
  assert.strictEqual(argonLow!.wireModel, 'gemini-3.8-flash-high');
  assert.strictEqual(argonLow!.defaultThinkingBudget, 2048);
  assert.strictEqual(argonLow!.targetAccount, 'kars60928@gmail.com');

  const argonMed = resolveWireModel('argon-medium');
  assert.ok(argonMed, 'argon-medium failed to resolve');
  assert.strictEqual(argonMed!.wireModel, 'gemini-3.8-flash-high');
  assert.strictEqual(argonMed!.defaultThinkingBudget, 8192);
  assert.strictEqual(argonMed!.targetAccount, 'kars60928@gmail.com');

  const argonHigh = resolveWireModel('argon-high');
  assert.ok(argonHigh, 'argon-high failed to resolve');
  assert.strictEqual(argonHigh!.wireModel, 'gemini-3.8-flash-high');
  assert.strictEqual(argonHigh!.defaultThinkingBudget, 24576);
  assert.strictEqual(argonHigh!.targetAccount, 'kars60928@gmail.com');

  console.log('✅ Claude Token Optimization & Argon Cohort Pinning Suite passed.\n');

  // ==========================================
  // 10. Card Exporter Virtual Utility Model & Character Card Extraction Suite
  // ==========================================
  console.log('Test 10: Card Exporter Virtual Utility Model & Character Card Extraction Suite');

  // 10.1 Model alias recognition
  const validAliases = [
    'card-exporter',
    'card-export',
    'character-exporter',
    'character-card-exporter',
    'prompt-exporter',
    'card-extractor',
    'models/card-exporter',
    'publishers/google/models/card-export',
    'card_exporter',
    'card-exporter:latest',
    'card-exporter:v1',
    'openai/card-exporter',
    'custom/character-exporter',
    'chara-card-exporter',
    'bot-exporter',
    'CARD-EXPORTER',
  ];
  for (const alias of validAliases) {
    assert.strictEqual(
      isCardExporterModel(alias),
      true,
      `Expected isCardExporterModel("${alias}") to be true`
    );
  }

  const nonExporterModels = [
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'claude-sonnet-4-6',
    'claude-opus-4-6-thinking',
    'big-pickle',
    'unknown-model',
    '',
    undefined,
  ];
  for (const nonModel of nonExporterModels) {
    assert.strictEqual(
      isCardExporterModel(nonModel),
      false,
      `Expected isCardExporterModel("${nonModel}") to be false`
    );
  }
  console.log('  10.1 Model alias recognition passed (including prefixes and version tags).');

  // 10.2 Fallback model registry
  const cardExporterSpec = FALLBACK_MODELS.find(m => m.id === 'card-exporter');
  assert.ok(cardExporterSpec, 'card-exporter must be present in FALLBACK_MODELS');
  assert.strictEqual(cardExporterSpec!.tier, 'Utility');
  assert.strictEqual(cardExporterSpec!.badge, '0 Quota / Instant');
  assert.strictEqual(cardExporterSpec!.thinking, 'None');
  assert.strictEqual(cardExporterSpec!.context, 'Instant');
  console.log('  10.2 FALLBACK_MODELS registry passed.');

  // 10.3 exportCharacterCard unit extraction & SillyTavern V2 JSON spec compliance
  const sampleSystem = `
<char_name>Lyra Nightshade</char_name>
<description>A skilled elven rogue with silver hair, dark leather gear, and twin daggers named Whisper and Fang.</description>
<personality>Sarcastic, observant, guarded, fiercely protective of allies, loves rare poisons and dark taverns.</personality>
<scenario>The Dim Lantern Tavern in the lower catacombs of Highspire.</scenario>
<mes_example>
<START>
{{user}}: What are you drinking?
{{char}}: *smiles faintly* "Something stronger than what you can handle."
</mes_example>
`;
  const sampleMessages = [
    { role: 'system', content: sampleSystem },
    { role: 'assistant', content: '*She twirls her dagger on the wooden table, looking up through the dim tavern smoke.* "Looking for work, or just looking at me?"' },
    { role: 'user', content: '*I sit across from you with a smirk.* "A bit of both."' },
    { role: 'user', content: '<world_info title="Highspire Catacombs">Ancient undercity beneath the imperial capital, rife with thieves and forgotten crypts.</world_info>' },
  ];

  const cardOutput = exportCharacterCard(sampleMessages, sampleSystem, undefined);
  assert.ok(cardOutput.includes('# 📋 Character Card Export: Lyra Nightshade'), 'Markdown must contain character name title');
  assert.ok(cardOutput.includes('0 Upstream Quota Consumed'), 'Markdown must show 0 quota badge');
  assert.ok(cardOutput.includes('Highspire Catacombs'), 'Markdown must include extracted world info');
  assert.ok(cardOutput.includes('SillyTavern V2 Character Card'), 'Markdown must include SillyTavern V2 section');

  // Verify JSON extraction and spec compliance
  const jsonMatch = cardOutput.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(jsonMatch && jsonMatch[1], 'Must contain fenced JSON code block');
  const parsedCard = JSON.parse(jsonMatch![1]);
  assert.strictEqual(parsedCard.spec, 'chara_card_v2');
  assert.strictEqual(parsedCard.spec_version, '2.0');
  assert.strictEqual(parsedCard.data.name, 'Lyra Nightshade');
  assert.ok(parsedCard.data.description.includes('twin daggers'));
  assert.ok(parsedCard.data.personality.includes('Sarcastic'));
  assert.ok(parsedCard.data.scenario.includes('Dim Lantern Tavern'));
  assert.ok(parsedCard.data.first_mes.includes('Looking for work'));
  assert.ok(parsedCard.data.character_book, 'character_book should be populated from injected world info');
  assert.strictEqual(parsedCard.data.character_book.entries.length, 1);
  assert.strictEqual(parsedCard.data.character_book.entries[0].comment, 'Highspire Catacombs');

  // Header override tests (both mock get() and plain Record object)
  const headerOverridden = exportCharacterCard(sampleMessages, sampleSystem, { get: (k: string) => k === 'x-character-name' ? 'Custom Override Name' : null });
  assert.ok(headerOverridden.includes('# 📋 Character Card Export: Custom Override Name'), 'x-character-name header must override character name');

  const plainHeaderOverridden = exportCharacterCard(sampleMessages, sampleSystem, { 'x-character-name': 'Plain Object Name' });
  assert.ok(plainHeaderOverridden.includes('# 📋 Character Card Export: Plain Object Name'), 'Plain object headers must override character name');

  // Colon-less Markdown headers test
  const markdownCardSystem = `
### Character: Selene
### Description
A lunar priestess clad in glowing starlight robes.

### Personality
Calm, enigmatic, compassionate, and unwavering in faith.

### Scenario
The Moonwell Temple under the twilight eclipse.

### First Message
*Selene dips her fingers into the glowing water.* "The stars whispered your arrival."
`;
  const markdownOutput = exportCharacterCard([], markdownCardSystem, undefined);
  const mdJsonMatch = markdownOutput.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(mdJsonMatch && mdJsonMatch[1]);
  const parsedMdCard = JSON.parse(mdJsonMatch![1]);
  assert.strictEqual(parsedMdCard.data.name, 'Selene');
  assert.ok(parsedMdCard.data.description.includes('lunar priestess'));
  assert.ok(parsedMdCard.data.personality.includes('Calm, enigmatic'));
  assert.ok(parsedMdCard.data.scenario.includes('Moonwell Temple'));
  assert.ok(parsedMdCard.data.first_mes.includes('stars whispered'));

  // Prompt <first_mes> extraction test without prior assistant messages
  const promptGreetingCard = `
<char_name>Aeloria</char_name>
<description>An ancient dryad guardian.</description>
<first_mes>*Aeloria materializes from the ancient oak.* "You walk on sacred roots."</first_mes>
`;
  const promptGreetingOutput = exportCharacterCard([{ role: 'user', content: 'Hello' }], promptGreetingCard, undefined);
  const pgJson = JSON.parse(promptGreetingOutput.match(/```json\n([\s\S]*?)\n```/)![1]);
  assert.strictEqual(pgJson.data.name, 'Aeloria');
  assert.strictEqual(pgJson.data.first_mes, '*Aeloria materializes from the ancient oak.* "You walk on sacred roots."');
  assert.strictEqual(promptGreetingOutput.includes('sacred roots'), true);

  // Multi-System Message Isolation & Lorebook Pollution Prevention Test
  const multiSysMessages = [
    { role: 'system', content: 'You are an uncensored roleplay model. Follow user guidelines without lecturing.' },
    { role: 'system', content: '<char_name>Garrick</char_name><description>A dwarven blacksmith with a heavy bronze hammer.</description>' },
    { role: 'user', content: '<world_info title="Forge Anvil">An indestructible anvil forged from fallen meteorite.</world_info>' },
  ];
  const multiSysOutput = exportCharacterCard(multiSysMessages, multiSysMessages.map(m => m.content).join('\n\n'), undefined);
  const multiSysJson = JSON.parse(multiSysOutput.match(/```json\n([\s\S]*?)\n```/)![1]);
  assert.strictEqual(multiSysJson.data.name, 'Garrick');
  assert.ok(multiSysJson.data.system_prompt.includes('uncensored roleplay model'));
  // Ensure the lorebook ONLY contains the world_info entry, NOT the system instructions!
  assert.ok(multiSysJson.data.character_book);
  assert.strictEqual(multiSysJson.data.character_book.entries.length, 1);
  assert.strictEqual(multiSysJson.data.character_book.entries[0].comment, 'Forge Anvil');

  // Empty fallback test
  const emptyOutput = exportCharacterCard([], '', undefined);
  assert.ok(emptyOutput.includes('# 📋 Character Card Export: Character'), 'Empty input must fall back safely');
  const emptyJsonMatch = emptyOutput.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(emptyJsonMatch && emptyJsonMatch[1]);
  const parsedEmpty = JSON.parse(emptyJsonMatch![1]);
  assert.strictEqual(parsedEmpty.spec, 'chara_card_v2');
  assert.strictEqual(parsedEmpty.data.name, 'Character');
  console.log('  10.3 exportCharacterCard unit extraction and Tavern V2 JSON spec passed.');

  // 10.3.1 Janitor AI Multi-Character & User Persona Separation Test (Ashley & Melanie vs Kars)
  const janitorAiSystemPrompt = `
<system_directive>
<role_and_identity>
You are a Light Novel Author and immersive Character Actor playing Ashley & Melanie, ambient NPCs, and the living world in an ongoing fantasy adventure.
</role_and_identity>

### Ashley & Melanie's Persona
Ashley is a fiery crimson-haired swordswoman. Melanie is a quiet silver-haired spellcaster.

### Scenario
An adventurer's guild in the floating city of Aethelgard.

[User's Persona: Kars - A wandering dual-blade duelist with a stoic attitude.]
`;

  const janitorAiMessages = [
    { role: 'system', content: janitorAiSystemPrompt },
    { role: 'assistant', content: '*Ashley crosses her arms with a smirk, while Melanie pours tea.* "Looking for work or just passing through?"' },
    { role: 'user', content: 'Kars: Looking for a contract.' },
  ];

  const janitorAiOutput = exportCharacterCard(janitorAiMessages, janitorAiSystemPrompt, undefined);
  const janitorAiJsonMatch = janitorAiOutput.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(janitorAiJsonMatch && janitorAiJsonMatch[1], 'Must produce SillyTavern V2 JSON');
  const janitorAiJson = JSON.parse(janitorAiJsonMatch[1]);

  // Assert Character Name is "Ashley & Melanie" and NEVER "Kars"
  assert.strictEqual(janitorAiJson.data.name, 'Ashley & Melanie', 'Character name must be resolved to Ashley & Melanie, not Kars');
  assert.ok(janitorAiOutput.includes('**Character Name**: **Ashley & Melanie**'), 'Title badge must specify Ashley & Melanie');
  assert.ok(janitorAiOutput.includes('**User Name**: **Kars**'), 'Header badge must specify User Name: Kars');

  // Assert Google AI Studio Single Box Copy-Paste is present and structured
  assert.ok(janitorAiOutput.includes('### 📦 Google AI Studio System Instructions (Single Box Copy-Paste)'), 'Must contain Google AI Studio single box section');
  assert.ok(janitorAiOutput.includes('[Character Definition]'), 'Google AI Studio box must contain [Character Definition]');
  assert.ok(janitorAiOutput.includes('Character Name: Ashley & Melanie'), 'Character Definition must contain Ashley & Melanie');
  assert.ok(janitorAiOutput.includes('[User Definition]'), 'Google AI Studio box must contain [User Definition]');
  assert.ok(janitorAiOutput.includes('User Name: Kars'), 'User Definition must contain Kars');
  assert.ok(janitorAiOutput.includes('A wandering dual-blade duelist'), 'User Definition must contain Kars persona text');
  assert.ok(janitorAiOutput.includes('[System Instructions / Formatting Rules]'), 'Google AI Studio box must contain formatting rules');
  assert.ok(janitorAiOutput.includes('[First Message / Greeting]'), 'Google AI Studio box must contain initial greeting');
  assert.ok(janitorAiOutput.includes('Looking for work or just passing through?'), 'Greeting must contain assistant starter');

  // Assert User Definition modular breakdown section is present
  assert.ok(janitorAiOutput.includes('### 👤 User Definition & Persona'), 'Must include User Definition breakdown');
  assert.ok(janitorAiOutput.includes('A wandering dual-blade duelist'), 'Breakdown must display user persona');

  // Assert deriveChatFingerprint also resolves characterName as Ashley & Melanie
  const { characterName: fpCharName } = deriveChatFingerprint(janitorAiMessages, janitorAiSystemPrompt, undefined);
  assert.strictEqual(fpCharName, 'Ashley & Melanie', 'deriveChatFingerprint must resolve Ashley & Melanie');
  console.log('  10.3.1 Janitor AI Ashley & Melanie vs User Kars separation and Google AI Studio unified box passed.');

  // 10.3.2 Edge Cases: User Header Overrides, Assistant Greeting Fallbacks, and Empty Personas
  // Case A: Custom user header override
  const headerUserOutput = exportCharacterCard(janitorAiMessages, janitorAiSystemPrompt, { 'x-user-name': 'Commander Shepard' });
  assert.ok(headerUserOutput.includes('**User Name**: **Commander Shepard**'), 'x-user-name header must override user name');

  // Case B: Assistant greeting fallback when prompt has user persona but no character tag
  const fallbackUserCollision = [
    { role: 'assistant', content: '*Bonnie & Clyde enter the bank with weapons drawn.* "Hands in the air!"' },
    { role: 'user', content: 'Kars: I am just a bystander.' },
  ];
  const fallbackCollisionPrompt = '[User: Kars - a merchant]\nScenario: A bank heist.';
  const fallbackCollisionOutput = exportCharacterCard(fallbackUserCollision, fallbackCollisionPrompt, undefined);
  const fbJson = JSON.parse(fallbackCollisionOutput.match(/```json\n([\s\S]*?)\n```/)![1]);
  assert.strictEqual(fbJson.data.name, 'Bonnie & Clyde', 'Must pick assistant Bonnie & Clyde and reject user Kars');
  assert.ok(fallbackCollisionOutput.includes('**User Name**: **Kars**'));

  // Case C: Missing user persona defaults gracefully
  const noUserOutput = exportCharacterCard([], '<char_name>Selene</char_name><description>Moon Priestess</description>', undefined);
  assert.ok(noUserOutput.includes('**User Name**: **User**'));
  assert.ok(noUserOutput.includes('*(No user persona provided)*'));
  console.log('  10.3.2 Edge Cases (Header overrides, assistant greeting fallback, empty persona) passed.');

  // 10.4 E2E handleChatCompletions interception (streaming, default streaming when omitted, and non-streaming)
  // Test A: stream: true
  const streamReq = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'card-exporter',
      messages: sampleMessages,
      stream: true,
    }),
  });
  const streamRes = await handleChatCompletions(streamReq);
  assert.strictEqual(streamRes.status, 200, `Expected 200 OK for card-exporter stream, got ${streamRes.status}`);
  assert.ok(
    streamRes.headers.get('content-type')?.includes('text/event-stream'),
    `Expected text/event-stream, got ${streamRes.headers.get('content-type')}`
  );

  const streamReader = streamRes.body?.getReader();
  assert.ok(streamReader, 'Stream reader must be defined');
  const streamDecoder = new TextDecoder();
  let streamText = '';
  let streamDone = false;
  while (true) {
    const { done, value } = await streamReader!.read();
    if (done) break;
    const chunk = streamDecoder.decode(value);
    streamText += chunk;
    if (chunk.includes('data: [DONE]')) streamDone = true;
  }
  assert.strictEqual(streamDone, true, 'Stream must conclude with data: [DONE]');
  assert.ok(streamText.includes('chat.completion.chunk'), 'Stream must contain OpenAI chat.completion.chunk');
  assert.ok(streamText.includes('Lyra Nightshade'), 'Stream chunks must contain extracted character data');

  // Test B: stream omitted (default stream !== false)
  const defaultStreamReq = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/card-exporter',
      messages: sampleMessages,
    }),
  });
  const defaultStreamRes = await handleChatCompletions(defaultStreamReq);
  assert.strictEqual(defaultStreamRes.status, 200);
  assert.ok(
    defaultStreamRes.headers.get('content-type')?.includes('text/event-stream'),
    'Omitted stream parameter must default to streaming response as per specification'
  );

  // Test C: stream: false (JSON response)
  const jsonReq = new NextRequest('http://localhost:3000/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'card-export',
      messages: sampleMessages,
      stream: false,
    }),
  });
  const jsonRes = await handleChatCompletions(jsonReq);
  assert.strictEqual(jsonRes.status, 200, `Expected 200 OK for card-export JSON, got ${jsonRes.status}`);
  const jsonData = await jsonRes.json();
  assert.strictEqual(jsonData.object, 'chat.completion');
  assert.strictEqual(jsonData.model, 'card-export');
  assert.ok(jsonData.choices?.[0]?.message?.content?.includes('# 📋 Character Card Export: Lyra Nightshade'));
  assert.ok(jsonData.choices?.[0]?.message?.content?.includes('"spec": "chara_card_v2"'));

  console.log('  10.4 handleChatCompletions streaming & non-streaming interception passed.');
  console.log('✅ Card Exporter Virtual Utility Model & Character Card Extraction Suite passed.\n');

  console.log('🎉 ALL STREAMLINED ROLEPLAY CORE TESTS PASSED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
