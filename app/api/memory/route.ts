import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/completions';
import {
  listAllSessions,
  getSessionById,
  getOrCreateChatSession,
  saveChatSession,
  deleteChatSession,
  deleteAllChatSessions,
  isRedisConfigured,
  ChatSession
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

  if (chatId) {
    const session = await getSessionById(chatId);
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

  const sessions = await listAllSessions();

  // Group by character
  const charMap = new Map<string, { characterId: string; characterName: string; chatCount: number; lastActive: number }>();
  let totalArchivedMessages = 0;

  for (const s of sessions) {
    totalArchivedMessages += (s.messages || []).length;

    const existing = charMap.get(s.characterId);
    if (existing) {
      existing.chatCount++;
      if (s.updatedAt > existing.lastActive) existing.lastActive = s.updatedAt;
    } else {
      charMap.set(s.characterId, {
        characterId: s.characterId,
        characterName: s.characterName || 'Unknown Character',
        chatCount: 1,
        lastActive: s.updatedAt,
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
          messages: msgs,
          messageCount: msgs.length,
          estimatedTokens: Math.floor(totalChars / 4),
          lastMessagePreview: lastMsg ? `${lastMsg.role === 'user' ? 'User' : s.characterName}: ${lastMsg.content.slice(0, 75).replace(/[\r\n]+/g, ' ')}...` : 'Empty session'
        };
      }),
      stats: {
        totalCharacters: charMap.size,
        totalSessions: sessions.length,
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

  let session = await getSessionById(chatId);

  if (!session) {
    session = await getOrCreateChatSession(chatId, body.characterId || 'char_default', body.characterName || 'Character', 'New Chat');
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
  const deleteAll = searchParams.get('all') === 'true';

  if (deleteAll) {
    const success = await deleteAllChatSessions();
    return NextResponse.json(
      { success, message: 'All logged chat sessions deleted successfully.' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  if (!chatId) {
    return NextResponse.json(
      { error: { message: 'Missing chatId parameter or all=true.' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const success = await deleteChatSession(chatId);
  return NextResponse.json(
    { success, message: `Chat session ${chatId} deleted.` },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
