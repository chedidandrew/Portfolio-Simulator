'use client'

import Link from 'next/link'
import { Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFinancialProfile } from '@/components/financial-tools/financial-profile-provider'
import { formatCurrency } from '@/lib/utils'

export function LoanInvestComparisonLink() {
  const { profile, hydrated } = useFinancialProfile()
  if (!hydrated || (profile.extraMonthlyPayment <= 0 && profile.lumpSums.length === 0)) return null

  const lumpTotal = profile.lumpSums.reduce((sum, payment) => sum + payment.amount, 0)

  return (
    <section className="border-t bg-primary/[0.025] px-4 py-5 print:hidden" aria-label="Compare extra payments with investing">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-xl border border-primary/20 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">Would investing these extra payments come out ahead?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Compare your saved {profile.extraMonthlyPayment > 0 ? `${formatCurrency(profile.extraMonthlyPayment, true, 2, false)} monthly extra` : 'monthly plan'}
            {profile.lumpSums.length > 0 ? ` and ${profile.lumpSums.length} one-time ${profile.lumpSums.length === 1 ? 'payment' : 'payments'} totaling ${formatCurrency(lumpTotal, true, 2, false)}` : ''} against investing the same cash on the same dates.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 whitespace-normal">
          <Link href="/invest-vs-debt"><Scale className="mr-2 h-4 w-4" />Compare investing these extras</Link>
        </Button>
      </div>
    </section>
  )
}
