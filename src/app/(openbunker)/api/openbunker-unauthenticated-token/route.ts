import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

const TOKEN_SIZE = 16;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user with this email already exists in the system
    const existingKey = await prisma.keys.findFirst({
      where: { email: email },
    });

    if (existingKey) {
      // User exists, redirect to sign in
      const response = NextResponse.json({
        success: false,
        message:
          'User with this email already exists. Please sign in to continue.',
        redirectUrl: `${process.env.NEXT_PUBLIC_OPENBUNKER_URL}/openbunker-login-popup`,
        existingUser: true,
      });

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      );
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

      return response;
    }

    // Generate a new Nostr key pair for the new user
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(publicKey);

    // Generate a connection token
    const connectionToken = randomBytes(TOKEN_SIZE).toString('hex');

    // Create the key in the database
    const newKey = await prisma.keys.create({
      data: {
        npub: npub,
        name: name || 'My Key',
        email: email,
        relays: [],
        enckey: '',
        profile: { name: name || 'My Key' },
        ncryptsec: Buffer.from(secretKey).toString('hex'),
      },
    });

    // Create a connection token record
    await prisma.connectTokens.create({
      data: {
        token: connectionToken,
        npub: npub,
        timestamp: BigInt(Date.now()),
        expiry: BigInt(Date.now() + 600000), // 10 minutes
        subNpub: null,
        jsonData: JSON.stringify({ email, name }),
      },
    });

    // Generate the bunker connection token in the same format as the popup
    const relay = encodeURIComponent(
      process.env.NEXT_PUBLIC_BUNKER_RELAYS || 'wss://relay.nsec.app'
    );
    const bunkerConnectionToken = `bunker://${publicKey}?relay=${relay}&secret=${connectionToken}`;

    const response = NextResponse.json({
      success: true,
      message: 'New user key created successfully',
      bunkerConnectionToken,
      npub,
      connectionToken,
      keyId: newKey.npub,
      existingUser: false,
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
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      const response = NextResponse.json(
        { error: 'Email parameter is required' },
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

    // Check if user exists
    const existingKey = await prisma.keys.findFirst({
      where: { email: email },
    });

    if (existingKey) {
      const response = NextResponse.json({
        exists: true,
        npub: existingKey.npub,
        name: existingKey.name,
        message: 'User with this email already exists',
      });

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      );
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

      return response;
    }

    const response = NextResponse.json({
      exists: false,
      message: 'No user found with this email',
    });

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Error checking user existence:', error);
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
