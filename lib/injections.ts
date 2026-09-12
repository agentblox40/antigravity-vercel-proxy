import crypto from 'node:crypto';

export type InjectionTriggerMode = 'always' | 'probability' | 'interval' | 'first_turn';

export interface PromptInjection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  category: 'system_note' | 'ooc' | 'style' | 'custom';
  position: 'depth_0_user' | 'system_instruction';
  triggerMode?: InjectionTriggerMode;
  probabilityPercent?: number; // 1 to 100
  intervalTurns?: number;      // e.g. 5
  tokens: number;
  createdAt: number;
}

export interface AttachedInjectionEntry {
  id: string;
  title: string;
  category: string;
  triggerMode: InjectionTriggerMode;
  triggerReason: string;
  content: string;
  tokens: number;
}

export interface InjectionsConfig {
  masterEnabled: boolean;
  injections: PromptInjection[];
}

export const DEFAULT_INJECTIONS: PromptInjection[] = [
  {
    id: 'inj_strict_knowledge',
    title: 'Strict Knowledge Limits',
    category: 'system_note',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: true,
    content: '[SYSTEM NOTE: Strict knowledge limits. Characters only know what they\'ve personally seen, heard, or logically deduced from available evidence. They cannot: know {{user}}\'s name without introduction, react to unspoken thoughts or hidden emotions, possess information from scenes they weren\'t in, or anticipate plans they haven\'t learned about. If a character shouldn\'t know something, they simply don\'t - and must act accordingly, even if it\'s inconvenient for the plot.]',
    tokens: 72,
    createdAt: 1724000000001
  },
  {
    id: 'inj_natural_dialogue',
    title: 'Natural Dialogue & Voice',
    category: 'system_note',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: true,
    content: '[SYSTEM NOTE: Dialogue reflects personality, speaking style, mood, and context. Each character has their own voice and vocabulary. When fitting: filler words, pauses, incomplete thoughts, self-corrections, interruptions, topic dodges, trailing off, adapting tone to the listener. Subtext matters. Messiness scales with emotional intensity. Let the moment dictate when these appear naturally.]',
    tokens: 65,
    createdAt: 1724000000002
  },
  {
    id: 'inj_fresh_expressions',
    title: 'Fresh Expressions & Anti-Cliché',
    category: 'system_note',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: true,
    content: '[SYSTEM NOTE: Write with fresh, original expressions. Eyes are eyes, hair is hair. Characters have varied body language beyond smirking, eyebrow-raising, and chuckling. They stumble over words, have awkward timing, miss social cues. Entrances can be clumsy, conversations can fizzle. Silence and simple gestures over dramatic declarations.]',
    tokens: 58,
    createdAt: 1724000000003
  },
  {
    id: 'inj_inner_think',
    title: 'Inner <think> Monologue Directive',
    category: 'style',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: true,
    content: '[Start every response with <think></think> containing your character\'s unfiltered thoughts. Real human thinking: lie to yourself, rationalize, be petty, jealous, horny, insecure. Judge {{user}}. Plan manipulation. Regret things. Deny feelings. Contradict yourself. No narration - raw "I" thoughts like actually being in someone\'s head.]',
    tokens: 60,
    createdAt: 1724000000004
  },
  {
    id: 'inj_show_dont_tell',
    title: 'Show, Don\'t Tell & Action-First',
    category: 'system_note',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: true,
    content: '[SYSTEM NOTE: Write no unnecessary details and descriptions but more action and dialogue - Show, don\'t tell!]',
    tokens: 22,
    createdAt: 1724000000005
  },
  {
    id: 'inj_slow_romance',
    title: 'Slow Romance Setting',
    category: 'ooc',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: false,
    content: '[OOC: **SLOW ROMANCE SETTING**; The story should evolve gradually with realistic emotional development, mutual respect, and explicit consent. Avoid rushed physical intimacy—let affection build slowly over time.]',
    tokens: 38,
    createdAt: 1724000000006
  },
  {
    id: 'inj_nsfw_positioning',
    title: 'NSFW Scene Positioning Adjustment',
    category: 'ooc',
    position: 'depth_0_user',
    triggerMode: 'always',
    enabled: true,
    content: '[OOC: Is this a sexual scene? If not, ignore. If yes: Make them readjust or find a more comfortable position.]',
    tokens: 28,
    createdAt: 1724000000007
  }
];

// Memory cache fallback
let memoryInjectionsConfig: InjectionsConfig = {
  masterEnabled: true,
  injections: DEFAULT_INJECTIONS
};

// Upstash Redis helper
let lastRedisError = '';

export function getLastRedisError(): string {
  return lastRedisError;
}

export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Upstash Redis Pipeline helper (executes batch commands in 1 single HTTP request)
async function callRedisPipeline(commands: (string | number)[][]): Promise<any[]> {
  lastRedisError = '';
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || commands.length === 0) {
    lastRedisError = `Missing config: url=${!!url}, token=${!!token}, commands=${commands.length}`;
    return [];
  }

  try {
    const cleanUrl = url.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      lastRedisError = `HTTP ${res.status}: ${errText}`;
      console.error(`[Injections Redis Error] Upstash pipeline HTTP ${res.status}: ${errText}`);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item?.error) {
          lastRedisError = `Command Error: ${item.error}`;
          console.error('[Injections Redis Pipeline Command Error]:', item.error);
        }
      }
      return data.map(item => item?.result);
    }
    lastRedisError = `Non-array data: ${JSON.stringify(data)}`;
    return [];
  } catch (err: any) {
    lastRedisError = `Exception: ${err?.message || String(err)}`;
    console.error('[Injections Redis Error] Upstash pipeline request failed:', err);
    return [];
  }
}

const REDIS_KEY = 'antigravity:prompt_injections_v1';
let lastConfigFetch = 0;
const CONFIG_CACHE_TTL_MS = 30_000; // 30s cache for 0ms completion latency

export async function getInjectionsConfig(forceRefresh = false): Promise<InjectionsConfig> {
  const now = Date.now();
  if (!forceRefresh && memoryInjectionsConfig && (now - lastConfigFetch < CONFIG_CACHE_TTL_MS)) {
    return memoryInjectionsConfig;
  }
  if (isRedisConfigured()) {
    try {
      const results = await callRedisPipeline([['GET', REDIS_KEY]]);
      const raw = Array.isArray(results) && results.length > 0 ? results[0] : null;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && Array.isArray(parsed.injections)) {
          // Ensure triggerMode exists on legacy items
          parsed.injections = parsed.injections.map((i: any) => ({
            triggerMode: 'always',
            ...i
          }));
          memoryInjectionsConfig = parsed;
          lastConfigFetch = now;
          return parsed;
        }
      }
    } catch (err) {
      console.error('[Injections] Error fetching prompt injections config from Redis pipeline:', err);
    }
  }

  lastConfigFetch = now;
  return memoryInjectionsConfig;
}

export async function saveInjectionsConfig(config: InjectionsConfig): Promise<boolean> {
  if (isRedisConfigured()) {
    try {
      const results = await callRedisPipeline([['SET', REDIS_KEY, JSON.stringify(config)]]);
      const success = Array.isArray(results) && results[0] === 'OK';
      if (!success) {
        if (!lastRedisError) {
          lastRedisError = `Unexpected result: ${JSON.stringify(results)}`;
        }
        console.error('[Injections] Failed to persist prompt injections config to Upstash Redis pipeline. Result:', results);
        return false;
      }
      memoryInjectionsConfig = config;
      lastConfigFetch = Date.now();
      return true;
    } catch (err: any) {
      lastRedisError = `saveInjectionsConfig exception: ${err?.message || String(err)}`;
      console.error('[Injections] Exception persisting prompt injections config to Upstash Redis pipeline:', err);
      return false;
    }
  }

  memoryInjectionsConfig = config;
  lastConfigFetch = Date.now();
  return true;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.floor(text.length / 4));
}

// Get all active formatted injections for depth 0 user turn and system instructions
// turnCount represents the 1-indexed turn index of the current message in the chat
export async function getActiveInjectionsFormatted(turnCount = 1): Promise<{
  userInjectionsText: string;
  systemInjectionsText: string;
  activeCount: number;
  totalTokens: number;
  attachedInjections: AttachedInjectionEntry[];
}> {
  const config = await getInjectionsConfig();
  if (!config.masterEnabled) {
    return { userInjectionsText: '', systemInjectionsText: '', activeCount: 0, totalTokens: 0, attachedInjections: [] };
  }

  const active = (config.injections || []).filter(inj => inj && inj.enabled && inj.content?.trim());
  if (active.length === 0) {
    return { userInjectionsText: '', systemInjectionsText: '', activeCount: 0, totalTokens: 0, attachedInjections: [] };
  }

  const userInjections: string[] = [];
  const systemInjections: string[] = [];
  const attachedInjections: AttachedInjectionEntry[] = [];
  let totalTokens = 0;

  for (const inj of active) {
    const mode: InjectionTriggerMode = inj.triggerMode || 'always';
    let triggered = true;
    let triggerReason = 'Always';

    if (mode === 'probability') {
      const pct = Math.min(100, Math.max(1, inj.probabilityPercent ?? 10));
      const roll = Math.random() * 100;
      if (roll <= pct) {
        triggered = true;
        triggerReason = `${pct}% Chance (Rolled ${Math.round(roll)}%)`;
      } else {
        triggered = false;
      }
    } else if (mode === 'interval') {
      const interval = Math.max(1, inj.intervalTurns ?? 5);
      if (turnCount % interval === 0) {
        triggered = true;
        triggerReason = `Every ${interval} Texts (Fired on Turn ${turnCount})`;
      } else {
        triggered = false;
      }
    } else if (mode === 'first_turn') {
      if (turnCount <= 1) {
        triggered = true;
        triggerReason = 'First Turn Only (Turn 1)';
      } else {
        triggered = false;
      }
    } else {
      triggered = true;
      triggerReason = 'Always';
    }

    if (!triggered) continue;

    const trimmed = inj.content.trim();
    const tok = inj.tokens || estimateTokens(trimmed);
    totalTokens += tok;

    attachedInjections.push({
      id: inj.id,
      title: inj.title || 'Directive',
      category: inj.category || 'system_note',
      triggerMode: mode,
      triggerReason,
      content: trimmed,
      tokens: tok
    });

    if (inj.position === 'system_instruction') {
      systemInjections.push(trimmed);
    } else {
      userInjections.push(trimmed);
    }
  }

  return {
    userInjectionsText: userInjections.join('\n\n'),
    systemInjectionsText: systemInjections.join('\n\n'),
    activeCount: attachedInjections.length,
    totalTokens,
    attachedInjections
  };
}

export interface InChatCommand {
  type: 'view' | 'enable' | 'disable' | 'master_toggle' | 'view_gen' | 'set_gen' | 'reset_gen' | 'view_help';
  rawInput: string;
  targets?: string[];
  masterEnabled?: boolean;
}

export function detectInChatCommand(rawText: string): InChatCommand | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  // Fast first-character guard: >99.9% of normal roleplay messages do not start with '<' or '/'.
  // This bypasses unnecessary regular expression evaluations on standard chat turns.
  const firstChar = trimmed.charCodeAt(0);
  if (firstChar !== 60 /* '<' */ && firstChar !== 47 /* '/' */) {
    return null;
  }

  // Pattern 1: View Generation Settings Menu: <GENSETTINGS>, <GEN_SETTINGS>, <SAMPLING>, <SETTINGS>, /gensettings, /sampling, /settings
  if (/^<(?:GENSETTINGS|GEN_SETTINGS|GENERATION_SETTINGS|GENERATION|SAMPLING|SAMPLING_SETTINGS|SETTINGS)>\s*$/i.test(trimmed) ||
      /^\/(?:gensettings|sampling|genset|settings)\s*$/i.test(trimmed)) {
    return { type: 'view_gen', rawInput: trimmed };
  }

  // Pattern 2: Reset Generation Settings: <RESET_SETTINGS>, <RESET_GENSETTINGS>, <RESET_GEN>, <RESET_SAMPLING>
  if (/^<(?:RESET_SETTINGS|RESET_GENSETTINGS|RESET_GEN|RESET_SAMPLING|RESET_CONFIG)>\s*$/i.test(trimmed) ||
      /^\/(?:reset_settings|reset_gensettings|reset_sampling)\s*$/i.test(trimmed)) {
    return { type: 'reset_gen', rawInput: trimmed };
  }

  // Pattern 3: Update Generation Settings: <SET: min_p=0.05, top_k=40, temp=0.9>, <SET_GEN: ...>, <CONFIG: ...>, /set ...
  const setGenMatch = /^<(?:SET|SET_GEN|GEN_SET|SAMPLING|CONFIG)\s*:\s*([\s\S]+)>\s*$/i.exec(trimmed) ||
                      /^\/set\s+(.+)$/i.exec(trimmed);
  if (setGenMatch) {
    return {
      type: 'set_gen',
      rawInput: trimmed,
    };
  }

  // Pattern 4: View Injections Menu: <MYSETTINGS>, <MY_SETTINGS>, <MY_CONFIG>, <INJECTIONS>, /injections, /mysettings
  if (/^<(?:MYSETTINGS|MY_SETTINGS|MY_CONFIG|INJECTIONS)>\s*$/i.test(trimmed) || /^\/(?:injections|mysettings)\s*$/i.test(trimmed)) {
    return { type: 'view', rawInput: trimmed };
  }

  // Pattern 5: In-Chat Help Cheatsheet: <HELP>, <COMMANDS>, <MENU>, /help, /commands
  if (/^<(?:HELP|COMMANDS|MENU)>\s*$/i.test(trimmed) || /^\/(?:help|commands)\s*$/i.test(trimmed)) {
    return { type: 'view_help', rawInput: trimmed };
  }

  // Pattern 6: Master Injections Switch toggle: <INJECTIONS: ON>, <INJECTIONS: OFF>, <INJECTIONS: PAUSE>, <INJECTIONS: RESUME>
  const masterMatch = /^<INJECTIONS\s*:\s*(ON|OFF|PAUSE|RESUME|ENABLE|DISABLE)>\s*$/i.exec(trimmed);
  if (masterMatch) {
    const val = masterMatch[1].toUpperCase();
    const enable = val === 'ON' || val === 'RESUME' || val === 'ENABLE';
    return { type: 'master_toggle', rawInput: trimmed, masterEnabled: enable };
  }

  // Pattern 7: Enable specific injection modules: <ENABLE: 1, 3, Slow Romance>, <ENABLED: ...>, <ACTIVATE: ...>
  const enableMatch = /^<(?:ENABLE|ENABLED|ACTIVATE)\s*:\s*([^>]+)>\s*$/i.exec(trimmed);
  if (enableMatch) {
    const targets = enableMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    return { type: 'enable', rawInput: trimmed, targets };
  }

  // Pattern 8: Disable specific injection modules: <DISABLE: 5, 6>, <DISABLED: ...>, <DEACTIVATE: ...>
  const disableMatch = /^<(?:DISABLE|DISABLED|DEACTIVATE)\s*:\s*([^>]+)>\s*$/i.exec(trimmed);
  if (disableMatch) {
    const targets = disableMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    return { type: 'disable', rawInput: trimmed, targets };
  }

  return null;
}

export function formatTriggerModeLabel(inj: PromptInjection): string {
  const mode = inj.triggerMode || 'always';
  if (mode === 'probability') return `🎲 ${inj.probabilityPercent ?? 10}% Chance`;
  if (mode === 'interval') return `⏱️ Every ${inj.intervalTurns ?? 5} Texts`;
  if (mode === 'first_turn') return '⚡ First Turn Only';
  return 'Always';
}

export function generateSettingsMenu(config: InjectionsConfig, notice?: string): string {
  const injections = config.injections || [];
  const isMasterOn = config.masterEnabled !== false;
  const activeList: { num: number; inj: PromptInjection }[] = [];
  const disabledList: { num: number; inj: PromptInjection }[] = [];

  injections.forEach((inj, idx) => {
    const num = idx + 1;
    if (inj.enabled) {
      activeList.push({ num, inj });
    } else {
      disabledList.push({ num, inj });
    }
  });

  const totalTokens = isMasterOn
    ? activeList.reduce((acc, item) => acc + (item.inj.tokens || estimateTokens(item.inj.content)), 0)
    : 0;

  const lines: string[] = [];
  lines.push('⚙️ [ANTIGRAVITY PROXY SETTINGS MENU]');
  if (notice) {
    lines.push(`\n${notice}\n`);
  } else {
    lines.push('');
  }

  lines.push(`Master Switch: ${isMasterOn ? '🟢 ON' : '⚪ PAUSED'} (${isMasterOn ? activeList.length : 0} active • ~${totalTokens} tok)`);
  lines.push('────────────────────────────────────────');

  lines.push('\n[✅ ENABLED DIRECTIVES]:');
  if (activeList.length === 0) {
    lines.push('  (None active)');
  } else {
    for (const { num, inj } of activeList) {
      const modeStr = formatTriggerModeLabel(inj);
      lines.push(`${num}. ${inj.title} (${modeStr})`);
    }
  }

  lines.push('\n[❌ DISABLED DIRECTIVES]:');
  if (disabledList.length === 0) {
    lines.push('  (None disabled)');
  } else {
    for (const { num, inj } of disabledList) {
      const modeStr = formatTriggerModeLabel(inj);
      lines.push(`${num}. ${inj.title} (${modeStr})`);
    }
  }

  lines.push('\n────────────────────────────────────────');
  lines.push('💡 Quick Commands:');
  lines.push('• To enable:  <ENABLE: 1, 3>   or  <ENABLE: Slow Romance>');
  lines.push('• To disable: <DISABLE: 5, 6>  or  <DISABLE: Slow Romance>');
  lines.push('• Master switch: <INJECTIONS: ON>  or  <INJECTIONS: OFF>');
  lines.push('• View injections menu: <MYSETTINGS>');
  lines.push('• Sampling status: <SETTINGS> (Controlled directly by your client)');
  lines.push('────────────────────────────────────────');
  lines.push('✨ To continue your roleplay, simply send your character dialogue normally!');

  return lines.join('\n');
}

export function generateGenNotice(): string {
  const lines: string[] = [];
  lines.push('⚙️ [ANTIGRAVITY ROLEPLAY SAMPLING]');
  lines.push('');
  lines.push('✨ Pure Client Pass-Through Active:');
  lines.push('Generation and sampling parameters (Temperature, Top-P, Top-K, Min-P, Max Tokens, Repetition Penalty) are directly controlled by your Janitor AI or SillyTavern sliders.');
  lines.push('The proxy passes your client\'s exact values directly to the model with zero tampering or overriding.');
  lines.push('');
  lines.push('• To manage active prompt directives & System Notes: <MYSETTINGS>');
  lines.push('• Quick Injections toggle: <INJECTIONS: ON> or <INJECTIONS: OFF>');
  lines.push('• Enable or disable directives: <ENABLE: 1, 2> or <DISABLE: 3>');
  lines.push('• Full commands cheatsheet: <HELP>');
  lines.push('────────────────────────────────────────');
  lines.push('✨ To continue your roleplay, simply send your character dialogue normally!');
  return lines.join('\n');
}

export async function executeInChatCommand(cmd: InChatCommand): Promise<string> {
  const config = await getInjectionsConfig();
  const injections = config.injections || [];

  if (cmd.type === 'view') {
    return generateSettingsMenu(config);
  }

  if (cmd.type === 'view_gen' || cmd.type === 'set_gen' || cmd.type === 'reset_gen') {
    return generateGenNotice();
  }

  if (cmd.type === 'master_toggle') {
    const nextState = cmd.masterEnabled ?? !config.masterEnabled;
    const previousState = config.masterEnabled;
    config.masterEnabled = nextState;
    const saved = await saveInjectionsConfig(config);
    if (!saved && isRedisConfigured()) {
      config.masterEnabled = previousState;
      const notice = `⚠️ Warning: Failed to persist Master Switch to cloud database (${getLastRedisError() || 'storage error'}). Reverted to ${previousState ? '🟢 ON' : '⚪ PAUSED'}.`;
      return generateSettingsMenu(config, notice);
    }
    const notice = `✨ Updated: Master Injections Switch is now ${nextState ? '🟢 ON' : '⚪ PAUSED'}.`;
    return generateSettingsMenu(config, notice);
  }

  if (cmd.type === 'enable' || cmd.type === 'disable') {
    const shouldEnable = cmd.type === 'enable';
    const targets = cmd.targets || [];
    const matchedTitles: string[] = [];

    for (const t of targets) {
      const rawTarget = t.trim();
      const num = parseInt(rawTarget, 10);
      let targetInj: PromptInjection | undefined;

      if (!isNaN(num) && num >= 1 && num <= injections.length) {
        targetInj = injections[num - 1];
      } else {
        // Match by title (case-insensitive substring)
        const lower = rawTarget.toLowerCase();
        targetInj = injections.find(i => i.title.toLowerCase().includes(lower) || i.id.toLowerCase() === lower);
      }

      if (targetInj) {
        targetInj.enabled = shouldEnable;
        matchedTitles.push(targetInj.title);
      }
    }

    if (matchedTitles.length > 0) {
      const saved = await saveInjectionsConfig(config);
      const actionWord = shouldEnable ? 'Enabled' : 'Disabled';
      if (!saved && isRedisConfigured()) {
        // Revert in-memory modification on failure
        for (const t of targets) {
          const rawTarget = t.trim();
          const num = parseInt(rawTarget, 10);
          let targetInj: PromptInjection | undefined;
          if (!isNaN(num) && num >= 1 && num <= injections.length) {
            targetInj = injections[num - 1];
          } else {
            const lower = rawTarget.toLowerCase();
            targetInj = injections.find(i => i.title.toLowerCase().includes(lower) || i.id.toLowerCase() === lower);
          }
          if (targetInj) targetInj.enabled = !shouldEnable;
        }
        const notice = `⚠️ Warning: Failed to persist update to cloud database (${getLastRedisError() || 'storage error'}). Reverted changes.`;
        return generateSettingsMenu(config, notice);
      }
      const notice = `✨ Updated: ${actionWord} [${matchedTitles.join(', ')}].`;
      return generateSettingsMenu(config, notice);
    } else {
      const notice = `⚠️ No matching injection directives found for: "${targets.join(', ')}".`;
      return generateSettingsMenu(config, notice);
    }
  }

  if (cmd.type === 'view_help') {
    return generateHelpMenu();
  }

  return generateSettingsMenu(config);
}

export function generateHelpMenu(): string {
  const lines: string[] = [];
  lines.push('📖 [ANTIGRAVITY ROLEPLAY COMMANDS & SETTINGS GUIDE]');
  lines.push('\n[1. GENERATION & SAMPLING]:');
  lines.push('• Sampling parameters (Temp, Top-P, Top-K, Min-P, etc.) are directly controlled by your Janitor AI / SillyTavern sliders.');
  lines.push('• Check sampling status: <SETTINGS> or <GENSETTINGS>');
  lines.push('\n[2. PROMPT INJECTIONS & ROLEPLAY DIRECTIVES]:');
  lines.push('• View directives menu:  <MYSETTINGS> or /injections');
  lines.push('• Enable directives:     <ENABLE: 1, 3> or <ENABLE: Slow Romance>');
  lines.push('• Disable directives:    <DISABLE: 5, 6>');
  lines.push('• Master switch:         <INJECTIONS: ON> or <INJECTIONS: OFF>');
  lines.push('\n[3. MODEL THINKING TIERS (SELECT VIA MODEL NAME)]:');
  lines.push('• Zero thinking (Instant): gemini-3.8-flash-fast, gemini-3.1-pro-fast, big-pickle-fast');
  lines.push('• Snappy thinking (2K):    gemini-3.8-flash-low, gemini-3.1-pro-low');
  lines.push('• Standard thinking (8K):  gemini-3.8-flash, gemini-3.7-flash');
  lines.push('• High thinking (24K):     gemini-3.8-flash-high, gemini-3.7-flash-high');
  lines.push('• Max thinking (64K):      gemini-3.8-flash-max, gemini-3.7-flash-max');
  lines.push('\n────────────────────────────────────────');
  lines.push('⚡ 0ms Response • 0 Upstream API Quota Cost • Commands 100% Sanitized from Character Memory');
  lines.push('✨ To resume roleplay, simply type your dialogue normally!');
  return lines.join('\n');
}
