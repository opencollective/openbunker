// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import NDK, {
  NDKNip46Backend,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKUser,
  relaysFromBech32,
} from '@nostr-dev-kit/ndk'

// Nostr relay URLs - using more reliable relays
const relays = [
  'wss://relay.nsec.app',
];

console.log('Starting Nostr relay listener...');
console.log(`Connecting to relays: ${relays.join(', ')}`);

// Create signer first
// npub1dzn2s0szxmdlnu8kzfrj6dx4natse4m08ud4n57d6lhe09882jmsrpxkhh
// const signer = new NDKPrivateKeySigner(process.env.BUNKER_NSEC || '');
const signer = new NDKPrivateKeySigner('nsec18u546xckjnj7kapgrvwk7ju4jy84vfpv5lusvcawg3t7h5ctvldqtcutet');
console.log('signer', signer.pubkey);
// Create NDK instance with correct parameters
const ndk = new NDK({
  explicitRelayUrls: relays,
  signer,
  netDebug: (msg: string, relay: NDKRelay, direction?: "send" | "recv") => {
    const hostname = new URL(relay.url).hostname;
    console.log(hostname, msg, direction);
  }
});

// Create NIP-46 backend with correct parameters
const backend = new NDKNip46Backend(
  ndk,
  signer,
  
  async (params) => {
    console.log('Permission request:', params);
    // Always allow for this example
    return true;
  },
  relays,
);

backend.start().then(() => {
  console.log('Backend started');
  console.log('backend.localUser', backend.localUser?.pubkey);
}).catch((error: any) => {
  console.error('Error starting backend:', error);
});



// Keep the process alive and show it's still running
setInterval(() => {
  console.log('Still listening...', new Date().toISOString());
}, 30000); // Log every 30 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 