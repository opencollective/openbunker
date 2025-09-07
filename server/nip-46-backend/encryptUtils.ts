import { nip04, nip44 } from 'nostr-tools';

export type EncryptionScheme = 'nip04' | 'nip44';

export function encrypt(
  recipientHexPubKey: string,
  privateKey: Uint8Array,
  value: string,
  scheme?: EncryptionScheme
): string {
  if (scheme === 'nip44') {
    const conversationKey = nip44.v2.utils.getConversationKey(
      privateKey,
      recipientHexPubKey
    );
    return nip44.v2.encrypt(value, conversationKey);
  }
  return nip04.encrypt(privateKey, recipientHexPubKey, value);
}

export function decrypt(
  senderHexPubKey: string,
  privateKey: Uint8Array,
  value: string,
  scheme?: EncryptionScheme
): string {
  if (scheme === 'nip44') {
    const conversationKey = nip44.v2.utils.getConversationKey(
      privateKey,
      senderHexPubKey
    );
    return nip44.v2.decrypt(value, conversationKey);
  }
  return nip04.decrypt(privateKey, senderHexPubKey, value);
}
