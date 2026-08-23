import { NextRequest, NextResponse } from 'next/server';
import { getAccounts, getAntigravityLiveModels } from '@/lib/antigravity';
import { getDeploymentTelemetry, CURRENT_VERSION } from '@/lib/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest): boolean {
  const proxyKey = process.env.PROXY_API_KEY;
  if (!proxyKey) return true;
  const authHeader = req.headers.get('authorization') || '';
  const customKey = req.headers.get('api-key') || req.headers.get('x-api-key') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : customKey.trim();
  return token === proxyKey.trim();
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
      {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }

  const accounts = getAccounts();
  const now = Date.now();
  const models = await getAntigravityLiveModels();
  const deployment = getDeploymentTelemetry();

  const accountStatus = accounts.map((acc, idx) => ({
    id: acc.id,
    name: acc.name,
    projectId: acc.projectId || 'Auto-Discovered',
    status: acc.cooldownUntil > now ? 'Cooldown' : 'Ready',
    cooldownRemainingSec: Math.max(0, Math.ceil((acc.cooldownUntil - now) / 1000)),
    failCount: acc.failCount,
  }));

  return NextResponse.json(
    {
      status: 'online',
      timestamp: now,
      accounts: accountStatus,
      totalAccounts: accounts.length,
      modelsCount: models.length,
      supportedModels: models,
      version: CURRENT_VERSION,
      deployment,
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

