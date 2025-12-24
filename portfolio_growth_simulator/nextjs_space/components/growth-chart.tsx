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

interface YearData {
  year: number
  startingValue: number
  contributions: number
  endingValue: number
  grossStartingValue?: number
  grossEndingValue?: number
}

interface GrowthChartProps {
  data: YearData[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-1 text-xs">
        {payload.map((entry: any, index: number) => {
          let displayLabel = ''
          if (entry.dataKey === 'contributions') {
            displayLabel = 'Total Invested'
          } else if (entry.dataKey === 'value') {
            displayLabel = 'Spendable Value'
          } else if (entry.dataKey === 'grossValue') {
            displayLabel = 'Gross Value'
          }
          
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{displayLabel}:</span>
              </div>
              <span className="font-semibold text-foreground">
                {formatCurrency(entry.value ?? 0)}
              </span>
            </div>
          )
        })}
        {payload.length === 2 && (
          <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-border">
            <span className="text-muted-foreground">Profit:</span>
            <span className="font-semibold text-primary">
              {formatCurrency((payload[1]?.value ?? 0) - (payload[0]?.value ?? 0))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const LOG_FLOOR = 1

function logSafe(value: number): number {
  if (!Number.isFinite(value)) return LOG_FLOOR
  return value > LOG_FLOOR ? value : LOG_FLOOR
}

export function GrowthChart({ data }: GrowthChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [useLogScale, setUseLogScale] = useLocalStorage('growth-chart-log-scale', false)

  const handleLogScaleChange = (checked: boolean) => {
      triggerHaptic('light')
      setUseLogScale(checked)
    }

  const hasGrossSeries = useMemo(() => {
    return (data ?? []).some((d) => typeof d?.grossEndingValue === 'number' && Math.abs((d.grossEndingValue ?? 0) - (d.endingValue ?? 0)) > 0.01)
  }, [data])

  const chartData = useMemo(() => {
    let cumulativeContributions = 0
    return data?.map?.((item, index) => {
      if (index === 0) {
        cumulativeContributions = item?.startingValue ?? 0
      }
      cumulativeContributions += item?.contributions ?? 0
      
      return {
        year: `Year ${item?.year}`,
        value: useLogScale ? logSafe(Math.round(item?.endingValue ?? 0)) : Math.round(item?.endingValue ?? 0),
        grossValue: useLogScale ? logSafe(Math.round(item?.grossEndingValue ?? item?.endingValue ?? 0)) : Math.round(item?.grossEndingValue ?? item?.endingValue ?? 0),
        contributions: useLogScale ? logSafe(Math.round(cumulativeContributions)) : Math.round(cumulativeContributions),
      }

    }) ?? []
  }, [data, useLogScale])

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
              <BarChart3 className="h-5 w-5 text-primary" />
              Portfolio Growth Over Time
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-growth"
                checked={useLogScale}
                onCheckedChange={handleLogScaleChange}
              />
              <Label htmlFor="log-scale-growth" className="text-sm cursor-pointer">
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
                  // Fixed: Added dollar sign
                  tickFormatter={(value) => formatCurrency(value, true, 1)}
                  scale={useLogScale ? 'log' : 'linear'}
                  domain={useLogScale ? ['auto', 'auto'] : [0, 'auto']}
                  allowDataOverflow={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, marginTop: '-10px' }}
                  />
                <Area
                  type="monotone"
                  dataKey="contributions"
                  stroke="hsl(200, 70%, 50%)"
                  fill="url(#colorContributions)"
                  strokeWidth={2}
                  name="Total Invested"
                  animationDuration={500}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(142, 70%, 45%)"
                  fill="url(#colorValue)"
                  strokeWidth={3}
                  name="Spendable Value"
                  animationDuration={500}
                />
                {hasGrossSeries && (
                  <Area
                    type="monotone"
                    dataKey="grossValue"
                    stroke="hsl(262, 83%, 58%)"
                    fillOpacity={0}
                    strokeWidth={2}
                    name="Gross Value"
                    animationDuration={500}
                    strokeDasharray="6 4"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows how your portfolio balance and total contributions grow year by year based on expected return and deposit schedule. 
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}