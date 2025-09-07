import { NDKEvent, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
import { NostrEvent, SimplePool } from 'nostr-tools';
import { SubCloser } from 'nostr-tools/abstract-pool';
import { hexToBytes } from 'nostr-tools/utils';
import { decrypt, encrypt } from './encryptUtils';
import { NDKEncryptedNostrChannelAdapter } from './nostr-rpc';

type NostrUserInfo = {
  npub: string;
  nsec: string;
  pubKey: string;
  privateKey: Uint8Array;
};

// Handler decorator to register methods as handlers
function handler(method: string) {
  return function (
    target: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propertyKey: ClassMethodDecoratorContext<Nip46Daemon, any>,
    descriptor?: PropertyDescriptor
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!target.constructor._handlers) {
      target.constructor._handlers = new Map();
    }
    target.constructor._handlers.set(method, target[propertyKey.name]);
  };
}

// Extended NDKNip46Backend with logging
export default class Nip46Daemon {
  // Each Daemon has their own pubkey
  private remoteSignerInfo: NostrUserInfo;
  relayUrls: WebSocket['url'][];
  encryptedAdapter: NDKEncryptedNostrChannelAdapter;

  private pool: SimplePool;

  // This will be done on each connection
  // Allow Callback will not be a param at first
  // allowCallback: (params: any) => Promise<boolean>
  private sub?: SubCloser;
  constructor(remoteSignerInfo: NostrUserInfo, relayUrls?: WebSocket['url'][]) {
    this.pool = new SimplePool();
    this.relayUrls = relayUrls ?? [];
    this.remoteSignerInfo = remoteSignerInfo;
    this.encryptedAdapter = new NDKEncryptedNostrChannelAdapter(
      new NDKPrivateKeySigner(remoteSignerInfo.privateKey),
      relayUrls
    );
  }

  //   pubkeyAllowed(params: Nip46PermitCallbackParams): Promise<boolean>;
  async start(): Promise<void> {
    // this.localUser = await this.signer.user();
    const filter = {
      kinds: [24133],
      '#p': [this.remoteSignerInfo.pubKey],
      since: Math.floor(Date.now() / 1000),
    };
    const handler = (e: NostrEvent) => this.handleIncomingEvent(e);
    this.sub = this.pool.subscribe(this.relayUrls, filter, {
      onevent(event) {
        handler(event);
      },
      oneose() {
        console.log('Subscription ended');
      },
    });
  }

  protected async handleIncomingEvent(event: NostrEvent): Promise<void> {
    const timestamp = new Date().toISOString();
    const remotePubkey = event.pubkey;

    console.log(
      `[${timestamp}] [${this.remoteSignerInfo.npub}] 📥 Incoming NIP-46 request from ${remotePubkey}`
    );
    console.log(
      `[${timestamp}] [${this.remoteSignerInfo.npub}] 📋 Event details:`,
      {
        id: event.id,
        kind: event.kind,
        created_at: event.created_at
          ? new Date(event.created_at * 1000).toISOString()
          : 'unknown',
        content_length: event.content.length,
        tags_count: event.tags.length,
      }
    );

    try {
      // Decrypt the event
      const { id, method, params } = (await this.encryptedAdapter.parseEvent(
        event
      )) as any;

      console.log(
        `[${timestamp}] [${this.remoteSignerInfo.npub}] 🔍 Parsed request:`,
        {
          id,
          method,
          params_count: params ? params.length : 0,
          params_preview: params
            ? JSON.stringify(params).substring(0, 200) +
              (JSON.stringify(params).length > 200 ? '...' : '')
            : 'none',
        }
      );

      // Verify permissions and get session
      const session = validateAndGetUserSession(id, method, params);
      const remotePubkey = event.pubkey;
      let response: string | undefined;

      const handlerMethodName = (this.constructor as any)._handlers.get(method);
      if (handlerMethodName) {
        try {
          const handlerMethod = (this as any)[handlerMethodName];
          if (typeof handlerMethod === 'function') {
            response = await handlerMethod.call(this, id, remotePubkey, params);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          this.encryptedAdapter.sendResponse(
            id,
            remotePubkey,
            'error',
            undefined,
            e.message
          );
        }
      } else {
        console.log('unsupported method', { method, params });
      }

      if (response) {
        console.log(`sending response to ${remotePubkey}`, response);
        this.encryptedAdapter.sendResponse(id, remotePubkey, response);
      } else {
        this.encryptedAdapter.sendResponse(
          id,
          remotePubkey,
          'error',
          undefined,
          'Not authorized'
        );
      }

      console.log(
        `[${timestamp}] [${this.remoteSignerInfo.npub}] ✅ Request processed successfully`
      );
    } catch (error) {
      console.error(
        `[${timestamp}] [${this.remoteSignerInfo.npub}] ❌ Error processing request:`,
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          remote_pubkey: remotePubkey,
        }
      );

      // Re-throw to maintain original behavior
      throw error;
    }
  }

  @handler('connect')
  private async handleConnect(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [signerPubkey, token] = params; //[<remote-signer-pubkey>, <optional_secret>, <optional_requested_permissions>]

    if (
      await this.pubkeyAllowed({
        id,
        pubkey: remotePubkey,
        method: 'connect',
        // passing all params
        params: params,
      })
    ) {
      return 'ack';
    }
    console.log(`connection request from ${remotePubkey} rejected`);

    return undefined;
  }

  @handler('get_public_key')
  private async handleGetPublicKey(
    _id: string,
    _remotePubkey: string,
    _params: string[]
  ): Promise<string | undefined> {
    // This should be a lookup in the database
    return this.remoteSignerInfo.pubKey;
  }

  @handler('nip04_decrypt')
  private async handleNip04Decrypt(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [senderPubkey, payload] = params;
    const senderUser = new NDKUser({ pubkey: senderPubkey });

    // TODO: Get private sender key from the database
    const senderPrivateKey = hexToBytes('blah');
    const decryptedPayload = decrypt(
      senderPubkey,
      senderPrivateKey,
      payload,
      'nip04'
    );

    return decryptedPayload;
  }

  @handler('nip44_decrypt')
  private async handleNip44Decrypt(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [senderPubkey, payload] = params;
    const senderUser = new NDKUser({ pubkey: senderPubkey });

    // TODO: Get private sender key from the database
    const senderPrivateKey = hexToBytes('blah');
    const decryptedPayload = decrypt(
      senderPubkey,
      senderPrivateKey,
      payload,
      'nip44'
    );

    return decryptedPayload;
  }

  @handler('nip44_encrypt')
  private async handleNip44Encrypt(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [recipientPubkey, payload] = params;
    const recipientUser = new NDKUser({ pubkey: recipientPubkey });
    const recipientPrivateKey = hexToBytes('blah');
    const encryptedPayload = encrypt(
      recipientPubkey,
      recipientPrivateKey,
      payload,
      'nip44'
    );

    return encryptedPayload;
  }

  @handler('nip04_encrypt')
  private async handleNip04Encrypt(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const [recipientPubkey, payload] = params;
    const recipientPrivateKey = hexToBytes('blah');
    const encryptedPayload = encrypt(
      recipientPubkey,
      recipientPrivateKey,
      payload,
      'nip04'
    );

    return encryptedPayload;
  }

  @handler('ping')
  private async handlePing(
    id: string,
    remotePubkey: string,
    _params: string[]
  ): Promise<string | undefined> {
    console.log(`ping request from ${remotePubkey}`);

    if (
      await this.pubkeyAllowed({ id, pubkey: remotePubkey, method: 'ping' })
    ) {
      console.log(`connection request from ${remotePubkey} allowed`);
      return 'pong';
    }
    console.log(`connection request from ${remotePubkey} rejected`);

    return undefined;
  }

  @handler('sign_event')
  private async handleSignEvent(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<string | undefined> {
    const event = await this.signEvent(id, remotePubkey, params);
    if (!event) return undefined;

    return JSON.stringify(await event.toNostrEvent());
  }

  private async signEvent(
    id: string,
    remotePubkey: string,
    params: string[]
  ): Promise<NDKEvent | undefined> {
    const [eventString] = params;

    console.log(`sign event request from ${remotePubkey}`);

    const event = new NDKEvent(undefined, JSON.parse(eventString));

    console.log('event to sign', event.rawEvent());

    if (
      !(await this.pubkeyAllowed({
        id,
        pubkey: remotePubkey,
        method: 'sign_event',
        params: event,
      }))
    ) {
      console.log(`sign event request from ${remotePubkey} rejected`);
      return undefined;
    }

    console.log(`sign event request from ${remotePubkey} allowed`);

    // TODO: Implement proper signing with the daemon's private key
    // await event.sign(this.signer);
    return event;
  }

  // Placeholder method for pubkeyAllowed - needs to be implemented
  private async pubkeyAllowed(params: any): Promise<boolean> {
    // TODO: Implement proper authorization logic
    console.log('pubkeyAllowed called with:', params);
    return true; // For now, allow all requests
  }
}
