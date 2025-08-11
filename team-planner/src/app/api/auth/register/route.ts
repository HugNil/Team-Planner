import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/app/lib/services/auth';
import { Role } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role, clubId } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Create user
    const user = await authService.createUser({
      email,
      password,
      role: role as Role || Role.SELECTOR,
      clubId
    });

    // Don't return sensitive information
    const { ...safeUser } = user;
    
    return NextResponse.json(
      { 
        message: 'User created successfully', 
        user: safeUser 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User already exists with this email') {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
