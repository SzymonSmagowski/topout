'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Minimal accessible modal. Used by:
 *  - delete-session confirm
 *  - unfollow confirm
 *  - regenerate weekly-report confirm
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[oklch(0.18_0.012_50/0.42)]"
        onClick={onCancel}
      />
      <div
        className="card relative w-full max-w-md p-5 sm:p-6"
        style={{ boxShadow: 'var(--shadow-pop)' }}
      >
        <button
          type="button"
          aria-label="Close"
          className="btn btn-ghost absolute right-2 top-2 h-8 w-8 !px-0"
          onClick={onCancel}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-3">
          {destructive && (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'oklch(from var(--color-danger) l c h / 0.1)' }}
            >
              <AlertTriangle className="h-4 w-4 text-[color:var(--color-danger)]" aria-hidden />
            </div>
          )}
          <div className="flex-1">
            <h2 id="confirm-modal-title" className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{description}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={destructive ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
