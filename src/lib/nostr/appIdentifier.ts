/**
 * Application Identifier Validation Utilities
 *
 * Validates and normalizes application identifiers (pubkeys and URLs).
 */

import { nip19 } from 'nostr-tools';

/**
 * Validates if a string is a valid Nostr pubkey in hex format (64 chars)
 */
export function isValidHexPubkey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Validates if a string is a valid Nostr pubkey in npub format (bech32)
 */
export function isValidNpub(npub: string): boolean {
  try {
    const decoded = nip19.decode(npub);
    return decoded.type === 'npub' && isValidHexPubkey(decoded.data as string);
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a pubkey to hex format
 * - If already hex, returns as-is
 * - If npub format, decodes to hex
 * - Otherwise returns null
 */
export function normalizePubkeyToHex(identifier: string): string | null {
  // Check if already hex format
  if (isValidHexPubkey(identifier)) {
    return identifier.toLowerCase();
  }

  // Check if npub format
  if (isValidNpub(identifier)) {
    try {
      const decoded = nip19.decode(identifier);
      if (decoded.type === 'npub') {
        return (decoded.data as string).toLowerCase();
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Validates an application identifier (pubkey or URL)
 *
 * @param identifier - Application identifier (hex pubkey, npub, or URL)
 * @returns Object with validation result and normalized value
 */
export function validateAppIdentifier(identifier: string): {
  valid: boolean;
  type: 'pubkey' | 'url' | 'invalid';
  normalized?: string;
} {
  // Try to normalize as pubkey first
  const normalizedPubkey = normalizePubkeyToHex(identifier);
  if (normalizedPubkey) {
    return {
      valid: true,
      type: 'pubkey',
      normalized: normalizedPubkey,
    };
  }

  // Check if it's a valid URL
  if (isValidUrl(identifier)) {
    return {
      valid: true,
      type: 'url',
      normalized: identifier,
    };
  }

  return {
    valid: false,
    type: 'invalid',
  };
}

/**
 * Normalizes an array of application identifiers
 * - Converts npub to hex
 * - Removes duplicates
 * - Removes invalid entries
 *
 * @param identifiers - Array of application identifiers
 * @returns Array of normalized identifiers (hex pubkeys and URLs)
 */
export function normalizeAppIdentifiers(identifiers: string[]): string[] {
  const normalized = new Set<string>();

  for (const identifier of identifiers) {
    const validation = validateAppIdentifier(identifier);
    if (validation.valid && validation.normalized) {
      normalized.add(validation.normalized);
    }
  }

  return Array.from(normalized);
}

