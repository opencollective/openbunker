// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import { PrismaClient } from '@prisma/client';
import { SimplePool, type Event, type Filter } from 'nostr-tools';
import { CreateEmailOptions, Resend } from 'resend';
import { getCommunityATagFromEnv } from '../src/utils/communityUtils';

// Database connection
const prisma = new PrismaClient();

// Email service
const resend = new Resend(process.env.RESEND_API_KEY);

// Nostr relay URLs
const relays = ['wss://relay.damus.io'];

// Email configuration
const NOTIFICATION_EMAILS = process.env.NOTIFICATION_EMAILS?.split(',') || [];
const COMMUNITY_IDENTIFIER = process.env.COMMUNITY_IDENTIFIER || '';

console.log('Starting Email Notification Server...');
console.log(`Connecting to relays: ${relays.join(', ')}`);
console.log(`Community identifier: ${COMMUNITY_IDENTIFIER}`);
console.log(`Notification emails: ${NOTIFICATION_EMAILS.join(', ')}`);

class EmailNotificationServer {
  private pool: SimplePool;
  private isRunning = false;
  private subscriptions: any[] = [];

  constructor() {
    // Create SimplePool instance
    this.pool = new SimplePool();

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
    console.log('Starting Email Notification Server...');

    try {
      // Set up event filters (no explicit connection needed with SimplePool)
      await this.setupEventFilters();

      // Keep the process alive
      this.setupHeartbeat();
    } catch (error) {
      console.error('Error starting server:', error);
      this.shutdown();
    }
  }

  private async setupEventFilters() {
    console.log('Setting up event filters...');

    // Filter 1: Kind 1111 with community tag (new requests)
    const newRequestFilter: Filter = {
      kinds: [1111],
      '#a': [getCommunityATagFromEnv()], // Community tag
      since: Math.floor(Date.now() / 1000) - 10 * 60,
    };

    // Filter 2: Kind 1111 with A tag referencing community and p tag (replies)
    const replyFilter: Filter = {
      kinds: [1111],
      '#A': [getCommunityATagFromEnv()], // Community tag
      '#p': [], // Any p tag
      since: Math.floor(Date.now() / 1000) - 10 * 60,
    };

    // Subscribe to new request events
    const newRequestSub = this.pool.subscribe(relays, newRequestFilter, {
      onevent: (event: Event) => this.handleNewRequestEvent(event),
      oneose: () => console.log('New request subscription ready'),
    });
    this.subscriptions.push(newRequestSub);

    // Subscribe to reply events
    const replySub = this.pool.subscribe(relays, replyFilter, {
      onevent: (event: Event) => this.handleReplyEvent(event),
      oneose: () => console.log('Reply subscription ready'),
    });
    this.subscriptions.push(replySub);

    console.log('Event filters set up successfully');
  }

  private async handleNewRequestEvent(event: Event) {
    console.log('New request event received:', event.id);

    try {
      // Check if this is actually a new request (not a reply)
      const aTags = event.tags.filter(tag => tag[0] === 'a');
      const pTags = event.tags.filter(tag => tag[0] === 'p');

      // If it has p tags, it's likely a reply, skip
      if (pTags.length > 0) {
        console.log(
          'Event has p tags, treating as reply, skipping new request notification'
        );
        return;
      }

      // Send email notification for new request
      await this.sendNewRequestNotification(event);
    } catch (error) {
      console.error('Error handling new request event:', error);
    }
  }

  private async handleReplyEvent(event: Event) {
    console.log('Reply event received:', event.id);

    try {
      const pTags = event.tags.filter(tag => tag[0] === 'p');

      if (pTags.length === 0) {
        console.log('No p tags found, skipping reply notification');
        return;
      }

      // Check each p tag to see if the pubkey exists in our database
      for (const pTag of pTags) {
        const pubkey = pTag[1];
        if (!pubkey) continue;

        const keyExists = await this.checkKeyExists(pubkey);
        if (keyExists) {
          console.log(
            `Key ${pubkey} found in database, sending reply notification`
          );
          await this.sendReplyNotification(event, pubkey);
        } else {
          console.log(
            `Key ${pubkey} not found in database, skipping notification`
          );
        }
      }
    } catch (error) {
      console.error('Error handling reply event:', error);
    }
  }

  private async checkKeyExists(pubkey: string): Promise<boolean> {
    try {
      const key = await prisma.keys.findUnique({
        where: {
          npub: pubkey,
        },
      });
      return !!key;
    } catch (error) {
      console.error('Error checking key existence:', error);
      return false;
    }
  }

  private async sendNewRequestNotification(event: Event) {
    if (NOTIFICATION_EMAILS.length === 0) {
      console.log(
        'No notification emails configured, skipping new request notification'
      );
      return;
    }

    try {
      const eventContent = event.content || 'No content';
      const eventId = event.id;
      const pubkey = event.pubkey;
      const createdAt = new Date(event.created_at * 1000);

      const emailOptions: CreateEmailOptions = {
        from: 'onboarding@resend.dev',
        to: NOTIFICATION_EMAILS,
        subject: `New Community Request - ${COMMUNITY_IDENTIFIER}`,
        html: `
          <p><strong>View Request:</strong> <a href="https://requests.opencollective.xyz/requests/${eventId}">https://requests.opencollective.xyz/request/${eventId}</a></p>
          <h2>New Community Request</h2>
          <p><strong>Community:</strong> ${COMMUNITY_IDENTIFIER}</p>
          <p><strong>Event ID:</strong> ${eventId}</p>
          <p><strong>Author:</strong> ${pubkey}</p>
          <p><strong>Created:</strong> ${createdAt.toISOString()}</p>
          <hr>
          <h3>Request Content:</h3>
          <div style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${eventContent}
          </div>
        `,
      };

      const result = await resend.emails.send(emailOptions);
      console.log('New request notification sent:', result);
    } catch (error) {
      console.error('Error sending new request notification:', error);
    }
  }

  private async sendReplyNotification(event: Event, targetPubkey: string) {
    try {
      // Get the key information from database
      const key = await prisma.keys.findUnique({
        where: {
          npub: targetPubkey,
        },
      });

      if (!key || !key.email) {
        console.log(
          `No email found for key ${targetPubkey}, skipping reply notification`
        );
        return;
      }

      const eventContent = event.content || 'No content';
      const eventId = event.id;
      const authorPubkey = event.pubkey;
      const createdAt = new Date(event.created_at * 1000);

      const emailOptions: CreateEmailOptions = {
        from: 'onboarding@resend.dev',
        to: [key.email],
        subject: `New Reply to Your Community Request - ${COMMUNITY_IDENTIFIER}`,
        html: `
          <h2>New Reply to Your Community Request</h2>
          <p><strong>Community:</strong> ${COMMUNITY_IDENTIFIER}</p>
          <p><strong>Event ID:</strong> ${eventId}</p>
          <p><strong>Replied by:</strong> ${authorPubkey}</p>
          <p><strong>Created:</strong> ${createdAt.toISOString()}</p>
          <hr>
          <h3>Reply Content:</h3>
          <div style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px;">
            ${eventContent}
          </div>
        `,
      };

      const result = await resend.emails.send(emailOptions);
      console.log(`Reply notification sent to ${key.email}:`, result);
    } catch (error) {
      console.error('Error sending reply notification:', error);
    }
  }

  private setupHeartbeat() {
    // Log status every 30 seconds
    setInterval(() => {
      console.log(
        `Email Notification Server Status: ${this.subscriptions.length} active subscriptions - ${new Date().toISOString()}`
      );
    }, 30000);
  }

  async shutdown() {
    console.log('Shutting down Email Notification Server...');
    this.isRunning = false;

    // Close all subscriptions
    for (const sub of this.subscriptions) {
      try {
        sub.close();
      } catch (error) {
        console.error('Error closing subscription:', error);
      }
    }
    this.subscriptions = [];

    // Close SimplePool
    this.pool.close(relays);

    // Close database connection
    await prisma.$disconnect();
    console.log('Database connection closed');

    console.log('Email Notification Server shutdown complete');
    process.exit(0);
  }
}

// Start the server
async function main() {
  const server = new EmailNotificationServer();

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main();
