'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface MonteCarloHistogramProps {
  data: number[]
  logScale: boolean
  onLogScaleChange: (val: boolean) => void
}

const LOG_Y_FLOOR = 1

// Format numbers for Y axis (frequency counts)
const formatNumber = (value: number): string => {
  const absValue = Math.abs(value)
  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  } else if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`
  }
  return value.toString()
}

// Clean short currency for X axis labels
const formatCurrencyShort = (value: number): string => {
  const abs = Math.abs(value)

  // Less than 100: increments of 10
  if (abs < 100) {
    const step = Math.round(value / 10) * 10
    return `$${step}`
  }

  // 100 to < 10k: increments of 100
  if (abs < 10_000) {
    const step = Math.round(value / 100) * 100
    return `$${step}`
  }

  // 10k to < 100k: increments of 1k
  if (abs < 100_000) {
    const step = Math.round(value / 1_000) * 1_000
    return `$${(step / 1_000).toString().replace(/\.0$/, '')}K`
  }

  // 100k to < 1M: increments of 10k
  if (abs < 1_000_000) {
    const step = Math.round(value / 10_000) * 10_000
    return `$${(step / 1_000).toString().replace(/\.0$/, '')}K`
  }

  // 1M to < 10M: increments of 100k
  if (abs < 10_000_000) {
    const step = Math.round(value / 100_000) * 100_000
    return `$${(step / 1_000_000).toString().replace(/\.0$/, '')}M`
  }

  // 10M to < 100M: increments of 1M
  if (abs < 100_000_000) {
    const step = Math.round(value / 1_000_000) * 1_000_000
    return `$${(step / 1_000_000).toString().replace(/\.0$/, '')}M`
  }

  // 100M to < 1B: increments of 10M
  if (abs < 1_000_000_000) {
    const step = Math.round(value / 10_000_000) * 10_000_000
    return `$${(step / 1_000_000).toString().replace(/\.0$/, '')}M`
  }

  // 1B+: increments of 100M
  const step = Math.round(value / 100_000_000) * 100_000_000
  return `$${(step / 1_000_000_000).toString().replace(/\.0$/, '')}B`
}

// Custom tooltip component that matches app theme
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null

  const binData = payload[0]?.payload
  const count = payload[0]?.value ?? 0
  const labelText = binData?.rangeLabel ?? ''
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5">
      <p className="text-sm font-semibold text-foreground">Portfolio Range</p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Value Range:</span>
          <span className="font-semibold text-foreground">{labelText}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: 'hsl(142, 70%, 45%)' }}
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

export function MonteCarloHistogram({ data, logScale, onLogScaleChange }: MonteCarloHistogramProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  // Detect if all ending values are identical
  const isSingleValue = useMemo(() => {
    if (!data || data.length === 0) return false
    const first = data[0]
    return data.every(v => v === first)
  }, [data])

  const singleValue = isSingleValue ? data[0] : null

  const histogramData = useMemo(() => {
    if (!data || data.length === 0) return []
    if (isSingleValue) return []

    const min = Math.min(...data)
    const max = Math.max(...data)
    
    if (logScale && min > 0) {
      // Logarithmic binning on portfolio values
      const numBins = 30
      const logMin = Math.log10(min)
      const logMax = Math.log10(max)
      const logBinWidth = (logMax - logMin) / numBins
      
      // Calculate 99th percentile for outlier binning
      const sorted = [...data].sort((a, b) => a - b)
      const p99Index = Math.floor(sorted.length * 0.99)
      const p99Value = sorted[p99Index]
      
      const bins: Array<{ rangeStart: number; rangeLabel: string; count: number; isOutlier?: boolean }> = []
      
      // Create log spaced bins
      for (let i = 0; i < numBins; i++) {
        const logStart = logMin + i * logBinWidth
        const rangeStart = Math.pow(10, logStart)
        
        // Stop creating bins at 99th percentile, create outlier bin instead
        if (rangeStart > p99Value && i > 0) {
          bins.push({
            rangeStart: p99Value,
            rangeLabel: `> ${formatCurrencyShort(p99Value)}`,
            count: 0,
            isOutlier: true,
          })
          break
        }
        
        bins.push({
          rangeStart,
          rangeLabel: formatCurrencyShort(rangeStart),
          count: 0,
        })
      }
      
      // Fill bins with data
      data.forEach(value => {
        if (value <= 0) return // Skip non positive values in log scale
        
        // Check if it is an outlier
        const outlierBin = bins.find(b => b.isOutlier)
        if (outlierBin && value >= outlierBin.rangeStart) {
          outlierBin.count++
          return
        }
        
        // Find appropriate bin
        const logValue = Math.log10(value)
        const binIndex = Math.min(Math.floor((logValue - logMin) / logBinWidth), bins.length - 1)
        if (binIndex >= 0 && binIndex < bins.length && !bins[binIndex].isOutlier) {
          bins[binIndex].count++
        }
      })
      
      // Only keep bins that have data
      return bins.filter(bin => bin.count > 0)
    } else {
      // Linear binning
      const numBins = 30
      const binWidth = (max - min) / numBins

      const bins = Array.from({ length: numBins }, (_, i) => {
        const start = min + i * binWidth
        return {
          rangeStart: start,
          rangeLabel: formatCurrencyShort(start),
          count: 0,
        }
      })

      data.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), numBins - 1)
        if (binIndex >= 0 && binIndex < numBins) {
          bins[binIndex].count++
        }
      })

      return bins.filter(bin => bin.count > 0)
    }
  }, [data, logScale, isSingleValue])

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
              <BarChart3 className="h-5 w-5 text-emerald-400" />
              Distribution of Ending Values
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                id="log-scale"
                checked={logScale}
                onCheckedChange={onLogScaleChange}
              />
              <Label htmlFor="log-scale" className="text-sm cursor-pointer">
                Log scale
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isSingleValue && singleValue != null ? (
            <div className="h-80 flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">All scenarios ended at</p>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(singleValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.length.toLocaleString()} scenarios landed here
              </p>
            </div>
          ) : (
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
                      value: 'Ending value range',
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
                    scale={logScale ? 'log' : 'linear'}
                    domain={logScale ? [1, 'auto'] : [0, 'auto']}
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
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(142, 70%, 45%)"
                    name="Number of Scenarios"
                    radius={[4, 4, 0, 0]}
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows how frequently different ending portfolio values occurred across all simulated scenarios.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}