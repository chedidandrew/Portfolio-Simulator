'use client'

import { useEffect, useMemo } from 'react'
import { CalendarCheck2, CheckCircle2, Gauge, Scale, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { useCurrency } from '@/components/currency-provider'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { addMonths, calculateLoan, type LoanInputs } from '@/lib/loan/loan-engine'
import { estimatePayoffGoal } from '@/lib/financial-tools/payoff-goal'
import {
  PAYOFF_GOAL_STORAGE_KEY,
  financialProfileToLoanInputs,
  useFinancialProfile,
} from '@/components/financial-tools/financial-profile-provider'

function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

function monthsLabel(months: number): string {
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (years === 0) return `${remainder} ${remainder === 1 ? 'month' : 'months'}`
  if (remainder === 0) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years}y ${remainder}m`
}

interface PayoffGoalState {
  targetMonth: string
}

function isValidPayoffGoalState(value: unknown): value is PayoffGoalState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.targetMonth === 'string' && (candidate.targetMonth === '' || /^\d{4}-\d{2}$/.test(candidate.targetMonth))
}

export function PayoffGoalCalculator() {
  const { currency } = useCurrency()
  const { profile, hydrated, setProfile } = useFinancialProfile()
  const symbol = getAppCurrency().symbol
  const inputs = useMemo<LoanInputs>(() => financialProfileToLoanInputs(profile), [profile])
  const [toolState, setToolState] = useLocalStorage<PayoffGoalState>(
    PAYOFF_GOAL_STORAGE_KEY,
    { targetMonth: '' },
    { validatePersisted: isValidPayoffGoalState },
  )
  const targetMonth = toolState.targetMonth

  const lastScheduledMonth = useMemo(() => {
    try {
      return addMonths(inputs.firstPaymentMonth, Math.max(0, inputs.termMonths - 1))
    } catch {
      return ''
    }
  }, [inputs.firstPaymentMonth, inputs.termMonths])

  useEffect(() => {
    if (!hydrated || !inputs.firstPaymentMonth || !lastScheduledMonth) return
    if (!targetMonth) {
      setToolState({ targetMonth: addMonths(inputs.firstPaymentMonth, Math.min(179, Math.max(0, inputs.termMonths - 1))) })
    } else if (targetMonth < inputs.firstPaymentMonth) {
      setToolState({ targetMonth: inputs.firstPaymentMonth })
    } else if (targetMonth > lastScheduledMonth) {
      setToolState({ targetMonth: lastScheduledMonth })
    }
  }, [hydrated, inputs.firstPaymentMonth, inputs.termMonths, lastScheduledMonth, setToolState, targetMonth])

  const estimate = useMemo(() => {
    if (!targetMonth) return null
    try {
      return estimatePayoffGoal(inputs, targetMonth)
    } catch {
      return null
    }
  }, [inputs, targetMonth])

  const baseline = useMemo(() => {
    try {
      return calculateLoan({ ...inputs, extraMonthlyPayment: 0, lumpSums: [] })
    } catch {
      return null
    }
  }, [inputs])

  const totalMonthly = estimate && baseline ? baseline.scheduledPayment + estimate.requiredExtraMonthlyPayment : 0
  const interestSaved = estimate && baseline ? Math.max(0, baseline.totalInterest - estimate.projected.totalInterest) : 0
  const monthsSaved = estimate && baseline ? Math.max(0, baseline.paymentCount - estimate.projected.paymentCount) : 0

  const updateTermYears = (years: number) => {
    const remainingMonths = Math.max(1, Math.min(600, Math.round(years * 12)))
    setProfile((current) => ({ ...current, remainingMonths }))
  }

  const updateFirstPaymentMonth = (value: string) => {
    if (!value) return
    setProfile((current) => ({ ...current, firstPaymentMonth: value }))
  }

  const applyPaymentAndGo = (destination: '/loan' | '/invest-vs-debt') => {
    if (!estimate) return
    setProfile((current) => ({
      ...current,
      extraMonthlyPayment: estimate.requiredExtraMonthlyPayment,
    }))
    window.location.assign(destination)
  }

  const hasComparableExtraCash = Boolean(estimate && (estimate.requiredExtraMonthlyPayment > 0 || inputs.lumpSums.length > 0))

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit min-w-0">
        <CardHeader>
          <CardTitle>Payoff goal</CardTitle>
          <CardDescription>Choose when you want the loan gone. The calculator solves for the minimum recurring extra payment needed alongside your saved one-time principal payments.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Loan balance" suffix={symbol}>
              <NumericInput className="min-w-0" min={1} max={1_000_000_000} step={1000} value={profile.loanBalance} onChange={(value) => setProfile((current) => ({ ...current, loanBalance: value }))} />
            </Field>
            <Field label="APR" suffix="%">
              <NumericInput className="min-w-0" min={0} max={100} step={0.01} value={profile.loanApr} onChange={(value) => setProfile((current) => ({ ...current, loanApr: value }))} />
            </Field>
            <Field label="Remaining term" suffix="years">
              <NumericInput className="min-w-0" min={1} max={50} step={0.5} value={profile.remainingMonths / 12} onChange={updateTermYears} />
            </Field>
            <Field label="First payment month">
              <Input className="financial-month-input" type="month" value={profile.firstPaymentMonth} onChange={(event) => updateFirstPaymentMonth(event.target.value)} />
            </Field>
            <Field label="Target payoff month">
              <Input className="financial-month-input" type="month" min={profile.firstPaymentMonth || undefined} max={lastScheduledMonth || undefined} value={targetMonth} onChange={(event) => setToolState({ targetMonth: event.target.value })} />
            </Field>
            <Field label="Already paying extra" suffix={symbol}>
              <NumericInput className="min-w-0" min={0} max={1_000_000_000} step={50} value={profile.extraMonthlyPayment} onChange={(value) => setProfile((current) => ({ ...current, extraMonthlyPayment: value }))} />
            </Field>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This planner solves recurring monthly extra principal. {inputs.lumpSums.length > 0
              ? `${inputs.lumpSums.length} saved one-time ${inputs.lumpSums.length === 1 ? 'payment is' : 'payments are'} included in the target calculation.`
              : 'One-time payments added in the full Loan Calculator will also be included here.'}
          </p>
        </CardContent>
      </Card>

      {estimate && baseline ? (
        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 border-primary/25">
            <CardHeader className="min-w-0 pb-3">
              <CardDescription>Required recurring extra payment</CardDescription>
              <CardTitle className="break-words text-4xl tracking-tight text-primary sm:text-5xl">{formatCurrency(estimate.requiredExtraMonthlyPayment, true, 2, false)}</CardTitle>
              <p className="text-sm text-muted-foreground">Recurring planned monthly outflow: <strong className="break-words text-foreground">{formatCurrency(totalMonthly, true, 2, false)}</strong></p>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Metric icon={CalendarCheck2} label="Target payoff" value={formatMonth(estimate.projected.payoffMonth)} />
                <Metric icon={Gauge} label="Interest saved" value={formatCurrency(interestSaved, true, 2, false)} />
                <Metric icon={Sparkles} label="Time saved" value={monthsLabel(monthsSaved)} />
                <Metric icon={CheckCircle2} label="Current plan" value={estimate.currentPlanMeetsTarget ? 'Already meets goal' : `Needs ${formatCurrency(estimate.additionalExtraMonthlyPayment, true, 2, false)} more`} />
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" size="lg" className="w-full whitespace-normal" onClick={() => applyPaymentAndGo('/loan')}>Use this payment in Loan Calculator</Button>
            {hasComparableExtraCash && (
              <Button type="button" size="lg" variant="outline" className="w-full whitespace-normal" onClick={() => applyPaymentAndGo('/invest-vs-debt')}>
                <Scale className="mr-2 h-4 w-4" /> Compare this payment vs. investing
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Display currency: {currency}. Symbols change only; values are not converted using exchange rates.</p>
        </div>
      ) : (
        <Card className="min-w-0 border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Enter a target month inside the scheduled loan term.</CardContent></Card>
      )}
    </div>
  )
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <Label className="block min-w-0 space-y-1.5 font-normal">
      <span className="flex min-w-0 items-center justify-between gap-2"><span className="font-medium text-foreground">{label}</span>{suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}</span>
      {children}
    </Label>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/35 p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 shrink-0" /> {label}</div><p className="break-words text-lg font-semibold leading-tight tabular-nums">{value}</p></div>
}
