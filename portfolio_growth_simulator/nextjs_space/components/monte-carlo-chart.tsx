'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Activity } from 'lucide-react'
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
}

// Percentile labels for tooltip and legend
const PERCENTILE_LABELS: Record<string, string> = {
  p90: '90th percentile',
  p75: '75th percentile',
  p50: '50th percentile (median)',
  p25: '25th percentile',
  p10: '10th percentile',
}

// Line colors used both in chart and tooltip
const PERCENTILE_COLORS: Record<string, string> = {
  p90: 'hsl(250, 70%, 60%)',  // purple
  p75: 'hsl(200, 75%, 55%)',  // blue
  p50: 'hsl(165, 65%, 48%)',  // teal green
  p25: 'hsl(180, 70%, 55%)',  // cyan
  p10: 'hsl(30, 85%, 60%)',   // orange
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

  const rows = [
    { key: 'p90', value: point.p90 },
    { key: 'p75', value: point.p75 },
    { key: 'p50', value: point.p50 },
    { key: 'p25', value: point.p25 },
    { key: 'p10', value: point.p10 },
  ]

  return (
    <div className="rounded-md border bg-popover px-3 py-2 shadow-md text-xs space-y-1">
      <div className="font-semibold">
        Year {label}
      </div>
      <div className="text-muted-foreground">
        {mode === 'growth' ? 'Projected portfolio value' : 'Projected remaining balance'}
      </div>
      <div className="mt-1 space-y-1">
        {rows.map(({ key, value }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: PERCENTILE_COLORS[key] }}
              />
              <span>{PERCENTILE_LABELS[key]}</span>
            </div>
            <span className="font-semibold">
              {formatCurrency(value)}
            </span>
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

// Format Y-axis ticks compactly (e.g., $60M instead of $60.00M)
const formatYAxis = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1, 
  }).format(value)
}

export function MonteCarloChart({ data, mode, logScale, onLogScaleChange }: MonteCarloChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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

  const handleLogScaleChange = (checked: boolean) => { triggerHaptic('light') onLogScaleChange(checked) }
  
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
              <Activity className="h-5 w-5 text-primary" />
              Scenario Paths with Percentile Bands
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-montecarlo"
                checked={logScale}
                onCheckedChange={handleLogScaleChange}
              />
              <Label htmlFor="log-scale-montecarlo" className="text-sm cursor-pointer">
                Log scale
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 35 }}
              >
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={{ stroke: isDark ? 'hsl(240, 3.7%, 15.9%)' : 'hsl(214, 32%, 91%)' }}
                  tick={{
                    fontSize: 11,
                    fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)',
                  }}
                  label={{
                    value: 'Years',
                    position: 'insideBottom',
                    offset: -15,
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
                  tick={{
                    fontSize: 11,
                    fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)',
                  }}
                  scale={logScale ? 'log' : 'linear'}
                  domain={logScale ? ['auto', 'auto'] : [0, 'auto']}
                  tickFormatter={formatYAxis}
                />
                <Tooltip content={(props) => <CustomTooltip {...props} mode={mode} />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, marginTop: '-10px' }}
                  formatter={(value: string) => PERCENTILE_LABELS[value] ?? value}
                />

                {/* Five percentile lines only */}
                <Line
                  type="monotone"
                  dataKey="p90"
                  stroke={PERCENTILE_COLORS.p90}
                  strokeWidth={2}
                  dot={false}
                  name="p90"
                  animationDuration={500}
                />
                <Line
                  type="monotone"
                  dataKey="p75"
                  stroke={PERCENTILE_COLORS.p75}
                  strokeWidth={2}
                  dot={false}
                  name="p75"
                  animationDuration={400}
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke={PERCENTILE_COLORS.p50}
                  strokeWidth={3}
                  dot={false}
                  name="p50"
                  animationDuration={300}
                />
                <Line
                  type="monotone"
                  dataKey="p25"
                  stroke={PERCENTILE_COLORS.p25}
                  strokeWidth={2}
                  dot={false}
                  name="p25"
                  animationDuration={200}
                />
                <Line
                  type="monotone"
                  dataKey="p10"
                  stroke={PERCENTILE_COLORS.p10}
                  strokeWidth={2}
                  dot={false}
                  name="p10"
                  animationDuration={100}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the range of possible portfolio values each year using up to 100,000 of simulated market outcomes, from optimistic to pessimistic scenarios.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}