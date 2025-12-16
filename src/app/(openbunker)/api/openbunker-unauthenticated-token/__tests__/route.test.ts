/**
 * @jest-environment node
 */

import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import {
  cleanupTestScope,
  createTestScope,
  setupAuthenticatedUser,
} from '../../test-utils';
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

// Override setRequest to use local currentRequest
const setRequestLocal = (request: NextRequest) => {
  currentRequest = request;
};

// Mock Resend to avoid sending actual emails
// Store the mock function so we can access it in tests
const mockSendEmail = jest.fn().mockResolvedValue({ error: null });

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: mockSendEmail,
      },
    })),
  };
});

// Mock getApplicationProfile to avoid actual Nostr network calls
jest.mock('@/lib/nostr/appProfile', () => ({
  getApplicationProfile: jest.fn().mockResolvedValue({
    name: 'Test App',
    icon: 'https://example.com/icon.png',
    description: 'A test application',
    pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  }),
}));

describe('POST /api/openbunker-unauthenticated-token', () => {
  let testUser: { id: string; email: string } | null = null;
  let sessionCookies: Array<{ name: string; value: string }> = [];
  let testScopeSlug: string | null = null;

  beforeAll(async () => {
    // Setup authenticated user for creating test scope
    const authSetup = await setupAuthenticatedUser();
    testUser = authSetup.user;
    sessionCookies = authSetup.sessionCookies;

    // Create a test scope
    const scope = await createTestScope(
      sessionCookies,
      undefined,
      setRequestLocal
    );
    testScopeSlug = scope.slug;
  });

  afterAll(async () => {
    // Cleanup test scope
    if (testScopeSlug && testUser) {
      await cleanupTestScope(testScopeSlug, testUser.id);
    }

    // Cleanup any keys created during tests
    if (testUser) {
      const testKeys = await prisma.keys.findMany({
        where: {
          email: testUser.email,
          scopeSlug: testScopeSlug || undefined,
        },
      });

      for (const key of testKeys) {
        try {
          // Check if key is used by UserKeys
          const userKeyCount = await prisma.userKeys.count({
            where: { npub: key.npub },
          });

          if (userKeyCount === 0) {
            await prisma.keys.delete({ where: { npub: key.npub } });
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Cleanup connection tokens
    if (testUser) {
      const tokens = await prisma.connectTokens.findMany({
        where: {
          jsonData: {
            contains: testUser.email,
          },
        },
      });

      for (const token of tokens) {
        try {
          await prisma.connectTokens.delete({ where: { token: token.token } });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe('Token request scenarios', () => {
    beforeEach(() => {
      // Clear mock calls before each test
      mockSendEmail.mockClear();
    });

    it('should create a key for existing user without a key (first time)', async () => {
      // Ensure no key exists for this user and scope
      if (testUser && testScopeSlug) {
        const existingKeys = await prisma.keys.findMany({
          where: {
            email: testUser.email,
            scopeSlug: testScopeSlug,
          },
        });

        for (const key of existingKeys) {
          try {
            await prisma.keys.delete({ where: { npub: key.npub } });
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      const request = new NextRequest(
        'http://localhost:3000/api/openbunker-unauthenticated-token',
        {
          method: 'POST',
          body: JSON.stringify({
            email: testUser!.email,
            scope: testScopeSlug!,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.bunkerConnectionToken).toBeDefined();
      expect(responseData.bunkerConnectionToken).toContain('bunker://');

      // Log Resend arguments
      expect(mockSendEmail).toHaveBeenCalled();
      const resendArgs = mockSendEmail.mock.calls[0][0];
      console.log('\n=== Resend email arguments (first time) ===');
      console.log('To:', resendArgs.to);
      console.log('From:', resendArgs.from);
      console.log('Subject:', resendArgs.subject);
      console.log('HTML length:', resendArgs.html?.length || 0);
      console.log('Full args:', JSON.stringify(resendArgs, null, 2));

      // Verify a key was created
      const createdKey = await prisma.keys.findFirst({
        where: {
          email: testUser!.email,
          scopeSlug: testScopeSlug!,
        },
      });

      expect(createdKey).toBeTruthy();
      expect(createdKey!.email).toBe(testUser!.email);
      expect(createdKey!.scopeSlug).toBe(testScopeSlug);

      // Verify connection token was created
      const tokens = await prisma.connectTokens.findMany({
        where: {
          npub: createdKey!.npub,
        },
      });

      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should work for existing user with existing key', async () => {
      // First request should create a key
      const firstRequest = new NextRequest(
        'http://localhost:3000/api/openbunker-unauthenticated-token',
        {
          method: 'POST',
          body: JSON.stringify({
            email: testUser!.email,
            scope: testScopeSlug!,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const firstResponse = await POST(firstRequest);
      const firstResponseData = await firstResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(firstResponseData.success).toBe(true);

      // Get the created key
      const existingKey = await prisma.keys.findFirst({
        where: {
          email: testUser!.email,
          scopeSlug: testScopeSlug!,
        },
      });

      expect(existingKey).toBeTruthy();
      const existingNpub = existingKey!.npub;

      // Second request should use the existing key
      const secondRequest = new NextRequest(
        'http://localhost:3000/api/openbunker-unauthenticated-token',
        {
          method: 'POST',
          body: JSON.stringify({
            email: testUser!.email,
            scope: testScopeSlug!,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const secondResponse = await POST(secondRequest);
      const secondResponseData = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondResponseData.success).toBe(true);
      expect(secondResponseData.bunkerConnectionToken).toBeDefined();

      // Log Resend arguments for second request
      expect(mockSendEmail).toHaveBeenCalledTimes(2);
      const secondResendArgs = mockSendEmail.mock.calls[1][0];
      console.log('\n=== Resend email arguments (second request) ===');
      console.log('To:', secondResendArgs.to);
      console.log('From:', secondResendArgs.from);
      console.log('Subject:', secondResendArgs.subject);
      console.log('HTML length:', secondResendArgs.html?.length || 0);
      console.log('Full args:', JSON.stringify(secondResendArgs, null, 2));

      // Verify the same key is used
      const keyAfterSecondRequest = await prisma.keys.findFirst({
        where: {
          email: testUser!.email,
          scopeSlug: testScopeSlug!,
        },
      });

      expect(keyAfterSecondRequest).toBeTruthy();
      expect(keyAfterSecondRequest!.npub).toBe(existingNpub);
    });

    it('should succeed when user requests connection string with url argument (scope does not restrict URLs)', async () => {
      const appUrl = 'https://example.com/app';

      const request = new NextRequest(
        'http://localhost:3000/api/openbunker-unauthenticated-token',
        {
          method: 'POST',
          body: JSON.stringify({
            email: testUser!.email,
            scope: testScopeSlug!,
            appUrl: appUrl,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.bunkerConnectionToken).toBeDefined();
      expect(responseData.bunkerConnectionToken).toContain('bunker://');

      // Log Resend arguments with appUrl
      expect(mockSendEmail).toHaveBeenCalled();
      const resendArgsWithUrl = mockSendEmail.mock.calls[0][0];
      console.log('\n=== Resend email arguments (with appUrl) ===');
      console.log('To:', resendArgsWithUrl.to);
      console.log('From:', resendArgsWithUrl.from);
      console.log('Subject:', resendArgsWithUrl.subject);
      console.log('HTML length:', resendArgsWithUrl.html?.length || 0);
      console.log('Full args:', JSON.stringify(resendArgsWithUrl, null, 2));
    });
  });

  describe('Error cases', () => {
    it('should return 400 if email is missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/openbunker-unauthenticated-token',
        {
          method: 'POST',
          body: JSON.stringify({
            scope: testScopeSlug!,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Email is required');
    });

    it('should return 400 if scope is invalid or missing', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/openbunker-unauthenticated-token',
        {
          method: 'POST',
          body: JSON.stringify({
            email: testUser!.email,
            scope: 'non-existent-scope-12345',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toContain('Invalid or missing scope');
    });
  });
});
