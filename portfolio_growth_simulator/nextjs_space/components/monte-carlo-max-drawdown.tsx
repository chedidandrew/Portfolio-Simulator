'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { triggerHaptic } from '@/hooks/use-haptics'
import { formatCompactNumber } from '@/lib/utils'

interface MonteCarloMaxDrawdownProps {
  data: number[] // max drawdown as fraction 0 to 1
  logScale: boolean
  onLogScaleChange: (val: boolean) => void
}

const LOG_Y_FLOOR = 1

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null

  const binData = payload[0]?.payload
  const count = payload[0]?.value ?? 0
  const labelText = binData?.rangeLabel ?? ''

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground">Maximum drawdown</p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Drawdown range:</span>
          <span className="font-semibold text-foreground">{labelText}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: '#FFA500' }}
            />
            <span className="text-muted-foreground">Scenarios:</span>
          </div>
          <span className="font-semibold text-primary">
            {count}
          </span>
        </div>
      </div>
    </div>
  )
}

export function MonteCarloMaxDrawdownHistogram({ data, logScale, onLogScaleChange }: MonteCarloMaxDrawdownProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const histogramData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Convert fractions 0 to 1 into percentages 0 to 100
    const percents = data.map(d => Math.min(Math.max(d * 100, 0), 100))

    const min = 0
    const max = Math.max(...percents, 0)

    // If everything is zero drawdown, just show one bin
    if (max === 0) {
      return [
        { rangeStart: 0, rangeLabel: '0% - 5%', count: percents.length || 0 },
      ]
    }

    const numBins = 20
    const binWidth = (max - min || 1) / numBins

    const bins = Array.from({ length: numBins }, (_, i) => {
      const start = min + i * binWidth
      const end = start + binWidth
      const labelStart = Math.round(start)
      const labelEnd = Math.round(end)
      return {
        rangeStart: start,
        rangeLabel: `${labelStart}% - ${labelEnd}%`,
        count: 0,
      }
    })

    percents.forEach(value => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        numBins - 1
      )
      if (binIndex >= 0 && binIndex < numBins) {
        bins[binIndex].count++
      }
    })

    // Recompute whenever logScale changes to trigger the same
    // animation behavior as the Distribution of Ending Values chart
    return bins.filter(bin => bin.count > 0)
  }, [data, logScale])

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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-yellow-400" />
              Maximum Drawdown Distribution
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale-max-dd"
                checked={logScale}
                onCheckedChange={handleLogScaleChange}
              />
              <Label htmlFor="log-scale-max-dd" className="text-sm cursor-pointer">
                Log scale
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogramData}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
                <XAxis
                  dataKey="rangeLabel"
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fill: isDark
                      ? 'hsl(240, 5%, 64.9%)'
                      : 'hsl(240, 3.8%, 46.1%)',
                  }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                  label={{
                    value: 'Maximum drawdown range',
                    position: 'insideBottom',
                    offset: -15,
                    style: {
                      textAnchor: 'middle',
                      fontSize: 11,
                      fill: isDark
                        ? 'hsl(240, 5%, 64.9%)'
                        : 'hsl(240, 3.8%, 46.1%)',
                    },
                  }}
                />
                <YAxis
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fill: isDark
                      ? 'hsl(240, 5%, 64.9%)'
                      : 'hsl(240, 3.8%, 46.1%)',
                  }}
                  // Updated to use compact number formatting (e.g. 10k)
                  tickFormatter={(val) => formatCompactNumber(val)}
                  scale={logScale ? 'log' : 'linear'}
                  domain={logScale ? [LOG_Y_FLOOR, 'auto'] : [0, 'auto']}
                  allowDataOverflow={false}
                  label={{
                    value: 'Frequency',
                    angle: -90,
                    position: 'insideLeft',
                    style: {
                      textAnchor: 'middle',
                      fontSize: 11,
                      fill: isDark
                        ? 'hsl(240, 5%, 64.9%)'
                        : 'hsl(240, 3.8%, 46.1%)',
                    },
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: 11, marginTop: '-10px' }}
                />
                <Bar
                  dataKey="count"
                  fill="#FFA500"
                  name="Number of scenarios"
                  radius={[4, 4, 0, 0]}
                  animationDuration={200}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the worst peak to bottom drop each scenario experienced, helping you understand risks of typical or extreme drawdowns.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}