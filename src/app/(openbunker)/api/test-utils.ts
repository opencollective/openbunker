/**
 * Shared test utilities for API route tests
 */

import { prisma } from '@/lib/db';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { POST } from './scopes/route';

// Helper function to set request context for cookies() mock
// Note: Each test file should have its own currentRequest variable and mock setup
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setRequest = (request: NextRequest) => {
  // This is a no-op here - test files should override this with their own implementation
  // or use the mock setup from their test file
};

// Test user data from environment variables
export const getTestEmail = () => process.env.TEST_USER_EMAIL?.trim();
export const getTestPassword = () => process.env.TEST_USER_PASSWORD?.trim();

// Helper function to create authenticated request
export function createAuthenticatedRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
  sessionCookies: Array<{ name: string; value: string }>
): NextRequest {
  // Build cookie header from session cookies
  const cookieHeader = sessionCookies
    .map(c => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');

  const headers: Record<string, string> = {
    ...options.headers,
    Cookie: cookieHeader,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  return new NextRequest(url, {
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
  });
}

// Setup authenticated user session
export async function setupAuthenticatedUser(): Promise<{
  user: { id: string; email: string };
  sessionCookies: Array<{ name: string; value: string }>;
}> {
  const testEmail = getTestEmail();
  const testPassword = getTestPassword();

  // Validate environment variables
  if (!testEmail || !testPassword) {
    throw new Error(
      'Missing environment variables. Please set TEST_USER_EMAIL and TEST_USER_PASSWORD'
    );
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  // Use createClient for signing in (works in Node.js)
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    global: {
      fetch: global.fetch,
    },
  });

  // Sign in with existing user
  const emailToUse = String(testEmail).trim();
  const passwordToUse = String(testPassword).trim();

  const { data: signInData, error: signInError } =
    await supabaseClient.auth.signInWithPassword({
      email: emailToUse,
      password: passwordToUse,
    });

  if (signInError) {
    throw new Error(
      `Failed to sign in: ${signInError.message}. Please verify TEST_USER_EMAIL and TEST_USER_PASSWORD are correct.`
    );
  }

  if (!signInData.session) {
    throw new Error('Failed to sign in: No session returned');
  }

  const user = signInData.user;
  if (!user || !user.email) {
    throw new Error('Failed to sign in: no user returned');
  }

  // Create a mock cookie store to use with createServerClient
  const mockCookieStore: Array<{ name: string; value: string }> = [];

  // Use createServerClient to properly format the session cookies
  const serverClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return mockCookieStore;
      },
      setAll(cookiesToSet) {
        mockCookieStore.length = 0; // Clear existing
        cookiesToSet.forEach(({ name, value }) => {
          mockCookieStore.push({ name, value });
        });
      },
    },
  });

  // Set the session using the server client
  await serverClient.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  // Extract the properly formatted cookies
  const sessionCookies = [...mockCookieStore];

  return {
    user: { id: user.id, email: user.email },
    sessionCookies,
  };
}

// Create a test scope
// Note: setRequestFn should be provided by the test file to set request context for cookies() mock
export async function createTestScope(
  sessionCookies: Array<{ name: string; value: string }>,
  scopeData?: {
    name?: string;
    description?: string;
    slug?: string;
  },
  setRequestFn?: (request: NextRequest) => void
): Promise<{ slug: string; keyNpub: string }> {
  const scopeSlug =
    scopeData?.slug ||
    `test-scope-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const request = createAuthenticatedRequest(
    'http://localhost:3000/api/scopes',
    {
      method: 'POST',
      body: {
        name: scopeData?.name || 'Test Scope',
        description: scopeData?.description || 'A test scope',
        slug: scopeSlug,
      },
    },
    sessionCookies
  );

  // Set request context if provided (needed for cookies() mock)
  if (setRequestFn) {
    setRequestFn(request);
  }

  const response = await POST(request);
  const responseData = await response.json();

  if (response.status !== 200) {
    throw new Error(
      `Failed to create test scope: ${JSON.stringify(responseData)}`
    );
  }

  return {
    slug: responseData.scope.slug,
    keyNpub: responseData.scope.key.npub,
  };
}

// Cleanup test scope
export async function cleanupTestScope(
  scopeSlug: string,
  userId: string
): Promise<void> {
  try {
    const scope = await prisma.scopes.findUnique({
      where: { slug: scopeSlug },
      include: { key: true },
    });

    if (scope && scope.owner === userId) {
      // Delete scope first (removes foreign key constraint)
      await prisma.scopes.delete({
        where: { slug: scopeSlug },
      });

      // Then try to delete the key if it exists and isn't used elsewhere
      if (scope.key) {
        try {
          const userKeyCount = await prisma.userKeys.count({
            where: { npub: scope.key.npub },
          });

          if (userKeyCount === 0) {
            await prisma.keys.delete({
              where: { npub: scope.key.npub },
            });
          }
        } catch {
          // Key might be in use elsewhere, ignore
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
