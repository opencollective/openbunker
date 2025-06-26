import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for verification codes (in production, use a database)
const verificationCodes = new Map<string, { code: string; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Get stored verification data
    const storedData = verificationCodes.get(email);
    
    if (!storedData) {
      return NextResponse.json(
        { error: 'No verification code found for this email' },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (Date.now() > storedData.expires) {
      verificationCodes.delete(email);
      return NextResponse.json(
        { error: 'Verification code has expired' },
        { status: 400 }
      );
    }

    // Verify the code
    if (storedData.code !== code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Code is valid - create user session
    const user = {
      id: `user_${Date.now()}`,
      email,
      name: email.split('@')[0], // Use email prefix as name
      created_at: new Date().toISOString(),
      // In a real app, you might generate a Nostr keypair here
      nostr_pubkey: `npub1${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
    };

    // Remove the used verification code
    verificationCodes.delete(email);

    return NextResponse.json(user);

  } catch (error) {
    console.error('Error verifying code:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
} 