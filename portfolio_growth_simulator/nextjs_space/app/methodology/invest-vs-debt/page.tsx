import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Info, Scale, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Invest vs. Debt Methodology',
  description: 'How Portfolio Simulator compares investing extra cash with accelerating fixed-rate debt payoff under deterministic and seeded market scenarios.',
  alternates: { canonical: 'https://portfoliosimulator.org/methodology/invest-vs-debt' },
}

export default function InvestVsDebtMethodologyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" className="-ml-3 gap-2"><Link href="/invest-vs-debt"><ArrowLeft className="h-4 w-4" />Back to Invest vs. Debt</Link></Button>
        <header className="space-y-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Scale className="h-5 w-5" /></div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Invest vs. Debt Methodology</h1><p className="text-muted-foreground">The comparison keeps the household cash commitment equal under both strategies, then applies the same market path to both investment accounts.</p></header>

        <Card><CardHeader className="pb-3"><h2 className="text-lg font-semibold">Fair cash-flow comparison</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p><strong className="text-foreground">Invest first:</strong> make the required loan payment and invest the saved recurring extra cash plus any one-time cash on its scheduled month. <strong className="text-foreground">Debt first:</strong> apply those same cash amounts to principal until the loan is paid off, then invest the entire former loan-payment budget for the rest of the original term.</p><p>Any unused amount in the final payoff month is invested so neither strategy silently loses cash. Contributions are added at the end of each modeled month after that month&apos;s market return, matching the site&apos;s Growth timing convention.</p></CardContent></Card>

        <Card><CardHeader className="pb-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-5 w-5 text-primary" />Market scenarios</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>The randomized comparison uses seeded monthly lognormal returns. The entered <strong className="text-foreground">median geometric return assumption</strong> sets the median compounded return path, while annual volatility determines monthly dispersion. The same monthly return path is applied to both strategies inside each scenario so the comparison is not distorted by different random markets.</p><p>The probability shown is the percentage of scenarios in which the invest-first account finishes with a larger value at the end of the original loan term. Seeded scenarios are reproducible estimates, not forecasts or guarantees. Simulations run in a background Web Worker so large scenario counts do not block the page interface.</p></CardContent></Card>

        <Card><CardHeader className="pb-3"><h2 className="text-lg font-semibold">Debt payoff benefit</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>Accelerating a fixed-rate loan reduces contractual interest with no market volatility. The tool reports the modeled interest saved and earlier payoff from sending the same recurring and one-time cash to principal first.</p><p>This should not be interpreted as a universal after-tax investment hurdle rate. Mortgage-interest deductions, investment taxes, account type, employer matches, liquidity needs, and individual risk tolerance can materially change the real-world decision.</p></CardContent></Card>

        <Card className="border-amber-500/25 bg-amber-500/5"><CardHeader className="pb-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Info className="h-5 w-5 text-amber-500" />Important exclusions</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>The comparison excludes taxes on investment returns, mortgage-interest deductions, refinancing, prepayment penalties, investment fees, employer matching, emergency-fund value, changing interest rates, and behavioral differences between saving and debt repayment.</p><p>Use the result as a scenario comparison, not individualized investment or lending advice.</p></CardContent></Card>
      </div>
    </div>
  )
}
