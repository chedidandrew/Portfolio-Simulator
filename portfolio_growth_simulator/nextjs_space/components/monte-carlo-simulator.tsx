'use client'

import { useState } from 'react'
import { useMonteCarlo } from '@/hooks/use-monte-carlo'
import { MonteCarloParameters } from '@/components/monte-carlo/parameters'
import { MonteCarloResults, ExportState } from '@/components/monte-carlo/results'
import { triggerHaptic } from '@/hooks/use-haptics'
import * as XLSX from 'xlsx'
import { roundToCents } from '@/lib/utils'
import { toast } from 'sonner'

interface MonteCarloSimulatorProps {
  mode: 'growth' | 'withdrawal'
  initialValues: any
}

export function MonteCarloSimulator({ mode, initialValues }: MonteCarloSimulatorProps) {
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
  } = useMonteCarlo(mode, initialValues)

  const [exportState, setExportState] = useState<ExportState>('idle')

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    const payload = {
      mode,
      params,
      rngSeed,
      logScales,
      showFullPrecision,
    }
    const encoded =
      typeof btoa !== 'undefined'
        ? btoa(encodeURIComponent(JSON.stringify(payload)))
        : ''
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

  const generateExcel = (simResults: any) => {
    if (!simResults) return

    const {
      mean,
      median,
      p5,
      p10,
      p25,
      p75,
      p90,
      p95,
      best,
      worst,
      chartData,
      endingValues,
      maxDrawdowns,
      annualReturnsData,
      lossProbData,
      numPathsUsed,
      investmentData,
    } = simResults

    const totalInvested =
      investmentData && investmentData.length > 0
        ? investmentData[investmentData.length - 1].total
        : params.initialValue

    const investedLabel =
      mode === 'withdrawal' ? 'Starting Balance' : 'Total Invested'

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
      { Key: 'Mean Ending Value', Value: roundToCents(mean) },
      { Key: 'Median Ending Value', Value: roundToCents(median) },
      { Key: 'P5 Ending Value', Value: roundToCents(p5) },
      { Key: 'P10 Ending Value', Value: roundToCents(p10) },
      { Key: 'P25 Ending Value', Value: roundToCents(p25) },
      { Key: 'P75 Ending Value', Value: roundToCents(p75) },
      { Key: 'P90 Ending Value', Value: roundToCents(p90) },
      { Key: 'P95 Ending Value', Value: roundToCents(p95) },
      { Key: 'Best Ending Value', Value: roundToCents(best) },
      { Key: 'Worst Ending Value', Value: roundToCents(worst) },
      { Key: 'Random Seed', Value: rngSeed ?? '' },
    ]

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    ;(wsSummary as any)['!cols'] = [{ wch: 26 }, { wch: 20 }]

    const percentileRows = (chartData ?? []).map((row: any) => ({
      Year: row.year,
      P10: roundToCents(row.p10),
      P25: roundToCents(row.p25),
      'Median (P50)': roundToCents(row.p50),
      P75: roundToCents(row.p75),
      P90: roundToCents(row.p90),
    }))
    const wsPercentiles = XLSX.utils.json_to_sheet(percentileRows)
    ;(wsPercentiles as any)['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
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
    const wsAnnual = XLSX.utils.json_to_sheet(annualRows)
    ;(wsAnnual as any)['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
      { wch: 13 },
    ]

    const investmentRows = (investmentData ?? []).map((row: any) => ({
      Year: row.year,
      'Initial Principal': roundToCents(row.initial),
      'Cumulative Contributions': roundToCents(row.contributions),
      'Total Invested': roundToCents(row.total),
    }))
    const wsInvestment = XLSX.utils.json_to_sheet(investmentRows)
    ;(wsInvestment as any)['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
    ]

    const endingRows = (endingValues ?? []).map((v: number, idx: number) => ({
      Scenario: idx + 1,
      'Ending Value': roundToCents(v),
    }))
    const wsEnding = XLSX.utils.json_to_sheet(endingRows)
    ;(wsEnding as any)['!cols'] = [{ wch: 10 }, { wch: 18 }]

    const ddRows = (maxDrawdowns ?? []).map((d: number, idx: number) => ({
      Scenario: idx + 1,
      'Max Drawdown %': roundToCents(d * 100),
    }))
    const wsDrawdowns = XLSX.utils.json_to_sheet(ddRows)
    ;(wsDrawdowns as any)['!cols'] = [{ wch: 10 }, { wch: 18 }]

    const lossRows = (lossProbData ?? []).map((row: any) => ({
      'Loss Threshold': row.threshold,
      'End of Period Loss %': roundToCents(row.endPeriod),
      'Intra period Loss %': roundToCents(row.intraPeriod),
    }))
    const wsLoss = XLSX.utils.json_to_sheet(lossRows)
    ;(wsLoss as any)['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 20 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsPercentiles, 'Yearly Percentiles')
    XLSX.utils.book_append_sheet(wb, wsAnnual, 'Annual Returns')
    XLSX.utils.book_append_sheet(wb, wsInvestment, 'Investment Breakdown')
    XLSX.utils.book_append_sheet(wb, wsEnding, 'Ending Values')
    XLSX.utils.book_append_sheet(wb, wsDrawdowns, 'Max Drawdowns')
    XLSX.utils.book_append_sheet(wb, wsLoss, 'Loss Probabilities')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `monte-carlo-simulation-${mode}-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  // Check if current params are different from the ones used to generate results
  const isDirty = () => {
    if (!results) return true
    if (!results.simulationParams) return true // For legacy data without params
    return JSON.stringify(params) !== JSON.stringify(results.simulationParams)
  }

  const handleExportExcel = () => {
    triggerHaptic('light')
    setExportState('excel')
    
    setTimeout(() => {
      // If dirty, we must rerun simulation to get matching data
      if (isDirty()) {
        runSimulation(undefined, undefined, undefined, (newResults) => {
          // Give UI a moment to update state before generating file
          setTimeout(() => {
            generateExcel(newResults)
            setExportState('idle')
          }, 50)
        })
      } else {
        // Results match current params, just export existing data
        generateExcel(results)
        setExportState('idle')
      }
    }, 50)
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window !== 'undefined') {
      setExportState('pdf')

      setTimeout(() => {
        // If dirty, we must rerun simulation to ensure PDF matches input fields
        if (isDirty()) {
          runSimulation(undefined, undefined, undefined, () => {
             // Wait for charts to re-render (snapping to final state)
             setTimeout(() => {
               window.print()
               setExportState('idle')
             }, 50)
          })
        } else {
          // Results match current params, just print
          window.print()
          setExportState('idle')
        }
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
        onRun={() => runSimulation()}
        presetProfiles={PRESET_PROFILES}
      />

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