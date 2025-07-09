// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import NDK, {
  NDKNip46Backend,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKUser,
  NDKEvent,
} from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';

import { bytesToHex, hexToBytes } from '@noble/hashes/utils' // already an installed dependency

// Extended NDKNip46Backend with logging
class LoggingNDKNip46Backend extends NDKNip46Backend {
  private npub: string;

  constructor(
    ndk: NDK,
    signer: NDKPrivateKeySigner,
    allowCallback: (params: any) => Promise<boolean>,
    npub: string
  ) {
    super(ndk, signer, allowCallback);
    this.npub = npub;
  }

  protected async handleIncomingEvent(event: NDKEvent): Promise<void> {
    const timestamp = new Date().toISOString();
    const remotePubkey = event.pubkey;
    
    console.log(`[${timestamp}] [${this.npub}] 📥 Incoming NIP-46 request from ${remotePubkey}`);
    console.log(`[${timestamp}] [${this.npub}] 📋 Event details:`, {
      id: event.id,
      kind: event.kind,
      created_at: event.created_at ? new Date(event.created_at * 1000).toISOString() : 'unknown',
      content_length: event.content.length,
      tags_count: event.tags.length
    });

    try {
      // Parse the event to get method and params
      const { id, method, params } = (await this.rpc.parseEvent(event)) as any;
      
      console.log(`[${timestamp}] [${this.npub}] 🔍 Parsed request:`, {
        id,
        method,
        params_count: params ? params.length : 0,
        params_preview: params ? JSON.stringify(params).substring(0, 200) + (JSON.stringify(params).length > 200 ? '...' : '') : 'none'
      });

      // Call the parent method
      await super.handleIncomingEvent(event);
      
      console.log(`[${timestamp}] [${this.npub}] ✅ Request processed successfully`);
      
    } catch (error) {
      console.error(`[${timestamp}] [${this.npub}] ❌ Error processing request:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        remote_pubkey: remotePubkey
      });
      
      // Re-throw to maintain original behavior
      throw error;
    }
  }

  public async applyToken(_pubkey: string, _token: string): Promise<void> {
      console.log('applyToken', _pubkey, _token);
      return;
  }
}

// Database connection
const prisma = new PrismaClient();

// Nostr relay URLs - using reliable relays
const relays = [
  'wss://relay.nsec.app',
];

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
    //   netDebug: (msg: string, relay: NDKRelay, direction?: "send" | "recv") => {
    //     const hostname = new URL(relay.url).hostname;
    //     console.log(`${hostname} ${msg} ${direction}`);
    //   }
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
              isActive: true
            }
          }
        }
      });

      console.log(`Found ${keys.length} keys in database`);

      // Get all non-expired connection tokens
      const now = BigInt(Date.now());
      const connectionTokens = await prisma.connectTokens.findMany({
        where: {
          expiry: {
            gt: now
          }
        }
      });

      console.log(`Found ${connectionTokens.length} non-expired connection tokens`);

      // Group tokens by npub
      const tokensByNpub = new Map<string, typeof connectionTokens>();
      for (const token of connectionTokens) {
        if (!tokensByNpub.has(token.npub)) {
          tokensByNpub.set(token.npub, []);
        }
        tokensByNpub.get(token.npub)!.push(token);
      }

      // Process each key
      for (const key of keys) {
        const hasValidTokens = tokensByNpub.has(key.npub) && tokensByNpub.get(key.npub)!.length > 0;
        
        if (hasValidTokens) {
          console.log(`Key ${key.npub} has valid connection tokens - will start bunker`);
        } else {
          console.log(`Key ${key.npub} has no valid connection tokens - skipping`);
        }
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
      const tokens = this.tokensByNpub.get(key.npub);
      console.log('tokens', tokens);
      if (!tokens || tokens.length === 0) {
        console.log(`Skipping key ${key.npub} - no valid tokens`);
        continue;
      }

      try {
        await this.startBunkerForKey(key, tokens);
      } catch (error) {
        console.error(`Error starting bunker for key ${key.npub}:`, error);
      }
    }

    console.log(`Started ${this.bunkerInstances.size} bunker instances`);
  }

  private async startBunkerForKey(key: any, tokens: any[]) {
    console.log(`Starting bunker for key: ${key.npub}`);

    // Check if we have the private key (ncryptsec or localKey)
    const privateKey = key.ncryptsec || key.localKey;
    
    console.log('privateKey', key);
    const privateKeyBytes = hexToBytes(privateKey);

    if (!privateKey) {
      console.log(`No private key found for ${key.npub} - skipping`);
      return;
    }
    console.log('privateKey');

    // Create signer using the shared NDK instance
    const signer = new NDKPrivateKeySigner(privateKeyBytes);
    console.log(`Created signer for ${key.npub}: ${signer.pubkey}`);
    
    // Create NIP-46 backend with token validation using the shared NDK instance
    const backend = new LoggingNDKNip46Backend(
      this.ndk,
      signer,
      async (params) => {
        console.log('params', params);
        return true;
        // return await this.validateConnection(params, key.npub, tokens);
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
      backend
    });

    // Log bunker URI for clients
    const bunkerUri = `bunker://${backend.localUser?.pubkey}?relay=${encodeURIComponent(relays[0])}`;
    console.log(`\nBunker URI for ${key.npub}:\n  ${bunkerUri}\n`);
  }

  private async validateConnection(params: any, npub: string, tokens: any[]): Promise<boolean> {
    console.log(`Validating connection for ${npub}:`, params);

    // Check if we have a valid token for this connection
    const now = BigInt(Date.now());
    const validTokens = tokens.filter(token => 
      BigInt(token.expiry) > now
    );

    if (validTokens.length === 0) {
      console.log(`No valid tokens found for ${npub} - rejecting connection`);
      return false;
    }

    // For now, accept any connection with valid tokens
    // You can add more sophisticated validation here
    console.log(`Valid tokens found for ${npub} - accepting connection`);
    return true;
  }

  private setupPeriodicScanning() {
    // Scan for new keys/tokens every 5 minutes
    setInterval(async () => {
      console.log('Periodic database scan...');
      try {
        await this.scanDatabase();
        await this.updateBunkerInstances();
      } catch (error) {
        console.error('Error in periodic scan:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async updateBunkerInstances() {
    // Check for new keys that need bunkers
    for (const key of this.keys) {
      const tokens = this.tokensByNpub.get(key.npub);
      const hasBunker = this.bunkerInstances.has(key.npub);
      
      if (tokens && tokens.length > 0 && !hasBunker) {
        console.log(`Starting new bunker for ${key.npub}`);
        try {
          await this.startBunkerForKey(key, tokens);
        } catch (error) {
          console.error(`Error starting new bunker for ${key.npub}:`, error);
        }
      }
    }

    // Check for bunkers that should be stopped (no valid tokens)
    for (const [npub, instance] of this.bunkerInstances) {
      const tokens = this.tokensByNpub.get(npub);
      if (!tokens || tokens.length === 0) {
        console.log(`Stopping bunker for ${npub} - no valid tokens`);
        await this.stopBunker(npub);
      }
    }
  }

  private async stopBunker(npub: string) {
    const instance = this.bunkerInstances.get(npub);
    if (instance) {
      try {
        // Note: NDKNip46Backend doesn't have a stop method in the current version
        // The backend will be cleaned up when the process exits
        this.bunkerInstances.delete(npub);
        console.log(`Stopped bunker for ${npub}`);
      } catch (error) {
        console.error(`Error stopping bunker for ${npub}:`, error);
      }
    }
  }

  private setupHeartbeat() {
    // Log status every 30 seconds
    setInterval(() => {
      const activeBunkers = this.bunkerInstances.size;
      console.log(`Multi-Bunker Server Status: ${activeBunkers} active bunkers - ${new Date().toISOString()}`);
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