/**
 * NIP-05 Resolution Utilities
 *
 * Resolves application canonical URLs to Nostr pubkeys using NIP-05 protocol.
 */

// Timeout for NIP-05 resolution: 3 seconds
const RESOLUTION_TIMEOUT_MS = 3000;

/**
 * Resolves a canonical URL to a Nostr pubkey using NIP-05 protocol
 *
 * @param canonicalUrl - The application canonical URL (e.g., "https://app.example.com" or "app@example.com")
 * @returns The resolved pubkey in hex format, or null if resolution fails
 */
export async function resolveNip05(
  canonicalUrl: string
): Promise<string | null> {
  try {
    // Parse URL to extract domain and local-part
    let domain: string;
    let localPart: string | null = null;

    // Handle both URL format (https://app.example.com) and email format (app@example.com)
    if (canonicalUrl.includes('@')) {
      // Email format: app@example.com
      const parts = canonicalUrl.split('@');
      if (parts.length !== 2) {
        throw new Error('Invalid NIP-05 format');
      }
      localPart = parts[0];
      domain = parts[1];
    } else {
      // URL format: https://app.example.com
      try {
        const url = new URL(canonicalUrl);
        domain = url.hostname;
        // Extract local part from name query parameter if present (e.g., ?name=app -> app)
        localPart = url.searchParams.get('name');
      } catch {
        // If not a valid URL, treat the whole string as domain
        domain = canonicalUrl.replace(/^https?:\/\//, '').split('/')[0];
      }
    }

    // Construct NIP-05 query URL
    const nip05Url = localPart
      ? `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`
      : `https://${domain}/.well-known/nostr.json`;

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      RESOLUTION_TIMEOUT_MS
    );

    try {
      const response = await fetch(nip05Url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `NIP-05 resolution failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Extract pubkey from response
      // NIP-05 format: { "names": { "local-part": "pubkey-hex" } }
      let pubkey: string | null = null;

      if (localPart && data.names && data.names[localPart]) {
        pubkey = data.names[localPart];
      } else if (data.names && typeof data.names === 'object') {
        console.log(`[NIP-05] Names for ${nip05Url}:`, data.names);
        // If no local part, try to get the first entry
        const names = Object.values(data.names);
        if (names.length > 0 && typeof names[0] === 'string') {
          pubkey = names[0] as string;
        }
        console.log(`[NIP-05] Pubkey for ${nip05Url}:`, pubkey);
      }

      if (!pubkey) {
        throw new Error('No pubkey found in NIP-05 response');
      }

      console.log(`[NIP-05] Pubkey length: ${pubkey.length}`);

      // Validate pubkey format (should be 64 character hex string)
      if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
        throw new Error('Invalid pubkey format in NIP-05 response');
      }

      return pubkey;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('NIP-05 resolution timeout');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error resolving NIP-05:', error);
    return null;
  }
}
