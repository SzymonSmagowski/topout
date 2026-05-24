'use client';

import { Activity, Flame, Target, TrendingUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { gradeStyle } from '@/lib/grade-colors';
import type { VGrade } from '@/lib/grades';
import { useAuthedQuery } from '@/lib/use-authed-query';

const WINDOWS = ['7d', '30d', '90d', 'all'] as const;
export type TimeWindow = (typeof WINDOWS)[number];

function isTimeWindow(v: string | null): v is TimeWindow {
  return v !== null && (WINDOWS as readonly string[]).includes(v);
}

interface DashboardProps {
  readonly userId: Id<'users'>;
  readonly variant?: 'default' | 'partner';
}

/**
 * The shared dashboard. Same component renders the viewer's own dashboard at
 * `/dashboard` and any followed partner's dashboard at `/partners/[userId]`.
 *
 * All five reactive queries take `{ userId, window }`. Convex enforces
 * `requireFollowing` server-side; we never duplicate the check here.
 *
 * Time-window state is URL-synced (`?window=30d`) so a partner-dashboard view
 * stays linkable.
 */
export function Dashboard({ userId, variant = 'default' }: DashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawWindow = searchParams?.get('window') ?? null;
  const win: TimeWindow = isTimeWindow(rawWindow) ? rawWindow : '30d';

  const setWindow = useCallback(
    (next: TimeWindow) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('window', next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const kpis = useAuthedQuery(api.dashboard.kpiStats, { userId, window: win });
  const sendPyramid = useAuthedQuery(api.dashboard.sendPyramid, { userId, window: win });
  const weeklyVolume = useAuthedQuery(api.dashboard.weeklyVolume, { userId, window: win });
  const gradeDist = useAuthedQuery(api.dashboard.gradeAttemptDist, { userId, window: win });
  const sendRateTrend = useAuthedQuery(api.dashboard.sendRateTrend, { userId, window: win });

  return (
    <section className="space-y-6" aria-label="Climbing dashboard">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {variant === 'partner' ? 'Their training' : 'Your training'}
          </h2>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            Reactive Convex queries — updates live as new sessions land.
          </p>
        </div>
        <div role="radiogroup" aria-label="Time window" className="pill-group">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={w === win}
              data-active={w === win}
              onClick={() => setWindow(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile
          icon={<Activity className="h-4 w-4" aria-hidden />}
          label={`Sessions / ${win}`}
          value={kpis ? kpis.sessionsCount.toString() : null}
        />
        <KpiTile
          icon={<Flame className="h-4 w-4" aria-hidden />}
          label="Top grade ever"
          value={kpis ? kpis.topGradeEver ?? '—' : null}
          sub={
            kpis?.topGradeEverDate
              ? `last sent ${relativeDate(kpis.topGradeEverDate)}`
              : kpis
                ? 'no sends yet'
                : undefined
          }
          accent
        />
        <KpiTile
          icon={<Target className="h-4 w-4" aria-hidden />}
          label={`Send rate / ${win}`}
          value={kpis ? `${Math.round(kpis.sendRate * 100)}%` : null}
        />
        <KpiTile
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          label={`Attempts / ${win}`}
          value={kpis ? kpis.totalAttempts.toString() : null}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Send pyramid"
          subtitle="Counts only flash · send · repeat. Sends per V-grade in window."
          aria-label="Send pyramid bar chart"
        >
          {sendPyramid === undefined ? (
            <ChartSkeleton />
          ) : sendPyramid.length === 0 ? (
            <ChartEmpty>No sends in this window yet.</ChartEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={[...sendPyramid].reverse() as { grade: VGrade; sends: number }[]}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                barCategoryGap={8}
              >
                <CartesianGrid horizontal={false} stroke="var(--color-hairline)" />
                <XAxis
                  type="number"
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-hairline)' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="grade"
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip content={<ThemedTooltip unit="sends" />} cursor={{ fill: 'var(--color-surface-2)' }} />
                <Bar dataKey="sends" radius={[0, 6, 6, 0]}>
                  {sendPyramid.map((row) => (
                    <Cell key={row.grade} fill={gradeStyle(row.grade).fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Weekly volume"
          subtitle="Sessions and total attempts per ISO week in window."
          aria-label="Weekly volume bar chart"
        >
          {weeklyVolume === undefined ? (
            <ChartSkeleton />
          ) : weeklyVolume.length === 0 ? (
            <ChartEmpty>No sessions in this window yet.</ChartEmpty>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={weeklyVolume.map((row) => ({
                    week: formatWeekTick(row.weekStart),
                    sessions: row.sessions,
                    attempts: row.attempts,
                  }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  barGap={4}
                >
                  <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                  <XAxis
                    dataKey="week"
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-hairline)' }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="var(--color-text-muted)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ThemedTooltip />} cursor={{ fill: 'var(--color-surface-2)' }} />
                  <Bar
                    yAxisId="left"
                    dataKey="sessions"
                    fill="var(--color-sienna-500)"
                    radius={[4, 4, 0, 0]}
                    name="Sessions"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="attempts"
                    fill="var(--color-muted)"
                    radius={[4, 4, 0, 0]}
                    name="Attempts"
                    opacity={0.65}
                  />
                </BarChart>
              </ResponsiveContainer>
              <Legend
                items={[
                  { color: 'var(--color-sienna-500)', label: 'Sessions' },
                  { color: 'var(--color-muted)', label: 'Attempts' },
                ]}
              />
            </>
          )}
        </ChartCard>

        <ChartCard
          title="Grade attempt distribution"
          subtitle="All outcomes — every attempt counted, by V-grade."
          aria-label="Grade attempt distribution bar chart"
        >
          {gradeDist === undefined ? (
            <ChartSkeleton />
          ) : gradeDist.length === 0 ? (
            <ChartEmpty>No attempts in this window yet.</ChartEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={gradeDist as { grade: VGrade; attempts: number }[]}
                margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis
                  dataKey="grade"
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-hairline)' }}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip content={<ThemedTooltip unit="attempts" />} cursor={{ fill: 'var(--color-surface-2)' }} />
                <Bar dataKey="attempts" radius={[6, 6, 0, 0]}>
                  {gradeDist.map((row) => (
                    <Cell key={row.grade} fill={gradeStyle(row.grade).fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Send rate trend"
          subtitle="Weekly send rate (sends ÷ all attempts). Dashed line marks 30-day baseline."
          aria-label="Send rate trend line chart"
        >
          {sendRateTrend === undefined ? (
            <ChartSkeleton />
          ) : sendRateTrend.length === 0 ? (
            <ChartEmpty>Not enough data for a trend yet.</ChartEmpty>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={sendRateTrend.map((row) => ({
                  week: formatWeekTick(row.weekStart),
                  rate: row.sendRate,
                  baseline: row.baselineSendRate,
                }))}
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                <XAxis
                  dataKey="week"
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-hairline)' }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  domain={[0, 1]}
                />
                <Tooltip
                  content={<ThemedTooltip valueFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />}
                  cursor={{ stroke: 'var(--color-hairline)' }}
                />
                {sendRateTrend[0] && (
                  <ReferenceLine
                    y={sendRateTrend[0].baselineSendRate}
                    stroke="var(--color-muted)"
                    strokeDasharray="4 4"
                    label={{
                      value: 'baseline',
                      position: 'insideTopRight',
                      fill: 'var(--color-muted)',
                      fontSize: 10,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--color-accent)' }}
                  activeDot={{ r: 5, fill: 'var(--color-accent)', stroke: 'var(--color-bg)', strokeWidth: 2 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </section>
  );
}

interface KpiTileProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | null;
  readonly sub?: string;
  readonly accent?: boolean;
}

function KpiTile({ icon, label, value, sub, accent }: KpiTileProps) {
  return (
    <div
      className="card relative overflow-hidden p-4 sm:p-5"
      style={
        accent
          ? {
              backgroundImage:
                'linear-gradient(135deg, oklch(from var(--color-accent) l c h / 0.08), transparent 70%)',
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
        {icon}
        <span className="text-[0.6875rem] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {value === null ? (
        <div className="mt-2 skeleton h-9 w-16" />
      ) : (
        <div className="mt-2 kpi-num">{value}</div>
      )}
      {sub && <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{sub}</div>}
    </div>
  );
}

interface ChartCardProps {
  readonly title: string;
  readonly subtitle: string;
  readonly 'aria-label': string;
  readonly children: React.ReactNode;
}

function ChartCard({ title, subtitle, 'aria-label': ariaLabel, children }: ChartCardProps) {
  return (
    <div className="card p-4 sm:p-5" aria-label={ariaLabel}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-xs text-[color:var(--color-text-muted)]">{subtitle}</p>
      </div>
      <div className="-mx-1">{children}</div>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="skeleton h-[260px] w-full" />;
}

function ChartEmpty({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-[color:var(--color-text-muted)]">
      {children}
    </div>
  );
}

function Legend({ items }: { readonly items: readonly { readonly color: string; readonly label: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-3 px-1">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: it.color }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

interface TooltipPayloadEntry {
  readonly name?: string;
  readonly value?: number | string;
  readonly color?: string;
  readonly dataKey?: string;
}

interface ThemedTooltipProps {
  readonly active?: boolean;
  readonly payload?: readonly TooltipPayloadEntry[];
  readonly label?: string | number;
  readonly unit?: string;
  readonly valueFormatter?: (v: number | string) => string;
}

function ThemedTooltip({ active, payload, label, unit, valueFormatter }: ThemedTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="card px-3 py-2 text-xs"
      style={{ boxShadow: 'var(--shadow-pop)', borderColor: 'var(--color-border)' }}
    >
      {label !== undefined && (
        <div className="mb-1 font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {String(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={`${p.dataKey ?? i}-${p.name ?? i}`} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: p.color ?? 'var(--color-accent)' }}
              aria-hidden
            />
            <span className="text-[color:var(--color-text-muted)]">{p.name ?? p.dataKey}</span>
            <span className="ml-auto font-mono tabular-nums text-[color:var(--color-text)]">
              {valueFormatter ? valueFormatter(p.value ?? 0) : p.value}
              {unit ? <span className="ml-1 text-[color:var(--color-text-muted)]">{unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatWeekTick(weekStart: number): string {
  return new Date(weekStart).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
