import { prisma } from '@/lib/db';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
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

    const { slug } = await params;

    // Get the scope by slug
    const scope = await prisma.scopes.findUnique({
      where: {
        slug: slug,
      },
      include: {
        key: true,
      },
    });

    if (!scope) {
      return NextResponse.json({ error: 'Scope not found' }, { status: 404 });
    }

    // Return scope with its key
    const scopeWithKey = {
      ...scope,
      key: {
        npub: scope.key.npub,
        nsec: scope.key.nsec,
        name: scope.key.name,
      },
    };

    return NextResponse.json({ scope: scopeWithKey });
  } catch (error) {
    console.error('Error fetching scope:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
