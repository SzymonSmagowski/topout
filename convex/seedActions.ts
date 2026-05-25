'use node';
/**
 * Deterministic seed orchestrator — the Node-runtime entry point invoked by
 * `pnpm seed` (`scripts/seed.ts`).
 *
 * High-level flow:
 *   1. assertNonProd      — refuse on prod-shaped deployments
 *   2. wipeSeedUsers      — idempotent reset of prior seed data
 *   3. ensureGyms         — 4 named gyms (find-or-create)
 *   4. createSeedUser × 2 — Alex Climber + Sam Crusher via the Password
 *      provider's createAccount helper (same code path as real signUp)
 *   5. generate session arcs — V3→V5 for Alex (84d), V4→V6 for Sam (84d)
 *   6. insertFollow × 2   — mutual follow
 *
 * @see docs/specs/topout/seed-data.md
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { internalAction } from './_generated/server';
import {
  V_GRADES,
  isSent,
  type Outcome,
  type VGrade,
} from './lib/enums';
import { startOfDayUtc } from './lib/time';
import { ATTEMPT_NOTE_POOL, SUMMARY_TEMPLATE_POOL } from './seed/notes';

// ---------------------------------------------------------------------------
// PRNG (LCG — Numerical Recipes). Deterministic, dependency-free, fine for
// content-generation determinism (not for crypto).
// ---------------------------------------------------------------------------

interface Rng {
  readonly nextFloat: () => number;
  readonly nextInt: (lo: number, hi: number) => number;
  readonly pick: <T>(arr: readonly T[]) => T;
  readonly chance: (p: number) => boolean;
}

function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) state = 0xdeadbeef;
  const nextU32 = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  const nextFloat = (): number => nextU32() / 0x100000000;
  const nextInt = (lo: number, hi: number): number =>
    lo + Math.floor(nextFloat() * (hi - lo + 1));
  return {
    nextFloat,
    nextInt,
    pick: <T,>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new Error('pick from empty');
      const item = arr[nextInt(0, arr.length - 1)];
      if (item === undefined) throw new Error('pick out of bounds');
      return item;
    },
    chance: (p: number): boolean => nextFloat() < p,
  };
}

// ---------------------------------------------------------------------------
// Session arc — generates one user's 84-day training arc.
// ---------------------------------------------------------------------------

interface ArcConfig {
  readonly startGrade: VGrade;   // e.g. V3
  readonly endGrade: VGrade;     // e.g. V5
  readonly weeks: number;        // 12
  readonly sessionsPerWeek: number; // 3 on average
}

interface PlannedAttempt {
  readonly grade: VGrade;
  readonly outcome: Outcome;
  readonly attemptCount: number;
  readonly notes: string | null;
}

interface PlannedSession {
  readonly date: number;
  readonly gymId: Id<'gyms'>;
  readonly perceivedEffort: number;
  readonly notes: string | null;
  readonly durationMinutes: number | undefined;
  readonly attempts: readonly PlannedAttempt[];
  readonly templatedSummary: string;
}

function ordinalAt(grade: VGrade): number {
  return V_GRADES.indexOf(grade);
}

function gradeAtOrdinal(idx: number): VGrade {
  const clamped = Math.max(0, Math.min(V_GRADES.length - 1, idx));
  const g = V_GRADES[clamped];
  if (g === undefined) throw new Error('grade ordinal out of bounds');
  return g;
}

function pickWarmupGrades(currentIdx: number): readonly VGrade[] {
  // V0..V2 below current; if current is low, just use VB..currentIdx-1
  const top = Math.max(0, currentIdx - 1);
  const grades: VGrade[] = [];
  for (let i = 0; i <= Math.min(top, 3); i += 1) {
    grades.push(gradeAtOrdinal(i));
  }
  return grades;
}

function pickOutcome(rng: Rng, tier: 'warmup' | 'current' | 'stretch', progressRatio: number): Outcome {
  // progressRatio in [0..1]: fraction of arc completed; stretch grade slowly
  // moves from "almost never" to "occasional send" as the user progresses.
  if (tier === 'warmup') {
    return rng.chance(0.9) ? 'flash' : 'repeat';
  }
  if (tier === 'current') {
    const r = rng.nextFloat();
    if (r < 0.35) return 'send';
    if (r < 0.55) return 'flash';
    if (r < 0.75) return 'repeat';
    if (r < 0.9) return 'project';
    return 'fall';
  }
  // stretch — improves over the arc
  const sendFloor = 0.05 + progressRatio * 0.2; // 5% → 25%
  const r = rng.nextFloat();
  if (r < sendFloor) return 'send';
  if (r < sendFloor + 0.1) return 'repeat';
  if (r < sendFloor + 0.55) return 'project';
  return 'fall';
}

function planArc(rng: Rng, cfg: ArcConfig, gymIds: readonly Id<'gyms'>[]): readonly PlannedSession[] {
  if (gymIds.length === 0) throw new Error('need at least one gym');
  const startIdx = ordinalAt(cfg.startGrade);
  const endIdx = ordinalAt(cfg.endGrade);
  const totalDays = cfg.weeks * 7;
  const today = startOfDayUtc(Date.now());
  const sessions: PlannedSession[] = [];

  for (let weekI = 0; weekI < cfg.weeks; weekI += 1) {
    // Realistic noise: occasional 2-session week (deload) or 4-session week (peak).
    const roll = rng.nextFloat();
    let nWeek = cfg.sessionsPerWeek;
    if (roll < 0.15) nWeek = Math.max(1, cfg.sessionsPerWeek - 1);
    else if (roll < 0.3) nWeek = cfg.sessionsPerWeek + 1;

    const progress = weekI / Math.max(1, cfg.weeks - 1);
    const currentIdx = Math.round(startIdx + (endIdx - startIdx) * progress);
    const stretchIdx = Math.min(endIdx + 1, currentIdx + 1);

    for (let inWeek = 0; inWeek < nWeek; inWeek += 1) {
      // Each session lives somewhere in the 7 days of this week, working
      // backward from "today". Week 0 = most recent week.
      const daysAgo = (cfg.weeks - 1 - weekI) * 7 + Math.floor(rng.nextFloat() * 7);
      if (daysAgo > totalDays - 1) continue;
      const date = today - daysAgo * 86_400_000;

      const gymId = gymIds[rng.nextInt(0, gymIds.length - 1)];
      if (gymId === undefined) throw new Error('gymId unexpectedly undefined');

      const warmups = pickWarmupGrades(currentIdx);
      const attempts: PlannedAttempt[] = [];

      for (const grade of warmups) {
        const outcome = pickOutcome(rng, 'warmup', progress);
        attempts.push({
          grade,
          outcome,
          attemptCount: rng.nextInt(1, 2),
          notes: rng.chance(0.2) ? rng.pick(ATTEMPT_NOTE_POOL) : null,
        });
      }
      const currentAttemptCount = rng.nextInt(3, 5);
      for (let i = 0; i < currentAttemptCount; i += 1) {
        const outcome = pickOutcome(rng, 'current', progress);
        attempts.push({
          grade: gradeAtOrdinal(currentIdx),
          outcome,
          attemptCount: rng.nextInt(1, 3),
          notes: rng.chance(0.4) ? rng.pick(ATTEMPT_NOTE_POOL) : null,
        });
      }
      const stretchAttemptCount = rng.nextInt(1, 3);
      for (let i = 0; i < stretchAttemptCount; i += 1) {
        const outcome = pickOutcome(rng, 'stretch', progress);
        attempts.push({
          grade: gradeAtOrdinal(stretchIdx),
          outcome,
          attemptCount: rng.nextInt(1, 4),
          notes: rng.chance(0.5) ? rng.pick(ATTEMPT_NOTE_POOL) : null,
        });
      }

      // Higher effort when there are stretch attempts that didn't go.
      const stretchFell = attempts.some(
        (a) => a.grade === gradeAtOrdinal(stretchIdx) && !isSent(a.outcome),
      );
      const baseEffort = stretchFell ? rng.nextInt(7, 9) : rng.nextInt(4, 7);

      const sessionNotes = rng.chance(0.3) ? rng.pick(ATTEMPT_NOTE_POOL) : null;
      const duration = rng.chance(0.6) ? rng.nextInt(60, 120) : undefined;

      sessions.push({
        date,
        gymId,
        perceivedEffort: baseEffort,
        notes: sessionNotes,
        durationMinutes: duration,
        attempts,
        templatedSummary: rng.pick(SUMMARY_TEMPLATE_POOL),
      });
    }
  }
  sessions.sort((a, b) => a.date - b.date);
  return sessions;
}

// ---------------------------------------------------------------------------
// Top-level seed action
// ---------------------------------------------------------------------------

const runArgs = v.object({
  rngSeed: v.optional(v.number()),
  users: v.optional(v.union(v.literal('alex'), v.literal('sam'), v.literal('all'))),
  insertFollows: v.optional(v.boolean()),
  reportsPerUser: v.optional(v.number()),
});

export interface SeedSummary {
  readonly deployment: string;
  readonly usersCreated: number;
  readonly reportsCreated: number;
  readonly sessionsCreated: number;
  readonly attemptsCreated: number;
  readonly gymsEnsured: number;
  readonly followsCreated: number;
  readonly durationMs: number;
}

const SEED_GYMS = [
  { name: 'The Climbing Hangar', city: 'London' },
  { name: 'Mile End Climbing Wall', city: 'London' },
  { name: 'Rope & Hold', city: 'Manchester' },
  { name: 'Boulder Brighton', city: 'Brighton' },
] as const;

const SEED_PASSWORD = 'seed-demo-pw';

interface SeedUserSpec {
  readonly key: 'alex' | 'sam';
  readonly email: string;
  readonly displayName: string;
  readonly arc: ArcConfig;
}

const SEED_USERS: readonly SeedUserSpec[] = [
  {
    key: 'alex',
    email: 'seed-alex@topout.local',
    displayName: 'Alex Climber',
    arc: { startGrade: 'V3', endGrade: 'V5', weeks: 12, sessionsPerWeek: 3 },
  },
  {
    key: 'sam',
    email: 'seed-sam@topout.local',
    displayName: 'Sam Crusher',
    arc: { startGrade: 'V4', endGrade: 'V6', weeks: 12, sessionsPerWeek: 3 },
  },
];

export const run = internalAction({
  args: runArgs,
  handler: async (ctx, args): Promise<SeedSummary> => {
    const t0 = Date.now();
    const rngSeed = args.rngSeed ?? 42;
    const usersFilter = args.users ?? 'all';
    const wantsFollows = args.insertFollows ?? true;

    // 1. Prod guard
    const { deployment } = await ctx.runQuery(internal.seed.assertNonProd, {});

    // 2. Wipe
    await ctx.runMutation(internal.seed.wipeSeedUsers, {});

    // 3. Ensure gyms
    const gymIds = await ctx.runMutation(internal.seed.ensureGyms, {
      gyms: SEED_GYMS.map((g) => ({ name: g.name, city: g.city })),
    });

    // 4. Create users + arcs
    const targetUsers = SEED_USERS.filter((u) => usersFilter === 'all' || u.key === usersFilter);
    const createdUserIds: Id<'users'>[] = [];
    let sessionsCreated = 0;
    let attemptsCreated = 0;

    let perUserSeed = rngSeed;
    for (const spec of targetUsers) {
      const { userId } = await ctx.runMutation(internal.seed.createSeedUserMutation, {
        email: spec.email,
        password: SEED_PASSWORD,
        displayName: spec.displayName,
      });
      createdUserIds.push(userId);

      const rng = makeRng(perUserSeed);
      perUserSeed = (perUserSeed * 31 + 7) >>> 0; // deterministic offset between users
      const plan = planArc(rng, spec.arc, gymIds);

      for (const s of plan) {
        await ctx.runMutation(internal.sessions.seedInsert, {
          userId,
          date: s.date,
          gymId: s.gymId,
          perceivedEffort: s.perceivedEffort,
          notes: s.notes ?? undefined,
          durationMinutes: s.durationMinutes,
          attempts: s.attempts.map((a) => ({
            grade: a.grade,
            outcome: a.outcome,
            attemptCount: a.attemptCount,
            notes: a.notes ?? undefined,
          })),
          templatedSummary: s.templatedSummary,
        });
        sessionsCreated += 1;
        attemptsCreated += s.attempts.length;
      }
    }

    // 5. Mutual follows
    let followsCreated = 0;
    if (wantsFollows && createdUserIds.length >= 2) {
      const a = createdUserIds[0];
      const b = createdUserIds[1];
      if (a !== undefined && b !== undefined) {
        await ctx.runMutation(internal.seed.insertFollow, { followerId: a, followeeId: b });
        await ctx.runMutation(internal.seed.insertFollow, { followerId: b, followeeId: a });
        followsCreated = 2;
      }
    }

    // 6. Mock weekly reports (opt-in via --reports N).
    let reportsCreated = 0;
    const reportsPerUser = args.reportsPerUser ?? 0;
    if (reportsPerUser > 0) {
      for (let i = 0; i < targetUsers.length; i += 1) {
        const spec = targetUsers[i];
        const userId = createdUserIds[i];
        if (spec === undefined || userId === undefined) continue;
        const { reportsCreated: n } = await ctx.runMutation(internal.seed.insertMockReports, {
          userId,
          displayName: spec.displayName,
          weeksCount: reportsPerUser,
        });
        reportsCreated += n;
      }
    }

    return {
      deployment,
      usersCreated: createdUserIds.length,
      reportsCreated,
      sessionsCreated,
      attemptsCreated,
      gymsEnsured: gymIds.length,
      followsCreated,
      durationMs: Date.now() - t0,
    };
  },
});
