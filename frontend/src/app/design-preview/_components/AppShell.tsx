'use client';

import {
  BarChart3,
  ChevronDown,
  CircleUser,
  ClipboardList,
  Home,
  LogOut,
  ScrollText,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

import { USER_ME } from '../_data/mock';

export type SectionId =
  | 'auth'
  | 'log-session'
  | 'sessions'
  | 'dashboard'
  | 'partners'
  | 'partner-detail'
  | 'reports'
  | 'report-detail';

interface NavItem {
  readonly id: SectionId;
  readonly label: string;
  readonly icon: ReactNode;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" aria-hidden /> },
  { id: 'sessions', label: 'Sessions', icon: <ClipboardList className="h-4 w-4" aria-hidden /> },
  { id: 'partners', label: 'Partners', icon: <Users className="h-4 w-4" aria-hidden /> },
  { id: 'reports', label: 'Reports', icon: <ScrollText className="h-4 w-4" aria-hidden /> },
];

const SECONDARY_ITEMS: readonly { readonly id: SectionId; readonly label: string }[] = [
  { id: 'auth', label: 'Sign-in / register' },
  { id: 'log-session', label: 'Log session form' },
  { id: 'partner-detail', label: 'Partner detail' },
  { id: 'report-detail', label: 'Report detail' },
];

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <a
            href="#dashboard"
            className="flex items-center gap-2 text-[color:var(--color-text)] hover:opacity-90"
          >
            <Logo className="h-7 w-[124px]" />
          </a>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="btn btn-ghost h-9"
              >
                {item.icon}
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden lg:inline-flex chip">
              <BarChart3 className="h-3 w-3" aria-hidden />
              Design preview
            </span>
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
                  {USER_ME.initials}
                </span>
                <span className="hidden sm:inline text-sm">{USER_ME.displayName}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="card absolute right-0 top-11 w-56 p-1 text-sm"
                  style={{ boxShadow: 'var(--shadow-pop)' }}
                >
                  <div className="px-3 py-2">
                    <div className="text-[color:var(--color-text)] font-medium">{USER_ME.displayName}</div>
                    <div className="text-xs text-[color:var(--color-text-muted)]">{USER_ME.email}</div>
                  </div>
                  <div className="my-1 border-t hairline" />
                  <button
                    type="button"
                    role="menuitem"
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

        {/* Mobile nav row */}
        <nav
          aria-label="Primary (mobile)"
          className="md:hidden border-t hairline overflow-x-auto"
        >
          <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-4 py-2">
            {NAV_ITEMS.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="btn btn-ghost h-8 shrink-0 text-xs">
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-10 sm:px-6 lg:py-12">
        <PreviewIntro />
        {children}
      </div>

      <footer className="border-t hairline">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
          <p className="text-xs text-[color:var(--color-text-muted)]">
            TopOut — Chalk + Crag design preview. Static mock data, no Convex. Build with
            <code className="mx-1 rounded bg-[color:var(--color-surface-2)] px-1.5 py-0.5">
              /build topout
            </code>
            to wire real auth, schema, and reactivity.
          </p>
        </div>
      </footer>
    </div>
  );
}

function PreviewIntro() {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="section-eyebrow">topout · design preview</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Bouldering coach — all seven features on one page.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CircleUser className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />
          <span className="text-sm text-[color:var(--color-text-muted)]">
            Signed in as <strong className="text-[color:var(--color-text)]">{USER_ME.displayName}</strong>
          </span>
        </div>
      </div>
      <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-[color:var(--color-text-muted)]">
        Scroll through every feature in build order: auth · log session · session list & detail · live dashboard · partner-follow · weekly report. Toggle dark mode in the top-right. Every grade pill, KPI tile, and chart bar reads its color from
        <code className="mx-1 rounded bg-[color:var(--color-surface-2)] px-1.5 py-0.5 text-xs">
          @/lib/grade-colors.ts
        </code>
        — single source of truth.
      </p>
      <nav aria-label="Jump to section" className="mt-5 flex flex-wrap gap-2">
        {[...NAV_ITEMS, ...SECONDARY_ITEMS].map((item) => (
          <a key={item.id} href={`#${item.id}`} className="chip hover:!text-[color:var(--color-text)]">
            {item.label}
          </a>
        ))}
      </nav>
    </section>
  );
}
