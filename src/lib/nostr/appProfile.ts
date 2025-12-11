/**
 * Application Profile Fetching
 *
 * Fetches application profile information (kind: 0 events) from Nostr relays.
 * Implements caching to reduce relay queries.
 */

import { resolveNip05 } from '@/lib/nostr/nip05Utils';
import { SimplePool, type Event } from 'nostr-tools';

// Default relays for querying kind: 0 events
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nsec.app',
  'wss://nos.lol',
];

// Timeout for kind: 0 event fetching: 5 seconds
const FETCH_TIMEOUT_MS = 5000;

interface AppProfile {
  pubkey: string;
  canonicalUrl?: string;
  name?: string;
  icon?: string;
  description?: string;
  fetchedAt: number;
}

interface ProfileCacheEntry {
  profile: AppProfile;
  expiresAt: number;
}

// In-memory cache for application profiles
// Key: pubkey (hex) or canonical URL, Value: cache entry with profile and expiration
const profileCache = new Map<string, ProfileCacheEntry>();

// FIXME: if next js serving is happening in several processes this is not useful.
// research local next JS deployment documentation to see if that is the case
// (in serverless it will not be)
// Cache TTL: 30 minutes (1800000 ms)
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Fetches a kind: 0 event from Nostr relays for a given pubkey
 *
 * @param pubkey - The application pubkey in hex format
 * @param relays - Optional array of relay URLs (defaults to DEFAULT_RELAYS)
 * @returns The kind: 0 event, or null if not found or fetch fails
 */
async function fetchKind0Event(
  pubkey: string,
  relays: string[] = DEFAULT_RELAYS
): Promise<Event | null> {
  const pool = new SimplePool();

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<null>(resolve => {
      setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
    });

    // Create fetch promise
    const fetchPromise = pool.get(relays, {
      kinds: [0],
      authors: [pubkey],
    });

    // Race between fetch and timeout
    const event = await Promise.race([fetchPromise, timeoutPromise]);

    // Clean up pool
    pool.close(relays);

    console.log(`[AppProfile] Fetched kind: 0 event for ${pubkey} from relays`);
    return event;
  } catch (error) {
    console.error(
      `[AppProfile] Error fetching kind: 0 event for ${pubkey}:`,
      error
    );
    pool.close(relays);
    return null;
  }
}

/**
 * Parses a kind: 0 event to extract profile information
 *
 * @param event - The kind: 0 Nostr event
 * @returns Parsed profile data
 */
function parseKind0Event(event: Event): Partial<AppProfile> {
  try {
    const content = JSON.parse(event.content);
    return {
      name: content.name || undefined,
      icon: content.picture || content.avatar || undefined,
      description: content.about || content.description || undefined,
    };
  } catch (error) {
    console.error('Error parsing kind: 0 event content:', error);
    return {};
  }
}

/**
 * Fetches application profile information from Nostr relays
 *
 * @param pubkey - The application pubkey in hex format
 * @param relays - Optional array of relay URLs
 * @returns Application profile, or null if fetch fails
 */
export async function fetchAppProfile(
  pubkey: string,
  relays?: string[]
): Promise<AppProfile | null> {
  try {
    // Check cache first
    const cached = profileCache.get(pubkey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[AppProfile] Cache hit for pubkey ${pubkey}`);
      return cached.profile;
    }

    // Fetch kind: 0 event
    const event = await fetchKind0Event(pubkey, relays);
    if (!event) {
      console.log(`[AppProfile] No kind: 0 event found for pubkey ${pubkey}`);
      return null;
    }

    // Parse event content
    const parsed = parseKind0Event(event);

    // Build profile object
    const profile: AppProfile = {
      pubkey,
      name: parsed.name,
      icon: parsed.icon,
      description: parsed.description,
      fetchedAt: Date.now(),
    };

    // Cache the result
    profileCache.set(pubkey, {
      profile,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    console.log(`[AppProfile] Fetched and cached profile for ${pubkey}:`, {
      name: profile.name,
      hasIcon: !!profile.icon,
      hasDescription: !!profile.description,
    });
    return profile;
  } catch (error) {
    console.error(
      `[AppProfile] Error fetching app profile for ${pubkey}:`,
      error
    );
    return null;
  }
}

/**
 * Gets application profile information from a canonical URL
 * Combines NIP-05 resolution and kind: 0 event fetching
 *
 * @param canonicalUrl - The application canonical URL
 * @param relays - Optional array of relay URLs for kind: 0 fetching
 * @returns Application profile with fallback values, or null if resolution fails
 */
export async function getApplicationProfile(
  canonicalUrl: string,
  relays?: string[]
): Promise<AppProfile | null> {
  try {
    // Check cache first (by canonical URL)
    const cached = profileCache.get(canonicalUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    // Resolve NIP-05 to get pubkey
    const pubkey = await resolveNip05(canonicalUrl);
    if (!pubkey) {
      // Return fallback profile with just the URL
      const fallbackProfile: AppProfile = {
        pubkey: '',
        canonicalUrl,
        name: canonicalUrl,
        fetchedAt: Date.now(),
      };
      return fallbackProfile;
    }

    // Fetch profile from relays
    const profile = await fetchAppProfile(pubkey, relays);
    if (!profile) {
      // Return fallback profile with pubkey
      const fallbackProfile: AppProfile = {
        pubkey,
        canonicalUrl,
        name: canonicalUrl,
        fetchedAt: Date.now(),
      };
      return fallbackProfile;
    }

    // Add canonical URL to profile
    profile.canonicalUrl = canonicalUrl;

    // Cache by both pubkey and canonical URL
    profileCache.set(pubkey, {
      profile,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    profileCache.set(canonicalUrl, {
      profile,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return profile;
  } catch (error) {
    console.error('Error getting application profile:', error);
    // Return fallback profile
    return {
      pubkey: '',
      canonicalUrl,
      name: canonicalUrl,
      fetchedAt: Date.now(),
    };
  }
}

/**
 * Clears the application profile cache
 */
export function clearAppProfileCache(): void {
  profileCache.clear();
}

/**
 * Gets cache statistics (for debugging/monitoring)
 */
export function getAppProfileCacheStats(): { size: number; entries: number } {
  // Clean expired entries
  const now = Date.now();
  for (const [key, entry] of profileCache.entries()) {
    if (entry.expiresAt <= now) {
      profileCache.delete(key);
    }
  }

  return {
    size: profileCache.size,
    entries: profileCache.size,
  };
}
