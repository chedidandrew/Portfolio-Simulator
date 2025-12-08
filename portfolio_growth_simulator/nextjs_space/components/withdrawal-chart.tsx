'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from 'recharts'
import { TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useLocalStorage } from '@/hooks/use-local-storage'

interface YearData {
  year: number
  startingBalance: number
  withdrawals: number
  endingBalance: number
  isSustainable: boolean
}

interface WithdrawalChartProps {
  data: YearData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null

  const displayPayload = payload.filter((entry: any) => entry.dataKey !== 'sustainable')
  
  if (displayPayload.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-1 text-xs">
        {displayPayload.map((entry: any, index: number) => {
          let displayLabel = ''
          let color = entry.color
          
          if (entry.dataKey === 'balance') {
            displayLabel = 'Portfolio Balance'
            const balanceValue = entry.value ?? 0
            color = balanceValue > 0 ? 'hsl(142, 70%, 45%)' : 'hsl(0, 84%, 60%)'
          } else if (entry.dataKey === 'withdrawn') {
            displayLabel = 'Annual Withdrawal'
            color = 'hsl(200, 70%, 50%)'
          }
          
          if (!displayLabel) return null
          
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{displayLabel}:</span>
              </div>
              <span className="font-semibold text-foreground">
                {formatCurrency(entry.value ?? 0)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LOG_FLOOR = 1

function logSafe(value: number): number {
  if (!Number.isFinite(value)) return LOG_FLOOR
  return value > LOG_FLOOR ? value : LOG_FLOOR
}

const formatYAxis = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1, 
  }).format(value)
}

export function WithdrawalChart({ data }: WithdrawalChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [useLogScale, setUseLogScale] = useLocalStorage('withdrawal-chart-log-scale', false)
  
  const chartData = useMemo(() => {
    return data?.map?.(item => {
      const rawBalance = Math.round(item?.endingBalance ?? 0)
      const rawWithdrawn = Math.round(item?.withdrawals ?? 0)

      return {
        year: `Year ${item?.year}`,
        balance: useLogScale ? logSafe(rawBalance) : rawBalance,
        withdrawn: useLogScale ? logSafe(rawWithdrawn) : rawWithdrawn,
        sustainable: item?.isSustainable ? 1 : 0,
      }
    }) ?? []
  }, [data, useLogScale])

  const firstUnsustainableIndex = useMemo(() => {
    return chartData?.findIndex?.(item => item?.sustainable === 0) ?? -1
  }, [chartData])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              Portfolio Balance Over Time
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-withdrawal"
                checked={useLogScale}
                onCheckedChange={setUseLogScale}
              />
              <Label htmlFor="log-scale-withdrawal" className="text-sm cursor-pointer">
                Log scale
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
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
                  label={{ 
                    value: 'Time Period', 
                    position: 'insideBottom', 
                    offset: -15, 
                    style: { 
                      textAnchor: 'middle', 
                      fontSize: 11,
                      fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)'
                    } 
                  }}
                />
                <YAxis
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)' }}
                  tickFormatter={formatYAxis}
                  scale={useLogScale ? 'log' : 'linear'}
                  domain={useLogScale ? ['auto', 'auto'] : [0, 'auto']}
                  allowDataOverflow={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) => value === 'balance' ? 'Portfolio Balance' : value === 'withdrawn' ? 'Annual Withdrawal' : ''}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={firstUnsustainableIndex === -1 ? "hsl(142, 70%, 45%)" : "hsl(0, 84%, 60%)"}
                  fill={firstUnsustainableIndex === -1 ? "url(#colorBalance)" : "url(#colorDanger)"}
                  strokeWidth={3}
                  name="balance"
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {firstUnsustainableIndex !== -1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
            >
              <span className="font-semibold">⚠️ Warning:</span>
              <span>Portfolio depletes around year {chartData?.[firstUnsustainableIndex]?.year}</span>
            </motion.div>
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows how your portfolio balance changes over time under your withdrawal plan, indicating when the balance remains sustainable or reaches zero.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}