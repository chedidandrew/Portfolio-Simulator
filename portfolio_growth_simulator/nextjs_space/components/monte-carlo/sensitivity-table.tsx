'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SimulationParams } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Loader2, Table2 } from 'lucide-react'
import { runMonteCarloOffMainThread } from '@/lib/simulation/monte-carlo-client'

export interface SensitivityResult {
  amount: number
  modifier: number
  successRate: number
  medianEndingValue: number
}

export const SENSITIVITY_SCENARIO_COUNT = 200

export function cashflowFrequencyLabel(frequency: SimulationParams['cashflowFrequency']): string {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1)
}

export interface SensitivityTableProps {
  params: SimulationParams
  mode: 'growth' | 'withdrawal'
  rngSeed?: string | null
  runSimulation?: typeof runMonteCarloOffMainThread
}

export function SensitivityTable({
  params,
  mode,
  rngSeed,
  runSimulation = runMonteCarloOffMainThread,
}: SensitivityTableProps) {
  const [data, setData] = useState<SensitivityResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const controller = new AbortController()
    const runSensitivity = async () => {
      setIsLoading(true)
      setError(null)
      const currentParams = paramsRef.current
      const baseCashflow = currentParams.cashflowAmount
      const variations = [0.8, 0.9, 1.0, 1.1, 1.2]
      const completedSeed = rngSeed || 'portfolio-simulator'

      const results: SensitivityResult[] = []
      for (const modifier of variations) {
        const testCashflow = baseCashflow * modifier
        const testParams: SimulationParams = {
          ...currentParams,
          cashflowAmount: testCashflow,
          numPaths: SENSITIVITY_SCENARIO_COUNT,
        }
        const sim = await runSimulation(testParams, mode, completedSeed, controller.signal)

        results.push({
          amount: testCashflow,
          modifier,
          successRate: mode === 'withdrawal' ? sim.solventRate : sim.profitableRate,
          medianEndingValue: sim.median,
        })
      }
      if (!controller.signal.aborted) setData(results)
    }

    void runSensitivity()
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Sensitivity analysis could not be completed.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [
    mode,
    params.initialValue,
    params.startingCostBasis,
    params.expectedReturn,
    params.volatility,
    params.duration,
    params.cashflowAmount,
    params.cashflowFrequency,
    params.inflationAdjustment,
    params.excludeInflationAdjustment,
    params.taxEnabled,
    params.taxType,
    params.taxRate,
    params.calculationMode,
    params.enableCrashRisk,
    rngSeed,
    runSimulation,
  ])

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
            See how small changes to your {mode === 'growth' ? 'contributions' : 'withdrawals'} affect your probability of success. Each row uses a reduced {SENSITIVITY_SCENARIO_COUNT}-scenario run with the completed simulation seed.
          </p>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculating scenarios...
            </div>
          ) : error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>
          ) : (
            <div className="w-full">
              <div className="grid grid-cols-3 gap-2 text-center mb-2 border-b border-border/50 pb-2">
                  <div className="text-[12px] uppercase tracking-wider font-semibold text-muted-foreground">{cashflowFrequencyLabel(params.cashflowFrequency)}</div>
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
                            {formatCurrency(row.medianEndingValue, true, 0, false)}
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
