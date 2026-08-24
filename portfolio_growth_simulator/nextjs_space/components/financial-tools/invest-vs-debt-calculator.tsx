'use client'

import { useMemo } from 'react'
import { BarChart3, Landmark, PiggyBank, Scale, ShieldCheck, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrency } from '@/components/currency-provider'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { compareInvestVsDebt, type InvestVsDebtInputs } from '@/lib/financial-tools/invest-vs-debt'
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

  const inputs = useMemo<InvestVsDebtInputs>(() => ({
    loanBalance: profile.loanBalance,
    loanApr: profile.loanApr,
    remainingMonths: profile.remainingMonths,
    extraMonthlyCash: profile.extraMonthlyPayment,
    expectedReturn: toolState.expectedReturn,
    volatility: toolState.volatility,
    scenarios: toolState.scenarios,
    seed: toolState.seed,
  }), [profile, toolState])

  const result = useMemo(() => {
    try {
      return compareInvestVsDebt(inputs)
    } catch {
      return null
    }
  }, [inputs])

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-fit min-w-0">
          <CardHeader><CardTitle>Your decision</CardTitle><CardDescription>Use the same extra monthly cash under both strategies so the comparison stays fair.</CardDescription></CardHeader>
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

            <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><TrendingUp className="h-4 w-4" /></div><div className="min-w-0"><p className="font-medium">Investment assumptions</p><p className="text-xs text-muted-foreground">Seeded lognormal scenarios use the same return path for both strategies.</p></div></div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="Expected annual return" suffix="%">
                  <NumericInput min={-99.99} max={100} step={0.1} value={toolState.expectedReturn} onChange={(value) => setToolState((current) => ({ ...current, expectedReturn: value }))} />
                </Field>
                <Field label="Annual volatility" suffix="%">
                  <NumericInput min={0} max={200} step={0.5} value={toolState.volatility} onChange={(value) => setToolState((current) => ({ ...current, volatility: value }))} />
                </Field>
                <div className="min-w-0 space-y-1.5">
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
                    <p className="text-[10px] font-medium text-orange-600 dark:text-orange-400">
                      Large runs reduce sampling noise but can take noticeably longer.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {result ? (
          <div className="min-w-0 space-y-6">
            <Card className="border-primary/25">
              <CardHeader className="pb-3">
                <CardDescription>Probability investing the extra cash finishes ahead</CardDescription>
                <CardTitle className="text-4xl tracking-tight text-primary sm:text-5xl">{result.probabilityInvestFirstAhead.toFixed(1)}%</CardTitle>
                <p className="text-sm text-muted-foreground">Across {result.scenarios.toLocaleString()} seeded market scenarios over the remaining loan term.</p>
              </CardHeader>
              <CardContent><div className="grid min-w-0 gap-3 sm:grid-cols-2"><Metric icon={PiggyBank} label="Median invest-first value" value={formatCurrency(result.medianInvestFirst, true, 2, false)} /><Metric icon={Landmark} label="Median debt-first value" value={formatCurrency(result.medianDebtFirst, true, 2, false)} /><Metric icon={ShieldCheck} label="Interest saved debt-first" value={formatCurrency(result.interestSavedByDebtFirst, true, 2, false)} /><Metric icon={Scale} label="Debt-first payoff" value={`${result.acceleratedPayoffMonths} months`} /></div></CardContent>
            </Card>

            <Card><CardHeader><CardTitle>Deterministic comparison</CardTitle><CardDescription>Uses the entered expected return every year without market randomness.</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-4 sm:grid-cols-2"><Plan title="Invest the extra cash" value={result.deterministicInvestFirst} /><Plan title="Pay debt first, then invest" value={result.deterministicDebtFirst} emphasized /></CardContent></Card>
          </div>
        ) : (
          <Card className="min-w-0 border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Enter valid loan and investment assumptions. Extra monthly cash must be greater than 0 to compare the strategies.</CardContent></Card>
        )}
      </div>

      {result && (
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Outcome spread</CardTitle><CardDescription>Difference is invest-first value minus debt-first value at the end of the modeled horizon.</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-3 sm:grid-cols-3"><Spread label="10th percentile" value={result.p10Difference} /><Spread label="Median" value={result.medianDifference} /><Spread label="90th percentile" value={result.p90Difference} /></CardContent></Card>
      )}

      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">Display currency: {currency}. Loan balance, APR, remaining term, and extra monthly cash stay synchronized with the other financial tools. This comparison excludes investment taxes, mortgage-interest deductions, transaction costs, employer matches, and behavioral differences.</p>
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
