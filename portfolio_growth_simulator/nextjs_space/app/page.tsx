'use client'

import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Moon, Sun, TrendingUp, TrendingDown, BookOpen } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { GrowthMode } from '@/components/growth-mode'
import { WithdrawalMode } from '@/components/withdrawal-mode'
import { GuideTab } from '@/components/guide-tab'
import LZString from 'lz-string'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<'growth' | 'withdrawal' | 'guide'>('growth')
  const [mounted, setMounted] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const lastScrollY = useRef(0)
  const scrollThreshold = 10

  useEffect(() => {
    setMounted(true)
  }, [])

  // Decide which tab to show on first load and on return
  useEffect(() => {
    if (typeof window === 'undefined') return

    // If URL has a Monte Carlo payload, honor that first
    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')

      if (mcParam) {
        // 1. Try decompressing with LZString (New Format)
        let jsonStr = LZString.decompressFromEncodedURIComponent(mcParam)

        // 2. Fallback to atob (Old Format)
        if (!jsonStr) {
          try {
             jsonStr = decodeURIComponent(atob(mcParam))
          } catch {
             // Not a valid legacy link
          }
        }

        if (jsonStr) {
          const decoded = JSON.parse(jsonStr)
          const mode = decoded?.mode === 'withdrawal' ? 'withdrawal' : 'growth'

          setActiveTab(mode)
          localStorage.setItem('visited', 'true')
          localStorage.setItem('lastTab', mode)
          
          // Dispatch event with the FULL decoded object (including results)
          window.dispatchEvent(new CustomEvent('openMonteCarloFromLink', { 
            detail: decoded 
          }))
          
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme?.(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
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