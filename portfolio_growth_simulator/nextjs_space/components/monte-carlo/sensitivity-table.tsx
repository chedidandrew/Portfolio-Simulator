'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { performMonteCarloSimulation } from '@/lib/simulation/monte-carlo-engine'
import { SimulationParams } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Table2 } from 'lucide-react'

interface SensitivityTableProps {
  params: SimulationParams
  mode: 'growth' | 'withdrawal'
  rngSeed?: string | null
}

export function SensitivityTable({ params, mode, rngSeed }: SensitivityTableProps) {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleRunSensitivity = () => {
    setIsLoading(true)
    // Run in a timeout to unblock the UI
    setTimeout(() => {
      const baseCashflow = params.cashflowAmount
      // Variations: -20%, -10%, Current, +10%, +20%
      const variations = [0.8, 0.9, 1.0, 1.1, 1.2] 

      const results = variations.map((modifier) => {
        const testCashflow = baseCashflow * modifier
        // Use fewer paths (200) for speed, it's just an estimate
        const testParams = { ...params, cashflowAmount: testCashflow, numPaths: 200 } 
        const sim = performMonteCarloSimulation(testParams, mode, rngSeed || undefined)
        
        return {
            amount: testCashflow,
            modifier,
            successRate: mode === 'withdrawal' ? sim.solventRate : sim.profitableRate,
            medianEnd: sim.median
        }
      })
      setData(results)
      setIsLoading(false)
    }, 100)
  }

  // Auto-run when relevant params change
  useEffect(() => {
    handleRunSensitivity()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.cashflowAmount, params.initialValue, params.duration, params.expectedReturn, rngSeed])

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          Cashflow Stress Test
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">
            See how small changes to your {mode === 'growth' ? 'contributions' : 'withdrawals'} affect your probability of success.
          </p>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating scenarios...
            </div>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-3 gap-2 text-center mb-2 border-b border-border/50 pb-2">
                  <div className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">Monthly</div>
                  <div className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {mode === 'withdrawal' ? 'Survival' : 'Profit'} %
                  </div>
                  <div className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">Median End</div>
              </div>

              <div className="space-y-1">
                {data.map((row, idx) => (
                    <div 
                      key={idx} 
                      className={`grid grid-cols-3 gap-2 text-center items-center py-1.5 rounded text-xs transition-colors
                        ${Math.abs(row.modifier - 1.0) < 0.01 
                          ? 'bg-primary/10 font-bold text-primary ring-1 ring-primary/20' 
                          : 'hover:bg-muted/50 text-muted-foreground'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-1">
                            {formatCurrency(row.amount)}
                            {Math.abs(row.modifier - 1.0) > 0.01 && (
                                <span className={`text-[9px] px-1 rounded ${row.modifier < 1 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    {row.modifier < 1 ? '-' : '+'}{Math.round(Math.abs(1 - row.modifier) * 100)}%
                                </span>
                            )}
                        </div>
                        <div className={`
                          ${row.successRate >= 90 ? 'text-emerald-500' : 
                            row.successRate >= 70 ? 'text-yellow-500' : 'text-red-500'}
                        `}>
                            {row.successRate.toFixed(0)}%
                        </div>
                        {/* UPDATED: Increased text size here */}
                        <div className="font-semibold text-[11px] sm:text-xs tracking-tight truncate">
                            {formatCurrency(row.medianEnd, true, 0, false)}
                        </div>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}