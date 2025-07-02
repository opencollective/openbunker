import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { npub: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { npub } = params;

    // Verify the user has access to this key
    const userKey = await prisma.userKeys.findFirst({
      where: {
        userId: user.id,
        npub: npub,
        isActive: true,
      },
    });

    if (!userKey) {
      return NextResponse.json({ error: 'Key not found or access denied' }, { status: 404 });
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

    // Transform the data to be more frontend-friendly
    const tokens = connectionTokens.map(token => ({
      token: token.token,
      npub: token.npub,
      subNpub: token.subNpub,
      timestamp: Number(token.timestamp),
      expiry: Number(token.expiry),
      jsonData: token.jsonData ? JSON.parse(token.jsonData) : null,
      isExpired: Number(token.expiry) < Date.now(),
    }));

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Error fetching connection tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 