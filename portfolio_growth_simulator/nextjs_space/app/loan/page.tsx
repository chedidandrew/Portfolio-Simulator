import type { Metadata } from 'next'
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
  return <LoanCalculator />
}
