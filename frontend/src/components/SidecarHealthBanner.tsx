'use client';

import { AlertOctagon, Server, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

type Health =
  | { readonly kind: 'pinging' }
  | { readonly kind: 'ok'; readonly model: string }
  | { readonly kind: 'down' };

interface SidecarHealthBannerProps {
  /** Render slot for the "Generate this week's report" button. */
  readonly action: React.ReactNode;
}

/**
 * Pings the Python sidecar `/health` endpoint on mount. The endpoint is
 * deliberately unauthenticated (per architecture §6.1) so we can detect a
 * down sidecar without leaking the bearer token to the client.
 *
 * URL comes from `NEXT_PUBLIC_PYTHON_SIDECAR_URL`. If unset, we render the
 * "down" state with a hint to copy `.env.local.example`.
 */
export function SidecarHealthBanner({ action }: SidecarHealthBannerProps) {
  const sidecarUrl = process.env.NEXT_PUBLIC_PYTHON_SIDECAR_URL;
  const [health, setHealth] = useState<Health>({ kind: 'pinging' });

  useEffect(() => {
    if (!sidecarUrl) {
      setHealth({ kind: 'down' });
      return;
    }
    let cancelled = false;
    const ping = async () => {
      try {
        const response = await fetch(`${sidecarUrl}/health`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const body = (await response.json()) as { status?: string; model?: string };
        if (!cancelled && body.status === 'ok') {
          setHealth({ kind: 'ok', model: body.model ?? 'unknown' });
        } else if (!cancelled) {
          setHealth({ kind: 'down' });
        }
      } catch {
        if (!cancelled) setHealth({ kind: 'down' });
      }
    };
    void ping();
    return () => {
      cancelled = true;
    };
  }, [sidecarUrl]);

  const isDown = health.kind === 'down';

  return (
    <div
      className="card flex flex-wrap items-center gap-3 p-3"
      style={
        isDown
          ? {
              backgroundColor: 'oklch(from var(--color-warn) l c h / 0.1)',
              borderColor: 'oklch(from var(--color-warn) l c h / 0.4)',
            }
          : undefined
      }
    >
      <Server className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />
      <span className="text-xs text-[color:var(--color-text)]">
        Python sidecar{' '}
        <code className="rounded bg-[color:var(--color-surface-2)] px-1 font-mono">
          {sidecarUrl ?? 'NEXT_PUBLIC_PYTHON_SIDECAR_URL unset'}
        </code>{' '}
        —{' '}
        {health.kind === 'ok' ? (
          <>
            <span
              className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-success)]"
              aria-hidden
            />{' '}
            healthy · <span className="font-mono">{health.model}</span>
          </>
        ) : health.kind === 'pinging' ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 animate-pulse" aria-hidden /> checking…
          </span>
        ) : (
          <>
            <AlertOctagon className="inline h-3 w-3 text-[color:var(--color-warn)]" aria-hidden /> not detected — run <code className="font-mono">./apps/topout/dev.sh</code>
          </>
        )}
      </span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}
