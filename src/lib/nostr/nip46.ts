import { nip19 } from "nostr-tools";
import { NIP46_RELAYS } from "@/lib/nostr/consts";

export const getBunkerLink = (npub: string, token = "") => {
  const { data: pubkey } = nip19.decode(npub);
  return `bunker://${pubkey}?relay=${NIP46_RELAYS[0]}${token ? `&secret=${token}` : ""}`;
};
