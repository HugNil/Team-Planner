import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth';
import { authService } from '@/app/lib/services/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Old password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    await authService.changePassword(session.user.id, oldPassword, newPassword);

    return NextResponse.json(
      { message: 'Password changed successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Change password error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      if (error.message === 'Invalid old password') {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
