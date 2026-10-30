import { NextRequest, NextResponse } from 'next/server';
import { checkAuth, handleOptions } from '@/lib/completions';
import { executeImageGeneration, ALLOWED_IMAGE_MODEL } from '@/lib/imageGeneration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json(
      {
        error: {
          message: 'Unauthorized. Invalid or missing API key.',
          type: 'invalid_request_error',
          code: 401,
        },
      },
      { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid JSON body.',
          type: 'invalid_request_error',
          code: 400,
        },
      },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const prompt = (body.prompt || '').trim();
  if (!prompt) {
    return NextResponse.json(
      {
        error: {
          message: "Missing required parameter 'prompt'.",
          type: 'invalid_request_error',
          param: 'prompt',
          code: 400,
        },
      },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const requestedModel = (body.model || ALLOWED_IMAGE_MODEL).trim();
  if (requestedModel !== ALLOWED_IMAGE_MODEL) {
    return NextResponse.json(
      {
        error: {
          message: `[Model Error]: Unsupported model '${requestedModel}'. Only '${ALLOWED_IMAGE_MODEL}' is supported for image generation.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_supported',
        },
      },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    'antigravity-vercel-proxy-three.vercel.app';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  try {
    const result = await executeImageGeneration(
      {
        prompt,
        model: requestedModel,
        n: body.n,
        size: body.size,
        response_format: body.response_format,
      },
      origin
    );

    return NextResponse.json(result, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: {
          message: err?.message || 'Failed to generate image.',
          type: 'api_error',
          code: 500,
        },
      },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
