'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { Percent, TrendingDown, ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'

interface AnalyticsProps {
  data: any
  isDark: boolean
}

/* ------------------------------------------------------------------ */
/*  Shared tooltip components for analytics charts                     */
/*  Matches style of Scenario Paths / Ending Values / Max Drawdown     */
/* ------------------------------------------------------------------ */

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
        Year {label}
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
        Year {label}
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
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: '#f59e0b' }}
            />
            <span className="text-muted-foreground">
              At any point (intra-period)
            </span>
          </div>
          <span className="font-semibold text-foreground">
            {intra.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: '#ef4444' }}
            />
            <span className="text-muted-foreground">
              At the end (final balance)
            </span>
          </div>
          <span className="font-semibold text-foreground">
            {end.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- */
/* 1. Annualized Return Percentiles (CAGR over time)                      */
/* ---------------------------------------------------------------------- */

export function AnnualReturnsChart({ data, isDark }: AnalyticsProps) {
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
            {/* use primary themed icon */}
            <Percent className="h-5 w-5 text-emerald-400" />
            Expected Annual Return (CAGR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <XAxis 
                  dataKey="year" 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                  label={{
                    value: 'Years invested',
                    position: 'insideBottom',
                    offset: -15,
                    fontSize: 11,
                    fill: isDark ? '#a1a1aa' : '#71717a',
                  }}
                />
                <YAxis 
                  tickLine={false}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Tooltip content={<AnnualReturnsTooltip mode="cagr" />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Line type="monotone" dataKey="p90" stroke="#0f766e" name="90th Percentile" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="p75" stroke="#14b8a6" name="75th Percentile" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="median" stroke="#06b6d4" name="50th Percentile (Median)" dot={false} strokeWidth={3} />
                <Line type="monotone" dataKey="p25" stroke="#0ea5e9" name="25th Percentile" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="p10" stroke="#f29a45" name="10th Percentile" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Shows the expected compound annual return each year across percentile ranges from optimistic to pessimistic outcomes.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ---------------------------------------------------------------------- */
/* 2. Probability of Annual Returns                                       */
/* ---------------------------------------------------------------------- */

export function ReturnProbabilitiesChart({ data, isDark }: AnalyticsProps) {
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
            <TrendingDown className="h-5 w-5 text-violet-400" />
            Probability of Annual Returns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <XAxis 
                  dataKey="year" 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                  label={{
                    value: 'Years invested',
                    position: 'insideBottom',
                    offset: -15,
                    fontSize: 11,
                    fill: isDark ? '#a1a1aa' : '#71717a',
                  }}
                />
                <YAxis 
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                />
                <Tooltip content={<ReturnProbabilitiesTooltip mode="probability" />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, marginTop: '-10px' }} />
                <Line type="monotone" dataKey="prob5" stroke="#7e22ce" name="≥ 5% CAGR" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="prob8" stroke="#8b5cf6" name="≥ 8% CAGR" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="prob10" stroke="#6366f1" name="≥ 10% CAGR" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="prob12" stroke="#3b82f6" name="≥ 12% CAGR" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="prob15" stroke="#0ea5e9" name="≥ 15% CAGR" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="prob20" stroke="#f29a45" name="≥ 20% CAGR" dot={false} strokeWidth={2} />
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
/* 3. Loss Probabilities (End of period vs Intra-period)                  */
/* ---------------------------------------------------------------------- */

export function LossProbabilitiesChart({ data, isDark }: AnalyticsProps) {
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
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                <XAxis 
                  dataKey="threshold" 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: isDark ? '#a1a1aa' : '#71717a' }}
                  label={{
                    value: 'Loss Magnitude',
                    position: 'insideBottom',
                    offset: -15,
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
                <Bar dataKey="intraPeriod" name="At any point (Intra-period)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="endPeriod" name="At the end (Final Balance)" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
