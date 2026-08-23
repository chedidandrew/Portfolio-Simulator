'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Landmark, PiggyBank, Scale, ShieldCheck, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrency } from '@/components/currency-provider'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { compareInvestVsDebt, type InvestVsDebtInputs } from '@/lib/financial-tools/invest-vs-debt'

export function InvestVsDebtCalculator() {
  const { currency } = useCurrency()
  const symbol = getAppCurrency().symbol
  const [inputs, setInputs] = useState<InvestVsDebtInputs>({
    loanBalance: 300_000,
    loanApr: 6.5,
    remainingMonths: 300,
    extraMonthlyCash: 500,
    expectedReturn: 8,
    volatility: 18,
    scenarios: 1_000,
    seed: 'portfolio-simulator-invest-vs-debt-v1',
  })

  const result = useMemo(() => {
    try {
      return compareInvestVsDebt(inputs)
    } catch {
      return null
    }
  }, [inputs])

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Your decision</CardTitle>
            <CardDescription>Use the same extra monthly cash under both strategies so the comparison stays fair.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Loan balance" suffix={symbol}><Input type="number" min="1" step="1000" value={inputs.loanBalance} onChange={(e) => setInputs({ ...inputs, loanBalance: Number(e.target.value) || 0 })} /></Field>
              <Field label="Loan APR" suffix="%"><Input type="number" min="0" max="100" step="0.01" value={inputs.loanApr} onChange={(e) => setInputs({ ...inputs, loanApr: Number(e.target.value) || 0 })} /></Field>
              <Field label="Remaining term" suffix="years"><Input type="number" min="1" max="50" step="0.5" value={inputs.remainingMonths / 12} onChange={(e) => setInputs({ ...inputs, remainingMonths: Math.max(1, Math.round((Number(e.target.value) || 0) * 12)) })} /></Field>
              <Field label="Extra cash each month" suffix={symbol}><Input type="number" min="0" step="50" value={inputs.extraMonthlyCash} onChange={(e) => setInputs({ ...inputs, extraMonthlyCash: Number(e.target.value) || 0 })} /></Field>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><TrendingUp className="h-4 w-4" /></div><div><p className="font-medium">Investment assumptions</p><p className="text-xs text-muted-foreground">Seeded lognormal scenarios use the same return path for both strategies.</p></div></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Expected annual return" suffix="%"><Input type="number" min="-99" max="100" step="0.1" value={inputs.expectedReturn} onChange={(e) => setInputs({ ...inputs, expectedReturn: Number(e.target.value) || 0 })} /></Field>
                <Field label="Annual volatility" suffix="%"><Input type="number" min="0" max="200" step="0.5" value={inputs.volatility} onChange={(e) => setInputs({ ...inputs, volatility: Number(e.target.value) || 0 })} /></Field>
                <Field label="Scenarios"><Input type="number" min="100" max="5000" step="100" value={inputs.scenarios} onChange={(e) => setInputs({ ...inputs, scenarios: Math.max(100, Math.min(5000, Math.round(Number(e.target.value) || 100))) })} /></Field>
              </div>
            </div>
          </CardContent>
        </Card>

        {result ? (
          <div className="space-y-6">
            <Card className="border-primary/25">
              <CardHeader className="pb-3">
                <CardDescription>Probability investing the extra cash finishes ahead</CardDescription>
                <CardTitle className="text-4xl tracking-tight text-primary sm:text-5xl">{result.probabilityInvestFirstAhead.toFixed(1)}%</CardTitle>
                <p className="text-sm text-muted-foreground">Across {result.scenarios.toLocaleString()} seeded market scenarios over the remaining loan term.</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric icon={PiggyBank} label="Median invest-first value" value={formatCurrency(result.medianInvestFirst, true, 2, false)} />
                  <Metric icon={Landmark} label="Median debt-first value" value={formatCurrency(result.medianDebtFirst, true, 2, false)} />
                  <Metric icon={ShieldCheck} label="Interest saved debt-first" value={formatCurrency(result.interestSavedByDebtFirst, true, 2, false)} />
                  <Metric icon={Scale} label="Debt-first payoff" value={`${result.acceleratedPayoffMonths} months`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Deterministic comparison</CardTitle><CardDescription>Uses the entered expected return every year without market randomness.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Plan title="Invest the extra cash" value={result.deterministicInvestFirst} />
                <Plan title="Pay debt first, then invest" value={result.deterministicDebtFirst} emphasized />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Enter valid loan and investment assumptions to compare the strategies.</CardContent></Card>
        )}
      </div>

      {result && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Outcome spread</CardTitle><CardDescription>Difference is invest-first value minus debt-first value at the end of the modeled horizon.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Spread label="10th percentile" value={result.p10Difference} />
            <Spread label="Median" value={result.medianDifference} />
            <Spread label="90th percentile" value={result.p90Difference} />
          </CardContent>
        </Card>
      )}

      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
        Display currency: {currency}. This comparison excludes investment taxes, mortgage-interest deductions, transaction costs, employer matches, and behavioral differences. Paying down fixed-rate debt is modeled as a guaranteed reduction in loan interest; market returns are uncertain.
      </p>
    </div>
  )
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><div className="flex items-center justify-between"><Label>{label}</Label>{suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}</div>{children}</div>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Scale; label: string; value: string }) {
  return <div className="rounded-xl bg-muted/35 p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="text-lg font-semibold leading-tight tabular-nums">{value}</p></div>
}

function Plan({ title, value, emphasized = false }: { title: string; value: number; emphasized?: boolean }) {
  return <div className={`rounded-xl border p-4 ${emphasized ? 'border-primary/30 bg-primary/5' : 'bg-muted/15'}`}><p className="text-sm font-medium">{title}</p><p className="mt-2 text-2xl font-bold tabular-nums">{formatCurrency(value, true, 2, false)}</p></div>
}

function Spread({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-muted/25 p-4 text-center"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-2 text-xl font-semibold tabular-nums ${value >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>{value >= 0 ? '+' : ''}{formatCurrency(value, true, 2, false)}</p></div>
}
