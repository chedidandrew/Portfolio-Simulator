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

const CustomTooltip = ({ active, payload, label, mode }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null

  const point = payload[0].payload
  let timeLabel = 'Start'

  if (label && label > 0) {
    const years = Math.floor(label)
    const months = Math.round((label - years) * 12)
    
    if (years === 0) timeLabel = `Month ${months}`
    else if (months === 0) timeLabel = `Year ${years}`
    else timeLabel = `Year ${years}, Month ${months}`
  }

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

  // 1. Determine max year
  const maxYear = useMemo(() => {
    if (!data || data.length === 0) return 0
    return data[data.length - 1].year
  }, [data])

  const showMonthlyLabels = maxYear <= 2

  // 2. SMART TICK GENERATOR
  // Dynamically determines ticks based on total duration to prevent crowding
  const customTicks = useMemo(() => {
    if (!maxYear) return [0]
    
    // Case 1: Short duration (Month by month)
    if (showMonthlyLabels) {
      const totalMonths = Math.ceil(maxYear * 12)
      return Array.from({ length: totalMonths + 1 }, (_, i) => i / 12)
    }

    // Case 2: Standard or Long duration
    // Goal: Show ~12-15 ticks total.
    const targetTickCount = 15
    const rawInterval = maxYear / targetTickCount
    
    // Snap to "nice" intervals (1, 2, 4, 5, 10, 20, 25, 50, 100)
    const niceIntervals = [1, 2, 4, 5, 10, 20, 25, 50, 100]
    const interval = niceIntervals.find(i => i >= rawInterval) || niceIntervals[niceIntervals.length - 1]

    const ticks = []
    for (let i = 0; i <= maxYear; i += interval) {
      ticks.push(i)
    }
    // Always include the very last year if it's not close to the last tick
    if (maxYear - ticks[ticks.length - 1] > interval * 0.5) {
      ticks.push(maxYear)
    }
    
    return ticks
  }, [maxYear, showMonthlyLabels])

  // Custom X-Axis Formatter
  const formatXAxis = (value: number) => {
    if (value === 0) return 'Start'
    
    const isInteger = Math.abs(value % 1) < 0.001

    if (showMonthlyLabels) {
      if (isInteger) return `Year ${Math.round(value)}`
      const years = Math.floor(value)
      const months = Math.round((value - years) * 12)
      if (years === 0) return `Month ${months}`
      return `Yr ${years} M ${months}`
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
                  allowDecimals={showMonthlyLabels}
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