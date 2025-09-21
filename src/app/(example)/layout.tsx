import { NostrProvider } from '@/app/(example)/_context/NostrProvider';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OpenBunker - Nostr Community Onboarding',
  description:
    'A Discord-like login app for onboarding members to Nostr communities',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NostrProvider>{children}</NostrProvider>
      </body>
    </html>
  );
}
