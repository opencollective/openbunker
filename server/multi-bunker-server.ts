// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import NDK, {
  NDKNip46Backend,
  NDKPrivateKeySigner,
  Nip46PermitCallbackParams,
} from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';
import LoggingNDKNip46Backend from './nip-46-backend';

import { hexToBytes } from '@noble/hashes/utils'; // already an installed dependency
import { nip19 } from 'nostr-tools';

// Database connection
const prisma = new PrismaClient();

// Nostr relay URLs - using reliable relays
const relays = ['wss://relay.nsec.app'];

console.log('Starting Multi-Bunker Server...');
console.log(`Connecting to relays: ${relays.join(', ')}`);

interface BunkerInstance {
  npub: string;
  signer: NDKPrivateKeySigner;
  backend: NDKNip46Backend;
}
class MultiBunkerServer {
  private bunkerInstances: Map<string, BunkerInstance> = new Map();
  private isRunning = false;
  private ndk: NDK;

  constructor() {
    // Create a single NDK instance for the whole server
    this.ndk = new NDK({
      explicitRelayUrls: relays,
    });

    // Set up graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      this.shutdown();
    });
  }

  async start() {
    if (this.isRunning) {
      console.log('Server is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting Multi-Bunker Server...');

    try {
      // Connect the single NDK instance
      await this.ndk.connect();
      console.log('Connected to relays');

      // Scan database for keys and connection tokens
      await this.scanDatabase();

      // Start all bunker instances
      await this.startAllBunkers();

      // Set up periodic scanning for new keys/tokens
      this.setupPeriodicScanning();

      // Keep the process alive
      this.setupHeartbeat();
    } catch (error) {
      console.error('Error starting server:', error);
      this.shutdown();
    }
  }

  private async scanDatabase() {
    console.log('Scanning database for keys and connection tokens...');

    try {
      // Get all keys from the database
      const keys = await prisma.keys.findMany({
        include: {
          userKeys: {
            where: {
              isActive: true,
            },
          },
        },
      });

      console.log(`Found ${keys.length} keys in database`);

      // Get all non-expired connection tokens
      const now = BigInt(Date.now());
      const connectionTokens = await prisma.connectTokens.findMany({
        where: {
          expiry: {
            gt: now,
          },
        },
      });

      console.log(
        `Found ${connectionTokens.length} non-expired connection tokens`
      );

      // Group tokens by npub
      const tokensByNpub = new Map<string, typeof connectionTokens>();
      for (const token of connectionTokens) {
        if (!tokensByNpub.has(token.npub)) {
          tokensByNpub.set(token.npub, []);
        }
        tokensByNpub.get(token.npub)!.push(token);
      }

      // Store the data for bunker creation
      this.keys = keys;
      this.tokensByNpub = tokensByNpub;
    } catch (error) {
      console.error('Error scanning database:', error);
      throw error;
    }
  }

  private async startAllBunkers() {
    console.log('Starting bunker instances...');

    for (const key of this.keys) {
      try {
        await this.startBunkerForKey(key);
      } catch (error) {
        console.error(`Error starting bunker for key ${key.npub}:`, error);
      }
    }

    console.log(`Started ${this.bunkerInstances.size} bunker instances`);
  }

  private async startBunkerForKey(key: any) {
    console.log(`Starting bunker for key: ${key.npub}`);

    // Check if we have the private key
    const privateKey = key.ncryptsec;
    const privateKeyBytes = hexToBytes(privateKey);

    if (!privateKey) {
      console.log(`No private key found for ${key.npub} - skipping`);
      return;
    }

    // Create signer using the shared NDK instance
    const signer = new NDKPrivateKeySigner(privateKeyBytes);
    console.log(`Created signer for ${key.npub}: ${signer.pubkey}`);

    // Create NIP-46 backend with token validation using the shared NDK instance
    const backend = new LoggingNDKNip46Backend(
      this.ndk,
      signer,
      async (params: Nip46PermitCallbackParams) => {
        return await this.validateConnection(params, key.npub);
      },
      key.npub
    );

    // Start backend
    backend.start().then(() => {
      console.log(`Started backend for ${key.npub}`);
    });
    console.log(`Started backend for ${key.npub}`);

    // Store the bunker instance
    this.bunkerInstances.set(key.npub, {
      npub: key.npub,
      signer,
      backend,
    });

    // Log bunker URI for clients
    const bunkerUri = `bunker://${backend.localUser?.pubkey}?relay=${encodeURIComponent(relays[0])}`;
    console.log(`\nBunker URI for ${key.npub}:\n  ${bunkerUri}\n`);
  }

  private async validateConnection(
    params: Nip46PermitCallbackParams,
    npub: string
  ): Promise<boolean> {
    console.log(`Validating connection for ${npub}:`, params);

    // Check if we have a valid token for this connection
    if (params.method === 'connect') {
      const remoteNpub = nip19.npubEncode(params.pubkey);
      // the signer-side pubkey
      const signerPubkey = params.params[0];
      const signerNpub = nip19.npubEncode(signerPubkey);
      const token = params.params[1];

      // First check if there is an existing session for the user npub (remoteSignerPubkey) / and local npub
      const pubkeySession = await prisma.sessions.findFirst({
        where: {
          npub: signerNpub,
          sessionNpub: remoteNpub,
        },
      });
      if (pubkeySession) {
        console.log('Found existing session for ', remoteNpub, signerPubkey);
        return true;
      }

      // If there are no active sessions, we need a connection token
      const dbToken = await prisma.connectTokens.findFirst({
        where: {
          token: token,
          npub: signerNpub,
          expiry: {
            gt: BigInt(Date.now()),
          },
        },
      });
      if (dbToken) {
        console.log(`Token: ${token} is valid`);
        console.log(`DB Token: ${dbToken}`);
        // The token is used, so we delete it and create a session based on the token
        // delete token
        await prisma.connectTokens.delete({
          where: {
            token: token,
          },
        });
        // create session
        await prisma.sessions.create({
          data: {
            npub: signerNpub,
            sessionNpub: remoteNpub,
            expiresAt: BigInt(Date.now() + 1000 * 60 * 60), // 30 days
          },
        });
        return true;
      } else {
        console.log(`Token: ${token} is invalid`);
        return false;
      }
    } else {
      // Check if there is a session active
      const remoteNpub = nip19.npubEncode(params.pubkey);
      const session = await prisma.sessions.findFirst({
        where: {
          npub: npub,
          sessionNpub: remoteNpub,
        },
      });
      if (session) {
        console.log('Found existing session for ', npub, params.pubkey);
        return true;
      } else {
        console.log('No session found for ', npub, remoteNpub);
        return false;
      }
    }
  }

  private setupPeriodicScanning() {
    // Scan for new keys/tokens every 5 seconds
    setInterval(async () => {
      console.log('Periodic database scan...');
      try {
        await this.scanDatabase();
        await this.updateBunkerInstances();
      } catch (error) {
        console.error('Error in periodic scan:', error);
      }
    }, 5 * 1000);
  }

  private async updateBunkerInstances() {
    // Check for new keys that need bunkers
    for (const key of this.keys) {
      const tokens = this.tokensByNpub.get(key.npub) || [];
      const hasBunker = this.bunkerInstances.has(key.npub);

      if (!hasBunker) {
        console.log(`Starting new bunker for ${key.npub}`);
        try {
          await this.startBunkerForKey(key);
        } catch (error) {
          console.error(`Error starting new bunker for ${key.npub}:`, error);
        }
      }
    }

    // Note: We no longer stop bunkers when they have no tokens
    // All bunkers run regardless of token status
  }

  private setupHeartbeat() {
    // Log status every 30 seconds
    setInterval(() => {
      const activeBunkers = this.bunkerInstances.size;
      console.log(
        `Multi-Bunker Server Status: ${activeBunkers} active bunkers - ${new Date().toISOString()}`
      );
    }, 30000);
  }

  async shutdown() {
    console.log('Shutting down Multi-Bunker Server...');
    this.isRunning = false;

    // Stop all bunker instances
    for (const [npub, instance] of this.bunkerInstances) {
      try {
        // Note: NDKNip46Backend doesn't have a stop method in the current version
        console.log(`Stopped bunker for ${npub}`);
      } catch (error) {
        console.error(`Error stopping bunker for ${npub}:`, error);
      }
    }

    // Clear bunker instances
    this.bunkerInstances.clear();

    // Close database connection
    await prisma.$disconnect();
    console.log('Database connection closed');

    console.log('Multi-Bunker Server shutdown complete');
    process.exit(0);
  }

  // Store database scan results
  private keys: any[] = [];
  private tokensByNpub: Map<string, any[]> = new Map();
}

// Start the server
async function main() {
  const server = new MultiBunkerServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();
