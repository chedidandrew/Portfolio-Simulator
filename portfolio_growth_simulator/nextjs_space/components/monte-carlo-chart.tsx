'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartSpline } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { triggerHaptic } from '@/hooks/use-haptics'

interface MonteCarloChartProps {
  data: any[]
  mode: 'growth' | 'withdrawal'
  logScale: boolean
  onLogScaleChange: (val: boolean) => void
  enableAnimation?: boolean
}

const PERCENTILE_LABELS: Record<string, string> = {
  p90: '90th percentile',
  p75: '75th percentile',
  p50: '50th percentile (median)',
  p25: '25th percentile',
  p10: '10th percentile',
}

const PERCENTILE_COLORS: Record<string, string> = {
  p90: 'hsl(250, 70%, 60%)',
  p75: 'hsl(200, 75%, 55%)',
  p50: 'hsl(165, 65%, 48%)',
  p25: 'hsl(180, 70%, 55%)',
  p10: 'hsl(30, 85%, 60%)',
}

interface TooltipProps {
  active?: boolean
  payload?: any[]
  label?: number
  mode: 'growth' | 'withdrawal'
}

/* ------------------------------------------------------------------ */
/* Shared Helpers (Aligned with Analytics)                            */
/* ------------------------------------------------------------------ */

const formatTooltipLabel = (label: number) => {
  if (!label || label <= 0) return 'Month 1'
  
  const years = Math.floor(label)
  const fraction = label - years
  const months = Math.round(fraction * 12)
  
  // 1. Exact Month Boundary
  if (Math.abs(fraction * 12 - months) < 0.001) {
    if (months === 0) return `Year ${years}`
    
    // Shift display month by +1 so 0.08 -> Month 2
    const displayMonth = months + 1
    if (displayMonth > 12) return `Year ${years + 1}`

    if (years === 0) return `Month ${displayMonth}`
    return `Year ${years}, Month ${displayMonth}`
  }

  // 2. Weekly Interval
  const totalWeeks = Math.round(label * 52)
  const weekOfYear = totalWeeks % 52
  
  // Estimate current month (1-12)
  const weeksPerMonth = 52 / 12
  let month = Math.ceil(weekOfYear / weeksPerMonth)
  
  // Adjust month index
  if (month === 0) month = 1
  if (month > 12) month = 12

  // Determine Week of that Month
  const weeksInPriorMonths = Math.round((month - 1) * weeksPerMonth)
  let weekInMonth = weekOfYear - weeksInPriorMonths
  if (weekInMonth < 1) weekInMonth = 1

  if (years === 0) {
    return `Month ${month}, Week ${weekInMonth}`
  }
  
  return `Year ${years}, Month ${month}, Week ${weekInMonth}`
}

const CustomTooltip = ({ active, payload, label, mode }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null

  const point = payload[0].payload
  const timeLabel = formatTooltipLabel(label ?? 0)

  const rows = [
    { key: 'p90', value: point.p90 },
    { key: 'p75', value: point.p75 },
    { key: 'p50', value: point.p50 },
    { key: 'p25', value: point.p25 },
    { key: 'p10', value: point.p10 },
  ]

  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md text-xs space-y-1">
      <div className="font-semibold">{timeLabel}</div>
      <div className="text-muted-foreground">
        {mode === 'growth' ? 'Projected portfolio value' : 'Projected remaining balance'}
      </div>
      <div className="mt-1 space-y-1">
        {rows.map(({ key, value }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PERCENTILE_COLORS[key] }} />
              <span>{PERCENTILE_LABELS[key]}</span>
            </div>
            <span className="font-semibold">{formatCurrency(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const LOG_FLOOR = 1
function logSafe(value: number): number {
  if (!Number.isFinite(value)) return LOG_FLOOR
  return value > LOG_FLOOR ? value : LOG_FLOOR
}

export function MonteCarloChart({ data, mode, logScale, onLogScaleChange, enableAnimation = true }: MonteCarloChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const maxYear = useMemo(() => {
    if (!data || data.length === 0) return 0
    return data[data.length - 1].year
  }, [data])

  /* ------------------------------------------------------------------ */
  /* Smart Ticks Logic                                                  */
  /* ------------------------------------------------------------------ */

  const customTicks = useMemo(() => {
    if (!maxYear) return [0]
    
    // Case 1: Very Short (<= 0.5 years / 6 months) -> Weekly ticks
    if (maxYear <= 0.5) {
      const totalWeeks = Math.ceil(maxYear * 52)
      return Array.from({ length: totalWeeks + 1 }, (_, i) => i / 52)
    }

    // Case 2: Short Duration (<= 3 years) -> Monthly ticks
    if (maxYear <= 3) {
      const totalMonths = Math.ceil(maxYear * 12)
      return Array.from({ length: totalMonths + 1 }, (_, i) => i / 12)
    }

    // Case 3: Smart Interval
    const targetTickCount = 15
    const rawInterval = maxYear / targetTickCount
    
    // Snap to "nice" intervals (1, 2, 4, 5, 10, 20, 25, 50, 100)
    const niceIntervals = [1, 2, 4, 5, 10, 20, 25, 50, 100]
    const interval = niceIntervals.find(i => i >= rawInterval) || niceIntervals[niceIntervals.length - 1]

    const ticks = []
    for (let i = 0; i <= maxYear; i += interval) {
      ticks.push(i)
    }
    if (maxYear - ticks[ticks.length - 1] > interval * 0.5) {
      ticks.push(maxYear)
    }
    
    // Filter out 0 (Start) to match analytics style if desired, 
    // though usually main chart keeps Start. Let's keep Start for main chart context.
    return ticks
  }, [maxYear])

  const formatXAxis = (value: number) => {
    if (value === 0) return 'Month 1'
    const isInteger = Math.abs(value % 1) < 0.001

    if (maxYear <= 0.5) {
      const weeks = Math.round(value * 52)
      return `Week ${weeks}`
    }

    if (maxYear <= 3) {
      if (isInteger) return `Year ${Math.round(value)}`
      const years = Math.floor(value)
      const months = Math.round((value - years) * 12)
      
      // Shift month logic for axis labels too
      const displayMonth = months + 1
      if (displayMonth > 12) return `Year ${years + 1}`

      if (years === 0) return `Month ${displayMonth}`
      return `Yr ${years} M ${displayMonth}`
    }

    if (!isInteger) return ''
    return `Year ${value}`
  }

  const chartData = useMemo(
    () =>
      logScale
        ? data.map(point => ({
            ...point,
            p90: logSafe(point.p90),
            p75: logSafe(point.p75),
            p50: logSafe(point.p50),
            p25: logSafe(point.p25),
            p10: logSafe(point.p10),
          }))
        : data,
    [data, logScale],
  )

  const handleLogScaleChange = (checked: boolean) => { 
    triggerHaptic('light'); 
    onLogScaleChange(checked); 
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="print-chart-page"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <ChartSpline className="h-5 w-5" style={{ color: 'hsl(165, 65%, 48%)' }} />
              Scenario Paths with Percentile Bands
            </CardTitle>

            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-montecarlo"
                checked={logScale}
                onCheckedChange={handleLogScaleChange}
                className="print:hidden"
              />
              <Label htmlFor="log-scale-montecarlo" className="text-sm cursor-pointer print:hidden">
                Log scale
              </Label>
              {logScale && (
                <span className="hidden print:inline text-xs text-muted-foreground font-medium">
                  (Log scale enabled)
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 35 }}>
                <XAxis
                  dataKey="year"
                  type="number"
                  domain={[0, 'dataMax']}
                  ticks={customTicks}
                  tickLine={false}
                  axisLine={{ stroke: isDark ? 'hsl(240, 3.7%, 15.9%)' : 'hsl(214, 32%, 91%)' }}
                  tick={{
                    fontSize: 11,
                    angle: -45,
                    textAnchor: 'end',
                    dy: 10,
                    fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)',
                  } as any}
                  height={60} 
                  tickFormatter={formatXAxis}
                  interval={0}
                  minTickGap={1}
                  label={{
                    value: 'Time',
                    position: 'insideBottom',
                    offset: -5,
                    style: {
                      textAnchor: 'middle',
                      fontSize: 11,
                      fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)',
                    },
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: isDark ? 'hsl(240, 3.7%, 15.9%)' : 'hsl(214, 32%, 91%)' }}
                  tick={{ fontSize: 11, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' }}
                  scale={logScale ? 'log' : 'linear'}
                  domain={logScale ? ['auto', 'auto'] : [0, 'auto']}
                  tickFormatter={(val) => formatCurrency(val, true, 1)}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} mode={mode} />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} formatter={(value: string) => PERCENTILE_LABELS[value] ?? value} />

                <Line type="monotone" dataKey="p90" stroke={PERCENTILE_COLORS.p90} strokeWidth={2} dot={false} name="p90" animationDuration={enableAnimation ? 500 : 0} />
                <Line type="monotone" dataKey="p75" stroke={PERCENTILE_COLORS.p75} strokeWidth={2} dot={false} name="p75" animationDuration={enableAnimation ? 400 : 0} />
                <Line type="monotone" dataKey="p50" stroke={PERCENTILE_COLORS.p50} strokeWidth={3} dot={false} name="p50" animationDuration={enableAnimation ? 300 : 0} />
                <Line type="monotone" dataKey="p25" stroke={PERCENTILE_COLORS.p25} strokeWidth={2} dot={false} name="p25" animationDuration={enableAnimation ? 200 : 0} />
                <Line type="monotone" dataKey="p10" stroke={PERCENTILE_COLORS.p10} strokeWidth={2} dot={false} name="p10" animationDuration={enableAnimation ? 100 : 0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the range of possible portfolio values using up to 100,000 simulated market outcomes, from optimistic to pessimistic scenarios.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}