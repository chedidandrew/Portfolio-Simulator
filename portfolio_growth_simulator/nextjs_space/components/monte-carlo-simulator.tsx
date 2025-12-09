'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dices, TrendingUp, AlertCircle, Target, Zap, Share2, FileText, FileSpreadsheet, Lightbulb } from 'lucide-react'
import { MonteCarloChart } from '@/components/monte-carlo-chart'
import { MonteCarloHistogram } from '@/components/monte-carlo-histogram'
import { motion } from 'framer-motion'
import seedrandom from 'seedrandom'
import { MonteCarloMaxDrawdownHistogram } from '@/components/monte-carlo-max-drawdown'
import { AnnualReturnsChart, ReturnProbabilitiesChart, LossProbabilitiesChart } from '@/components/monte-carlo-analytics'
import { useTheme } from 'next-themes'
import * as XLSX from 'xlsx'
import { useLocalStorage } from '@/hooks/use-local-storage'

interface MonteCarloSimulatorProps {
  mode: 'growth' | 'withdrawal'
  initialValues: any
}

interface SimulationParams {
  initialValue: number
  expectedReturn: number
  volatility: number
  duration: number
  cashflowAmount: number
  cashflowFrequency: 'yearly' | 'monthly'
  numPaths: number
  portfolioGoal?: number
}

interface LogScaleSettings {
  chart: boolean
  histogram: boolean
  drawdown: boolean
}

const PRESET_PROFILES = {
  conservative: {
    name: 'Conservative',
    expectedReturn: 5,
    volatility: 6,
    description: 'Low risk, stable returns - Bond investor',
  },
  moderate: {
    name: 'Moderate',
    expectedReturn: 7,
    volatility: 10,
    description: 'Balanced risk and return - 60/40 investor',
  },
  aggressive: {
    name: 'Aggressive',
    expectedReturn: 10,
    volatility: 18,
    description: 'High risk, high return potential - S&P 500 index investor',
  },
  custom: {
    name: 'Custom',
    expectedReturn: 7,
    volatility: 10,
    description: 'Define your own parameters',
  },
}

const formatSmartCurrency = (value: number | undefined) => {
  if (value === undefined || value === null) return '$0';
  
  const absoluteValue = Math.abs(value);

  if (absoluteValue < 100_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1, 
  }).format(value);
}

export function MonteCarloSimulator({ mode, initialValues }: MonteCarloSimulatorProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [profile, setProfile] = useLocalStorage<keyof typeof PRESET_PROFILES>('mc-profile-' + mode, 'moderate')
  
  const [params, setParams] = useLocalStorage<SimulationParams>('mc-params-' + mode, {
    initialValue: initialValues?.startingBalance ?? 100000,
    expectedReturn: PRESET_PROFILES.moderate.expectedReturn,
    volatility: PRESET_PROFILES.moderate.volatility,
    duration: initialValues?.duration ?? 30,
    cashflowAmount: mode === 'growth' ? (initialValues?.periodicAddition ?? 500) : (initialValues?.periodicWithdrawal ?? 3000),
    cashflowFrequency: 'monthly',
    numPaths: 500,
    portfolioGoal: mode === 'growth' ? 1000000 : undefined,
  })
  
  const [logScales, setLogScales] = useLocalStorage<LogScaleSettings>('mc-log-scales-' + mode, {
    chart: false,
    histogram: false,
    drawdown: false,
  })

  // Persist the seed so chart remains identical on reload/tab switch
  const [rngSeed, setRngSeed] = useLocalStorage<string | null>('mc-seed-' + mode, null)

  const [simulationResults, setSimulationResults] = useLocalStorage<any>( `mc-results-${mode}`, null)
  const [isSimulating, setIsSimulating] = useState(false)

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''

    const url = new URL(window.location.href)

    const payload = {
      mode,
      params,
      rngSeed,
      logScales,
    }

    const encoded =
      typeof btoa !== 'undefined'
        ? btoa(encodeURIComponent(JSON.stringify(payload)))
        : ''

    if (encoded) {
      url.searchParams.set('mc', encoded)
    }

    return url.toString()
  }

  const handleShareLink = async () => {
    if (!simulationResults) return
    const url = buildShareUrl()
    if (!url) return

    try {
      const shareText = 'Check my results in Portfolio Simulator.'
      const cleanMarkdown = `[Check my results](${url})`

      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: 'Portfolio Simulator',
          text: shareText,
          url, 
        })
        return
      }

      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(cleanMarkdown)
      }
    } catch {
      // ignore
    }
  }

const handleExportExcel = () => {
  if (!simulationResults) return

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
  } = simulationResults

  const summaryRows = [
    { Key: 'Mode', Value: mode },
    { Key: 'Initial Value', Value: params.initialValue },
    { Key: 'Expected Return %', Value: params.expectedReturn },
    { Key: 'Volatility %', Value: params.volatility },
    { Key: 'Duration Years', Value: params.duration },
    { Key: 'Monthly Cashflow', Value: params.cashflowAmount },
    { Key: 'Number Of Scenarios', Value: numPathsUsed },
    { Key: 'Mean Ending Value', Value: mean },
    { Key: 'Median Ending Value', Value: median },
    { Key: 'P5 Ending Value', Value: p5 },
    { Key: 'P10 Ending Value', Value: p10 },
    { Key: 'P25 Ending Value', Value: p25 },
    { Key: 'P75 Ending Value', Value: p75 },
    { Key: 'P90 Ending Value', Value: p90 },
    { Key: 'P95 Ending Value', Value: p95 },
    { Key: 'Best Ending Value', Value: best },
    { Key: 'Worst Ending Value', Value: worst },
    { Key: 'Random Seed', Value: rngSeed ?? '' },
  ]

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    ;(wsSummary as any)['!cols'] = [
      { wch: 26 },
      { wch: 20 },
    ]

    const percentileRows = (chartData ?? []).map((row: any) => ({
      Year: row.year,
      'P10': row.p10,
      'P25': row.p25,
      'Median (P50)': row.p50,
      'P75': row.p75,
      'P90': row.p90,
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
      'CAGR P10 %': row.p10,
      'CAGR P25 %': row.p25,
      'CAGR Median %': row.median,
      'CAGR P75 %': row.p75,
      'CAGR P90 %': row.p90,
      'Prob ≥ 5%': row.prob5,
      'Prob ≥ 10%': row.prob10,
      'Prob ≥ 15%': row.prob15,
      'Prob ≥ 20%': row.prob20,
      'Prob ≥ 25%': row.prob25,
      'Prob ≥ 30%': row.prob30,
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

    const endingRows = (endingValues ?? []).map((v: number, idx: number) => ({
      Scenario: idx + 1,
      'Ending Value': v,
    }))
    const wsEnding = XLSX.utils.json_to_sheet(endingRows)
    ;(wsEnding as any)['!cols'] = [
      { wch: 10 },
      { wch: 18 },
    ]

    const ddRows = (maxDrawdowns ?? []).map((d: number, idx: number) => ({
      Scenario: idx + 1,
      'Max Drawdown %': d * 100,
    }))
    const wsDrawdowns = XLSX.utils.json_to_sheet(ddRows)
    ;(wsDrawdowns as any)['!cols'] = [
      { wch: 10 },
      { wch: 18 },
    ]

    const lossRows = (lossProbData ?? []).map((row: any) => ({
      'Loss Threshold': row.threshold,
      'End of Period Loss %': row.endPeriod,
      'Intra period Loss %': row.intraPeriod,
    }))
    const wsLoss = XLSX.utils.json_to_sheet(lossRows)
    ;(wsLoss as any)['!cols'] = [
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsPercentiles, 'Yearly Percentiles')
    XLSX.utils.book_append_sheet(wb, wsAnnual, 'Annual Returns')
    XLSX.utils.book_append_sheet(wb, wsEnding, 'Ending Values')
    XLSX.utils.book_append_sheet(wb, wsDrawdowns, 'Max Drawdowns')
    XLSX.utils.book_append_sheet(wb, wsLoss, 'Loss Probabilities')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `monte-carlo-simulation-${mode}-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  const handleExportPdf = () => {
    if (typeof window === 'undefined') return
    window.print()
  }

  // FIXED: Added guard clause to prevent infinite loops if setParams is unstable
  useEffect(() => {
    if (profile !== 'custom') {
      const targetReturn = PRESET_PROFILES[profile].expectedReturn
      const targetVol = PRESET_PROFILES[profile].volatility
      
      // Only update if values are different
      if (params.expectedReturn !== targetReturn || params.volatility !== targetVol) {
        setParams(prev => ({
          ...prev,
          expectedReturn: targetReturn,
          volatility: targetVol,
        }))
      }
    }
  }, [profile, setParams, params.expectedReturn, params.volatility])

  const runSimulation = (overrideParams?: SimulationParams, seedOverride?: string, preservedLogScales?: LogScaleSettings) => {
    const simParams = overrideParams ?? params
    const seed = seedOverride ?? rngSeed ?? `monte-carlo-${Date.now()}-${Math.random()}`

    setIsSimulating(true)
    setRngSeed(seed)

    setTimeout(() => {
      const results = performMonteCarloSimulation(simParams, mode, seed)
      
      if (preservedLogScales) {
        // Use preserved log scales when restoring from URL or similar
        setLogScales(preservedLogScales)
      } else {
        // Auto-configure log scales on every new run or rerun
        setLogScales({
          chart: results.recommendLogLinear,
          histogram: results.recommendLogHistogram,
          drawdown: results.recommendLogDrawdown,
        })
      }

      setSimulationResults(results)
      setIsSimulating(false)
    }, 100)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')

      if (!mcParam) return

      const decoded = JSON.parse(decodeURIComponent(atob(mcParam)))

      if (!decoded || !decoded.params) return

      window.dispatchEvent(
        new CustomEvent('openMonteCarloFromLink', {
          detail: { mode: decoded.mode },
        })
      )

      setProfile('custom')

      const mergedParams: SimulationParams = {
        ...params,
        ...decoded.params,
      }
      setParams(mergedParams)

      const seedFromUrl =
        typeof decoded.rngSeed === 'string' ? decoded.rngSeed : undefined
      if (seedFromUrl) {
        setRngSeed(seedFromUrl)
      }

      const savedLogScales = decoded.logScales as LogScaleSettings | undefined

      runSimulation(mergedParams, seedFromUrl, savedLogScales)

      window.history.replaceState(null, '', window.location.pathname)
    } catch (err) {
      console.error('Failed to restore Monte Carlo state from URL', err)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5 text-primary" />
            Monte Carlo Simulation
          </CardTitle>
          <CardDescription>
            Run thousands of scenarios to test portfolio outcomes under market volatility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="print:hidden">Select Profile</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:hidden">
              {Object.entries(PRESET_PROFILES).map(([key, preset]) => (
                <Button
                  key={key}
                  variant={profile === key ? 'default' : 'outline'}
                  onClick={() => setProfile(key as keyof typeof PRESET_PROFILES)}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="font-semibold text-right break-all text-xs sm:text-sm leading-tight">{preset.name}</span>
                  {key !== 'custom' && (
                    <span className="text-xs opacity-80">
                      {preset.expectedReturn}% / {preset.volatility}% vol
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Print-only view of selected profile */}
            <div className="hidden print:block text-sm">
              <span className="font-semibold">Selected Profile:</span> {PRESET_PROFILES[profile].name} ({PRESET_PROFILES[profile].expectedReturn}% Return, {PRESET_PROFILES[profile].volatility}% Volatility)
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 print:hidden">
              {PRESET_PROFILES[profile].description}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mc-initial">Initial Portfolio Value ($)</Label>
              <NumericInput
                id="mc-initial"
                value={params?.initialValue ?? 0}
                onChange={(value) => setParams({ ...params, initialValue: value })}
                min={0}
                max={10000000000}
                maxErrorMessage="Now you are just being too greedy :)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-return">Expected Annual Return (%)</Label>
              <NumericInput
                id="mc-return"
                step={0.1}
                value={params?.expectedReturn ?? 0}
                onChange={(value) => setParams({ ...params, expectedReturn: value })}
                disabled={profile !== 'custom'}
                min={-100}
                max={60}
                maxErrorMessage="Now you are just being too greedy :)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-volatility">Volatility / Std Dev (%)</Label>
              <NumericInput
                id="mc-volatility"
                step={0.1}
                value={params?.volatility ?? 0}
                onChange={(value) => setParams({ ...params, volatility: value })}
                disabled={profile !== 'custom'}
                min={0}
                max={100}
                maxErrorMessage="That's some serious volatility! :)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-duration">Duration (Years)</Label>
              <NumericInput
                id="mc-duration"
                value={params?.duration ?? 0}
                onChange={(value) => setParams({ ...params, duration: value })}
                min={1}
                max={100}
                maxErrorMessage="Planning for the next century? :)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-cashflow">
                {mode === 'growth' ? 'Monthly Contribution' : 'Monthly Withdrawal'} ($)
              </Label>
              <NumericInput
                id="mc-cashflow"
                value={params?.cashflowAmount ?? 0}
                onChange={(value) => setParams({ ...params, cashflowAmount: value })}
                min={0}
                max={10000000}
                maxErrorMessage="Now you are just being too greedy :)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-paths">Number of Scenarios</Label>
              <Select
                value={params?.numPaths?.toString?.() ?? '500'}
                onValueChange={(value) => setParams({ ...params, numPaths: Number(value) })}
              >
                {/* CHANGE: Added 'print:hidden' to SelectTrigger. 
                  This hides the interactive dropdown button in print view, 
                  leaving only the plain text 'Selected: 500' below it. 
                */}
                <SelectTrigger id="mc-paths" className="print:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 scenario - sample path</SelectItem>
                  <SelectItem value="100">100 scenarios</SelectItem>
                  <SelectItem value="500">500 scenarios</SelectItem>
                  <SelectItem value="1000">1,000 scenarios</SelectItem>
                  <SelectItem value="5000">5,000 scenarios</SelectItem>
                  <SelectItem value="10000">10,000 scenarios</SelectItem>
                  <SelectItem value="50000">50,000 scenarios</SelectItem>
                  <SelectItem value="100000">100,000 scenarios</SelectItem>
                </SelectContent>
              </Select>

              {/* Explicit value for print */}
              <p className="hidden print:block text-xs text-muted-foreground">
                Selected: {(params?.numPaths ?? 500).toLocaleString()}
              </p>
            </div>
            {mode === 'growth' && (
              <div className="space-y-2">
                <Label htmlFor="mc-goal">Portfolio Goal (Optional)</Label>
                <NumericInput
                  id="mc-goal"
                  placeholder="e.g., 1000000"
                  value={params?.portfolioGoal ?? ''}
                  onChange={(value) => setParams({ ...params, portfolioGoal: value || undefined })}
                  min={0}
                  max={100000000000}
                  maxErrorMessage="Now you are just being too greedy :)"
                />
              </div>
            )}
          </div>
          <Button
            onClick={() => runSimulation(undefined, `monte-carlo-${Date.now()}-${Math.random()}`)}
            disabled={isSimulating}
            className="w-full sm:w-auto print:hidden" // HIDDEN IN PRINT
          >
            <Zap className="h-4 w-4 mr-2" />
            {isSimulating ? 'Simulating...' : 'Run New Simulation'}
          </Button>
        </CardContent>
      </Card>

      {simulationResults && (
        <>
        <Card className="border-primary/20 print-section">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 shrink-0">
                <TrendingUp className="h-5 w-5 text-primary" />
                Simulation Results
              </CardTitle>

              {simulationResults && (
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
                  <motion.button
                    type="button"
                    onClick={handleShareLink}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-full border border-[#3B82F6]/50 
                    bg-[#3B82F6]/10 px-2.5 py-1.5 font-medium text-[#3B82F6]
                    shadow-sm shadow-[#3B82F6]/20
                    transition-colors duration-150
                    hover:bg-[#3B82F6]/15 hover:border-[#3B82F6]"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share Results</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleExportPdf}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-full border border-red-400/50 
                              bg-red-500/10 px-2.5 py-1.5 font-medium text-red-300
                              shadow-sm shadow-red-500/20
                              transition-colors duration-150
                              hover:bg-red-500/15 hover:border-red-400"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleExportExcel}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 
                              bg-emerald-500/10 px-2.5 py-1.5 font-medium text-emerald-300
                              shadow-sm shadow-emerald-500/20
                              transition-colors duration-150
                              hover:bg-emerald-500/15 hover:border-emerald-400"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Excel</span>
                  </motion.button>
                </div>
              )}
            </div>
          </CardHeader>

          {simulationResults && (
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="min-w-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">Median Outcome</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary break-words leading-tight">
                    {formatSmartCurrency(simulationResults?.median)}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05 }}
                  className="min-w-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">Mean Outcome</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-500 break-words leading-tight">
                    {formatSmartCurrency(simulationResults?.mean)}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="min-w-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">Best Case (95%)</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-500 break-words leading-tight">
                    {formatSmartCurrency(simulationResults?.p95)}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="min-w-0 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">Worst Case (5%)</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-500 break-words leading-tight">
                    {formatSmartCurrency(simulationResults?.p5)}
                  </p>
                </motion.div>
              </div>

              <div className="space-y-2">
                <Label>Outcome Distribution</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">10th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {formatSmartCurrency(simulationResults?.p10)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">25th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {formatSmartCurrency(simulationResults?.p25)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">75th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {formatSmartCurrency(simulationResults?.p75)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">90th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {formatSmartCurrency(simulationResults?.p90)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">Best outcome</span>
                    <span className="font-bold text-lg leading-tight truncate text-emerald-500">
                      {formatSmartCurrency(simulationResults?.best)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">Worst outcome</span>
                    <span className="font-bold text-lg leading-tight truncate text-orange-500">
                      {formatSmartCurrency(simulationResults?.worst)}
                    </span>
                  </div>
                </div>
              </div>

              {params?.portfolioGoal && mode === 'growth' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg"
                >
                  <Target className="h-6 w-6 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {simulationResults?.goalProbability?.toFixed?.(1) ?? '0'}% chance of reaching ${params.portfolioGoal.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      In {simulationResults?.pathsReachingGoal ?? 0} out of{' '}
                      {simulationResults?.numPathsUsed ?? params.numPaths} scenarios, you reached your goal
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Key Insights
                  </Label>
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p>
                        <span className="font-semibold">In 10% of scenarios</span>, your portfolio finished below{' '}
                        <span className="text-orange-500 font-bold">
                          {formatSmartCurrency(simulationResults?.p10)}
                        </span>
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p>
                        <span className="font-semibold">In 50% of scenarios</span>, your portfolio finished above{' '}
                        <span className="text-primary font-bold">
                          {formatSmartCurrency(simulationResults?.median)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Did you know?
                  </Label>
                  <div className="space-y-2 text-sm">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">The Multiplier Effect:</span> In the best case scenario, your money grew by a factor of{' '}
                        <span className="font-bold">
                          {((simulationResults?.best ?? 0) / (params.initialValue || 1)).toFixed(1)}x
                        </span>.
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Survival Rate:</span> You have a{' '}
                        <span className="font-bold">
                          {simulationResults?.survivalRate?.toFixed?.(1)}%
                        </span> chance of ending with more money than you started with.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
        
        <div className="grid grid-cols-1 gap-6">
            <MonteCarloChart 
              data={simulationResults?.chartData ?? []} 
              mode={mode} 
              logScale={logScales.chart}
              onLogScaleChange={(val) => setLogScales(prev => ({ ...prev, chart: val }))}
            />

          <MonteCarloHistogram 
            data={simulationResults?.endingValues ?? []} 
            logScale={logScales.histogram}
            onLogScaleChange={(val) => setLogScales(prev => ({ ...prev, histogram: val }))}
          />

          <MonteCarloMaxDrawdownHistogram 
            data={simulationResults?.maxDrawdowns ?? []} 
            logScale={logScales.drawdown}
            onLogScaleChange={(val) => setLogScales(prev => ({ ...prev, drawdown: val }))}
          />

          <AnnualReturnsChart 
            data={simulationResults?.annualReturnsData ?? []} 
            isDark={isDark} 
          />

          <ReturnProbabilitiesChart 
            data={simulationResults?.annualReturnsData ?? []} 
            isDark={isDark} 
          />

            <LossProbabilitiesChart 
              data={simulationResults?.lossProbData ?? []} 
              isDark={isDark} 
            />
        </div>
        </>
      )}
    </div>
  )
}

function calculatePercentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0
  if (sortedArray.length === 1) return sortedArray[0]
  
  const index = p * (sortedArray.length - 1)
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)
  
  if (lowerIndex === upperIndex) {
    return sortedArray[lowerIndex]
  }
  
  const lowerValue = sortedArray[lowerIndex]
  const upperValue = sortedArray[upperIndex]
  const fraction = index - lowerIndex
  
  return lowerValue + (upperValue - lowerValue) * fraction
}

function performMonteCarloSimulation(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed?: string
) {
  const {
    initialValue,
    expectedReturn,
    volatility,
    duration,
    cashflowAmount,
    cashflowFrequency,
    numPaths,
    portfolioGoal,
  } = params

  const timeStepsPerYear = 12
  const dt = 1 / timeStepsPerYear
  const totalTimeSteps = duration * timeStepsPerYear

  const r = expectedReturn / 100
  const sigma = volatility / 100
  const mu = Math.log(1 + r)
  const drift = (mu - 0.5 * sigma * sigma) * dt
  const diffusion = sigma * Math.sqrt(dt)
  const cashflowPerStep = cashflowFrequency === 'monthly' ? cashflowAmount : cashflowAmount / 12
  const rng = seedrandom(seed ?? `monte-carlo-${Date.now()}-${Math.random()}`)

  // Helper for normal random
  function normalRandom(): number {
    let u = 0, v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  const paths: number[][] = []
  const endingValues: number[] = []
  const maxDrawdowns: number[] = []
  const annualCAGRs: number[][] = [] // [YearIndex][ScenarioIndex] -> CAGR
  const lowestValues: number[] = [] // Lowest value ever reached for each scenario
  
  let pathsReachingGoal = 0
  let pathsProfitable = 0

  for (let y = 0; y <= duration; y++) {
    annualCAGRs[y] = []
  }

  for (let path = 0; path < numPaths; path++) {
    const yearlyValues: number[] = [initialValue]
    let currentValue = initialValue
    let lowestValue = initialValue

    for (let step = 1; step <= totalTimeSteps; step++) {
      currentValue = currentValue * Math.exp(drift + diffusion * normalRandom())

      if (mode === 'growth') {
        currentValue += cashflowPerStep
      } else {
        currentValue -= cashflowPerStep
        currentValue = Math.max(0, currentValue)
      }

      if (currentValue < lowestValue) lowestValue = currentValue

      if (step % timeStepsPerYear === 0) {
        const yearIndex = step / timeStepsPerYear
        yearlyValues.push(currentValue)
        
        if (yearIndex > 0) {
          const cagr = Math.pow(currentValue / initialValue, 1 / yearIndex) - 1
          annualCAGRs[yearIndex].push(cagr * 100)
        }
      }
    }
    
    paths.push(yearlyValues)
    endingValues.push(currentValue)
    lowestValues.push(lowestValue)

    if (portfolioGoal && currentValue >= portfolioGoal) pathsReachingGoal++
    if (currentValue > initialValue) pathsProfitable++

    let peak = yearlyValues[0]
    let maxDrawdown = 0
    for (const value of yearlyValues) {
      if (value > peak) peak = value
      if (peak > 0) {
        const drawdown = (peak - value) / peak
        if (drawdown > maxDrawdown) maxDrawdown = drawdown
      }
    }
    maxDrawdowns.push(maxDrawdown)
  }

  endingValues.sort((a, b) => a - b)

  const annualReturnsData = []
  for (let year = 1; year <= duration; year++) {
    const cagrs = annualCAGRs[year]
    cagrs.sort((a, b) => a - b)

    const count5  = cagrs.filter(v => v >= 5).length
    const count8  = cagrs.filter(v => v >= 8).length
    const count10 = cagrs.filter(v => v >= 10).length
    const count12 = cagrs.filter(v => v >= 12).length
    const count15 = cagrs.filter(v => v >= 15).length
    const count20 = cagrs.filter(v => v >= 20).length


    annualReturnsData.push({
      year,
      p10: calculatePercentile(cagrs, 0.1),
      p25: calculatePercentile(cagrs, 0.25),
      median: calculatePercentile(cagrs, 0.5),
      p75: calculatePercentile(cagrs, 0.75),
      p90: calculatePercentile(cagrs, 0.9),

      prob5:  (count5  / numPaths) * 100,
      prob8:  (count8  / numPaths) * 100,
      prob10: (count10 / numPaths) * 100,
      prob12: (count12 / numPaths) * 100,
      prob15: (count15 / numPaths) * 100,
      prob20: (count20 / numPaths) * 100,
    })
  }

  const lossThresholds = [0, 2.5, 5, 10, 15, 20, 30, 50]
  const lossProbData = lossThresholds.map(threshold => {
    const countEnd = endingValues.filter(val => {
      if (val >= initialValue) return false
      const lossPct = (initialValue - val) / initialValue * 100
      return lossPct >= threshold
    }).length

    const countIntra = lowestValues.filter(val => {
      const lossPct = (initialValue - val) / initialValue * 100
      return lossPct >= threshold
    }).length

    return {
      threshold: `>= ${threshold}%`,
      endPeriod: (countEnd / numPaths) * 100,
      intraPeriod: (countIntra / numPaths) * 100
    }
  })

  const mean = endingValues.reduce((sum, val) => sum + val, 0) / numPaths
  const median = calculatePercentile(endingValues, 0.5)
  const p5 = calculatePercentile(endingValues, 0.05)
  const p10 = calculatePercentile(endingValues, 0.1)
  const p25 = calculatePercentile(endingValues, 0.25)
  const p75 = calculatePercentile(endingValues, 0.75)
  const p90 = calculatePercentile(endingValues, 0.9)
  const p95 = calculatePercentile(endingValues, 0.95)
  const best = endingValues[numPaths - 1]
  const worst = endingValues[0]

  const chartData = []
  for (let year = 0; year <= duration; year++) {
    const yearValues = paths.map(pathVals => pathVals[year] ?? 0)
    yearValues.sort((a, b) => a - b)
    chartData.push({
      year,
      p10: calculatePercentile(yearValues, 0.1),
      p25: calculatePercentile(yearValues, 0.25),
      p50: calculatePercentile(yearValues, 0.5),
      p75: calculatePercentile(yearValues, 0.75),
      p90: calculatePercentile(yearValues, 0.9),
    })
  }

  const spreadRatio = (p95 > 0 && p5 > 0) ? p95 / p5 : 0
  const totalRatio = (best > 0 && worst > 0) ? best / worst : 0
  const recommendLogHistogram = spreadRatio > 15 || totalRatio > 50

  const growthRatio = (p90 > 0 && initialValue > 0) ? p90 / initialValue : 0
  const recommendLogLinear = growthRatio > 20

  const medianDrawdown = calculatePercentile(maxDrawdowns.sort((a,b)=>a-b), 0.5)
  const worstDrawdown = Math.max(...maxDrawdowns)
  const recommendLogDrawdown = (medianDrawdown < 0.10 && worstDrawdown > 0.60)
  const goalProbability = portfolioGoal ? (pathsReachingGoal / numPaths) * 100 : 0
  const survivalRate = (pathsProfitable / numPaths) * 100

  return {
    //paths, //This array is massive and not needed for display.
    endingValues,
    maxDrawdowns,
    annualReturnsData,
    lossProbData,
    chartData,
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
    goalProbability,
    pathsReachingGoal,
    survivalRate,
    numPathsUsed: numPaths,
    recommendLogLinear,
    recommendLogHistogram,
    recommendLogDrawdown,
  }
}