'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { CurrencyPickerDialog } from '@/components/currency-picker-dialog'
import { useCurrency } from '@/components/currency-provider'

export function FinancialToolHeader({ backHref = '/tools', backLabel = 'Tools' }: { backHref?: string; backLabel?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const { currency, setCurrency } = useCurrency()
  const [currencyOpen, setCurrencyOpen] = useState(false)

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Portfolio Simulator home">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 shadow-sm">
              <Image src="/favicon.svg" alt="" width={24} height={24} className="rounded-md" priority />
            </div>
            <span className="hidden truncate text-lg font-bold tracking-tight text-foreground sm:inline">
              Portfolio Simulator
            </span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrencyOpen(true)} aria-label={`Display currency: ${currency}`}>
              {currency}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={backHref} aria-label={`Back to ${backLabel}`}>
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <CurrencyPickerDialog
        open={currencyOpen}
        value={currency}
        onOpenChange={setCurrencyOpen}
        onValueChange={setCurrency}
      />
    </>
  )
}
