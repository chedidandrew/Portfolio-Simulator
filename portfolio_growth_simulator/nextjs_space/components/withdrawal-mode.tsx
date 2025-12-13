'use client'

import { useEffect } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { WithdrawalState } from '@/lib/types'
import { triggerHaptic } from '@/hooks/use-haptics'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dices } from 'lucide-react'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { roundToCents } from '@/lib/utils'
import { toast } from 'sonner'
import { WithdrawalParameters } from '@/components/withdrawal/parameters'
import { WithdrawalResults } from '@/components/withdrawal/results'
import { WithdrawalTable } from '@/components/withdrawal/table'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { useWithdrawalCalculation } from '@/hooks/use-withdrawal-calculation'

export function WithdrawalMode() {
  const [state, setState] = useLocalStorage<WithdrawalState>('withdrawal-mode-state', {
    startingBalance: 1000000,
    annualReturn: 7,
    duration: 30,
    periodicWithdrawal: 3000,
    inflationAdjustment: 2.5,
    frequency: 'monthly',
  })

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('withdrawal-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('withdrawal-show-full-precision', false)

  const calculation = useWithdrawalCalculation(state)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')
      if (!mcParam) return

      const decoded = JSON.parse(decodeURIComponent(atob(mcParam)))
      if (decoded?.mode === 'withdrawal') {
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

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    const payload = {
      mode: 'withdrawal',
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

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    ;(wsSummary as any)['!cols'] = [{ wch: 20 }, { wch: 20 }]

    const excelData = calculation.yearData.map(row => ({
      Year: row.year,
      'Starting Balance': roundToCents(row.startingBalance),
      'Withdrawals': roundToCents(row.withdrawals),
      'Ending Balance': roundToCents(row.endingBalance),
      'Sustainable': row.isSustainable ? 'Yes' : 'No',
    }))

    const wsData = XLSX.utils.json_to_sheet(excelData)
    ;(wsData as any)['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsData, 'Balance By Year')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-withdrawal-deterministic-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Plan Your Retirement Spending</h2>
        <p className="text-muted-foreground">Calculate how long your portfolio can sustain regular withdrawals</p>
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
                <p className="text-sm text-muted-foreground">Model portfolio sustainability with randomized scenarios</p>
              </div>
              <Switch checked={useMonteCarloMode} onCheckedChange={setUseMonteCarloMode} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {useMonteCarloMode ? (
        <MonteCarloSimulator mode="withdrawal" initialValues={state} />
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