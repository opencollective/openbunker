import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      );
    }

    // In development mode, fake the Discord authentication
    if (process.env.NODE_ENV === 'development' && code.startsWith('dev_')) {
      console.log('Development mode: Faking Discord authentication');

      // Generate fake Discord user data
      const fakeDiscordUser = {
        id: 'dev_' + Math.random().toString(36).substring(2, 10),
        username: 'dev_user_' + Math.random().toString(36).substring(2, 8),
        email: `dev_${Math.random().toString(36).substring(2, 8)}@example.com`,
        avatar: null,
      };

      // Try to find existing key in database by email
      const existingKey = await prisma.keys.findFirst({
        where: {
          email: fakeDiscordUser.email,
        },
      });

      if (existingKey) {
        // For existing users, generate a new key since we can't retrieve their original secret key
        console.log('Generating new Nostr key for existing development user');
        const secretKey = generateSecretKey();
        const publicKey = getPublicKey(secretKey);
        const nsec = nip19.nsecEncode(secretKey);
        const npub = nip19.npubEncode(publicKey);

        // Update the existing key record with the new public key
        await prisma.keys.update({
          where: { npub: existingKey.npub },
          data: {
            npub: npub,
            profile: { email: fakeDiscordUser.email },
            email: fakeDiscordUser.email,
            name: fakeDiscordUser.username,
            avatar: fakeDiscordUser.avatar,
            relays: [],
            enckey: '', // This might need to be generated based on your encryption scheme
            ncryptsec: undefined,
            localKey: undefined,
          },
        });

        return NextResponse.json({
          secretKey: nsec,
          user: fakeDiscordUser,
        });
      } else {
        // Generate a new Nostr key
        console.log('Generating new Nostr key for development user');
        const secretKey = generateSecretKey();
        const publicKey = getPublicKey(secretKey);
        const nsec = nip19.nsecEncode(secretKey);
        const npub = nip19.npubEncode(publicKey);

        // Save the new key to database
        await prisma.keys.create({
          data: {
            npub: npub,
            profile: { email: fakeDiscordUser.email },
            email: fakeDiscordUser.email,
            name: fakeDiscordUser.username,
            avatar: fakeDiscordUser.avatar,
            relays: [],
            enckey: '', // This might need to be generated based on your encryption scheme
            ncryptsec: undefined,
            localKey: undefined,
          },
        });

        return NextResponse.json({
          secretKey: nsec,
          user: fakeDiscordUser,
        });
      }
    }

    // Production Discord OAuth flow
    // Exchange Discord code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || '',
        client_secret: process.env.DISCORD_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/openbunker-auth`,
      }),
    });

    if (!tokenResponse.ok) {
      console.error(
        'Discord token exchange failed:',
        await tokenResponse.text()
      );
      return NextResponse.json(
        { error: 'Failed to exchange Discord authorization code' },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    // Get Discord user information
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error(
        'Discord user info fetch failed:',
        await userResponse.text()
      );
      return NextResponse.json(
        { error: 'Failed to fetch Discord user information' },
        { status: 400 }
      );
    }

    const discordUser = await userResponse.json();

    // Try to find existing key in database by email
    const existingKey = await prisma.keys.findFirst({
      where: {
        email: discordUser.email,
      },
    });

    if (existingKey) {
      // For existing users, generate a new key since we can't retrieve their original secret key
      console.log(
        'Generating new Nostr key for existing Discord user:',
        discordUser.email
      );
      const secretKey = generateSecretKey();
      const publicKey = getPublicKey(secretKey);
      const nsec = nip19.nsecEncode(secretKey);
      const npub = nip19.npubEncode(publicKey);

      // Update the existing key record with the new public key
      await prisma.keys.update({
        where: { npub: existingKey.npub },
        data: {
          npub: npub,
          profile: { email: discordUser.email },
          email: discordUser.email,
          name: discordUser.username,
          avatar: discordUser.avatar,
          relays: [],
          enckey: '', // This might need to be generated based on your encryption scheme
          ncryptsec: undefined,
          localKey: undefined,
        },
      });

      return NextResponse.json({
        secretKey: nsec,
        user: {
          id: discordUser.id,
          username: discordUser.username,
          email: discordUser.email,
          avatar: discordUser.avatar,
        },
      });
    } else {
      // Generate a new Nostr key
      console.log(
        'Generating new Nostr key for Discord user:',
        discordUser.email
      );
      const secretKey = generateSecretKey();
      const publicKey = getPublicKey(secretKey);
      const nsec = nip19.nsecEncode(secretKey);
      const npub = nip19.npubEncode(publicKey);

      // Save the new key to database
      await prisma.keys.create({
        data: {
          npub: npub,
          profile: { email: discordUser.email },
          email: discordUser.email,
          name: discordUser.username,
          avatar: discordUser.avatar,
          relays: [],
          enckey: '', // This might need to be generated based on your encryption scheme
          ncryptsec: undefined,
          localKey: undefined,
        },
      });

      return NextResponse.json({
        secretKey: nsec,
        user: {
          id: discordUser.id,
          username: discordUser.username,
          email: discordUser.email,
          avatar: discordUser.avatar,
        },
      });
    }
  } catch (error) {
    console.error('Discord callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
