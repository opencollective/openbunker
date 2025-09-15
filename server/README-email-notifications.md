# Email Notification Server

This server listens for Nostr events and sends email notifications based on configured filters.

## Features

- **New Request Notifications**: Sends emails to configured addresses when new Kind 1111 events with community tags are received
- **Reply Notifications**: Sends emails to key owners when their requests receive replies (Kind 1111 events with A tags and p tags)
- **Database Integration**: Checks if pubkeys exist in the database before sending reply notifications
- **Configurable**: Environment-based configuration for community identifier, notification emails, and relay URLs
- **nostr-tools Integration**: Uses the lightweight nostr-tools library for efficient event processing

## Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy the example environment file and configure it:

   ```bash
   cp server/email-notification.env.example .env.local
   ```

   Required variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `RESEND_API_KEY`: Resend API key for sending emails
   - `COMMUNITY_IDENTIFIER`: Community identifier for filtering events
   - `NOTIFICATION_EMAILS`: Comma-separated list of email addresses for new request notifications

3. **Database Setup**
   Ensure your database is set up with the required tables (Keys, UserKeys, etc.) using Prisma migrations.

## Usage

### Run Email Notification Server Only

```bash
npm run email-notifications
```

### Run with Multi-Bunker Server and Next.js App

```bash
npm run dev:with-email
```

## Event Filters

### New Request Filter

- **Kind**: 1111
- **Tags**: `#a` with community identifier (e.g., `31922:your-community`)
- **Action**: Sends email to all addresses in `NOTIFICATION_EMAILS`

### Reply Filter

- **Kind**: 1111
- **Tags**: `#a` with community identifier AND `#p` tags
- **Action**: Checks if each `#p` pubkey exists in database, sends email to key owner if found

## Email Templates

### New Request Email

- **Subject**: "New Community Request - {COMMUNITY_IDENTIFIER}"
- **Content**: Event details including author, timestamp, and content

### Reply Email

- **Subject**: "New Reply to Your Community Request - {COMMUNITY_IDENTIFIER}"
- **Content**: Reply details including author, timestamp, and content
- **Recipient**: Email address associated with the pubkey in the `#p` tag

## Database Requirements

The server requires the following database tables:

- `Keys`: Stores Nostr keys with email addresses
- `UserKeys`: Associates Supabase users with Nostr keys

## Error Handling

- Database connection errors are logged and the server shuts down gracefully
- Email sending errors are logged but don't stop the server
- Invalid events are logged and skipped
- Missing configuration is logged and the server shuts down

## Monitoring

The server logs:

- Connection status to relays
- Event processing status
- Email sending results
- Periodic status updates every 30 seconds

## Graceful Shutdown

The server handles SIGTERM and SIGINT signals for graceful shutdown, closing all subscriptions and database connections.
