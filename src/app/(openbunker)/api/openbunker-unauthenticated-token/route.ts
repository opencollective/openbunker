import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

const TOKEN_SIZE = 16;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, scope } = body;
    let message = '';
    let existingUser = false;
    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user with this email already exists in the system with matching scope
    const existingKey = await prisma.keys.findFirst({
      where: {
        email: email,
        scopeSlug: scope,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let keyToReturn: any = existingKey;
    if (!existingKey) {
      message = 'New user key created successfully';
      // Generate a new Nostr key pair for the new user
      const secretKey = generateSecretKey();
      const publicKey = getPublicKey(secretKey);
      const npub = nip19.npubEncode(publicKey);
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
          scopeSlug: scope,
        },
      });
      keyToReturn = newKey;
      existingUser = false;
    } else {
      message = 'Existing user key found';
      existingUser = true;
    }
    const connectionToken = randomBytes(TOKEN_SIZE).toString('hex');
    // Create a connection token record
    const npub = keyToReturn?.npub;
    await prisma.connectTokens.create({
      data: {
        token: connectionToken,
        npub: npub,
        timestamp: BigInt(Date.now()),
        expiry: BigInt(Date.now() + 600000), // 10 minutes
        subNpub: null,
        jsonData: JSON.stringify({ email, name, scope }),
      },
    });

    // Generate the bunker connection token in the same format as the popup
    const relay = encodeURIComponent(
      process.env.NEXT_PUBLIC_BUNKER_RELAYS || 'wss://relay.nsec.app'
    );
    const publicKey = nip19.decode(keyToReturn.npub || '');
    const bunkerConnectionToken = `bunker://${publicKey.data}?relay=${relay}&secret=${connectionToken}`;

    const response = NextResponse.json({
      success: true,
      message,
      bunkerConnectionToken,
      npub,
      connectionToken,
      existingUser,
      scopeSlug: scope || null,
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
    const scope = searchParams.get('scope');

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

    // Check if user exists with matching scope
    const existingKey = await prisma.keys.findFirst({
      where: {
        email: email,
        scopeSlug: scope,
      },
    });

    if (existingKey) {
      const response = NextResponse.json({
        exists: true,
        npub: existingKey.npub,
        name: existingKey.name,
        scopeSlug: existingKey.scopeSlug,
        message: 'User with this email and scope already exists',
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
      message: 'No user found with this email and scope',
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
