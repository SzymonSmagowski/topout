'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { SectionHeader } from './SectionHeader';

type Mode = 'signin' | 'register';

export function AuthSection() {
  const [mode, setMode] = useState<Mode>('signin');
  const [showPw, setShowPw] = useState(false);

  return (
    <section className="space-y-6">
      <SectionHeader
        id="auth"
        eyebrow="01 · auth"
        title="Email + password sign-in"
        description={
          <>
            Convex Auth Password provider. No OAuth, no SSO — the user explicitly rejected those.
            Returning users see the sign-in form first; the “Register” tab swaps in a third field for
            display name. Submit failures render inline; the form never throws a toast for a 400.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="card overflow-hidden">
          <div className="border-b hairline px-6 py-4">
            <div role="tablist" aria-label="Auth mode" className="pill-group">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                data-active={mode === 'signin'}
                onClick={() => setMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                data-active={mode === 'register'}
                onClick={() => setMode('register')}
              >
                Register
              </button>
            </div>
          </div>

          <form
            className="space-y-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="label">
                  Display name
                </label>
                <input
                  id="auth-name"
                  className="input"
                  type="text"
                  placeholder="Alex Climber"
                  autoComplete="name"
                  defaultValue="Alex Climber"
                />
                <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                  Shown to partners who follow you. Set once at register; not editable later in v1.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="label">
                Email
              </label>
              <input
                id="auth-email"
                className="input"
                type="email"
                placeholder="you@topout.local"
                autoComplete="email"
                defaultValue="seed-alex@topout.local"
              />
            </div>

            <div>
              <label htmlFor="auth-pw" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-pw"
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  defaultValue="seed-demo-pw"
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div
                role="alert"
                className="rounded-md border px-3 py-2 text-xs"
                style={{
                  backgroundColor: 'oklch(from var(--color-danger) l c h / 0.08)',
                  borderColor: 'oklch(from var(--color-danger) l c h / 0.4)',
                  color: 'var(--color-danger)',
                }}
              >
                That email is already registered. Sign in instead?
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[color:var(--color-accent)]" />
                Remember me 30 days
              </label>
              <button type="submit" className="btn btn-primary">
                <Loader2 className="h-4 w-4 animate-spin opacity-0" aria-hidden />
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </form>
        </div>

        <aside className="card p-6">
          <h3 className="text-sm font-semibold">Seed credentials</h3>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Documented in <code className="rounded bg-[color:var(--color-surface-2)] px-1">apps/topout/README.md</code>.
            Sign in with either seed account to see populated charts and a follow relationship.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
                Alex Climber (V3 → V5)
              </dt>
              <dd className="mt-1 font-mono text-xs text-[color:var(--color-text)]">seed-alex@topout.local</dd>
              <dd className="font-mono text-xs text-[color:var(--color-text)]">seed-demo-pw</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
                Sam Crusher (V4 → V6)
              </dt>
              <dd className="mt-1 font-mono text-xs text-[color:var(--color-text)]">seed-sam@topout.local</dd>
              <dd className="font-mono text-xs text-[color:var(--color-text)]">seed-demo-pw</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
