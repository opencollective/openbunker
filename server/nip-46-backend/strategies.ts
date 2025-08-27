import { NDKEvent, NDKNip46Backend, NDKUser } from '@nostr-dev-kit/ndk';

/**
 * "connect" method handler.
 *
 * This method receives a:
 * * token -- An optional OTP token
 */
export class ConnectEventHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    // remotePubkey is the user trying to sign in (it is remote from the point of view of the server)
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [signerPubkey, token] = params; //[<remote-signer-pubkey>, <optional_secret>, <optional_requested_permissions>]
    const debug = backend.debug.extend('connect');

    debug(`connection request from ${remotePubkey}`);

    if (token && backend.applyToken) {
      debug('applying token');
      await backend.applyToken(remotePubkey, token);
    }

    if (
      await backend.pubkeyAllowed({
        id,
        pubkey: remotePubkey,
        method: 'connect',
        // passing all params
        params: params,
      })
    ) {
      debug(`connection request from ${remotePubkey} allowed`);
      return 'ack';
    }
    debug(`connection request from ${remotePubkey} rejected`);

    return undefined;
  }
}

export class GetPublicKeyHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    _id: string,
    _remotePubkey: string,
    _params: string[]
  ): Promise<string | undefined> {
    return backend.localUser?.pubkey;
  }
}

export interface IEventHandlingStrategy {
  handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined>;
}

export class Nip04DecryptHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [senderPubkey, payload] = params;
    const senderUser = new NDKUser({ pubkey: senderPubkey });
    const decryptedPayload = await decrypt(
      backend,
      id,
      remotePubkey,
      senderUser,
      payload
    );

    return decryptedPayload;
  }
}

async function decrypt(
  backend: NDKNip46Backend,
  id: string,
  remotePubkey: string,
  senderUser: NDKUser,
  payload: string
) {
  if (
    !(await backend.pubkeyAllowed({
      id,
      pubkey: remotePubkey,
      method: 'nip04_decrypt',
      params: payload,
    }))
  ) {
    backend.debug(`decrypt request from ${remotePubkey} rejected`);
    return undefined;
  }

  return await backend.signer.decrypt(senderUser, payload, 'nip04');
}

export class Nip44DecryptHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [senderPubkey, payload] = params;
    const senderUser = new NDKUser({ pubkey: senderPubkey });
    const decryptedPayload = await decrypt44(
      backend,
      id,
      remotePubkey,
      senderUser,
      payload
    );

    return decryptedPayload;
  }
}

async function decrypt44(
  backend: NDKNip46Backend,
  id: string,
  remotePubkey: string,
  senderUser: NDKUser,
  payload: string
) {
  if (
    !(await backend.pubkeyAllowed({
      id,
      pubkey: remotePubkey,
      method: 'nip44_decrypt',
      params: payload,
    }))
  ) {
    backend.debug(`decrypt request from ${remotePubkey} rejected`);
    return undefined;
  }

  return await backend.signer.decrypt(senderUser, payload, 'nip44');
}

export class Nip44EncryptHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [recipientPubkey, payload] = params;
    const recipientUser = new NDKUser({ pubkey: recipientPubkey });
    const encryptedPayload = await encrypt44(
      backend,
      id,
      remotePubkey,
      recipientUser,
      payload
    );

    return encryptedPayload;
  }
}

async function encrypt44(
  backend: NDKNip46Backend,
  id: string,
  remotePubkey: string,
  recipientUser: NDKUser,
  payload: string
): Promise<string | undefined> {
  if (
    !(await backend.pubkeyAllowed({
      id,
      pubkey: remotePubkey,
      method: 'nip44_encrypt',
      params: payload,
    }))
  ) {
    backend.debug(`encrypt request from ${remotePubkey} rejected`);
    return undefined;
  }

  return await backend.signer.encrypt(recipientUser, payload, 'nip44');
}
export class Nip04EncryptHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [recipientPubkey, payload] = params;
    const recipientUser = new NDKUser({ pubkey: recipientPubkey });
    const encryptedPayload = await encrypt(
      backend,
      id,
      remotePubkey,
      recipientUser,
      payload
    );

    return encryptedPayload;
  }
}

async function encrypt(
  backend: NDKNip46Backend,
  id: string,
  remotePubkey: string,
  recipientUser: NDKUser,
  payload: string
): Promise<string | undefined> {
  if (
    !(await backend.pubkeyAllowed({
      id,
      pubkey: remotePubkey,
      method: 'nip44_encrypt',
      params: payload,
    }))
  ) {
    backend.debug(`encrypt request from ${remotePubkey} rejected`);
    return undefined;
  }

  return await backend.signer.encrypt(recipientUser, payload, 'nip44');
}

/**
 * "ping" method handler.
 */
export class PingEventHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    _params: string[]
  ): Promise<string | undefined> {
    const debug = backend.debug.extend('ping');

    debug(`ping request from ${remotePubkey}`);

    if (
      await backend.pubkeyAllowed({ id, pubkey: remotePubkey, method: 'ping' })
    ) {
      debug(`connection request from ${remotePubkey} allowed`);
      return 'pong';
    }
    debug(`connection request from ${remotePubkey} rejected`);

    return undefined;
  }
}

export class SignEventHandlingStrategy implements IEventHandlingStrategy {
  async handle(
    backend: NDKNip46Backend,
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const event = await signEvent(backend, id, remotePubkey, params);
    if (!event) return undefined;

    return JSON.stringify(await event.toNostrEvent());
  }
}

async function signEvent(
  backend: NDKNip46Backend,
  id: string,
  remotePubkey: string,
  params: string[]
): Promise<NDKEvent | undefined> {
  const [eventString] = params;

  backend.debug(`sign event request from ${remotePubkey}`);

  const event = new NDKEvent(backend.ndk, JSON.parse(eventString));

  backend.debug('event to sign', event.rawEvent());

  if (
    !(await backend.pubkeyAllowed({
      id,
      pubkey: remotePubkey,
      method: 'sign_event',
      params: event,
    }))
  ) {
    backend.debug(`sign event request from ${remotePubkey} rejected`);
    return undefined;
  }

  backend.debug(`sign event request from ${remotePubkey} allowed`);

  await event.sign(backend.signer);
  return event;
}
