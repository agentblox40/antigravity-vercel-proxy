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

const REDIS_KEY = 'antigravity:prompt_injections_v1';

export async function getInjectionsConfig(): Promise<InjectionsConfig> {
  try {
    const raw = await callRedis('GET', REDIS_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && Array.isArray(parsed.injections)) {
        // Ensure triggerMode exists on legacy items
        parsed.injections = parsed.injections.map((i: any) => ({
          triggerMode: 'always',
          ...i
        }));
        memoryInjectionsConfig = parsed;
        return parsed;
      }
    }
  } catch {}

  return memoryInjectionsConfig;
}

export async function saveInjectionsConfig(config: InjectionsConfig): Promise<void> {
  memoryInjectionsConfig = config;
  try {
    await callRedis('SET', REDIS_KEY, JSON.stringify(config));
  } catch {}
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
  type: 'view' | 'enable' | 'disable' | 'master_toggle';
  rawInput: string;
  targets?: string[];
  masterEnabled?: boolean;
}

export function detectInChatCommand(rawText: string): InChatCommand | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();

  // Pattern 1: View menu: <MYSETTINGS>, <SETTINGS>, /settings, <MY_SETTINGS>
  if (/^<(?:MYSETTINGS|SETTINGS|MY_SETTINGS|MY_CONFIG)>\s*$/i.test(trimmed) || /^\/settings\s*$/i.test(trimmed)) {
    return { type: 'view', rawInput: trimmed };
  }

  // Pattern 2: Master Switch toggle: <INJECTIONS: ON>, <INJECTIONS: OFF>, <INJECTIONS: PAUSE>, <INJECTIONS: RESUME>
  const masterMatch = /^<INJECTIONS\s*:\s*(ON|OFF|PAUSE|RESUME|ENABLE|DISABLE)>\s*$/i.exec(trimmed);
  if (masterMatch) {
    const val = masterMatch[1].toUpperCase();
    const enable = val === 'ON' || val === 'RESUME' || val === 'ENABLE';
    return { type: 'master_toggle', rawInput: trimmed, masterEnabled: enable };
  }

  // Pattern 3: Enable specific modules: <ENABLE: 1, 3, Slow Romance>, <ENABLED: ...>, <ACTIVATE: ...>
  const enableMatch = /^<(?:ENABLE|ENABLED|ACTIVATE)\s*:\s*([^>]+)>\s*$/i.exec(trimmed);
  if (enableMatch) {
    const targets = enableMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    return { type: 'enable', rawInput: trimmed, targets };
  }

  // Pattern 4: Disable specific modules: <DISABLE: 5, 6>, <DISABLED: ...>, <DEACTIVATE: ...>
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
  lines.push('• View menu:  <MYSETTINGS>');
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

  if (cmd.type === 'master_toggle') {
    const nextState = cmd.masterEnabled ?? !config.masterEnabled;
    config.masterEnabled = nextState;
    await saveInjectionsConfig(config);
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
      await saveInjectionsConfig(config);
      const actionWord = shouldEnable ? 'Enabled' : 'Disabled';
      const notice = `✨ Updated: ${actionWord} [${matchedTitles.join(', ')}].`;
      return generateSettingsMenu(config, notice);
    } else {
      const notice = `⚠️ No matching injection directives found for: "${targets.join(', ')}".`;
      return generateSettingsMenu(config, notice);
    }
  }

  return generateSettingsMenu(config);
}
