'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { ConvexError } from 'convex/values';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [showPw, setShowPw] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!displayName.trim()) {
      setError('Pick a display name your training partners will see.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn('password', {
        flow: 'signUp',
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof ConvexError
        ? convexAuthMessage(err.data) ?? 'Could not create account.'
        : err instanceof Error
          ? humanizeRegisterError(err.message)
          : 'Could not create account.';
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <header>
        <div className="section-eyebrow">topout · register</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          Already have one?{' '}
          <Link href="/sign-in" className="text-[color:var(--color-accent)] underline-offset-2 hover:underline">
            Sign in
          </Link>
          .
        </p>
      </header>

      <form className="card space-y-4 p-6" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="displayName" className="label">Display name</label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            className="input"
            placeholder="Alex Climber"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Set once at register. Shown to partners who follow you.
          </p>
        </div>

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="input"
            placeholder="you@topout.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              className="input pr-10"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
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

        {error && (
          <div
            role="alert"
            className="rounded-md border px-3 py-2 text-xs"
            style={{
              backgroundColor: 'oklch(from var(--color-danger) l c h / 0.08)',
              borderColor: 'oklch(from var(--color-danger) l c h / 0.4)',
              color: 'var(--color-danger)',
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </section>
  );
}

function convexAuthMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('kind' in data)) return null;
  const kind = (data as { kind: string }).kind;
  switch (kind) {
    case 'email_taken':
      return 'That email is already registered. Sign in instead?';
    default:
      return null;
  }
}

function humanizeRegisterError(raw: string): string {
  if (/already/i.test(raw) || /taken/i.test(raw) || /duplicate/i.test(raw)) {
    return 'That email is already registered. Sign in instead?';
  }
  return 'Could not create account. Try again.';
}
