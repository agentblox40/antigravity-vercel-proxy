import crypto from 'node:crypto';
import type { AttachedInjectionEntry } from './injections';
import type { GenerationSettings } from './genSettings';

export interface InjectedLoreEntry {
  title: string;
  category: 'lore' | 'world_info' | 'memory' | 'context' | 'system_block';
  content: string;
  tokens: number;
}

export interface ArchivedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
  timestamp: number;
  injectedLore?: InjectedLoreEntry[];
  attachedInjections?: AttachedInjectionEntry[];
}

export interface ChatSession {
  id: string;
  characterId: string;
  characterName: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  generationSettings?: Partial<GenerationSettings>;
  messages: ArchivedMessage[];
  messageCount: number;
}

export interface CharacterSummary {
  characterId: string;
  characterName: string;
  chatCount: number;
  lastActive: number;
}

export interface SessionOverview {
  id: string;
  characterId: string;
  characterName: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  estimatedTokens: number;
  lastMessagePreview: string;
  oocCount?: number;
}

// In-Memory Fallback Store
const memoryStore = new Map<string, ChatSession>();

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// Comprehensive English Stopwords and generic artifacts list
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must', 'and', 'or', 'not', 'but', 'if', 'then', 'else', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'too', 'very', 'just', 'now', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it',
  'its', 'they', 'them', 'their', 'theirs', 'we', 'us', 'our', 'ours', 'i', 'me', 'my', 'mine', 'who',
  'whom', 'whose', 'which', 'what', 'this', 'that', 'these', 'those', 'am', 'so', 'up', 'out', 'into',
  'over', 'after', 'beneath', 'under', 'above', 'below', 'between', 'through', 'during', 'before', 'without',
  'within', 'along', 'across', 'behind', 'beyond', 'around', 'about', 'near', 'off', 'down', 'ai', 'bot',
  'character', 'assistant', 'expert', 'uncensored', 'fictional', 'author', 'narrator', 'roleplay', 'player',
  'user', 'persona', 'model', 'system', 'scenario', 'appearance', 'personality', 'description', 'background',
  'overview', 'summary', 'definition', 'instructions', 'rules', 'setting', 'note', 'lore', 'memory', 'world',
  'nsfw', 'dialogue', 'speech', 'voice', 'context', 'interacting', 'playing', 'acting', 'unfiltered', 'thoughts',
  'palace', 'castle', 'kingdom', 'outside', 'inside', 'suddenly', 'meanwhile', 'somewhere', 'today', 'yesterday',
  'tomorrow', 'morning', 'afternoon', 'evening', 'night', 'room', 'chamber', 'hall', 'corridor', 'door', 'window'
]);

const ACTION_VERBS = new Set([
  'smiles', 'looks', 'walks', 'stands', 'turns', 'steps', 'gazes', 'pauses', 'sighs', 'nods', 'takes',
  'crosses', 'leans', 'watches', 'pulls', 'grins', 'frowns', 'glances', 'stares', 'reaches', 'draws',
  'speaks', 'whispers', 'laughs', 'sits', 'opens', 'closes', 'enters', 'stops', 'shivers', 'trembles',
  'cries', 'sobs', 'curls', 'blushes', 'hesitates', 'shifts', 'freezes', 'blinks', 'adjusts', 'hugs'
]);

export interface ExtractedUserInfo {
  userName: string;
  userPersona: string;
}

export function extractUserInfo(
  systemPrompt: string = '',
  messages?: any[],
  headers?: any
): ExtractedUserInfo {
  const cleanPrompt = systemPrompt ? systemPrompt.replace(/\r\n/g, '\n') : '';
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];

  // Helper for headers (supports Web API Headers, mock objects with .get, and plain Record objects)
  const getHeader = (key: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as any).get === 'function') {
      return (headers as any).get(key) || (headers as any).get(key.toLowerCase());
    }
    if (typeof headers === 'object') {
      const lowerKey = key.toLowerCase();
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lowerKey && typeof v === 'string') return v;
      }
    }
    return null;
  };

  let userName = (
    getHeader('x-user-name') ||
    getHeader('user-name') ||
    getHeader('x-user') ||
    getHeader('user') ||
    ''
  ).trim();

  let userPersona = '';

  // 1. Check explicit XML user tags in system prompt
  if (cleanPrompt) {
    const xmlPersonaMatch = cleanPrompt.match(/<user_persona(?:\s+name=["']([^"']+)["'])?>([\s\S]*?)<\/user_persona>/i);
    if (xmlPersonaMatch) {
      if (xmlPersonaMatch[1] && !userName) userName = xmlPersonaMatch[1].trim();
      if (xmlPersonaMatch[2]) userPersona = xmlPersonaMatch[2].trim();
    }
    if (!userPersona) {
      const xmlProfileMatch = cleanPrompt.match(/<(?:user_profile|user_description|user)>([\s\S]*?)<\/(?:user_profile|user_description|user)>/i);
      if (xmlProfileMatch && xmlProfileMatch[1]) {
        userPersona = xmlProfileMatch[1].trim();
      }
    }
    if (!userName) {
      const xmlNameMatch = cleanPrompt.match(/<user_name>([^<]+)<\/user_name>/i);
      if (xmlNameMatch && xmlNameMatch[1]) {
        userName = xmlNameMatch[1].trim();
      }
    }
  }

  // 2. Bracket and markdown patterns for user persona in prompt
  const sectionBoundaryLookahead = '(?=(?:\\n\\s*#{1,4}\\s+|\\n\\s*\\[(?:Character|Scenario|Appearance|Description|Setting|World|Personality|Traits|First Message|Greeting|Starter|Examples?|Rules?|System Instructions?|User)|\\n\\s*<(?:char|character|scenario|personality|traits|first_mes|greeting|starter|mes_example|example_dialogue|dialogue|system_prompt|system_directive|role_and_identity|guidelines|rules|jailbreak|user_persona|user)|$))';

  if (cleanPrompt && !userPersona) {
    const userPersonaPatterns = [
      /\[(?:User's Persona|User Persona|User Description|User Profile|User Definition|User Info)\s*:\s*([\s\S]*?)\]/i,
      /\[User\s*:\s*([\s\S]*?)\]/i,
      new RegExp(`(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:User(?:'s)?\\s*Persona|User(?:'s)?\\s*Description|User(?:'s)?\\s*Profile|User(?:'s)?\\s*Definition|{{user}}(?:'s)?\\s*Persona)(?::\\s*|\\s*\\n)\\s*([\\s\\S]*?)${sectionBoundaryLookahead}`, 'i'),
      new RegExp(`(?:^|\\n)\\s*(?:User persona|{{user}}'s persona)\\s*:\\s*([\\s\\S]*?)${sectionBoundaryLookahead}`, 'i'),
      new RegExp(`{{user}}'s persona:\\s*([\\s\\S]*?)${sectionBoundaryLookahead}`, 'i'),
    ];

    for (const p of userPersonaPatterns) {
      const match = cleanPrompt.match(p);
      if (match && match[1] && match[1].trim()) {
        userPersona = match[1].trim();
        break;
      }
    }
  }

  // 3. Extract user name from key-value or template declarations
  if (cleanPrompt && !userName) {
    const namePatterns = [
      /(?:^|\n)\s*(?:User's Name|User Name|{{user}}'s Name)\s*:\s*([^\n\r,\]]+)/i,
      /\{\{user\}\}\s*(?:=|:|is named|is)\s*(?:a\s+|an\s+|the\s+)?([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3})\b/i,
      /\[(?:User's Persona|User Persona|User)\s*:\s*([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3})\s*(?:[-:\n\r,]|\]|$)/i,
      /(?:^|\n)\s*(?:User|{{user}})\s*:\s*([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3})\b/i,
    ];
    for (const np of namePatterns) {
      const match = cleanPrompt.match(np);
      if (match && match[1] && match[1].trim()) {
        const candidate = match[1].trim();
        if (!STOP_WORDS.has(candidate.toLowerCase()) && !/^(?:user|user's|persona)$/i.test(candidate)) {
          userName = candidate;
          break;
        }
      }
    }
  }

  // 4. Extract user name from user message speaker prefix or actions
  if (!userName && safeMessages.length > 0) {
    for (const m of safeMessages) {
      if (m && m.role === 'user') {
        const text = typeof m.content === 'string'
          ? m.content.trim()
          : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n').trim() : '');
        if (!text) continue;

        // Speaker prefix: "Kars: ..." or "John Doe: ..."
        const spkMatch = text.match(/^([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3}):\s+/);
        if (spkMatch && spkMatch[1]) {
          const spk = spkMatch[1].trim();
          if (!STOP_WORDS.has(spk.toLowerCase()) && !/^(?:user|user's)$/i.test(spk)) {
            userName = spk;
            break;
          }
        }

        // Action prefix: "*Kars looks around...*" or "*John Doe draws weapon...*"
        const actMatch = text.match(/^\*([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3})\s+[a-z]+\b/);
        if (actMatch && actMatch[1]) {
          const act = actMatch[1].trim();
          if (!STOP_WORDS.has(act.toLowerCase()) && !/^(?:user|user's)$/i.test(act)) {
            userName = act;
            break;
          }
        }
      }
    }
  }

  // 5. If userPersona is present, check if it specifies a name
  if (userPersona && !userName) {
    const personaNameMatch = userPersona.match(/(?:^|\n)\s*(?:Name|Full Name)\s*:\s*([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3})\b/i);
    if (personaNameMatch && personaNameMatch[1]) {
      userName = personaNameMatch[1].trim();
    } else {
      const prefixMatch = userPersona.match(/^([A-Z][a-zA-Z0-9_\-']*(?:\s+[A-Z][a-zA-Z0-9_\-']*){0,3})\s*(?:[-:\n\r,]|is\b|was\b|a\b|an\b|the\b)/);
      if (prefixMatch && prefixMatch[1] && !STOP_WORDS.has(prefixMatch[1].toLowerCase()) && !/^(?:user|user's)$/i.test(prefixMatch[1])) {
        userName = prefixMatch[1].trim();
      }
    }
  }

  // 6. If userName was found (e.g. Kars) but userPersona is still empty, look for Kars's Persona in prompt
  if (userName && !userPersona && cleanPrompt) {
    const escaped = userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const specificRegex = new RegExp(
      `(?:^|\\n)\\s*(?:#{1,4}\\s*)?(?:${escaped}'s\\s+(?:Persona|Description|Appearance|Profile)|${escaped}\\s*:\\s*)(?::\\s*|\\s*\\n)\\s*([\\s\\S]*?)(?=(?:\\n\\s*#{1,4}|\\n\\s*\\[|$))`,
      'i'
    );
    const specMatch = cleanPrompt.match(specificRegex);
    if (specMatch && specMatch[1] && specMatch[1].trim()) {
      userPersona = specMatch[1].trim();
    }
  }

  // 7. Clean up userPersona if it's identical to userName
  if (userName && userPersona && userPersona.trim().toLowerCase() === userName.trim().toLowerCase()) {
    userPersona = '';
  }

  if (!userName) {
    userName = 'User';
  }

  return { userName, userPersona };
}

function isValidCharacterName(candidate: string, excludeName?: string): boolean {
  if (!candidate) return false;
  const clean = candidate.replace(/^[\[\(\*\"\'\s]+|[\]\)\*\"\'\s.,:;!?]+$/g, '').trim();
  if (clean.length < 2 || clean.length > 50) return false;
  const lower = clean.toLowerCase();
  if (STOP_WORDS.has(lower)) return false;
  if (/^(?:user|user's|user persona|character|assistant|model|system)$/i.test(clean)) return false;
  if (excludeName && excludeName.toLowerCase() !== 'user' && lower === excludeName.toLowerCase()) return false;
  if (!/^[A-Z]/.test(clean)) return false;
  return true;
}

function cleanCandidate(raw: string): string {
  return raw ? raw.replace(/^[\[\(\*\"\'\s]+|[\]\)\*\"\'\s.,:;!?]+$/g, '').trim() : '';
}

// Extract Character Name from System Prompt or dialogue cues
export function extractCharacterName(systemPrompt: string, messages?: any[], headers?: any): string {
  const cleanPrompt = systemPrompt ? systemPrompt.replace(/\r\n/g, '\n') : '';
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];

  // Detect user info first so we never confuse user name with character name
  const { userName: detectedUserName } = extractUserInfo(cleanPrompt, safeMessages, headers);

  // Tier 1: Explicit metadata declarations in system prompt
  if (cleanPrompt) {
    const strictPatterns = [
      // Playing or multi-character patterns (e.g. "playing Ashley & Melanie", "playing Alice, Bob, and Charlie, ambient NPCs...")
      /(?:Character Actor playing|actor playing|playing as|playing|roleplaying as|play as|operat(?:e|ing) as)\s+([A-Z][a-zA-Z0-9_\-'’]*(?:(?:\s*,\s*(?:and\s+)?|\s+(?:&|and)\s+)(?!NPCs?\b|ambient\b|living\b|world\b|other\b|the\b)[A-Z][a-zA-Z0-9_\-'’]*)+|[A-Z][a-zA-Z0-9_\-'’\s&]+?)(?=[,.\n\r]|\s+and\s+(?:the\s+living|ambient|all\s+other|NPCs?|other|the\s+world)|\s+in\s+an\s+ongoing|$)/i,
      /<char(?:_name)?\s*>(.*?)<\/char(?:_name)?>/i,
      /<char_persona\s+name=["']([^"']+)["']/i,
      /<(?:bot_name|character_name)\s*>([^<]+)<\/(?:bot_name|character_name)>/i,
      /\[(?:Character|Char)\s*:\s*([^\n\r\[\]\(\);:,]{1,40})\]/i,
      /\[(?:Character|Char)\("([^"]+)"\)\]/i,
      /(?:^|\n)\s*(?:\*\*|#{1,4}\s*)?(?:Character Name|Char Name|Character)(?:\*\*|\s*):+\s*([^\n\r\[\]\(\);:,]{1,40})/i,
      /\{\{char\}\}\s*(?:=|:|is named|is)\s*(?:a\s+|an\s+|the\s+)?([^\n\r\[\]\(\);:,]{1,40})/i,
      // Persona headings, excluding User/{{user}}
      /(?:^|\n)\s*#{1,4}\s+(?!User\b|{{user}}\b)([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*(?:\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)(?:['\u2019]s\s+(?:Persona|Description|Appearance|Background|Profile|Scenario)|$)/i,
      /(?:^|\n)\s*(?!User\b|{{user}}\b)([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*(?:\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)['\u2019]s\s+(?:Persona|Description|Appearance|Background|Personality|Profile)(?:\s*:|\s*\n)/i,
      /(?:You are interacting with|Interacting with|Roleplay with|Chat with|You will roleplay as|You roleplay as|You are playing as|You play as|You operate as)\s+(?:a\s+|an\s+|the\s+)?([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)(?=[.,\n\r\[\]\(\);:\s]|$)/i,
      /(?:Write|Roleplay)\s+(?:as\s+)?([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)(?:'s|\s+in|\s+with)/i,
      /\bnamed\s+([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)\b/i,
      /\[(?:Persona|Name)\s*:\s*(?!User\b)([^\n\r\[\]\(\);:,]{1,30})\]/i,
    ];

    for (const p of strictPatterns) {
      const match = cleanPrompt.match(p);
      if (match && match[1]) {
        const candidate = cleanCandidate(match[1]);
        if (isValidCharacterName(candidate, detectedUserName)) {
          return candidate;
        }
      }
    }
  }

  // Tier 2: Assistant messages (Starter greetings and dialogue headers)
  if (safeMessages.length > 0) {
    for (const m of safeMessages) {
      if (m && m.role === 'assistant') {
        const text = typeof m.content === 'string'
          ? m.content.trim()
          : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n').trim() : '');
        if (!text) continue;

        // Speaker prefix "Lily: ..." or "Ashley & Melanie: ..."
        const speakerMatch = text.match(/^([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*):\s+/);
        if (speakerMatch && speakerMatch[1]) {
          const spk = cleanCandidate(speakerMatch[1]);
          if (isValidCharacterName(spk, detectedUserName)) return spk;
        }

        // Action starter "*Lily looks up..." where verb is an action
        const actionMatch = text.match(/^\*([A-Z][a-zA-Z0-9_\-]{1,20})\s+([a-z]+)\b/);
        if (actionMatch && actionMatch[1] && actionMatch[2]) {
          const actName = cleanCandidate(actionMatch[1]);
          const verb = actionMatch[2].toLowerCase();
          if (isValidCharacterName(actName, detectedUserName) && ACTION_VERBS.has(verb)) {
            return actName;
          }
        }

        // Proper noun frequency in the starter text (e.g. Lily mentioned multiple times)
        const properNouns = text.match(/\b[A-Z][a-z]{2,20}\b/g) || [];
        const freqMap = new Map<string, number>();
        for (const word of properNouns) {
          if (isValidCharacterName(word, detectedUserName)) {
            freqMap.set(word, (freqMap.get(word) || 0) + 1);
          }
        }
        let bestWord = '';
        let maxCount = 0;
        for (const [w, count] of freqMap.entries()) {
          if (count > maxCount) {
            maxCount = count;
            bestWord = w;
          }
        }
        if (bestWord && maxCount >= 2) {
          return bestWord;
        }
      }
    }
  }

  // Tier 3: Proper noun starter in system prompt: "Lily is an elven princess..."
  if (cleanPrompt) {
    const starterMatch = cleanPrompt.match(/(?:^|\n\n)([A-Z][a-zA-Z0-9_\-]{1,20})\s+is\s+(?:a|an|the)\b/);
    if (starterMatch && starterMatch[1]) {
      const name = cleanCandidate(starterMatch[1]);
      if (isValidCharacterName(name, detectedUserName)) return name;
    }
  }

  return 'Character';
}

// Derive Character & Chat Fingerprints
export function deriveChatFingerprint(
  messages: any[],
  systemPrompt: string,
  headers?: { get: (name: string) => string | null }
): { characterId: string; characterName: string; chatId: string; sessionTitle: string } {
  // Check header overrides
  const customChatId = headers?.get('x-chat-id') || headers?.get('chat-id') || headers?.get('x-session-id') || headers?.get('session-id');
  const customCharName = headers?.get('x-character-name') || headers?.get('character-name');

  const charName = customCharName || extractCharacterName(systemPrompt, messages, headers);
  const characterId = 'char_' + hashString((charName + (systemPrompt || '').slice(0, 300)).trim().toLowerCase());

  const nonSystem = (messages || []).filter(m => m && m.role !== 'system');
  
  // Extract a clean dialogue preview for the session title (stripping out system notes or markdown lore)
  let preview = '';
  for (const m of nonSystem) {
    const raw = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n') : '');
    const cleaned = raw.replace(/\[(?:SYSTEM NOTE|OOC|Active Formatting)[\s\S]*?\]/gi, '').replace(/<[^>]+>[\s\S]*?<\/[^>]+>/gi, '').trim();
    if (cleaned.length > 2) {
      preview = cleaned.slice(0, 45).replace(/[\r\n]+/g, ' ').trim();
      break;
    }
  }

  const sessionTitle = preview
    ? `${charName} • "${preview}${preview.length >= 45 ? '...' : ''}"`
    : `${charName} Roleplay`;

  if (customChatId) {
    return {
      characterId,
      characterName: charName,
      chatId: customChatId,
      sessionTitle
    };
  }

  // Stable Anchor: In Janitor AI & SillyTavern, nonSystem[0] is the greeting/starter which never changes across message deletions.
  let anchor = '';
  if (nonSystem.length > 0) {
    const firstTurn = nonSystem[0];
    const firstText = typeof firstTurn.content === 'string' ? firstTurn.content : JSON.stringify(firstTurn.content);
    anchor = firstText.slice(0, 300);
  }

  const chatId = 'chat_' + hashString(`${characterId}::${charName}::${anchor}`);

  return {
    characterId,
    characterName: charName,
    chatId,
    sessionTitle
  };
}

// Upstash Redis REST helper (uses POST with JSON body for infinite payload sizes)
async function callRedis(command: string, ...args: (string | number)[]): Promise<any> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const cleanUrl = url.replace(/\/$/, '');
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });
    if (!res.ok) {
      // Fallback to GET URL format if server requires path command
      const pathRes = await fetch(`${cleanUrl}/${command}/${args.map(encodeURIComponent).join('/')}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!pathRes.ok) return null;
      const pathData = await pathRes.json();
      return pathData.result;
    }
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

// Upstash Redis Pipeline helper (executes batch commands in 1 single HTTP request)
async function callRedisPipeline(commands: (string | number)[][]): Promise<any[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || commands.length === 0) return [];

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
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(item => item?.result);
    }
    return [];
  } catch {
    return [];
  }
}

export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Get or create session
export async function getOrCreateChatSession(
  chatId: string,
  characterId: string,
  characterName: string,
  title: string
): Promise<ChatSession> {
  const now = Date.now();

  // Try Redis first
  if (isRedisConfigured()) {
    try {
      const raw = await callRedis('GET', `antigravity:session:${chatId}`);
      if (raw) {
        const parsed: ChatSession = typeof raw === 'string' ? JSON.parse(raw) : raw;
        parsed.characterName = characterName || parsed.characterName;
        return parsed;
      }
    } catch {}
  }

  // Fallback: In-Memory
  if (memoryStore.has(chatId)) {
    const s = memoryStore.get(chatId)!;
    s.characterName = characterName || s.characterName;
    return s;
  }

  const newSession: ChatSession = {
    id: chatId,
    characterId,
    characterName,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    messageCount: 0
  };

  await saveChatSession(newSession);
  return newSession;
}

// Extract safe, lightweight metadata overview from session
export function extractSessionOverview(session: ChatSession): SessionOverview {
  const msgs = session.messages || [];
  const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

  let lastContent = '';
  if (lastMsg) {
    const rawContent = lastMsg.content as any;
    if (typeof rawContent === 'string') {
      lastContent = rawContent;
    } else if (Array.isArray(rawContent)) {
      lastContent = rawContent.map((p: any) => p?.text || '').join(' ');
    }
  }

  const totalChars = msgs.reduce((acc, m) => {
    if (!m) return acc;
    const raw = m.content as any;
    if (typeof raw === 'string') return acc + raw.length;
    if (Array.isArray(raw)) return acc + raw.reduce((c: number, p: any) => c + (p?.text?.length || 0), 0);
    return acc;
  }, 0);

  const preview = lastMsg
    ? `${lastMsg.role === 'user' ? 'User' : (session.characterName || 'Character')}: ${lastContent.slice(0, 75).replace(/[\r\n]+/g, ' ')}...`
    : 'Empty session';

  return {
    id: session.id,
    characterId: session.characterId || 'char_default',
    characterName: session.characterName || 'Unknown Character',
    title: session.title || 'Chat Session',
    createdAt: session.createdAt || session.updatedAt || Date.now(),
    updatedAt: session.updatedAt || Date.now(),
    messageCount: msgs.length,
    estimatedTokens: Math.floor(totalChars / 4),
    lastMessagePreview: preview,
    oocCount: 0,
  };
}

// Save or update session
export async function saveChatSession(session: ChatSession): Promise<void> {
  session.updatedAt = Date.now();
  session.messageCount = (session.messages || []).length;

  // Save to in-memory store
  memoryStore.set(session.id, session);

  // Save to Upstash Redis if configured
  if (isRedisConfigured()) {
    try {
      const json = JSON.stringify(session);
      const overview = extractSessionOverview(session);
      await callRedisPipeline([
        ['SET', `antigravity:session:${session.id}`, json],
        ['SET', `antigravity:meta:${session.id}`, JSON.stringify(overview)],
        ['SADD', 'antigravity:active_sessions', session.id],
        ['ZADD', 'antigravity:active_sessions_z', session.updatedAt, session.id],
        ['SADD', `antigravity:char_sessions:${session.characterId}`, session.id]
      ]);
    } catch {}
  }
}

// Delete single session
export async function deleteChatSession(chatId: string): Promise<boolean> {
  let characterId = memoryStore.get(chatId)?.characterId;
  memoryStore.delete(chatId);

  if (isRedisConfigured()) {
    try {
      if (!characterId) {
        const rawMeta = await callRedis('GET', `antigravity:meta:${chatId}`);
        if (rawMeta) {
          const parsedMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
          characterId = parsedMeta.characterId;
        }
      }
      if (!characterId) {
        const raw = await callRedis('GET', `antigravity:session:${chatId}`);
        if (raw) {
          const parsed: ChatSession = typeof raw === 'string' ? JSON.parse(raw) : raw;
          characterId = parsed.characterId;
        }
      }

      const pipeline: (string | number)[][] = [
        ['DEL', `antigravity:session:${chatId}`],
        ['DEL', `antigravity:meta:${chatId}`],
        ['SREM', 'antigravity:active_sessions', chatId],
        ['ZREM', 'antigravity:active_sessions_z', chatId]
      ];
      if (characterId) {
        pipeline.push(['SREM', `antigravity:char_sessions:${characterId}`, chatId]);
      }
      await callRedisPipeline(pipeline);
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

// Delete ALL chat sessions (Complete Flush of chat transcripts)
export async function deleteAllChatSessions(): Promise<boolean> {
  memoryStore.clear();

  if (isRedisConfigured()) {
    try {
      const idsSet = new Set<string>();
      const rawIds: string[] = (await callRedis('SMEMBERS', 'antigravity:active_sessions')) || [];
      const zIds: string[] = (await callRedis('ZRANGE', 'antigravity:active_sessions_z', 0, -1)) || [];
      for (const id of [...rawIds, ...zIds]) {
        if (id) idsSet.add(id);
      }

      const pipeline: (string | number)[][] = [];

      for (const id of idsSet) {
        pipeline.push(['DEL', `antigravity:session:${id}`]);
        pipeline.push(['DEL', `antigravity:meta:${id}`]);
      }
      pipeline.push(['DEL', 'antigravity:active_sessions']);
      pipeline.push(['DEL', 'antigravity:active_sessions_z']);

      // Also clean any character session sets
      const allCharKeys: string[] = (await callRedis('KEYS', 'antigravity:char_sessions:*')) || [];
      for (const k of allCharKeys) {
        pipeline.push(['DEL', k]);
      }

      if (pipeline.length > 0) {
        await callRedisPipeline(pipeline);
      }
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

// Direct single-session lookup (O(1) retrieval)
export async function getSessionById(chatId: string): Promise<ChatSession | null> {
  if (isRedisConfigured()) {
    try {
      const raw = await callRedis('GET', `antigravity:session:${chatId}`);
      if (raw) {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch {}
  }
  return memoryStore.get(chatId) || null;
}

// List lightweight session overviews (fast metadata-only retrieval, 0ms payload bloat)
export async function listSessionOverviews(limit = 100): Promise<SessionOverview[]> {
  const overviews: SessionOverview[] = [];
  const seenIds = new Set<string>();

  if (isRedisConfigured()) {
    try {
      // 1. Get recent IDs from sorted set (ZREVRANGE)
      let ids: string[] = (await callRedis('ZREVRANGE', 'antigravity:active_sessions_z', 0, limit - 1)) || [];
      if (!Array.isArray(ids)) ids = [];

      // If sorted set has room, discover any unindexed legacy sessions from active_sessions set
      if (ids.length < limit) {
        const rawIds: string[] = (await callRedis('SMEMBERS', 'antigravity:active_sessions')) || [];
        if (Array.isArray(rawIds) && rawIds.length > 0) {
          const idSet = new Set(ids);
          for (const rawId of rawIds) {
            if (rawId && !idSet.has(rawId)) {
              ids.push(rawId);
              idSet.add(rawId);
              if (ids.length >= limit) break;
            }
          }
        }
      }

      if (ids && ids.length > 0) {
        // 2. Fetch lightweight metadata keys
        const metaCommands = ids.map(id => ['GET', `antigravity:meta:${id}`]);
        const metaResults = await callRedisPipeline(metaCommands);
        const missingIds: string[] = [];

        for (let i = 0; i < ids.length; i++) {
          const raw = metaResults[i];
          if (raw) {
            try {
              const parsed: SessionOverview = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (parsed && parsed.id) {
                overviews.push(parsed);
                seenIds.add(parsed.id);
                continue;
              }
            } catch {}
          }
          missingIds.push(ids[i]);
        }

        // 3. For sessions missing metadata key, fetch full sessions in small safe chunk (max 20) and backfill metadata, or prune if dead
        if (missingIds.length > 0) {
          const batchToFetch = missingIds.slice(0, 20);
          const sessionCommands = batchToFetch.map(id => ['GET', `antigravity:session:${id}`]);
          const sessionResults = await callRedisPipeline(sessionCommands);
          const maintenanceCommands: (string | number)[][] = [];

          for (let j = 0; j < batchToFetch.length; j++) {
            const raw = sessionResults[j];
            const id = batchToFetch[j];
            if (raw) {
              try {
                const fullSession: ChatSession = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (fullSession && fullSession.id && !seenIds.has(fullSession.id)) {
                  const overview = extractSessionOverview(fullSession);
                  overviews.push(overview);
                  seenIds.add(fullSession.id);
                  maintenanceCommands.push([
                    'SET',
                    `antigravity:meta:${fullSession.id}`,
                    JSON.stringify(overview)
                  ]);
                  maintenanceCommands.push([
                    'ZADD',
                    'antigravity:active_sessions_z',
                    overview.updatedAt || Date.now(),
                    fullSession.id
                  ]);
                }
              } catch {}
            } else {
              // Dead or orphaned session key: prune from active sets to avoid repeating failed lookups
              maintenanceCommands.push(
                ['ZREM', 'antigravity:active_sessions_z', id],
                ['SREM', 'antigravity:active_sessions', id],
                ['DEL', `antigravity:meta:${id}`]
              );
            }
          }

          if (maintenanceCommands.length > 0) {
            callRedisPipeline(maintenanceCommands).catch(() => {});
          }
        }
      }
    } catch {}
  }

  // Merge in-memory sessions
  for (const s of memoryStore.values()) {
    if (!seenIds.has(s.id)) {
      overviews.push(extractSessionOverview(s));
      seenIds.add(s.id);
    }
  }

  return overviews.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Backwards-compatible session lister
export async function listAllSessions(): Promise<ChatSession[]> {
  const overviews = await listSessionOverviews();
  return overviews.map(o => {
    const mem = memoryStore.get(o.id);
    if (mem) return mem;
    return {
      id: o.id,
      characterId: o.characterId,
      characterName: o.characterName,
      title: o.title,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      messages: [],
      messageCount: o.messageCount
    };
  });
}

// Generate in-context prompt anchor to reinforce active formatting and immersion on every turn
export function getActiveOOCAnchor(): string {
  let anchor = '\n\n[Active Formatting & Character Persona Directive]:\n';
  anchor += '• Adhere strictly to character markdown syntax:\n';
  anchor += '  - Wrap all character actions, scene narration, and physical movements in *asterisks* (e.g. *she pauses, looking away*).\n';
  anchor += '  - Wrap all spoken dialogue in "double quotes" (e.g. "What do you mean?").\n';
  anchor += '  - Wrap inner thoughts, telepathy, or internal monologues in `backticks` (e.g. `I hope he didn\'t notice...`).\n';
  anchor += '• Maintain full immersion in character persona, lore, and speech habits without breaking character.\n';
  anchor += 'Follow all character guidelines and markdown formatting precisely in your response.';
  return anchor;
}



function extractContentText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p: any) => typeof p === 'string' ? p : (p?.text || '')).join('\n');
  }
  return '';
}

// Sync session message history with active incoming prompt (handles message deletions, rewinds, and regenerations)
export function syncSessionWithIncomingMessages(
  session: ChatSession,
  incomingMessages: any[]
): void {
  const nonSystem = (incomingMessages || []).filter(m => m && m.role !== 'system');
  if (nonSystem.length === 0) return;

  session.messages = session.messages || [];
  const current = session.messages;

  // If session is brand new, initialize from incoming
  if (current.length === 0) {
    session.messages = nonSystem.map((m, idx) => ({
      id: 'msg_' + hashString((typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')) + idx).slice(0, 8),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((p: any) => p.text || '').join('\n') : ''),
      timestamp: Date.now() - (nonSystem.length - idx) * 1000
    }));
    return;
  }

  // Check if incoming is a deletion / rewind / regeneration of previous turns
  const lastIncoming = nonSystem[nonSystem.length - 1];
  if (lastIncoming && lastIncoming.role === 'user') {
    const lastUserText = extractContentText(lastIncoming.content).trim();
    const len = current.length;

    // Case 1: Simple 1-message regeneration (last bot message deleted/swiped)
    if (len >= 2 && current[len - 2].role === 'user' && extractContentText(current[len - 2].content).trim() === lastUserText) {
      current.pop(); // Remove the deleted/swiped bot response so the new response takes its place
      return;
    }

    // Case 2: Multi-turn deletion / rewind (user deleted 2+ messages or rewound chat to an earlier point)
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].role === 'user' && extractContentText(current[i].content).trim() === lastUserText) {
        // Keep history up to this user turn (inclusive)
        session.messages = current.slice(0, i + 1);
        return;
      }
    }
  }
}


// Stitch lossless long-term history
export function stitchLosslessHistory(
  session: ChatSession,
  incomingMessages: any[]
): any[] {
  // Synchronize session state with incoming branch
  syncSessionWithIncomingMessages(session, incomingMessages);

  // Extract all system messages from incoming (preserves 13k token character card and system directives)
  const systemMsgs = (incomingMessages || []).filter(m => m && m.role === 'system');
  const incomingNonSystem = (incomingMessages || []).filter(m => m && m.role !== 'system');

  if (incomingNonSystem.length === 0) return incomingMessages;

  const latestIncoming = incomingNonSystem[incomingNonSystem.length - 1];

  // If stored archive has more history than incoming non-system turns, stitch the full archive while preserving system messages
  if (session.messages && session.messages.length > incomingNonSystem.length) {
    let archive = [...session.messages];

    // Ensure the archive always ends with a user turn if the incoming turn was a user turn
    if (latestIncoming.role === 'user') {
      while (archive.length > 0 && archive[archive.length - 1].role !== 'user') {
        archive.pop();
      }
      const latestIncomingText = extractContentText(latestIncoming.content).trim();
      const archiveLastText = extractContentText(archive[archive.length - 1]?.content).trim();
      if (archive.length === 0 || archiveLastText !== latestIncomingText) {
        archive.push({
          id: 'msg_user_' + Date.now(),
          role: 'user',
          content: latestIncoming.content,
          timestamp: Date.now()
        });
      }
    }

    const archiveFormatted = archive.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    return [...systemMsgs, ...archiveFormatted];
  }
  return incomingMessages;
}

// Extract all dynamic Lorebook, World Info, Memory, and Context injections from Lorebary / Janitor AI
export function extractInjectedLore(
  messages: any[],
  rawSystemText: string
): InjectedLoreEntry[] {
  const entries: InjectedLoreEntry[] = [];
  const seenContent = new Set<string>();

  const msgContents = (messages || []).map(m => (typeof m?.content === 'string' ? m.content : (Array.isArray(m?.content) ? m.content.map((p: any) => p?.text || '').join('\n') : '')));
  const fullText = [rawSystemText || '', ...msgContents].join('\n\n');

  // 1. Scan for XML-style lore tags: <lore>, <lorebook>, <world_info>, <entry>, <memory>, <context>
  const xmlPatterns = [
    { regex: /<lore(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/lore>/gi, cat: 'lore' },
    { regex: /<lorebook(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/lorebook>/gi, cat: 'lore' },
    { regex: /<world_info(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/world_info>/gi, cat: 'world_info' },
    { regex: /<entry\s+title=["']([^"']+)["'][^>]*>([\s\S]*?)<\/entry>/gi, cat: 'lore' },
    { regex: /<memory(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/memory>/gi, cat: 'memory' },
    { regex: /<context(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/context>/gi, cat: 'context' },
    { regex: /<lore_entry(?:\s+title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/lore_entry>/gi, cat: 'lore' },
  ];

  for (const { regex, cat } of xmlPatterns) {
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      const title = (match[1] || `${cat.replace('_', ' ').toUpperCase()} Entry`).trim();
      const content = match[2]?.trim();
      if (content && !seenContent.has(content) && content.length > 3) {
        seenContent.add(content);
        entries.push({
          title,
          category: cat as any,
          content,
          tokens: Math.max(1, Math.floor(content.length / 4))
        });
      }
    }
  }

  // 2. Scan for Bracketed World Info / Lore: [World Info: Title\nContent] or [Lore: ...]
  const bracketPatterns = [
    { regex: /\[(?:World Info|WorldInfo|Lorebook|Lore|Lore Entry)\s*:\s*([^\]\n]{1,60})\n([\s\S]*?)\]/gi, cat: 'world_info' },
    { regex: /\[(?:Memory|Chat Memory|Active Memory)\s*:\s*([^\]\n]{1,60})\n([\s\S]*?)\]/gi, cat: 'memory' },
    { regex: /\[(?:World Info|WorldInfo|Lorebook|Lore)\s*:\s*([\s\S]*?)\]/gi, cat: 'world_info' },
    { regex: /\[(?:Memory|Chat Memory)\s*:\s*([\s\S]*?)\]/gi, cat: 'memory' }
  ];

  for (const { regex, cat } of bracketPatterns) {
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      const title = match[2] ? match[1].trim() : `${cat.replace('_', ' ').toUpperCase()}`;
      const content = (match[2] || match[1]).trim();
      if (content && !seenContent.has(content) && content.length > 5) {
        seenContent.add(content);
        entries.push({
          title,
          category: cat as any,
          content,
          tokens: Math.max(1, Math.floor(content.length / 4))
        });
      }
    }
  }

  // 3. Scan for Multi-System Messages (Lorebary passing extra system turns)
  const systemMessages = (messages || []).filter(m => m && m.role === 'system');
  if (systemMessages.length > 1) {
    for (let i = 1; i < systemMessages.length; i++) {
      const content = typeof systemMessages[i].content === 'string' ? systemMessages[i].content.trim() : '';
      if (content && !seenContent.has(content) && content.length > 10) {
        seenContent.add(content);
        const firstLine = content.split('\n')[0].replace(/^[#\-\*\[\]\s]+/, '').slice(0, 35);
        entries.push({
          title: firstLine || `Injected System Context #${i}`,
          category: 'system_block',
          content,
          tokens: Math.max(1, Math.floor(content.length / 4))
        });
      }
    }
  }

  // 4. Scan for Markdown Lore Section Headers (### Lore / ### World Info / --- LOREBARY ---)
  const headerRegex = /(?:###|---)\s*(?:Lore|World Info|Active Context|Injected Knowledge|Lorebary|Memory)\s*(?:###|---)?\s*:\s*\n([\s\S]*?)(?=\n(?:###|---)|\n\n\[|$)/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(fullText)) !== null) {
    const content = headerMatch[1]?.trim();
    if (content && !seenContent.has(content) && content.length > 10) {
      seenContent.add(content);
      const firstLine = content.split('\n')[0].replace(/^[#\-\*\[\]\s]+/, '').slice(0, 30);
      entries.push({
        title: firstLine || 'Lorebary Injected Block',
        category: 'lore',
        content,
        tokens: Math.max(1, Math.floor(content.length / 4))
      });
    }
  }

  return entries;
}

// Record turns asynchronously into session history (using client active messages as the ground truth)
export async function recordTurnsIntoSession(
  session: ChatSession,
  incomingMessages: any[] | string,
  assistantText: string,
  reasoningContent?: string,
  injectedLore?: InjectedLoreEntry[],
  attachedInjections?: AttachedInjectionEntry[]
): Promise<void> {
  const now = Date.now();
  const trimmedAssistant = (assistantText || '').trim();

  // Handle both array of messages and legacy single user string
  let nonSystem: any[] = [];
  if (Array.isArray(incomingMessages)) {
    nonSystem = incomingMessages.filter(m => m && m.role !== 'system');
  } else if (typeof incomingMessages === 'string' && incomingMessages.trim()) {
    nonSystem = [{ role: 'user', content: incomingMessages.trim() }];
  }

  // Map existing messages by content for preservation of prior metadata
  const existingMap = new Map<string, ArchivedMessage>();
  for (const existing of session.messages || []) {
    if (existing.content) {
      existingMap.set(existing.content.trim(), existing);
    }
  }

  // Format all active messages from the client's ground-truth list
  const formattedMessages: ArchivedMessage[] = nonSystem.map((m, idx) => {
    const content = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n') : '');
    const trimmed = content.trim();
    const isLastUser = idx === nonSystem.length - 1 && m.role === 'user';
    const prior = existingMap.get(trimmed);

    return {
      id: 'msg_' + hashString(content + idx).slice(0, 8),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content,
      reasoning_content: prior?.reasoning_content,
      timestamp: prior?.timestamp || (now - (nonSystem.length - idx) * 1000),
      injectedLore: isLastUser
        ? (injectedLore && injectedLore.length > 0 ? injectedLore : undefined)
        : prior?.injectedLore,
      attachedInjections: isLastUser
        ? (attachedInjections && attachedInjections.length > 0 ? attachedInjections : undefined)
        : prior?.attachedInjections
    };
  });

  // Append the assistant's new response
  if (trimmedAssistant) {
    formattedMessages.push({
      id: 'msg_' + hashString(trimmedAssistant + now).slice(0, 8),
      role: 'assistant',
      content: assistantText,
      reasoning_content: reasoningContent,
      timestamp: now
    });
  }

  session.messages = formattedMessages;
  session.messageCount = formattedMessages.length;
  session.updatedAt = now;

  await saveChatSession(session);
}

