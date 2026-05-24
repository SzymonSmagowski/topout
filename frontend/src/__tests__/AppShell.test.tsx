/**
 * AppShell — three scenarios around the viewer query state.
 *
 * AppShell always renders the nav (it's not conditional on auth status — the
 * middleware/redirect handles unauthenticated users before they reach an app
 * route). What we do test:
 *   - authenticated viewer → nav links present + display name shown
 *   - viewer returns null (loading finished, no user) → initials fall back to '··'
 *   - viewer returns undefined (still loading) → initials show '··' placeholder
 */
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock next/navigation before importing anything that uses it.
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));

// Mock next-themes (ThemeToggle uses it).
vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' })),
}));

// Mock Convex auth actions.
vi.mock('@convex-dev/auth/react', () => ({
  useAuthActions: vi.fn(() => ({ signOut: vi.fn() })),
}));

// Mock convex/react — we control what useQuery returns per-test.
const mockUseQuery = vi.fn();
vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: vi.fn(() => vi.fn()),
}));

import { AppShell } from '../components/AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('integration AppShell authenticated viewer — renders nav links and display name', () => {
    mockUseQuery.mockReturnValue({
      _id: 'user-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
    });

    render(<AppShell><div>content</div></AppShell>);

    // Nav links are present (desktop nav, aria-label="Primary").
    const desktopNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(desktopNav).toBeInTheDocument();
    expect(desktopNav).toHaveTextContent('Dashboard');
    expect(desktopNav).toHaveTextContent('Sessions');
    expect(desktopNav).toHaveTextContent('Partners');
    expect(desktopNav).toHaveTextContent('Reports');

    // Display name appears in the user menu button.
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();

    // Initials: "AL" from "Ada Lovelace".
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('integration AppShell loading state (useQuery returns undefined) — shows placeholder initials', () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<AppShell><div>content</div></AppShell>);

    // Initials placeholder is '··' when viewer is still loading.
    expect(screen.getAllByText('··').length).toBeGreaterThan(0);
  });

  it('integration AppShell no viewer (useQuery returns null) — shows placeholder initials', () => {
    mockUseQuery.mockReturnValue(null);

    render(<AppShell><div>content</div></AppShell>);

    expect(screen.getAllByText('··').length).toBeGreaterThan(0);
  });
});
