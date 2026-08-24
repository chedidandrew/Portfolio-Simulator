import type { Metadata } from 'next'
import { CalendarCheck2 } from 'lucide-react'
import { FinancialToolHeader } from '@/components/financial-tools/tool-header'
import { FinancialToolNav } from '@/components/financial-tools/tool-nav'
import { PayoffGoalCalculator } from '@/components/financial-tools/payoff-goal-calculator'

export const metadata: Metadata = {
  title: 'Loan Payoff Goal Calculator',
  description: 'Choose a target payoff date and calculate the recurring extra monthly payment needed to become debt-free on schedule.',
  alternates: { canonical: 'https://portfoliosimulator.org/loan/payoff-goal' },
  openGraph: {
    title: 'Loan Payoff Goal Calculator | Portfolio Simulator',
    description: 'Solve for the monthly extra principal needed to reach a target loan payoff date.',
    url: 'https://portfoliosimulator.org/loan/payoff-goal',
    images: ['/og-image.png'],
  },
}

export default function PayoffGoalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <FinancialToolHeader backHref="/tools" backLabel="Tools" />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-4 pb-16 sm:py-5">
        <FinancialToolNav />
        <section className="space-y-3 pt-2 sm:pt-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Loan Payoff Goal</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">Pick the month you want the loan gone and solve for the recurring extra payment needed to get there.</p>
          </div>
        </section>
        <PayoffGoalCalculator />
        <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground">
          Fixed-rate educational model using the same cent-rounding and payment-order rules as the Loan Calculator.
        </p>
      </main>
    </div>
  )
}
