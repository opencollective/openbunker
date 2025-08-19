# Multi-Bunker Server

This is a server script that manages multiple NIP-46 bunker instances based on database-stored keys and connection tokens.

## Features

- **Single NDK Instance**: Uses one NDK instance for all bunkers, improving efficiency
- **Database-Driven**: Scans the database for keys and connection tokens
- **Token Validation**: Only starts bunkers for keys with valid, non-expired connection tokens
- **Dynamic Management**: Automatically starts/stops bunkers based on token availability
- **Periodic Scanning**: Re-scans the database every 5 minutes for new keys/tokens

## Prerequisites

1. Database setup with Prisma (PostgreSQL)
2. Keys table with `ncryptsec` or `localKey` fields containing private keys
3. ConnectTokens table with valid, non-expired tokens
4. Environment variables configured (DATABASE_URL, etc.)

## Database Schema Requirements

The server expects the following database structure:

### Keys Table

```sql
model Keys {
  npub     String @id
  ncryptsec String?  -- Private key (nsec format)
  localKey String?   -- Alternative private key field
  -- ... other fields
}
```

### ConnectTokens Table

```sql
model ConnectTokens {
  token     String  @id
  npub      String
  timestamp BigInt
  expiry    BigInt  -- Token expiration timestamp
  subNpub   String?
  jsonData  String
}
```

## Usage

### Start the server

```bash
npm run multi-bunker
```

### Start with the web app

```bash
npm run dev:multi-bunker
```

## How it works

1. **Initialization**: Creates a single NDK instance and connects to relays
2. **Database Scan**: Queries the database for all keys and non-expired connection tokens
3. **Bunker Creation**: For each key with valid tokens:
   - Creates a signer using the private key
   - Creates an NDKNip46Backend using the shared NDK instance
   - Starts the backend
   - Stores the bunker instance
4. **Periodic Updates**: Every 5 minutes:
   - Re-scans the database
   - Starts new bunkers for keys with new valid tokens
   - Stops bunkers for keys with no valid tokens

## Connection Validation

The server validates connections using the following logic:

1. Checks if the key has any non-expired connection tokens
2. If no valid tokens exist, rejects the connection
3. If valid tokens exist, accepts the connection

You can extend the `validateConnection` method to add more sophisticated validation logic.

## Bunker URIs

For each active bunker, the server logs a bunker URI that clients can use to connect:

```
bunker://<pubkey>?relay=<relay_url>
```

## Configuration

### Relays

The server connects to these relays by default:

- `wss://relay.nsec.app`

You can modify the `relays` array in the script to use different relays.

### Scanning Interval

The database scanning interval is set to 5 minutes. You can modify the `setupPeriodicScanning` method to change this.

## Monitoring

The server provides several logging outputs:

- **Startup**: Shows connected relays and found keys/tokens
- **Bunker Status**: Logs when bunkers are started/stopped
- **Connection Validation**: Logs connection attempts and validation results
- **Heartbeat**: Every 30 seconds, shows the number of active bunkers
- **Periodic Scans**: Logs when database scans occur

## Graceful Shutdown

The server handles SIGTERM and SIGINT signals gracefully:

1. Stops all bunker instances
2. Closes database connections
3. Exits cleanly

## Security Notes

- Private keys are stored in the database (ensure proper encryption)
- Connection tokens have expiration times
- The server validates tokens before accepting connections
- Consider implementing additional authentication mechanisms

## Troubleshooting

### No bunkers starting

- Check that keys have valid `ncryptsec` or `localKey` values
- Verify that connection tokens exist and haven't expired
- Check database connectivity

### Connection rejections

- Verify that connection tokens are not expired
- Check the `validateConnection` method logic
- Review server logs for validation details

### Database errors

- Ensure DATABASE_URL is correctly configured
- Check that Prisma schema is up to date
- Verify database permissions

## Example Output

```
Starting Multi-Bunker Server...
Connecting to relays: wss://relay.nsec.app
Connected to relays
Scanning database for keys and connection tokens...
Found 3 keys in database
Found 2 non-expired connection tokens
Key npub1abc... has valid connection tokens - will start bunker
Key npub1def... has no valid connection tokens - skipping
Starting bunker instances...
Starting bunker for key: npub1abc...
Created signer for npub1abc...: 68a6a83e0236dbf9f0f612472d34d59f570cd76f3f1b59d3cdd7ef9794e754b7
Started backend for npub1abc...

Bunker URI for npub1abc...:
  bunker://68a6a83e0236dbf9f0f612472d34d59f570cd76f3f1b59d3cdd7ef9794e754b7?relay=wss%3A%2F%2Frelay.nsec.app

Started 1 bunker instances
Multi-Bunker Server Status: 1 active bunkers - 2024-01-15T10:30:00.000Z
```
