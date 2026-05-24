'use client';

import { Activity, Flame, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';
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

import { gradeStyle } from '@/lib/grade-colors';
import type { VGrade } from '@/lib/grades';
import type { UserId } from '@/lib/ids';

import {
  GRADE_DIST_30D,
  SAM_GRADE_DIST,
  SAM_SEND_PYRAMID,
  SEND_PYRAMID_30D,
  SEND_RATE_TREND,
  USER_ME,
  USER_SAM,
  WEEKLY_VOLUME_30D,
  type GradeDistRow,
  type SendPyramidRow,
} from '../_data/mock';

const WINDOWS = ['7d', '30d', '90d', 'all'] as const;
type Window = (typeof WINDOWS)[number];

interface DashboardProps {
  readonly userId: UserId;
  readonly variant?: 'default' | 'partner';
}

/**
 * The same `Dashboard({ userId })` component used at /dashboard and at
 * /partners/[userId]. In production, every query passes `userId` and Convex
 * does the `requireFollowing` check for partner views. Here we just swap mock
 * datasets based on which user is passed.
 */
export function Dashboard({ userId, variant = 'default' }: DashboardProps) {
  const [win, setWin] = useState<Window>('30d');

  const isSam = userId === USER_SAM.id;
  const isMe = userId === USER_ME.id;

  const kpis = isSam ? KPI_SAM : KPI_ME;
  const sendPyramid = isSam ? SAM_SEND_PYRAMID : SEND_PYRAMID_30D;
  const gradeDist = isSam ? SAM_GRADE_DIST : GRADE_DIST_30D;
  const topGradeEverNote = isSam ? 'last sent 1 day ago' : 'last sent 1 day ago';

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          {variant === 'partner' && (
            <div className="section-eyebrow">partner · {USER_SAM.displayName}</div>
          )}
          <h3 className="mt-1 text-base font-semibold tracking-tight">
            {variant === 'partner' ? 'Sam Crusher’s training' : 'Your last 30 days'}
          </h3>
          {variant !== 'partner' && (
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Followed by Alex · Sam · updates in real time as you log new sessions.
            </p>
          )}
        </div>
        <div role="radiogroup" aria-label="Time window" className="pill-group">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={w === win}
              data-active={w === win}
              onClick={() => setWin(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile
          icon={<Activity className="h-4 w-4" aria-hidden />}
          label={`Sessions / ${win}`}
          value={kpis.sessions}
        />
        <KpiTile
          icon={<Flame className="h-4 w-4" aria-hidden />}
          label="Top grade ever"
          value={kpis.topGrade}
          mono
          sub={topGradeEverNote}
          accent
        />
        <KpiTile
          icon={<Target className="h-4 w-4" aria-hidden />}
          label={`Send rate / ${win}`}
          value={`${Math.round(kpis.sendRate * 100)}%`}
          sub={kpis.sendRateDelta >= 0 ? `+${Math.round(kpis.sendRateDelta * 100)} pts vs prev` : `${Math.round(kpis.sendRateDelta * 100)} pts vs prev`}
        />
        <KpiTile
          icon={<TrendingUp className="h-4 w-4" aria-hidden />}
          label={`Attempts / ${win}`}
          value={kpis.attempts.toString()}
        />
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Send pyramid"
          subtitle="Counts only flash · send · repeat. Sends per V-grade in window."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={sendPyramid as SendPyramidRow[]}
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
                  <Cell key={row.grade} fill={gradeStyle(row.grade as VGrade).fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Weekly volume"
          subtitle="Sessions and total attempts per ISO week in window."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={[...WEEKLY_VOLUME_30D]}
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
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={32}
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
          <Legend items={[
            { color: 'var(--color-sienna-500)', label: 'Sessions' },
            { color: 'var(--color-muted)', label: 'Attempts' },
          ]} />
        </ChartCard>

        <ChartCard
          title="Grade attempt distribution"
          subtitle="All outcomes — every attempt counted, by V-grade."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={gradeDist as GradeDistRow[]} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
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
              />
              <Tooltip content={<ThemedTooltip unit="attempts" />} cursor={{ fill: 'var(--color-surface-2)' }} />
              <Bar dataKey="attempts" radius={[6, 6, 0, 0]}>
                {gradeDist.map((row) => (
                  <Cell key={row.grade} fill={gradeStyle(row.grade as VGrade).fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Send rate trend"
          subtitle="Weekly send rate (sends ÷ all attempts) over 12 weeks. Dashed line marks 30-day baseline."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={[...SEND_RATE_TREND]} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
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
              <ReferenceLine
                y={kpis.sendRate}
                stroke="var(--color-muted)"
                strokeDasharray="4 4"
                label={{
                  value: 'baseline',
                  position: 'insideTopRight',
                  fill: 'var(--color-muted)',
                  fontSize: 10,
                }}
              />
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
        </ChartCard>
      </div>

      {variant !== 'partner' && isMe && (
        <p className="text-xs text-[color:var(--color-text-muted)]">
          All charts are Convex <code className="rounded bg-[color:var(--color-surface-2)] px-1 font-mono">useQuery</code> hooks — log a session in another tab and these update in under 500ms.
        </p>
      )}
    </section>
  );
}

const KPI_ME = {
  sessions: '12',
  topGrade: 'V5',
  sendRate: 0.6,
  sendRateDelta: 0.07,
  attempts: 114,
} as const;

const KPI_SAM = {
  sessions: '14',
  topGrade: 'V6',
  sendRate: 0.64,
  sendRateDelta: 0.04,
  attempts: 128,
} as const;

interface KpiTileProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly mono?: boolean;
  readonly accent?: boolean;
}

function KpiTile({ icon, label, value, sub, mono, accent }: KpiTileProps) {
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
      <div className={`mt-2 ${mono ? 'kpi-num' : 'kpi-num'}`}>{value}</div>
      {sub && (
        <div className="mt-1 text-xs text-[color:var(--color-text-muted)]">{sub}</div>
      )}
    </div>
  );
}

interface ChartCardProps {
  readonly title: string;
  readonly subtitle: string;
  readonly children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3">
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        <p className="text-xs text-[color:var(--color-text-muted)]">{subtitle}</p>
      </div>
      <div className="-mx-1">{children}</div>
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
