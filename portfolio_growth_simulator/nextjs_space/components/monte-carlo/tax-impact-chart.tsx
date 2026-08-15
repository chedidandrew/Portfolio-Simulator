'use client'

import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Coins, Info } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { SimulationParams } from '@/lib/types'

interface TaxImpactChartProps {
  data: any[]
  grossData: any[]
  investmentData?: any[]
  params: SimulationParams
  isRealDollars: boolean
}

function formatTimeLabel(value: number): string {
  if (value <= 0) return 'Start'
  if (Math.abs(value - Math.round(value)) < 0.001) return `Year ${Math.round(value)}`
  const years = Math.floor(value)
  const months = Math.max(1, Math.round((value - years) * 12))
  return years > 0 ? `Year ${years}, Month ${months}` : `Month ${months}`
}

export function TaxImpactChart({ data, grossData, params, isRealDollars }: TaxImpactChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const chartData = useMemo(() => {
    if (!data?.length || !grossData?.length) return []
    return data.map((netPoint, index) => {
      const grossPoint = grossData[Math.min(index, grossData.length - 1)]
      const year = Number(netPoint.year ?? 0)
      const deflator = isRealDollars
        ? Math.pow(1 + (params.inflationAdjustment ?? 0) / 100, year)
        : 1
      const preTax = Number(grossPoint?.p50 ?? netPoint.p50 ?? 0) / deflator
      const postTax = Number(netPoint.p50 ?? 0) / deflator
      return {
        year,
        preTax,
        postTax,
        taxDifference: Math.max(0, preTax - postTax),
      }
    })
  }, [data, grossData, isRealDollars, params.inflationAdjustment])

  if (!params.taxEnabled || chartData.length === 0) return null

  return (
    <Card className="print-break-inside-avoid border-red-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
          <Coins className="h-4 w-4" />
          Tax Impact Projection
          <span className="ml-auto text-xs font-normal text-muted-foreground opacity-70">Median outcome</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
              <defs>
                <linearGradient id="tax-gross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tax-net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="year"
                type="number"
                domain={[0, 'dataMax']}
                tickLine={false}
                axisLine={{ stroke: isDark ? '#27272a' : '#e2e8f0' }}
                tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                tickFormatter={(value) => Number(value).toFixed(Number(value) < 1 ? 1 : 0)}
              />
              <YAxis
                tickLine={false}
                tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                tickFormatter={(value) => formatCurrency(value, true, 0, true)}
                width={52}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelFormatter={(value) => formatTimeLabel(Number(value))}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
              />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
              <Area
                type="linear"
                dataKey="preTax"
                name={params.taxType === 'income' ? 'Without Annual Tax Drag' : 'Gross Account Value'}
                stroke="#94a3b8"
                fill="url(#tax-gross)"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
              <Area
                type="linear"
                dataKey="postTax"
                name="Spendable After-Tax Value"
                stroke="#ef4444"
                fill="url(#tax-net)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            These lines come directly from the same gross and after-tax Monte Carlo paths. No second tax calculation is applied by the chart.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
