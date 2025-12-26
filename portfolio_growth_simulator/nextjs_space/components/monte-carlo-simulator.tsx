'use client'

import { useState } from 'react'
import { useMonteCarlo } from '@/hooks/use-monte-carlo'
import { MonteCarloParameters } from '@/components/monte-carlo/parameters'
import { MonteCarloResults, ExportState } from '@/components/monte-carlo/results'
import { triggerHaptic } from '@/hooks/use-haptics'
import ExcelJS from 'exceljs'
import { roundToCents } from '@/lib/utils'
import { toast } from 'sonner'
import LZString from 'lz-string'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { SimulationParams, SharePayload } from '@/lib/types'

interface MonteCarloSimulatorProps {
  mode: 'growth' | 'withdrawal'
  initialValues: any

  // Props for restoring state from URL
  initialRngSeed?: string | null
  initialMCParams?: SimulationParams
  initialLogScales?: SharePayload['logScales']
  initialShowFullPrecision?: boolean
}

export function MonteCarloSimulator({
  mode,
  initialValues,
  initialRngSeed,
  initialMCParams,
  initialLogScales,
  initialShowFullPrecision,
}: MonteCarloSimulatorProps) {
  const {
    profile,
    setProfile,
    params,
    setParams,
    results,
    isSimulating,
    logScales,
    setLogScales,
    rngSeed,
    showFullPrecision,
    setShowFullPrecision,
    runSimulation,
    PRESET_PROFILES,
  } = useMonteCarlo(mode, initialValues, initialRngSeed, initialMCParams, initialLogScales, initialShowFullPrecision)

  const [exportState, setExportState] = useState<ExportState>('idle')

  // NEW: Track the parameters used for the last successful run to detect changes
  const [lastRunParamsStr, setLastRunParamsStr] = useState<string>(() => JSON.stringify(params))

  // NEW: Determine if current inputs differ from the results on screen
  const isOutdated = results && JSON.stringify(params) !== lastRunParamsStr

  const handleRunSimulation = () => {
    // Sync the "Last Run" params with current params when user clicks Run
    setLastRunParamsStr(JSON.stringify(params))
    runSimulation(undefined, `monte-carlo-${Date.now()}-${Math.random()}`)
  }

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)

    let mcParamsToShare = params
    if (isOutdated) {
      try {
        mcParamsToShare = JSON.parse(lastRunParamsStr)
      } catch {}
    }

    const payload: SharePayload = {
      mode,
      type: 'monte-carlo',
      deterministicParams: initialValues, // parent state
      mcParams: mcParamsToShare, // child state
      rngSeed,
      logScales,
      showFullPrecision,
    }

    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload))
    if (compressed) url.searchParams.set('mc', compressed)
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

  const generateExcel = async (simResults: any) => {
    if (!simResults) return

    const {
      mean,
      meanGross,
      median,
      medianGross,
      p5,
      p5Gross,
      p10,
      p10Gross,
      p25,
      p25Gross,
      p75,
      p75Gross,
      p90,
      p90Gross,
      p95,
      p95Gross,
      best,
      bestGross,
      worst,
      worstGross,
      chartData,
      chartDataGross,
      endingValues,
      endingValuesGross,
      maxDrawdowns,
      annualReturnsData,
      lossProbData,
      numPathsUsed,
      investmentData,
      totalTaxCost,
      taxDragAmount,
    } = simResults

    const totalInvested =
      investmentData && investmentData.length > 0
        ? investmentData[investmentData.length - 1].total
        : params.initialValue

    const investedLabel = mode === 'withdrawal' ? 'Starting Balance' : 'Total Invested'
    const showGrossSummary = !!params.taxEnabled && mode === 'growth' && (params.taxType === 'capital_gains' || params.taxType === 'tax_deferred')

    const workbook = new ExcelJS.Workbook()

    // 1. Summary Sheet
    const wsSummary = workbook.addWorksheet('Summary')
    wsSummary.columns = [
      { header: 'Key', key: 'Key', width: 26 },
      { header: 'Value', key: 'Value', width: 20 },
    ]
    const summaryRows = [
      { Key: 'Mode', Value: mode },
      { Key: 'Initial Value', Value: roundToCents(params.initialValue) },
      { Key: investedLabel, Value: roundToCents(totalInvested) },
      { Key: 'Expected Return %', Value: params.expectedReturn },
      { Key: 'Volatility %', Value: params.volatility },
      { Key: 'Duration Years', Value: params.duration },
      { Key: 'Monthly Cashflow', Value: roundToCents(params.cashflowAmount) },
      { Key: 'Inflation Adjustment %', Value: params.inflationAdjustment ?? 0 },
      { Key: 'Number Of Scenarios', Value: numPathsUsed },
      { Key: showGrossSummary ? 'Mean Ending Value (Net)' : 'Mean Ending Value', Value: roundToCents(mean) },
      { Key: showGrossSummary ? 'Median Ending Value (Net)' : 'Median Ending Value', Value: roundToCents(median) },
      ...(showGrossSummary ? [
        { Key: 'Mean Ending Value (Gross)', Value: roundToCents(meanGross) },
        { Key: 'Median Ending Value (Gross)', Value: roundToCents(medianGross) },
      ] : []),
    ]

    if (params.taxEnabled) {
      const taxTypeLabel =
        params.taxType === 'income'
          ? 'Annual income tax drag'
          : (params.taxType === 'tax_deferred'
            ? 'Tax deferred (401k/IRA), taxed on withdrawal'
            : 'Taxable Account (capital gains on liquidation)')
      summaryRows.push({ Key: 'Tax Type', Value: taxTypeLabel })
      if (mode === 'growth' && (params.taxType === 'capital_gains' || params.taxType === 'tax_deferred') && (totalTaxCost ?? taxDragAmount)) {
        summaryRows.push({ Key: 'Est. Tax Cost', Value: roundToCents(totalTaxCost ?? taxDragAmount) })
      }
    }

    summaryRows.push(
      { Key: showGrossSummary ? 'P5 Ending Value (Net)' : 'P5 Ending Value', Value: roundToCents(p5) },
      { Key: 'P10 Ending Value', Value: roundToCents(p10) },
      { Key: 'P25 Ending Value', Value: roundToCents(p25) },
      { Key: 'P75 Ending Value', Value: roundToCents(p75) },
      { Key: 'P90 Ending Value', Value: roundToCents(p90) },
      { Key: 'P95 Ending Value', Value: roundToCents(p95) },
      { Key: 'Best Ending Value', Value: roundToCents(best) },
      { Key: 'Worst Ending Value', Value: roundToCents(worst) },
      { Key: 'Random Seed', Value: rngSeed ?? '' }
    )

    if (showGrossSummary) {
      summaryRows.push(
        { Key: 'P5 Ending Value (Gross)', Value: roundToCents(p5Gross) },
        { Key: 'P10 Ending Value (Gross)', Value: roundToCents(p10Gross) },
        { Key: 'P25 Ending Value (Gross)', Value: roundToCents(p25Gross) },
        { Key: 'P75 Ending Value (Gross)', Value: roundToCents(p75Gross) },
        { Key: 'P90 Ending Value (Gross)', Value: roundToCents(p90Gross) },
        { Key: 'P95 Ending Value (Gross)', Value: roundToCents(p95Gross) },
        { Key: 'Best Ending Value (Gross)', Value: roundToCents(bestGross) },
        { Key: 'Worst Ending Value (Gross)', Value: roundToCents(worstGross) },
      )
    }

    wsSummary.addRows(summaryRows)

    // 2. Percentiles
    const wsPercentiles = workbook.addWorksheet('Percentiles')
    wsPercentiles.columns = [
      { header: 'Year', key: 'Year', width: 8 },
      { header: 'P10', key: 'P10', width: 16 },
      { header: 'P25', key: 'P25', width: 16 },
      { header: 'Median (P50)', key: 'Median (P50)', width: 18 },
      { header: 'P75', key: 'P75', width: 16 },
      { header: 'P90', key: 'P90', width: 16 },
    ]
    const percentileRows = (chartData ?? []).map((row: any) => ({
      Year: Number(row.year.toFixed(2)),
      P10: roundToCents(row.p10),
      P25: roundToCents(row.p25),
      'Median (P50)': roundToCents(row.p50),
      P75: roundToCents(row.p75),
      P90: roundToCents(row.p90),
    }))
    wsPercentiles.addRows(percentileRows)

    // 3. Annual Returns
    const wsAnnual = workbook.addWorksheet('Annual Returns')
    wsAnnual.columns = [
      { header: 'Year', key: 'Year', width: 8 },
      { header: 'CAGR P10 %', key: 'CAGR P10 %', width: 12 },
      { header: 'CAGR P25 %', key: 'CAGR P25 %', width: 12 },
      { header: 'CAGR Median %', key: 'CAGR Median %', width: 15 },
      { header: 'CAGR P75 %', key: 'CAGR P75 %', width: 12 },
      { header: 'CAGR P90 %', key: 'CAGR P90 %', width: 12 },
      { header: 'Prob ≥ 5%', key: 'Prob ≥ 5%', width: 12 },
      { header: 'Prob ≥ 8%', key: 'Prob ≥ 8%', width: 13 },
      { header: 'Prob ≥ 10%', key: 'Prob ≥ 10%', width: 13 },
      { header: 'Prob ≥ 12%', key: 'Prob ≥ 12%', width: 13 },
      { header: 'Prob ≥ 15%', key: 'Prob ≥ 15%', width: 13 },
      { header: 'Prob ≥ 20%', key: 'Prob ≥ 20%', width: 13 },
      { header: 'Prob ≥ 25%', key: 'Prob ≥ 25%', width: 13 },
      { header: 'Prob ≥ 30%', key: 'Prob ≥ 30%', width: 13 },
    ]
    const annualRows = (annualReturnsData ?? []).map((row: any) => ({
      Year: row.year,
      'CAGR P10 %': roundToCents(row.p10),
      'CAGR P25 %': roundToCents(row.p25),
      'CAGR Median %': roundToCents(row.median),
      'CAGR P75 %': roundToCents(row.p75),
      'CAGR P90 %': roundToCents(row.p90),
      'Prob ≥ 5%': roundToCents(row.prob5),
      'Prob ≥ 8%': roundToCents(row.prob8),
      'Prob ≥ 10%': roundToCents(row.prob10),
      'Prob ≥ 12%': roundToCents(row.prob12),
      'Prob ≥ 15%': roundToCents(row.prob15),
      'Prob ≥ 20%': roundToCents(row.prob20),
      'Prob ≥ 25%': roundToCents(row.prob25),
      'Prob ≥ 30%': roundToCents(row.prob30),
    }))
    wsAnnual.addRows(annualRows)

    // 4. Investment Breakdown
    const wsInvestment = workbook.addWorksheet('Investment Breakdown')
    wsInvestment.columns = [
      { header: 'Year', key: 'Year', width: 8 },
      { header: 'Initial Principal', key: 'Initial Principal', width: 18 },
      { header: 'Cumulative Contributions', key: 'Cumulative Contributions', width: 22 },
      { header: 'Total Invested', key: 'Total Invested', width: 18 },
    ]
    const investmentRows = (investmentData ?? []).map((row: any) => ({
      Year: row.year,
      'Initial Principal': roundToCents(row.initial),
      'Cumulative Contributions': roundToCents(row.contributions),
      'Total Invested': roundToCents(row.total),
    }))
    wsInvestment.addRows(investmentRows)

    // 5. Ending Values
    const wsEnding = workbook.addWorksheet('Ending Values')
    wsEnding.columns = [
      { header: 'Scenario', key: 'Scenario', width: 10 },
      { header: 'Ending Value', key: 'Ending Value', width: 18 },
    ]
    const endingRows = (endingValues ?? []).map((v: number, idx: number) => ({
      Scenario: idx + 1,
      'Ending Value': roundToCents(v),
    }))
    wsEnding.addRows(endingRows)

    // 6. Max Drawdowns
    const wsDrawdowns = workbook.addWorksheet('Max Drawdowns')
    wsDrawdowns.columns = [
      { header: 'Scenario', key: 'Scenario', width: 10 },
      { header: 'Max Drawdown %', key: 'Max Drawdown %', width: 18 },
    ]
    const ddRows = (maxDrawdowns ?? []).map((d: number, idx: number) => ({
      Scenario: idx + 1,
      'Max Drawdown %': roundToCents(d * 100),
    }))
    wsDrawdowns.addRows(ddRows)

    // 7. Loss Probabilities
    const wsLoss = workbook.addWorksheet('Loss Probabilities')
    wsLoss.columns = [
      { header: 'Loss Threshold', key: 'Loss Threshold', width: 16 },
      { header: 'End of Period Loss %', key: 'End of Period Loss %', width: 20 },
      { header: 'Intra period Loss %', key: 'Intra period Loss %', width: 20 },
    ]
    const lossRows = (lossProbData ?? []).map((row: any) => ({
      'Loss Threshold': row.threshold,
      'End of Period Loss %': roundToCents(row.endPeriod),
      'Intra period Loss %': roundToCents(row.intraPeriod),
    }))
    wsLoss.addRows(lossRows)

    // Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    const fileName = `monte-carlo-simulation-${mode}-${date}.xlsx`
    
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const isDirty = () => {
    if (!results) return true
    return true
  }

  const handleExportExcel = () => {
    triggerHaptic('light')
    setExportState('excel')
    
    // Sync params for the export run
    setLastRunParamsStr(JSON.stringify(params))

    setTimeout(() => {
      runSimulation(undefined, undefined, undefined, (newResults) => {
        setTimeout(() => {
          generateExcel(newResults)
          setExportState('idle')
        }, 50)
      })
    }, 50)
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window !== 'undefined') {
      setExportState('pdf')
      
      // Sync params for the pdf export run
      setLastRunParamsStr(JSON.stringify(params))

      setTimeout(() => {
        runSimulation(undefined, undefined, undefined, () => {
          setTimeout(() => {
            window.print()
            setExportState('idle')
          }, 50)
        })
      }, 50)
    }
  }

  return (
    <div className="space-y-6">
      <MonteCarloParameters
        mode={mode}
        params={params}
        setParams={setParams}
        profile={profile}
        setProfile={setProfile}
        isSimulating={isSimulating}
        onRun={handleRunSimulation}
        presetProfiles={PRESET_PROFILES}
      />
      
      {isOutdated && results && !isSimulating && (
        <Alert className="bg-yellow-500/10 border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>Results Outdated</AlertTitle>
           <AlertDescription>
             Your parameters have changed. Please run the simulation again to see updated results.
           </AlertDescription>
        </Alert>
      )}

      {results && (
        <MonteCarloResults
          mode={mode}
          results={results}
          params={params}
          logScales={logScales}
          setLogScales={setLogScales}
          showFullPrecision={showFullPrecision}
          setShowFullPrecision={setShowFullPrecision}
          onShare={handleShareLink}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          exportState={exportState}
        />
      )}
    </div>
  )
}