import { NextRequest, NextResponse } from 'next/server';
import {
  getGlobalGenSettings,
  saveGlobalGenSettings,
  resetGlobalGenSettings,
  DEFAULT_GENERATION_SETTINGS,
  GenerationSettings
} from '@/lib/genSettings';
import { checkAuth } from '@/lib/completions';

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
      { error: { message: 'Unauthorized. Invalid proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const settings = await getGlobalGenSettings();
  return NextResponse.json(
    {
      success: true,
      settings,
      defaults: DEFAULT_GENERATION_SETTINGS
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const body = await req.json();

    if (body.action === 'reset') {
      const reset = await resetGlobalGenSettings();
      return NextResponse.json(
        { success: true, settings: reset },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (body.settings && typeof body.settings === 'object') {
      await saveGlobalGenSettings(body.settings);
      const updated = await getGlobalGenSettings(true);
      return NextResponse.json(
        { success: true, settings: updated },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return NextResponse.json(
      { error: 'Invalid payload. Provide "settings" object or { action: "reset" }.' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const reset = await resetGlobalGenSettings();
  return NextResponse.json(
    { success: true, settings: reset },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
