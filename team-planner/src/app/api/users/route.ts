import { NextRequest, NextResponse } from 'next/server';
import { 
  createUser, 
  getUserByEmail, 
  updateUser,
  assignUserToClub 
} from '@/app/lib/services/user';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role, clubId } = body;
    
    if (!email || !password || !role) {
      return NextResponse.json({ 
        error: 'email, password, and role are required' 
      }, { status: 400 });
    }

    const user = await createUser({ email, password, role, clubId });
    
    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, clubId, ...updateData } = body;
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'userId is required' 
      }, { status: 400 });
    }

    let user;
    if (clubId) {
      user = await assignUserToClub(userId, clubId);
    } else {
      user = await updateUser(userId, updateData);
    }
    
    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
