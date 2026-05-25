/**
 * Typed-error sugar. Every throw site that wants the UI to switch on `kind`
 * goes through this helper, so the payload shape is consistent and the
 * `ErrorKind` union in `lib/enums.ts` is the only list of valid kinds.
 *
 * Usage:
 *   throw typedError('not_authenticated');
 *   throw typedError('session_not_found', `No session ${sessionId}`);
 */
import { ConvexError, type Value } from 'convex/values';

import type { ErrorKind } from './enums';

// The index signature is required so `TypedErrorPayload` satisfies
// `ConvexError<T>`'s `T extends Value` constraint. `ErrorKind` is a string
// literal union (assignable to `string`, which is itself a `Value`).
export interface TypedErrorPayload {
  readonly kind: ErrorKind;
  readonly message?: string;
  readonly [key: string]: Value | undefined;
}

export function typedError(kind: ErrorKind, message?: string): ConvexError<TypedErrorPayload> {
  return new ConvexError<TypedErrorPayload>(
    message === undefined ? { kind } : { kind, message },
  );
}
