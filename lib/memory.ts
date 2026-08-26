import crypto from 'node:crypto';
import type { AttachedInjectionEntry } from './injections';

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
  messages: ArchivedMessage[];
  messageCount: number;
}

export interface CharacterSummary {
  characterId: string;
  characterName: string;
  chatCount: number;
  lastActive: number;
}

// In-Memory Fallback Store
const memoryStore = new Map<string, ChatSession>();

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// Filter list of generic words/phrases that are NOT character names
const GENERIC_NAME_BLACKLIST = [
  'antigravity',
  'assistant',
  'ai',
  'the character and npcs',
  'character and npcs',
  'ambient non-player characters',
  'expert uncensored literary fiction author',
  'uncensored literary fiction author',
  'narrative director',
  'dynamic character actor',
  'literary author',
  'the character',
  'char',
  'user',
  'unknown',
  'interacting with',
  'interacting with the character',
  'interacting with character',
  'interacting with you',
  'fictional chat',
  'character persona',
  'character sheet',
  'roleplay partner',
  'roleplay',
  'scenario',
  'system note',
  'system prompt',
  'system',
  'partner',
  'bot',
  'nsfw',
  'you'
];

// Extract Character Name from System Prompt or dialogue cues
export function extractCharacterName(systemPrompt: string, messages?: any[]): string {
  const cleanPrompt = systemPrompt ? systemPrompt.replace(/\r\n/g, '\n') : '';

  // 1. Scan system prompt for explicit character name tags & declarations
  const explicitPatterns = [
    /<char(?:_name)?\s*>(.*?)<\/char(?:_name)?>/i,
    /<char_persona\s+name=["']([^"']+)["']/i,
    /\[(?:Character|Char|Persona|Name)\s*:\s*([A-Za-z0-9_\-\s']{1,30})\]/i,
    /\[(?:Character|Char)\("([^"]+)"\)\]/i,
    /(?:^|\n)\s*(?:\*\*|#{1,4}\s*)?(?:Character Name|Char Name|Character|Persona|Name)(?:\*\*|\s*):+\s*([A-Za-z0-9_\-\s']{1,30})(?=[.,\n\r\[\]\(\);:]|$)/i,
    /\{\{char\}\}\s*(?:=|:|is named|is)\s*([A-Za-z0-9_\-\s']{1,30})(?=[.,\n\r\[\]\(\);:]|$)/i,
    /(?:^|\n)\s*###\s+([A-Z][a-zA-Z0-9_\-\s']{1,25})(?:'s\s+(?:Persona|Description|Appearance|Background|Profile|Scenario)|$)/i,
    /([A-Z][a-zA-Z0-9_\-\s']{1,25})'s\s+(?:Persona|Description|Appearance|Background|Personality|Profile)\s*:/i,
    /(?:You are interacting with|Interacting with|Roleplay with|Chat with|You will roleplay as|You roleplay as|You are playing as|You play as|You operate as|You are)\s+([A-Z][a-zA-Z0-9_\-]{1,25})(?=[.,\n\r\[\]\(\);:\s]|$)/i,
    /(?:Write|Roleplay)\s+(?:as\s+)?([A-Z][a-zA-Z0-9_\-]{1,25})(?:'s|\s+in|\s+with)/i,
    /^\s*([A-Z][a-zA-Z0-9_\-]{1,25})\s*:\s*You are/i
  ];

  if (cleanPrompt) {
    for (const p of explicitPatterns) {
      const match = cleanPrompt.match(p);
      if (match && match[1]) {
        const candidate = match[1].replace(/^[\[\(\*\"\'\s]+|[\]\)\*\"\'\s]+$/g, '').trim();
        const lower = candidate.toLowerCase();
        if (
          candidate.length >= 2 &&
          candidate.length <= 30 &&
          !GENERIC_NAME_BLACKLIST.some(b => lower === b || lower.startsWith(b + ' ') || lower.endsWith(' ' + b))
        ) {
          return candidate;
        }
      }
    }
  }

  // 2. Scan assistant messages for dialogue headers, asterisks, or greetings
  if (messages && messages.length > 0) {
    for (const m of messages) {
      if (m && m.role === 'assistant') {
        const text = typeof m.content === 'string' ? m.content.trim() : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n').trim() : '');
        if (!text) continue;

        // Speaker prefix "Kars: ..."
        const speakerMatch = text.match(/^([A-Z][a-zA-Z0-9_\-]{1,20}):\s+/);
        if (speakerMatch && speakerMatch[1]) {
          const spk = speakerMatch[1].trim();
          if (!GENERIC_NAME_BLACKLIST.some(b => spk.toLowerCase().includes(b))) {
            return spk;
          }
        }

        // Action starter "*Kars opens a rift..." or "*Kars pauses..."
        const actionMatch = text.match(/^\*([A-Z][a-zA-Z0-9_\-]{1,20})\s+/);
        if (actionMatch && actionMatch[1]) {
          const actName = actionMatch[1].trim();
          if (!GENERIC_NAME_BLACKLIST.some(b => actName.toLowerCase().includes(b))) {
            return actName;
          }
        }

        // Third-person narrative starter "Kars smiles and looks away..."
        const thirdPersonMatch = text.match(/^([A-Z][a-zA-Z0-9_\-]{1,20})\s+(?:smiles|looks|walks|stands|turns|steps|gazes|pauses|sighs|nods|takes|crosses|leans|watches|pulls|grins|frowns|glances|stares|reaches|draws|speaks|whispers|laughs|sits)\b/);
        if (thirdPersonMatch && thirdPersonMatch[1]) {
          const tpName = thirdPersonMatch[1].trim();
          if (!GENERIC_NAME_BLACKLIST.some(b => tpName.toLowerCase().includes(b))) {
            return tpName;
          }
        }
      }
    }
  }

  // 3. Fallback: Proper noun starter in system prompt
  if (cleanPrompt) {
    const starterMatch = cleanPrompt.match(/(?:^|\n\n)([A-Z][a-zA-Z0-9_\-]{1,20})\s+is\s+(?:a|an|the)\b/);
    if (starterMatch && starterMatch[1]) {
      const name = starterMatch[1].trim();
      if (!GENERIC_NAME_BLACKLIST.some(b => name.toLowerCase().includes(b))) {
        return name;
      }
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

  const charName = customCharName || extractCharacterName(systemPrompt, messages);
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

// Save or update session
export async function saveChatSession(session: ChatSession): Promise<void> {
  session.updatedAt = Date.now();
  session.messageCount = session.messages.length;

  // Save to in-memory store
  memoryStore.set(session.id, session);

  // Save to Upstash Redis if configured
  if (isRedisConfigured()) {
    try {
      const json = JSON.stringify(session);
      await callRedis('SET', `antigravity:session:${session.id}`, json);
      // Also register session ID in active sessions set
      await callRedis('SADD', 'antigravity:active_sessions', session.id);
      await callRedis('SADD', `antigravity:char_sessions:${session.characterId}`, session.id);
    } catch {}
  }
}

// Delete single session
export async function deleteChatSession(chatId: string): Promise<boolean> {
  memoryStore.delete(chatId);

  if (isRedisConfigured()) {
    try {
      const raw = await callRedis('GET', `antigravity:session:${chatId}`);
      if (raw) {
        const parsed: ChatSession = typeof raw === 'string' ? JSON.parse(raw) : raw;
        await callRedis('SREM', `antigravity:char_sessions:${parsed.characterId}`, chatId);
      }
      await callRedis('DEL', `antigravity:session:${chatId}`);
      await callRedis('SREM', 'antigravity:active_sessions', chatId);
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
      const ids: string[] = (await callRedis('SMEMBERS', 'antigravity:active_sessions')) || [];
      const pipeline: (string | number)[][] = [];

      for (const id of ids) {
        pipeline.push(['DEL', `antigravity:session:${id}`]);
      }
      pipeline.push(['DEL', 'antigravity:active_sessions']);

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

// List all sessions (Ultra-fast 1-request pipeline retrieval)
export async function listAllSessions(): Promise<ChatSession[]> {
  const sessions: ChatSession[] = [];

  if (isRedisConfigured()) {
    try {
      const ids: string[] = (await callRedis('SMEMBERS', 'antigravity:active_sessions')) || [];
      if (ids && ids.length > 0) {
        const pipelineCommands = ids.map(id => ['GET', `antigravity:session:${id}`]);
        const results = await callRedisPipeline(pipelineCommands);
        for (const raw of results) {
          if (raw) {
            sessions.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
          }
        }
      }
    } catch {}
  }

  // Merge in-memory sessions
  for (const s of memoryStore.values()) {
    if (!sessions.some(existing => existing.id === s.id)) {
      sessions.push(s);
    }
  }

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
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
      id: 'msg_' + hashString((m.content || '') + idx).slice(0, 8),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((p: any) => p.text || '').join('\n') : ''),
      timestamp: Date.now() - (nonSystem.length - idx) * 1000
    }));
    return;
  }

  // Check if incoming is a deletion / rewind / regeneration of previous turns
  const lastIncoming = nonSystem[nonSystem.length - 1];
  if (lastIncoming && lastIncoming.role === 'user') {
    const lastUserText = (typeof lastIncoming.content === 'string' ? lastIncoming.content : '').trim();
    const len = current.length;

    // Case 1: Simple 1-message regeneration (last bot message deleted/swiped)
    if (len >= 2 && current[len - 2].role === 'user' && current[len - 2].content.trim() === lastUserText) {
      current.pop(); // Remove the deleted/swiped bot response so the new response takes its place
      return;
    }

    // Case 2: Multi-turn deletion / rewind (user deleted 2+ messages or rewound chat to an earlier point)
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].role === 'user' && current[i].content.trim() === lastUserText) {
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
      if (archive.length === 0 || archive[archive.length - 1].content.trim() !== (latestIncoming.content || '').trim()) {
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
        ? (injectedLore && injectedLore.length > 0 ? injectedLore : prior?.injectedLore)
        : prior?.injectedLore,
      attachedInjections: isLastUser
        ? (attachedInjections && attachedInjections.length > 0 ? attachedInjections : prior?.attachedInjections)
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

