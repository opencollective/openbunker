import { prisma } from '@/lib/db';
import {
  normalizeAppIdentifiers,
  validateAppIdentifier,
} from '@/lib/nostr/appIdentifier';
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
      id: scope.id,
      slug: scope.slug,
      name: scope.name,
      description: scope.description,
      owner: scope.owner,
      keyNpub: scope.keyNpub,
      allowedApplications: scope.allowedApplications,
      createdAt: scope.createdAt,
      updatedAt: scope.updatedAt,
      key: {
        npub: scope.key.npub,
        // FIXME this sends the key back
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
// FIXME is this used?
export async function PATCH(
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
    const body = await request.json();

    // Get the scope by slug
    const scope = await prisma.scopes.findUnique({
      where: {
        slug: slug,
      },
    });

    if (!scope) {
      return NextResponse.json({ error: 'Scope not found' }, { status: 404 });
    }

    // Check if user is the scope owner
    if (scope.owner !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prepare update data
    const updateData: {
      name?: string;
      description?: string;
      allowedApplications?: string[] | undefined;
    } = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.allowedApplications !== undefined) {
      // Validate and normalize application identifiers
      if (
        body.allowedApplications === null ||
        (Array.isArray(body.allowedApplications) &&
          body.allowedApplications.length === 0)
      ) {
        // Set to null to allow all applications
        updateData.allowedApplications = undefined;
      } else if (Array.isArray(body.allowedApplications)) {
        // Validate each identifier
        const invalidIdentifiers: string[] = [];
        for (const identifier of body.allowedApplications) {
          const validation = validateAppIdentifier(identifier);
          if (!validation.valid) {
            invalidIdentifiers.push(identifier);
          }
        }

        if (invalidIdentifiers.length > 0) {
          return NextResponse.json(
            {
              error: `Invalid application identifier format: ${invalidIdentifiers.join(', ')}`,
            },
            { status: 400 }
          );
        }

        // Normalize identifiers (convert npub to hex, remove duplicates)
        const normalized = normalizeAppIdentifiers(body.allowedApplications);
        updateData.allowedApplications = normalized;
      } else {
        return NextResponse.json(
          { error: 'allowedApplications must be an array or null' },
          { status: 400 }
        );
      }
    }

    // Update the scope
    const updatedScope = await prisma.scopes.update({
      where: {
        slug: slug,
      },
      data: updateData,
      include: {
        key: true,
      },
    });

    // Return updated scope
    const scopeWithKey = {
      ...updatedScope,
      key: {
        npub: updatedScope.key.npub,
        nsec: updatedScope.key.nsec,
        name: updatedScope.key.name,
      },
    };

    return NextResponse.json({ scope: scopeWithKey });
  } catch (error) {
    console.error('Error updating scope:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Check if user is the scope owner
    if (scope.owner !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Store the key npub before deleting the scope
    const keyNpub = scope.key?.npub;

    // Delete the scope first (removes foreign key constraint)
    await prisma.scopes.delete({
      where: {
        slug: slug,
      },
    });

    // Then try to delete the associated key if it exists
    // Note: Keys may be shared with UserKeys, so deletion might fail
    if (keyNpub) {
      try {
        // Check if key is used by UserKeys before attempting deletion
        const userKeyCount = await prisma.userKeys.count({
          where: { npub: keyNpub },
        });

        // Only delete if not used by UserKeys
        if (userKeyCount === 0) {
          await prisma.keys.delete({
            where: {
              npub: keyNpub,
            },
          });
        }
      } catch {
        // Key might be in use elsewhere, ignore error
        // The key will remain but won't be associated with this scope
      }
    }

    return NextResponse.json({ success: true, message: 'Scope deleted' });
  } catch (error) {
    console.error('Error deleting scope:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
