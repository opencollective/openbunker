# Bunker Client

This is a client script that connects to a Nostr bunker using the NIP-46 protocol.

## Prerequisites

1. Make sure you have a bunker server running (like the one in `nostr-listener.ts`)
2. You need a bunker connection string (bunker://...)

## Installation

First, install the dependencies:

```bash
npm install
```

## Usage

Run the client script:

```bash
npm run bunker-client
```

The script will:

1. Prompt you to enter your bunker connection string
2. Generate a new local nsec key for this session
3. Connect to the bunker using NIP-46
4. Display your npub and profile information

## How it works

The client script implements the exact flow you requested:

```typescript
const signerConnectionString = 'bunker://....'; // asks user for input
const signer = NDKNip46Signer.bunker(ndk, signerConnectionString, undefined); // always generate new
const user = await signer.blockUntilReady();
console.log("Welcome", user.npub);
```

## Storage

No local nsec keys are saved. A new local key is generated for each session and discarded when the session ends.

## Example Output

```
Starting Bunker Client...

Enter your bunker connection string (bunker://...): bunker://npub1dzn2s0szxmdlnu8kzfrj6dx4natse4m08ud4n57d6lhe09882jmsrpxkhh@relay.damus.io
Generating new local nsec for this session
Connecting to bunker...

🎉 Successfully connected to bunker!
Welcome npub1dzn2s0szxmdlnu8kzfrj6dx4natse4m08ud4n57d6lhe09882jmsrpxkhh
User profile: { name: 'Your Name', ... }
Connection established. Press Ctrl+C to exit.
```

## Security Notes

- The local nsec key is stored in plain text in the `local-nsec.txt` file
- In a production environment, you should use a more secure storage method
- The bunker connection string contains sensitive information and should be kept private 