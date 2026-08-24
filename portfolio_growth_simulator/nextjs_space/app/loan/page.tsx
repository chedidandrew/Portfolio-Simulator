import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarCheck2, RefreshCw, Scale } from 'lucide-react'
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
    <div className="loan-page">
      <div
        data-testid="financial-tool-safe-area"
        aria-hidden="true"
        className="bg-black print:hidden"
        style={{ height: 'var(--safe-area-top, env(safe-area-inset-top, 0px))' }}
      />
      <LoanCalculator />
      <section className="border-t bg-background px-4 py-5 print:hidden" aria-label="Related loan planning tools">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
          <RelatedTool href="/loan/payoff-goal" icon={CalendarCheck2} title="Payoff Goal" text="Solve for the monthly extra payment needed to hit a target payoff month." />
          <RelatedTool href="/loan/refinance" icon={RefreshCw} title="Refinance" text="Compare payment savings, closing costs, break-even time, and lifetime cost." />
          <RelatedTool href="/invest-vs-debt" icon={Scale} title="Invest vs. Debt" text="Compare extra principal with investing the same monthly cash." />
        </div>
      </section>
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
    </div>
  )
}

function RelatedTool({ href, icon: Icon, title, text }: { href: string; icon: typeof Scale; title: string; text: string }) {
  return (
    <Link href={href} className="group rounded-xl border bg-muted/10 p-4 transition-colors hover:border-primary/35 hover:bg-primary/[0.03]">
      <div className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-primary" />{title}<ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </Link>
  )
}
