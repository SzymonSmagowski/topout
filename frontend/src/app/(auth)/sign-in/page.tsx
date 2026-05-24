'use client';

import { useAuthActions } from '@convex-dev/auth/react';
import { ConvexError } from 'convex/values';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!email.trim() || password.length < 8) {
      setError('Enter an email and an 8+ character password.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn('password', { flow: 'signIn', email: email.trim(), password });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof ConvexError
        ? convexAuthMessage(err.data) ?? 'Sign-in failed.'
        : err instanceof Error
          ? humanizeAuthError(err.message)
          : 'Sign-in failed.';
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <header>
        <div className="section-eyebrow">topout · sign in</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-[color:var(--color-text-muted)]">
          Email + password. No OAuth. New here?{' '}
          <Link href="/register" className="text-[color:var(--color-accent)] underline-offset-2 hover:underline">
            Create an account
          </Link>
          .
        </p>
      </header>

      <form className="card space-y-4 p-6" onSubmit={onSubmit} noValidate>
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
              autoComplete="current-password"
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
          {submitting ? 'Signing in…' : 'Sign in'}
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
      return 'That email is already registered.';
    case 'invalid_credentials':
      return 'Invalid email or password.';
    default:
      return null;
  }
}

function humanizeAuthError(raw: string): string {
  if (/invalid/i.test(raw) || /credentials/i.test(raw)) return 'Invalid email or password.';
  return 'Sign-in failed. Check your credentials and try again.';
}
