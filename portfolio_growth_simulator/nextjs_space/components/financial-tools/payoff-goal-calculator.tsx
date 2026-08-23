'use client'

import { useMemo, useState } from 'react'
import { CalendarCheck2, CheckCircle2, Gauge, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrency } from '@/components/currency-provider'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { addMonths, calculateLoan, type LoanInputs } from '@/lib/loan/loan-engine'
import { estimatePayoffGoal } from '@/lib/financial-tools/payoff-goal'

function nextMonth(): string {
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return addMonths(current, 1)
}

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

export function PayoffGoalCalculator() {
  const { currency } = useCurrency()
  const symbol = getAppCurrency().symbol
  const firstPayment = useMemo(() => nextMonth(), [])
  const [inputs, setInputs] = useState<LoanInputs>({
    principal: 350_000,
    apr: 6.5,
    termMonths: 360,
    firstPaymentMonth: firstPayment,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })
  const [targetMonth, setTargetMonth] = useState(() => addMonths(firstPayment, 179))

  const lastScheduledMonth = useMemo(() => {
    try {
      return addMonths(inputs.firstPaymentMonth, Math.max(0, inputs.termMonths - 1))
    } catch {
      return ''
    }
  }, [inputs.firstPaymentMonth, inputs.termMonths])

  const estimate = useMemo(() => {
    try {
      return estimatePayoffGoal(inputs, targetMonth)
    } catch {
      return null
    }
  }, [inputs, targetMonth])

  const baseline = useMemo(() => {
    try {
      return calculateLoan({ ...inputs, extraMonthlyPayment: 0 })
    } catch {
      return null
    }
  }, [inputs])

  const totalMonthly = estimate && baseline ? baseline.scheduledPayment + estimate.requiredExtraMonthlyPayment : 0
  const interestSaved = estimate && baseline ? Math.max(0, baseline.totalInterest - estimate.projected.totalInterest) : 0
  const monthsSaved = estimate && baseline ? Math.max(0, baseline.paymentCount - estimate.projected.paymentCount) : 0

  const applyToLoan = () => {
    if (!estimate) return
    const scenario: LoanInputs = { ...inputs, extraMonthlyPayment: estimate.requiredExtraMonthlyPayment }
    try {
      localStorage.setItem('portfolio-sim-loan-state', JSON.stringify(scenario))
    } catch {}
    window.location.assign('/loan')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Payoff goal</CardTitle>
          <CardDescription>Choose when you want the loan gone. The calculator solves for the minimum recurring extra payment to reach that month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loan balance" suffix={symbol}><Input type="number" min="1" step="1000" value={inputs.principal} onChange={(event) => setInputs({ ...inputs, principal: Number(event.target.value) || 0 })} /></Field>
            <Field label="APR" suffix="%"><Input type="number" min="0" max="100" step="0.01" value={inputs.apr} onChange={(event) => setInputs({ ...inputs, apr: Number(event.target.value) || 0 })} /></Field>
            <Field label="Remaining term" suffix="years"><Input type="number" min="1" max="50" step="0.5" value={inputs.termMonths / 12} onChange={(event) => setInputs({ ...inputs, termMonths: Math.max(1, Math.round((Number(event.target.value) || 0) * 12)) })} /></Field>
            <Field label="First payment month"><Input type="month" value={inputs.firstPaymentMonth} onChange={(event) => setInputs({ ...inputs, firstPaymentMonth: event.target.value })} /></Field>
            <Field label="Target payoff month"><Input type="month" min={inputs.firstPaymentMonth || undefined} max={lastScheduledMonth || undefined} value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} /></Field>
            <Field label="Already paying extra" suffix={symbol}><Input type="number" min="0" step="50" value={inputs.extraMonthlyPayment} onChange={(event) => setInputs({ ...inputs, extraMonthlyPayment: Number(event.target.value) || 0 })} /></Field>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">This planner solves recurring monthly extra principal. One-time lump sums remain available in the full Loan Calculator.</p>
        </CardContent>
      </Card>

      {estimate && baseline ? (
        <div className="space-y-6">
          <Card className="border-primary/25">
            <CardHeader className="pb-3">
              <CardDescription>Required recurring extra payment</CardDescription>
              <CardTitle className="text-4xl tracking-tight text-primary sm:text-5xl">{formatCurrency(estimate.requiredExtraMonthlyPayment, true, 2, false)}</CardTitle>
              <p className="text-sm text-muted-foreground">Total planned monthly outflow: <strong className="text-foreground">{formatCurrency(totalMonthly, true, 2, false)}</strong></p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric icon={CalendarCheck2} label="Target payoff" value={formatMonth(estimate.projected.payoffMonth)} />
                <Metric icon={Gauge} label="Interest saved" value={formatCurrency(interestSaved, true, 2, false)} />
                <Metric icon={Sparkles} label="Time saved" value={monthsLabel(monthsSaved)} />
                <Metric icon={CheckCircle2} label="Current plan" value={estimate.currentPlanMeetsTarget ? 'Already meets goal' : `Needs ${formatCurrency(estimate.additionalExtraMonthlyPayment, true, 2, false)} more`} />
              </div>
            </CardContent>
          </Card>
          <Button type="button" size="lg" className="w-full sm:w-auto" onClick={applyToLoan}>Use this payment in Loan Calculator</Button>
          <p className="text-xs text-muted-foreground">Display currency: {currency}. Symbols change only; values are not converted using exchange rates.</p>
        </div>
      ) : (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Enter a target month inside the scheduled loan term.</CardContent></Card>
      )}
    </div>
  )
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <Label className="block space-y-1.5 font-normal">
      <span className="flex items-center justify-between gap-2"><span className="font-medium text-foreground">{label}</span>{suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}</span>
      {children}
    </Label>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="rounded-xl bg-muted/35 p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" /> {label}</div><p className="text-lg font-semibold leading-tight tabular-nums">{value}</p></div>
}
