import { prisma } from '@/lib/db';
import { NDKEvent, NDKPrivateKeySigner, NIP46Method } from '@nostr-dev-kit/ndk';
import { Keys } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import {
  generateSecretKey,
  getPublicKey,
  nip19,
  NostrEvent,
  SimplePool,
} from 'nostr-tools';
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

/**
 * Extended NDKNip46Backend with automatic reconnection and exponential backoff
 *
 * Features:
 * - Automatic reconnection on subscription close events
 * - Exponential backoff with jitter to prevent thundering herd
 * - Configurable reconnection parameters
 * - Comprehensive logging for debugging
 *
 * Usage:
 * ```typescript
 * const daemon = new Nip46ScopedDaemon(
 *   remoteSignerInfo,
 *   scope,
 *   relayUrls,
 *   {
 *     maxReconnectAttempts: 10,
 *     baseReconnectDelay: 1000,
 *     maxReconnectDelay: 30000
 *   }
 * );
 *
 * await daemon.start();
 * // Daemon will automatically reconnect on subscription close
 * ```
 */
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

  // Reconnection handling properties
  private isConnected: boolean = false;
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 1000; // 1 second
  private maxReconnectDelay: number = 30000; // 30 seconds
  private reconnectTimeoutId?: NodeJS.Timeout;
  constructor(
    remoteSignerInfo: NostrUserInfo,
    scope: string,
    relayUrls?: WebSocket['url'][],
    options?: {
      maxReconnectAttempts?: number;
      baseReconnectDelay?: number;
      maxReconnectDelay?: number;
    }
  ) {
    this.pool = new SimplePool();
    this.relayUrls = relayUrls ?? [];
    this.remoteSignerInfo = remoteSignerInfo;
    this.encryptedAdapter = new NDKEncryptedNostrChannelAdapter(
      new NDKPrivateKeySigner(remoteSignerInfo.privateKey),
      relayUrls ?? []
    );
    this.bunkerScope = scope;

    // Apply custom options if provided
    if (options) {
      if (options.maxReconnectAttempts !== undefined) {
        this.maxReconnectAttempts = options.maxReconnectAttempts;
      }
      if (options.baseReconnectDelay !== undefined) {
        this.baseReconnectDelay = options.baseReconnectDelay;
      }
      if (options.maxReconnectDelay !== undefined) {
        this.maxReconnectDelay = options.maxReconnectDelay;
      }
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateReconnectDelay(): number {
    const exponentialDelay =
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, this.maxReconnectDelay);
  }

  /**
   * Handle connection failure and initiate reconnection
   */
  private handleConnectionFailure(): void {
    if (this.isReconnecting) {
      return; // Already reconnecting
    }

    this.isConnected = false;
    this.isReconnecting = true;

    console.log(
      `[${this.remoteSignerInfo.npub}] Connection failed, attempting reconnection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
    );

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        `[${this.remoteSignerInfo.npub}] Max reconnection attempts reached, giving up`
      );
      this.isReconnecting = false;
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();

    console.log(
      `[${this.remoteSignerInfo.npub}] Reconnecting in ${Math.round(delay)}ms`
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }

  /**
   * Attempt to reconnect to relays
   */
  private async attemptReconnection(): Promise<void> {
    try {
      console.log(`[${this.remoteSignerInfo.npub}] Attempting reconnection...`);

      // Close existing subscription if any
      if (this.sub) {
        this.sub.close();
        this.sub = undefined;
      }

      // Attempt to reconnect
      await this.subscribeToRelays();

      console.log(`[${this.remoteSignerInfo.npub}] Reconnection successful`);
      this.isConnected = true;
      this.isReconnecting = false;
      this.reconnectAttempts = 0; // Reset on successful connection
    } catch (error) {
      console.error(
        `[${this.remoteSignerInfo.npub}] Reconnection failed:`,
        error
      );
      this.isReconnecting = false;
      this.handleConnectionFailure();
    }
  }

  /**
   * Connect to relays and set up subscription
   */
  private async subscribeToRelays(): Promise<void> {
    const filter = {
      kinds: [24133],
      '#p': [this.remoteSignerInfo.pubKey],
      since: Math.floor(Date.now() / 1000),
    };

    const handler = (e: NostrEvent) => {
      this.handleIncomingEvent(e);
    };

    // Store reference to this for use in callbacks
    const self = this;

    this.sub = this.pool.subscribe(this.relayUrls, filter, {
      onevent(event) {
        handler(event);
      },
      oneose() {
        console.log(`[${self.remoteSignerInfo.npub}] Subscription ready`);
      },
      onclose(reasons) {
        console.log(
          `[${self.remoteSignerInfo.npub}] Subscription closed:`,
          reasons
        );
        // Trigger reconnection on close
        if (self.isConnected) {
          self.handleConnectionFailure();
        }
      },
    });
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
          scopeSlug: session.scopeSlug,
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

  private async getOrCreateKeyFromEmail(
    email: string,
    scope: string | null
  ): Promise<Keys | null> {
    const existingKey = await prisma.keys.findFirst({
      where: {
        email: email,
        scopeSlug: scope,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let keyToReturn: any = existingKey;
    if (!existingKey) {
      // Generate a new Nostr key pair for the new user
      const secretKey = generateSecretKey();
      const publicKey = getPublicKey(secretKey);
      const npub = nip19.npubEncode(publicKey);
      // Create the key in the database
      const newKey = await prisma.keys.create({
        data: {
          npub: npub,
          name: email,
          email: email,
          relays: [],
          enckey: '',
          profile: { name: email },
          ncryptsec: Buffer.from(secretKey).toString('hex'),
          scopeSlug: scope,
        },
      });
      keyToReturn = newKey;
    }
    return keyToReturn;
  }

  private async validateAndGetUserSession(
    params: Nip46RPCCallParams
  ): Promise<SessionInfo | null> {
    console.log(`Validating connection for ${params.pubkey}:`, params);
    const npub = nip19.npubEncode(params.pubkey);
    // Check if we have a valid token for this connection
    if (params.method === 'connect') {
      const remoteNpub = nip19.npubEncode(params.pubkey);
      const token = params.params[1];

      // First check if there is an existing session for the user npub (remoteSignerPubkey) / and local npub
      const pubkeySession = await prisma.sessions.findFirst({
        where: {
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
        console.log(`Token: ${token} is not created in the database`);

        const [secret, email] = token.split('+');

        if (secret.length === 6 && email) {
          // We'll assume the token was sent by email to the user, attempt to verify it
          if (
            !process.env.NEXT_PUBLIC_SUPABASE_URL ||
            !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ) {
            console.error('Missing Supabase environment variables');
            return null;
          }
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          );

          const { error: verifyError } = await supabase.auth.verifyOtp({
            token: secret,
            type: 'email',
            email: email,
          });
          if (verifyError) {
            console.log(`Token: ${token} is invalid`);
            return null;
          } else {
            console.log(`Token: ${token} is valid, creating session`);

            const key = await this.getOrCreateKeyFromEmail(
              email,
              this.bunkerScope
            );
            if (!key) {
              console.log(`Key: ${email} is not found in the database`);
              return null;
            }
            const newSession = await prisma.sessions.create({
              data: {
                npub: key.npub,
                sessionNpub: remoteNpub,
                scopeSlug: this.bunkerScope || null,
                expiresAt: BigInt(Date.now() + 1000 * 60 * 60 * 24 * 90), // 90 days
              },
            });
            return newSession;
          }
        }
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
    console.log(`[${this.remoteSignerInfo.npub}] Starting NIP-46 daemon...`);

    try {
      await this.subscribeToRelays();
      this.isConnected = true;

      console.log(
        `[${this.remoteSignerInfo.npub}] NIP-46 daemon started successfully`
      );
    } catch (error) {
      console.error(
        `[${this.remoteSignerInfo.npub}] Failed to start daemon:`,
        error
      );
      this.handleConnectionFailure();
    }
  }

  async stop(): Promise<void> {
    console.log(`[${this.remoteSignerInfo.npub}] Stopping NIP-46 daemon...`);

    // Clear reconnection timeout if active
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = undefined;
    }

    // Close subscription
    if (this.sub) {
      this.sub.close();
      this.sub = undefined;
    }

    // Reset connection state
    this.isConnected = false;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    console.log(`[${this.remoteSignerInfo.npub}] NIP-46 daemon stopped`);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
  } {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      reconnectAttempts: this.reconnectAttempts,
    };
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
        if (response === 'error') {
          // This is enough to support the authUrl flow
          const authUrl = `${process.env.NEXT_PUBLIC_OPENBUNKER_URL}/openbunker-login-popup?scope=${this.bunkerScope}`;
          // send error
          this.encryptedAdapter.sendResponse(
            id,
            remotePubkey,
            'auth_url',
            undefined,
            authUrl
          );
          return;
        }
        await this.encryptedAdapter.sendResponse(id, remotePubkey, response);
        return;
      }

      console.log('method', method, 'params', params);
      // Verify permissions and get session
      const session = await this.validateAndGetUserSession(nip46RPCCallParams);
      console.log('session', session);
      if (session == null) {
        // This is enough to support the authUrl flow
        const authUrl = `${process.env.NEXT_PUBLIC_OPENBUNKER_URL}/openbunker-login-popup?scope=${this.bunkerScope}`;
        // send error
        this.encryptedAdapter.sendResponse(
          id,
          remotePubkey,
          'error',
          undefined,
          authUrl
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
    if (!session) {
      return 'error';
    }
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
