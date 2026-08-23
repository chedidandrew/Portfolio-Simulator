import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarCheck2, Landmark, RefreshCw, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinancialToolHeader } from '@/components/financial-tools/tool-header'

export const metadata: Metadata = {
  title: 'Financial Planning Tools',
  description: 'Loan payoff, refinance, and invest-versus-debt tools that complement Portfolio Simulator without cluttering the core growth and withdrawal experience.',
  alternates: { canonical: 'https://portfoliosimulator.org/tools' },
  openGraph: {
    title: 'Financial Planning Tools | Portfolio Simulator',
    description: 'Explore loan payoff, refinance, and invest-versus-debt planning tools.',
    url: 'https://portfoliosimulator.org/tools',
    images: ['/og-image.png'],
  },
}

const tools = [
  {
    href: '/loan',
    icon: Landmark,
    title: 'Loan & Amortization',
    description: 'Calculate required payments, total interest, amortization schedules, and the impact of recurring or one-time extra principal.',
  },
  {
    href: '/loan/payoff-goal',
    icon: CalendarCheck2,
    title: 'Payoff Goal',
    description: 'Choose when you want a loan paid off and solve for the recurring extra payment needed to reach that month.',
  },
  {
    href: '/loan/refinance',
    icon: RefreshCw,
    title: 'Refinance Comparison',
    description: 'Compare payments, closing costs, break-even timing, interest, and lifetime remaining cost before replacing a loan.',
  },
  {
    href: '/invest-vs-debt',
    icon: Scale,
    title: 'Invest vs. Pay Down Debt',
    description: 'Compare guaranteed fixed-rate debt savings with uncertain market outcomes using deterministic and seeded scenarios.',
  },
]

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <FinancialToolHeader backHref="/" backLabel="Simulator" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 pb-16 sm:py-10">
        <header className="max-w-3xl space-y-3">
          <p className="text-sm font-medium text-primary">More financial tools</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Plan around the portfolio, not just inside it.</h1>
          <p className="text-muted-foreground">Use focused tools for debt payoff and borrowing decisions while keeping the core Guide, Growth, and Withdrawal experience simple.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {tools.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-primary/[0.03]">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <CardTitle className="flex items-center justify-between gap-3 text-xl">{title}<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" /></CardTitle>
                </CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{description}</p></CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">All calculations are educational scenario models. Review the linked Methodology pages before using results for real financial decisions.</p>
      </main>
    </div>
  )
}
