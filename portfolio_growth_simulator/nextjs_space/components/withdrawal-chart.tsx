'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts'
import { TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { triggerHaptic } from '@/hooks/use-haptics'
import { formatFinancialHorizon } from '@/lib/financial-horizon'
import type { CashflowFrequency } from '@/lib/types'
import type { WithdrawalProjectionYear } from '@/lib/simulation/withdrawal-engine'

interface WithdrawalChartProps {
  data: WithdrawalProjectionYear[]
  yearsUntilZero: number | null
  depletionStep: number | null
  depletionFrequency: CashflowFrequency
}

interface ChartPoint {
  year: string
  balance: number
  sustainable: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as ChartPoint | undefined
  if (!point) return null

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: point.balance > 0 ? 'hsl(142, 70%, 45%)' : 'hsl(0, 84%, 60%)' }} />
          <span className="text-muted-foreground">Portfolio Balance:</span>
        </div>
        <span className="font-semibold text-foreground">{formatCurrency(point.balance)}</span>
      </div>
    </div>
  )
}

export function WithdrawalChart({ data, yearsUntilZero, depletionStep, depletionFrequency }: WithdrawalChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [useLogScale, setUseLogScale] = useLocalStorage('withdrawal-chart-log-scale', false)

  const chartData = useMemo<ChartPoint[]>(() => data?.map((item) => ({
    year: `Year ${item.year}`,
    balance: Math.round(item.endingBalance),
    sustainable: item.isSustainable,
  })) ?? [], [data])

  const firstUnsustainableIndex = chartData.findIndex((item) => !item.sustainable)
  const logScaleAvailable = chartData.length > 0 && chartData.every((point) => point.balance > 0)
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
              <TrendingDown className="h-5 w-5 text-blue-500" />
              Portfolio Balance Over Time
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-withdrawal"
                aria-describedby={!logScaleAvailable ? 'withdrawal-log-scale-message' : undefined}
                checked={renderLogScale}
                disabled={!logScaleAvailable}
                onCheckedChange={handleLogScaleChange}
              />
              <Label htmlFor="log-scale-withdrawal" className="text-sm cursor-pointer">Log scale</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!logScaleAvailable && (
            <p id="withdrawal-log-scale-message" className="mb-3 text-xs text-muted-foreground">
              Log scale is unavailable when a displayed value reaches zero.
            </p>
          )}
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 70%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDanger" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
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
                <Area
                  type="linear"
                  dataKey="balance"
                  stroke={firstUnsustainableIndex === -1 ? 'hsl(142, 70%, 45%)' : 'hsl(0, 84%, 60%)'}
                  fill={firstUnsustainableIndex === -1 ? 'url(#colorBalance)' : 'url(#colorDanger)'}
                  strokeWidth={3}
                  name="Portfolio Balance"
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {firstUnsustainableIndex !== -1 && yearsUntilZero !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <span className="font-semibold">⚠️ Warning:</span>
              <span>Portfolio cannot fully fund the requested payment after {formatFinancialHorizon({ years: yearsUntilZero, periods: depletionStep, frequency: depletionFrequency })}.</span>
            </motion.div>
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows how your portfolio balance changes over time under your withdrawal plan, including a true zero when the portfolio is depleted.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
