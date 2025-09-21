// OpenBunker API Types

export type ConnectionMode = 'bunker' | 'nostrconnect';

export interface BunkerAuthMessage {
  type: 'openbunker-auth-success';
  connectionMode: 'bunker';
  secretKey: string;
}

export interface NostrConnectAuthMessage {
  type: 'openbunker-auth-success';
  connectionMode: 'nostrconnect';
  success: boolean;
  errorMessage?: string;
}

export type OpenBunkerAuthMessage = BunkerAuthMessage | NostrConnectAuthMessage;
