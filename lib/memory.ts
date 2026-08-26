import crypto from 'node:crypto';

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
  'unknown'
];

// Extract Character Name from System Prompt or dialogue cues
export function extractCharacterName(systemPrompt: string, messages?: any[]): string {
  // 1. Scan system prompt for explicit character name tags
  const patterns = [
    /<char(?:_name)?\s*>(.*?)<\/char(?:_name)?>/i,
    /\[(?:Character|Char|Persona|Name):\s*([A-Za-z0-9_\-\s]{1,30})\]/i,
    /(?:Character Name|Char Name|Character|Persona):\s*([A-Za-z0-9_\-\s]{1,30})(?=[.,\n\r\[\]\(\);:]|$)/i,
    /(?:You operate as|You are playing as|You play as)\s+([A-Z][a-zA-Z0-9_\-\s]{1,25})(?=[.,\n\r\[\]\(\);:]|$)/i,
    /^\s*([A-Z][a-zA-Z0-9_\-\s]{1,25})\s*:\s*You are/i
  ];

  if (systemPrompt) {
    for (const p of patterns) {
      const match = systemPrompt.match(p);
      if (match && match[1]) {
        const name = match[1].trim();
        const lower = name.toLowerCase();
        if (name.length > 1 && !GENERIC_NAME_BLACKLIST.some(b => lower.includes(b))) {
          return name;
        }
      }
    }
  }

  // 2. Check assistant messages for dialogue headers or character introduction
  if (messages && messages.length > 0) {
    for (const m of messages) {
      if (m && m.role === 'assistant' && typeof m.content === 'string') {
        const text = m.content.trim();
        const speakerMatch = text.match(/^([A-Z][a-zA-Z0-9_\-]{1,20}):\s+/);
        if (speakerMatch && speakerMatch[1]) {
          const spk = speakerMatch[1].trim();
          if (!GENERIC_NAME_BLACKLIST.some(b => spk.toLowerCase().includes(b))) {
            return spk;
          }
        }
        const actionMatch = text.match(/^\*([A-Z][a-zA-Z0-9_\-]{1,20})\s+/);
        if (actionMatch && actionMatch[1]) {
          const actName = actionMatch[1].trim();
          if (!GENERIC_NAME_BLACKLIST.some(b => actName.toLowerCase().includes(b))) {
            return actName;
          }
        }
      }
    }
  }

  // 3. Fallback: Check if there is a character prompt title
  if (systemPrompt) {
    const firstLine = systemPrompt.split('\n')[0].replace(/^[#\-\*\[\]\s]+/, '').trim();
    if (firstLine.length > 0 && firstLine.length < 30 && !firstLine.includes(':') && !GENERIC_NAME_BLACKLIST.some(b => firstLine.toLowerCase().includes(b))) {
      return firstLine;
    }
  }

  return 'Character-' + hashString(systemPrompt || 'unknown').slice(0, 6);
}

// Derive Character & Chat Fingerprints
export function deriveChatFingerprint(
  messages: any[],
  systemPrompt: string,
  headers?: { get: (name: string) => string | null }
): { characterId: string; characterName: string; chatId: string; sessionTitle: string } {
  // Check header overrides
  const customChatId = headers?.get('x-chat-id') || headers?.get('chat-id');
  const customCharName = headers?.get('x-character-name') || headers?.get('character-name');

  const charName = customCharName || extractCharacterName(systemPrompt, messages);
  const characterId = 'char_' + hashString((charName + systemPrompt.slice(0, 300)).trim().toLowerCase());

  if (customChatId) {
    return {
      characterId,
      characterName: charName,
      chatId: customChatId,
      sessionTitle: customChatId
    };
  }

  // Use first 3 turns for distinct conversation hashing
  let anchor = '';
  const nonSystem = (messages || []).filter(m => m && m.role !== 'system');
  if (nonSystem.length > 0) {
    anchor = nonSystem.slice(0, 3).map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).slice(0, 150)).join('||');
  }

  const chatId = 'chat_' + hashString(`${characterId}::${charName}::${anchor}`);
  
  // Create human-friendly title
  let preview = '';
  if (nonSystem.length > 0) {
    const first = nonSystem[0];
    const text = typeof first.content === 'string' ? first.content : '';
    preview = text.slice(0, 40).replace(/[\r\n]+/g, ' ').trim();
  }
  const sessionTitle = preview ? `"${preview}..."` : `${charName} Chat`;

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

// Delete session
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
  injectedLore?: InjectedLoreEntry[]
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

  if (nonSystem.length === 0 && !trimmedAssistant) return;

  // Format all active messages from the client's ground-truth list
  const formattedMessages: ArchivedMessage[] = nonSystem.map((m, idx) => {
    const content = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text || '').join('\n') : '');
    const isLastUser = idx === nonSystem.length - 1 && m.role === 'user';
    return {
      id: 'msg_' + hashString(content + idx).slice(0, 8),
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content,
      timestamp: now - (nonSystem.length - idx) * 1000,
      injectedLore: isLastUser && injectedLore && injectedLore.length > 0 ? injectedLore : undefined
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

