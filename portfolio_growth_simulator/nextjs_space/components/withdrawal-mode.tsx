'use client'

import { useEffect, useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { WithdrawalState, SimulationParams, SharePayload } from '@/lib/types'
import { triggerHaptic } from '@/hooks/use-haptics'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dices } from 'lucide-react'
import { motion } from 'framer-motion'
import ExcelJS from 'exceljs'
import { roundToCents } from '@/lib/utils'
import { toast } from 'sonner'
import { WithdrawalParameters } from '@/components/withdrawal/parameters'
import { WithdrawalResults } from '@/components/withdrawal/results'
import { WithdrawalTable } from '@/components/withdrawal/table'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { useWithdrawalCalculation } from '@/hooks/use-withdrawal-calculation'
import LZString from 'lz-string'

export function WithdrawalMode() {
  const [state, setState] = useLocalStorage<WithdrawalState>('withdrawal-mode-state', {
    startingBalance: 1000000,
    annualReturn: 7,
    duration: 30,
    periodicWithdrawal: 3000,
    inflationAdjustment: 2.5,
    frequency: 'monthly',
    excludeInflationAdjustment: false
  })

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('withdrawal-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('withdrawal-show-full-precision', false)

  // NEW: MC state restored from URL (passed into MonteCarloSimulator)
  const [initialRngSeed, setInitialRngSeed] = useState<string | null>(null)
  const [initialMCParams, setInitialMCParams] = useState<SimulationParams | undefined>(undefined)

  const calculation = useWithdrawalCalculation(state)

  // Listen for the event dispatched by app/page.tsx
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOpenFromLink = (event: any) => {
      const decoded = event.detail
      if (decoded?.mode !== 'withdrawal') return

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
        window.addEventListener('openMonteCarloFromLink', handleOpenFromLink)
        return () => window.removeEventListener('openMonteCarloFromLink', handleOpenFromLink)
      }
    } catch {}

    window.addEventListener('openMonteCarloFromLink', handleOpenFromLink)
    return () => window.removeEventListener('openMonteCarloFromLink', handleOpenFromLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)

    const payload = {
      mode: 'withdrawal',
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
      { header: 'Key', key: 'Key', width: 20 },
      { header: 'Value', key: 'Value', width: 20 },
    ]

    const summaryRows = [
      { Key: 'Mode', Value: 'Withdrawal (Deterministic)' },
      { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
      { Key: 'Annual Return %', Value: state.annualReturn },
      { Key: 'Duration Years', Value: state.duration },
      { Key: 'Withdrawal Amount', Value: roundToCents(state.periodicWithdrawal) },
      { Key: 'Inflation Adj %', Value: state.inflationAdjustment },
      { Key: 'Frequency', Value: state.frequency },
      { Key: 'Ending Balance', Value: roundToCents(calculation.endingBalance) },
      { Key: 'Total Withdrawn', Value: roundToCents(calculation.totalWithdrawn) },
      { Key: 'Sustainable', Value: calculation.isSustainable ? 'Yes' : 'No' },
    ]
    wsSummary.addRows(summaryRows)

    // 2. Data Sheet
    const wsData = workbook.addWorksheet('Balance By Year')
    wsData.columns = [
      { header: 'Year', key: 'Year', width: 10 },
      { header: 'Starting Balance', key: 'Starting Balance', width: 20 },
      { header: 'Withdrawals', key: 'Withdrawals', width: 20 },
      { header: 'Ending Balance', key: 'Ending Balance', width: 20 },
      { header: 'Sustainable', key: 'Sustainable', width: 15 },
    ]

    const excelData = calculation.yearData.map((row) => ({
      Year: row.year,
      'Starting Balance': roundToCents(row.startingBalance),
      Withdrawals: roundToCents(row.withdrawals),
      'Ending Balance': roundToCents(row.endingBalance),
      Sustainable: row.isSustainable ? 'Yes' : 'No',
    }))
    wsData.addRows(excelData)

    // Generate and Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-withdrawal-deterministic-${date}.xlsx`
    
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
        <h2 className="text-2xl font-bold">Plan Your Retirement Spending</h2>
        <p className="text-muted-foreground">
          Calculate how long your portfolio can sustain regular withdrawals
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-violet-500" />
                  <Label className="text-base font-semibold">Monte Carlo Simulation</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Model portfolio sustainability with randomized scenarios
                </p>
              </div>
              <Switch checked={useMonteCarloMode} onCheckedChange={setUseMonteCarloMode} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {useMonteCarloMode ? (
        <MonteCarloSimulator
          mode="withdrawal"
          initialValues={state}
          initialRngSeed={initialRngSeed}
          initialMCParams={initialMCParams}
        />
      ) : (
        <>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <WithdrawalParameters state={state} setState={setState} />
          </motion.div>

          <WithdrawalResults
            data={calculation}
            duration={state.duration}
            showFullPrecision={showFullPrecision}
            setShowFullPrecision={setShowFullPrecision}
            onShare={handleShareLink}
            onExportPdf={handleExportPdf}
            onExportExcel={handleExportExcel}
          />

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <WithdrawalTable data={calculation.yearData} />
          </motion.div>
        </>
      )}

      <DonationSection />
    </div>
  )
}