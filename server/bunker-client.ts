// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import NDK, { NDKNip46Signer, NDKRelay } from '@nostr-dev-kit/ndk';
import * as readline from 'readline';
import { randomBytes } from 'crypto';


function generatePrivateKey() {
    return randomBytes(32).toString('hex');
  }

const relays = [
    'wss://relay.damus.io',
];
// Function to prompt user for bunker connection string
async function promptForBunkerConnection(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter your bunker connection string (bunker://...): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}


async function main() {
  try {
    console.log('Starting Bunker Client...\n');

    // Get bunker connection string from user
    const signerConnectionString = await promptForBunkerConnection();
    
    if (!signerConnectionString.startsWith('bunker://')) {
      throw new Error('Invalid bunker connection string. Must start with "bunker://"');
    }

    // Always generate a new local nsec
    console.log('Generating new local nsec for this session');

    // Create NDK instance
    const ndk = new NDK({
      explicitRelayUrls: relays,
      netDebug: (msg: string, relay: NDKRelay, direction?: "send" | "recv") => {
        const hostname = new URL(relay.url).hostname;
        console.log(hostname, msg, direction);
      },
    });
    // Generate a new local nsec for this session
    const localNsec = generatePrivateKey();
    console.log('Generated local nsec:', localNsec);

    // Create NIP-46 signer (always generate new local nsec)
    const signer = NDKNip46Signer.bunker(ndk, signerConnectionString, localNsec);
    
    console.log('Connecting to bunker...');
    
    // Wait for the signer to be ready
    signer.on('ready', () => {
      console.log('Signer ready');
    });
    signer.on('error', (error) => {
      console.error('Signer error:', error);
    });
    const user = await signer.blockUntilReady();
    
    console.log('\n🎉 Successfully connected to bunker!');
    console.log('Welcome', user.npub);
    console.log('User profile:', user.profile);

    // Keep the connection alive
    console.log('\nConnection established. Press Ctrl+C to exit.');
    
    // Set up graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down gracefully...');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error connecting to bunker:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 