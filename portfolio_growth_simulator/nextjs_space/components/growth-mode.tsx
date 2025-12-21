'use client'

import { useEffect, useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { GrowthState, SimulationParams, SharePayload } from '@/lib/types'
import { triggerHaptic } from '@/hooks/use-haptics'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dices } from 'lucide-react'
import { motion } from 'framer-motion'
import ExcelJS from 'exceljs'
import { roundToCents } from '@/lib/utils'
import { toast } from 'sonner'
import { GrowthParameters } from '@/components/growth/parameters'
import { GrowthResults } from '@/components/growth/results'
import { GrowthTable } from '@/components/growth/table'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { useGrowthCalculation } from '@/hooks/use-growth-calculation'
import LZString from 'lz-string'

export function GrowthMode() {
  const [state, setState] = useLocalStorage<GrowthState>('growth-mode-state', {
    startingBalance: 10000,
    annualReturn: 8,
    duration: 30,
    periodicAddition: 500,
    frequency: 'monthly',
    targetValue: 500000,
    inflationAdjustment: 2.5,
    excludeInflationAdjustment: true,
    taxEnabled: false,
    taxRate: 0,
    taxType: 'capital_gains'
  })

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('growth-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('growth-show-full-precision', false)

  // NEW: MC state restored from URL (passed into MonteCarloSimulator)
  const [initialRngSeed, setInitialRngSeed] = useState<string | null>(null)
  const [initialMCParams, setInitialMCParams] = useState<SimulationParams | undefined>(undefined)

  const calculation = useGrowthCalculation(state)

  // Listen for the event dispatched by app/page.tsx
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOpenFromLink = (event: any) => {
      const decoded = event.detail
      if (decoded?.mode !== 'growth') return

      // 1) Restore deterministic params (supports new and old keys)
      const loadedParams = decoded.deterministicParams || decoded.params
      if (loadedParams) setState(loadedParams)

      // Restore precision toggle if present
      if (typeof decoded.showFullPrecision === 'boolean') {
        setShowFullPrecision(decoded.showFullPrecision)
      }

      // 2) Branch on link type
      if (decoded.type === 'deterministic') {
        setUseMonteCarloMode(false)
      } else {
        // 3) Monte Carlo link: enable MC and restore MC inputs
        setUseMonteCarloMode(true)
        if (decoded.rngSeed) setInitialRngSeed(decoded.rngSeed)
        if (decoded.mcParams) setInitialMCParams(decoded.mcParams)
      }
      
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname)
    }

    // Check on mount if we already have the payload in URL (direct load)
    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')
      if (mcParam) {
        // We let app/page.tsx handle the decoding and dispatching, 
        // but we add a listener here to catch it.
        window.addEventListener('openMonteCarloFromLink', handleOpenFromLink)
        return () => window.removeEventListener('openMonteCarloFromLink', handleOpenFromLink)
      }
    } catch {}

    // Also listen generally for navigation events
    window.addEventListener('openMonteCarloFromLink', handleOpenFromLink)
    return () => window.removeEventListener('openMonteCarloFromLink', handleOpenFromLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)

    // Dynamic payload based on current mode
    const payload = {
      mode: 'growth',
      type: useMonteCarloMode ? 'monte-carlo' : 'deterministic',
      deterministicParams: state,
      params: state, // legacy compatibility
      showFullPrecision,
    }

    // Legacy encoding method: encodeURIComponent -> btoa
    const encoded = typeof btoa !== 'undefined' ? btoa(encodeURIComponent(JSON.stringify(payload))) : ''
    
    if (encoded) url.searchParams.set('mc', encoded)
    return url.toString()
  }

  const handleShareLink = async () => {
    triggerHaptic('light')
    const url = buildShareUrl()
    if (!url) return

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({
          title: 'Portfolio Simulator',
          text: 'Take a look at my portfolio results',
          url,
        })
        return
      }

      if ((navigator as any)?.clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(url)
        toast('Link copied')
        return
      }

      toast('Copy not supported on this browser')
    } catch (err: any) {
      const name = err?.name
      if (name === 'AbortError' || name === 'NotAllowedError') return
      toast('Could not share or copy link')
    }
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window !== 'undefined') window.print()
  }

  const handleExportExcel = async () => {
    triggerHaptic('light')
    if (!calculation.yearData.length) return

    const workbook = new ExcelJS.Workbook()

    // 1. Summary Sheet
    const wsSummary = workbook.addWorksheet('Summary')
    wsSummary.columns = [
      { header: 'Key', key: 'Key', width: 25 },
      { header: 'Value', key: 'Value', width: 20 },
    ]

    const summaryRows = [
      { Key: 'Mode', Value: 'Growth (Deterministic)' },
      { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
      { Key: 'Annual Return %', Value: state.annualReturn },
      { Key: 'Duration Years', Value: state.duration },
      { Key: 'Contribution Amount', Value: roundToCents(state.periodicAddition) },
      { Key: 'Frequency', Value: state.frequency },
      { Key: 'Inflation Adjustment %', Value: state.inflationAdjustment },
      { Key: 'Target Value', Value: roundToCents(state.targetValue) || 'N/A' },
      { Key: 'Total Contributions', Value: roundToCents(calculation.totalContributions) },
      { Key: 'Total Profit (Gross)', Value: roundToCents(calculation.totalProfit) },
      { Key: 'Final Value (Gross)', Value: roundToCents(calculation.finalValue) },
    ]

    // Add Tax info if enabled
    if (state.taxEnabled) {
      const isIncome = state.taxType === 'income'
      summaryRows.push(
        { Key: 'Tax Enabled', Value: 'Yes' },
        { Key: 'Tax Rate', Value: `${state.taxRate}%` },
        { Key: 'Tax Type', Value: isIncome ? 'Annual (Income)' : 'Deferred (Capital Gains)' }
      )
      
      if (isIncome) {
         // Income Tax Mode: Taxes paid annually, final value is net
         summaryRows.push({ Key: 'Total Tax Paid', Value: roundToCents(calculation.totalTaxPaid) })
         summaryRows.push({ Key: 'Final Value (Net)', Value: roundToCents(calculation.finalValue) })
      } else {
         // Capital Gains Mode: Taxes deferred until end
         summaryRows.push({ Key: 'Est. Tax Liability', Value: roundToCents(calculation.totalDeferredTax) })
         summaryRows.push({ Key: 'Final Value (Net)', Value: roundToCents(calculation.finalValueNet) })
      }
    }

    wsSummary.addRows(summaryRows)

    // 2. Data Sheet
    const wsData = workbook.addWorksheet('Value By Year')
    wsData.columns = [
      { header: 'Year', key: 'Year', width: 10 },
      { header: 'Starting Value', key: 'Starting Value', width: 20 },
      { header: 'Contributions', key: 'Contributions', width: 20 },
      { header: 'Ending Value', key: 'Ending Value', width: 20 },
    ]

    const excelData = calculation.yearData.map((row) => ({
      Year: row.year,
      'Starting Value': roundToCents(row.startingValue),
      Contributions: roundToCents(row.contributions),
      'Ending Value': roundToCents(row.endingValue),
    }))
    wsData.addRows(excelData)

    // Generate and Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-growth-deterministic-${date}.xlsx`
    
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold">Calculate Your Portfolio Growth</h2>
        <p className="text-muted-foreground">
          See how compound interest and regular contributions can build wealth over time
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-violet-500" />
                  <Label className="text-base font-semibold">Monte Carlo Simulation</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Model market volatility with randomized scenarios
                </p>
              </div>
              <Switch checked={useMonteCarloMode} onCheckedChange={setUseMonteCarloMode} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {useMonteCarloMode ? (
        <MonteCarloSimulator
          mode="growth"
          initialValues={state}
          initialRngSeed={initialRngSeed}
          initialMCParams={initialMCParams}
        />
      ) : (
        <>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <GrowthParameters state={state} setState={setState} />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <GrowthResults
              data={calculation}
              targetValue={state.targetValue}
              taxEnabled={state.taxEnabled}
              taxType={state.taxType}
              showFullPrecision={showFullPrecision}
              setShowFullPrecision={setShowFullPrecision}
              onShare={handleShareLink}
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <GrowthTable data={calculation.yearData} />
          </motion.div>
        </>
      )}

      <DonationSection />
    </div>
  )
}