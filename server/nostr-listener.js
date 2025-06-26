const { SimplePool } = require('nostr-tools/pool');

// Create Nostr pool
const pool = new SimplePool();

// Nostr relay URLs - using more reliable relays
const relays = [
  'wss://relay.damus.io',
];

console.log('Starting Nostr relay listener...');
console.log(`Connecting to relays: ${relays.join(', ')}`);

// Subscribe to events - listening to all kind 24450 events
const sub = pool.subscribe(
  relays,
  {
    kinds: [24450]
  },
  {
    onevent(event) {
      console.log('=== Received Nostr Event ===');
      console.log('ID:', event.id);
      console.log('Pubkey:', event.pubkey);
      console.log('Kind:', event.kind);
      console.log('Content:', event.content);
      console.log('Created:', new Date(event.created_at * 1000).toISOString());
      console.log('Tags:', event.tags);
      console.log('===========================');
    },
    oneose() {
      console.log('Subscription ended');
    }
  }
);

console.log('Listening for Nostr events (kind 24450)...');
console.log('Press Ctrl+C to stop');

// Keep the process alive and show it's still running
setInterval(() => {
  console.log('Still listening...', new Date().toISOString());
}, 30000); // Log every 30 seconds

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (sub) sub.close();
  if (pool) pool.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (sub) sub.close();
  if (pool) pool.close();
  process.exit(0);
}); 