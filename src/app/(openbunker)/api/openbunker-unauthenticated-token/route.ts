import { prisma } from '@/lib/db';
import { NIP46_RELAYS } from '@/lib/nostr/consts';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { nip19 } from 'nostr-tools';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
      createError.message.includes('already registered') ||
      createError.message.includes('already exists') ||
      createError.message.includes('has already been registered')
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

// Helper function to send verification email
async function sendVerificationEmail(
  email: string,
  code: string,
  scope: string
) {
  const { error } = await resend.emails.send({
    from: 'Openbunker <onboarding@resend.dev>',
    to: [email],
    subject: 'Confirm your connection to Openbunker',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #d97706; margin: 0; font-size: 28px;">🔐 Connection Confirmation</h1>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 20px;">
            You have requested to use your email and Openbunker to connect to a NOSTR application within the community : <strong>${scope}</strong>!
          </p>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 20px;">
            Use the following code to confirm your connection:
          </p>
          
          <div style="text-align: center; margin: 25px 0;">
            <div style="background: #f3f4f6; border: 2px solid #d97706; border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 4px;">${code}</span>
            </div>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
            This code will expire in 10 minutes.
          </p>
        </div>
        
        <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 2px 0;">This is an automated message from Openbunker</p>
        </div>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get scope from request body - scope is required
    const scope = body.scope;

    // Get scope configuration from database using Prisma
    let scopeConfig = null;
    if (scope) {
      scopeConfig = await prisma.scopes.findUnique({
        where: {
          slug: scope,
        },
      });
    }
    console.log('scopeConfig', scopeConfig, scope);

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
        const { generateSecretKey, getPublicKey } = await import('nostr-tools');
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
          verificationCode: verificationCode,
          scope: scope,
          userId: user.id,
        }),
      },
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode, scope);

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
