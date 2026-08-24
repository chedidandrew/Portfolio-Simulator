'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck2, Landmark, RefreshCw, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

const tools = [
  { href: '/loan', label: 'Loan', icon: Landmark },
  { href: '/loan/payoff-goal', label: 'Payoff Goal', icon: CalendarCheck2 },
  { href: '/loan/refinance', label: 'Refinance', icon: RefreshCw },
  { href: '/invest-vs-debt', label: 'Invest vs. Debt', icon: Scale },
]

export function FinancialToolNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Financial calculators" className="grid grid-cols-2 gap-2 print:hidden sm:grid-cols-4">
      {tools.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-primary/35 bg-primary/10 text-foreground'
                : 'bg-background/60 text-muted-foreground hover:border-primary/25 hover:bg-primary/[0.04] hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 leading-tight">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
