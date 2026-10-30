import { NextRequest, NextResponse } from 'next/server';
import { getImage } from '@/lib/imageGeneration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const image = await getImage(id);

  if (!image) {
    return new NextResponse('Image not found or expired', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    status: 200,
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': image.buffer.length.toString(),
      'Cache-Control': 'public, max-age=86400, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
