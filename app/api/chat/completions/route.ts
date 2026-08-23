import { NextRequest } from 'next/server';
import { handleChatCompletions, handleOptions } from '@/lib/completions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  return handleChatCompletions(req);
}
