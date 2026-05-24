'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { ChevronDown, ClipboardList, Home, LogOut, ScrollText, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { api } from '@convex/_generated/api';

import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly match: (pathname: string) => boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <Home className="h-4 w-4" aria-hidden />,
    match: (p) => p === '/dashboard',
  },
  {
    href: '/sessions',
    label: 'Sessions',
    icon: <ClipboardList className="h-4 w-4" aria-hidden />,
    match: (p) => p === '/sessions' || p.startsWith('/sessions/'),
  },
  {
    href: '/partners',
    label: 'Partners',
    icon: <Users className="h-4 w-4" aria-hidden />,
    match: (p) => p === '/partners' || p.startsWith('/partners/'),
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: <ScrollText className="h-4 w-4" aria-hidden />,
    match: (p) => p === '/reports' || p.startsWith('/reports/'),
  },
];

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, {});
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = viewer?.displayName
    ? viewer.displayName
        .split(/\s+/)
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '··';

  const handleSignOut = async () => {
    await signOut();
    router.push('/sign-in');
  };

  return (
    <div className="relative isolate min-h-screen">
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'oklch(from var(--color-bg) l c h / 0.82)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[color:var(--color-text)] hover:opacity-90"
          >
            <Logo className="h-7 w-[124px]" />
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="btn btn-ghost h-9"
                  style={
                    active
                      ? { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }
                      : undefined
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />

            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => window.setTimeout(() => setMenuOpen(false), 120)}
                className="btn btn-ghost h-9 gap-2 !px-2"
              >
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.6875rem] font-semibold"
                  style={{
                    backgroundColor: 'var(--color-sienna-200)',
                    color: 'var(--color-sienna-900)',
                  }}
                >
                  {initials}
                </span>
                <span className="hidden sm:inline text-sm">
                  {viewer?.displayName ?? '…'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="card absolute right-0 top-11 w-56 p-1 text-sm"
                  style={{ boxShadow: 'var(--shadow-pop)' }}
                >
                  <div className="px-3 py-2">
                    <div className="text-[color:var(--color-text)] font-medium">
                      {viewer?.displayName ?? '…'}
                    </div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">
                      {viewer?.email ?? ''}
                    </div>
                  </div>
                  <div className="my-1 border-t hairline" />
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => {
                      // Prevent the menu's onBlur from closing before the click fires.
                      e.preventDefault();
                    }}
                    onClick={handleSignOut}
                    className="btn btn-ghost h-9 w-full justify-start text-[color:var(--color-danger)]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav
          aria-label="Primary (mobile)"
          className="md:hidden border-t hairline overflow-x-auto"
        >
          <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-4 py-2">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="btn btn-ghost h-8 shrink-0 text-xs"
                  style={
                    active
                      ? { backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text)' }
                      : undefined
                  }
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </div>
    </div>
  );
}
