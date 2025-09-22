import { prisma } from '@/lib/db';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { bytesToHex } from '@noble/hashes/utils';
import { randomBytes } from 'crypto';
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get('queryType') || 'owner';

    // Validate queryType parameter
    if (queryType !== 'all' && queryType !== 'owner') {
      return NextResponse.json(
        { error: 'Invalid queryType. Must be "all" or "owner"' },
        { status: 400 }
      );
    }

    // Build where clause based on queryType
    const whereClause = queryType === 'owner' ? { owner: user.id } : {}; // Empty object for 'all' - gets all scopes

    // Get scopes based on queryType
    const scopes = await prisma.scopes.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ scopes: scopes });
  } catch (error) {
    console.error('Error fetching scopes:', error);
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
    const { name, description, slug } = body;

    if (!name || !description || !slug) {
      return NextResponse.json(
        { error: 'Name, description, and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingScope = await prisma.scopes.findUnique({
      where: {
        slug: slug,
      },
    });

    if (existingScope) {
      return NextResponse.json(
        { error: 'Scope slug already exists' },
        { status: 409 }
      );
    }

    // Generate a new Nostr key pair for the scope
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    const npub = nip19.npubEncode(publicKey);

    // Generate a unique ID for the scope
    const scopeId = randomBytes(16).toString('hex');

    // Generate nsec for storage
    const nsec = nip19.nsecEncode(secretKey);

    // Create the key in the Keys table first
    const key = await prisma.keys.create({
      data: {
        npub: npub,
        nsec: nsec, // Store the nsec format
        name: `${name} Scope Key`,
        relays: ['wss://relay.nsec.app'], // Default relay
        enckey: '', // Empty for scope keys
        profile: undefined,
        ncryptsec: bytesToHex(secretKey), // Keep hex format for compatibility
        localKey: undefined,
        scopeSlug: slug, // Associate with the scope
      },
    });

    // Create the scope
    const scope = await prisma.scopes.create({
      data: {
        id: scopeId,
        slug: slug,
        name: name,
        description: description,
        owner: user.id,
        keyNpub: npub,
      },
    });

    return NextResponse.json({
      success: true,
      scope: {
        ...scope,
        key: {
          npub: key.npub,
          name: key.name,
          // Generate nsec for display purposes only
          nsec: nip19.nsecEncode(secretKey),
        },
      },
    });
  } catch (error) {
    console.error('Error creating scope:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const { id, name, description, slug } = body;

    if (!id || !name || !description || !slug) {
      return NextResponse.json(
        { error: 'ID, name, description, and slug are required' },
        { status: 400 }
      );
    }

    // Check if the scope exists and belongs to the user
    const existingScope = await prisma.scopes.findFirst({
      where: {
        id: id,
        owner: user.id,
      },
    });

    if (!existingScope) {
      return NextResponse.json(
        { error: 'Scope not found or access denied' },
        { status: 404 }
      );
    }

    // Check if slug is already taken by another scope
    const slugConflict = await prisma.scopes.findFirst({
      where: {
        slug: slug,
        id: { not: id },
      },
    });

    if (slugConflict) {
      return NextResponse.json(
        { error: 'Scope slug already exists' },
        { status: 409 }
      );
    }

    // Update the scope
    const updatedScope = await prisma.scopes.update({
      where: {
        id: id,
      },
      data: {
        name: name,
        description: description,
        slug: slug,
        updatedAt: new Date(),
      },
      include: {
        key: true,
      },
    });

    return NextResponse.json({
      success: true,
      scope: {
        ...updatedScope,
        key: {
          npub: updatedScope.key.npub,
          nsec: updatedScope.key.nsec,
          name: updatedScope.key.name,
        },
      },
    });
  } catch (error) {
    console.error('Error updating scope:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
