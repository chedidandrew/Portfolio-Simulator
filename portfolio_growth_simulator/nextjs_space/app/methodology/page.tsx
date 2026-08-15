'use client'

import { useState, type ElementType, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calculator,
  ChevronDown,
  Clock3,
  Dices,
  DollarSign,
  FileText,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { BlockMath } from 'react-katex'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DonationSection } from '@/components/donation-section'
import { cn } from '@/lib/utils'
import {
  MAX_DETERMINISTIC_STEPS,
  MAX_SCENARIO_DURATION_YEARS,
} from '@/lib/simulation/deterministic-validation'
import { MAX_CHART_POINTS, MAX_MONTE_CARLO_WORK } from '@/lib/simulation/financial-utils'

interface MethodologySectionProps {
  title: string
  description: string
  icon: ElementType
  children: ReactNode
  defaultOpen?: boolean
  accentClass?: string
}

function MethodologySection({
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = false,
  accentClass = 'border-l-primary/60',
}: MethodologySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn('overflow-hidden border-l-4', accentClass)}>
        <CollapsibleTrigger className="w-full px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <span className="flex items-start justify-between gap-4">
            <span className="flex items-start gap-3">
              <span className="mt-0.5 rounded-lg bg-muted p-2">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="space-y-1">
                <span className="block text-lg font-semibold text-foreground">{title}</span>
                <span className="block text-sm font-normal text-muted-foreground">{description}</span>
              </span>
            </span>
            <ChevronDown
              className={cn('mt-1 h-5 w-5 shrink-0 transition-transform', isOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="border-t pt-5 text-sm leading-relaxed text-muted-foreground">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function FormulaCard({ title, formula, children }: { title: string; formula: string; children?: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border bg-background/50 p-4">
      <p className="font-semibold text-foreground">{title}</p>
      <div className="overflow-x-auto rounded-md bg-muted/40 px-3 py-2">
        <BlockMath math={formula} />
      </div>
      {children}
    </div>
  )
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Button asChild variant="ghost" className="-ml-3 gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Simulator
          </Link>
        </Button>

        <header className="space-y-3">
          <Badge variant="outline">Model documentation</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Methodology &amp; Model Assumptions</h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            How deterministic projections, Monte Carlo scenarios, inflation, withdrawals, and simplified taxes are calculated.
          </p>
        </header>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              What this tool is
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Portfolio Simulator is an educational scenario model. It applies the assumptions you enter consistently and exposes both deterministic and randomized outcomes. It does not predict markets, provide individualized advice, or reproduce a complete tax return.
            </p>
            <p>
              The selected display currency changes symbols and number formatting only. No foreign-exchange conversion is performed.
            </p>
          </CardContent>
        </Card>

        <MethodologySection
          title="Growth Phase"
          description="Deterministic accumulation with recurring contributions"
          icon={TrendingUp}
          defaultOpen
          accentClass="border-l-emerald-500/70"
        >
          <div className="space-y-5">
            <p>
              The growth engine advances one period at a time using the frequency you select: yearly, quarterly, monthly, or weekly. Market growth is applied first, then the contribution is added at the end of that period. A newly added contribution therefore begins earning returns in the following period.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <FormulaCard
                title="Effective annual return"
                formula={String.raw`r_p=(1+r_{annual})^{1/n}-1`}
              >
                <p>
                  Effective mode converts the annual assumption into an equivalent periodic rate, so a full year compounds back to the entered annual rate.
                </p>
              </FormulaCard>
              <FormulaCard
                title="Nominal annual rate"
                formula={String.raw`r_p=\frac{r_{annual}}{n}`}
              >
                <p>
                  Nominal mode divides the entered APR by the number of periods. Periodic compounding can therefore produce an effective annual result above the entered nominal rate.
                </p>
              </FormulaCard>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-semibold text-foreground">Contribution growth</p>
              <p className="mt-1">
                Contributions can increase once per year using the inflation input. This option is off in the default Growth scenario, but can be enabled beside the inflation field.
              </p>
            </div>
          </div>
        </MethodologySection>

        <MethodologySection
          title="Withdrawal Phase"
          description="Deterministic retirement spending and depletion timing"
          icon={TrendingDown}
          accentClass="border-l-blue-500/70"
        >
          <div className="space-y-5">
            <p>
              Withdrawals occur at the start of each selected period, before that period&apos;s market growth. This is deliberately conservative because money removed for spending does not receive the period&apos;s return.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  Sustainability
                </p>
                <p className="mt-2">
                  A plan succeeds only when every requested withdrawal is fully funded. Ending exactly at zero after the final scheduled payment still counts as success because the complete requested horizon was funded.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <DollarSign className="h-4 w-4" aria-hidden="true" />
                  Withdrawal growth
                </p>
                <p className="mt-2">
                  The default Withdrawal scenario increases spending annually by the inflation rate. The adjustment can be disabled when modeling a fixed nominal withdrawal.
                </p>
              </div>
            </div>

            <p>
              The yearly table reports realized withdrawals, not merely scheduled withdrawals. Once the portfolio is depleted, unfunded amounts are not counted as money received.
            </p>
          </div>
        </MethodologySection>

        <MethodologySection
          title="Monte Carlo Simulation"
          description="Seeded lognormal return paths at the user-selected frequency"
          icon={Dices}
          accentClass="border-l-violet-500/70"
        >
          <div className="space-y-5">
            <p>
              Monte Carlo mode runs many possible paths using JavaScript&apos;s double-precision number format. The work normally runs in a Web Worker so the interface remains responsive. The same inputs and random seed reproduce the same paths.
            </p>

            <FormulaCard
              title="Per-period market step"
              formula={String.raw`V_{t+\Delta t}=V_t\,e^{\ln(1+r)\Delta t+\sigma\sqrt{\Delta t}\,Z}`}
            >
              <div className="space-y-2">
                <p><strong className="text-foreground">r</strong> is the entered effective annual geometric-return assumption after any modeled annual income-tax drag.</p>
                <p><strong className="text-foreground">σ</strong> is annual volatility, <strong className="text-foreground">Z</strong> is a standard-normal random draw, and <strong className="text-foreground">Δt</strong> is one selected cashflow period expressed as a fraction of a year.</p>
              </div>
            </FormulaCard>

            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
              <p className="font-semibold text-foreground">How to interpret the return input</p>
              <p className="mt-2">
                With optional stress events disabled, the entered effective return centers the median geometric path. It is not an arithmetic-mean forecast. Because lognormal outcomes are asymmetric, higher volatility can raise the arithmetic mean even when the median path assumption is unchanged.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-semibold text-foreground">Frequency</p>
                <p className="mt-2">
                  The engine uses the frequency selected by the user for the entire run. It does not silently switch frequencies based on duration. Charts may be downsampled for display, but the underlying calculation frequency remains unchanged.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-semibold text-foreground">Scenario count</p>
                <p className="mt-2">
                  The interface supports small sample runs through large simulations, subject to a maximum of {MAX_MONTE_CARLO_WORK.toLocaleString()} path-period calculations. More paths reduce sampling noise but do not improve the assumptions themselves.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-semibold text-foreground">Optional crash and recovery stress events</p>
              <p className="mt-2">
                When enabled, the model adds seeded, horizon-scaled declines followed by partial recoveries. These are heuristic stress events designed to test path sensitivity. They are not a calibrated forecast of crash frequency, severity, or recovery timing.
              </p>
            </div>

            <p>
              “Probability of Ending At or Above Goal” evaluates only the value at the end of each path. A path that crosses the goal earlier and later falls below it is not counted as a terminal success.
            </p>
          </div>
        </MethodologySection>

        <MethodologySection
          title="Inflation and Real Dollars"
          description="Cashflow escalation and purchasing-power reporting"
          icon={Activity}
          accentClass="border-l-pink-500/70"
        >
          <div className="space-y-5">
            <FormulaCard
              title="Present purchasing power"
              formula={String.raw`Real\ Value=\frac{Nominal\ Value}{(1+i)^t}`}
            >
              <p>
                Future balances and each individual cashflow can be discounted using the annual inflation assumption. Cashflows are discounted at the time they occur, rather than discounting one cumulative total only at the end.
              </p>
            </FormulaCard>

            <p>
              The inflation field has two separate effects: it supports real-dollar reporting, and it can optionally increase contributions or withdrawals once per year. Disabling cashflow escalation does not disable real-dollar reporting.
            </p>
          </div>
        </MethodologySection>

        <MethodologySection
          title="Taxes"
          description="Three simplified tax treatments"
          icon={Scale}
          accentClass="border-l-slate-500/70"
        >
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="font-semibold text-foreground">Taxable account, capital gains on liquidation</p>
              <p className="mt-2">
                The model tracks current cost basis. During withdrawals, the taxable share is estimated proportionally from unrealized gain divided by account value. During growth, embedded capital-gains tax is shown as an estimated liquidation liability rather than an annual realization schedule.
              </p>
              <div className="mt-3 overflow-x-auto rounded-md bg-muted/40 px-3 py-2">
                <BlockMath math={String.raw`Tax=Withdrawal\times Tax\ Rate\times\frac{Balance-Basis}{Balance}`} />
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-semibold text-foreground">Fully pre-tax retirement account</p>
              <p className="mt-2">
                The entire modeled balance is treated as taxable. Withdrawals are reported as gross distributions and after-tax spending using the entered effective tax rate.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="font-semibold text-foreground">Annual income-tax drag</p>
              <p className="mt-2">
                Positive expected growth is reduced by the entered tax rate before compounding. Negative expected returns are not improved by the tax adjustment. The simulator also keeps a no-tax comparison path so gross and spendable balances remain distinguishable.
              </p>
            </div>
          </div>
        </MethodologySection>

        <MethodologySection
          title="Validation and Performance Limits"
          description="Browser-safety limits applied to typed, saved, and shared scenarios"
          icon={Calculator}
          accentClass="border-l-cyan-500/70"
        >
          <div className="space-y-4">
            <p>
              The same scenario rules are applied to calculator inputs, saved browser state, and shared links. Invalid or malformed saved data is discarded and replaced with safe defaults.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Maximum modeled duration: {MAX_SCENARIO_DURATION_YEARS} years.</li>
              <li>Maximum deterministic workload: {MAX_DETERMINISTIC_STEPS.toLocaleString()} calculation periods.</li>
              <li>Maximum Monte Carlo workload: {MAX_MONTE_CARLO_WORK.toLocaleString()} path-period calculations.</li>
              <li>Displayed Monte Carlo time-series data is limited to roughly {MAX_CHART_POINTS} chart points while calculations continue at the selected period frequency.</li>
              <li>Shared links are size-limited and validated before their scenario data is accepted.</li>
            </ul>
          </div>
        </MethodologySection>

        <MethodologySection
          title="Assumptions and Limitations"
          description="Important boundaries when interpreting results"
          icon={AlertTriangle}
          accentClass="border-l-amber-500/70"
        >
          <ul className="list-disc space-y-3 pl-5">
            <li><strong className="text-foreground">Returns:</strong> Lognormal independent steps do not fully reproduce fat tails, volatility clustering, regime changes, or changing asset correlations.</li>
            <li><strong className="text-foreground">Allocation:</strong> The model assumes the entered return and volatility profile remain applicable. It does not model rebalancing costs or allocation drift.</li>
            <li><strong className="text-foreground">Taxes:</strong> Tax calculations are simplified estimates. They do not include brackets, filing status, state rules, wash sales, required minimum distributions, or individualized realization strategies.</li>
            <li><strong className="text-foreground">Cashflows:</strong> Contributions and withdrawals occur at fixed modeled points within each period and change annually only when escalation is enabled.</li>
            <li><strong className="text-foreground">Other income:</strong> Social Security, pensions, fees, advisory costs, and external income are not modeled unless represented through the entered cashflows.</li>
            <li><strong className="text-foreground">Outcomes:</strong> Percentiles and success rates describe the selected model and assumptions. They are not guarantees or forecasts.</li>
          </ul>
        </MethodologySection>

        <Card>
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              Results should be used to compare scenarios and understand sensitivity, not as a substitute for professional financial or tax advice.
            </p>
          </CardContent>
        </Card>

        <DonationSection />
      </div>
    </div>
  )
}
