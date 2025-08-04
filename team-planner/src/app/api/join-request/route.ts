import { NextRequest, NextResponse } from 'next/server';
import {
  createJoinRequest,
  listPending,
  approveRequest
} from '@/app/lib/services/joinRequest';

export async function POST(req: NextRequest) {
  // Skapa en ny request
  const { email, name, clubId } = await req.json();
  try {
    const jr = await createJoinRequest(email, name, clubId);
    return NextResponse.json(jr, { status: 201 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  // TODO: Implement proper session handling for App Router
  // For now, return mock data or require clubId in query params
  const { searchParams } = new URL(req.url);
  const clubId = searchParams.get('clubId');
  
  if (!clubId) {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 });
  }
  
  const pending = await listPending(clubId);
  return NextResponse.json(pending);
}

export async function PATCH(req: NextRequest) {
  const { requestId } = await req.json();
  try {
    const jr = await approveRequest(requestId);
    return NextResponse.json(jr);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
