import { prisma } from '@/lib/db';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import {
  ParsedNostrConnectURI,
  parseNostrConnectURI,
} from '@/utils/nip46Utils';
import { hexToBytes } from '@noble/hashes/utils';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { NextRequest, NextResponse } from 'next/server';
import { NDKEncryptedNostrChannelAdapter } from 'server/nip-46-backend/nostr-rpc';

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
    const { connectionToken, scope } = body;

    // Validate required fields
    if (!connectionToken) {
      return NextResponse.json(
        { error: 'Missing connectionToken or parsedConnectionToken' },
        { status: 400 }
      );
    }
    if (!scope) {
      return NextResponse.json({ error: 'Scope is required' }, { status: 400 });
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

    // Validate the parsed connection token structure
    const parsed: ParsedNostrConnectURI = parseNostrConnectURI(connectionToken);
    if (
      !parsed.clientPubkey ||
      !parsed.params?.secret ||
      !parsed.params?.relays
    ) {
      return NextResponse.json(
        { error: 'Invalid parsed connection token structure' },
        { status: 400 }
      );
    }

    // Get scope and key from database
    const scopeObject = await prisma.scopes.findUnique({
      where: {
        slug: scope,
      },
    });
    const scopeKey = await prisma.keys.findUnique({
      where: {
        npub: scopeObject?.keyNpub,
      },
    });
    if (!scopeKey || !scopeKey.ncryptsec) {
      return NextResponse.json(
        { error: 'Key not found or access denied' },
        { status: 404 }
      );
    }

    const scopePrivateKey = hexToBytes(scopeKey?.ncryptsec);
    const encryptedAdapter = new NDKEncryptedNostrChannelAdapter(
      new NDKPrivateKeySigner(scopePrivateKey),
      parsed.params.relays ?? []
    );

    await getOrCreateSession(npub, scope, parsed);
    const id = Math.random().toString(36).substring(7);
    const connectionTokenSecret = parsed.params.secret;
    // This sends a response (without a request)
    await encryptedAdapter.sendResponse(
      id,
      parsed.clientPubkey,
      connectionTokenSecret
    );

    console.log(
      'NostrConnect response created for user:',
      user.email,
      'npub:',
      npub
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error creating nostrconnect response:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getOrCreateSession(
  npub: string,
  scope: string,
  parsed: ParsedNostrConnectURI
) {
  // First check if there is an existing session for the user npub (remoteSignerPubkey) / and local npub
  const pubkeySession = await prisma.sessions.findFirst({
    where: {
      sessionNpub: parsed.clientPubkey,
      scopeSlug: scope,
    },
  });
  if (pubkeySession) {
    console.log(
      'Found existing session for ',
      parsed.clientPubkey,
      `in scope ${scope}`
    );
    return pubkeySession;
  }

  const newSession = await prisma.sessions.create({
    data: {
      npub: npub,
      sessionNpub: parsed.clientPubkey,
      scopeSlug: scope,
      expiresAt: BigInt(Date.now() + 1000 * 60 * 60), // 1 hour
    },
  });
  return newSession;
}
