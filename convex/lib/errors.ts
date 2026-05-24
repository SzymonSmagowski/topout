/**
 * Typed-error sugar. Every throw site that wants the UI to switch on `kind`
 * goes through this helper, so the payload shape is consistent and the
 * `ErrorKind` union in `lib/enums.ts` is the only list of valid kinds.
 *
 * Usage:
 *   throw typedError('not_authenticated');
 *   throw typedError('session_not_found', `No session ${sessionId}`);
 */
import { ConvexError } from 'convex/values';

import type { ErrorKind } from './enums';

export interface TypedErrorPayload {
  readonly kind: ErrorKind;
  readonly message?: string;
}

export function typedError(kind: ErrorKind, message?: string): ConvexError<TypedErrorPayload> {
  return new ConvexError<TypedErrorPayload>(
    message === undefined ? { kind } : { kind, message },
  );
}
