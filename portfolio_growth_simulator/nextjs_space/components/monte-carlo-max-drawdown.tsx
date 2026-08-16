'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart3, ChevronDown, Clock3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { triggerHaptic } from '@/hooks/use-haptics'
import { formatCompactNumber } from '@/lib/utils'
import {
  summarizeDrawdownDurations,
  type DrawdownDurationPoint,
} from '@/lib/simulation/drawdown-analysis'

interface MonteCarloMaxDrawdownProps {
  data: number[] // max drawdown as fraction 0 to 1
  durationData?: DrawdownDurationPoint[]
  logScale: boolean
  onLogScaleChange: (val: boolean) => void
  enableAnimation?: boolean
}

const LOG_Y_FLOOR = 1

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null

  const binData = payload[0]?.payload
  const count = payload[0]?.value ?? 0
  const labelText = binData?.rangeLabel ?? ''

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground">Maximum drawdown</p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Drawdown range:</span>
          <span className="font-semibold text-foreground">{labelText}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#FFA500' }} />
            <span className="text-muted-foreground">Scenarios:</span>
          </div>
          <span className="font-semibold text-primary">{count}</span>
        </div>
      </div>
    </div>
  )
}

function formatDuration(years: number | null): string {
  if (years === null || !Number.isFinite(years)) return 'N/A'
  const totalMonths = Math.max(0, Math.round(years * 12))
  if (totalMonths === 0 && years > 0) return '< 1 month'
  if (totalMonths < 12) return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}`
  const wholeYears = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const yearText = `${wholeYears} ${wholeYears === 1 ? 'year' : 'years'}`
  return months ? `${yearText} ${months} ${months === 1 ? 'month' : 'months'}` : yearText
}

export function MonteCarloMaxDrawdownHistogram({
  data,
  durationData = [],
  logScale,
  onLogScaleChange,
  enableAnimation = true,
}: MonteCarloMaxDrawdownProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const durationSummary = useMemo(() => summarizeDrawdownDurations(durationData), [durationData])

  const histogramData = useMemo(() => {
    if (!data || data.length === 0) return []

    const percents = data.map((drawdown) => Math.min(Math.max(drawdown * 100, 0), 100))
    const min = 0
    const max = Math.max(...percents, 0)

    if (max === 0) {
      return [{ rangeStart: 0, rangeLabel: '0% - 5%', count: percents.length || 0 }]
    }

    const numBins = 20
    const binWidth = (max - min || 1) / numBins
    const bins = Array.from({ length: numBins }, (_, index) => {
      const start = min + index * binWidth
      const end = start + binWidth
      return {
        rangeStart: start,
        rangeLabel: `${Math.round(start)}% - ${Math.round(end)}%`,
        count: 0,
      }
    })

    percents.forEach((value) => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1)
      if (binIndex >= 0 && binIndex < numBins) bins[binIndex].count += 1
    })

    return bins.filter((bin) => bin.count > 0)
  }, [data])

  const handleLogScaleChange = (checked: boolean) => {
    triggerHaptic('light')
    onLogScaleChange(checked)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="print-chart-page"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              Maximum Drawdown Distribution
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-max-dd"
                checked={logScale}
                onCheckedChange={handleLogScaleChange}
                className="print:hidden"
              />
              <Label htmlFor="log-scale-max-dd" className="cursor-pointer text-sm print:hidden">Log scale</Label>
              {logScale && <span className="hidden text-xs font-medium text-muted-foreground print:inline">(Log scale enabled)</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <XAxis
                  dataKey="rangeLabel"
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                  label={{
                    value: 'Maximum drawdown range',
                    position: 'insideBottom',
                    offset: -15,
                    style: { textAnchor: 'middle', fontSize: 11, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' },
                  }}
                />
                <YAxis
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' }}
                  tickFormatter={(value) => formatCompactNumber(value)}
                  scale={logScale ? 'log' : 'linear'}
                  domain={logScale ? [LOG_Y_FLOOR, 'auto'] : [0, 'auto']}
                  allowDataOverflow={false}
                  label={{
                    value: 'Frequency',
                    angle: -90,
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fontSize: 11, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' },
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Bar
                  dataKey="count"
                  fill="#FFA500"
                  name="Number of scenarios"
                  radius={[4, 4, 0, 0]}
                  animationDuration={enableAnimation ? 500 : 0}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {durationSummary && (
            <details className="group rounded-xl border border-orange-500/20 bg-orange-500/5 print:open">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Clock3 className="h-4 w-4 text-orange-500" aria-hidden="true" />
                Drawdown Duration and Recovery
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180 print:hidden" aria-hidden="true" />
              </summary>
              <div className="space-y-3 border-t border-orange-500/15 p-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <DrawdownMetric label="Median Depth" value={`-${(durationSummary.medianDepth * 100).toFixed(1)}%`} />
                  <DrawdownMetric label="Median Duration" value={formatDuration(durationSummary.medianDuration)} />
                  <DrawdownMetric label="Median Recovery Time" value={formatDuration(durationSummary.medianRecoveryTime)} />
                  <DrawdownMetric label="Recovered by Horizon" value={`${durationSummary.recoveryRate.toFixed(1)}%`} />
                  <DrawdownMetric label="Longest Duration" value={formatDuration(durationSummary.longestDuration)} />
                  <DrawdownMetric label="Longest Recovery" value={formatDuration(durationSummary.longestRecoveryTime)} />
                  <DrawdownMetric label="Not Recovered" value={`${durationSummary.notRecoveredRate.toFixed(1)}%`} />
                  <DrawdownMetric label="Scenarios" value={durationSummary.scenarioCount.toLocaleString()} />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Duration runs from the peak before each scenario&apos;s worst cashflow-neutral market decline until recovery to that peak. If recovery never occurs, duration runs through the simulation horizon. Contributions and withdrawals are excluded from the return path.
                </p>
              </div>
            </details>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Shows the worst peak-to-trough investment decline in each scenario. Expand the recovery section to see whether those declines were brief setbacks or long periods below the prior peak.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function DrawdownMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-background/70 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-orange-700 dark:text-orange-300 sm:text-base">{value}</p>
    </div>
  )
}
