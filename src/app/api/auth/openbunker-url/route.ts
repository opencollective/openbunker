import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // This would typically be configured based on your OpenBunker setup
    // For now, we'll use a placeholder URL
    const authUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/openbunker-auth`;
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating OpenBunker auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
} 