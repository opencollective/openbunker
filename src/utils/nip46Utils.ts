export type ParsedNostrConnectURI = {
  protocol: 'nostrconnect';
  clientPubkey: string;
  params: {
    relays: string[];
    secret: string;
    perms?: string[];
    name?: string;
    url?: string;
    image?: string;
  };
  originalString: string;
};
export function parseNostrConnectURI(uri: string): ParsedNostrConnectURI {
  if (!uri.startsWith('nostrconnect://')) {
    throw new Error(
      'Invalid nostrconnect URI: Must start with "nostrconnect://".'
    );
  }

  const [protocolAndPubkey, queryString] = uri.split('?');
  if (!protocolAndPubkey || !queryString) {
    throw new Error('Invalid nostrconnect URI: Missing query string.');
  }

  const clientPubkey = protocolAndPubkey.substring('nostrconnect://'.length);
  if (!clientPubkey) {
    throw new Error('Invalid nostrconnect URI: Missing client-pubkey.');
  }

  const queryParams = new URLSearchParams(queryString);

  const relays = queryParams.getAll('relay');
  if (relays.length === 0) {
    throw new Error('Invalid nostrconnect URI: Missing "relay" parameter.');
  }

  const secret = queryParams.get('secret');
  if (!secret) {
    throw new Error('Invalid nostrconnect URI: Missing "secret" parameter.');
  }

  const permsString = queryParams.get('perms');
  const perms = permsString ? permsString.split(',') : undefined;

  const name = queryParams.get('name') || undefined;
  const url = queryParams.get('url') || undefined;
  const image = queryParams.get('image') || undefined;

  return {
    protocol: 'nostrconnect',
    clientPubkey,
    params: {
      relays,
      secret,
      perms,
      name,
      url,
      image,
    },
    originalString: uri,
  };
}
