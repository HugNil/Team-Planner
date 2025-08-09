import { NextResponse } from 'next/server';

// Standardized error handling for API routes
export function handleApiError(error: unknown, message?: string) {
  console.error('API Error:', error);
  
  const errorMessage = error instanceof Error ? error.message : message || 'Unknown error';

  // Prisma-specific errors
  if (error instanceof Error) {
    if (error.message.includes('Unique constraint failed')) {
      return NextResponse.json({ 
        error: 'A record with these details already exists' 
      }, { status: 409 });
    }
    
    if (error.message.includes('Foreign key constraint failed')) {
      return NextResponse.json({ 
        error: 'Referenced record does not exist' 
      }, { status: 400 });
    }
    
    if (error.message.includes('Record to update not found')) {
      return NextResponse.json({ 
        error: 'Record not found' 
      }, { status: 404 });
    }
  }
  
  return NextResponse.json({ error: errorMessage }, { status: 500 });
}

// Validation for API inputs
export const validators = {
  email: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  clubCode: (code: string) => {
    // 3-6 characters
    const codeRegex = /^[A-Z0-9]{3,6}$/;
    return codeRegex.test(code.toUpperCase());
  },
  
  playerNumber: (number: number) => {
    return number >= 1 && number <= 99;
  },
  
  required: (value: any) => {
    return value !== null && value !== undefined && value !== '';
  }
};

export function extractClubIdFromSession(/* session: any */) {
  // TODO: Implement when next-auth is set up
  return null;
}

export function hasClubAccess(/* session: any, clubId: string */) {
  // TODO: Implement access check based on session
  return true; // Temporary
}

// Utility functions for formatting responses
export function formatPlayerResponse(player: any) {
  return {
    ...player,
    fullName: `${player.firstName} ${player.lastName}`,
    displayName: player.number ? `#${player.number} ${player.firstName} ${player.lastName}` : `${player.firstName} ${player.lastName}`
  };
}

export function formatMatchResponse(match: any) {
  return {
    ...match,
    displayName: `${match.homeTeam} vs ${match.awayTeam}`,
    isUpcoming: new Date(match.date) > new Date(),
    assignedPlayersCount: match.assignments?.length || 0
  };
}
