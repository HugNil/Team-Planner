import { NextResponse } from 'next/server';
import { requireClubAccess } from '@/app/lib/admin-auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clubId = String(body.clubId ?? '');
    const access = await requireClubAccess(clubId, ['ADMIN']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const nickname = String(body.nickname ?? '').trim();
    const number = body.number ? Number(body.number) : null;

    if (!firstName) {
      return NextResponse.json({ error: 'Förnamn krävs' }, { status: 400 });
    }

    const player = await prisma.player.create({
      data: { clubId, firstName, lastName, nickname: nickname || null, number },
    });

    return NextResponse.json(player, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const playerId = String(body.playerId ?? '');
    const player = await prisma.player.findUnique({ where: { id: playerId } });

    if (!player) {
      return NextResponse.json({ error: 'Spelaren hittades inte' }, { status: 404 });
    }

    const access = await requireClubAccess(player.clubId, ['ADMIN']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    const updated = await prisma.player.update({
      where: { id: playerId },
      data: {
        firstName: String(body.firstName ?? player.firstName).trim(),
        lastName: String(body.lastName ?? player.lastName).trim(),
        nickname: body.nickname === undefined ? player.nickname : String(body.nickname ?? '').trim() || null,
        number: body.number === undefined ? player.number : body.number === '' || body.number === null ? null : Number(body.number),
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId') ?? '';
    const player = await prisma.player.findUnique({ where: { id: playerId } });

    if (!player) {
      return NextResponse.json({ error: 'Spelaren hittades inte' }, { status: 404 });
    }

    const access = await requireClubAccess(player.clubId, ['ADMIN']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    await prisma.player.delete({ where: { id: playerId } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
