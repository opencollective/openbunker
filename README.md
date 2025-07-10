# OpenBunker

OpenBunker is an authentication platform that helps manage Nostr keys through social login integration. Currently supporting Discord OAuth, it provides a custodial solution for users to authenticate and manage their Nostr identities.

## Features

- **Social Authentication**: Sign in with Discord (more social platforms coming soon)
- **Custodial Key Management**: Secure storage and management of Nostr private keys
- **Bunker Server**: NIP-46 compliant server for remote signing and authentication
- **Example Application**: Demo application showing platform integration
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS

## Architecture

OpenBunker is a **custodial application**, meaning private keys are stored in a database. The platform consists of:

### Components

- **Next.js Application**: Main web interface with Prisma ORM
- **Supabase**: PostgreSQL database and social authentication provider
- **Bunker Server**: NIP-46 compliant server that listens on authentication relays and handles remote signing requests

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account and project

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up Supabase project

You will also need to set up a SQL user for the application. We use the prisma user in the example SQL below.

```sql
create user "prisma" with password 'your_password' bypassrls createdb;

grant "prisma" to "postgres";

-- Grant it necessary permissions over the relevant schemas (public)
grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;
```

3. Set up Discord App
See [the Discord integration with Supabase documentation](https://supabase.com/docs/guides/auth/social-login/auth-discord?queryGroups=environment&environment=server)

4. Set up environment variables:
```bash
# Create .env.local file
NEXT_PUBLIC_SUPABASE_URL=https://yourprojecturl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xyz
SUPABASE_URL=https://yourprojecturl.supabase.co
SUPABASE_ANON_KEY=xyz
DISCORD_CLIENT_ID=x
DISCORD_CLIENT_SECRET=x

PASS_PRISMA=your_password
DATABASE_URL=postgresql://prisma.yourprojecturl:your_password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres

```
Create a .env file
```bash
# Create .env
NEXT_PUBLIC_SUPABASE_URL=https://vwlhjfwabbobhbopmmxa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3bGhqZndhYmJvYmhib3BtbXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MTY4MTgsImV4cCI6MjA2NjA5MjgxOH0.RQzgeVH8bDHcHCHAc3lSBZRNBwZosrKY5snp1g7ppV0
```

5. Set up the database:
```bash
npx run db:generate
npx run db:migrate
```

6. Run the development server:
```bash
npm run dev
```

7. Run the bunker server
```bash
npm run multi-bunker
```

## For Client Applications

To integrate OpenBunker into your application:

### 1. Popup Window Integration

Your client application should open a popup window to the OpenBunker authentication flow and expose an `openBunkerCallback` function to handle the authentication response.

### 2. Bunker Signer Integration

We recommend using NDK's bunker signer with the bunker connection token for secure remote signing:

```typescript
import { NDK } from '@nostr-dev-kit/ndk';
import { NDKBunkerSigner } from '@nostr-dev-kit/ndk';

// Initialize bunker signer with connection token
const bunkerSigner = new NDKBunkerSigner(connectionToken);
const ndk = new NDK({ signer: bunkerSigner });
```

### 3. Authentication Flow

1. User clicks "Sign in with OpenBunker" in your app
2. Popup opens to OpenBunker authentication page
3. User authenticates with Discord
4. OpenBunker generates Nostr keys and returns connection token
5. Your app receives the token via `openBunkerCallback`
6. Use the token with NDK bunker signer for remote signing

## Example Application

The example application in the `(example)` folder demonstrates how to integrate with OpenBunker. It allows users to:

- Query and edit user metadata
- Demonstrate the complete authentication flow
- Show proper integration patterns

To run the example:
```bash
npm run dev
# Navigate to http://localhost:3000/example
```


### Example NOSTR application demo

[![OpenBunker Demo]()](https://www.loom.com/share/ce9a313d2ebf4feab10405da24969b59)

## API Endpoints

### Authentication

- `POST /api/auth/discord-callback` - Handle Discord OAuth callback
- `GET /api/auth/openbunker-url` - Get authentication URL
- `POST /api/auth/verify-session` - Verify user session

## Security Considerations

⚠️ **Important**: This is a custodial application. Private keys are stored in the database.

### Current Security Status
- Supabase DB is public...
- Private keys are stored in Supabase database
- Additional encryption layer recommended for production
- Connection token validation needs improvement

## TODO - Before Production

Before OpenBunker should be considered production-ready, the following issues need to be addressed:

### 1. Private Key Security
- **Assessment Required**: Current security measures need thorough evaluation
- **Additional Encryption**: Consider implementing additional encryption layers for stored private keys
- **Key Rotation**: Implement secure key rotation mechanisms

### 2. Authorization System
- **Connection Token Validation**: Currently, the server authorizes every local key without proper connection token validation on first connection
- **Session Management**: Improve session validation and token-based authentication
- **Access Control**: Implement proper authorization checks for all bunker operations

### 3. Additional Features
- **Multi-Social Support**: Add support for additional social platforms (Twitter, GitHub, etc.)
- **Audit Logging**: Add comprehensive audit trails for all operations

## Development

### Project Structure

```
openbunker/
├── src/
│   ├── app/
│   │   ├── (example)/          # Example application
│   │   ├── (openbunker)/       # Main OpenBunker app
│   │   ├── api/                # API routes
│   │   └── globals.css
│   ├── components/             # React components
│   ├── contexts/               # React contexts
│   ├── hooks/                  # Custom hooks
│   ├── lib/                    # Utility functions
│   └── types/                  # TypeScript types
├── server/                     # Bunker server implementation
├── prisma/                     # Database schema and migrations
└── middleware.ts               # Next.js middleware
```

### Running the Bunker Server

```bash
# Start the bunker server
npm run multi-bunker

# Or run both frontend and bunker server
npm run dev:all
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- NIP-46 compliant bunker server implementation
- Inspired by https://github.com/nostrband/noauth
