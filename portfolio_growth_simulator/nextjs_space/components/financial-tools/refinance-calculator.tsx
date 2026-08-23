'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, CircleDollarSign, Gauge, Scale } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCurrency } from '@/components/currency-provider'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { compareRefinance, defaultRefinanceFirstPaymentMonth, type RefinanceInputs } from '@/lib/financial-tools/refinance'

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

export function RefinanceCalculator() {
  const { currency } = useCurrency()
  const symbol = getAppCurrency().symbol
  const [inputs, setInputs] = useState<RefinanceInputs>({
    balance: 300_000,
    currentApr: 7,
    remainingMonths: 300,
    newApr: 5.75,
    newTermMonths: 300,
    closingCosts: 6_000,
    financeClosingCosts: false,
    firstPaymentMonth: defaultRefinanceFirstPaymentMonth(),
  })

  const result = useMemo(() => {
    try {
      return compareRefinance(inputs)
    } catch {
      return null
    }
  }, [inputs])

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Refinance details</CardTitle>
          <CardDescription>Compare the remaining cost of your current fixed-rate loan with a proposed replacement loan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Remaining balance" suffix={symbol}><Input type="number" min="1" step="1000" value={inputs.balance} onChange={(e) => setInputs({ ...inputs, balance: Number(e.target.value) || 0 })} /></Field>
            <Field label="Current APR" suffix="%"><Input type="number" min="0" max="100" step="0.01" value={inputs.currentApr} onChange={(e) => setInputs({ ...inputs, currentApr: Number(e.target.value) || 0 })} /></Field>
            <Field label="Remaining term" suffix="years"><Input type="number" min="1" max="50" step="0.5" value={inputs.remainingMonths / 12} onChange={(e) => setInputs({ ...inputs, remainingMonths: Math.max(1, Math.round((Number(e.target.value) || 0) * 12)) })} /></Field>
            <Field label="First payment month"><Input type="month" value={inputs.firstPaymentMonth} onChange={(e) => setInputs({ ...inputs, firstPaymentMonth: e.target.value })} /></Field>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="mb-4 font-medium">Proposed refinance</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New APR" suffix="%"><Input type="number" min="0" max="100" step="0.01" value={inputs.newApr} onChange={(e) => setInputs({ ...inputs, newApr: Number(e.target.value) || 0 })} /></Field>
              <Field label="New term" suffix="years"><Input type="number" min="1" max="50" step="0.5" value={inputs.newTermMonths / 12} onChange={(e) => setInputs({ ...inputs, newTermMonths: Math.max(1, Math.round((Number(e.target.value) || 0) * 12)) })} /></Field>
              <Field label="Closing costs" suffix={symbol}><Input type="number" min="0" step="500" value={inputs.closingCosts} onChange={(e) => setInputs({ ...inputs, closingCosts: Number(e.target.value) || 0 })} /></Field>
              <div className="flex items-end pb-1">
                <div className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2.5">
                  <div><Label htmlFor="finance-costs">Finance costs</Label><p className="text-xs text-muted-foreground">Add costs to the new balance</p></div>
                  <Switch id="finance-costs" checked={inputs.financeClosingCosts} onCheckedChange={(checked) => setInputs({ ...inputs, financeClosingCosts: checked })} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <div className="space-y-6">
          <Card className={result.lifetimeSavings >= 0 ? 'border-emerald-500/25' : 'border-amber-500/25'}>
            <CardHeader className="pb-3">
              <CardDescription>Estimated lifetime savings after closing costs</CardDescription>
              <CardTitle className={`text-4xl tracking-tight sm:text-5xl ${result.lifetimeSavings >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{formatCurrency(result.lifetimeSavings, true, 2, false)}</CardTitle>
              <p className="text-sm text-muted-foreground">A negative value means the refinance costs more over the modeled remaining life.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric icon={CircleDollarSign} label="Monthly payment savings" value={formatCurrency(result.monthlyPaymentSavings, true, 2, false)} />
                <Metric icon={Gauge} label="Break-even estimate" value={result.estimatedBreakEvenMonths === null ? 'No payment break-even' : result.estimatedBreakEvenMonths === 0 ? 'Immediate' : `${result.estimatedBreakEvenMonths} months`} />
                <Metric icon={CalendarDays} label="New payoff" value={monthLabel(result.refinancedPayoffMonth)} />
                <Metric icon={Scale} label="Payoff timing" value={monthsLabel(result.payoffDifferenceMonths)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Side-by-side cost</CardTitle><CardDescription>Closing costs are included in the refinance total whether paid upfront or financed.</CardDescription></CardHeader>
            <CardContent><div className="grid gap-4 sm:grid-cols-2"><Plan title="Keep current loan" payment={result.current.scheduledPayment} total={result.currentRemainingCost} interest={result.current.totalInterest} payoff={result.currentPayoffMonth} /><Plan title="Refinance" payment={result.refinanced.scheduledPayment} total={result.refinancedRemainingCost} interest={result.refinanced.totalInterest} payoff={result.refinancedPayoffMonth} emphasized /></div></CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Display currency: {currency}. Break-even is closing costs divided by monthly payment savings and does not model time value, tax effects, or equity differences.</p>
        </div>
      ) : (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Enter valid current and proposed loan terms to compare refinancing.</CardContent></Card>
      )}
    </div>
  )
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return <Label className="block space-y-1.5 font-normal"><span className="flex items-center justify-between"><span className="font-medium text-foreground">{label}</span>{suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}</span>{children}</Label>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return <div className="rounded-xl bg-muted/35 p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="text-lg font-semibold leading-tight tabular-nums">{value}</p></div>
}

function Plan({ title, payment, total, interest, payoff, emphasized = false }: { title: string; payment: number; total: number; interest: number; payoff: string; emphasized?: boolean }) {
  return <div className={`rounded-xl border p-4 ${emphasized ? 'border-primary/30 bg-primary/5' : 'bg-muted/15'}`}><p className="font-medium">{title}</p><dl className="mt-3 space-y-2 text-sm text-muted-foreground"><div className="flex justify-between gap-3"><dt>Payment</dt><dd className="text-foreground tabular-nums">{formatCurrency(payment, true, 2, false)}</dd></div><div className="flex justify-between gap-3"><dt>Total remaining cost</dt><dd className="text-foreground tabular-nums">{formatCurrency(total, true, 2, false)}</dd></div><div className="flex justify-between gap-3"><dt>Interest</dt><dd className="text-foreground tabular-nums">{formatCurrency(interest, true, 2, false)}</dd></div><div className="flex justify-between gap-3"><dt>Payoff</dt><dd className="text-foreground">{monthLabel(payoff)}</dd></div></dl></div>
}
