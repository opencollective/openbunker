import { resolveNip05 } from '../nip05Utils';

// Mock fetch globally
global.fetch = jest.fn();

describe('resolveNip05', () => {
  beforeEach(() => {
    // Clear fetch mocks
    jest.clearAllMocks();
  });

  it('should resolve a canonical URL to a pubkey via NIP-05', async () => {
    const mockPubkey =
      'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678';
    const mockDomain = 'test-app.example.com';
    const canonicalUrl = `https://${mockDomain}`;

    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: {
          _: mockPubkey, // Using _ as the local-part when no path is provided
        },
      }),
    });

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBe(mockPubkey);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://${mockDomain}/.well-known/nostr.json`,
      {
        signal: expect.any(AbortSignal),
        headers: {
          Accept: 'application/json',
        },
      }
    );
  });

  it('should resolve a URL with local-part to a pubkey', async () => {
    const mockPubkey =
      'f1e2d3c4b5a67890123456789012345678901234567890123456789012345678';
    const mockDomain = 'test-app.example.com';
    const localPart = 'app';
    const canonicalUrl = `https://${mockDomain}?name=${localPart}`;

    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: {
          [localPart]: mockPubkey,
        },
      }),
    });

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBe(mockPubkey);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://${mockDomain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`,
      expect.any(Object)
    );
  });

  it('should handle email format (app@example.com)', async () => {
    const mockPubkey =
      '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const canonicalUrl = 'app@test-app.example.com';

    // Mock the fetch response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: {
          app: mockPubkey,
        },
      }),
    });

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBe(mockPubkey);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://test-app.example.com/.well-known/nostr.json?name=app',
      expect.any(Object)
    );
  });

  it('should return null on HTTP error', async () => {
    const canonicalUrl = 'https://error-app.example.com';

    // Mock fetch to return 404
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBeNull();
  });

  it('should return null on timeout', async () => {
    const canonicalUrl = 'https://timeout-app.example.com';

    // Mock fetch to never resolve (simulating timeout)
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        })
    );

    // We need to mock AbortController to trigger timeout
    const originalAbortController = global.AbortController;
    global.AbortController = jest.fn().mockImplementation(() => {
      const controller = new originalAbortController();
      // Simulate timeout by aborting immediately
      setTimeout(() => controller.abort(), 10);
      return controller;
    }) as unknown as typeof AbortController;

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBeNull();
  });

  it('should return null on invalid pubkey format', async () => {
    const canonicalUrl = 'https://invalid-app.example.com';

    // Mock response with invalid pubkey (too short)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: {
          _: 'invalid-pubkey',
        },
      }),
    });

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBeNull();
  });

  it('should return null when no pubkey found in response', async () => {
    const canonicalUrl = 'https://no-pubkey-app.example.com';

    // Mock response without names mapping
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: {},
      }),
    });

    const result = await resolveNip05(canonicalUrl);

    expect(result).toBeNull();
  });

  it('should successfully resolve a fake application domain via .well-known/nostr.json', async () => {
    // Fake application domain
    const fakeAppDomain = 'fake-nostr-app.test';
    const canonicalUrl = `https://${fakeAppDomain}`;

    // Mock pubkey (64 character hex string)
    const mockPubkey =
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    // Mock the .well-known/nostr.json endpoint response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        names: {
          _: mockPubkey, // Default entry when no local-part specified
        },
      }),
    });

    // Call the function
    const result = await resolveNip05(canonicalUrl);

    // Verify the result
    expect(result).toBe(mockPubkey);

    // Verify fetch was called with the correct .well-known/nostr.json URL
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://${fakeAppDomain}/.well-known/nostr.json`,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        headers: {
          Accept: 'application/json',
        },
      })
    );
  });
});
