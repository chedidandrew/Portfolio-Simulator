'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Check, ChevronRight, CreditCard, Moon, RotateCcw, Settings, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CurrencyPickerDialog } from '@/components/currency-picker-dialog'
import { useCurrency } from '@/components/currency-provider'
import { useFinancialProfile } from '@/components/financial-tools/financial-profile-provider'
import { CURRENCIES } from '@/lib/utils'

export function FinancialToolHeader({ backHref = '/tools', backLabel = 'Tools' }: { backHref?: string; backLabel?: string }) {
  const { theme, setTheme } = useTheme()
  const { currency, setCurrency } = useCurrency()
  const { resetFinancialData } = useFinancialProfile()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)

  const openMobileCurrencyPicker = () => {
    setSettingsOpen(false)
    window.setTimeout(() => setCurrencyPickerOpen(true), 0)
  }

  const resetAll = () => {
    if (window.confirm('Reset all saved financial-tool inputs and results to defaults? This cannot be undone.')) {
      resetFinancialData()
      setSettingsOpen(false)
    }
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
            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Open settings">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" collisionPadding={12} className="w-56 max-w-[calc(100vw-1rem)]">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                    <span>Theme</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent collisionPadding={12}>
                    <DropdownMenuItem onClick={() => setTheme('light')}>
                      <Sun className="mr-2 h-4 w-4" />
                      <span>Light</span>
                      {theme === 'light' && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon className="mr-2 h-4 w-4" />
                      <span>Dark</span>
                      {theme === 'dark' && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('system')}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>System</span>
                      {theme === 'system' && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Preferences</DropdownMenuLabel>
                <DropdownMenuItem
                  className="sm:hidden"
                  onSelect={(event) => {
                    event.preventDefault()
                    openMobileCurrencyPicker()
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Display Currency</span>
                  <span className="ml-auto mr-1 text-xs text-muted-foreground">{currency}</span>
                  <ChevronRight className="h-4 w-4" />
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="hidden sm:flex">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Display Currency</span>
                    <span className="ml-auto text-xs text-muted-foreground">{currency}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent collisionPadding={12} className="max-h-[min(70vh,28rem)] w-64 overflow-y-auto">
                    <DropdownMenuLabel>Display Currency</DropdownMenuLabel>
                    <p className="px-2 pb-2 text-xs text-muted-foreground">
                      Changes symbols and formatting only. Values are not converted using exchange rates.
                    </p>
                    {CURRENCIES.map((candidate) => (
                      <DropdownMenuItem key={candidate.code} onClick={() => setCurrency(candidate.code)}>
                        <span>{candidate.label}</span>
                        {currency === candidate.code && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetAll} className="text-red-500 focus:bg-red-50 focus:text-red-500 dark:focus:bg-red-900/10">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  <span>Reset financial tools</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
        open={currencyPickerOpen}
        value={currency}
        onOpenChange={setCurrencyPickerOpen}
        onValueChange={setCurrency}
      />
    </>
  )
}
