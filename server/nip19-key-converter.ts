import { nip19 } from 'nostr-tools';

type NIP19Type = 'npub' | 'nsec';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const input = args[0]?.trim();
const targetType = parseTypeArg(args, 'npub');

if (!input) {
  console.error('No input provided.\n');
  printHelp();
  process.exit(1);
}

if (isNip19(input)) {
  convertNip19ToHex(input);
  process.exit(0);
}

if (isHex(input)) {
  convertHexToNip19(input, targetType);
  process.exit(0);
}

console.error('Input not recognized as hex or nip19 key.');
printHelp();
process.exit(1);

function parseTypeArg(argv: string[], fallback: NIP19Type): NIP19Type {
  // First, try to find --type or -t flag
  const index = argv.findIndex(arg => arg === '--type' || arg === '-t');
  if (index !== -1 && index + 1 < argv.length) {
    const value = argv[index + 1];
    if (value === 'npub' || value === 'nsec') {
      return value;
    }
    console.warn(`Unknown type "${value}". Defaulting to ${fallback}.`);
    return fallback;
  }

  // Fallback: if second argument is a valid type (and not a hex/nip19 key), use it
  // This handles the case where npm strips --type flag
  if (argv.length >= 2) {
    const secondArg = argv[1];
    if (secondArg === 'npub' || secondArg === 'nsec') {
      // Only use it if it's not a valid hex key (64 hex chars) or nip19 key
      const isHexKey = /^[0-9a-f]{64}$/i.test(secondArg);
      const isNip19Key =
        secondArg.startsWith('npub') || secondArg.startsWith('nsec');
      if (!isHexKey && !isNip19Key) {
        return secondArg;
      }
    }
  }

  return fallback;
}

function isHex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function isNip19(value: string): boolean {
  return value.startsWith('npub') || value.startsWith('nsec');
}

function convertNip19ToHex(key: string) {
  try {
    const decoded = nip19.decode(key);

    if (decoded.type === 'npub' && typeof decoded.data === 'string') {
      console.log(`npub ➜ hex\n${decoded.data}`);
      return;
    }

    if (decoded.type === 'nsec' && decoded.data instanceof Uint8Array) {
      console.log(`nsec ➜ hex\n${Buffer.from(decoded.data).toString('hex')}`);
      return;
    }

    console.error(`Unsupported nip19 type "${decoded.type}".`);
  } catch (error) {
    console.error('Failed to decode nip19 key:', error);
  }
}

function convertHexToNip19(hex: string, type: NIP19Type) {
  try {
    if (type === 'npub') {
      console.log(`hex ➜ npub\n${nip19.npubEncode(hex.toLowerCase())}`);
      return;
    }

    const bytes = hexToBytes(hex);
    console.log(`hex ➜ nsec\n${nip19.nsecEncode(bytes)}`);
  } catch (error) {
    console.error('Failed to encode hex key:', error);
  }
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / 2);

  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }

  return bytes;
}

function printHelp() {
  console.log(`Usage:
  tsx server/nip19-key-converter.ts <key> [--type npub|nsec]

Examples:
  tsx server/nip19-key-converter.ts npub1...
  tsx server/nip19-key-converter.ts 9ccf... --type nsec

Notes:
  • Input starting with "npub" or "nsec" is treated as nip19 and decoded to hex.
  • Hex input must be 64 characters. Use --type to choose npub or nsec output.
`);
}
