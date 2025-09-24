// WebSocket polyfill for Node.js
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;

import { Keys, PrismaClient } from '@prisma/client';
import { nip19, SimplePool, type Event, type Filter } from 'nostr-tools';
import { CreateEmailOptions, Resend } from 'resend';
import { getCommunityATagFromEnv } from '../src/utils/communityUtils';

// Database connection
const prisma = new PrismaClient();

// Email service
const resend = new Resend(process.env.RESEND_API_KEY);

// Nostr relay URLs
const relays = ['wss://relay.damus.io', 'wss://chorus.community'];

// Email configuration
const NOTIFICATION_EMAILS = process.env.NOTIFICATION_EMAILS?.split(',') || [];
const NOSTR_COMMUNITY_IDENTIFIER = process.env.NOSTR_COMMUNITY_IDENTIFIER || '';

console.log('Starting Email Notification Server...');
console.log(`Connecting to relays: ${relays.join(', ')}`);
console.log(`Community identifier: ${NOSTR_COMMUNITY_IDENTIFIER}`);
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
      since: Math.floor(Date.now() / 1000),
    };

    console.log('New request filter:', newRequestFilter);
    // Filter 2: Kind 1111 with A tag referencing community and p tag (replies)
    const replyFilter: Filter = {
      kinds: [1111],
      '#A': [getCommunityATagFromEnv()], // Community tag
      // '#p': [], // Any p tag
      since: Math.floor(Date.now() / 1000),
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
        if (keyExists && keyExists.email) {
          console.log(
            `Key ${pubkey} found in database, sending reply notification`
          );
          await this.sendReplyNotification(event, keyExists.email);
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

  private async checkKeyExists(pubkey: string): Promise<Keys | null> {
    try {
      const npub = nip19.npubEncode(pubkey);
      const key = await prisma.keys.findUnique({
        where: {
          npub: npub,
        },
      });
      return key;
    } catch (error) {
      console.error('Error checking key existence:', error);
      return null;
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
        subject: `📝 New Community Request - ${NOSTR_COMMUNITY_IDENTIFIER}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #d97706; margin: 0; font-size: 28px;">📝 New Request!</h1>
              <p style="color: #92400e; font-size: 18px; margin: 10px 0 0 0;">A new community request has been submitted in community ${NOSTR_COMMUNITY_IDENTIFIER}!</p>
            </div>
            
            <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h2 style="color: #d97706; margin-top: 0; font-size: 22px;">💬 Request Details</h2>
              <div style="background: #ffedd5; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0;">
                <div style="white-space: pre-wrap; font-size: 16px; line-height: 1.5; color: #374151;">${eventContent}</div>
              </div>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://requests.opencollective.xyz/requests/${eventId}" style="background: linear-gradient(135deg, #f97316 0%, #d97706 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  👀 View Full Request
                </a>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 2px 0;"><strong>Community:</strong> ${NOSTR_COMMUNITY_IDENTIFIER}</p>
              <p style="margin: 2px 0;"><strong>Event ID:</strong> ${eventId}</p>
              <p style="margin: 2px 0;"><strong>Author:</strong> ${pubkey}</p>
              <p style="margin: 2px 0;"><strong>Created:</strong> ${createdAt.toISOString()}</p>
            </div>
          </div>
        `,
      };

      const result = await resend.emails.send(emailOptions);
      console.log('New request notification sent:', result);
    } catch (error) {
      console.error('Error sending new request notification:', error);
    }
  }

  private async sendReplyNotification(event: Event, targetEmail: string) {
    try {
      const eventContent = event.content || 'No content';
      const eventId = event.id;
      const authorPubkey = event.pubkey;
      const createdAt = new Date(event.created_at * 1000);

      // Extract the request ID from the 'e' tags (first e tag with 'root' marker)
      const eTags = event.tags.filter(tag => tag[0] === 'e');
      const rootRequestId =
        eTags.find(tag => tag[3] === 'root')?.[1] || eTags[0]?.[1];

      // Build the URL to the original request
      const requestUrl = rootRequestId
        ? `https://requests.opencollective.xyz/requests/${rootRequestId}`
        : 'https://requests.opencollective.xyz/';

      const emailOptions: CreateEmailOptions = {
        from: 'onboarding@resend.dev',
        to: [targetEmail],
        subject: `🎉 New Reply to Your Community Request - ${NOSTR_COMMUNITY_IDENTIFIER}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #d97706; margin: 0; font-size: 28px;">🎉 Great News!</h1>
              <p style="color: #92400e; font-size: 18px; margin: 10px 0 0 0;">Someone replied to your community request!</p>
            </div>
            
            <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px;">
              <h2 style="color: #d97706; margin-top: 0; font-size: 22px;">💬 New Reply</h2>
              <div style="background: #ffedd5; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; margin: 15px 0;">
                <div style="white-space: pre-wrap; font-size: 16px; line-height: 1.5; color: #374151;">${eventContent}</div>
              </div>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="${requestUrl}" style="background: linear-gradient(135deg, #f97316 0%, #d97706 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  👀 View Full Conversation
                </a>
              </div>
            </div>
            
            <div style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 2px 0;"><strong>Community:</strong> ${NOSTR_COMMUNITY_IDENTIFIER}</p>
              <p style="margin: 2px 0;"><strong>Event ID:</strong> ${eventId}</p>
              <p style="margin: 2px 0;"><strong>Replied by:</strong> ${authorPubkey}</p>
              <p style="margin: 2px 0;"><strong>Created:</strong> ${createdAt.toISOString()}</p>
            </div>
          </div>
        `,
      };

      const result = await resend.emails.send(emailOptions);
      console.log(`Reply notification sent to ${targetEmail}:`, result);
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
