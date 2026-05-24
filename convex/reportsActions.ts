'use node';
/**
 * Weekly reports — Node-runtime action that POSTs the request payload to the
 * Python LangGraph sidecar. Separate file because `'use node';` would force
 * the entire module into the Node isolate; queries can only run in the
 * default V8 runtime.
 *
 * @see apps/topout/docs/architecture.md §5.6
 * @see apps/topout/docs/architecture.md §6 (sidecar HTTP contract)
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { action } from './_generated/server';
import { requireUser } from './lib/auth';
import { typedError } from './lib/errors';
import type { SessionWithAttemptsRow } from './reports';

const SEVEN_DAYS_MS = 7 * 86_400_000;
const MAX_ERROR_CHARS = 500;

// ---------------------------------------------------------------------------
// Wire shape — mirror of `sidecar/src/schemas.py::WeeklyReportRequest`.
// ---------------------------------------------------------------------------

interface SidecarAttempt {
  readonly grade: Doc<'attempts'>['grade'];
  readonly outcome: Doc<'attempts'>['outcome'];
  readonly attempt_count: number;
  readonly notes: string | null;
}

interface SidecarSession {
  readonly session_id: string;
  readonly date: number;
  readonly gym: { readonly name: string };
  readonly perceived_effort: number;
  readonly duration_minutes: number | null;
  readonly notes: string | null;
  readonly attempts: readonly SidecarAttempt[];
}

interface SidecarBaseline {
  readonly window_days: number;
  readonly sessions_count: number;
  readonly send_rate: number;
  readonly top_grade: Doc<'attempts'>['grade'] | null;
  readonly total_attempts: number;
}

interface SidecarUserMeta {
  readonly display_name: string;
  readonly user_id: string;
}

interface SidecarRequest {
  readonly week_start: number;
  readonly week_end: number;
  readonly user: SidecarUserMeta;
  readonly baseline: SidecarBaseline;
  readonly sessions: readonly SidecarSession[];
}

interface SidecarResponseStats {
  readonly sends_count: number;
  readonly top_grade: Doc<'attempts'>['grade'] | null;
  readonly send_rate: number;
  readonly total_attempts: number;
  readonly gyms_visited: number;
  readonly longest_send_streak: number;
  readonly send_rate_delta_prev_week: number;
  readonly send_rate_delta_baseline: number;
  readonly top_grade_delta: number;
}

interface SidecarResponse {
  readonly narrative_md: string;
  readonly stats: SidecarResponseStats;
  readonly model: string;
  readonly duration_ms: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
}

function buildSidecarRequest(
  weekStart: number,
  weekEnd: number,
  user: { displayName: string; userId: Id<'users'> },
  baseline: {
    readonly windowDays: number;
    readonly sessionsCount: number;
    readonly sendRate: number;
    readonly topGrade: Doc<'attempts'>['grade'] | null;
    readonly totalAttempts: number;
  },
  sessions: readonly SessionWithAttemptsRow[],
): SidecarRequest {
  return {
    week_start: weekStart,
    week_end: weekEnd,
    user: {
      display_name: user.displayName,
      user_id: user.userId as unknown as string,
    },
    baseline: {
      window_days: baseline.windowDays,
      sessions_count: baseline.sessionsCount,
      send_rate: baseline.sendRate,
      top_grade: baseline.topGrade,
      total_attempts: baseline.totalAttempts,
    },
    sessions: sessions.map((s) => ({
      session_id: s.sessionId as unknown as string,
      date: s.date,
      gym: { name: s.gym.name },
      perceived_effort: s.perceivedEffort,
      duration_minutes: s.durationMinutes,
      notes: s.notes,
      attempts: s.attempts.map((a) => ({
        grade: a.grade,
        outcome: a.outcome,
        attempt_count: a.attemptCount,
        notes: a.notes,
      })),
    })),
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max);
}

export const generateReport = action({
  args: { weekStart: v.number() },
  handler: async (ctx, { weekStart }): Promise<{ reportId: Id<'weeklyReports'> }> => {
    const userId = await requireUser(ctx);
    const weekEnd = weekStart + SEVEN_DAYS_MS - 1;

    const { reportId } = await ctx.runMutation(internal.reports.upsertPending, {
      userId,
      weekStart,
      weekEnd,
    });

    try {
      const user = await ctx.runQuery(internal.reports.loadUserInternal, { userId });
      if (user === null) {
        throw new Error('user disappeared mid-generation');
      }
      const sessions = await ctx.runQuery(internal.reports.loadWeekInternal, {
        userId,
        weekStart,
        weekEnd,
      });
      const baseline = await ctx.runQuery(internal.dashboard.baselineInternal, {
        userId,
        windowDays: 30,
      });

      const sidecarUrl = process.env.PYTHON_SIDECAR_URL;
      const sidecarSecret = process.env.SIDECAR_SECRET;
      if (sidecarUrl === undefined || sidecarUrl === '') {
        throw typedError('sidecar_unreachable', 'PYTHON_SIDECAR_URL not set');
      }
      if (sidecarSecret === undefined || sidecarSecret === '') {
        throw typedError('sidecar_unauthorized', 'SIDECAR_SECRET not set');
      }

      const body: SidecarRequest = buildSidecarRequest(
        weekStart,
        weekEnd,
        user,
        baseline,
        sessions,
      );

      const response = await fetch(`${sidecarUrl}/weekly-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sidecarSecret}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        await ctx.runMutation(internal.reports.patchResult, {
          reportId,
          status: 'err',
          narrativeMd: null,
          statsJson: null,
          model: null,
          generatedAt: null,
          error: 'sidecar rejected bearer token (401)',
        });
        return { reportId };
      }
      if (!response.ok) {
        let errText = `sidecar HTTP ${response.status}`;
        try {
          const parsed = (await response.json()) as { error?: string };
          if (typeof parsed.error === 'string') errText = parsed.error;
        } catch {
          // body wasn't JSON; keep status-code message
        }
        await ctx.runMutation(internal.reports.patchResult, {
          reportId,
          status: 'err',
          narrativeMd: null,
          statsJson: null,
          model: null,
          generatedAt: null,
          error: truncate(errText, MAX_ERROR_CHARS),
        });
        return { reportId };
      }

      const payload = (await response.json()) as SidecarResponse;
      await ctx.runMutation(internal.reports.patchResult, {
        reportId,
        status: 'ok',
        narrativeMd: payload.narrative_md,
        statsJson: JSON.stringify(payload.stats),
        model: payload.model,
        generatedAt: Date.now(),
        error: null,
      });
      console.log('[reports.generateReport]', {
        reportId,
        userId,
        durationMs: payload.duration_ms,
        inputTokens: payload.input_tokens,
        outputTokens: payload.output_tokens,
        model: payload.model,
      });
      return { reportId };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.reports.patchResult, {
        reportId,
        status: 'err',
        narrativeMd: null,
        statsJson: null,
        model: null,
        generatedAt: null,
        error: truncate(message, MAX_ERROR_CHARS),
      });
      return { reportId };
    }
  },
});
