'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowLeftRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { SimulationParams } from '@/lib/types'

export function CashflowChart({ params, mode }: { params: SimulationParams, mode: string }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  const inflation = params.inflationAdjustment ?? 0
  const baseAnnual =
    params.cashflowFrequency === 'weekly'
      ? params.cashflowAmount * 52
      : params.cashflowFrequency === 'monthly'
        ? params.cashflowAmount * 12
        : params.cashflowFrequency === 'quarterly'
          ? params.cashflowAmount * 4
          : params.cashflowAmount
  const steps = params.duration
  
  const currencySymbol = getAppCurrency().symbol

  const data = Array.from({ length: steps + 1 }, (_, i) => {
    // If inflation is excluded in simulation, nominal = real (flat)
    // Otherwise nominal grows by inflation
    const nominal = params.excludeInflationAdjustment 
      ? baseAnnual 
      : baseAnnual * Math.pow(1 + inflation / 100, i)
      
    return {
        year: i,
        nominal,
        real: baseAnnual // Real purchasing power is constant relative to today
    }
  })

  return (
    <Card className="print-break-inside-avoid border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="h-4 w-4 text-blue-500" />
          {mode === 'growth' ? 'Annual Contributions' : 'Annual Withdrawals'}
        </CardTitle>
      </CardHeader>
      <CardContent>
         <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis 
                  dataKey="year" 
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tickLine={false}
                  tickFormatter={(val) => formatCurrency(val, true, 0, true)}
                  tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                  width={40}
                />
                <Tooltip 
                   formatter={(val: number) => formatCurrency(val)}
                   labelFormatter={(label) => `Year ${label}`}
                   contentStyle={{ 
                     backgroundColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--card))', 
                     borderColor: 'hsl(var(--border))',
                     borderRadius: 'var(--radius)',
                     fontSize: '12px'
                   }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: '10px' }} />
                <Line 
                  type="monotone"
                  dataKey="nominal" 
                  name={`Nominal (Future ${currencySymbol})`}
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone"
                  dataKey="real" 
                  name={`Real (Today's ${currencySymbol})`} 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
         </div>
         <p className="text-[10px] text-muted-foreground text-center mt-2">
            Green represent purchasing power in today's money, while blue show the actual future dollar amount needed.
         </p>
      </CardContent>
    </Card>
  )
}