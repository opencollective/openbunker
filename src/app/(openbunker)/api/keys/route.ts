import { prisma } from '@/lib/db';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { bytesToHex } from '@noble/hashes/utils';
import { NextRequest, NextResponse } from 'next/server';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get scope parameter from query string
    const { searchParams } = new URL(request.url);
    const scopeSlug = searchParams.get('scope');

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      email: user.email,
    };

    // Add scope filter if provided
    if (scopeSlug) {
      whereClause.scopeSlug = scopeSlug;
    }

    // Get all keys associated with this user (optionally filtered by scope)
    const userKeys = await prisma.keys.findMany({
      where: whereClause,
      select: {
        npub: true,
        name: true,
        email: true,
        scopeSlug: true,
      },
    });

    return NextResponse.json({ keys: userKeys });
  } catch (error) {
    console.error('Error fetching user keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { scope } = body;

    if (!scope) {
      return NextResponse.json({ error: 'Scope is required' }, { status: 400 });
    }

    // Generate a new Nostr key pair
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(publicKey);

    // Create name using scope + email
    const keyName = `${scope}-${user.email}`;

    // Create the key in the Keys table
    const key = await prisma.keys.create({
      data: {
        npub: npub,
        name: keyName,
        email: user.email || '',
        scopeSlug: scope,
        relays: [],
        enckey: '',
        profile: undefined,
        // Should this be encrypted
        ncryptsec: bytesToHex(secretKey),
        localKey: undefined,
      },
    });

    // Associate the key with the user
    const userKey = await prisma.userKeys.create({
      data: {
        userId: user.id,
        npub: npub,
        name: keyName,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      key: {
        ...userKey,
        key: key,
      },
    });
  } catch (error) {
    console.error('Error creating key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
