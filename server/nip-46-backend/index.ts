import { prisma } from '@/lib/db';
import { NDKEvent, NDKPrivateKeySigner, NIP46Method } from '@nostr-dev-kit/ndk';
import { nip19, NostrEvent, SimplePool } from 'nostr-tools';
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

type Nip46RPCCallParams = {
  /**
   * ID of the request
   */
  id: string;
  pubkey: string;
  method: NIP46Method;
  params?: any;
};

// Session information type based on database schema
type SessionInfo = {
  sessionNpub: string;
  npub: string;
  appNpub: string | null;
  scopeSlug: string | null;
  expiresAt: bigint;
  createdAt: Date;
  updatedAt: Date;
};

// Define the expected handler method signature
type HandlerMethod = (
  nip46RPCCallParams: Nip46RPCCallParams
) => Promise<string | undefined>;

// Define the expected session handler method signature (includes session info)
type SessionHandlerMethod = (
  nip46RPCCallParams: Nip46RPCCallParams,
  session: SessionInfo
) => Promise<string | undefined>;

// Extended NDKNip46Backend with logging
export default class Nip46ScopedDaemon {
  // Static property to store handlers
  static _handlers: Map<string, HandlerMethod> = new Map();

  // Each Daemon has their own pubkey
  private remoteSignerInfo: NostrUserInfo;
  // scope as defined in openbunker
  private bunkerScope: string;
  relayUrls: WebSocket['url'][];
  encryptedAdapter: NDKEncryptedNostrChannelAdapter;

  private pool: SimplePool;

  // This will be done on each connection
  // Allow Callback will not be a param at first
  // allowCallback: (params: any) => Promise<boolean>
  private sub?: SubCloser;
  constructor(
    remoteSignerInfo: NostrUserInfo,
    scope: string,
    relayUrls?: WebSocket['url'][]
  ) {
    this.pool = new SimplePool();
    this.relayUrls = relayUrls ?? [];
    this.remoteSignerInfo = remoteSignerInfo;
    this.encryptedAdapter = new NDKEncryptedNostrChannelAdapter(
      new NDKPrivateKeySigner(remoteSignerInfo.privateKey),
      relayUrls ?? []
    );
    this.bunkerScope = scope;
  }

  sessionHandlers: Map<string, SessionHandlerMethod> = new Map([
    ['get_public_key', this.handleGetPublicKey],
    ['nip04_decrypt', this.handleNip04Decrypt],
    ['nip04_encrypt', this.handleNip04Encrypt],
    ['nip44_decrypt', this.handleNip44Decrypt],
    ['nip44_encrypt', this.handleNip44Encrypt],
    ['ping', this.handlePing],
    ['sign_event', this.handleSignEvent],
  ]);

  private async getUserPrivateKey(
    session: SessionInfo
  ): Promise<Uint8Array | null> {
    try {
      // Get the user's private key from the Keys table using the session's npub
      const userKey = await prisma.keys.findUnique({
        where: {
          npub: session.npub,
        },
        select: {
          ncryptsec: true,
        },
      });

      if (!userKey || !userKey.ncryptsec) {
        console.log(`No private key found for user ${session.npub}`);
        return null;
      }

      // Decode the nsec to get the private key bytes
      const decoded = hexToBytes(userKey.ncryptsec);
      return decoded as Uint8Array;
    } catch (error) {
      console.error(
        `Error getting private key for user ${session.npub}:`,
        error
      );
      return null;
    }
  }

  private async validateAndGetUserSession(
    params: Nip46RPCCallParams
  ): Promise<SessionInfo | null> {
    console.log(`Validating connection for ${params.pubkey}:`, params);
    const npub = nip19.npubEncode(params.pubkey);
    // Check if we have a valid token for this connection
    if (params.method === 'connect') {
      const remoteNpub = nip19.npubEncode(params.pubkey);
      // the signer-side pubkey
      // const signerPubkey = params.params[0];
      // const signerNpub = nip19.npubEncode(signerPubkey);
      const token = params.params[1];

      // First check if there is an existing session for the user npub (remoteSignerPubkey) / and local npub
      const pubkeySession = await prisma.sessions.findFirst({
        where: {
          // npub: signerNpub,
          sessionNpub: remoteNpub,
          scopeSlug: this.bunkerScope || null,
        },
      });
      if (pubkeySession) {
        console.log(
          'Found existing session for ',
          remoteNpub,
          this.bunkerScope ? `in scope ${this.bunkerScope}` : ''
        );
        return pubkeySession;
      }
      // FIXME
      console.log(
        'No existing session found for ',
        remoteNpub,
        this.bunkerScope ? `in scope ${this.bunkerScope}` : ''
      );
      console.log('Looking for token in database', token, remoteNpub);
      // If there are no active sessions, we need a connection token
      // FIXME add scope filter
      const dbToken = await prisma.connectTokens.findFirst({
        where: {
          token: token,
          expiry: {
            gt: BigInt(Date.now()),
          },
        },
      });
      if (dbToken) {
        console.log(`Token: ${token} is valid`);
        console.log(`DB Token: ${dbToken}`);
        const signerNpub = dbToken.npub;
        // The token is used, so we delete it and create a session based on the token
        // delete token
        await prisma.connectTokens.delete({
          where: {
            token: token,
          },
        });
        // create session
        const newSession = await prisma.sessions.create({
          data: {
            npub: signerNpub,
            sessionNpub: remoteNpub,
            scopeSlug: this.bunkerScope || null,
            expiresAt: BigInt(Date.now() + 1000 * 60 * 60), // 1 hour
          },
        });
        return newSession;
      } else {
        console.log(`Token: ${token} is invalid`);
        return null;
      }
    } else {
      // Check if there is a session active
      const remoteNpub = nip19.npubEncode(params.pubkey);
      const session = await prisma.sessions.findFirst({
        where: {
          // npub: npub,
          sessionNpub: remoteNpub,
          scopeSlug: this.bunkerScope || null,
        },
      });
      if (session) {
        console.log(
          'Found existing session for ',
          params.pubkey,
          this.bunkerScope ? `in scope ${this.bunkerScope}` : ''
        );
        return session;
      } else {
        console.log(
          'No session found for ',
          remoteNpub,
          this.bunkerScope ? `in scope ${this.bunkerScope}` : ''
        );
        return null;
      }
    }
  }

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

  async stop(): Promise<void> {
    this.sub?.close();
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
      const nip46RPCCallParams = (await this.encryptedAdapter.parseEvent(
        event
      )) as Nip46RPCCallParams;
      const { id, method, params } = nip46RPCCallParams;
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

      let response: string | undefined;
      const remotePubkey = event.pubkey;

      // Handle connect request separately, all other requests require a session
      if (method === 'connect') {
        response = await this.handleConnect(nip46RPCCallParams);
        console.log('connect request from ', remotePubkey, ' allowed');
        this.encryptedAdapter.sendResponse(id, remotePubkey, response);
        return;
      }

      // Verify permissions and get session
      const session = await this.validateAndGetUserSession(nip46RPCCallParams);
      if (session == null) {
        // send error
        this.encryptedAdapter.sendResponse(
          id,
          remotePubkey,
          'error',
          undefined,
          'Not authorized'
        );
        return;
      }

      // Try session handlers
      const sessionHandlerMethod = this.sessionHandlers.get(method);
      if (sessionHandlerMethod) {
        try {
          if (typeof sessionHandlerMethod === 'function') {
            response = await sessionHandlerMethod.call(
              this,
              nip46RPCCallParams,
              session
            );
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
        console.log('supported session handlers', this.sessionHandlers);
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

  private async handleConnect(
    nip46RPCCallParams: Nip46RPCCallParams
  ): Promise<string> {
    const [signerPubkey, token] = nip46RPCCallParams.params; //[<remote-signer-pubkey>, <optional_secret>, <optional_requested_permissions>]
    const session = await this.validateAndGetUserSession(nip46RPCCallParams);

    console.log('connect request from ', nip46RPCCallParams.pubkey, ' allowed');
    return 'ack';
  }

  private async handleGetPublicKey(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string> {
    return nip19.decode(session.npub).data as string;
  }

  private async handleNip04Decrypt(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string | undefined> {
    const [senderPubkey, payload] = nip46RPCCallParams.params;

    // Get the user's private key from the session
    const userPrivateKey = await this.getUserPrivateKey(session);
    if (!userPrivateKey) {
      console.error(`Failed to get private key for user ${session.npub}`);
      return undefined;
    }

    const decryptedPayload = decrypt(
      senderPubkey,
      userPrivateKey,
      payload,
      'nip04'
    );

    return decryptedPayload;
  }

  private async handleNip44Decrypt(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string | undefined> {
    const [senderPubkey, payload] = nip46RPCCallParams.params;

    // Get the user's private key from the session
    const userPrivateKey = await this.getUserPrivateKey(session);
    if (!userPrivateKey) {
      console.error(`Failed to get private key for user ${session.npub}`);
      return undefined;
    }

    const decryptedPayload = decrypt(
      senderPubkey,
      userPrivateKey,
      payload,
      'nip44'
    );

    return decryptedPayload;
  }

  private async handleNip44Encrypt(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string | undefined> {
    const [recipientPubkey, payload] = nip46RPCCallParams.params;

    // Get the user's private key from the session
    const userPrivateKey = await this.getUserPrivateKey(session);
    if (!userPrivateKey) {
      console.error(`Failed to get private key for user ${session.npub}`);
      return undefined;
    }

    const encryptedPayload = encrypt(
      recipientPubkey,
      userPrivateKey,
      payload,
      'nip44'
    );

    return encryptedPayload;
  }

  private async handleNip04Encrypt(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string | undefined> {
    const [recipientPubkey, payload] = nip46RPCCallParams.params;

    // Get the user's private key from the session
    const userPrivateKey = await this.getUserPrivateKey(session);
    if (!userPrivateKey) {
      console.error(`Failed to get private key for user ${session.npub}`);
      return undefined;
    }

    const encryptedPayload = encrypt(
      recipientPubkey,
      userPrivateKey,
      payload,
      'nip04'
    );

    return encryptedPayload;
  }

  private async handlePing(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string | undefined> {
    console.log(`ping request from ${nip46RPCCallParams.pubkey}`);
    console.log(`connection request from ${nip46RPCCallParams.pubkey} allowed`);
    return 'pong';
  }

  private async handleSignEvent(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<string | undefined> {
    const event = await this.signEvent(nip46RPCCallParams, session);
    if (!event) return undefined;

    return JSON.stringify(await event.toNostrEvent());
  }

  private async signEvent(
    nip46RPCCallParams: Nip46RPCCallParams,
    session: SessionInfo
  ): Promise<NDKEvent | undefined> {
    const [eventString] = nip46RPCCallParams.params;

    console.log(`sign event request from ${nip46RPCCallParams.pubkey}`);

    const event = new NDKEvent(undefined, JSON.parse(eventString));

    console.log('event to sign', event.rawEvent());
    const key = await this.getUserPrivateKey(session);
    if (!key) {
      console.error(`Failed to get private key for user ${session.npub}`);
      return undefined;
    }
    await event.sign(new NDKPrivateKeySigner(key));
    return event;
  }
}
