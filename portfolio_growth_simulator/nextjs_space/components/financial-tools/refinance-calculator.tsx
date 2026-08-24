'use client'

import { useMemo } from 'react'
import { CalendarDays, CircleDollarSign, Gauge, Scale } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCurrency } from '@/components/currency-provider'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { compareRefinance, type RefinanceInputs } from '@/lib/financial-tools/refinance'
import {
  REFINANCE_STORAGE_KEY,
  useFinancialProfile,
} from '@/components/financial-tools/financial-profile-provider'

function monthLabel(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

function monthsLabel(months: number): string {
  const abs = Math.abs(months)
  const years = Math.floor(abs / 12)
  const remainder = abs % 12
  const value = years > 0 ? `${years}y${remainder ? ` ${remainder}m` : ''}` : `${remainder}m`
  return months > 0 ? `${value} sooner` : months < 0 ? `${value} later` : 'Same payoff'
}

interface RefinanceToolState {
  newApr: number
  newTermMonths: number
  closingCosts: number
  financeClosingCosts: boolean
}

function isValidRefinanceToolState(value: unknown): value is RefinanceToolState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.newApr === 'number'
    && candidate.newApr >= 0
    && candidate.newApr <= 100
    && typeof candidate.newTermMonths === 'number'
    && Number.isInteger(candidate.newTermMonths)
    && candidate.newTermMonths >= 1
    && candidate.newTermMonths <= 600
    && typeof candidate.closingCosts === 'number'
    && candidate.closingCosts >= 0
    && candidate.closingCosts <= 1_000_000_000
    && typeof candidate.financeClosingCosts === 'boolean'
  )
}

export function RefinanceCalculator() {
  const { currency } = useCurrency()
  const { profile, setProfile } = useFinancialProfile()
  const symbol = getAppCurrency().symbol
  const [toolState, setToolState] = useLocalStorage<RefinanceToolState>(
    REFINANCE_STORAGE_KEY,
    {
      newApr: 5.75,
      newTermMonths: 300,
      closingCosts: 6_000,
      financeClosingCosts: false,
    },
    { validatePersisted: isValidRefinanceToolState },
  )

  const inputs = useMemo<RefinanceInputs>(() => ({
    balance: profile.loanBalance,
    currentApr: profile.loanApr,
    remainingMonths: profile.remainingMonths,
    currentExtraMonthlyPayment: profile.extraMonthlyPayment,
    currentLumpSums: profile.lumpSums,
    newApr: toolState.newApr,
    newTermMonths: toolState.newTermMonths,
    closingCosts: toolState.closingCosts,
    financeClosingCosts: toolState.financeClosingCosts,
    firstPaymentMonth: profile.firstPaymentMonth,
  }), [profile, toolState])

  const result = useMemo(() => {
    try {
      return compareRefinance(inputs)
    } catch {
      return null
    }
  }, [inputs])

  const lumpSumTotal = profile.lumpSums.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit min-w-0">
        <CardHeader>
          <CardTitle>Refinance details</CardTitle>
          <CardDescription>Compare a proposed replacement loan with both the required payment and your saved accelerated current-loan plan.</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Remaining balance" suffix={symbol}>
              <NumericInput min={1} max={1_000_000_000} step={1000} value={profile.loanBalance} onChange={(value) => setProfile((current) => ({ ...current, loanBalance: value }))} />
            </Field>
            <Field label="Current APR" suffix="%">
              <NumericInput min={0} max={100} step={0.01} value={profile.loanApr} onChange={(value) => setProfile((current) => ({ ...current, loanApr: value }))} />
            </Field>
            <Field label="Remaining term" suffix="years">
              <NumericInput min={1} max={50} step={0.5} value={profile.remainingMonths / 12} onChange={(years) => setProfile((current) => ({ ...current, remainingMonths: Math.max(1, Math.min(600, Math.round(years * 12))) }))} />
            </Field>
            <Field label="First payment month">
              <Input className="financial-month-input" type="month" value={profile.firstPaymentMonth} onChange={(event) => event.target.value && setProfile((current) => ({ ...current, firstPaymentMonth: event.target.value }))} />
            </Field>
          </div>

          {(profile.extraMonthlyPayment > 0 || profile.lumpSums.length > 0) && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-relaxed text-muted-foreground">
              Your current-plan comparison includes <strong className="text-foreground">{formatCurrency(profile.extraMonthlyPayment, true, 2, false)}</strong> of recurring extra principal
              {profile.lumpSums.length > 0 && <> plus <strong className="text-foreground">{profile.lumpSums.length}</strong> saved one-time {profile.lumpSums.length === 1 ? 'payment' : 'payments'} totaling <strong className="text-foreground">{formatCurrency(lumpSumTotal, true, 2, false)}</strong></>}.
            </div>
          )}

          <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
            <p className="mb-4 font-medium">Proposed refinance</p>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label="New APR" suffix="%">
                <NumericInput min={0} max={100} step={0.01} value={toolState.newApr} onChange={(value) => setToolState((current) => ({ ...current, newApr: value }))} />
              </Field>
              <Field label="New term" suffix="years">
                <NumericInput min={1} max={50} step={0.5} value={toolState.newTermMonths / 12} onChange={(years) => setToolState((current) => ({ ...current, newTermMonths: Math.max(1, Math.min(600, Math.round(years * 12))) }))} />
              </Field>
              <Field label="Closing costs" suffix={symbol}>
                <NumericInput min={0} max={1_000_000_000} step={500} value={toolState.closingCosts} onChange={(value) => setToolState((current) => ({ ...current, closingCosts: value }))} />
              </Field>
              <div className="flex min-w-0 items-end pb-1">
                <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2.5">
                  <div className="min-w-0"><Label htmlFor="finance-costs">Finance costs</Label><p className="text-xs text-muted-foreground">Add costs to the new balance</p></div>
                  <Switch id="finance-costs" checked={toolState.financeClosingCosts} onCheckedChange={(checked) => setToolState((current) => ({ ...current, financeClosingCosts: checked }))} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <div className="min-w-0 space-y-6">
          <Card className={result.lifetimeSavings >= 0 ? 'border-emerald-500/25' : 'border-amber-500/25'}>
            <CardHeader className="pb-3">
              <CardDescription>Estimated lifetime savings vs. your current plan</CardDescription>
              <CardTitle className={`break-words text-4xl tracking-tight sm:text-5xl ${result.lifetimeSavings >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{formatCurrency(result.lifetimeSavings, true, 2, false)}</CardTitle>
              <p className="text-sm text-muted-foreground">A negative value means the refinance costs more than continuing your currently saved payoff plan.</p>
            </CardHeader>
            <CardContent>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Metric icon={CircleDollarSign} label="Required payment savings" value={formatCurrency(result.monthlyPaymentSavings, true, 2, false)} />
                <Metric
                  icon={Gauge}
                  label="Break-even estimate"
                  value={toolState.financeClosingCosts
                    ? 'No upfront break-even'
                    : result.estimatedBreakEvenMonths === null
                      ? 'No payment break-even'
                      : result.estimatedBreakEvenMonths === 0
                        ? 'Immediate'
                        : `${result.estimatedBreakEvenMonths} months`}
                />
                <Metric icon={CalendarDays} label="New payoff" value={monthLabel(result.refinancedPayoffMonth)} />
                <Metric icon={Scale} label="Payoff timing vs. current plan" value={monthsLabel(result.payoffDifferenceMonths)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Side-by-side cost</CardTitle><CardDescription>Closing costs are included in the refinance total whether paid upfront or financed.</CardDescription></CardHeader>
            <CardContent>
              <div className={`grid min-w-0 gap-4 ${result.hasCurrentAcceleration ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <Plan title="Current required plan" paymentLabel="Required payment" payment={result.currentRequired.scheduledPayment} total={result.currentRequiredRemainingCost} interest={result.currentRequired.totalInterest} payoff={result.currentRequiredPayoffMonth} />
                {result.hasCurrentAcceleration && (
                  <Plan title="Your current plan" paymentLabel="Recurring outflow" payment={result.currentRequired.scheduledPayment + profile.extraMonthlyPayment} total={result.currentRemainingCost} interest={result.current.totalInterest} payoff={result.currentPayoffMonth} />
                )}
                <Plan title="Refinance" paymentLabel="Required payment" payment={result.refinanced.scheduledPayment} total={result.refinancedRemainingCost} interest={result.refinanced.totalInterest} payoff={result.refinancedPayoffMonth} emphasized />
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Display currency: {currency}. Required-payment savings compares the two contractual payments. Upfront break-even is not shown when closing costs are financed because there is no initial cash outlay to recover. Tax effects, time value, and equity differences are excluded.</p>
        </div>
      ) : (
        <Card className="min-w-0 border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Enter valid current and proposed loan terms to compare refinancing. Financed principal plus closing costs cannot exceed the supported loan limit.</CardContent></Card>
      )}
    </div>
  )
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return <Label className="block min-w-0 space-y-1.5 font-normal"><span className="flex min-w-0 items-center justify-between gap-2"><span className="font-medium text-foreground">{label}</span>{suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}</span>{children}</Label>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-muted/35 p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</div><p className="break-words text-lg font-semibold leading-tight tabular-nums">{value}</p></div>
}

function Plan({ title, paymentLabel, payment, total, interest, payoff, emphasized = false }: { title: string; paymentLabel: string; payment: number; total: number; interest: number; payoff: string; emphasized?: boolean }) {
  return <div className={`min-w-0 rounded-xl border p-4 ${emphasized ? 'border-primary/30 bg-primary/5' : 'bg-muted/15'}`}><p className="font-medium">{title}</p><dl className="mt-3 space-y-2 text-sm text-muted-foreground"><div className="flex justify-between gap-3"><dt>{paymentLabel}</dt><dd className="break-words text-right text-foreground tabular-nums">{formatCurrency(payment, true, 2, false)}</dd></div><div className="flex justify-between gap-3"><dt>Total remaining cost</dt><dd className="break-words text-right text-foreground tabular-nums">{formatCurrency(total, true, 2, false)}</dd></div><div className="flex justify-between gap-3"><dt>Interest</dt><dd className="break-words text-right text-foreground tabular-nums">{formatCurrency(interest, true, 2, false)}</dd></div><div className="flex justify-between gap-3"><dt>Payoff</dt><dd className="text-right text-foreground">{monthLabel(payoff)}</dd></div></dl></div>
}
