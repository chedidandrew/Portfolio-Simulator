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
import { getAppCurrency, roundToCents } from '@/lib/utils'
import { toast } from 'sonner'
import { GrowthParameters } from '@/components/growth/parameters'
import { GrowthResults } from '@/components/growth/results'
import { GrowthTable } from '@/components/growth/table'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { useGrowthCalculation } from '@/hooks/use-growth-calculation'
import { CalculationErrorCard } from '@/components/calculation-error-card'
import { clearSimulatorScenario } from '@/lib/owned-storage'
import { isValidGrowthState, validateGrowthStateRange } from '@/lib/simulation/deterministic-validation'
import { MONTE_CARLO_SWITCH_LABELS } from '@/lib/accessibility-labels'
import { normalizeGrowthState } from '@/lib/state-normalization'
import { DEFAULT_GROWTH_STATE } from '@/lib/default-states'
import { buildShareUrl as buildVersionedShareUrl, cleanShareDataFromUrl } from '@/lib/share-links'

export { DEFAULT_GROWTH_STATE } from '@/lib/default-states'

export function GrowthMode({ sharedPayload }: { sharedPayload?: SharePayload | null }) {
  const [state, setState] = useLocalStorage<GrowthState>(
    'growth-mode-state',
    DEFAULT_GROWTH_STATE,
    {
      normalize: normalizeGrowthState,
      validatePersisted: isValidGrowthState,
      shouldPersist: (nextState) => validateGrowthStateRange(nextState) === null,
    },
  )

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('growth-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('growth-show-full-precision', false)

  // NEW: MC state restored from URL (passed into MonteCarloSimulator)
  const [initialRngSeed, setInitialRngSeed] = useState<string | null>(null)
  const [initialMCParams, setInitialMCParams] = useState<SimulationParams | undefined>(undefined)

  const [initialLogScales, setInitialLogScales] = useState<SharePayload['logScales'] | undefined>(undefined)
  const [initialMCShowFullPrecision, setInitialMCShowFullPrecision] = useState<boolean | undefined>(undefined)

  const calculationState = useGrowthCalculation(state)
  const calculation = calculationState.result

  // Listen for the event dispatched by app/page.tsx
  useEffect(() => {
    if (typeof window === 'undefined') return

    const applySharedPayload = (decoded: SharePayload) => {
      if (decoded?.mode !== 'growth') return

      // 1) Restore deterministic params (supports new and old keys)
      const loadedParams = decoded.deterministicParams || decoded.params
      if (loadedParams && 'periodicAddition' in loadedParams) setState(loadedParams)

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
      window.history.replaceState(null, '', cleanShareDataFromUrl(window.location.href))
    }

    const handleOpenFromLink = (event: Event) => {
      applySharedPayload((event as CustomEvent<SharePayload>).detail)
    }

    if (sharedPayload) applySharedPayload(sharedPayload)

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
  }, [sharedPayload, setInitialMCParams, setInitialMCShowFullPrecision, setInitialRngSeed, setInitialLogScales, setShowFullPrecision, setState, setUseMonteCarloMode])

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)

    const payload: SharePayload = {
      mode: 'growth',
      type: useMonteCarloMode ? 'monte-carlo' : 'deterministic',
      deterministicParams: state,
      params: state, // legacy compatibility
      showFullPrecision,
    }

    return buildVersionedShareUrl(url.toString(), payload, getAppCurrency().code)
  }

  const handleShareLink = async () => {
    triggerHaptic('light')
    const url = buildShareUrl()
    if (!url) return

    try {
      const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      if (canNativeShare) {
        await navigator.share({
          title: 'Portfolio Simulator',
          text: 'Take a look at my portfolio results',
          url,
        })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        toast('Link copied')
        return
      }

      toast('Copy not supported on this browser')
    } catch (error: unknown) {
      const name = error instanceof DOMException || error instanceof Error ? error.name : undefined
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
    if (!calculation?.yearData.length) return

    const [{ default: ExcelJS }, { formatFinancialWorkbook }] = await Promise.all([
      import('exceljs'),
      import('@/lib/export/excel-formatting'),
    ])
    const workbook = new ExcelJS.Workbook()

    // 1. Summary Sheet
    const wsSummary = workbook.addWorksheet('Summary')
    wsSummary.columns = [
      { header: 'Key', key: 'Key', width: 25 },
      { header: 'Value', key: 'Value', width: 20 },
    ]

    const summaryRows = [
      { Key: 'Mode', Value: 'Growth (Deterministic)' },
      { Key: 'Display Currency', Value: getAppCurrency().code },
      { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
      { Key: 'Annual Return %', Value: state.annualReturn },
      { Key: 'Duration Years', Value: state.duration },
      { Key: 'Contribution Amount', Value: roundToCents(state.periodicAddition) },
      { Key: 'Frequency', Value: state.frequency },
      { Key: 'Inflation Adjustment %', Value: state.inflationAdjustment },
      { Key: 'Target Value', Value: roundToCents(state.targetValue) || 'N/A' },
      { Key: 'Total Invested', Value: roundToCents(calculation.totalContributions) },
      { Key: 'Periodic Contributions', Value: roundToCents(calculation.periodicContributions) },
      { Key: "Final Value (Today's Dollars)", Value: roundToCents(calculation.finalValueInTodaysDollars) },
    ]

    // Add Tax info if enabled
    if (state.taxEnabled) {
      const isIncome = state.taxType === 'income'
      const taxTypeLabel =
        state.taxType === 'income'
          ? 'Annual income tax drag'
          : (state.taxType === 'tax_deferred'
            ? 'Tax deferred (401k/IRA), taxed on withdrawal'
            : 'Taxable Account (capital gains on liquidation)')
      summaryRows.push(
        { Key: 'Tax Enabled', Value: 'Yes' },
        { Key: 'Tax Rate', Value: `${state.taxRate}%` },
        { Key: 'Tax Type', Value: taxTypeLabel }
      )
      
      if (isIncome) {
         // Income Tax Mode: Taxes paid annually (tax drag), final value is net
         summaryRows.push({ Key: 'Total Profit', Value: roundToCents(calculation.totalProfit) })
         summaryRows.push({ Key: 'Final Value', Value: roundToCents(calculation.finalValueNet) })
         summaryRows.push({ Key: 'Tax Drag', Value: roundToCents(calculation.totalTaxDrag ?? calculation.totalTaxPaid) })
      } else {
         // Capital Gains Mode: Taxes deferred until end
         summaryRows.push({ Key: 'Total Profit (Gross)', Value: roundToCents(calculation.finalValue - calculation.totalContributions) })
         summaryRows.push({ Key: 'Final Value (Gross)', Value: roundToCents(calculation.finalValue) })
         summaryRows.push({ Key: 'Est. Tax Liability', Value: roundToCents(calculation.totalDeferredTax) })
         summaryRows.push({ Key: 'Final Value (Net)', Value: roundToCents(calculation.finalValueNet) })
         summaryRows.push({ Key: 'Total Profit (Net)', Value: roundToCents(calculation.totalProfit) })
         summaryRows.push({ Key: 'Est. Tax Cost', Value: roundToCents(calculation.totalTaxCost ?? calculation.totalDeferredTax) })
      }
    } else {
      // No Tax Enabled
      summaryRows.push({ Key: 'Total Profit', Value: roundToCents(calculation.totalProfit) })
      summaryRows.push({ Key: 'Final Value', Value: roundToCents(calculation.finalValue) })
    }

    wsSummary.addRows(summaryRows)

    // 2. Data Sheet
    const wsData = workbook.addWorksheet('Value By Year')

    const showIncomeTaxColumn = !!state.taxEnabled && state.taxType === 'income'
    // FIXED: Defined this variable which was missing in your code
    const hasGrossColumns = !!state.taxEnabled && state.taxType !== 'income'
    
    wsData.columns = [
      { header: 'Year', key: 'Year', width: 10 },
      { header: 'Starting Value', key: 'Starting Value', width: 20 },
      ...(hasGrossColumns ? [{ header: 'Starting Value (Gross)', key: 'Starting Value (Gross)', width: 20 }] : []),
      { header: 'Contributions', key: 'Contributions', width: 20 },
      { header: 'Interest Earned', key: 'Interest Earned', width: 20 },
      ...(showIncomeTaxColumn ? [{ header: 'Tax Drag', key: 'Tax Drag', width: 20 }] : []),
      { header: 'Ending Value', key: 'Ending Value', width: 20 },
      ...(hasGrossColumns ? [{ header: 'Ending Value (Gross)', key: 'Ending Value (Gross)', width: 20 }] : []),
    ]

    const excelData = calculation.yearData.map((row: any) => ({
      Year: row.year,
      'Starting Value': roundToCents(row.startingValue),
      ...(hasGrossColumns ? { 'Starting Value (Gross)': roundToCents(row.grossStartingValue ?? row.startingValue) } : {}),
      Contributions: roundToCents(row.contributions),
      'Interest Earned': roundToCents(row.interest),
      ...(showIncomeTaxColumn ? { 'Tax Drag': roundToCents(row.taxPaid) } : {}),
      'Ending Value': roundToCents(row.endingValue),
      ...(hasGrossColumns ? { 'Ending Value (Gross)': roundToCents(row.grossEndingValue ?? row.endingValue) } : {}),
    }))
    wsData.addRows(excelData)
    formatFinancialWorkbook(workbook, getAppCurrency().symbol)

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

  const handleResetScenario = () => {
    if (typeof window !== 'undefined') clearSimulatorScenario(window.localStorage, 'growth')
    setState(DEFAULT_GROWTH_STATE)
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
              <Switch
                id="growth-monte-carlo-mode"
                aria-label={MONTE_CARLO_SWITCH_LABELS.growth}
                checked={useMonteCarloMode}
                onCheckedChange={setUseMonteCarloMode}
              />
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
          initialLogScales={initialLogScales}
          initialShowFullPrecision={initialMCShowFullPrecision}
        />
      ) : (
        <>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <GrowthParameters state={state} setState={setState} />
          </motion.div>

          {calculationState.error ? (
            <CalculationErrorCard message={calculationState.error} onReset={handleResetScenario} />
          ) : calculation ? (
            <>
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
                <GrowthTable data={calculation.yearData} taxEnabled={state.taxEnabled} taxType={state.taxType} />
              </motion.div>
            </>
          ) : null}
        </>
      )}

      <DonationSection />
    </div>
  )
}
