import { NextResponse } from 'next/server';

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

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: 'Generation settings page decommissioned. Pure client pass-through is active.',
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: true,
      message: 'Generation settings page decommissioned. Pure client pass-through is active.',
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: true,
      message: 'Generation settings page decommissioned. Pure client pass-through is active.',
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
