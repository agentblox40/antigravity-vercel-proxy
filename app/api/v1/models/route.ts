import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_MODELS } from '@/lib/antigravity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const proxyKey = process.env.PROXY_API_KEY;
  if (!proxyKey) return true;
  const authHeader = req.headers.get('authorization') || '';
  const customKey = req.headers.get('api-key') || req.headers.get('x-api-key') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : customKey;
  return token === proxyKey;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, api-key, x-api-key',
    },
  });
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Invalid or missing Proxy API Key.', type: 'invalid_request_error', code: 'unauthorized' } },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      object: 'list',
      data: SUPPORTED_MODELS.map((m) => ({
        id: m.id,
        object: 'model',
        created: 1710000000,
        owned_by: 'google-antigravity',
        permission: [],
        root: m.id,
        parent: null,
      })),
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
