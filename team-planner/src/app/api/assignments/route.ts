import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Assignments API - GET' });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ message: 'Assignments API - POST' });
}