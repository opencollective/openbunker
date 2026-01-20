/**
 * Scope Application Restrictions
 *
 * Validates if applications are allowed within a scope based on scope configuration.
 */

import { validateAppIdentifier } from '@/lib/nostr/appIdentifier';
import { resolveNip05 } from '@/lib/nostr/nip05Utils';

/**
 * Validates if an application is allowed in a scope
 *
 * @param appIdentifier - Application identifier (pubkey in hex/npub format, or canonical URL)
 * @param allowedApplications - Array of allowed application identifiers from scope config (can be null, empty array, or array of strings)
 * @returns true if application is allowed, false otherwise
 */
export async function validateAppAllowed(
  appIdentifier: string,
  allowedApplications: string[] | null | undefined
): Promise<boolean> {
  // If no restrictions configured (null or empty array), allow all applications
  if (!allowedApplications || allowedApplications.length === 0) {
    console.log(
      `[ScopeRestrictions] No restrictions configured, allowing ${appIdentifier}`
    );
    return true;
  }

  // Validate and normalize the requesting application identifier
  const validation = validateAppIdentifier(appIdentifier);
  if (!validation.valid) {
    return false;
  }

  // Normalize the requesting identifier
  const normalizedRequesting = validation.normalized!;

  // Check each allowed application identifier
  for (const allowed of allowedApplications) {
    const allowedValidation = validateAppIdentifier(allowed);
    if (!allowedValidation.valid) {
      continue; // Skip invalid entries
    }

    const normalizedAllowed = allowedValidation.normalized!;

    // Compare based on type
    if (validation.type === 'pubkey' && allowedValidation.type === 'pubkey') {
      // Both are pubkeys - compare hex values
      if (normalizedRequesting === normalizedAllowed) {
        console.log(
          `[ScopeRestrictions] Application ${appIdentifier} allowed (pubkey match)`
        );
        return true;
      }
    } else if (validation.type === 'url' && allowedValidation.type === 'url') {
      // Both are URLs - compare directly
      if (normalizedRequesting === normalizedAllowed) {
        console.log(
          `[ScopeRestrictions] Application ${appIdentifier} allowed (URL match)`
        );
        return true;
      }
    } else if (
      validation.type === 'url' &&
      allowedValidation.type === 'pubkey'
    ) {
      // Requesting URL, allowed is pubkey - resolve URL to pubkey and compare
      try {
        const resolvedPubkey = await resolveNip05(normalizedRequesting);
        if (
          resolvedPubkey &&
          resolvedPubkey.toLowerCase() === normalizedAllowed.toLowerCase()
        ) {
          console.log(
            `[ScopeRestrictions] Application ${appIdentifier} allowed (URL resolved to pubkey match)`
          );
          return true;
        }
      } catch {
        // Resolution failed, continue checking other entries
        continue;
      }
    } else if (
      validation.type === 'pubkey' &&
      allowedValidation.type === 'url'
    ) {
      // Requesting pubkey, allowed is URL - resolve URL to pubkey and compare
      try {
        const resolvedPubkey = await resolveNip05(normalizedAllowed);
        if (
          resolvedPubkey &&
          resolvedPubkey.toLowerCase() === normalizedRequesting.toLowerCase()
        ) {
          console.log(
            `[ScopeRestrictions] Application ${appIdentifier} allowed (pubkey matches resolved URL)`
          );
          return true;
        }
      } catch {
        // Resolution failed, continue checking other entries
        continue;
      }
    }
  }

  // No match found
  console.log(
    `[ScopeRestrictions] Application ${appIdentifier} not in allowed list (${allowedApplications.length} entries)`
  );
  return false;
}
