import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Calculator, CircleDollarSign, Info, Scale } from 'lucide-react'
import { BlockMath } from 'react-katex'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Loan Methodology',
  description: 'How Portfolio Simulator calculates fixed-rate loan payments, amortization, extra principal, payoff dates, and rounding.',
  alternates: { canonical: 'https://portfoliosimulator.org/methodology/loan' },
}

export default function LoanMethodologyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" className="-ml-3 gap-2">
          <Link href="/loan">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Loan Calculator
          </Link>
        </Button>

        <header className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Loan & Amortization Methodology</h1>
          <p className="text-muted-foreground">
            The loan calculator uses a deterministic fixed-rate amortization model with payment-by-payment cent rounding.
          </p>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CircleDollarSign className="h-5 w-5 text-primary" aria-hidden="true" />
              Required monthly payment
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              For a positive APR, the scheduled payment uses the standard installment-loan formula:
            </p>
            <div className="space-y-2 rounded-lg border bg-background/50 p-4">
              <p className="font-semibold text-foreground">Fixed-rate installment formula</p>
              <div className="overflow-x-auto rounded-md bg-muted/40 px-3 py-2">
                <BlockMath math={String.raw`\mathrm{Payment}=P\frac{r(1+r)^n}{(1+r)^n-1}`} />
              </div>
            </div>
            <p>
              <strong className="text-foreground">P</strong> is the original principal, <strong className="text-foreground">r</strong> is APR divided by 12 and by 100, and <strong className="text-foreground">n</strong> is the number of monthly payments. At 0% APR, principal is divided evenly across the term.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Scale className="h-5 w-5 text-primary" aria-hidden="true" />
              Payment order and rounding
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Each month, interest is calculated from the outstanding principal using the monthly rate and rounded to the nearest cent. The scheduled payment is applied to interest first and then principal. Any recurring extra payment and one-time lump sums are applied to remaining principal after the scheduled payment.
            </p>
            <p>
              Currency amounts are rounded to cents at each payment step. The final scheduled payment is adjusted when necessary so the ending balance is exactly zero instead of leaving a fraction-of-a-cent residual.
            </p>
            <p>
              Extra principal is capped at the remaining balance, so the model never reports negative principal or an overpayment beyond payoff. The yearly table reports scheduled principal and extra principal separately so its total-payment columns reconcile without double-counting extra payments.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Payoff comparison</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              The scheduled plan removes every extra payment and calculates the original amortization schedule. The accelerated plan uses the same loan terms plus your recurring and one-time extra principal. Interest saved is the scheduled plan&apos;s total interest minus the accelerated plan&apos;s total interest. Time saved is the difference in payment counts.
            </p>
            <p>
              The first payment month is treated as the first amortization period shown in the schedule. One-time payments must fall within the original scheduled loan term and are matched to their selected calendar month.
            </p>
            <p>
              If recurring or earlier extra payments cause the loan to be paid off before a later one-time payment is reached, that later payment is not applied. The calculator flags those planned payments so you can move or remove them if desired.
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Info className="h-5 w-5 text-amber-500" aria-hidden="true" />
              What this model does not include
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              The calculator does not model property taxes, homeowners insurance, PMI, HOA fees, escrow, origination fees, points, closing costs, prepayment penalties, adjustable-rate resets, refinancing costs, or lender-specific daily-interest conventions.
            </p>
            <p>
              Real loan statements can differ slightly because lenders may use different day-count, payment-date, rounding, fee, or servicing rules. Use your lender&apos;s official documents for contractual payment amounts.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Educational modeling only. This calculator does not provide lending, tax, legal, or financial advice.
        </p>
      </div>
    </div>
  )
}
