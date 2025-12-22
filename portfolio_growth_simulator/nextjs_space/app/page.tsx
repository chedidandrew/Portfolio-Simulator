'use client'

import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Moon, Sun, TrendingUp, TrendingDown, BookOpen, Settings, Check, CreditCard, Heart, RotateCcw } from 'lucide-react'
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
import { GrowthMode } from '@/components/growth-mode'
import { WithdrawalMode } from '@/components/withdrawal-mode'
import { GuideTab } from '@/components/guide-tab'
import LZString from 'lz-string'
import { setAppCurrency, CURRENCIES } from '@/lib/utils'
import { useLocalStorage } from '@/hooks/use-local-storage'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'growth' | 'withdrawal' | 'guide'>('growth')
  const [mounted, setMounted] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [currency, setCurrency] = useLocalStorage<string>('portfolio-sim-currency', 'USD')
  const [showDonations, setShowDonations] = useLocalStorage<boolean>('portfolio-sim-show-donations', true)
  const lastScrollY = useRef(0)
  const scrollThreshold = 10

  useEffect(() => {
    setMounted(true)
    setAppCurrency(currency) // Initialize currency on mount
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update currency global state when it changes
  useEffect(() => {
    setAppCurrency(currency)
  }, [currency])

  // Decide which tab to show on first load and on return
  useEffect(() => {
    if (typeof window === 'undefined') return

    // If URL has a Monte Carlo payload, honor that first
    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')

      if (mcParam) {
        // FIX: Explicitly type 'decoded' as 'any' to resolve the TypeScript error
        let decoded: any = null

        // 1. Try decompressing with LZString (New Format)
        const lzDecompressed = LZString.decompressFromEncodedURIComponent(mcParam)
        if (lzDecompressed) {
          try {
            const parsed = JSON.parse(lzDecompressed)
            // valid JSON? use it.
            if (parsed && typeof parsed === 'object') {
              decoded = parsed
            }
          } catch {
            // LZString returned a string, but it wasn't valid JSON.
            // This happens when LZString tries to decode a simple Base64 string.
            // Ignore and fall through to legacy.
          }
        }

        // 2. Fallback to atob (Legacy Format) if LZString failed to produce valid JSON
        if (!decoded) {
          try {
             const raw = decodeURIComponent(atob(mcParam))
             decoded = JSON.parse(raw)
          } catch {
             // Not a valid legacy link either
          }
        }

        if (decoded) {
          const mode = decoded?.mode === 'withdrawal' ? 'withdrawal' : 'growth'

          setActiveTab(mode)
          localStorage.setItem('visited', 'true')
          localStorage.setItem('lastTab', mode)
          
          // Dispatch event with the FULL decoded object (including results)
          // This allows the child components to catch it and hydrate their state
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('openMonteCarloFromLink', { 
              detail: decoded 
            }))
          }, 100) // Small delay to ensure components are mounted
          
          return
        }
      }
    } catch {
      // ignore and fall back to normal behavior
    }

    const visited = localStorage.getItem('visited')
    const lastTab = localStorage.getItem('lastTab') as
      | 'growth'
      | 'withdrawal'
      | 'guide'
      | null

    if (!visited) {
      // First time: go to guide
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', 'guide')
      setActiveTab('guide')
    } else if (lastTab) {
      // Return: go to last used tab
      setActiveTab(lastTab)
    }
  }, [])

  // When a shared Monte Carlo link is opened, switch to the correct tab
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: any) => {
      const mode =
        event?.detail?.mode === 'withdrawal' ? 'withdrawal' : 'growth'

      setActiveTab(mode)

      // Keep your localStorage behavior in sync
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', mode)
    }

    window.addEventListener('openMonteCarloFromLink', handler)

    return () => {
      window.removeEventListener('openMonteCarloFromLink', handler)
    }
  }, [])

  // Save tab changes to localStorage
  const handleTabChange = (value: string) => {
    const v = value as 'growth' | 'withdrawal' | 'guide'
    setActiveTab(v)
    if (typeof window !== 'undefined') {
      localStorage.setItem('visited', 'true')
      localStorage.setItem('lastTab', v)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (Math.abs(currentScrollY - lastScrollY.current) < scrollThreshold) {
        return
      }

      if (currentScrollY < 40) {
        setHeaderVisible(true)
      } else if (currentScrollY >= 40) {
        setHeaderVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleFactoryReset = () => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to reset all settings and data? This cannot be undone.')) {
      localStorage.clear()
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header - Hidden in Print*/}
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
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Portfolio Simulator
            </h1>
          </div>
          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {theme === 'dark' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                    <span>Theme</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
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
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Currency</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto">
                      {CURRENCIES.map((c) => (
                        <DropdownMenuItem key={c.code} onClick={() => setCurrency(c.code)}>
                          <span>{c.label}</span>
                          {currency === c.code && <Check className="ml-auto h-4 w-4" />}
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
                    Show Donation Card
                   </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleFactoryReset} className="text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-900/10">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  <span>Reset</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Status bar background - Hidden in Print */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black pointer-events-none print:hidden"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />

      {/* Spacer - Hidden in Print */}
      <div
        className="w-full print:hidden"
        style={{ height: 'calc(env(safe-area-inset-top, 0px) + 60px)' }}
      />

      {/* Main */}
      <main className="container mx-auto max-w-6xl px-4 py-6 pb-20 print:p-0 print:max-w-none">
        <Tabs key={currency} value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* Tabs List - Hidden in Print */}
          <TabsList className="grid w-full grid-cols-3 mb-6 h-auto print:hidden">
            {/* Guide tab moved to the left */}
            <TabsTrigger value="guide" className="flex items-center gap-2 py-3">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Guide</span>
            </TabsTrigger>
            <TabsTrigger value="growth" className="flex items-center gap-2 py-3">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Growth</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawal" className="flex items-center gap-2 py-3">
              <TrendingDown className="h-4 w-4" />
              <span className="hidden sm:inline">Withdrawal</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="mt-0">
            <GuideTab onLaunchMode={(mode) => handleTabChange(mode)} />
          </TabsContent>

          <TabsContent value="growth" className="mt-0">
            <GrowthMode />
          </TabsContent>

          <TabsContent value="withdrawal" className="mt-0">
            <WithdrawalMode />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}