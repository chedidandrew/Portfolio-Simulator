'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Landmark, PiggyBank, Scale, ShieldCheck, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrency } from '@/components/currency-provider'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import {
  getInvestVsDebtValidationErrors,
  type InvestVsDebtInputs,
  type InvestVsDebtResult,
} from '@/lib/financial-tools/invest-vs-debt'
import {
  INVEST_VS_DEBT_STORAGE_KEY,
  useFinancialProfile,
} from '@/components/financial-tools/financial-profile-provider'

interface InvestVsDebtToolState {
  expectedReturn: number
  volatility: number
  scenarios: number
  seed: string
}

type WorkerResponse =
  | { id: number; type: 'progress'; completed: number; total: number }
  | { id: number; type: 'result'; result: InvestVsDebtResult }
  | { id: number; type: 'error'; message: string }

function isValidInvestVsDebtToolState(value: unknown): value is InvestVsDebtToolState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.expectedReturn === 'number'
    && candidate.expectedReturn > -100
    && candidate.expectedReturn <= 100
    && typeof candidate.volatility === 'number'
    && candidate.volatility >= 0
    && candidate.volatility <= 200
    && typeof candidate.scenarios === 'number'
    && Number.isInteger(candidate.scenarios)
    && [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000].includes(candidate.scenarios)
    && typeof candidate.seed === 'string'
    && candidate.seed.length >= 1
    && candidate.seed.length <= 100
  )
}

export function InvestVsDebtCalculator() {
  const { currency } = useCurrency()
  const { profile, setProfile } = useFinancialProfile()
  const symbol = getAppCurrency().symbol
  const [toolState, setToolState] = useLocalStorage<InvestVsDebtToolState>(
    INVEST_VS_DEBT_STORAGE_KEY,
    {
      expectedReturn: 8,
      volatility: 18,
      scenarios: 1_000,
      seed: 'portfolio-simulator-invest-vs-debt-v1',
    },
    { validatePersisted: isValidInvestVsDebtToolState },
  )
  const [result, setResult] = useState<InvestVsDebtResult | null>(null)
  const [resultKey, setResultKey] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [runError, setRunError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const runIdRef = useRef(0)

  const inputs = useMemo<InvestVsDebtInputs>(() => ({
    loanBalance: profile.loanBalance,
    loanApr: profile.loanApr,
    remainingMonths: profile.remainingMonths,
    firstPaymentMonth: profile.firstPaymentMonth,
    extraMonthlyCash: profile.extraMonthlyPayment,
    lumpSums: profile.lumpSums,
    expectedReturn: toolState.expectedReturn,
    volatility: toolState.volatility,
    scenarios: toolState.scenarios,
    seed: toolState.seed,
  }), [profile, toolState])
  const inputsKey = useMemo(() => JSON.stringify(inputs), [inputs])
  const validationErrors = useMemo(() => getInvestVsDebtValidationErrors(inputs), [inputs])
  const currentResult = resultKey === inputsKey ? result : null
  const lumpSumTotal = profile.lumpSums.reduce((sum, payment) => sum + payment.amount, 0)

  const runComparison = useCallback(() => {
    if (validationErrors.length > 0 || typeof Worker === 'undefined') return

    workerRef.current?.terminate()
    const worker = new Worker(new URL('./invest-vs-debt-worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    const id = runIdRef.current + 1
    runIdRef.current = id
    setIsRunning(true)
    setProgress(0)
    setRunError(null)

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== runIdRef.current) return
      if (event.data.type === 'progress') {
        setProgress(Math.min(100, Math.round((event.data.completed / event.data.total) * 100)))
        return
      }
      if (event.data.type === 'result') {
        setResult(event.data.result)
        setResultKey(inputsKey)
        setProgress(100)
        setIsRunning(false)
        worker.terminate()
        if (workerRef.current === worker) workerRef.current = null
        return
      }
      setRunError(event.data.message)
      setIsRunning(false)
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }

    worker.onerror = (event) => {
      if (id !== runIdRef.current) return
      setRunError(event.message || 'The comparison could not be completed.')
      setIsRunning(false)
      worker.terminate()
      if (workerRef.current === worker) workerRef.current = null
    }

    worker.postMessage({ id, inputs })
  }, [inputs, inputsKey, validationErrors])

  useEffect(() => () => workerRef.current?.terminate(), [])

  useEffect(() => {
    if (validationErrors.length > 0) {
      workerRef.current?.terminate()
      workerRef.current = null
      setIsRunning(false)
      setProgress(0)
      setRunError(null)
      return
    }
    if (inputs.scenarios >= 50_000) {
      workerRef.current?.terminate()
      workerRef.current = null
      setIsRunning(false)
      setProgress(0)
      return
    }
    const timer = window.setTimeout(runComparison, 120)
    return () => window.clearTimeout(timer)
  }, [inputs.scenarios, inputsKey, runComparison, validationErrors.length])

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-fit min-w-0">
          <CardHeader><CardTitle>Your decision</CardTitle><CardDescription>Use the same recurring and one-time extra cash under both strategies so the comparison stays fair.</CardDescription></CardHeader>
          <CardContent className="min-w-0 space-y-5">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label="Loan balance" suffix={symbol}>
                <NumericInput min={1} max={1_000_000_000} step={1000} value={profile.loanBalance} onChange={(value) => setProfile((current) => ({ ...current, loanBalance: value }))} />
              </Field>
              <Field label="Loan APR" suffix="%">
                <NumericInput min={0} max={100} step={0.01} value={profile.loanApr} onChange={(value) => setProfile((current) => ({ ...current, loanApr: value }))} />
              </Field>
              <Field label="Remaining term" suffix="years">
                <NumericInput min={1} max={50} step={0.5} value={profile.remainingMonths / 12} onChange={(years) => setProfile((current) => ({ ...current, remainingMonths: Math.max(1, Math.min(600, Math.round(years * 12))) }))} />
              </Field>
              <Field label="Extra cash each month" suffix={symbol}>
                <NumericInput min={0} max={1_000_000_000} step={50} value={profile.extraMonthlyPayment} onChange={(value) => setProfile((current) => ({ ...current, extraMonthlyPayment: value }))} />
              </Field>
            </div>

            {profile.lumpSums.length > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">{profile.lumpSums.length}</strong> saved one-time cash {profile.lumpSums.length === 1 ? 'event is' : 'events are'} included, totaling <strong className="text-foreground">{formatCurrency(lumpSumTotal, true, 2, false)}</strong>. Edit their dates or amounts in the Loan Calculator.
              </div>
            )}

            <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><TrendingUp className="h-4 w-4" /></div><div className="min-w-0"><p className="font-medium">Investment assumptions</p><p className="text-xs text-muted-foreground">Seeded lognormal scenarios use the same return path for both strategies.</p></div></div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="Median geometric return assumption" suffix="%">
                  <NumericInput min={-99.99} max={100} step={0.1} value={toolState.expectedReturn} onChange={(value) => setToolState((current) => ({ ...current, expectedReturn: value }))} />
                </Field>
                <Field label="Annual volatility" suffix="%">
                  <NumericInput min={0} max={200} step={0.5} value={toolState.volatility} onChange={(value) => setToolState((current) => ({ ...current, volatility: value }))} />
                </Field>
                <div className="min-w-0 space-y-1.5 sm:col-span-2">
                  <Label htmlFor="invest-debt-scenarios">Scenarios</Label>
                  <Select
                    value={toolState.scenarios.toString()}
                    onValueChange={(value) => setToolState((current) => ({ ...current, scenarios: Number(value) }))}
                  >
                    <SelectTrigger id="invest-debt-scenarios" className="min-w-0 max-w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 scenarios</SelectItem>
                      <SelectItem value="500">500 scenarios</SelectItem>
                      <SelectItem value="1000">1,000 scenarios</SelectItem>
                      <SelectItem value="5000">5,000 scenarios</SelectItem>
                      <SelectItem value="10000">10,000 scenarios</SelectItem>
                      <SelectItem value="50000">50,000 scenarios</SelectItem>
                      <SelectItem value="100000">100,000 scenarios</SelectItem>
                    </SelectContent>
                  </Select>
                  {toolState.scenarios >= 50_000 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-medium text-orange-600 dark:text-orange-400">Large runs reduce sampling noise but are started manually so they never freeze the page while you edit assumptions.</p>
                      <Button type="button" variant="outline" className="w-full" disabled={isRunning || validationErrors.length > 0} onClick={runComparison}>
                        {isRunning ? `Running ${progress}%` : `${currentResult ? 'Run again' : 'Run'} ${toolState.scenarios.toLocaleString()} scenarios`}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {isRunning && (
                <div className="mt-4 space-y-1.5" aria-live="polite">
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Running comparison in background</span><span>{progress}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
                </div>
              )}
              {runError && <p role="alert" className="mt-3 text-xs text-destructive">{runError}</p>}
            </div>
          </CardContent>
        </Card>

        {currentResult ? (
          <div className="min-w-0 space-y-6">
            <Card className="border-primary/25">
              <CardHeader className="pb-3">
                <CardDescription>Probability investing the extra cash finishes ahead</CardDescription>
                <CardTitle className="text-4xl tracking-tight text-primary sm:text-5xl">{currentResult.probabilityInvestFirstAhead.toFixed(1)}%</CardTitle>
                <p className="text-sm text-muted-foreground">Across {currentResult.scenarios.toLocaleString()} seeded market scenarios over the remaining loan term.</p>
              </CardHeader>
              <CardContent><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Metric icon={PiggyBank} label="Median invest-first value" value={formatCurrency(currentResult.medianInvestFirst, true, 2, false)} /><Metric icon={Landmark} label="Median debt-first value" value={formatCurrency(currentResult.medianDebtFirst, true, 2, false)} /><Metric icon={ShieldCheck} label="Interest saved debt-first" value={formatCurrency(currentResult.interestSavedByDebtFirst, true, 2, false)} /><Metric icon={Scale} label="Debt-first payoff" value={`${currentResult.acceleratedPayoffMonths} months`} /></div></CardContent>
            </Card>

            <Card><CardHeader><CardTitle>Deterministic comparison</CardTitle><CardDescription>Uses the entered median geometric return assumption every year without market randomness.</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-4 sm:grid-cols-2"><Plan title="Invest the extra cash" value={currentResult.deterministicInvestFirst} /><Plan title="Pay debt first, then invest" value={currentResult.deterministicDebtFirst} emphasized /></CardContent></Card>
          </div>
        ) : validationErrors.length > 0 ? (
          <Card className="min-w-0 border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">{validationErrors[0]}</CardContent></Card>
        ) : (
          <Card className="min-w-0 border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">{isRunning ? `Running ${toolState.scenarios.toLocaleString()} scenarios in the background…` : toolState.scenarios >= 50_000 ? `Ready to run ${toolState.scenarios.toLocaleString()} scenarios. Use the Run button under Investment assumptions.` : 'Updating the comparison in the background…'}</CardContent></Card>
        )}
      </div>

      {currentResult && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Outcome spread</CardTitle><CardDescription>Difference is invest-first value minus debt-first value at the end of the modeled horizon.</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-3 sm:grid-cols-3"><Spread label="10th percentile" value={currentResult.p10Difference} /><Spread label="Median" value={currentResult.medianDifference} /><Spread label="90th percentile" value={currentResult.p90Difference} /></CardContent></Card>
      )}

      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">Display currency: {currency}. Loan balance, APR, remaining term, monthly extra cash, and saved one-time cash stay synchronized with the other financial tools. This comparison excludes investment taxes, mortgage-interest deductions, transaction costs, employer matches, and behavioral differences.</p>
    </div>
  )
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return <Label className="block min-w-0 space-y-1.5 font-normal"><span className="flex min-w-0 items-center justify-between gap-2"><span className="font-medium text-foreground">{label}</span>{suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}</span>{children}</Label>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Scale; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/35 p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</div><p className="break-words text-lg font-semibold leading-tight tabular-nums">{value}</p></div>
}

function Plan({ title, value, emphasized = false }: { title: string; value: number; emphasized?: boolean }) {
  return <div className={`min-w-0 rounded-xl border p-4 ${emphasized ? 'border-primary/30 bg-primary/5' : 'bg-muted/15'}`}><p className="text-sm font-medium">{title}</p><p className="mt-2 break-words text-2xl font-bold tabular-nums">{formatCurrency(value, true, 2, false)}</p></div>
}

function Spread({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-xl bg-muted/25 p-4 text-center"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-2 break-words text-xl font-semibold tabular-nums ${value >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{value >= 0 ? '+' : ''}{formatCurrency(value, true, 2, false)}</p></div>
}
