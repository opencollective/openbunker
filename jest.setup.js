// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

// Use real fetch for Node.js environment (Node 18+ has built-in fetch)
// Only mock fetch if we're in jsdom environment
if (process.env.JEST_ENVIRONMENT === 'jsdom') {
  global.fetch = jest.fn();
}

// Polyfill for TextDecoder/TextEncoder (needed for nostr-tools)
import { TextDecoder, TextEncoder } from 'util';
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
