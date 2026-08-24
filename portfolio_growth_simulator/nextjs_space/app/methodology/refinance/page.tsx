import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Calculator, Info, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Refinance Methodology',
  description: 'How Portfolio Simulator compares refinance payments, closing costs, break-even timing, remaining interest, and lifetime loan cost.',
  alternates: { canonical: 'https://portfoliosimulator.org/methodology/refinance' },
}

export default function RefinanceMethodologyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" className="-ml-3 gap-2"><Link href="/loan/refinance"><ArrowLeft className="h-4 w-4" />Back to Refinance Calculator</Link></Button>
        <header className="space-y-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Calculator className="h-5 w-5" /></div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Refinance Methodology</h1><p className="text-muted-foreground">The refinance tool compares deterministic fixed-rate amortization schedules from the same starting month while preserving your saved current payoff plan.</p></header>

        <Card><CardHeader className="pb-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Scale className="h-5 w-5 text-primary" />Remaining-cost comparison</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>The current required plan uses the remaining balance, APR, and term with no acceleration. Your current plan additionally includes the recurring extra principal and one-time payments saved across the financial tools. The replacement loan uses the proposed APR and term. Closing costs are added either to the new principal when financed or to the refinance total when paid upfront.</p><p><strong className="text-foreground">Lifetime savings</strong> compares the proposed refinance against the total remaining cost of your currently saved payoff plan. A negative result means the refinance costs more over the modeled remaining life. Required-payment savings remains a separate comparison of the two contractual monthly payments.</p></CardContent></Card>

        <Card><CardHeader className="pb-3"><h2 className="text-lg font-semibold">Payment and break-even</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>Required monthly payment savings is the current contractual payment minus the new contractual payment. When closing costs are paid upfront, the displayed break-even estimate is closing costs divided by positive monthly payment savings, rounded up to a whole month.</p><p>When closing costs are financed, there is no initial cash outlay to recover, so the tool reports no upfront break-even. The financed costs and the interest charged on them are already reflected in the new loan&apos;s payment and lifetime cost. This remains a simple cash-flow comparison and does not discount future cash flows or model a future sale.</p></CardContent></Card>

        <Card className="border-amber-500/25 bg-amber-500/5"><CardHeader className="pb-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Info className="h-5 w-5 text-amber-500" />What this model does not include</h2></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>The comparison excludes appraisal fees that are not included in the entered closing-cost amount, taxes, insurance, escrow, points treated separately from closing costs, adjustable-rate changes, mortgage-interest tax deductions, recast behavior, prepayment penalties, and lender-specific daily-interest conventions.</p><p>Use official loan estimates and closing disclosures for contractual figures.</p></CardContent></Card>
      </div>
    </div>
  )
}
