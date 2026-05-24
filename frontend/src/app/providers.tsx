'use client';

import { ConvexAuthNextjsProvider } from '@convex-dev/auth/nextjs';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

import { convex } from '@/lib/convex-client';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}
