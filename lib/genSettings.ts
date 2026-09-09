import crypto from 'node:crypto';
import type { ChatSession } from './memory';
import { saveChatSession } from './memory';

export interface GenerationSettings {
  temperature?: number;          // 0.0 - 2.0 (default 0.7)
  max_tokens?: number;           // e.g. 8192 (1 - 65536)
  top_p?: number;                // 0.0 - 1.0 (default 0.95)
  top_k?: number;                // 0 - 500 (default 40)
  min_p?: number;                // 0.0 - 1.0 (default 0.05)
  min_k?: number;                // 0 - 500 (default 0)
  top_a?: number;                // 0.0 - 1.0 (default 0.0)
  typical_p?: number;            // 0.0 - 1.0 (default 1.0)
  tfs?: number;                  // 0.0 - 1.0 (default 1.0)
  repetition_penalty?: number;   // 0.1 - 3.0 (default 1.05)
  frequency_penalty?: number;    // -2.0 - 2.0 (default 0.0)
  presence_penalty?: number;     // -2.0 - 2.0 (default 0.0)
  thinking_budget?: number;      // 0 - 65536 (default 24576)
  reasoning_effort?: 'off' | 'low' | 'medium' | 'high' | 'max';
  dynatemp_low?: number;         // 0.0 - 2.0 (minimum temperature for dynamic temp)
  dynatemp_high?: number;        // 0.0 - 2.0 (maximum temperature for dynamic temp)
  mirostat?: number;             // 0 = disabled, 1 = Mirostat 1.0, 2 = Mirostat 2.0
  mirostat_tau?: number;         // Target entropy (default 5.0)
  mirostat_eta?: number;         // Learning rate (default 0.1)
  seed?: number;                 // Random seed (-1 for random)
}

export const DEFAULT_GENERATION_SETTINGS: Required<GenerationSettings> = {
  temperature: 0.7,
  max_tokens: 8192,
  top_p: 0.95,
  top_k: 40,
  min_p: 0.05,
  min_k: 0,
  top_a: 0.0,
  typical_p: 1.0,
  tfs: 1.0,
  repetition_penalty: 1.05,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
  thinking_budget: 24576,
  reasoning_effort: 'high',
  dynatemp_low: 0.0,
  dynatemp_high: 0.0,
  mirostat: 0,
  mirostat_tau: 5.0,
  mirostat_eta: 0.1,
  seed: -1,
};

// Upstash Redis helper
async function callRedis(command: string, ...args: (string | number)[]): Promise<any> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

const REDIS_KEY = 'antigravity:generation_settings_v1';
let memoryGenSettings: GenerationSettings = { ...DEFAULT_GENERATION_SETTINGS };
let lastSettingsFetch = 0;
const CONFIG_CACHE_TTL_MS = 30_000; // 30s cache for 0ms completion latency

// Global generation settings management
export async function getGlobalGenSettings(forceRefresh = false): Promise<GenerationSettings> {
  const now = Date.now();
  if (!forceRefresh && memoryGenSettings && (now - lastSettingsFetch < CONFIG_CACHE_TTL_MS)) {
    return memoryGenSettings;
  }

  try {
    const raw = await callRedis('GET', REDIS_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      memoryGenSettings = { ...DEFAULT_GENERATION_SETTINGS, ...parsed };
      lastSettingsFetch = now;
      return memoryGenSettings;
    }
  } catch (err) {
    console.warn('Failed to load generation settings from Redis, using memory cache:', err);
  }

  return memoryGenSettings || { ...DEFAULT_GENERATION_SETTINGS };
}

export function sanitizeGenSettings(settings: Partial<GenerationSettings>): Partial<GenerationSettings> {
  const clean: Partial<GenerationSettings> = {};
  if (typeof settings.temperature === 'number' && !isNaN(settings.temperature)) clean.temperature = Math.min(2.0, Math.max(0.0, settings.temperature));
  if (typeof settings.max_tokens === 'number' && !isNaN(settings.max_tokens) && settings.max_tokens > 0) clean.max_tokens = Math.min(65536, Math.max(1, Math.round(settings.max_tokens)));
  if (typeof settings.top_p === 'number' && !isNaN(settings.top_p)) clean.top_p = Math.min(1.0, Math.max(0.01, settings.top_p));
  if (typeof settings.top_k === 'number' && !isNaN(settings.top_k)) clean.top_k = Math.min(500, Math.max(0, Math.round(settings.top_k)));
  if (typeof settings.min_p === 'number' && !isNaN(settings.min_p)) clean.min_p = Math.min(1.0, Math.max(0.0, settings.min_p));
  if (typeof settings.min_k === 'number' && !isNaN(settings.min_k)) clean.min_k = Math.min(500, Math.max(0, Math.round(settings.min_k)));
  if (typeof settings.top_a === 'number' && !isNaN(settings.top_a)) clean.top_a = Math.min(1.0, Math.max(0.0, settings.top_a));
  if (typeof settings.typical_p === 'number' && !isNaN(settings.typical_p)) clean.typical_p = Math.min(1.0, Math.max(0.0, settings.typical_p));
  if (typeof settings.tfs === 'number' && !isNaN(settings.tfs)) clean.tfs = Math.min(1.0, Math.max(0.0, settings.tfs));
  if (typeof settings.repetition_penalty === 'number' && !isNaN(settings.repetition_penalty)) clean.repetition_penalty = Math.min(3.0, Math.max(0.1, settings.repetition_penalty));
  if (typeof settings.frequency_penalty === 'number' && !isNaN(settings.frequency_penalty)) clean.frequency_penalty = Math.min(2.0, Math.max(-2.0, settings.frequency_penalty));
  if (typeof settings.presence_penalty === 'number' && !isNaN(settings.presence_penalty)) clean.presence_penalty = Math.min(2.0, Math.max(-2.0, settings.presence_penalty));
  if (typeof settings.thinking_budget === 'number' && !isNaN(settings.thinking_budget)) clean.thinking_budget = Math.min(65536, Math.max(0, Math.round(settings.thinking_budget)));
  if (settings.reasoning_effort && ['off', 'low', 'medium', 'high', 'max'].includes(settings.reasoning_effort)) clean.reasoning_effort = settings.reasoning_effort;
  if (typeof settings.dynatemp_low === 'number' && !isNaN(settings.dynatemp_low)) clean.dynatemp_low = Math.min(2.0, Math.max(0.0, settings.dynatemp_low));
  if (typeof settings.dynatemp_high === 'number' && !isNaN(settings.dynatemp_high)) clean.dynatemp_high = Math.min(2.0, Math.max(0.0, settings.dynatemp_high));
  if (typeof settings.mirostat === 'number' && !isNaN(settings.mirostat)) clean.mirostat = Math.min(2, Math.max(0, Math.round(settings.mirostat)));
  if (typeof settings.mirostat_tau === 'number' && !isNaN(settings.mirostat_tau)) clean.mirostat_tau = Math.max(0.0, settings.mirostat_tau);
  if (typeof settings.mirostat_eta === 'number' && !isNaN(settings.mirostat_eta)) clean.mirostat_eta = Math.max(0.0, settings.mirostat_eta);
  if (typeof settings.seed === 'number' && !isNaN(settings.seed)) clean.seed = Math.round(settings.seed);
  return clean;
}

export async function saveGlobalGenSettings(settings: GenerationSettings): Promise<void> {
  const sanitized = sanitizeGenSettings(settings);
  memoryGenSettings = { ...DEFAULT_GENERATION_SETTINGS, ...sanitized };
  lastSettingsFetch = Date.now();

  try {
    await callRedis('SET', REDIS_KEY, JSON.stringify(memoryGenSettings));
  } catch (err) {
    console.warn('Failed to persist generation settings to Redis:', err);
  }
}

export async function resetGlobalGenSettings(): Promise<GenerationSettings> {
  memoryGenSettings = { ...DEFAULT_GENERATION_SETTINGS };
  lastSettingsFetch = Date.now();

  try {
    await callRedis('SET', REDIS_KEY, JSON.stringify(memoryGenSettings));
  } catch (err) {
    console.warn('Failed to reset generation settings in Redis:', err);
  }

  return memoryGenSettings;
}

// Session-level in-memory cache for instantaneous 0ms turn lookups (caches null for negative lookups)
const sessionSettingsCache = new Map<string, Partial<GenerationSettings> | null>();

export function getCachedSessionGenSettings(chatId: string): Partial<GenerationSettings> | null | undefined {
  return sessionSettingsCache.get(chatId);
}

export function setCachedSessionGenSettings(chatId: string, settings: Partial<GenerationSettings> | null) {
  sessionSettingsCache.set(chatId, settings);
}

export function clearCachedSessionGenSettings(chatId: string) {
  sessionSettingsCache.delete(chatId);
}

// Robust parsing of key-value parameters from <SET: ...> commands
export function parseGenerationSettingsString(input: string): { settings: Partial<GenerationSettings>; parsedSummary: string[] } {
  const result: Partial<GenerationSettings> = {};
  const parsedSummary: string[] = [];

  // Split by comma, semicolon, newline, or whitespace preceding a recognized key=value boundary
  const pairs = input.split(/(?:[,;\n]|\s+(?=[a-zA-Z0-9_\-]+\s*[=:\s]))/).map(p => p.trim()).filter(Boolean);

  for (const pair of pairs) {
    let rawKey = '';
    let rawVal = '';

    const eqIdx = pair.search(/[=:]/);
    if (eqIdx !== -1) {
      rawKey = pair.slice(0, eqIdx).trim().toLowerCase().replace(/[-_]/g, '');
      rawVal = pair.slice(eqIdx + 1).trim().toLowerCase();
    } else {
      const spaceIdx = pair.search(/\s+/);
      if (spaceIdx !== -1) {
        rawKey = pair.slice(0, spaceIdx).trim().toLowerCase().replace(/[-_]/g, '');
        rawVal = pair.slice(spaceIdx + 1).trim().toLowerCase();
      } else {
        continue;
      }
    }

    if (rawKey === 'minp') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 1) {
        result.min_p = val;
        parsedSummary.push(`min_p = ${val}`);
      }
    } else if (rawKey === 'mink') {
      const val = parseInt(rawVal, 10);
      if (!isNaN(val) && val >= 0 && val <= 500) {
        result.min_k = val;
        parsedSummary.push(`min_k = ${val}`);
      }
    } else if (rawKey === 'topp') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val > 0 && val <= 1) {
        result.top_p = val;
        parsedSummary.push(`top_p = ${val}`);
      }
    } else if (rawKey === 'topk') {
      const val = parseInt(rawVal, 10);
      if (!isNaN(val) && val >= 0 && val <= 500) {
        result.top_k = val;
        parsedSummary.push(`top_k = ${val}`);
      }
    } else if (rawKey === 'topa') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 1) {
        result.top_a = val;
        parsedSummary.push(`top_a = ${val}`);
      }
    } else if (rawKey === 'typicalp' || rawKey === 'typical') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 1) {
        result.typical_p = val;
        parsedSummary.push(`typical_p = ${val}`);
      }
    } else if (rawKey === 'tfs' || rawKey === 'tailfreesampling' || rawKey === 'tfsz') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 1) {
        result.tfs = val;
        parsedSummary.push(`tfs = ${val}`);
      }
    } else if (rawKey === 'temp' || rawKey === 'temperature') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 2) {
        result.temperature = val;
        parsedSummary.push(`temperature = ${val}`);
      }
    } else if (
      rawKey === 'reppenalty' ||
      rawKey === 'repetitionpenalty' ||
      rawKey === 'repeatpenalty' ||
      rawKey === 'repeat' ||
      rawKey === 'reppen' ||
      rawKey === 'rep' ||
      rawKey === 'repetition'
    ) {
      if (rawVal === 'off' || rawVal === 'none' || rawVal === '1' || rawVal === '1.0') {
        result.repetition_penalty = 1.0;
        parsedSummary.push('repetition_penalty = 1.0 (off)');
      } else {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= 0.1 && val <= 3) {
          result.repetition_penalty = val;
          parsedSummary.push(`repetition_penalty = ${val}`);
        }
      }
    } else if (
      rawKey === 'freqpenalty' ||
      rawKey === 'frequencypenalty' ||
      rawKey === 'freqpen' ||
      rawKey === 'freq' ||
      rawKey === 'frequency'
    ) {
      if (rawVal === 'off' || rawVal === 'none') {
        result.frequency_penalty = 0.0;
        parsedSummary.push('frequency_penalty = 0.0 (off)');
      } else {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= -2 && val <= 2) {
          result.frequency_penalty = val;
          parsedSummary.push(`frequency_penalty = ${val}`);
        }
      }
    } else if (
      rawKey === 'prespenalty' ||
      rawKey === 'presencepenalty' ||
      rawKey === 'prespen' ||
      rawKey === 'pres' ||
      rawKey === 'presence'
    ) {
      if (rawVal === 'off' || rawVal === 'none') {
        result.presence_penalty = 0.0;
        parsedSummary.push('presence_penalty = 0.0 (off)');
      } else {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= -2 && val <= 2) {
          result.presence_penalty = val;
          parsedSummary.push(`presence_penalty = ${val}`);
        }
      }
    } else if (rawKey === 'maxtokens' || rawKey === 'tokens' || rawKey === 'maxoutputtokens' || rawKey === 'length') {
      let num = parseInt(rawVal, 10);
      if (rawVal.endsWith('k')) {
        num = Math.round(parseFloat(rawVal.replace('k', '')) * 1024);
      }
      if (!isNaN(num) && num > 0) {
        result.max_tokens = num;
        parsedSummary.push(`max_tokens = ${num.toLocaleString()}`);
      }
    } else if (rawKey === 'thinking' || rawKey === 'thinkingbudget' || rawKey === 'budget' || rawKey === 'cot') {
      if (rawVal === 'off' || rawVal === 'none' || rawVal === '0' || rawVal === '0k' || rawVal === 'disabled') {
        result.thinking_budget = 0;
        result.reasoning_effort = 'off';
        parsedSummary.push('thinking = 0 (off)');
      } else if (rawVal === 'low' || rawVal === '2k' || rawVal === '2048') {
        result.thinking_budget = 2048;
        result.reasoning_effort = 'low';
        parsedSummary.push('thinking = 2,048 (low)');
      } else if (rawVal === 'medium' || rawVal === 'med' || rawVal === '8k' || rawVal === '8192') {
        result.thinking_budget = 8192;
        result.reasoning_effort = 'medium';
        parsedSummary.push('thinking = 8,192 (medium)');
      } else if (rawVal === 'high' || rawVal === '24k' || rawVal === '24576') {
        result.thinking_budget = 24576;
        result.reasoning_effort = 'high';
        parsedSummary.push('thinking = 24,576 (high)');
      } else if (rawVal === 'max' || rawVal === '64k' || rawVal === '65536') {
        result.thinking_budget = 65536;
        result.reasoning_effort = 'max';
        parsedSummary.push('thinking = 65,536 (max)');
      } else {
        let num = parseInt(rawVal, 10);
        if (rawVal.endsWith('k')) {
          num = Math.round(parseFloat(rawVal.replace('k', '')) * 1024);
        }
        if (!isNaN(num) && num >= 0) {
          result.thinking_budget = num;
          result.reasoning_effort = num === 0 ? 'off' : (num <= 2048 ? 'low' : (num <= 8192 ? 'medium' : (num <= 24576 ? 'high' : 'max')));
          parsedSummary.push(`thinking = ${num.toLocaleString()}`);
        }
      }
    } else if (rawKey === 'reasoning' || rawKey === 'reasoningeffort') {
      const normVal = rawVal === 'none' ? 'off' : rawVal;
      if (['off', 'low', 'medium', 'high', 'max'].includes(normVal)) {
        result.reasoning_effort = normVal as any;
        const budgetMap: Record<string, number> = { off: 0, low: 2048, medium: 8192, high: 24576, max: 65536 };
        result.thinking_budget = budgetMap[normVal];
        parsedSummary.push(`reasoning_effort = ${normVal} (${budgetMap[normVal].toLocaleString()} tok)`);
      }
    } else if (rawKey === 'dynatemplow' || rawKey === 'mintemp') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 2) {
        result.dynatemp_low = val;
        parsedSummary.push(`dynatemp_low = ${val}`);
      }
    } else if (rawKey === 'dynatemphigh' || rawKey === 'maxtemp') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0 && val <= 2) {
        result.dynatemp_high = val;
        parsedSummary.push(`dynatemp_high = ${val}`);
      }
    } else if (rawKey === 'mirostat') {
      const val = parseInt(rawVal, 10);
      if (!isNaN(val) && val >= 0 && val <= 2) {
        result.mirostat = val;
        parsedSummary.push(`mirostat = ${val}`);
      }
    } else if (rawKey === 'mirostattau' || rawKey === 'tau') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0) {
        result.mirostat_tau = val;
        parsedSummary.push(`mirostat_tau = ${val}`);
      }
    } else if (rawKey === 'mirostateta' || rawKey === 'eta') {
      const val = parseFloat(rawVal);
      if (!isNaN(val) && val >= 0) {
        result.mirostat_eta = val;
        parsedSummary.push(`mirostat_eta = ${val}`);
      }
    } else if (rawKey === 'seed') {
      const val = parseInt(rawVal, 10);
      if (!isNaN(val)) {
        result.seed = val;
        parsedSummary.push(`seed = ${val}`);
      }
    }
  }

  return { settings: result, parsedSummary };
}

// Generate the visual Generation Settings Menu for Janitor AI / roleplay chats
export function generateGenSettingsMenu(currentSettings: GenerationSettings, notice?: string): string {
  // Defensive normalization to protect against undefined or missing properties
  const s: Required<GenerationSettings> = {
    temperature: typeof currentSettings.temperature === 'number' ? currentSettings.temperature : DEFAULT_GENERATION_SETTINGS.temperature,
    max_tokens: typeof currentSettings.max_tokens === 'number' ? currentSettings.max_tokens : DEFAULT_GENERATION_SETTINGS.max_tokens,
    top_p: typeof currentSettings.top_p === 'number' ? currentSettings.top_p : DEFAULT_GENERATION_SETTINGS.top_p,
    top_k: typeof currentSettings.top_k === 'number' ? currentSettings.top_k : DEFAULT_GENERATION_SETTINGS.top_k,
    min_p: typeof currentSettings.min_p === 'number' ? currentSettings.min_p : DEFAULT_GENERATION_SETTINGS.min_p,
    min_k: typeof currentSettings.min_k === 'number' ? currentSettings.min_k : DEFAULT_GENERATION_SETTINGS.min_k,
    top_a: typeof currentSettings.top_a === 'number' ? currentSettings.top_a : DEFAULT_GENERATION_SETTINGS.top_a,
    typical_p: typeof currentSettings.typical_p === 'number' ? currentSettings.typical_p : DEFAULT_GENERATION_SETTINGS.typical_p,
    tfs: typeof currentSettings.tfs === 'number' ? currentSettings.tfs : DEFAULT_GENERATION_SETTINGS.tfs,
    repetition_penalty: typeof currentSettings.repetition_penalty === 'number' ? currentSettings.repetition_penalty : DEFAULT_GENERATION_SETTINGS.repetition_penalty,
    frequency_penalty: typeof currentSettings.frequency_penalty === 'number' ? currentSettings.frequency_penalty : DEFAULT_GENERATION_SETTINGS.frequency_penalty,
    presence_penalty: typeof currentSettings.presence_penalty === 'number' ? currentSettings.presence_penalty : DEFAULT_GENERATION_SETTINGS.presence_penalty,
    thinking_budget: typeof currentSettings.thinking_budget === 'number' ? currentSettings.thinking_budget : DEFAULT_GENERATION_SETTINGS.thinking_budget,
    reasoning_effort: currentSettings.reasoning_effort || DEFAULT_GENERATION_SETTINGS.reasoning_effort,
    dynatemp_low: typeof currentSettings.dynatemp_low === 'number' ? currentSettings.dynatemp_low : DEFAULT_GENERATION_SETTINGS.dynatemp_low,
    dynatemp_high: typeof currentSettings.dynatemp_high === 'number' ? currentSettings.dynatemp_high : DEFAULT_GENERATION_SETTINGS.dynatemp_high,
    mirostat: typeof currentSettings.mirostat === 'number' ? currentSettings.mirostat : DEFAULT_GENERATION_SETTINGS.mirostat,
    mirostat_tau: typeof currentSettings.mirostat_tau === 'number' ? currentSettings.mirostat_tau : DEFAULT_GENERATION_SETTINGS.mirostat_tau,
    mirostat_eta: typeof currentSettings.mirostat_eta === 'number' ? currentSettings.mirostat_eta : DEFAULT_GENERATION_SETTINGS.mirostat_eta,
    seed: typeof currentSettings.seed === 'number' ? currentSettings.seed : DEFAULT_GENERATION_SETTINGS.seed,
  };

  const lines: string[] = [];
  lines.push('⚙️ [ANTIGRAVITY ROLEPLAY GENERATION SETTINGS]');
  if (notice) {
    lines.push(`\n${notice}\n`);
  } else {
    lines.push('');
  }

  const thinkingLabel = s.thinking_budget === 0 ? 'Disabled (0 tok) [off]' : `${s.thinking_budget.toLocaleString()} tokens [${s.reasoning_effort || 'custom'}]`;

  lines.push('[SESSION PARAMETERS & SAMPLING STATUS]:');
  lines.push(`• Temperature:          ${s.temperature.toFixed(2)}  (Creativity & variance)`);
  lines.push(`• Min-P Sampling:       ${s.min_p.toFixed(2)}  (Dynamic probability floor cutoff)`);
  lines.push(`• Top-P (Nucleus):      ${s.top_p.toFixed(2)}  (Candidate mass distribution)`);
  lines.push(`• Top-K Filtering:      ${s.top_k.toString().padEnd(4, ' ')}  (Candidate token pool size)`);
  lines.push(`• Min-K Sampling:       ${s.min_k.toString().padEnd(4, ' ')}  (Minimum token pool guarantee)`);
  lines.push(`• Top-A Sampling:       ${s.top_a.toFixed(2)}  (Relative probability threshold)`);
  lines.push(`• Typical-P Sampling:   ${s.typical_p.toFixed(2)}  (Locally typical information density)`);
  lines.push(`• Tail-Free (TFS):      ${s.tfs.toFixed(2)}  (Second-derivative curvature)`);
  lines.push(`• Repetition Penalty:   ${s.repetition_penalty.toFixed(2)}  (Discourages loop phrases)`);
  lines.push(`• Frequency Penalty:    ${s.frequency_penalty.toFixed(2)}  (Penalizes repeated tokens)`);
  lines.push(`• Presence Penalty:     ${s.presence_penalty.toFixed(2)}  (Encourages new subject intro)`);
  lines.push(`• Max Output Tokens:    ${s.max_tokens.toLocaleString()} tokens (Response length ceiling)`);
  lines.push(`• Thinking Budget:      ${thinkingLabel} (CoT reasoning depth)`);

  if (s.dynatemp_high > 0) {
    lines.push(`• DynaTemp Range:       ${s.dynatemp_low.toFixed(2)} - ${s.dynatemp_high.toFixed(2)} (Dynamic temperature)`);
  }
  if (s.mirostat > 0) {
    lines.push(`• Mirostat Mode:        Mode ${s.mirostat} (tau=${s.mirostat_tau.toFixed(1)}, eta=${s.mirostat_eta.toFixed(2)})`);
  }
  if (s.seed >= 0) {
    lines.push(`• Generation Seed:      ${s.seed} (Deterministic RNG)`);
  }

  lines.push('\n────────────────────────────────────────');
  lines.push('💡 In-Chat Configuration Commands:');
  lines.push('• Update values:  <SET: min_p=0.05, top_k=40, temp=0.9>');
  lines.push('• Set thinking:   <SET: thinking=off> or <SET: thinking=24k>');
  lines.push('• Set penalties:  <SET: rep_penalty=1.1, freq_penalty=0.2>');
  lines.push('• Advanced:       <SET: top_a=0.1, typical_p=0.95, tfs=0.98>');
  lines.push('• Reset defaults: <RESET_SETTINGS>');
  lines.push('• Injections menu: <MYSETTINGS>');
  lines.push('• All commands:   <HELP>');
  lines.push('────────────────────────────────────────');
  lines.push('✨ To continue your roleplay, simply send your character dialogue normally!');

  return lines.join('\n');
}

// Execute Generation Settings in-chat commands
export async function executeGenSettingsCommand(
  cmd: { type: string; genSettings?: Partial<GenerationSettings>; setNotice?: string },
  session?: ChatSession | null
): Promise<string> {
  const globalConfig = await getGlobalGenSettings();
  let currentSettings: GenerationSettings = { ...globalConfig, ...(session?.generationSettings || {}) };

  if (cmd.type === 'view_gen') {
    return generateGenSettingsMenu(currentSettings);
  }

  if (cmd.type === 'reset_gen') {
    if (session) {
      session.generationSettings = undefined;
      await saveChatSession(session);
      clearCachedSessionGenSettings(session.id);
    }
    const notice = '✨ Reset: All generation sampling parameters for this chat session have been restored to defaults.';
    return generateGenSettingsMenu(globalConfig, notice);
  }

  if (cmd.type === 'set_gen') {
    if (!cmd.genSettings || Object.keys(cmd.genSettings).length === 0) {
      const notice = '⚠️ No valid generation parameters detected. Example: <SET: min_p=0.05, top_k=40, temp=0.9>';
      return generateGenSettingsMenu(currentSettings, notice);
    }

    if (session) {
      session.generationSettings = {
        ...(session.generationSettings || {}),
        ...cmd.genSettings,
      };
      await saveChatSession(session);
      setCachedSessionGenSettings(session.id, session.generationSettings);
      currentSettings = { ...globalConfig, ...session.generationSettings };
    } else {
      currentSettings = { ...currentSettings, ...cmd.genSettings };
    }

    const notice = `✨ Updated: [${(cmd.setNotice || Object.keys(cmd.genSettings).join(', '))}]. Applied to current chat session.`;
    return generateGenSettingsMenu(currentSettings, notice);
  }

  return generateGenSettingsMenu(currentSettings);
}

// Merge settings hierarchy: Defaults -> Global -> Client Body -> Session Overrides
export function mergeGenerationSettings(
  defaults: Required<GenerationSettings>,
  globalSettings: GenerationSettings,
  clientBody: any,
  sessionOverrides?: Partial<GenerationSettings>
): Required<GenerationSettings> {
  const merged: Required<GenerationSettings> = { ...defaults };

  // 1. Apply global settings
  for (const [key, val] of Object.entries(globalSettings)) {
    if (val !== undefined && val !== null) {
      (merged as any)[key] = val;
    }
  }

  // 2. Apply client body parameters (if provided by Janitor AI or API client)
  if (typeof clientBody.temperature === 'number') merged.temperature = clientBody.temperature;
  if (typeof clientBody.max_tokens === 'number' && clientBody.max_tokens > 0) merged.max_tokens = clientBody.max_tokens;
  if (typeof clientBody.max_completion_tokens === 'number' && clientBody.max_completion_tokens > 0) merged.max_tokens = clientBody.max_completion_tokens;
  if (typeof clientBody.top_p === 'number') merged.top_p = clientBody.top_p;
  if (typeof clientBody.top_k === 'number') merged.top_k = clientBody.top_k;
  if (typeof clientBody.min_p === 'number') merged.min_p = clientBody.min_p;
  if (typeof clientBody.min_k === 'number') merged.min_k = clientBody.min_k;
  if (typeof clientBody.top_a === 'number') merged.top_a = clientBody.top_a;
  if (typeof clientBody.typical_p === 'number') merged.typical_p = clientBody.typical_p;
  if (typeof clientBody.tfs === 'number') merged.tfs = clientBody.tfs;
  if (typeof clientBody.tail_free_sampling === 'number') merged.tfs = clientBody.tail_free_sampling;
  if (typeof clientBody.repetition_penalty === 'number') merged.repetition_penalty = clientBody.repetition_penalty;
  if (typeof clientBody.frequency_penalty === 'number') merged.frequency_penalty = clientBody.frequency_penalty;
  if (typeof clientBody.presence_penalty === 'number') merged.presence_penalty = clientBody.presence_penalty;
  if (typeof clientBody.thinking_budget === 'number') merged.thinking_budget = clientBody.thinking_budget;
  if (typeof clientBody.reasoning_effort === 'string' && ['off', 'low', 'medium', 'high', 'max'].includes(clientBody.reasoning_effort)) {
    merged.reasoning_effort = clientBody.reasoning_effort as any;
  }
  if (typeof clientBody.dynatemp_low === 'number') merged.dynatemp_low = clientBody.dynatemp_low;
  if (typeof clientBody.dynatemp_high === 'number') merged.dynatemp_high = clientBody.dynatemp_high;
  if (typeof clientBody.mirostat === 'number') merged.mirostat = clientBody.mirostat;
  if (typeof clientBody.mirostat_tau === 'number') merged.mirostat_tau = clientBody.mirostat_tau;
  if (typeof clientBody.mirostat_eta === 'number') merged.mirostat_eta = clientBody.mirostat_eta;
  if (typeof clientBody.seed === 'number') merged.seed = clientBody.seed;

  // 3. Apply session overrides (explicit in-chat user updates have highest precedence)
  if (sessionOverrides) {
    for (const [key, val] of Object.entries(sessionOverrides)) {
      if (val !== undefined && val !== null) {
        (merged as any)[key] = val;
      }
    }
  }

  return merged;
}
