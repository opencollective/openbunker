import { resolveNip05 } from '@/lib/nostr/nip05Utils';
import { SimplePool, type Event } from 'nostr-tools';
import {
  clearAppProfileCache,
  fetchAppProfile,
  getApplicationProfile,
} from '../appProfile';

// Mock dependencies
jest.mock('../nip05Utils');
jest.mock('nostr-tools', () => ({
  SimplePool: jest.fn(),
}));

const mockResolveNip05 = resolveNip05 as jest.MockedFunction<
  typeof resolveNip05
>;

const MockedSimplePool = SimplePool as jest.MockedClass<typeof SimplePool>;

describe('appProfile', () => {
  let mockPool: {
    get: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    // Clear cache before each test
    clearAppProfileCache();
    jest.clearAllMocks();

    // Setup SimplePool mock
    mockPool = {
      get: jest.fn(),
      close: jest.fn(),
    };

    MockedSimplePool.mockImplementation(() => mockPool as unknown as SimplePool);
  });

  describe('fetchAppProfile', () => {
    const mockPubkey =
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    it('should fetch and parse a kind: 0 event successfully', async () => {
      const mockEvent: Event = {
        id: 'event-id-123',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: JSON.stringify({
          name: 'Test App',
          picture: 'https://example.com/icon.png',
          about: 'A test application',
        }),
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      const result = await fetchAppProfile(mockPubkey);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe(mockPubkey);
      expect(result?.name).toBe('Test App');
      expect(result?.icon).toBe('https://example.com/icon.png');
      expect(result?.description).toBe('A test application');
      expect(result?.fetchedAt).toBeGreaterThan(0);

      expect(mockPool.get).toHaveBeenCalledTimes(1);
      expect(mockPool.get).toHaveBeenCalledWith(expect.any(Array), {
        kinds: [0],
        authors: [mockPubkey],
      });
      expect(mockPool.close).toHaveBeenCalledTimes(1);
    });

    it('should use avatar field if picture is not present', async () => {
      const mockEvent: Event = {
        id: 'event-id-456',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: JSON.stringify({
          name: 'Test App 2',
          avatar: 'https://example.com/avatar.png',
          about: 'Another test app',
        }),
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      const result = await fetchAppProfile(mockPubkey);

      expect(result).not.toBeNull();
      expect(result?.icon).toBe('https://example.com/avatar.png');
    });

    it('should use description field if about is not present', async () => {
      const mockEvent: Event = {
        id: 'event-id-789',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: JSON.stringify({
          name: 'Test App 3',
          description: 'Description field',
        }),
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      const result = await fetchAppProfile(mockPubkey);

      expect(result).not.toBeNull();
      expect(result?.description).toBe('Description field');
    });

    it('should return null when no kind: 0 event is found', async () => {
      mockPool.get.mockResolvedValueOnce(null);

      const result = await fetchAppProfile(mockPubkey);

      expect(result).toBeNull();
      expect(mockPool.get).toHaveBeenCalledTimes(1);
      expect(mockPool.close).toHaveBeenCalledTimes(1);
    });

    it('should return null on error', async () => {
      mockPool.get.mockRejectedValueOnce(new Error('Relay connection failed'));

      const result = await fetchAppProfile(mockPubkey);

      expect(result).toBeNull();
      expect(mockPool.close).toHaveBeenCalledTimes(1);
    });

    it('should cache fetched profiles', async () => {
      const mockEvent: Event = {
        id: 'event-id-cache',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: JSON.stringify({
          name: 'Cached App',
        }),
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      // First call
      const result1 = await fetchAppProfile(mockPubkey);
      expect(result1).not.toBeNull();
      expect(mockPool.get).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await fetchAppProfile(mockPubkey);
      expect(result2).not.toBeNull();
      expect(mockPool.get).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result2?.name).toBe('Cached App');
    });

    it('should handle invalid JSON in event content gracefully', async () => {
      const mockEvent: Event = {
        id: 'event-id-invalid',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: 'invalid json {',
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      const result = await fetchAppProfile(mockPubkey);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe(mockPubkey);
      expect(result?.name).toBeUndefined();
      expect(result?.icon).toBeUndefined();
    });
  });

  describe('getApplicationProfile', () => {
    const mockPubkey =
      '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const canonicalUrl = 'https://test-app.example.com';

    it('should resolve canonical URL and fetch profile successfully', async () => {
      // Mock NIP-05 resolution
      mockResolveNip05.mockResolvedValueOnce(mockPubkey);

      // Mock kind: 0 event
      const mockEvent: Event = {
        id: 'event-id-full',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: JSON.stringify({
          name: 'Full Test App',
          picture: 'https://example.com/full-icon.png',
          about: 'Full test description',
        }),
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      const result = await getApplicationProfile(canonicalUrl);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe(mockPubkey);
      expect(result?.canonicalUrl).toBe(canonicalUrl);
      expect(result?.name).toBe('Full Test App');
      expect(result?.icon).toBe('https://example.com/full-icon.png');
      expect(result?.description).toBe('Full test description');

      expect(mockResolveNip05).toHaveBeenCalledWith(canonicalUrl);
      expect(mockPool.get).toHaveBeenCalledTimes(1);
    });

    it('should return fallback profile when NIP-05 resolution fails', async () => {
      mockResolveNip05.mockResolvedValueOnce(null);

      const result = await getApplicationProfile(canonicalUrl);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe('');
      expect(result?.canonicalUrl).toBe(canonicalUrl);
      expect(result?.name).toBe(canonicalUrl);
      expect(mockPool.get).not.toHaveBeenCalled();
    });

    it('should return fallback profile when kind: 0 fetch fails', async () => {
      mockResolveNip05.mockResolvedValueOnce(mockPubkey);
      mockPool.get.mockResolvedValueOnce(null);

      const result = await getApplicationProfile(canonicalUrl);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe(mockPubkey);
      expect(result?.canonicalUrl).toBe(canonicalUrl);
      expect(result?.name).toBe(canonicalUrl);
      expect(mockPool.get).toHaveBeenCalledTimes(1);
    });

    it('should cache by both pubkey and canonical URL', async () => {
      mockResolveNip05.mockResolvedValueOnce(mockPubkey);

      const mockEvent: Event = {
        id: 'event-id-cache-test',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 0,
        tags: [],
        sig: 'signature',
        content: JSON.stringify({
          name: 'Cache Test App',
        }),
      };

      mockPool.get.mockResolvedValueOnce(mockEvent);

      // First call
      const result1 = await getApplicationProfile(canonicalUrl);
      expect(result1).not.toBeNull();
      expect(mockResolveNip05).toHaveBeenCalledTimes(1);
      expect(mockPool.get).toHaveBeenCalledTimes(1);

      // Second call should use cache (by canonical URL)
      const result2 = await getApplicationProfile(canonicalUrl);
      expect(result2).not.toBeNull();
      expect(mockResolveNip05).toHaveBeenCalledTimes(1); // Still 1
      expect(mockPool.get).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should handle errors gracefully and return fallback profile', async () => {
      mockResolveNip05.mockRejectedValueOnce(
        new Error('NIP-05 resolution failed')
      );

      const result = await getApplicationProfile(canonicalUrl);

      expect(result).not.toBeNull();
      expect(result?.pubkey).toBe('');
      expect(result?.canonicalUrl).toBe(canonicalUrl);
      expect(result?.name).toBe(canonicalUrl);
    });
  });
});
