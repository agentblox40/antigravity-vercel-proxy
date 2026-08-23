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
  systemPrompt?: string;
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
    // Double parentheses / brackets: ((OOC: ...)) or [[OOC: ...]]
    /\(\(\s*(?:OOC|System|Note|Directive|Instruction|Length|Format|Style)?\s*[:,\-]?\s*([\s\S]+?)\)\)/gi,
    /\[\[\s*(?:OOC|System|Note|Directive|Instruction|Length|Format|Style)?\s*[:,\-]?\s*([\s\S]+?)\]\]/gi,
    
    // Single parentheses / brackets: (OOC: ...) or [OOC: ...] or [System Note: ...]
    /\(\s*(?:OOC|System\s*Note|System|Note|Directive|Instruction|Author\'?s?\s*Note)\s*[:,\-]?\s*([\s\S]+?)\)/gi,
    /\[\s*(?:OOC|System\s*Note|System|Note|Directive|Instruction|Author\'?s?\s*Note|Length|Format|Style)\s*[:,\-]?\s*([\s\S]+?)\]/gi,
    
    // Braces syntax: {length: short}, {style: ...}, {{OOC: ...}}
    /\{\{\s*(?:OOC|System|Note|Directive|Instruction|Length|Format|Style)?\s*[:,\-]?\s*([\s\S]+?)\}\}/gi,
    /\{\s*([a-zA-Z0-9_\-\s]{2,25}?)\s*:\s*([^\}]+?)\s*\}/gi,
    
    // XML / Tag format: <ooc>...</ooc>, <system>...</system>
    /<(?:ooc|system|note|instruction)>([\s\S]+?)<\/(?:ooc|system|note|instruction)>/gi,
    
    // Line-level prefix: OOC: ..., System Note: ..., Note: ...
    /(?:^|\n)\s*(?:OOC|System Note|Directive|Instruction)\s*:\s*(.+)/gi
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let cleaned = '';
      if (match[2]) {
        // From {key: value} format
        cleaned = `${match[1].trim()}: ${match[2].trim()}`;
      } else if (match[1]) {
        cleaned = match[1].trim();
      }

      if (cleaned.length >= 2) {
        // Strip leading colons or hyphens if matched loosely
        cleaned = cleaned.replace(/^[:\-\s]+/, '').trim();
        if (cleaned.length >= 2 && !rules.some(r => r.toLowerCase() === cleaned.toLowerCase())) {
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

export function formatRuleForContinuity(rule: string): string {
  const lower = rule.toLowerCase().trim();
  if (lower.startsWith('length:') || lower.includes('length') || lower.includes('paragraphs') || lower.includes('short')) {
    if (lower.includes('short') || lower.includes('brief') || lower.includes('concise') || lower.includes('1 paragraph') || lower.includes('1-2 paragraphs') || lower.includes('tiny')) {
      return `Response Length: STRICT SHORT FORMAT (Limit entire output to 1-2 concise paragraphs maximum. Do not generate long text.)`;
    } else if (lower.includes('medium')) {
      return `Response Length: Medium (Keep response balanced, around 2-4 paragraphs).`;
    } else if (lower.includes('long') || lower.includes('detailed') || lower.includes('verbose')) {
      return `Response Length: Detailed and descriptive (Multi-paragraph immersive output).`;
    }
  }
  return rule;
}

// Generate in-context prompt anchor to reinforce active formatting, markdown syntax, and OOC on every turn (prevents Gemini reversion)
export function getActiveOOCAnchor(session: ChatSession): string {
  const activeOOC = session ? session.oocRules.filter(r => r.enabled) : [];
  const activeLore = session ? session.loreFacts.filter(f => f.enabled) : [];

  let anchor = '\n\n[Active Formatting & Character Persona Directive]:\n';
  anchor += '• Adhere strictly to character markdown syntax:\n';
  anchor += '  - Wrap all character actions, scene narration, and physical movements in *asterisks* (e.g. *she pauses, looking away*).\n';
  anchor += '  - Wrap all spoken dialogue in "double quotes" (e.g. "What do you mean?").\n';
  anchor += '  - Wrap inner thoughts, telepathy, or internal monologues in `backticks` (e.g. `I hope he didn\'t notice...`).\n';
  anchor += '• Maintain full immersion in character persona, lore, and speech habits without breaking character.\n';

  if (activeOOC.length > 0) {
    anchor += '\nActive Out-Of-Character (OOC) Rules:\n';
    for (const rule of activeOOC) {
      anchor += `• ${formatRuleForContinuity(rule.rule)}\n`;
    }
  }
  if (activeLore.length > 0) {
    anchor += '\nActive Lore & Context:\n';
    for (const fact of activeLore) {
      anchor += `• ${fact.key}: ${fact.value}\n`;
    }
  }

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

// Record turns asynchronously into session history (with smart regeneration overwriting)
export async function recordTurnsIntoSession(
  session: ChatSession,
  userText: string,
  assistantText: string,
  reasoningContent?: string
): Promise<void> {
  const now = Date.now();
  session.messages = session.messages || [];
  const msgs = session.messages;

  const trimmedUser = (userText || '').trim();
  const trimmedAssistant = (assistantText || '').trim();

  if (!trimmedAssistant && !trimmedUser) return;

  const len = msgs.length;

  // Case 1: Regeneration (The last message in history is the user message that prompted this regeneration)
  if (len >= 1 && msgs[len - 1].role === 'user' && msgs[len - 1].content.trim() === trimmedUser) {
    // Append the regenerated assistant response
    if (trimmedAssistant) {
      msgs.push({
        id: 'msg_' + hashString(trimmedAssistant + now).slice(0, 8),
        role: 'assistant',
        content: assistantText,
        reasoning_content: reasoningContent,
        timestamp: now
      });
    }
  }
  // Case 2: Overwrite existing assistant response if last turn matches
  else if (len >= 2 && msgs[len - 2].role === 'user' && msgs[len - 2].content.trim() === trimmedUser && msgs[len - 1].role === 'assistant') {
    msgs[len - 1].content = assistantText;
    msgs[len - 1].reasoning_content = reasoningContent;
    msgs[len - 1].timestamp = now;
  }
  // Case 3: Standard new conversation turn
  else {
    if (trimmedUser) {
      msgs.push({
        id: 'msg_' + hashString(trimmedUser + now).slice(0, 8),
        role: 'user',
        content: userText,
        timestamp: now
      });
    }
    if (trimmedAssistant) {
      msgs.push({
        id: 'msg_' + hashString(trimmedAssistant + now).slice(0, 8),
        role: 'assistant',
        content: assistantText,
        reasoning_content: reasoningContent,
        timestamp: now + 1
      });
    }
  }

  // Cap at last 2000 messages to stay safely within 1M token capacity
  if (msgs.length > 2000) {
    session.messages = msgs.slice(-2000);
  }

  await saveChatSession(session);
}

