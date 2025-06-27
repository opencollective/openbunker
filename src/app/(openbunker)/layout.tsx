import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { NostrProvider } from "@/contexts/NostrContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenBunker - Nostr Community Onboarding",
  description: "A Discord-like login app for onboarding members to Nostr communities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <NostrProvider>
            {children}
          </NostrProvider>
        </AuthProvider>
      </body>
    </html>
  );
} 