'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ShieldCheck } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CompletedSimulationResults } from '@/hooks/use-monte-carlo'

interface RetirementSurvivalChartProps {
  results: CompletedSimulationResults
  duration: number
  enableAnimation?: boolean
}

function formatYear(year: number | null | undefined): string {
  if (year === null || year === undefined || !Number.isFinite(year)) return 'Never'
  const rounded = Math.round(year * 10) / 10
  return Number.isInteger(rounded) ? `Year ${rounded}` : `Year ${rounded.toFixed(1)}`
}

function SurvivalTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const rate = Number(payload[0]?.value ?? 0)
  return (
    <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm shadow-lg">
      <p className="font-semibold text-foreground">{Number(label) <= 0 ? 'Start' : `Year ${Number(label).toFixed(Number(label) % 1 ? 1 : 0)}`}</p>
      <div className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Portfolio survival</span>
        <span className="font-bold text-emerald-600 dark:text-emerald-400">{rate.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export function RetirementSurvivalChart({
  results,
  duration,
  enableAnimation = true,
}: RetirementSurvivalChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const data = useMemo(() => {
    const source = results.solvencySeries ?? []
    if (!source.length) return []
    const ordered = [...source]
      .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.solventRate))
      .sort((left, right) => left.year - right.year)
      .map((point) => ({
        year: point.year,
        survival: Math.min(100, Math.max(0, point.solventRate)),
      }))
    if (!ordered.length) return []
    if (ordered[0].year > 0.001) ordered.unshift({ year: 0, survival: 100 })
    return ordered
  }, [results.solvencySeries])

  if (!data.length) return null

  const horizonYears = Math.max(1, Math.round(duration))
  const horizonSurvival = Math.min(100, Math.max(0, results.survivalRate ?? results.solventRate ?? 0))
  const neverDepleted = Math.min(100, Math.max(0, results.neverDepletedRate ?? horizonSurvival))

  return (
    <Card className="border-emerald-500/20 print-chart-page">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          Portfolio Survival Probability Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 28 }}>
              <defs>
                <linearGradient id="survivalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#27272a' : '#e4e4e7'} vertical={false} />
              <XAxis
                dataKey="year"
                type="number"
                domain={[0, 'dataMax']}
                tickLine={false}
                tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                tickFormatter={(value) => Number(value) <= 0 ? 'Start' : `Year ${Math.round(Number(value))}`}
                label={{ value: 'Retirement year', position: 'insideBottom', offset: -16, fontSize: 11 }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickLine={false}
                tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                tickFormatter={(value) => `${value}%`}
                width={42}
              />
              {[90, 80, 50].map((value) => (
                <ReferenceLine
                  key={value}
                  y={value}
                  stroke={value === 50 ? '#f59e0b' : '#64748b'}
                  strokeDasharray="5 5"
                  strokeOpacity={0.65}
                  label={{ value: `${value}%`, position: 'insideRight', fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
              ))}
              <Tooltip content={<SurvivalTooltip />} />
              <Area
                type="monotone"
                dataKey="survival"
                name="Portfolio survival"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#survivalFill)"
                dot={false}
                activeDot={{ r: 5 }}
                animationDuration={enableAnimation ? 500 : 0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <SurvivalMetric label={`${horizonYears}-Year Survival`} value={`${horizonSurvival.toFixed(1)}%`} />
          <SurvivalMetric label="Median Failure Year" value={formatYear(results.medianDepletionYear)} />
          <SurvivalMetric label="Never Depleted" value={`${neverDepleted.toFixed(1)}%`} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Shows the share of scenarios that successfully funded every requested withdrawal through each point in retirement. A falling curve reveals when plan risk begins to rise.
        </p>
      </CardContent>
    </Card>
  )
}

function SurvivalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-emerald-500/10 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-1 break-words text-base font-bold text-emerald-700 dark:text-emerald-300 sm:text-lg">{value}</p>
    </div>
  )
}
