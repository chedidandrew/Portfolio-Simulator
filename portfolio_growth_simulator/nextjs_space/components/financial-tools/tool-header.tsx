'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Moon, RotateCcw, Settings, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { CurrencyPickerDialog } from '@/components/currency-picker-dialog'
import { useCurrency } from '@/components/currency-provider'
import { useFinancialProfile } from '@/components/financial-tools/financial-profile-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function FinancialToolHeader({ backHref = '/tools', backLabel = 'Tools' }: { backHref?: string; backLabel?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const { currency, setCurrency } = useCurrency()
  const { resetFinancialData } = useFinancialProfile()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const resetAll = () => {
    resetFinancialData()
    setSettingsOpen(false)
  }

  return (
    <>
      <div
        data-testid="financial-tool-safe-area"
        aria-hidden="true"
        className="bg-black print:hidden"
        style={{ height: 'var(--safe-area-top, env(safe-area-inset-top, 0px))' }}
      />
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
          <div className="flex items-center gap-1 sm:gap-2">
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
            <Button variant="outline" size="sm" className="px-2.5" onClick={() => setCurrencyOpen(true)} aria-label={`Display currency: ${currency}`}>
              {currency}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label="Financial tool settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
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
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Financial tool settings</DialogTitle>
            <DialogDescription>
              Reset the saved loan profile and all payoff, refinance, and invest-vs-debt inputs on this device. Currency and theme preferences are kept.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
            Your saved financial-tool inputs will be restored to defaults. This cannot be undone.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={resetAll}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset financial tools
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
