import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { FinancialToolHeader } from '@/components/financial-tools/tool-header'
import { FinancialToolNav } from '@/components/financial-tools/tool-nav'
import { RefinanceCalculator } from '@/components/financial-tools/refinance-calculator'

export const metadata: Metadata = {
  title: 'Refinance Comparison Calculator',
  description: 'Compare your current fixed-rate loan with a refinance, including payment changes, closing costs, break-even time, interest, and lifetime cost.',
  alternates: { canonical: 'https://portfoliosimulator.org/loan/refinance' },
  openGraph: {
    title: 'Refinance Comparison Calculator | Portfolio Simulator',
    description: 'See whether a refinance actually saves money after closing costs and term changes.',
    url: 'https://portfoliosimulator.org/loan/refinance',
    images: ['/og-image.png'],
  },
}

export default function RefinancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <FinancialToolHeader backHref="/tools" backLabel="Tools" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-4 pb-16 sm:py-5">
        <FinancialToolNav />
        <section className="space-y-3 pt-2 sm:pt-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><RefreshCw className="h-6 w-6" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Refinance Comparison</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Compare the payment and true remaining cost of keeping your current loan versus replacing it with a new fixed-rate loan.</p>
          </div>
        </section>
        <RefinanceCalculator />
        <aside className="rounded-xl border bg-muted/15 p-4 text-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div><p className="font-medium">How is break-even calculated?</p><p className="text-xs text-muted-foreground">Read the assumptions around closing costs, financed fees, payment savings, and term changes.</p></div>
          <Link href="/methodology/refinance" className="mt-3 inline-flex items-center gap-1.5 font-medium text-primary hover:underline sm:mt-0">Refinance methodology <ArrowRight className="h-4 w-4" /></Link>
        </aside>
      </main>
    </div>
  )
}
