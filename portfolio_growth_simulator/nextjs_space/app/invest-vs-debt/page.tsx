import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Scale } from 'lucide-react'
import { FinancialToolHeader } from '@/components/financial-tools/tool-header'
import { FinancialToolNav } from '@/components/financial-tools/tool-nav'
import { InvestVsDebtCalculator } from '@/components/financial-tools/invest-vs-debt-calculator'

export const metadata: Metadata = {
  title: 'Invest vs. Pay Down Debt Calculator',
  description: 'Compare investing extra monthly cash with paying down fixed-rate debt first using deterministic and seeded market scenarios.',
  alternates: { canonical: 'https://portfoliosimulator.org/invest-vs-debt' },
  openGraph: {
    title: 'Invest vs. Pay Down Debt | Portfolio Simulator',
    description: 'Compare the guaranteed interest savings from debt payoff with uncertain investment outcomes using seeded scenarios.',
    url: 'https://portfoliosimulator.org/invest-vs-debt',
    images: ['/og-image.png'],
  },
}

export default function InvestVsDebtPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <FinancialToolHeader backHref="/tools" backLabel="Tools" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-4 pb-16 sm:py-5">
        <FinancialToolNav />
        <section className="space-y-3 pt-2 sm:pt-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Scale className="h-6 w-6" /></div>
          <div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Invest vs. Pay Down Debt</h1><p className="mt-2 max-w-3xl text-muted-foreground">Use the same extra monthly cash under both strategies and compare a guaranteed debt payoff benefit with uncertain market outcomes.</p></div>
        </section>
        <InvestVsDebtCalculator />
        <aside className="rounded-xl border bg-muted/15 p-4 text-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div><p className="font-medium">Understand the comparison</p><p className="text-xs text-muted-foreground">See the contribution timing, market-return model, and important tax and behavioral exclusions.</p></div>
          <Link href="/methodology/invest-vs-debt" className="mt-3 inline-flex items-center gap-1.5 font-medium text-primary hover:underline sm:mt-0">Comparison methodology <ArrowRight className="h-4 w-4" /></Link>
        </aside>
      </main>
    </div>
  )
}
