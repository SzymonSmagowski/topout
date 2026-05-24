'use node';
/**
 * Per-session AI coach blurb — Node-runtime internal action.
 *
 * Thin HTTP relay to the Python sidecar's `/summarize-session` endpoint.
 * The Convex side never imports the OpenAI SDK; the sidecar is the single
 * LLM gateway for the entire app (both summarize + weekly-report).
 *
 * Idempotent: no-ops on `summaryStatus === 'ok'` so the double-fire
 * schedule race is safe. On any sidecar failure the row is patched to
 * `status='err'` with a truncated error message — never leaves 'pending'.
 *
 * @see apps/topout/docs/architecture.md §5.5
 * @see apps/topout/sidecar/src/routes/summarize_session.py
 */

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { internalAction } from './_generated/server';
import { typedError } from './lib/errors';

const MAX_SUMMARY_CHARS = 240;
const MAX_ERROR_CHARS = 200;
const SIDECAR_TIMEOUT_MS = 30_000;

interface SidecarSession {
  readonly date: number;
  readonly perceived_effort: number;
  readonly duration_minutes: number | null;
  readonly notes: string | null;
}

interface SidecarAttempt {
  readonly grade: Doc<'attempts'>['grade'];
  readonly outcome: Doc<'attempts'>['outcome'];
  readonly attempt_count: number;
  readonly notes: string | null;
}

interface SidecarBaseline {
  readonly window_days: number;
  readonly sessions_count: number;
  readonly send_rate: number;
  readonly top_grade: Doc<'attempts'>['grade'] | null;
  readonly total_attempts: number;
}

interface SidecarRequest {
  readonly session_id: string;
  readonly user_id: string;
  readonly session: SidecarSession;
  readonly attempts: readonly SidecarAttempt[];
  readonly baseline: SidecarBaseline;
  readonly max_output_chars: number;
}

interface SidecarUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly model: string;
  readonly duration_ms: number;
}

interface SidecarResponse {
  readonly text: string;
  readonly usage: SidecarUsage;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd();
}

type RelayOk = { readonly kind: 'ok'; readonly text: string; readonly usage: SidecarUsage };
type RelayErr = { readonly kind: 'err'; readonly error: string };
type RelayResult = RelayOk | RelayErr;

async function callSidecar(body: SidecarRequest): Promise<RelayResult> {
  const sidecarUrl = process.env.PYTHON_SIDECAR_URL;
  const sidecarSecret = process.env.SIDECAR_SECRET;
  if (sidecarUrl === undefined || sidecarUrl === '') {
    throw typedError('sidecar_unreachable', 'PYTHON_SIDECAR_URL not set');
  }
  if (sidecarSecret === undefined || sidecarSecret === '') {
    throw typedError('sidecar_unauthorized', 'SIDECAR_SECRET not set');
  }

  const url = `${sidecarUrl}/summarize-session`;
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sidecarSecret}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SIDECAR_TIMEOUT_MS),
  };

  // Single retry on transport / 5xx; never retry on 4xx.
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status === 401) {
        return { kind: 'err', error: 'sidecar rejected bearer token (401)' };
      }
      if (response.status >= 400 && response.status < 500) {
        let body4xx = `sidecar HTTP ${response.status}`;
        try {
          const parsed = (await response.json()) as { error?: string };
          if (typeof parsed.error === 'string') body4xx = parsed.error;
        } catch {
          /* keep status-line message */
        }
        return { kind: 'err', error: body4xx };
      }
      if (!response.ok) {
        // 5xx — retry once
        lastError = `sidecar HTTP ${response.status}`;
        try {
          const parsed = (await response.json()) as { error?: string };
          if (typeof parsed.error === 'string') lastError = parsed.error;
        } catch {
          /* keep status-line message */
        }
        continue;
      }
      const payload = (await response.json()) as SidecarResponse;
      return { kind: 'ok', text: payload.text, usage: payload.usage };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { kind: 'err', error: lastError || 'sidecar unreachable' };
}

export const run = internalAction({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }): Promise<null> => {
    const session = await ctx.runQuery(internal.sessions.getInternal, { sessionId });
    if (session === null) {
      console.log('[summarize.run] session vanished', { sessionId });
      return null;
    }
    if (session.summaryStatus === 'ok') {
      // Idempotent guard for the double-fire schedule race.
      return null;
    }

    const attempts = await ctx.runQuery(internal.attempts.listBySession, { sessionId });
    const baseline = await ctx.runQuery(internal.dashboard.baselineInternal, {
      userId: session.userId,
      windowDays: 30,
    });

    const body: SidecarRequest = {
      session_id: sessionId as unknown as string,
      user_id: session.userId as unknown as string,
      session: {
        date: session.date,
        perceived_effort: session.perceivedEffort,
        duration_minutes: session.durationMinutes ?? null,
        notes: session.notes ?? null,
      },
      attempts: attempts.map((a) => ({
        grade: a.grade,
        outcome: a.outcome,
        attempt_count: a.attemptCount,
        notes: a.notes ?? null,
      })),
      baseline: {
        window_days: baseline.windowDays,
        sessions_count: baseline.sessionsCount,
        send_rate: baseline.sendRate,
        top_grade: baseline.topGrade,
        total_attempts: baseline.totalAttempts,
      },
      max_output_chars: MAX_SUMMARY_CHARS,
    };

    const result = await callSidecar(body);

    if (result.kind === 'ok') {
      await ctx.runMutation(internal.sessions.patchSummary, {
        sessionId,
        summary: truncate(result.text, MAX_SUMMARY_CHARS),
        status: 'ok',
        error: null,
      });
      console.log('[summarize.run]', {
        sessionId,
        durationMs: result.usage.duration_ms,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        model: result.usage.model,
      });
    } else {
      await ctx.runMutation(internal.sessions.patchSummary, {
        sessionId,
        summary: null,
        status: 'err',
        error: truncate(result.error, MAX_ERROR_CHARS),
      });
      console.log('[summarize.run] error', { sessionId, error: result.error });
    }
    return null;
  },
});
