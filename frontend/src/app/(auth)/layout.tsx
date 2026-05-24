import type { ReactNode } from 'react';

import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen">
      <header className="mx-auto flex h-14 max-w-[1280px] items-center px-4 sm:px-6">
        <Logo className="h-7 w-[124px]" />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-8 sm:px-6 lg:py-12">
        {children}
      </main>
    </div>
  );
}
