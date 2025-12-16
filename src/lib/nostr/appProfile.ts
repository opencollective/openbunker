/**
 * Application Profile Fetching
 *
 * Fetches application profile information (kind: 0 events) from Nostr relays.
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

    console.log(`[AppProfile] Fetched profile for ${pubkey}:`, {
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

    console.log('Fetched profile:', profile);
    // Add canonical URL to profile
    profile.canonicalUrl = canonicalUrl;

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
