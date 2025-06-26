import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for verification codes (in production, use a database)
const verificationCodes = new Map<string, { code: string; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store the code with 5-minute expiration
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
    verificationCodes.set(email, { code, expires });

    // In a real application, you would send this code via email
    // For now, we'll just log it to the console
    console.log(`Verification code for ${email}: ${code}`);

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      message: 'Verification code sent successfully',
      // In development, include the code for testing
      ...(process.env.NODE_ENV === 'development' && { code })
    });

  } catch (error) {
    console.error('Error sending verification code:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code' },
      { status: 500 }
    );
  }
} 