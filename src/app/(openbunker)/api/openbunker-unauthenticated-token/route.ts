import { prisma } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/emails/verificationEmail';
import { getApplicationProfile } from '@/lib/nostr/appProfile';
import { NIP46_RELAYS } from '@/lib/nostr/consts';
import { validateAppAllowed } from '@/lib/scopes/restrictions';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

// Helper function to generate 6-digit code
function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to create or get user
async function createOrGetUser(email: string) {
  const supabaseAdmin = createSupabaseAdminClient();

  // Try to create user - if they already exist, Supabase will return an error
  const { data: newUser, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email since we're sending our own verification
    });

  if (createError) {
    // If user already exists, handle it gracefully
    if (
      createError.code == 'user_already_exists' ||
      createError.code == 'email_exists' ||
      createError.code == 'identity_already_exists'
    ) {
      console.log('User already exists, continuing with existing user...');

      // Return a mock user object for existing users
      // In a production environment, you might want to implement a proper user lookup
      return {
        id: `existing_${Date.now()}`,
        email: email,
        email_confirmed_at: new Date().toISOString(),
      };
    }

    throw new Error(`Failed to create user: ${createError.message}`);
  }

  return newUser.user;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, appUrl } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get scope from request body - scope is required
    const scope = body.scope;

    // Fetch application profile if appUrl is provided (non-blocking)
    let appProfile = null;
    if (appUrl && typeof appUrl === 'string') {
      try {
        const fetchedProfile = await getApplicationProfile(appUrl);
        if (fetchedProfile) {
          // Map the profile to include url for email template
          appProfile = {
            name: fetchedProfile.name,
            icon: fetchedProfile.icon,
            description: fetchedProfile.description,
            url: fetchedProfile.canonicalUrl || appUrl,
          };
        }
        console.log('Fetched application profile:', {
          name: appProfile?.name,
          icon: appProfile?.icon,
          url: appProfile?.url,
          pubkey: fetchedProfile?.pubkey,
        });
      } catch (error) {
        console.error(
          'Error fetching application profile (non-blocking):',
          error
        );
        // Continue with null profile - email will be sent without app info
      }
    }

    // Get scope configuration from database using Prisma
    let scopeConfig = null;
    if (scope) {
      scopeConfig = await prisma.scopes.findUnique({
        where: {
          slug: scope,
        },
      });
    }
    // Create or get user
    const user = await createOrGetUser(email);
    console.log('User created/retrieved:', user.id);

    // Generate 6-digit verification code
    const verificationCode = generateSixDigitCode();
    console.log('Generated verification code:', verificationCode);

    // Scope is required
    if (!scopeConfig) {
      return NextResponse.json(
        {
          error: 'Invalid or missing scope. Please provide a valid scope.',
        },
        { status: 400 }
      );
    }

    // Validate application against scope restrictions if appUrl is provided
    if (appUrl && typeof appUrl === 'string') {
      const isAllowed = await validateAppAllowed(
        appUrl,
        (scopeConfig.allowedApplications as string[] | null | undefined) ?? null
      );
      if (!isAllowed) {
        return NextResponse.json(
          {
            error: 'Application not allowed in this scope',
          },
          { status: 403 }
        );
      }
    }

    // Find or create the key for the user and scope using email
    let keyRecord = await prisma.keys.findFirst({
      where: {
        email: email,
        scopeSlug: scope,
      },
    });

    if (!keyRecord) {
      // Create the key if it doesn't exist
      try {
        // Generate a new secret key and derive the npub
        const secretKey = generateSecretKey();
        const publicKey = getPublicKey(secretKey);
        const npub = nip19.npubEncode(publicKey);
        const nsec = nip19.nsecEncode(secretKey);

        // Convert secret key to hex for enckey
        const enckeyHex = Buffer.from(secretKey).toString('hex');

        keyRecord = await prisma.keys.create({
          data: {
            npub: npub,
            nsec: nsec,
            name: `${email} - ${scopeConfig.name}`,
            email: email,
            scopeSlug: scope,
            enckey: enckeyHex,
            ncryptsec: enckeyHex,
            relays: [],
          },
        });
        console.log('Created new key record for user:', { email, scope, npub });
      } catch (error) {
        console.error('Error creating key record:', error);
        throw new Error(
          `Failed to create key record: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    const userNpub = keyRecord.npub;
    console.log('Using key record:', {
      npub: userNpub,
      name: keyRecord.name,
      scopeSlug: keyRecord.scopeSlug,
    });

    // Create connection token in database
    const now = Date.now();
    const expiry = now + 10 * 60 * 1000; // 10 minutes from now

    // Store the connection token with the verification code
    await prisma.connectTokens.create({
      data: {
        token: verificationCode,
        npub: userNpub,
        timestamp: now,
        expiry: BigInt(expiry),
        jsonData: JSON.stringify({
          email: email,
          scope: scope,
          userId: user.id,
        }),
      },
    });

    // Send verification email (with app profile if available)
    await sendVerificationEmail({
      email,
      code: verificationCode,
      scopeName: scopeConfig.name,
      appProfile,
    });

    // Generate bunker connection token
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
        'Verification code sent to your email. Please check your inbox and enter the code to continue.',
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
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
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
