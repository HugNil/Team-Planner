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

    const name = String(body.name ?? '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Lagnamn krävs' }, { status: 400 });
    }

    const team = await prisma.team.create({
      data: {
        clubId,
        name,
        swebowlTeamId: body.swebowlTeamId ? String(body.swebowlTeamId).trim() : null,
        sortOrder: Number(body.sortOrder ?? 0),
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const teamId = String(body.teamId ?? '');
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      return NextResponse.json({ error: 'Laget hittades inte' }, { status: 404 });
    }

    const access = await requireClubAccess(team.clubId, ['ADMIN']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        name: String(body.name ?? team.name).trim(),
        swebowlTeamId: body.swebowlTeamId === '' ? null : String(body.swebowlTeamId ?? team.swebowlTeamId ?? '').trim() || null,
        sortOrder: Number(body.sortOrder ?? team.sortOrder),
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
    const teamId = searchParams.get('teamId') ?? '';
    const team = await prisma.team.findUnique({ where: { id: teamId } });

    if (!team) {
      return NextResponse.json({ error: 'Laget hittades inte' }, { status: 404 });
    }

    const access = await requireClubAccess(team.clubId, ['ADMIN']);

    if (!access) {
      return NextResponse.json({ error: 'Saknar behörighet' }, { status: 403 });
    }

    await prisma.team.delete({ where: { id: teamId } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
