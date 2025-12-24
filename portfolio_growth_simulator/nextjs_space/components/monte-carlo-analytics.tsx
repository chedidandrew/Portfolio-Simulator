'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Percent, TrendingUpDown, ShieldAlert, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'

interface AnalyticsProps {
  data: any
  isDark: boolean
  enableAnimation?: boolean
}

/* ------------------------------------------------------------------ */
/* Helpers for Axis Formatting (Smart Ticks)                          */
/* ------------------------------------------------------------------ */

// Hook to generate "Smart Ticks" dynamically based on duration.
function useCustomTicks(data: any[]) {
  return useMemo(() => {
    if (!data || data.length === 0) return [0]
    const maxYear = data[data.length - 1].year || 0
    
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
  }, [data])
}

const formatXAxis = (value: number, maxYear: number) => {
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
    
    // FIX: Shift month display by +1 so 0.08 -> Month 2
    const displayMonth = months + 1
    if (displayMonth > 12) return `Year ${years + 1}`

    if (years === 0) return `Month ${displayMonth}`
    return `Yr ${years} M ${displayMonth}`
  }

  if (!isInteger) return ''
  return `Year ${value}`
}

const commonXAxisProps = (isDark: boolean, data: any[]) => {
  const ticks = useCustomTicks(data)
  const maxYear = data && data.length > 0 ? data[data.length - 1].year : 0

  return {
    dataKey: "year",
    type: "number",
    domain: [0, 'dataMax'],
    ticks: ticks,
    tickLine: false,
    axisLine: { stroke: isDark ? 'hsl(240, 3.7%, 15.9%)' : 'hsl(214, 32%, 91%)' },
    tick: {
      fontSize: 11,
      angle: -45,
      textAnchor: 'end',
      dy: 10,
      fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)',
    } as any,
    height: 60,
    interval: 0,
    minTickGap: 1,
    tickFormatter: (val: number) => formatXAxis(val, maxYear),
    label: {
      value: 'Time',
      position: 'insideBottom',
      offset: -5,
      style: {
        textAnchor: 'middle',
        fontSize: 11,
        fill: isDark ? 'hsl(240, 5%, 64.9%)' : 'hsl(240, 3.8%, 46.1%)',
      },
    }
  }
}

/* ------------------------------------------------------------------ */
/* Shared tooltip components                                          */
/* ------------------------------------------------------------------ */

const formatTooltipLabel = (label: number) => {
  // "Start" corresponds to Month 1 (Day 0)
  if (label === 0) return 'Month 1'
  
  const years = Math.floor(label)
  const fraction = label - years
  const months = Math.round(fraction * 12)
  
  // FIX: Shift month logic +1
  // If months = 0 (Start of year), it's "Year X"
  // If months = 1 (Feb), it's Month 2.
  
  // 1. Exact Month Boundary
  if (Math.abs(fraction * 12 - months) < 0.001) {
    if (months === 0) return `Year ${years}`
    
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
  
  // FIX: Shift weeks so Week 1-4 is Month 1, Week 5-8 is Month 2...
  // However, Month logic is usually "completed months".
  // If we want "Month 1, Week 2", that means we are IN Month 1.
  
  // Adjust month index to be 1-based and align with "Start = Month 1"
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

const AnnualReturnsTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload || !payload.length) return null
  const point = payload[0]?.payload ?? {}

  const rows = [
    { key: 'p90', label: '90th percentile', color: '#0f766e' },
    { key: 'p75', label: '75th percentile', color: '#14b8a6' },
    { key: 'median', label: '50th percentile (median)', color: '#06b6d4' },
    { key: 'p25', label: '25th percentile', color: '#0ea5e9' },
    { key: 'p10', label: '10th percentile', color: '#f29a45' },
  ]

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5 text-xs">
      <p className="text-sm font-semibold text-foreground">
        {formatTooltipLabel(label)}
      </p>
      <div className="text-muted-foreground">
        {mode === 'cagr' ? 'Expected CAGR' : ''}
      </div>
      <div className="space-y-1">
        {rows.map(({ key, label, color }) => {
          const value = point[key]
          if (value == null) return null
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-muted-foreground">{label}</span>
              </div>
              <span className="font-semibold text-foreground">
                {value.toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ReturnProbabilitiesTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload || !payload.length) return null
  const point = payload[0]?.payload ?? {}

  const rows = [
    { key: 'prob5', label: '≥ 5 percent CAGR', color: '#7e22ce' },
    { key: 'prob8', label: '≥ 8 percent CAGR', color: '#8b5cf6' },
    { key: 'prob10', label: '≥ 10 percent CAGR', color: '#6366f1' },
    { key: 'prob12', label: '≥ 12 percent CAGR', color: '#3b82f6' },
    { key: 'prob15', label: '≥ 15 percent CAGR', color: '#0ea5e9' },
    { key: 'prob20', label: '≥ 20 percent CAGR', color: '#f29a45' },
  ]

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5 text-xs">
      <p className="text-sm font-semibold text-foreground">
        {formatTooltipLabel(label)}
      </p>
      <div className="text-muted-foreground">
        {mode === 'probability' ? 'Probability of Annual Returns' : ''}
      </div>
      <div className="space-y-1">
        {rows.map(({ key, label, color }) => {
          const value = point[key]
          if (value == null) return null
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-muted-foreground">{label}</span>
              </div>
              <span className="font-semibold text-foreground">
                {value.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LossProbabilitiesTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null
  const row = payload[0]?.payload ?? {}
  const threshold = row.threshold ?? ''
  const intra = payload.find((p: any) => p.dataKey === 'intraPeriod')?.value ?? 0
  const end = payload.find((p: any) => p.dataKey === 'endPeriod')?.value ?? 0

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5 text-xs">
      <p className="text-sm font-semibold text-foreground">Loss probabilities</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Loss magnitude:</span>
          <span className="font-semibold text-foreground">{threshold}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
            <span className="text-muted-foreground">At any point (intra-period)</span>
          </div>
          <span className="font-semibold text-foreground">{intra.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
            <span className="text-muted-foreground">At the end (final balance)</span>
          </div>
          <span className="font-semibold text-foreground">{end.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

const InvestmentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-1.5 text-xs">
      <p className="text-sm font-semibold text-foreground">
        {formatTooltipLabel(label)}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">Initial Principal</span>
          </div>
          <span className="font-semibold text-foreground">
            {formatCurrency(data.initial)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-muted-foreground">Cumulative Contributions</span>
          </div>
          <span className="font-semibold text-foreground">
            {formatCurrency(data.contributions)}
          </span>
        </div>
        <div className="pt-1 mt-1 border-t border-border flex items-center justify-between gap-4">
          <span className="font-bold text-foreground">Total Invested</span>
          <span className="font-bold text-foreground">
            {formatCurrency(data.total)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* 1. Annualized Return Percentiles (CAGR)                                */
/* ---------------------------------------------------------------------- */

export function AnnualReturnsChart({ data, isDark, enableAnimation = true }: AnalyticsProps) {
  const commonProps = commonXAxisProps(isDark, data)
  
  // Custom Logic: Remove 'Start' (0) tick for CAGR Chart
  const filteredTicks = commonProps.ticks.filter(t => t !== 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="print-chart-page"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-emerald-400" />
            Expected Annual Return (CAGR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                <XAxis 
                  {...(commonProps as any)} 
                  ticks={filteredTicks} 
                  domain={['dataMin', 'dataMax']} 
                />
                <YAxis 
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Tooltip content={<AnnualReturnsTooltip mode="cagr" />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Line type="monotone" dataKey="p90" stroke="#0f766e" name="90th Percentile" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="p75" stroke="#14b8a6" name="75th Percentile" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="median" stroke="#06b6d4" name="50th Percentile (Median)" dot={false} strokeWidth={3} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="p25" stroke="#0ea5e9" name="25th Percentile" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="p10" stroke="#f29a45" name="10th Percentile" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the expected compound annual return (excluding contributions) each year across percentile ranges from optimistic to pessimistic outcomes.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ---------------------------------------------------------------------- */
/* 2. Probability of Annual Returns                                       */
/* ---------------------------------------------------------------------- */

export function ReturnProbabilitiesChart({ data, isDark, enableAnimation = true }: AnalyticsProps) {
  const commonProps = commonXAxisProps(isDark, data)
  
  // Custom Logic: Remove 'Start' (0) tick for Probability Chart
  const filteredTicks = commonProps.ticks.filter(t => t !== 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="print-chart-page"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpDown className="h-5 w-5 text-violet-400" />
            Probability of Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 35 }}>
                <XAxis 
                  {...(commonProps as any)} 
                  ticks={filteredTicks}
                  domain={['dataMin', 'dataMax']}
                />
                <YAxis 
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Tooltip content={<ReturnProbabilitiesTooltip mode="probability" />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Line type="monotone" dataKey="prob5" stroke="#7e22ce" name="≥ 5% CAGR" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="prob8" stroke="#8b5cf6" name="≥ 8% CAGR" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="prob10" stroke="#6366f1" name="≥ 10% CAGR" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="prob12" stroke="#3b82f6" name="≥ 12% CAGR" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="prob15" stroke="#0ea5e9" name="≥ 15% CAGR" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
                <Line type="monotone" dataKey="prob20" stroke="#f29a45" name="≥ 20% CAGR" dot={false} strokeWidth={2} animationDuration={enableAnimation ? 1000 : 0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the probability each year of achieving return thresholds such as 5, 8, 10, 12, 15, or 20 percent annualized.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ---------------------------------------------------------------------- */
/* 3. Loss Probabilities (Unchanged)                                      */
/* ---------------------------------------------------------------------- */

export function LossProbabilitiesChart({ data, isDark, enableAnimation = true }: AnalyticsProps) {
  // Loss chart uses categorical text X-Axis ("Loss > 10%"), so we apply style only.
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="print-chart-page"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Loss Probabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                <XAxis 
                  dataKey="threshold" 
                  tickLine={false}
                  tick={{ 
                    fontSize: 11, 
                    fill: isDark ? '#a1a1aa' : '#71717a',
                    angle: -45,
                    textAnchor: 'end',
                    dy: 10
                  } as any}
                  height={60}
                  label={{
                    value: 'Loss Magnitude',
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 11,
                    fill: isDark ? '#a1a1aa' : '#71717a',
                  }}
                />
                <YAxis 
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  content={<LossProbabilitiesTooltip />}
                />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Bar dataKey="intraPeriod" name="At any point (Intra-period)" fill="#f59e0b" radius={[4, 4, 0, 0]} animationDuration={enableAnimation ? 400 : 0} />
                <Bar dataKey="endPeriod" name="At the end (Final Balance)" fill="#ef4444" radius={[4, 4, 0, 0]} animationDuration={enableAnimation ? 400 : 0} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows how likely your portfolio is to experience a specific loss magnitude, either at any point or at year end.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ---------------------------------------------------------------------- */
/* 4. Investment Breakdown Chart                                          */
/* ---------------------------------------------------------------------- */

export function InvestmentBreakdownChart({ data, isDark, enableAnimation = true }: AnalyticsProps) {
  const xAxisProps = commonXAxisProps(isDark, data)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="print-chart-page"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-500" />
            Investment Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
                <defs>
                  <linearGradient id="colorInitial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorContrib" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis {...(xAxisProps as any)} />
                <YAxis 
                  tickLine={false}
                  tickFormatter={(val) => formatCurrency(val, true, 0)}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Tooltip content={<InvestmentTooltip />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                
                <Area 
                  type="monotone" 
                  dataKey="initial" 
                  stackId="1" 
                  stroke="#3b82f6" 
                  fill="url(#colorInitial)" 
                  name="Initial Principal" 
                  strokeWidth={2}
                  animationDuration={enableAnimation ? 1000 : 0}
                />
                <Area 
                  type="monotone" 
                  dataKey="contributions" 
                  stackId="1" 
                  stroke="#10b981" 
                  fill="url(#colorContrib)" 
                  name="Cumulative Contributions" 
                  strokeWidth={2}
                  animationDuration={enableAnimation ? 1000 : 0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the cumulative total of your own money invested over time (Initial Deposit + Monthly Contributions).
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}