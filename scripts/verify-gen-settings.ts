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
  DEFAULT_INJECTIONS,
} from '../lib/injections';
import {
  resolveWireModel,
  transformOpenAIToAntigravity,
} from '../lib/antigravity';
import {
  OPENCODE_MODELS,
  resolveOpenCodeModel,
} from '../lib/opencode';
import {
  extractSessionOverview,
  saveChatSession,
  listSessionOverviews,
  getSessionById,
  deleteChatSession,
  deleteAllChatSessions,
  recordTurnsIntoSession,
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
    'gemini-2.5-flash'
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
    'gemini-3.1-pro:low'
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
  console.log('✅ Model Presets as Single Source of Truth for Thinking Tiers passed.\n');

  // ==========================================
  // 4. Pure Client Pass-Through Wire Parameter Mapping
  // ==========================================
  console.log('Test 4: Pure Client Pass-Through Wire Parameter Mapping');
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
  assert.strictEqual(wireConfig.presencePenalty, 0.45, 'Client presence_penalty must pass through unmodified');
  assert.strictEqual(wireConfig.frequencyPenalty, -0.25, 'Client frequency_penalty must pass through unmodified');
  // Upstream maxOutputTokens decouples thinking tokens: max(16384, 4096 + 8192) = 16384
  assert.strictEqual(wireConfig.maxOutputTokens, 16384, 'Decoupled maxOutputTokens headroom must be preserved');
  console.log('✅ Pure Client Pass-Through Wire Parameter Mapping passed.\n');

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
  // 6. OpenCode Free Models Verification
  // ==========================================
  console.log('Test 6: OpenCode Free Models Verification');
  const openCodeFast = resolveOpenCodeModel('big-pickle-fast');
  assert.ok(openCodeFast, 'big-pickle-fast should resolve');
  assert.strictEqual(openCodeFast.isFast, true);
  assert.strictEqual(openCodeFast.wireModel, 'big-pickle');

  const openCodeThink = resolveOpenCodeModel('big-pickle');
  assert.ok(openCodeThink, 'big-pickle should resolve');
  assert.strictEqual(openCodeThink.isFast, false);
  assert.strictEqual(openCodeThink.wireModel, 'big-pickle');

  const nemotronFast = resolveOpenCodeModel('nemotron-3-ultra-free-fast');
  assert.ok(nemotronFast, 'nemotron-3-ultra-free-fast should resolve');
  assert.strictEqual(nemotronFast.isFast, true);

  const nemotronThink = resolveOpenCodeModel('nemotron-3-ultra-free');
  assert.ok(nemotronThink, 'nemotron-3-ultra-free should resolve');
  assert.strictEqual(nemotronThink.isFast, false);
  console.log('✅ OpenCode Free Models Verification passed.\n');

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

  console.log('✅ Upstash Pipeline Prompt Injections Persistence & In-Chat Commands Verification passed.\n');

  console.log('🎉 ALL STREAMLINED ROLEPLAY CORE TESTS PASSED SUCCESSFULLY!');
}

main().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
