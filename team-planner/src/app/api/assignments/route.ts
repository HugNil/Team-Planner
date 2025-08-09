import { NextRequest, NextResponse } from 'next/server';
import { 
  createAssignment, 
  getAssignmentsForMatch, 
  updateAssignmentStatus,
  bulkCreateAssignments 
} from '@/app/lib/services/assignment';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('matchId');
    
    if (!matchId) {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }

    const assignments = await getAssignmentsForMatch(matchId);
    return NextResponse.json(assignments);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bulk } = body;
    
    // Bulk creation for multiple assignments
    if (bulk && Array.isArray(body.assignments)) {
      const result = await bulkCreateAssignments(body.assignments);
      return NextResponse.json(result, { status: 201 });
    }
    
    // Single assignment creation
    const { matchId, playerId, position } = body;
    
    if (!matchId || !playerId) {
      return NextResponse.json({ 
        error: 'matchId and playerId are required' 
      }, { status: 400 });
    }

    const assignment = await createAssignment({
      matchId,
      playerId,
      position
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { assignmentId, status } = body;
    
    if (!assignmentId || !status) {
      return NextResponse.json({ 
        error: 'assignmentId and status are required' 
      }, { status: 400 });
    }

    const assignment = await updateAssignmentStatus(assignmentId, status);
    return NextResponse.json(assignment);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}