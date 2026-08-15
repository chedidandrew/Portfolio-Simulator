'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { triggerHaptic } from '@/hooks/use-haptics'
import type { GrowthProjectionYear } from '@/lib/simulation/growth-engine'

interface GrowthChartProps {
  data: GrowthProjectionYear[]
}

interface ChartPoint {
  year: string
  value: number
  grossValue: number
  totalInvested: number
}

export function buildGrowthChartData(data: GrowthProjectionYear[]): ChartPoint[] {
  return data?.map((item) => ({
    year: `Year ${item.year}`,
    value: Math.round(item.endingValue),
    grossValue: Math.round(item.grossEndingValue),
    totalInvested: Math.round(item.totalInvested),
  })) ?? []
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as ChartPoint | undefined
  if (!point) return null

  const hasGross = Math.abs(point.grossValue - point.value) > 0.01
  const rows = [
    { label: 'Total Invested', value: point.totalInvested, color: 'hsl(200, 70%, 50%)' },
    { label: 'Spendable Value', value: point.value, color: 'hsl(142, 70%, 45%)' },
    ...(hasGross ? [{ label: 'Gross Value', value: point.grossValue, color: 'hsl(262, 83%, 58%)' }] : []),
  ]

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-1 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: row.color }} />
              <span className="text-muted-foreground">{row.label}:</span>
            </div>
            <span className="font-semibold text-foreground">{formatCurrency(row.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-border">
          <span className="text-muted-foreground">Profit (Spendable):</span>
          <span className="font-semibold text-primary">{formatCurrency(point.value - point.totalInvested)}</span>
        </div>
      </div>
    </div>
  )
}

export function GrowthChart({ data }: GrowthChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [useLogScale, setUseLogScale] = useLocalStorage('growth-chart-log-scale', false)

  const chartData = useMemo<ChartPoint[]>(() => buildGrowthChartData(data), [data])

  const hasGrossSeries = chartData.some((point) => Math.abs(point.grossValue - point.value) > 0.01)
  const logScaleAvailable = chartData.length > 0 && chartData.every((point) => (
    point.value > 0 && point.totalInvested > 0 && (!hasGrossSeries || point.grossValue > 0)
  ))
  const renderLogScale = useLogScale && logScaleAvailable

  const handleLogScaleChange = (checked: boolean) => {
    triggerHaptic('light')
    setUseLogScale(checked)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Portfolio Growth Over Time
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-growth"
                aria-describedby={!logScaleAvailable ? 'growth-log-scale-message' : undefined}
                checked={renderLogScale}
                disabled={!logScaleAvailable}
                onCheckedChange={handleLogScaleChange}
              />
              <Label htmlFor="log-scale-growth" className="text-sm cursor-pointer">Log scale</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!logScaleAvailable && (
            <p id="growth-log-scale-message" className="mb-3 text-xs text-muted-foreground">
              Log scale is unavailable when a displayed value reaches zero.
            </p>
          )}
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorContributions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(200, 70%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                  label={{ value: 'Time Period', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' } }}
                />
                <YAxis
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' }}
                  tickFormatter={(value) => formatCurrency(value, true, 1)}
                  scale={renderLogScale ? 'log' : 'linear'}
                  domain={renderLogScale ? ['auto', 'auto'] : [0, 'auto']}
                  allowDataOverflow={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Area type="linear" dataKey="totalInvested" stroke="hsl(200, 70%, 50%)" fill="url(#colorContributions)" strokeWidth={2} name="Total Invested" animationDuration={500} />
                <Area type="linear" dataKey="value" stroke="hsl(142, 70%, 45%)" fill="url(#colorValue)" strokeWidth={3} name="Spendable Value" animationDuration={500} />
                {hasGrossSeries && <Area type="linear" dataKey="grossValue" stroke="hsl(262, 83%, 58%)" fillOpacity={0} strokeWidth={2} name="Gross Value" animationDuration={500} strokeDasharray="6 4" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows spendable value, gross value when applicable, and the original market value plus cumulative contributions.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
