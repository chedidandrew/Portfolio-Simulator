import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LoanCalculator } from '@/components/loan/loan-calculator'

export const metadata: Metadata = {
  title: 'Loan & Amortization Calculator',
  description: 'Calculate loan payments, total interest, payoff dates, amortization schedules, and how extra payments can save time and interest.',
  alternates: { canonical: 'https://portfoliosimulator.org/loan' },
  openGraph: {
    title: 'Loan & Amortization Calculator | Portfolio Simulator',
    description: 'Model a fixed-rate loan, compare accelerated payoff strategies, and see exactly how extra payments change interest and payoff time.',
    url: 'https://portfoliosimulator.org/loan',
    images: ['/og-image.png'],
  },
}

export default function LoanPage() {
  return (
    <>
      <LoanCalculator />
      <aside className="border-t bg-muted/10 px-4 py-5 print:hidden" aria-label="Loan calculation methodology">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Want the exact calculation rules?</p>
            <p className="text-xs text-muted-foreground">See the payment formula, cent-rounding convention, extra-payment order, and model limits.</p>
          </div>
          <Link href="/methodology/loan" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
            Loan methodology
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </>
  )
}
