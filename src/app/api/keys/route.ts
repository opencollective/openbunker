import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/db';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all keys associated with this user
    const userKeys = await prisma.userKeys.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        key: true,
      },
      orderBy: {
        createdAt: 'desc',
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    // Generate a new Nostr key pair
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    const nsec = nip19.nsecEncode(secretKey);
    const npub = nip19.npubEncode(publicKey);

    // Create the key in the Keys table
    const key = await prisma.keys.create({
      data: {
        npub: npub,
        name: name || 'My Key',
        email: user.email || '',
        relays: [],
        enckey: '',
        profile: undefined,
        ncryptsec: undefined,
        localKey: undefined,
      },
    });

    // Associate the key with the user
    const userKey = await prisma.userKeys.create({
      data: {
        userId: user.id,
        npub: npub,
        name: name || 'My Key',
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      key: {
        ...userKey,
        key: key,
        secretKey: nsec, // Only return the secret key on creation
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