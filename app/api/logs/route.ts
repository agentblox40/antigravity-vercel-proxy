import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/completions';
import { getUpstreamLogs, clearUpstreamLogs } from '@/lib/proxyLogs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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
  const limitParam = Number(searchParams.get('limit') || '50');
  const statusParam = searchParams.get('status');
  const trapOnly = searchParams.get('trapOnly') === 'true' || searchParams.get('trapOnly') === '1';

  const status = statusParam ? Number(statusParam) : undefined;
  const logs = await getUpstreamLogs(Number.isFinite(limitParam) ? limitParam : 50, {
    status: status !== undefined && Number.isFinite(status) ? status : undefined,
    trapOnly,
  });

  return NextResponse.json(
    {
      success: true,
      count: logs.length,
      logs,
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid or missing proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  await clearUpstreamLogs();
  return NextResponse.json(
    { success: true, message: 'Upstream logs cleared.' },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
