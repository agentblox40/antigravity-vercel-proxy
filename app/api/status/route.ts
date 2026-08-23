import { NextRequest, NextResponse } from 'next/server';
import { getAccounts, getAntigravityLiveModels } from '@/lib/antigravity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const accounts = getAccounts();
  const now = Date.now();
  const models = await getAntigravityLiveModels();

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
      version: '2.0.0',
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
