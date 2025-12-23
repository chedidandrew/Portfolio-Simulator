'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowLeftRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { formatCurrency } from '@/lib/utils'
import { SimulationParams } from '@/lib/types'

export function CashflowChart({ params, mode }: { params: SimulationParams, mode: string }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  const inflation = params.inflationAdjustment ?? 0
  const baseAnnual = params.cashflowFrequency === 'monthly' ? params.cashflowAmount * 12 : params.cashflowAmount
  const steps = Math.min(params.duration, 30) // Cap at 30 bars for readability
  
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
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
                <Bar 
                  dataKey="nominal" 
                  name="Nominal (Future $)" 
                  fill="#3b82f6" 
                  radius={[2, 2, 0, 0]} 
                  fillOpacity={0.8}
                />
                <Bar 
                  dataKey="real" 
                  name="Real (Today's $)" 
                  fill="#10b981" 
                  radius={[2, 2, 0, 0]} 
                  fillOpacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
         </div>
         <p className="text-[10px] text-muted-foreground text-center mt-2">
            The green bars represent purchasing power in today's money, while blue bars show the actual future dollar amount needed.
         </p>
      </CardContent>
    </Card>
  )
}