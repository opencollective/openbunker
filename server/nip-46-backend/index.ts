import NDK, {
  IEventHandlingStrategy,
  NDKEvent,
  NDKNip46Backend,
  NDKPrivateKeySigner,
} from '@nostr-dev-kit/ndk';
import {
  ConnectEventHandlingStrategy,
  GetPublicKeyHandlingStrategy,
  Nip04DecryptHandlingStrategy,
  Nip04EncryptHandlingStrategy,
  Nip44DecryptHandlingStrategy,
  Nip44EncryptHandlingStrategy,
  PingEventHandlingStrategy,
  SignEventHandlingStrategy,
} from './strategies';

// Extended NDKNip46Backend with logging
export default class LoggingNDKNip46Backend extends NDKNip46Backend {
  private npub: string;

  constructor(
    ndk: NDK,
    signer: NDKPrivateKeySigner,
    allowCallback: (params: any) => Promise<boolean>,
    npub: string
  ) {
    super(ndk, signer, allowCallback);
    this.npub = npub;
  }

  async start() {
    this.localUser = await this.signer.user();
    const sub = this.ndk.subscribe(
      {
        kinds: [24133],
        '#p': [this.localUser.pubkey],
        since: Math.floor(Date.now() / 1000),
      },
      { closeOnEose: false }
    );
    sub.on('event', e => this.handleIncomingEvent(e));
  }

  public handlers: { [method: string]: IEventHandlingStrategy } = {
    connect: new ConnectEventHandlingStrategy(),
    sign_event: new SignEventHandlingStrategy(),
    nip04_encrypt: new Nip04EncryptHandlingStrategy(),
    nip04_decrypt: new Nip04DecryptHandlingStrategy(),
    nip44_encrypt: new Nip44EncryptHandlingStrategy(),
    nip44_decrypt: new Nip44DecryptHandlingStrategy(),
    get_public_key: new GetPublicKeyHandlingStrategy(),
    ping: new PingEventHandlingStrategy(),
  };

  protected async handleIncomingEvent(event: NDKEvent): Promise<void> {
    const timestamp = new Date().toISOString();
    const remotePubkey = event.pubkey;

    console.log(
      `[${timestamp}] [${this.npub}] 📥 Incoming NIP-46 request from ${remotePubkey}`
    );
    console.log(`[${timestamp}] [${this.npub}] 📋 Event details:`, {
      id: event.id,
      kind: event.kind,
      created_at: event.created_at
        ? new Date(event.created_at * 1000).toISOString()
        : 'unknown',
      content_length: event.content.length,
      tags_count: event.tags.length,
    });

    try {
      // Parse the event to get method and params
      const { id, method, params } = (await this.rpc.parseEvent(event)) as any;

      console.log(`[${timestamp}] [${this.npub}] 🔍 Parsed request:`, {
        id,
        method,
        params_count: params ? params.length : 0,
        params_preview: params
          ? JSON.stringify(params).substring(0, 200) +
            (JSON.stringify(params).length > 200 ? '...' : '')
          : 'none',
      });

      // Call the parent method
      await super.handleIncomingEvent(event);

      console.log(
        `[${timestamp}] [${this.npub}] ✅ Request processed successfully`
      );
    } catch (error) {
      console.error(
        `[${timestamp}] [${this.npub}] ❌ Error processing request:`,
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          remote_pubkey: remotePubkey,
        }
      );

      // Re-throw to maintain original behavior
      throw error;
    }
  }

  public async applyToken(_pubkey: string, _token: string): Promise<void> {
    console.log('applyToken', _pubkey, _token);
    return;
  }
}
