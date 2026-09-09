import assert from 'node:assert';
import {
  DEFAULT_GENERATION_SETTINGS,
  parseGenerationSettingsString,
  generateGenSettingsMenu,
  mergeGenerationSettings,
  sanitizeGenSettings,
  getCachedSessionGenSettings,
  setCachedSessionGenSettings,
} from '../lib/genSettings';
import { detectInChatCommand, generateHelpMenu } from '../lib/injections';
import { resolveWireModel, transformOpenAIToAntigravity } from '../lib/antigravity';

console.log('🧪 RUNNING COMPREHENSIVE GENERATION SETTINGS TEST SUITE\n');

// ==========================================
// 1. In-Chat Command Detection Tests
// ==========================================
console.log('Test 1: In-Chat Command Detection');
const viewCmds = ['<GENSETTINGS>', '<GEN_SETTINGS>', '<SETTINGS>', '<SAMPLING>', '/gensettings', '/sampling', '/settings'];
for (const cmd of viewCmds) {
  const detected = detectInChatCommand(cmd);
  assert.strictEqual(detected?.type, 'view_gen', `Expected view_gen for "${cmd}", got ${detected?.type}`);
}

const resetCmds = ['<RESET_SETTINGS>', '<RESET_GENSETTINGS>', '<RESET_GEN>', '/reset_settings'];
for (const cmd of resetCmds) {
  const detected = detectInChatCommand(cmd);
  assert.strictEqual(detected?.type, 'reset_gen', `Expected reset_gen for "${cmd}", got ${detected?.type}`);
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

// Ensure normal dialogue is NEVER intercepted
const normalTurns = [
  'Lily, what should we do next?',
  '*She looks down nervously* "I don\'t know..."',
  '123 < 456 is a basic comparison',
  'Can you help me?',
  '/home/user/path/is/valid'
];
for (const turn of normalTurns) {
  const detected = detectInChatCommand(turn);
  assert.strictEqual(detected, null, `Normal turn "${turn}" was incorrectly intercepted as a command!`);
}
console.log('✅ In-Chat Command Detection passed.\n');

// ==========================================
// 2. <SET: ...> Parser Robustness Tests
// ==========================================
console.log('Test 2: <SET: ...> Parser Robustness');

// Standard comma-separated
const p1 = parseGenerationSettingsString('min_p=0.08, top_k=50, temp=1.1, thinking=off');
assert.strictEqual(p1.settings.min_p, 0.08);
assert.strictEqual(p1.settings.top_k, 50);
assert.strictEqual(p1.settings.temperature, 1.1);
assert.strictEqual(p1.settings.thinking_budget, 0);
assert.strictEqual(p1.settings.reasoning_effort, 'off');

// Space-separated key-value pairs without commas
const p2 = parseGenerationSettingsString('min_p=0.08 top_k=50 temp=1.1 thinking=24k');
assert.strictEqual(p2.settings.min_p, 0.08);
assert.strictEqual(p2.settings.top_k, 50);
assert.strictEqual(p2.settings.temperature, 1.1);
assert.strictEqual(p2.settings.thinking_budget, 24576);
assert.strictEqual(p2.settings.reasoning_effort, 'high');

// Space instead of equals sign
const p3 = parseGenerationSettingsString('temp 0.95, min_p 0.05, top_k 45');
assert.strictEqual(p3.settings.temperature, 0.95);
assert.strictEqual(p3.settings.min_p, 0.05);
assert.strictEqual(p3.settings.top_k, 45);

// Aliases for penalties
const p4 = parseGenerationSettingsString('rep=1.15, rep_penalty=1.2, repeat=1.1, freq=0.25, pres=0.15');
assert.strictEqual(p4.settings.repetition_penalty, 1.1); // last one wins
assert.strictEqual(p4.settings.frequency_penalty, 0.25);
assert.strictEqual(p4.settings.presence_penalty, 0.15);

// Turning off penalties
const p5 = parseGenerationSettingsString('rep=off, freq=off, pres=off');
assert.strictEqual(p5.settings.repetition_penalty, 1.0);
assert.strictEqual(p5.settings.frequency_penalty, 0.0);
assert.strictEqual(p5.settings.presence_penalty, 0.0);

// Advanced samplers: top_a, typical_p, tfs, dynatemp, mirostat, seed
const p6 = parseGenerationSettingsString('top_a=0.15, typical_p=0.92, tfs=0.97, dynatemp_low=0.6, dynatemp_high=1.2, mirostat=2, tau=5.0, eta=0.1, seed=1337');
assert.strictEqual(p6.settings.top_a, 0.15);
assert.strictEqual(p6.settings.typical_p, 0.92);
assert.strictEqual(p6.settings.tfs, 0.97);
assert.strictEqual(p6.settings.dynatemp_low, 0.6);
assert.strictEqual(p6.settings.dynatemp_high, 1.2);
assert.strictEqual(p6.settings.mirostat, 2);
assert.strictEqual(p6.settings.mirostat_tau, 5.0);
assert.strictEqual(p6.settings.mirostat_eta, 0.1);
assert.strictEqual(p6.settings.seed, 1337);

// Nested angle brackets inside <SET: ...>
const nestedCmd = detectInChatCommand('<SET: prompt=<think>test reasoning</think>, temp=0.8>');
assert.ok(nestedCmd);
assert.strictEqual(nestedCmd.type, 'set_gen');
assert.strictEqual(nestedCmd.genSettings?.temperature, 0.8);
console.log('✅ <SET: ...> Parser Robustness passed.\n');

// ==========================================
// 3. Hierarchical Override Precedence Tests
// ==========================================
console.log('Test 3: Hierarchical Override Precedence');
const defaults = { ...DEFAULT_GENERATION_SETTINGS };
const globalSettings = { temperature: 0.8, min_p: 0.1, top_k: 60 };
const clientBody = { temperature: 0.9, max_tokens: 2000 };
const sessionOverrides = { temperature: 1.05, top_k: 35 };

const merged = mergeGenerationSettings(defaults, globalSettings, clientBody, sessionOverrides);
// temperature: session override (1.05) > client body (0.9) > global (0.8) > default (0.7)
assert.strictEqual(merged.temperature, 1.05);
// min_p: global (0.1) > default (0.05)
assert.strictEqual(merged.min_p, 0.1);
// max_tokens: client body (2000) > default (8192)
assert.strictEqual(merged.max_tokens, 2000);
// top_k: session override (35) > global (60) > default (40)
assert.strictEqual(merged.top_k, 35);
console.log('✅ Hierarchical Override Precedence passed.\n');

// ==========================================
// 4. Google Antigravity Wire Model Thinking Resolution
// ==========================================
console.log('Test 4: Google Antigravity Wire Model Thinking Resolution');

// 4a. Fast model: gemini-3.8-flash-fast MUST have thinkingBudget = 0 even if reasoning_effort = 'high'
const fastModel = resolveWireModel('gemini-3.8-flash-fast');
assert.strictEqual(fastModel?.defaultThinkingBudget, 0);
const wireFast = transformOpenAIToAntigravity(
  { model: 'gemini-3.8-flash-fast', reasoning_effort: 'high' },
  fastModel!,
  'proj-123'
);
assert.strictEqual(wireFast.request.generationConfig.thinkingConfig, undefined, 'Fast model must NOT have thinkingConfig!');

// 4b. Non-thinking model: gemini-3.5-flash MUST have thinkingBudget = 0
const nonThinkModel = resolveWireModel('gemini-3.5-flash');
assert.strictEqual(nonThinkModel?.defaultThinkingBudget, 0);
const wireNonThink = transformOpenAIToAntigravity(
  { model: 'gemini-3.5-flash', reasoning_effort: 'high' },
  nonThinkModel!,
  'proj-123'
);
assert.strictEqual(wireNonThink.request.generationConfig.thinkingConfig, undefined, 'gemini-3.5-flash must NOT have thinkingConfig!');

// 4c. Thinking model with <SET: thinking=off>
const thinkModel = resolveWireModel('gemini-3.7-flash');
const wireDisabled = transformOpenAIToAntigravity(
  { model: 'gemini-3.7-flash', reasoning_effort: 'off', thinking_budget: 0 },
  thinkModel!,
  'proj-123'
);
assert.strictEqual(wireDisabled.request.generationConfig.thinkingConfig, undefined, 'thinking=off must disable thinkingConfig!');

// 4d. Thinking model with explicit thinking budget
const wireCustomBudget = transformOpenAIToAntigravity(
  { model: 'gemini-3.7-flash', thinking_budget: 12000 },
  thinkModel!,
  'proj-123'
);
assert.strictEqual(wireCustomBudget.request.generationConfig.thinkingConfig?.thinkingBudget, 12000);

// 4e. Gemini 3.1 Pro Variants: Fast / No-Think / Low
const proFast = resolveWireModel('gemini-3.1-pro-fast');
assert.strictEqual(proFast?.wireModel, 'gemini-3.1-pro-preview');
assert.strictEqual(proFast?.defaultThinkingBudget, 0);
const wireProFast = transformOpenAIToAntigravity(
  { model: 'gemini-3.1-pro-fast', reasoning_effort: 'high' },
  proFast!,
  'proj-123'
);
assert.strictEqual(wireProFast.request.generationConfig.thinkingConfig, undefined, 'gemini-3.1-pro-fast must NOT have thinkingConfig!');

const proNoThink = resolveWireModel('gemini-3.1-pro-no-think');
assert.strictEqual(proNoThink?.wireModel, 'gemini-3.1-pro-preview');
assert.strictEqual(proNoThink?.defaultThinkingBudget, 0);

const proOff = resolveWireModel('gemini-3.1-pro:off');
assert.strictEqual(proOff?.wireModel, 'gemini-3.1-pro-preview');
assert.strictEqual(proOff?.defaultThinkingBudget, 0);

const proLow = resolveWireModel('gemini-3.1-pro-low');
assert.strictEqual(proLow?.wireModel, 'gemini-3.1-pro-preview');
assert.strictEqual(proLow?.defaultThinkingBudget, 2048);
const wireProLow = transformOpenAIToAntigravity(
  { model: 'gemini-3.1-pro-low' },
  proLow!,
  'proj-123'
);
assert.strictEqual(wireProLow.request.generationConfig.thinkingConfig?.thinkingBudget, 2048);

// 4f. Negative Cache Verification for 0ms Hot-Path TTFT
setCachedSessionGenSettings('chat-negative-test', null);
assert.strictEqual(getCachedSessionGenSettings('chat-negative-test'), null);
console.log('✅ Google Antigravity Wire Model Thinking Resolution passed.\n');

// ==========================================
// 5. Upstream Wire History Sanitization Tests
// ==========================================
console.log('Test 5: Upstream Wire History Sanitization');
const dirtyMessages = [
  { role: 'system', content: 'You are Lily, an elf.' },
  { role: 'user', content: 'Hello Lily!' },
  { role: 'assistant', content: '*smiles* "Greetings traveller."' },
  { role: 'user', content: '<GENSETTINGS>' },
  { role: 'assistant', content: '⚙️ [ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]\n• Temperature: 0.70' },
  { role: 'user', content: '<SET: min_p=0.05, temp=0.9>' },
  { role: 'assistant', content: '⚙️ [ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]\n✨ Updated: [min_p = 0.05, temp = 0.9]' },
  { role: 'user', content: '<HELP>' },
  { role: 'assistant', content: '📖 [ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]\n...' },
  { role: 'user', content: 'Shall we head towards the mountain?' }
];

const wirePayload = transformOpenAIToAntigravity(
  { model: 'gemini-3.7-flash', messages: dirtyMessages },
  thinkModel!,
  'proj-123'
);

const wireTurns = wirePayload.request.contents;
for (const turn of wireTurns) {
  const text = turn.parts[0]?.text || '';
  assert.ok(!text.includes('<GENSETTINGS>'), 'Past <GENSETTINGS> command leaked into wire history!');
  assert.ok(!text.includes('<SET:'), 'Past <SET: ...> command leaked into wire history!');
  assert.ok(!text.includes('<HELP>'), 'Past <HELP> command leaked into wire history!');
  assert.ok(!text.includes('[ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]'), 'Generation settings menu leaked into wire history!');
  assert.ok(!text.includes('[ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]'), 'Help guide leaked into wire history!');
}
console.log('✅ Upstream Wire History Sanitization passed.\n');

// ==========================================
// 6. Menu Generation & Defensive Fallback Tests
// ==========================================
console.log('Test 6: Menu Generation & Defensive Fallback');
// Should not throw even with completely empty or undefined object
const menu1 = generateGenSettingsMenu({});
assert.ok(menu1.includes('⚙️ [ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]'));
assert.ok(menu1.includes('• Temperature:          0.70'));

const menu2 = generateGenSettingsMenu({
  temperature: undefined,
  min_p: null as any,
  dynatemp_low: 0.5,
  dynatemp_high: 1.2,
  mirostat: 2,
  seed: 42
});
assert.ok(menu2.includes('• Temperature:          0.70'));
assert.ok(menu2.includes('• DynaTemp Range:       0.50 - 1.20'));
assert.ok(menu2.includes('• Mirostat Mode:        Mode 2'));
assert.ok(menu2.includes('• Generation Seed:      42'));

const helpMenu = generateHelpMenu();
assert.ok(helpMenu.includes('📖 [ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]'));
assert.ok(helpMenu.includes('<GENSETTINGS>'));
assert.ok(helpMenu.includes('<MYSETTINGS>'));
console.log('✅ Menu Generation & Defensive Fallback passed.\n');

// ==========================================
// 7. Sanitization Function Tests
// ==========================================
console.log('Test 7: sanitizeGenSettings Constraints');
const clamped = sanitizeGenSettings({
  temperature: 5.0,       // should clamp to 2.0
  max_tokens: 100000,     // should clamp to 65536
  top_p: 1.5,             // should clamp to 1.0
  top_k: 999,             // should clamp to 500
  min_p: -0.5,            // should clamp to 0.0
  repetition_penalty: 10, // should clamp to 3.0
  frequency_penalty: -5,  // should clamp to -2.0
});
assert.strictEqual(clamped.temperature, 2.0);
assert.strictEqual(clamped.max_tokens, 65536);
assert.strictEqual(clamped.top_p, 1.0);
assert.strictEqual(clamped.top_k, 500);
assert.strictEqual(clamped.min_p, 0.0);
assert.strictEqual(clamped.repetition_penalty, 3.0);
assert.strictEqual(clamped.frequency_penalty, -2.0);
console.log('✅ sanitizeGenSettings Constraints passed.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
