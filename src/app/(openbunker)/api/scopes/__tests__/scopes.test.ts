/**
 * @jest-environment node
 */

import { prisma } from '@/lib/db';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { DELETE, GET } from '../[slug]/route';
import { POST } from '../route';

// Store the current request context (shared between mock and test)
let currentRequest: NextRequest | null = null;

// Mock next/headers to provide cookies() function that reads from request
jest.mock('next/headers', () => {
  // Mock cookies() function that reads from current request
  const cookies = jest.fn(() => {
    if (!currentRequest) {
      throw new Error(
        '`cookies` was called outside a request scope. Make sure to call setRequest() before route handlers.'
      );
    }

    // Parse cookies from request headers
    const cookieHeader = currentRequest.headers.get('cookie') || '';
    const cookieMap = new Map<string, string>();

    cookieHeader.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name && valueParts.length > 0) {
        const value = decodeURIComponent(valueParts.join('='));
        cookieMap.set(name, value);
      }
    });

    return {
      getAll: () => {
        return Array.from(cookieMap.entries()).map(([name, value]) => ({
          name,
          value,
        }));
      },
      get: (name: string) => {
        const value = cookieMap.get(name);
        return value ? { name, value } : undefined;
      },
      set: (name: string, value: string) => {
        cookieMap.set(name, value);
      },
      has: (name: string) => cookieMap.has(name),
      delete: (name: string) => {
        cookieMap.delete(name);
      },
    };
  });

  return {
    cookies,
  };
});

describe('Scopes API', () => {
  // Helper function to set request context for cookies() mock
  const setRequest = (request: NextRequest) => {
    currentRequest = request;
  };
  // Test user data from environment variables
  // Trim whitespace that might be introduced from .env file
  // Read these at runtime, not at module load time, to ensure dotenv has loaded them
  const getTestEmail = () => process.env.TEST_USER_EMAIL?.trim();
  const getTestPassword = () => process.env.TEST_USER_PASSWORD?.trim();

  let supabaseClient: ReturnType<typeof createClient>;
  let testUser: { id: string; email: string } | null = null;
  let sessionCookies: Array<{ name: string; value: string }> = [];
  let createdScopeSlug: string | null = null;

  // Helper function to create authenticated request
  const createAuthenticatedRequest = (
    url: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): NextRequest => {
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
  };

  beforeAll(async () => {
    // Read environment variables at runtime
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
    // Note: createBrowserClient from @supabase/ssr requires browser storage
    // so we use createClient from @supabase/supabase-js for Node.js environment
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce', // Use PKCE flow (same as browser client)
      },
      global: {
        fetch: global.fetch, // Ensure we use Node.js built-in fetch
      },
    });

    // Sign in with existing user
    // Ensure email and password are strings and trimmed
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
    testUser = { id: user.id, email: user.email };

    // Create a mock cookie store to use with createServerClient
    // This will properly format cookies the way Supabase SSR expects
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
    // This will properly format cookies in the way createServerSupabaseClient expects
    await serverClient.auth.setSession({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });

    // Now extract the properly formatted cookies
    sessionCookies = [...mockCookieStore];
  });

  afterAll(async () => {
    // Clean up any created scopes
    if (createdScopeSlug && testUser) {
      try {
        // Find and delete the scope and its associated key
        const scope = await prisma.scopes.findUnique({
          where: { slug: createdScopeSlug },
          include: { key: true },
        });

        if (scope && scope.owner === testUser.id) {
          if (scope.key) {
            await prisma.keys.delete({
              where: { npub: scope.key.npub },
            });
          }
          await prisma.scopes.delete({
            where: { slug: createdScopeSlug },
          });
        }
      } catch (error) {
        // Ignore cleanup errors
        console.error('Cleanup error:', error);
      }
    }
  });

  describe('POST /api/scopes - Create scope', () => {
    it('should create a scope successfully', async () => {
      const scopeData = {
        name: 'Test Scope',
        description: 'A test scope',
        slug: `test-scope-${Date.now()}`,
      };

      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: scopeData,
        }
      );

      // Set request context for cookies() mock
      setRequest(request);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.scope).toBeDefined();
      expect(responseData.scope.slug).toBe(scopeData.slug);
      expect(responseData.scope.name).toBe(scopeData.name);
      expect(responseData.scope.description).toBe(scopeData.description);
      expect(responseData.scope.owner).toBe(testUser!.id);
      expect(responseData.scope.key).toBeDefined();
      expect(responseData.scope.key.npub).toBeDefined();
      expect(responseData.scope.key.nsec).toBeDefined();

      // Store slug for cleanup
      createdScopeSlug = responseData.scope.slug;
    });

    it('should return 401 if user is not authenticated', async () => {
      const request = new NextRequest('http://localhost:3000/api/scopes', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Scope',
          description: 'A test scope',
          slug: 'test-scope',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Set request context for cookies() mock (even though no cookies, still need context)
      setRequest(request);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    it('should return 400 if required fields are missing', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: {
            name: 'Test Scope',
            // Missing description and slug
          },
        }
      );

      // Set request context for cookies() mock
      setRequest(request);

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe(
        'Name, description, and slug are required'
      );
    });

    it('should return 409 if slug already exists', async () => {
      // First create a scope
      const existingSlug = `existing-scope-${Date.now()}`;
      const createRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: {
            name: 'Existing Scope',
            description: 'An existing scope',
            slug: existingSlug,
          },
        }
      );

      // Set request context for first POST
      setRequest(createRequest);
      const responseInitial = await POST(createRequest);
      const responseDataInitial = await responseInitial.json();
      createdScopeSlug = responseDataInitial.scope.slug;

      // Try to create another scope with the same slug
      const duplicateRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: {
            name: 'Duplicate Scope',
            description: 'A duplicate scope',
            slug: existingSlug,
          },
        }
      );

      // Set request context for duplicate POST
      setRequest(duplicateRequest);
      const response = await POST(duplicateRequest);
      const responseData = await response.json();

      expect(response.status).toBe(409);
      expect(responseData.error).toBe('Scope slug already exists');
    });
  });

  describe('GET /api/scopes/[slug] - Get scope', () => {
    it('should get a scope successfully', async () => {
      // First create a scope
      const scopeSlug = `get-test-scope-${Date.now()}`;
      const createRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: {
            name: 'Get Test Scope',
            description: 'A scope for testing GET',
            slug: scopeSlug,
          },
        }
      );

      // Set request context for POST
      setRequest(createRequest);
      const createResponse = await POST(createRequest);
      expect(createResponse.status).toBe(200);

      // Now get the scope
      const getRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/scopes/${scopeSlug}`
      );

      // Set request context for GET
      setRequest(getRequest);

      const response = await GET(getRequest, {
        params: Promise.resolve({ slug: scopeSlug }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.scope).toBeDefined();
      expect(responseData.scope.slug).toBe(scopeSlug);
      expect(responseData.scope.name).toBe('Get Test Scope');
      expect(responseData.scope.description).toBe('A scope for testing GET');
      expect(responseData.scope.key).toBeUndefined();

      // Cleanup - scope may have already been deleted by DELETE handler
      const scope = await prisma.scopes.findUnique({
        where: { slug: scopeSlug },
        include: { key: true },
      });
      if (scope) {
        if (scope.key) {
          try {
            await prisma.keys.delete({ where: { npub: scope.key.npub } });
          } catch {
            // Key might already be deleted or in use elsewhere
          }
        }
        try {
          await prisma.scopes.delete({ where: { slug: scopeSlug } });
        } catch {
          // Scope might already be deleted
        }
      }
    });

    it('should not return the scope key (nsec) in the response', async () => {
      // First create a scope
      const scopeSlug = `no-key-test-scope-${Date.now()}`;
      const createRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: {
            name: 'No Key Test Scope',
            description: 'A scope for testing key exclusion',
            slug: scopeSlug,
          },
        }
      );

      // Set request context for POST
      setRequest(createRequest);
      const createResponse = await POST(createRequest);
      expect(createResponse.status).toBe(200);

      // Now get the scope
      const getRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/scopes/${scopeSlug}`
      );

      // Set request context for GET
      setRequest(getRequest);

      const response = await GET(getRequest, {
        params: Promise.resolve({ slug: scopeSlug }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.scope).toBeDefined();
      expect(responseData.scope.keyNpub).toBeDefined();
      // Verify that key or nsec (secret key) is NOT returned
      expect(responseData.scope.key).toBeUndefined();

      // Cleanup
      const scope = await prisma.scopes.findUnique({
        where: { slug: scopeSlug },
        include: { key: true },
      });
      if (scope) {
        if (scope.key) {
          try {
            await prisma.keys.delete({ where: { npub: scope.key.npub } });
          } catch {
            // Key might already be deleted or in use elsewhere
          }
        }
        try {
          await prisma.scopes.delete({ where: { slug: scopeSlug } });
        } catch {
          // Scope might already be deleted
        }
      }
    });

    it('should return 401 if user is not authenticated', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/scopes/test-scope'
      );

      // Set request context for cookies() mock
      setRequest(request);

      const response = await GET(request, {
        params: Promise.resolve({ slug: 'test-scope' }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    it('should return 404 if scope does not exist', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes/non-existent-scope-12345'
      );

      // Set request context for cookies() mock
      setRequest(request);

      const response = await GET(request, {
        params: Promise.resolve({ slug: 'non-existent-scope-12345' }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Scope not found');
    });
  });

  describe('DELETE /api/scopes/[slug] - Delete scope', () => {
    it('should delete a scope successfully', async () => {
      // First create a scope
      const scopeSlug = `delete-test-scope-${Date.now()}`;
      const createRequest = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes',
        {
          method: 'POST',
          body: {
            name: 'Delete Test Scope',
            description: 'A scope for testing DELETE',
            slug: scopeSlug,
          },
        }
      );

      // Set request context for POST
      setRequest(createRequest);
      const createResponse = await POST(createRequest);
      expect(createResponse.status).toBe(200);

      // Verify it exists
      const scopeBefore = await prisma.scopes.findUnique({
        where: { slug: scopeSlug },
      });
      expect(scopeBefore).toBeTruthy();

      // Delete the scope
      const deleteRequest = createAuthenticatedRequest(
        `http://localhost:3000/api/scopes/${scopeSlug}`,
        {
          method: 'DELETE',
        }
      );

      // Set request context for cookies() mock
      setRequest(deleteRequest);

      const response = await DELETE(deleteRequest, {
        params: Promise.resolve({ slug: scopeSlug }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Scope deleted');

      // Verify it's deleted
      const scopeAfter = await prisma.scopes.findUnique({
        where: { slug: scopeSlug },
      });
      expect(scopeAfter).toBeNull();

      // Verify the key is also deleted
      const keyAfter = await prisma.keys.findFirst({
        where: { scopeSlug: scopeSlug },
      });
      expect(keyAfter).toBeNull();
    });

    it('should return 401 if user is not authenticated', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/scopes/test-scope',
        {
          method: 'DELETE',
        }
      );

      // Set request context for cookies() mock
      setRequest(request);

      const response = await DELETE(request, {
        params: Promise.resolve({ slug: 'test-scope' }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(401);
      expect(responseData.error).toBe('Unauthorized');
    });

    it('should return 404 if scope does not exist', async () => {
      const request = createAuthenticatedRequest(
        'http://localhost:3000/api/scopes/non-existent-scope-12345',
        {
          method: 'DELETE',
        }
      );

      // Set request context for cookies() mock
      setRequest(request);

      const response = await DELETE(request, {
        params: Promise.resolve({ slug: 'non-existent-scope-12345' }),
      });
      const responseData = await response.json();

      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Scope not found');
    });
  });
});
