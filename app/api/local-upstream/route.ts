import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/completions';
import {
  getLocalOpenAIBaseUrl,
  setLocalOpenAIBaseUrl,
  clearLocalOpenAIBaseUrl,
  fetchLocalOpenAIModels,
} from '@/lib/localOpenAI';

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

  const baseUrl = await getLocalOpenAIBaseUrl(true);
  const models = baseUrl ? await fetchLocalOpenAIModels() : [];
  return NextResponse.json(
    {
      success: true,
      configured: Boolean(baseUrl),
      baseUrl,
      modelsCount: models.length,
      models: models.map((m) => m.id),
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      { error: { message: 'Unauthorized. Invalid or missing proxy key.' } },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid JSON body. Expected { "baseUrl": "https://.../v1" }.' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const rawUrl = body?.baseUrl || body?.url;
  if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl.trim())) {
    return NextResponse.json(
      { error: { message: 'baseUrl must start with http:// or https://' } },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const saved = await setLocalOpenAIBaseUrl(rawUrl);
  const models = await fetchLocalOpenAIModels();
  return NextResponse.json(
    {
      success: true,
      baseUrl: saved,
      reachable: models.length > 0,
      modelsCount: models.length,
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

  await clearLocalOpenAIBaseUrl();
  return NextResponse.json(
    { success: true, message: 'Local OpenAI bridge URL cleared.' },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
