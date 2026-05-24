/**
 * Branded ID types for the preview.
 *
 * Mirrors Convex's `Id<'tableName'>` branded type so the preview's mock data
 * and the production Convex client share the same call-site ergonomics. When
 * `/build` wires up Convex, `Id<T>` here will be re-exported from
 * `convex/_generated/dataModel` and this module deletes.
 */
declare const __brand: unique symbol;
export type Id<T extends string> = string & { readonly [__brand]: T };

/** Test-only: cast a known-good string literal into a branded id. */
export function asId<T extends string>(table: T, raw: string): Id<T> {
  // table is captured for typing only; the runtime is a plain string.
  void table;
  return raw as Id<T>;
}

export type UserId = Id<'users'>;
export type SessionId = Id<'sessions'>;
export type AttemptId = Id<'attempts'>;
export type GymId = Id<'gyms'>;
export type ReportId = Id<'weeklyReports'>;
