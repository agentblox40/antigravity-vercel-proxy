import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/completions';
import {
  listSessionOverviews,
  listAllSessions,
  getSessionById,
  getOrCreateChatSession,
  saveChatSession,
  deleteChatSession,
  deleteAllChatSessions,
  isRedisConfigured,
  ChatSession,
  SessionOverview
} from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  try {
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

    const overviews = await listSessionOverviews(100);

    // Group by character
    const charMap = new Map<string, { characterId: string; characterName: string; chatCount: number; lastActive: number }>();
    let totalArchivedMessages = 0;

    for (const o of overviews) {
      totalArchivedMessages += o.messageCount || 0;
      const charId = o.characterId || 'char_default';
      const existing = charMap.get(charId);
      if (existing) {
        existing.chatCount++;
        if ((o.updatedAt || 0) > existing.lastActive) existing.lastActive = o.updatedAt || 0;
      } else {
        charMap.set(charId, {
          characterId: charId,
          characterName: o.characterName || 'Unknown Character',
          chatCount: 1,
          lastActive: o.updatedAt || 0,
        });
      }
    }

    return NextResponse.json(
      {
        characters: Array.from(charMap.values()).sort((a, b) => b.lastActive - a.lastActive),
        sessions: overviews,
        stats: {
          totalCharacters: charMap.size,
          totalSessions: overviews.length,
          totalArchivedMessages,
          storageMode: isRedisConfigured() ? 'Upstash Redis (Cloud)' : 'In-Memory Store (Ephemeral)',
          redisConnected: isRedisConfigured()
        }
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err: any) {
    console.error('Error in /api/memory GET:', err);
    return NextResponse.json(
      { error: { message: err?.message || 'Internal error in memory route' } },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
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
  } catch (err: any) {
    console.error('Error in /api/memory POST:', err);
    return NextResponse.json(
      { error: { message: err?.message || 'Internal error processing memory POST' } },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
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
  } catch (err: any) {
    console.error('Error in /api/memory DELETE:', err);
    return NextResponse.json(
      { error: { message: err?.message || 'Internal error processing memory DELETE' } },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
