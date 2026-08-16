'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calculator, CircleAlert, PiggyBank, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { triggerHaptic } from '@/hooks/use-haptics'
import type { CashflowFrequency, SimulationParams, WithdrawalState } from '@/lib/types'
import type { CompletedSimulationResults } from '@/hooks/use-monte-carlo'
import {
  estimateSustainableWithdrawal,
  sustainableWithdrawalStartingPortfolio,
  type PlanningEstimateProgress,
  type SustainableWithdrawalAssumptions,
  type SustainableWithdrawalEstimate,
  type SustainableWithdrawalObjective,
} from '@/lib/simulation/planning-insights'
import { dispatchRetirementPlanTransfer } from '@/lib/retirement-plan-transfer'

const PAYOUT_FREQUENCIES: Array<{ value: CashflowFrequency; label: string; unit: string }> = [
  { value: 'yearly', label: 'Yearly', unit: 'year' },
  { value: 'quarterly', label: 'Quarterly', unit: 'quarter' },
  { value: 'monthly', label: 'Monthly', unit: 'month' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
]

function money(value: number): string {
  return formatCurrency(value, true, 0, true)
}

function frequencyUnit(frequency: CashflowFrequency): string {
  return PAYOUT_FREQUENCIES.find((option) => option.value === frequency)?.unit ?? 'period'
}

export function SustainableWithdrawalEstimator({
  params,
  results,
}: {
  params: SimulationParams
  results: CompletedSimulationResults
}) {
  const [expanded, setExpanded] = useState(false)
  const [assumptions, setAssumptions] = useState<SustainableWithdrawalAssumptions>(() => ({
    retirementDuration: 30,
    expectedReturn: 5,
    volatility: 6,
    enableCrashRisk: false,
    inflationAdjustedWithdrawals: true,
    preservationObjective: 'purchasing_power',
    targetSurvivalRate: 90,
    payoutFrequency: 'monthly',
    includeTaxes: Boolean(params.taxEnabled),
  }))
  const [estimate, setEstimate] = useState<SustainableWithdrawalEstimate | null>(null)
  const [progress, setProgress] = useState<PlanningEstimateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const source = useMemo(
    () => sustainableWithdrawalStartingPortfolio(params, results),
    [params, results],
  )
  const assumptionKey = JSON.stringify(assumptions)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    controllerRef.current?.abort()
    setEstimate(null)
    setProgress(null)
    setError(null)
  }, [assumptionKey, params, results.simulationSeed])

  const update = <K extends keyof SustainableWithdrawalAssumptions>(
    key: K,
    value: SustainableWithdrawalAssumptions[K],
  ) => setAssumptions((current) => ({ ...current, [key]: value }))

  const calculate = async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setEstimate(null)
    setError(null)
    setProgress({
      fraction: 0.01,
      completedRuns: 0,
      estimatedRuns: 1,
      phase: 'preparing',
      detail: 'Preparing the retirement income search...',
    })

    try {
      const next = await estimateSustainableWithdrawal(
        params,
        results,
        assumptions,
        `${results.simulationSeed}:sustainable-withdrawal:${assumptionKey}`,
        { signal: controller.signal, onProgress: setProgress },
      )
      if (!controller.signal.aborted) setEstimate(next)
    } catch (caught: unknown) {
      const name = caught instanceof Error ? caught.name : undefined
      if (name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'The retirement income estimate could not be completed.')
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      if (!controller.signal.aborted) setProgress(null)
    }
  }

  const cancel = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setProgress(null)
  }

  const applyEstimate = () => {
    if (!estimate) return
    triggerHaptic('medium')
    const includeTaxes = estimate.includeTaxes
    const state: WithdrawalState = {
      startingBalance: estimate.startingPortfolio,
      startingCostBasis: params.taxType === 'tax_deferred' ? undefined : estimate.startingPortfolio,
      costBasisIsUserEdited: false,
      annualReturn: estimate.expectedReturn,
      duration: estimate.retirementDuration,
      periodicWithdrawal: estimate.selectedPayoutAmount,
      inflationAdjustment: params.inflationAdjustment ?? 0,
      frequency: estimate.payoutFrequency,
      excludeInflationAdjustment: !estimate.inflationAdjustedWithdrawals,
      taxEnabled: includeTaxes,
      taxRate: includeTaxes ? params.taxRate : 0,
      taxType: includeTaxes ? params.taxType : 'capital_gains',
      calculationMode: params.calculationMode,
    }
    const retirementParams: SimulationParams = {
      initialValue: state.startingBalance,
      startingCostBasis: state.startingCostBasis,
      costBasisIsUserEdited: false,
      expectedReturn: state.annualReturn,
      volatility: estimate.volatility,
      enableCrashRisk: estimate.enableCrashRisk,
      duration: state.duration,
      cashflowAmount: state.periodicWithdrawal,
      cashflowFrequency: state.frequency,
      inflationAdjustment: state.inflationAdjustment,
      excludeInflationAdjustment: state.excludeInflationAdjustment,
      numPaths: params.numPaths,
      taxEnabled: state.taxEnabled,
      taxRate: state.taxRate,
      taxType: state.taxType,
      calculationMode: state.calculationMode,
    }
    const requestId = `retirement-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`
    dispatchRetirementPlanTransfer({
      requestId,
      seed: `${results.simulationSeed}:retirement-plan:${requestId}`,
      state,
      params: retirementParams,
    })
    toast('Retirement estimate applied. Running the withdrawal simulation.')
  }

  return (
    <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4" aria-labelledby="retirement-income-title">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
          <PiggyBank className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="retirement-income-title" className="font-semibold">Retirement Income Estimate</h3>
          <p className="text-xs text-muted-foreground">
            Estimate a withdrawal level designed to meet a survival target and preserve the selected ending-balance objective.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Hide' : 'Calculate'}
        </Button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Retirement years">
              <input
                aria-label="Retirement years"
                type="number"
                min={1}
                max={200}
                value={assumptions.retirementDuration}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => update('retirementDuration', Math.min(200, Math.max(1, Number(event.target.value) || 1)))}
              />
            </Field>
            <Field label="Expected return (%)">
              <input
                aria-label="Retirement expected return"
                type="number"
                min={-99}
                max={100000}
                step="0.1"
                value={assumptions.expectedReturn}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => update('expectedReturn', Number(event.target.value) || 0)}
              />
            </Field>
            <Field label="Volatility (%)">
              <input
                aria-label="Retirement volatility"
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={assumptions.volatility}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => update('volatility', Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
              />
            </Field>
            <Field label="Payout frequency">
              <select
                aria-label="Retirement payout frequency"
                value={assumptions.payoutFrequency}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => update('payoutFrequency', event.target.value as CashflowFrequency)}
              >
                {PAYOUT_FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preservation objective">
              <select
                aria-label="Preservation objective"
                value={assumptions.preservationObjective}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => update('preservationObjective', event.target.value as SustainableWithdrawalObjective)}
              >
                <option value="purchasing_power">Preserve purchasing power</option>
                <option value="nominal_principal">Preserve nominal principal</option>
              </select>
            </Field>
            <Field label="Modeled survival target">
              <select
                aria-label="Modeled survival target"
                value={assumptions.targetSurvivalRate}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => update('targetSurvivalRate', Number(event.target.value))}
              >
                <option value={80}>80%</option>
                <option value={90}>90%</option>
                <option value={95}>95%</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleRow
              id="retirement-inflation-adjusted"
              label="Inflation-adjust withdrawals"
              checked={assumptions.inflationAdjustedWithdrawals}
              onCheckedChange={(value) => update('inflationAdjustedWithdrawals', value)}
            />
            <ToggleRow
              id="retirement-crash-risk"
              label="Include crash stress"
              checked={assumptions.enableCrashRisk}
              onCheckedChange={(value) => update('enableCrashRisk', value)}
            />
            <ToggleRow
              id="retirement-tax-settings"
              label="Carry tax settings"
              checked={assumptions.includeTaxes}
              disabled={!params.taxEnabled}
              onCheckedChange={(value) => update('includeTaxes', value)}
            />
          </div>

          <div className="rounded-lg bg-background/70 p-3 text-xs text-muted-foreground">
            Estimated starting portfolio: <span className="font-semibold text-foreground">{money(source.value)}</span>
            {source.usesGrossTaxDeferredBalance && (
              <span> using the gross tax-deferred median so the accumulation result is not taxed twice during the handoff.</span>
            )}
          </div>

          {progress && (
            <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-background/70 p-3" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${Math.max(2, progress.fraction * 100)}%` }}
                />
              </div>
              <div className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold">Estimated {Math.round(progress.fraction * 100)}% complete</p>
                  <p className="text-muted-foreground">{progress.detail}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={cancel} aria-label="Cancel retirement income estimate">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {estimate && (
            <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-background/70 p-3" aria-live="polite">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <EstimateMetric
                  label="Estimated Withdrawal"
                  value={`${money(estimate.selectedPayoutAmount)} / ${frequencyUnit(estimate.payoutFrequency)}`}
                  tone="text-emerald-700 dark:text-emerald-300"
                />
                <EstimateMetric label="Annual Withdrawal" value={money(estimate.annualWithdrawal)} />
                <EstimateMetric label="Initial Withdrawal Rate" value={`${estimate.withdrawalRate.toFixed(2)}%`} />
                <EstimateMetric label="Modeled Survival" value={`${estimate.survivalRate.toFixed(1)}%`} />
                <EstimateMetric label="Median Ending Balance" value={money(estimate.medianEndingBalance)} />
                <EstimateMetric label="Preservation Target" value={money(estimate.preservationTarget)} />
                <EstimateMetric label="Retirement Duration" value={`${estimate.retirementDuration} years`} />
                <EstimateMetric label="Scenarios Per Test" value={estimate.scenariosUsed.toLocaleString()} />
              </div>

              {estimate.monthlyWithdrawal <= 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-orange-800 dark:text-orange-200">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>The selected preservation and survival targets are not met even at a zero withdrawal under these assumptions.</span>
                </div>
              )}

              <Button type="button" className="w-full" disabled={estimate.monthlyWithdrawal <= 0 || estimate.capped} onClick={applyEstimate}>
                Apply to Withdrawal Simulation
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300" role="alert">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {!progress && (
            <Button type="button" variant={estimate ? 'outline' : 'default'} className="w-full" onClick={calculate}>
              <Calculator className="mr-2 h-4 w-4" aria-hidden="true" />
              {estimate ? 'Recalculate retirement income' : 'Estimate sustainable withdrawal'}
            </Button>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The estimator searches for the highest withdrawal that meets both the selected survival target and median ending-balance objective. It uses a bounded seeded scenario set for planning speed, then the Apply button runs your normal full withdrawal simulation. Educational only, not financial advice.
          </p>
        </div>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border bg-background/70 p-3">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function EstimateMetric({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold sm:text-base ${tone}`}>{value}</p>
    </div>
  )
}
