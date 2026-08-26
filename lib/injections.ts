import crypto from 'node:crypto';

export interface PromptInjection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  category: 'system_note' | 'ooc' | 'style' | 'custom';
  position: 'depth_0_user' | 'system_instruction';
  tokens: number;
  createdAt: number;
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
export async function getActiveInjectionsFormatted(): Promise<{
  userInjectionsText: string;
  systemInjectionsText: string;
  activeCount: number;
  totalTokens: number;
}> {
  const config = await getInjectionsConfig();
  if (!config.masterEnabled) {
    return { userInjectionsText: '', systemInjectionsText: '', activeCount: 0, totalTokens: 0 };
  }

  const active = (config.injections || []).filter(inj => inj && inj.enabled && inj.content?.trim());
  if (active.length === 0) {
    return { userInjectionsText: '', systemInjectionsText: '', activeCount: 0, totalTokens: 0 };
  }

  const userInjections: string[] = [];
  const systemInjections: string[] = [];
  let totalTokens = 0;

  for (const inj of active) {
    const trimmed = inj.content.trim();
    totalTokens += estimateTokens(trimmed);
    if (inj.position === 'system_instruction') {
      systemInjections.push(trimmed);
    } else {
      userInjections.push(trimmed);
    }
  }

  return {
    userInjectionsText: userInjections.join('\n\n'),
    systemInjectionsText: systemInjections.join('\n\n'),
    activeCount: active.length,
    totalTokens
  };
}
