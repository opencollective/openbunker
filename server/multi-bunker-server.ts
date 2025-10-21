// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { PrismaClient } from '@prisma/client';
import Nip46ScopedDaemon from './nip-46-backend';

import { hexToBytes } from '@noble/hashes/utils';
import { getPublicKey, nip19 } from 'nostr-tools';

// Database connection
const prisma = new PrismaClient();

// Nostr relay URLs - using reliable relays
const relays = ['wss://relay.nsec.app'];

console.log('Starting Multi-Bunker Server...');
console.log(`Connecting to relays: ${relays.join(', ')}`);

class MultiBunkerServer {
  private bunkerInstances: Map<string, Nip46ScopedDaemon> = new Map();
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
    console.log('Scanning database for scopes and connection tokens...');

    try {
      // First, clean up expired tokens
      await this.cleanupExpiredTokens();

      // Get all scopes with their associated keys
      const scopes = await prisma.scopes.findMany({
        include: {
          key: true,
        },
      });

      console.log(`Found ${scopes.length} scopes in database`);

      // Store the data for bunker creation
      this.scopes = scopes;
    } catch (error) {
      console.error('Error scanning database:', error);
      throw error;
    }
  }

  private async cleanupExpiredTokens() {
    try {
      const currentTimestamp = BigInt(Date.now());

      // Delete expired connection tokens
      const deletedTokens = await prisma.connectTokens.deleteMany({
        where: {
          expiry: {
            lt: currentTimestamp,
          },
        },
      });

      if (deletedTokens.count > 0) {
        console.log(
          `Cleaned up ${deletedTokens.count} expired connection tokens`
        );
      }
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }

  private async startAllBunkers() {
    console.log('Starting bunker instances...');

    // Start the main bunker using environment variables
    try {
      await this.startMainBunker();
    } catch (error) {
      console.error('Error starting main bunker:', error);
    }

    // Start bunkers for each scope
    for (const scope of this.scopes) {
      try {
        await this.startBunkerForScope(scope);
      } catch (error) {
        console.error(`Error starting bunker for scope ${scope.slug}:`, error);
      }
    }

    console.log(`Started ${this.bunkerInstances.size} bunker instances`);
  }

  private async startMainBunker() {
    console.log('Starting main bunker...');

    const bunkerNsec = process.env.BUNKER_NSEC;
    const bunkerNpub = process.env.BUNKER_NPUB;

    if (!bunkerNsec || !bunkerNpub) {
      console.log('BUNKER_NSEC or BUNKER_NPUB not set - skipping main bunker');
      return;
    }

    try {
      // Decode the nsec to get the private key bytes
      const decoded = nip19.decode(bunkerNsec);
      const privateKeyBytes = decoded.data as unknown as Uint8Array;
      const pubkeyHex = nip19.decode(bunkerNpub);

      // Create signer using the shared NDK instance
      const signer = new NDKPrivateKeySigner(privateKeyBytes);
      console.log(`Created main bunker signer: ${signer.pubkey}`);

      // Create NIP-46 backend with token validation using the shared NDK instance
      const backend = new Nip46ScopedDaemon(
        {
          pubKey: pubkeyHex.data as string,
          privateKey: privateKeyBytes,
          npub: bunkerNpub,
          nsec: bunkerNsec,
        },
        '',
        relays
      );

      // Start backend
      backend.start().then(() => {
        console.log('Started main bunker backend');
      });

      // Store the bunker instance
      this.bunkerInstances.set(bunkerNpub, backend);

      // Log bunker URI for clients
      const bunkerUri = `bunker://${pubkeyHex.data}?relay=${encodeURIComponent(relays[0])}`;
      console.log(`\nMain Bunker URI:\n  ${bunkerUri}\n`);
    } catch (error) {
      console.error('Error starting main bunker:', error);
      throw error;
    }
  }

  private async startBunkerForScope(scope: any) {
    console.log(`Starting bunker for scope: ${scope.slug}`);

    // Check if we have the private key for this scope
    const privateKey = scope.key.ncryptsec;

    if (!privateKey) {
      console.log(`No private key found for scope ${scope.slug} - skipping`);
      return;
    }

    try {
      // Convert hex string to bytes
      const privateKeyBytes = hexToBytes(privateKey);
      const pubKey = getPublicKey(privateKeyBytes);
      const nsec = nip19.nsecEncode(privateKeyBytes);
      const npub = nip19.npubEncode(pubKey);
      // Create signer using the shared NDK instance
      const signer = new NDKPrivateKeySigner(privateKeyBytes);
      console.log(
        `Created scope bunker signer for ${scope.slug}: ${signer.pubkey}`
      );

      // Create NIP-46 backend with token validation using the shared NDK instance
      const backend = new Nip46ScopedDaemon(
        {
          pubKey: pubKey,
          privateKey: privateKeyBytes,
          npub,
          nsec,
        },
        scope.slug,
        relays
      );

      // Start backend
      backend.start().then(() => {
        console.log(`Started scope bunker backend for ${scope.slug}`);
      });

      // Store the bunker instance
      this.bunkerInstances.set(scope.key.npub, backend);

      // Log bunker URI for clients
      const bunkerUri = `bunker://${pubKey}?relay=${encodeURIComponent(relays[0])}`;
      console.log(`\nScope Bunker URI for ${scope.slug}:\n  ${bunkerUri}\n`);
    } catch (error) {
      console.error(`Error starting scope bunker for ${scope.slug}:`, error);
      throw error;
    }
  }

  private setupPeriodicScanning() {
    // Scan for new scopes/tokens every 5 minutes
    setInterval(
      async () => {
        console.log('Periodic database scan...');
        try {
          await this.scanDatabase();
          await this.updateBunkerInstances();
        } catch (error) {
          console.error('Error in periodic scan:', error);
        }
      },
      5 * 60 * 1000
    );

    // Set up daily refresh at 1am UTC
    this.setupDailyRefresh();
  }

  private setupDailyRefresh() {
    const scheduleNextRefresh = () => {
      const now = new Date();
      const next1am = new Date();

      // Set to 1am UTC
      next1am.setUTCHours(1, 0, 0, 0);

      // If we've passed 1am today, schedule for tomorrow
      if (now >= next1am) {
        next1am.setUTCDate(next1am.getUTCDate() + 1);
      }

      const msUntilRefresh = next1am.getTime() - now.getTime();

      console.log(
        `Daily bunker refresh scheduled for ${next1am.toISOString()} (in ${Math.round(msUntilRefresh / 1000 / 60)} minutes)`
      );

      setTimeout(async () => {
        await this.refreshAllBunkers();
        // Schedule the next refresh
        scheduleNextRefresh();
      }, msUntilRefresh);
    };

    scheduleNextRefresh();
  }

  private async refreshAllBunkers() {
    console.log('Starting daily bunker refresh at 1am UTC...');

    try {
      // Stop all existing bunker instances
      for (const [npub, instance] of this.bunkerInstances) {
        try {
          console.log(`Stopping bunker for ${npub}`);
          await instance.stop();
        } catch (error) {
          console.error(`Error stopping bunker for ${npub}:`, error);
        }
      }

      // Clear all instances
      this.bunkerInstances.clear();
      console.log('All bunker instances stopped');

      // Rescan database
      await this.scanDatabase();

      // Restart all bunkers
      await this.startAllBunkers();

      console.log(
        `Daily bunker refresh complete. ${this.bunkerInstances.size} bunkers restarted`
      );
    } catch (error) {
      console.error('Error during daily bunker refresh:', error);
    }
  }

  private async updateBunkerInstances() {
    // Check for new scopes that need bunkers
    for (const scope of this.scopes) {
      const hasBunker = this.bunkerInstances.has(scope.key.npub);

      if (!hasBunker) {
        console.log(`Starting new bunker for scope ${scope.slug}`);
        try {
          await this.startBunkerForScope(scope);
        } catch (error) {
          console.error(
            `Error starting new bunker for scope ${scope.slug}:`,
            error
          );
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
        await instance.stop();
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
  private scopes: any[] = [];
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
