import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import type { Metadata, Viewport } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TopOut — Bouldering Coach',
  description: 'Log V-scale sessions, see live progress, get AI weekly coaching narratives.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F0' },
    { media: '(prefers-color-scheme: dark)', color: '#14110D' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${interTight.variable} ${jetbrainsMono.variable}`}
      >
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
