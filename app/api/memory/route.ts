import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { checkAuth } from '@/lib/completions';
import {
  listAllSessions,
  getOrCreateChatSession,
  saveChatSession,
  deleteChatSession,
  isRedisConfigured,
  ChatSession,
  OOCRule,
  LoreFact
} from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, x-api-key',
    },
  });
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid or missing proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');

  const sessions = await listAllSessions();

  if (chatId) {
    const session = sessions.find(s => s.id === chatId);
    if (!session) {
      return NextResponse.json(
        { error: { message: 'Session not found.' } },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }
    return NextResponse.json(
      {
        session,
        storageMode: isRedisConfigured() ? 'Upstash Redis (Cloud)' : 'In-Memory Store (Ephemeral)'
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // Group by character
  const charMap = new Map<string, { characterId: string; characterName: string; chatCount: number; lastActive: number; oocRuleCount: number }>();
  let totalOOC = 0;
  let totalArchivedMessages = 0;

  for (const s of sessions) {
    totalOOC += (s.oocRules || []).length;
    totalArchivedMessages += (s.messages || []).length;

    const existing = charMap.get(s.characterId);
    if (existing) {
      existing.chatCount++;
      if (s.updatedAt > existing.lastActive) existing.lastActive = s.updatedAt;
      existing.oocRuleCount += (s.oocRules || []).length;
    } else {
      charMap.set(s.characterId, {
        characterId: s.characterId,
        characterName: s.characterName || 'Unknown Character',
        chatCount: 1,
        lastActive: s.updatedAt,
        oocRuleCount: (s.oocRules || []).length
      });
    }
  }

  return NextResponse.json(
    {
      characters: Array.from(charMap.values()).sort((a, b) => b.lastActive - a.lastActive),
      sessions: sessions.map(s => {
        const msgs = s.messages || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const totalChars = msgs.reduce((acc, m) => acc + (m.content?.length || 0), 0);
        return {
          id: s.id,
          characterId: s.characterId,
          characterName: s.characterName || 'Unknown Character',
          title: s.title || 'Chat Session',
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          oocCount: (s.oocRules || []).length,
          loreCount: (s.loreFacts || []).length,
          messageCount: msgs.length,
          estimatedTokens: Math.floor(totalChars / 4),
          lastMessagePreview: lastMsg ? `${lastMsg.role === 'user' ? 'User' : s.characterName}: ${lastMsg.content.slice(0, 75).replace(/[\r\n]+/g, ' ')}...` : 'Empty session'
        };
      }),
      stats: {
        totalCharacters: charMap.size,
        totalSessions: sessions.length,
        totalOOCRules: totalOOC,
        totalArchivedMessages,
        storageMode: isRedisConfigured() ? 'Upstash Redis (Cloud)' : 'In-Memory Store (Ephemeral)',
        redisConnected: isRedisConfigured()
      }
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid JSON body.' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const { action, chatId } = body;
  if (!chatId) {
    return NextResponse.json(
      { error: { message: 'Missing chatId parameter.' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const sessions = await listAllSessions();
  let session = sessions.find(s => s.id === chatId);

  if (!session) {
    session = await getOrCreateChatSession(chatId, body.characterId || 'char_default', body.characterName || 'Character', 'New Chat');
  }

  if (action === 'add_ooc') {
    const ruleText = (body.rule || '').trim();
    if (!ruleText) {
      return NextResponse.json({ error: { message: 'Rule text cannot be empty.' } }, { status: 400 });
    }
    const newRule: OOCRule = {
      id: 'ooc_' + crypto.randomUUID().slice(0, 8),
      rule: ruleText,
      enabled: true,
      addedAt: Date.now(),
      source: 'manual'
    };
    session.oocRules = session.oocRules || [];
    session.oocRules.push(newRule);
    await saveChatSession(session);
    return NextResponse.json({ success: true, rule: newRule, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'toggle_ooc') {
    const { ruleId, enabled } = body;
    const rule = (session.oocRules || []).find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled !== undefined ? enabled : !rule.enabled;
      await saveChatSession(session);
    }
    return NextResponse.json({ success: true, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'delete_ooc') {
    const { ruleId } = body;
    session.oocRules = (session.oocRules || []).filter(r => r.id !== ruleId);
    await saveChatSession(session);
    return NextResponse.json({ success: true, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'add_lore') {
    const key = (body.key || '').trim();
    const value = (body.value || '').trim();
    if (!key || !value) {
      return NextResponse.json({ error: { message: 'Key and Value are required.' } }, { status: 400 });
    }
    const newFact: LoreFact = {
      id: 'lore_' + crypto.randomUUID().slice(0, 8),
      key,
      value,
      enabled: true,
      addedAt: Date.now()
    };
    session.loreFacts = session.loreFacts || [];
    session.loreFacts.push(newFact);
    await saveChatSession(session);
    return NextResponse.json({ success: true, fact: newFact, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'toggle_lore') {
    const { factId, enabled } = body;
    const fact = (session.loreFacts || []).find(f => f.id === factId);
    if (fact) {
      fact.enabled = enabled !== undefined ? enabled : !fact.enabled;
      await saveChatSession(session);
    }
    return NextResponse.json({ success: true, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'delete_lore') {
    const { factId } = body;
    session.loreFacts = (session.loreFacts || []).filter(f => f.id !== factId);
    await saveChatSession(session);
    return NextResponse.json({ success: true, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'update_title') {
    const title = (body.title || '').trim();
    if (title) {
      session.title = title;
      await saveChatSession(session);
    }
    return NextResponse.json({ success: true, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  if (action === 'clear_history') {
    session.messages = [];
    session.messageCount = 0;
    await saveChatSession(session);
    return NextResponse.json({ success: true, session }, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  return NextResponse.json({ error: { message: `Unknown action: ${action}` } }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return NextResponse.json(
      { error: { message: 'Missing chatId parameter.' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const success = await deleteChatSession(chatId);
  return NextResponse.json(
    { success, message: `Chat session ${chatId} deleted.` },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
