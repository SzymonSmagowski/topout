/**
 * Stub for @convex/_generated/dataModel.
 * In production this is code-generated from convex/schema.ts.
 * Tests use this stub so the Id<T> branded type is available without a real backend.
 */

// Opaque branded type that mirrors the real generated Id<T>.
export type Id<T extends string> = string & { readonly __tableName: T };

// Doc<T> mirrors the Convex-generated document type.
// For tests we only need the bare minimum fields components actually read.
export type Doc<T extends string> = {
  readonly _id: Id<T>;
  readonly _creationTime: number;
  // Allow extra props so fixtures can add table-specific fields.
  readonly [key: string]: unknown;
};

// Helper to cast a plain string to a typed Id in test fixtures.
export function testId<T extends string>(table: T, value: string): Id<T> {
  return value as Id<T>;
}
