import { EventEmitter } from 'tseep';

import NDK, {
  NDKEvent,
  NDKKind,
  NDKPrivateKeySigner,
  NDKRelay,
  NDKRelaySet,
  NDKUser,
} from '@nostr-dev-kit/ndk';
import { nip44, NostrEvent } from 'nostr-tools';
import { hexToBytes } from 'nostr-tools/utils';

export interface NDKRpcRequest {
  id: string;
  pubkey: string;
  method: string;
  params: string[];
  event: NostrEvent;
}

export interface NDKRpcResponse {
  id: string;
  result: string;
  error?: string;
  event: NostrEvent;
}

export class NDKEncryptedNostrChannelAdapter extends EventEmitter {
  private localSigner: NDKPrivateKeySigner;
  private relaySet: NDKRelaySet | undefined;
  public encryptionType: 'nip04' | 'nip44' = 'nip04';
  private ndk: NDK;

  public constructor(
    localSigner: NDKPrivateKeySigner,
    relayUrls: WebSocket['url'][]
  ) {
    super();
    this.localSigner = localSigner;
    this.ndk = new NDK({ signer: this.localSigner });
    this.relaySet = new NDKRelaySet(
      new Set(relayUrls.map(url => new NDKRelay(url, undefined, this.ndk))),
      this.ndk
    );
    console.log('Relay set', this.relaySet);
  }

  public async parseEvent(
    event: NostrEvent
  ): Promise<NDKRpcRequest | NDKRpcResponse> {
    // validate signature explicitly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // TODO
    // if (!event.verifySignature(false)) {
    //   console.debug('invalid signature', event);
    //   return;
    // }
    // support both nip04 and nip44 encryption
    let encryptionType = this.encryptionType;
    if (this.encryptionType === 'nip44' && event.content.includes('?iv=')) {
      encryptionType = 'nip04';
    } else if (
      this.encryptionType === 'nip04' &&
      !event.content.includes('?iv=')
    ) {
      encryptionType = 'nip44';
    }
    const clientUserPubKey = event.pubkey;

    let decryptedContent: string;

    try {
      decryptedContent = await this.localSigner.decrypt(
        new NDKUser({ pubkey: clientUserPubKey }),
        event.content,
        encryptionType
      );
    } catch (_e) {
      const otherEncryptionType =
        encryptionType === 'nip04' ? 'nip44' : 'nip04';
      decryptedContent = await this.localSigner.decrypt(
        new NDKUser({ pubkey: clientUserPubKey }),
        event.content,
        otherEncryptionType
      );
      encryptionType = otherEncryptionType;
    }

    const parsedContent = JSON.parse(decryptedContent);
    const { id, method, params, result, error } = parsedContent;

    if (method) {
      return { id, pubkey: event.pubkey, method, params, event };
    }
    return { id, result, error, event };
  }

  public async sendResponse(
    id: string,
    remotePubkey: string,
    result: string,
    kind = NDKKind.NostrConnect,
    error?: string
  ): Promise<void> {
    const res = { id, result } as NDKRpcResponse;
    if (error) {
      res.error = error;
    }
    const localUser = await this.localSigner.user();

    const event = new NDKEvent(this.ndk, {
      kind,
      content: JSON.stringify(res),
      tags: [['p', remotePubkey]],
      pubkey: localUser.pubkey,
    } as NostrEvent);

    const conversationKey = nip44.v2.utils.getConversationKey(
      hexToBytes(this.localSigner.privateKey),
      remotePubkey
    );
    event.content = nip44.v2.encrypt(event.content, conversationKey);

    await event.sign(this.localSigner);
    await event.publish(this.relaySet);
  }

  /**
   * Sends a request.
   * @param remotePubkey
   * @param method
   * @param params
   * @param kind
   * @param id
   */
  public async sendRequest(
    remotePubkey: string,
    method: string,
    params: string[] = [],
    kind = 24133,
    cb?: (res: NDKRpcResponse) => void
  ): Promise<NDKRpcResponse> {
    const id = Math.random().toString(36).substring(7);
    const localUser = await this.localSigner.user();
    const request = { id, method, params };
    const promise = new Promise<NDKRpcResponse>(() => {
      const responseHandler = (response: NDKRpcResponse) => {
        if (response.result === 'auth_url') {
          this.once(`response-${id}`, responseHandler);
          this.emit('authUrl', response.error);
        } else if (cb) {
          cb(response);
        }
      };

      this.once(`response-${id}`, responseHandler);
    });

    const event = new NDKEvent(this.ndk, {
      kind,
      content: JSON.stringify(request),
      tags: [['p', remotePubkey]],
      pubkey: localUser.pubkey,
    } as NostrEvent);

    event.content = await this.localSigner.encrypt(
      new NDKUser({ pubkey: remotePubkey }),
      event.content,
      this.encryptionType
    );
    await event.sign(this.localSigner);
    await event.publish(this.relaySet);

    return promise;
  }
}
