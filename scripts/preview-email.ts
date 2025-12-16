#!/usr/bin/env tsx
/**
 * Script to preview the verification email template in a browser
 *
 * Usage:
 *   npm run preview:email
 *   npm run preview:email -- --scope "My Collective" --code "123456"
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import {
  buildVerificationEmailHTML,
  type AppProfile,
} from '../src/lib/emails/verificationEmail';

const execAsync = promisify(exec);

// Default app profile for open-source community
const defaultAppProfile: AppProfile = {
  name: 'Public Proposal Application',
  icon: 'https://opencollective.com/static/images/oc-logo-watercolor-256.png',
  description: 'A public proposal application for communities',
  url: 'https://opencollective.com',
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let scopeName = 'Open Collective';
  let code = Math.floor(100000 + Math.random() * 900000).toString();
  let emptyProfile = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--scope=')) {
      scopeName = arg.split('=')[1];
    } else if (arg === '--scope' && i + 1 < args.length) {
      scopeName = args[i + 1];
      i++;
    } else if (arg.startsWith('--code=')) {
      code = arg.split('=')[1];
    } else if (arg === '--code' && i + 1 < args.length) {
      code = args[i + 1];
      i++;
    } else if (arg === '--no-profile' || arg === '--empty-profile') {
      emptyProfile = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
📧 Verification Email Preview Script

Usage:
  npm run preview:email
  npm run preview:email -- --scope "My Collective"
  npm run preview:email -- --code "123456"
  npm run preview:email -- --scope "My Collective" --code "123456"
  npm run preview:email -- --no-profile

Options:
  --scope <name>        Set the collective/scope name (default: "Open Collective")
  --code <code>         Set the verification code (default: random 6-digit code)
  --no-profile          Run with an empty app profile (no app icon/name/description)
  --empty-profile        Alias for --no-profile
  --help, -h            Show this help message

Examples:
  npm run preview:email
  npm run preview:email -- --scope "Nostr Community"
  npm run preview:email -- --code "999888"
  npm run preview:email -- --no-profile
      `);
      process.exit(0);
    }
  }

  return { scopeName, code, emptyProfile };
}

const { scopeName, code, emptyProfile } = parseArgs();

// Generate the HTML with or without app profile based on flag
const html = buildVerificationEmailHTML({
  email: 'test@example.com',
  code,
  scopeName,
  appProfile: emptyProfile ? null : defaultAppProfile,
});

// Create a temporary file to store the HTML
const tempDir = path.join(process.cwd(), '.temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const tempFile = path.join(tempDir, 'verification-email-preview.html');
fs.writeFileSync(tempFile, html, 'utf-8');

console.log('📧 Verification email HTML generated!');
console.log(`📁 File: ${tempFile}`);
console.log(`🔑 Code: ${code}`);
console.log(`🏢 Scope: ${scopeName}`);
console.log(`📱 App Profile: ${emptyProfile ? 'None (empty)' : 'Default'}`);
console.log('🌐 Opening in browser...\n');

// Open in browser (cross-platform)
const openCommand =
  process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

execAsync(`${openCommand} "${tempFile}"`)
  .then(() => {
    console.log('✅ Email preview opened in your default browser!');
    console.log(
      '\n💡 Tip: The file will remain in .temp/verification-email-preview.html'
    );
    console.log(
      '   You can refresh the browser to see changes after editing the template.\n'
    );
  })
  .catch(error => {
    console.error('❌ Failed to open browser:', error.message);
    console.log(`\n📄 You can manually open the file at:\n   ${tempFile}\n`);
    process.exit(1);
  });
