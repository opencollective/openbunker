const { WebSocketServer } = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients
const clients = new Set();

// Nostr relay connections
const nostrRelays = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine'
];

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('New client connected');
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to OpenBunker WebSocket server',
    timestamp: new Date().toISOString(),
    nostrRelays: nostrRelays
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);

      // Only handle Nostr subscription requests
      if (message.type === 'subscribe_nostr') {
        handleNostrSubscription(ws, message.filter);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Handle Nostr subscription - only listen and console log
function handleNostrSubscription(ws, filter) {
  console.log('Subscribing to Nostr events with filter:', filter);
  
  // Acknowledge subscription
  ws.send(JSON.stringify({
    type: 'nostr_subscription',
    message: 'Subscribed to Nostr events',
    filter: filter,
    timestamp: new Date().toISOString()
  }));

  // In a real implementation, you would use nostr-tools to subscribe to relays
  // and listen for events. For now, we'll just console log that we're listening
  console.log(`Listening for Nostr events with filter:`, filter);
  console.log(`Connected to relays: ${nostrRelays.join(', ')}`);
  
  // When a real Nostr event is received, it would be logged here:
  // console.log('Received Nostr event:', event);
}

// Broadcast message to all connected clients (kept for potential future use)
function broadcastMessage(message) {
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(message));
    }
  });
}

// Start server
const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`OpenBunker WebSocket server running on port ${PORT}`);
  console.log(`Ready to listen to Nostr relays: ${nostrRelays.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  wss.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}); 