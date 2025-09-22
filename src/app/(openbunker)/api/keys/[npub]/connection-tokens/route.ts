import { prisma } from '@/lib/db';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const TOKEN_SIZE = 16;
const TOKEN_TTL = 600000; // 10 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ npub: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { npub } = await params;

    // Verify the user has access to this key
    const userKey = await prisma.keys.findFirst({
      where: {
        email: user.email,
        npub: npub,
      },
    });

    if (!userKey) {
      return NextResponse.json(
        { error: 'Key not found or access denied' },
        { status: 404 }
      );
    }

    // Get connection tokens for this npub
    const connectionTokens = await prisma.connectTokens.findMany({
      where: {
        npub: npub,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Get the key information to check if it belongs to a scope
    const keyInfo = await prisma.keys.findUnique({
      where: {
        npub: npub,
      },
      select: {
        scopeSlug: true,
      },
    });

    // If the key belongs to a scope, get the scope's keyNpub
    let scopeKeyNpub = null;
    if (keyInfo?.scopeSlug) {
      const scope = await prisma.scopes.findUnique({
        where: {
          slug: keyInfo.scopeSlug,
        },
        select: {
          keyNpub: true,
        },
      });
      scopeKeyNpub = scope?.keyNpub || null;
    }

    // Transform the data to be more frontend-friendly
    const tokens = connectionTokens.map(
      (token: {
        token: string;
        npub: string;
        subNpub: string | null;
        timestamp: bigint;
        expiry: bigint;
        jsonData: string | null;
      }) => ({
        token: token.token,
        npub: token.npub,
        subNpub: token.subNpub,
        timestamp: Number(token.timestamp),
        expiry: Number(token.expiry),
        jsonData: token.jsonData ? JSON.parse(token.jsonData) : null,
        isExpired: Number(token.expiry) < Date.now(),
        scopeKeyNpub: scopeKeyNpub, // Include the scope's key for bunker URL generation
      })
    );

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error fetching connection tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ npub: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { npub } = await params;
    const body = await request.json();
    const { subNpub } = body;

    // Verify the user has access to this key
    const userKey = await prisma.keys.findFirst({
      where: {
        email: user.email,
        npub: npub,
      },
    });

    if (!userKey) {
      return NextResponse.json(
        { error: 'Key not found or access denied' },
        { status: 404 }
      );
    }

    // Generate a new connection token
    const token = randomBytes(TOKEN_SIZE).toString('hex');
    const timestamp = BigInt(Date.now());
    const expiry = BigInt(Date.now() + TOKEN_TTL);

    // Create the connection token in the database
    const newToken = await prisma.connectTokens.create({
      data: {
        token,
        npub,
        subNpub: subNpub || null,
        timestamp,
        expiry,
        jsonData: JSON.stringify({}),
      },
    });

    // Return the created token
    const responseToken = {
      token: newToken.token,
      npub: newToken.npub,
      subNpub: newToken.subNpub,
      timestamp: Number(newToken.timestamp),
      expiry: Number(newToken.expiry),
      jsonData: newToken.jsonData ? JSON.parse(newToken.jsonData) : null,
      isExpired: false,
    };

    return NextResponse.json({ token: responseToken });
  } catch (error) {
    console.error('Error creating connection token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ npub: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { npub } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter is required' },
        { status: 400 }
      );
    }

    // Verify the user has access to this key
    const userKey = await prisma.keys.findFirst({
      where: {
        email: user.email,
        npub: npub,
      },
    });

    if (!userKey) {
      return NextResponse.json(
        { error: 'Key not found or access denied' },
        { status: 404 }
      );
    }

    // Verify the token belongs to this npub
    const tokenRecord = await prisma.connectTokens.findFirst({
      where: {
        token,
        npub,
      },
    });

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    // Delete the token
    await prisma.connectTokens.delete({
      where: {
        token,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
