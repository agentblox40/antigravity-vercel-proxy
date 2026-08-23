import crypto from 'node:crypto';

export interface OOCRule {
  id: string;
  rule: string;
  enabled: boolean;
  addedAt: number;
  source: 'auto' | 'manual';
}

export interface LoreFact {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  addedAt: number;
}

export interface ArchivedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  characterId: string;
  characterName: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  oocRules: OOCRule[];
  loreFacts: LoreFact[];
  messages: ArchivedMessage[];
  messageCount: number;
}

export interface CharacterSummary {
  characterId: string;
  characterName: string;
  chatCount: number;
  lastActive: number;
  oocRuleCount: number;
}

// In-Memory Fallback Store
const memoryStore = new Map<string, ChatSession>();

function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// Extract Character Name from System Prompt
export function extractCharacterName(systemPrompt: string): string {
  if (!systemPrompt) return 'Unknown Character';
  const patterns = [
    /(?:You are|Character Name:|Character:|Name:)\s+([A-Z][a-zA-Z0-9_\-\s]{1,30}?)(?=[.,\n\r\[\]\(\);:]|$)/i,
    /\[(?:Character|Name|Persona):\s*([A-Za-z0-9_\-\s]{1,30})\]/i,
    /^\s*([A-Z][a-zA-Z0-9_\-\s]{1,25})\s*:\s*You are/i
  ];

  for (const p of patterns) {
    const match = systemPrompt.match(p);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 1 && !name.toLowerCase().includes('antigravity') && !name.toLowerCase().includes('assistant')) {
        return name;
      }
    }
  }

  // Fallback: Check first line
  const firstLine = systemPrompt.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length < 35 && !firstLine.includes(':')) {
    return firstLine;
  }

  return 'Character-' + hashString(systemPrompt).slice(0, 6);
}

// Parse OOC Rules from incoming user text
export function extractOOCRules(text: string): string[] {
  if (!text) return [];
  const rules: string[] = [];

  const patterns = [
    /\(\(\s*(?:OOC|ooc|Ooc)\s*[:,\-]?\s*([\s\S]+?)\)\)/g,
    /\(\s*(?:OOC|ooc|Ooc)\s*[:,\-]?\s*([\s\S]+?)\)/g,
    /\[\s*(?:OOC|ooc|Ooc)\s*[:,\-]?\s*([\s\S]+?)\]/g,
    /\[\s*(?:System\s*Note|SYSTEM\s*NOTE|SystemNote)\s*[:,\-]?\s*([\s\S]+?)\]/g,
    /\{\{\s*(?:OOC|ooc)\s*[:,\-]?\s*([\s\S]+?)\}\}/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        const cleaned = match[1].trim();
        if (cleaned.length >= 3 && !rules.includes(cleaned)) {
          rules.push(cleaned);
        }
      }
    }
  }

  return rules;
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

  const charName = customCharName || extractCharacterName(systemPrompt);
  const characterId = 'char_' + hashString((charName + systemPrompt.slice(0, 500)).trim().toLowerCase());

  if (customChatId) {
    return {
      characterId,
      characterName: charName,
      chatId: customChatId,
      sessionTitle: customChatId
    };
  }

  // Anchor to the first two messages (opening bot greeting + first user reply)
  let anchor = '';
  if (messages.length > 0) {
    const firstTwo = messages.slice(0, 2);
    anchor = firstTwo.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).slice(0, 200)).join('||');
  }

  const chatId = 'chat_' + hashString(`${characterId}::${anchor}`);
  
  // Create human-friendly title
  let preview = '';
  if (messages.length > 0) {
    const first = messages[0];
    const text = typeof first.content === 'string' ? first.content : '';
    preview = text.slice(0, 40).replace(/[\r\n]+/g, ' ').trim();
  }
  const sessionTitle = preview ? `"${preview}..."` : `Chat #${chatId.slice(5, 11)}`;

  return {
    characterId,
    characterName: charName,
    chatId,
    sessionTitle
  };
}

// Upstash Redis REST helper
async function callRedis(command: string, ...args: (string | number)[]): Promise<any> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/${command}/${args.map(encodeURIComponent).join('/')}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
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
    oocRules: [],
    loreFacts: [],
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

// List all sessions
export async function listAllSessions(): Promise<ChatSession[]> {
  const sessions: ChatSession[] = [];

  if (isRedisConfigured()) {
    try {
      const ids: string[] = (await callRedis('SMEMBERS', 'antigravity:active_sessions')) || [];
      for (const id of ids) {
        const raw = await callRedis('GET', `antigravity:session:${id}`);
        if (raw) {
          sessions.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
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

// Ingest new OOC rules into session
export function ingestOOCIntoSession(session: ChatSession, newRules: string[]): boolean {
  let changed = false;
  for (const r of newRules) {
    const exists = session.oocRules.some(existing => existing.rule.toLowerCase() === r.toLowerCase());
    if (!exists) {
      session.oocRules.push({
        id: 'ooc_' + hashString(r).slice(0, 8),
        rule: r,
        enabled: true,
        addedAt: Date.now(),
        source: 'auto'
      });
      changed = true;
    }
  }
  return changed;
}

// Augment System Prompt with Memory & OOC Directives
export function augmentSystemWithMemory(baseSystem: string, session: ChatSession): string {
  const activeOOC = session.oocRules.filter(r => r.enabled);
  const activeLore = session.loreFacts.filter(f => f.enabled);

  if (activeOOC.length === 0 && activeLore.length === 0) {
    return baseSystem;
  }

  let memoryBlock = '\n\n[PERSISTENT CHAT MEMORY & ACTIVE OOC RULES]\n';

  if (activeOOC.length > 0) {
    memoryBlock += 'Active Out-Of-Character (OOC) Directives:\n';
    for (const rule of activeOOC) {
      memoryBlock += `• ${rule.rule}\n`;
    }
  }

  if (activeLore.length > 0) {
    memoryBlock += '\nPersistent Lore, Inventory & State:\n';
    for (const fact of activeLore) {
      memoryBlock += `• ${fact.key}: ${fact.value}\n`;
    }
  }

  memoryBlock += '\n[MANDATORY CONTINUITY DIRECTIVE]\nAlways adhere strictly to the persistent OOC rules and lore state defined above.';

  return baseSystem + memoryBlock;
}

// Stitch lossless long-term history
export function stitchLosslessHistory(
  session: ChatSession,
  incomingMessages: any[]
): any[] {
  // If stored archive has more history than incoming (client truncated), prepend older messages
  if (session.messages && session.messages.length > incomingMessages.length) {
    const archiveFormatted = session.messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role,
      content: m.content
    }));
    return archiveFormatted;
  }
  return incomingMessages;
}

// Record turns asynchronously into session history
export async function recordTurnsIntoSession(
  session: ChatSession,
  userText: string,
  assistantText: string,
  reasoningContent?: string
): Promise<void> {
  const now = Date.now();
  if (userText) {
    session.messages.push({
      id: 'msg_' + hashString(userText + now).slice(0, 8),
      role: 'user',
      content: userText,
      timestamp: now
    });
  }
  if (assistantText) {
    session.messages.push({
      id: 'msg_' + hashString(assistantText + now).slice(0, 8),
      role: 'assistant',
      content: assistantText,
      reasoning_content: reasoningContent,
      timestamp: now + 1
    });
  }
  // Cap at last 2000 messages to stay well within 1M token budget and avoid unbounded memory
  if (session.messages.length > 2000) {
    session.messages = session.messages.slice(-2000);
  }
  await saveChatSession(session);
}
