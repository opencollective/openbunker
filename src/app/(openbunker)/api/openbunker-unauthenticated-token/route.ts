import { prisma } from '@/lib/db';
import { NIP46_RELAYS } from '@/lib/nostr/consts';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { nip19 } from 'nostr-tools';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Initialize Supabase client
    const supabase = await createServerSupabaseClient();

    // Get scope from request body, default to 'community-requests' if not provided
    const scope = body.scope;
    // Get scope configuration from database using Prisma
    let scopeConfig = null;
    if (scope) {
      scopeConfig = await prisma.scopes.findUnique({
        where: {
          slug: scope,
        },
      });
    }
    console.log('scopeConfig', scopeConfig, scope);
    // Send OTP to email
    const { error: otpSendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_DEPLOY_URL || window.location.origin}`,
      },
    });

    if (otpSendError) {
      const response = NextResponse.json(
        {
          error: 'Failed to send OTP. Please try again.',
        },
        { status: 400 }
      );

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      );
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

      return response;
    }
    let bunkerConnectionToken;
    if (scopeConfig == null) {
      bunkerConnectionToken = `bunker://${process.env.NEXT_PUBLIC_BUNKER_PUBHEX}?relay=${NIP46_RELAYS}`;
    } else {
      const pubKey = nip19.decode(scopeConfig.keyNpub);
      bunkerConnectionToken = `bunker://${pubKey.data}?relay=${NIP46_RELAYS}`;
    }

    const response = NextResponse.json({
      success: true,
      message:
        'OTP sent to your email. Please check your inbox and click the link to continue.',
      bunkerConnectionToken: bunkerConnectionToken,
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Error creating unauthenticated token:', error);
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 });

  // Add CORS headers for preflight requests
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
}
