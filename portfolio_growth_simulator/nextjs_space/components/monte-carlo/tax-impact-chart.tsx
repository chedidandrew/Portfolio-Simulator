'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Coins, Info } from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { SimulationParams } from '@/lib/types'

interface TaxImpactChartProps {
  data: any[]
  investmentData: any[]
  params: SimulationParams
  isRealDollars: boolean
}

// Helper to format fractional years into "Year X, Month Y, Week Z"
const formatTooltipLabel = (label: number) => {
  if (!label || label <= 0) return 'Month 1'
  
  const years = Math.floor(label)
  const fraction = label - years
  const months = Math.round(fraction * 12)
  
  // 1. Exact Month Boundary (within tolerance)
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

export function TaxImpactChart({ data, investmentData, params, isRealDollars }: TaxImpactChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Combine and Calculate Pre/Post Tax Data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    
    const len = Math.min(data.length, investmentData?.length || 0)
    
    return data.slice(0, len).map((point, i) => {
      const invPoint = investmentData[i]
      const year = point.year
      
      const inflation = params.inflationAdjustment ?? 0
      const deflator = isRealDollars ? Math.pow(1 + inflation / 100, year) : 1

      const rawMedian = point.p50
      const totalInvested = invPoint.total

      let preTaxValue = 0
      let postTaxValue = 0

      if (params.taxType === 'income') {
        const rGross = params.expectedReturn / 100
        const rNet = rGross * (1 - (params.taxRate || 0) / 100)
        
        const growthRatio = Math.pow((1 + rGross) / (1 + rNet), year)
        
        postTaxValue = rawMedian
        preTaxValue = rawMedian * growthRatio
        
        if (preTaxValue < postTaxValue) preTaxValue = postTaxValue

      } else if (params.taxType === 'tax_deferred') {
        // Tax the entire balance
        preTaxValue = rawMedian
        postTaxValue = rawMedian * (1 - (params.taxRate || 0) / 100)

      } else {
        // Capital Gains (Default)
        const gain = Math.max(0, rawMedian - totalInvested)
        const taxBill = gain * ((params.taxRate || 0) / 100)
        
        preTaxValue = rawMedian
        postTaxValue = rawMedian - taxBill
      }

      return {
        year,
        preTax: preTaxValue / deflator,
        postTax: postTaxValue / deflator,
        taxLost: (preTaxValue - postTaxValue) / deflator
      }
    })
  }, [data, investmentData, params, isRealDollars])

  /* ------------------------------------------------------------------ */
  /* Smart Ticks Logic (Matched with MonteCarloChart)                   */
  /* ------------------------------------------------------------------ */
  const maxYear = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0
    return chartData[chartData.length - 1].year
  }, [chartData])

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
      
      const displayMonth = months + 1
      if (displayMonth > 12) return `Year ${years + 1}`

      if (years === 0) return `Month ${displayMonth}`
      return `Yr ${years} M ${displayMonth}`
    }

    if (!isInteger) return ''
    return `Year ${value}`
  }

  if (!params.taxEnabled) return null

  return (
    <Card className="print-break-inside-avoid border-red-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
          <Coins className="h-4 w-4" />
          Tax Impact Projection <span className="text-xs font-normal text-muted-foreground ml-auto opacity-70">Median Scenario</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
         <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                <defs>
                    <linearGradient id="colorPre" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                </defs>
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
                  tickFormatter={(val) => formatCurrency(val, true, 0, true)}
                  tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                  width={40}
                />
                <Tooltip 
                   formatter={(val: number) => formatCurrency(val)}
                   labelFormatter={formatTooltipLabel} 
                   contentStyle={{ 
                     backgroundColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--card))', 
                     borderColor: 'hsl(var(--border))',
                     borderRadius: 'var(--radius)',
                     fontSize: '12px'
                   }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: '10px' }} />
                
                <Area 
                  type="monotone" 
                  dataKey="preTax" 
                  name="Pre-Tax Wealth" 
                  stroke="#94a3b8" 
                  fill="url(#colorPre)"
                  strokeDasharray="4 4" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="postTax" 
                  name="After-Tax Wealth" 
                  stroke="#ef4444" 
                  fill="url(#colorPost)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
         </div>
         <div className="flex items-start gap-2 mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
               {params.taxType === 'income' 
                 ? "Shows the 'Compound Drag' effect. The dashed line is how your portfolio would have grown without annual taxes."
                 : "The gap represents the deferred tax bill you would owe if you liquidated the entire portfolio at that point."}
            </p>
         </div>
      </CardContent>
    </Card>
  )
}