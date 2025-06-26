import { NextRequest, NextResponse } from 'next/server';

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

      // Generate a new Nostr secret key
      const secretKey = generateNostrSecretKey();

      return NextResponse.json({
        secretKey,
        user: fakeDiscordUser,
      });
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
      console.error('Discord token exchange failed:', await tokenResponse.text());
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
      console.error('Discord user info fetch failed:', await userResponse.text());
      return NextResponse.json(
        { error: 'Failed to fetch Discord user information' },
        { status: 400 }
      );
    }

    const discordUser = await userResponse.json();

    // Generate a new Nostr secret key
    // In a real implementation, you might want to use a more secure method
    // and potentially store the user information in a database
    const secretKey = generateNostrSecretKey();

    // For now, we'll return the secret key directly
    // In a production environment, you might want to store user data and return a session token
    return NextResponse.json({
      secretKey,
      user: {
        id: discordUser.id,
        username: discordUser.username,
        email: discordUser.email,
        avatar: discordUser.avatar,
      },
    });
  } catch (error) {
    console.error('Discord callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Simple function to generate a Nostr secret key
// In production, you should use a proper cryptographic library
function generateNostrSecretKey(): string {
  // This is a placeholder implementation
  // In reality, you should use a proper cryptographic library to generate keys
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  
  // Convert to hex and create a mock nsec1 key
  // This is not a real nsec1 key - you should use proper nostr-tools
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `nsec1${hex}`;
} 