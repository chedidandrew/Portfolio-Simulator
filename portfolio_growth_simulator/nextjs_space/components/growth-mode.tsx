'use client'

import { useEffect } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { GrowthState } from '@/lib/types'
import { triggerHaptic } from '@/hooks/use-haptics'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dices } from 'lucide-react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { roundToCents } from '@/lib/utils'
import { toast } from 'sonner'
import { GrowthParameters } from '@/components/growth/parameters'
import { GrowthResults } from '@/components/growth/results'
import { GrowthTable } from '@/components/growth/table'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { useGrowthCalculation } from '@/hooks/use-growth-calculation'

export function GrowthMode() {
  // 1. State
  const [state, setState] = useLocalStorage<GrowthState>('growth-mode-state', {
    startingBalance: 10000,
    annualReturn: 8,
    duration: 30,
    periodicAddition: 500,
    frequency: 'monthly',
    targetValue: 500000,
    inflationAdjustment: 0,
  })

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('growth-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('growth-show-full-precision', false)

  // 2. Logic Hook
  const calculation = useGrowthCalculation(state)

  // 3. Effects (URL Loading)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')
      if (!mcParam) return

      const decoded = JSON.parse(decodeURIComponent(atob(mcParam)))
      if (decoded?.mode === 'growth') {
        if (decoded.type === 'deterministic' && decoded.params) {
          setUseMonteCarloMode(false)
          setState(decoded.params)
          if (typeof decoded.showFullPrecision === 'boolean') {
            setShowFullPrecision(decoded.showFullPrecision)
          }
          window.history.replaceState(null, '', window.location.pathname)
        } else if (decoded.type !== 'deterministic' && !useMonteCarloMode) {
          setUseMonteCarloMode(true)
        }
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 4. Actions (Share / Export)
  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    const payload = {
      mode: 'growth',
      type: 'deterministic',
      params: state,
      showFullPrecision,
    }
    const encoded = typeof btoa !== 'undefined' ? btoa(encodeURIComponent(JSON.stringify(payload))) : ''
    if (encoded) url.searchParams.set('mc', encoded)
    return url.toString()
  }

  const handleShareLink = async () => {
    triggerHaptic('light')
    const url = buildShareUrl()
    if (!url) return

    try {
      // 1. Try Native Share (Mobile/Supported Browsers)
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({
          title: 'Portfolio Simulator',
          text: 'Take a look at my portfolio results',
          url,
        })
        return
      }
      
      // 2. Fallback to Clipboard (FIXED TYPE ERROR HERE)
      if ((navigator as any)?.clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(url)
        toast('Link copied')
        return
      }
      
      // 3. Fallback if neither works
      toast('Copy not supported on this browser')

    } catch (err: any) {
      // Ignore if user simply closed the share sheet
      const name = err?.name
      if (name === 'AbortError' || name === 'NotAllowedError') return
      // Notify user of actual failures only
      toast('Could not share or copy link')
    }
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window !== 'undefined') window.print()
  }

  const handleExportExcel = () => {
    triggerHaptic('light')
    if (!calculation.yearData.length) return

    const summaryRows = [
      { Key: 'Mode', Value: 'Growth (Deterministic)' },
      { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
      { Key: 'Annual Return %', Value: state.annualReturn },
      { Key: 'Duration Years', Value: state.duration },
      { Key: 'Contribution Amount', Value: roundToCents(state.periodicAddition) },
      { Key: 'Frequency', Value: state.frequency },
      { Key: 'Inflation Adjustment %', Value: state.inflationAdjustment },
      { Key: 'Target Value', Value: roundToCents(state.targetValue) || 'N/A' },
      { Key: 'Final Value', Value: roundToCents(calculation.finalValue) },
      { Key: 'Total Contributions', Value: roundToCents(calculation.totalContributions) },
      { Key: 'Total Profit', Value: roundToCents(calculation.totalProfit) },
    ]

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    ;(wsSummary as any)['!cols'] = [{ wch: 20 }, { wch: 20 }]

    const excelData = calculation.yearData.map(row => ({
      Year: row.year,
      'Starting Value': roundToCents(row.startingValue),
      Contributions: roundToCents(row.contributions),
      'Ending Value': roundToCents(row.endingValue),
    }))

    const wsData = XLSX.utils.json_to_sheet(excelData)
    ;(wsData as any)['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsData, 'Value By Year')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-growth-deterministic-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  // 5. Render
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

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-violet-500" />
                  <Label className="text-base font-semibold">
                    Monte Carlo Simulation
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Model market volatility with randomized scenarios
                </p>
              </div>
              <Switch
                checked={useMonteCarloMode}
                onCheckedChange={setUseMonteCarloMode}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {useMonteCarloMode ? (
        <MonteCarloSimulator mode="growth" initialValues={state} />
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GrowthParameters state={state} setState={setState} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GrowthResults
              data={calculation}
              targetValue={state.targetValue}
              showFullPrecision={showFullPrecision}
              setShowFullPrecision={setShowFullPrecision}
              onShare={handleShareLink}
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <GrowthTable data={calculation.yearData} />
          </motion.div>
        </>
      )}

      <DonationSection />
    </div>
  )
}