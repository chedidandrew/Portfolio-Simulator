'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Moon, Sun, TrendingUp, TrendingDown, BookOpen, Settings, Check, CreditCard, Heart, RotateCcw, ChevronRight, Landmark } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import { CurrencyPickerDialog } from '@/components/currency-picker-dialog'
import { CURRENCIES } from '@/lib/utils'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useCurrency } from '@/components/currency-provider'
import { clearPortfolioStorage } from '@/lib/owned-storage'
import { cleanShareDataFromUrl, readSharePayload } from '@/lib/share-links'
import { toast } from 'sonner'
import type { SharePayload } from '@/lib/types'
import { persistSharedMonteCarloPreferences } from '@/lib/shared-preferences'
import { subscribeRetirementPlanTransfer } from '@/lib/retirement-plan-transfer'

const GuideTab = dynamic(() => import('@/components/guide-tab').then((module) => module.GuideTab))
const GrowthMode = dynamic(() => import('@/components/growth-mode').then((module) => module.GrowthMode))
const WithdrawalMode = dynamic(() => import('@/components/withdrawal-mode').then((module) => module.WithdrawalMode))

export default function Home() {
  const { theme, setTheme } = useTheme()
  const { currency, setCurrency } = useCurrency()
  const [activeTab, setActiveTab] = useState<'growth' | 'withdrawal' | 'guide'>('growth')
  const [mounted, setMounted] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [showDonations, setShowDonations] = useLocalStorage<boolean>('portfolio-sim-show-donations', true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false)
  const [sharedPayload, setSharedPayload] = useState<SharePayload | null>(null)
  const lastScrollY = useRef(0)
  const scrollThreshold = 10

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const shared = readSharePayload(window.location)
      if (shared.hadShareData && !shared.payload) {
        window.setTimeout(() => toast('This shared scenario could not be loaded.'), 50)
        window.history.replaceState(null, '', cleanShareDataFromUrl(window.location.href))
      } else if (shared.payload) {
        const mode = shared.payload.mode
        persistSharedMonteCarloPreferences(shared.payload, window.localStorage)
        if (shared.payload.displayCurrency) setCurrency(shared.payload.displayCurrency)
        setActiveTab(mode)
        setSharedPayload(shared.payload)
        localStorage.setItem('visited', 'true')
        localStorage.setItem('lastTab', mode)
        return
      }
    } catch {
      // Fall back to normal startup behavior if browser storage is unavailable.
    }

    const visited = localStorage.getItem('visited')
    const lastTab = localStorage.getItem('lastTab') as
      | 'growth'
      | 'withdrawal'
      | 'guide'
      | null

    if (!visited) {
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', 'guide')
      setActiveTab('guide')
    } else if (lastTab) {
      setActiveTab(lastTab)
    }
  }, [setCurrency])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SharePayload>).detail
      const mode = detail?.mode === 'withdrawal' ? 'withdrawal' : 'growth'
      if (detail) persistSharedMonteCarloPreferences(detail, window.localStorage)
      setActiveTab(mode)
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', mode)
    }

    window.addEventListener('openMonteCarloFromLink', handler)
    return () => window.removeEventListener('openMonteCarloFromLink', handler)
  }, [])

  useEffect(() => subscribeRetirementPlanTransfer(() => {
    setActiveTab('withdrawal')
    try {
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', 'withdrawal')
    } catch {}
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
  }), [])

  const handleTabChange = (value: string) => {
    const nextTab = value as 'growth' | 'withdrawal' | 'guide'
    setActiveTab(nextTab)
    if (typeof window !== 'undefined') {
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', nextTab)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (Math.abs(currentScrollY - lastScrollY.current) < scrollThreshold) return

      if (currentScrollY < 40) {
        setHeaderVisible(true)
      } else {
        setHeaderVisible(currentScrollY < lastScrollY.current)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleFactoryReset = () => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to reset all settings and data? This cannot be undone.')) {
      clearPortfolioStorage(localStorage)
      window.location.reload()
    }
  }

  const openMobileCurrencyPicker = () => {
    setSettingsOpen(false)
    window.setTimeout(() => setCurrencyPickerOpen(true), 0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <header
        className={`fixed left-0 right-0 z-40 w-full transition-all duration-300 ease-in-out print:hidden ${
          headerVisible
            ? 'translate-y-0 bg-background/95 backdrop-blur-lg border-b border-border'
            : `-translate-y-full ${theme === 'dark' ? 'bg-black' : 'bg-white'} border-transparent`
        }`}
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div
          className={`container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between transition-opacity duration-200 ${
            headerVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 shadow-sm">
              <Image src="/favicon.svg" alt="" width={24} height={24} className="rounded-md" priority />
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Portfolio Simulator
            </h1>
          </div>
          {mounted && (
            <>
              <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Open settings">
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
                      <DropdownMenuItem onClick={() => setTheme?.('light')}>
                        <Sun className="mr-2 h-4 w-4" />
                        <span>Light</span>
                        {theme === 'light' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme?.('dark')}>
                        <Moon className="mr-2 h-4 w-4" />
                        <span>Dark</span>
                        {theme === 'dark' && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme?.('system')}>
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
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="hidden sm:flex">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Display Currency</span>
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
                  <DropdownMenuCheckboxItem
                    checked={showDonations}
                    onCheckedChange={setShowDonations}
                  >
                    <span className="flex items-center">
                      <Heart className="mr-2 h-4 w-4" />
                      Show Support Card
                    </span>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleFactoryReset} className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-900/10">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span>Reset</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <CurrencyPickerDialog
                open={currencyPickerOpen}
                value={currency}
                onOpenChange={setCurrencyPickerOpen}
                onValueChange={setCurrency}
              />
            </>
          )}
        </div>
      </header>

      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black pointer-events-none print:hidden"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />

      <div
        className="w-full print:hidden"
        style={{ height: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
      />

      <main className="container mx-auto max-w-6xl px-4 py-4 pb-16 sm:py-6 sm:pb-20 print:p-0 print:max-w-none">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 h-auto sm:mb-6 print:hidden">
            <TabsTrigger value="guide" aria-label="Guide" className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] sm:flex-row sm:gap-2 sm:py-3 sm:text-sm">
              <BookOpen className="h-4 w-4" />
              <span>Guide</span>
            </TabsTrigger>
            <TabsTrigger value="growth" aria-label="Growth" className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] sm:flex-row sm:gap-2 sm:py-3 sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Growth</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawal" aria-label="Withdrawal" className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] sm:flex-row sm:gap-2 sm:py-3 sm:text-sm">
              <TrendingDown className="h-4 w-4" />
              <span>Withdrawal</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="mt-0">
            <div className="mb-4 flex items-center justify-end gap-2 print:hidden sm:mb-6">
              <span className="hidden text-xs text-muted-foreground sm:inline">More financial tools</span>
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <Link href="/loan">
                  <Landmark className="mr-2 h-4 w-4" />
                  Loan Calculator
                </Link>
              </Button>
            </div>
            <GuideTab onLaunchMode={(mode) => handleTabChange(mode)} />
          </TabsContent>

          <TabsContent value="growth" className="mt-0">
            <GrowthMode sharedPayload={sharedPayload?.mode === 'growth' ? sharedPayload : null} />
          </TabsContent>

          <TabsContent value="withdrawal" className="mt-0">
            <WithdrawalMode sharedPayload={sharedPayload?.mode === 'withdrawal' ? sharedPayload : null} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
