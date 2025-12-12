'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dices, DollarSign, AlertCircle, Target, Zap, Share, FileText, FileSpreadsheet, Lightbulb } from 'lucide-react'
import { MonteCarloChart } from '@/components/monte-carlo-chart'
import { MonteCarloHistogram } from '@/components/monte-carlo-histogram'
import { motion } from 'framer-motion'
import seedrandom from 'seedrandom'
import { MonteCarloMaxDrawdownHistogram } from '@/components/monte-carlo-max-drawdown'
import { 
  AnnualReturnsChart, 
  ReturnProbabilitiesChart, 
  LossProbabilitiesChart,
  InvestmentBreakdownChart 
} from '@/components/monte-carlo-analytics'
import { useTheme } from 'next-themes'
import * as XLSX from 'xlsx'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { triggerHaptic } from '@/hooks/use-haptics'
import { roundToCents, formatCurrency, getLargeNumberName } from '@/lib/utils'
import { SimulationParams } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface MonteCarloSimulatorProps {
  mode: 'growth' | 'withdrawal'
  initialValues: any
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
    inflationAdjustment: initialValues?.inflationAdjustment ?? 0,
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
  
  // Use local storage for full precision preference per mode
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('mc-show-full-precision-' + mode, false)

  // Helper for formatting result cards: full precision if toggled and value is not astronomically large.
  // Returns JSX when compact so we can show a hover tooltip.
  const renderFormattedResult = (val: number | undefined) => {
    if (val === undefined) return '$0'

    const shouldUseCompact = val >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(val, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(val)

    if (shouldUseCompact && fullName) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help decoration-dotted decoration-foreground/30 underline-offset-4 hover:underline">
                {formatted}
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-card text-foreground border-border rounded-lg shadow-lg p-3 text-xs">
              <p>{fullName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return formatted
  }

  // Calculate total invested capital for the multiplier effect
  const totalInvested = useMemo(() => {
    const initial = params.initialValue || 0;
    
    if (mode === 'withdrawal') {
        // In withdrawal mode, "Total Invested" is just the starting balance
        return initial;
    }

    // In growth mode, calculate contributions with inflation, handling fractional years
    const durationYears = params.duration;
    const inflationRate = (params.inflationAdjustment ?? 0) / 100;
    let currentMonthlyContribution = params.cashflowAmount;
    let totalContributions = 0;

    const fullYears = Math.floor(durationYears);
    const remainingFraction = durationYears - fullYears;

    for (let i = 0; i < fullYears; i++) {
        totalContributions += currentMonthlyContribution * 12;
        // Contributions increase by inflation rate at the end of each year
        currentMonthlyContribution *= (1 + inflationRate);
    }

    // Add contributions for the fractional remaining year
    if (remainingFraction > 0) {
      totalContributions += currentMonthlyContribution * 12 * remainingFraction;
    }
    
    return initial + totalContributions;
  }, [params.initialValue, params.cashflowAmount, params.duration, params.inflationAdjustment, mode]);

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''

    const url = new URL(window.location.href)

    const payload = {
      mode,
      params,
      rngSeed,
      logScales,
      showFullPrecision, // Include in share link
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
    triggerHaptic('light')
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

  // Refactored logic to generate excel from a results object directly
  const generateExcel = (results: any) => {
    if (!results) return

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
    } = results

    // Logic for the invested label: 'Total Invested' for growth, 'Starting Balance' for withdrawal
    const investedLabel = mode === 'withdrawal' ? 'Starting Balance' : 'Total Invested';

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
    ;(wsSummary as any)['!cols'] = [
      { wch: 26 },
      { wch: 20 },
    ]

    const percentileRows = (chartData ?? []).map((row: any) => ({
      Year: row.year,
      'P10': roundToCents(row.p10),
      'P25': roundToCents(row.p25),
      'Median (P50)': roundToCents(row.p50),
      'P75': roundToCents(row.p75),
      'P90': roundToCents(row.p90),
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
    ;(wsEnding as any)['!cols'] = [
      { wch: 10 },
      { wch: 18 },
    ]

    const ddRows = (maxDrawdowns ?? []).map((d: number, idx: number) => ({
      Scenario: idx + 1,
      'Max Drawdown %': roundToCents(d * 100),
    }))
    const wsDrawdowns = XLSX.utils.json_to_sheet(ddRows)
    ;(wsDrawdowns as any)['!cols'] = [
      { wch: 10 },
      { wch: 18 },
    ]

    const lossRows = (lossProbData ?? []).map((row: any) => ({
      'Loss Threshold': row.threshold,
      'End of Period Loss %': roundToCents(row.endPeriod),
      'Intra period Loss %': roundToCents(row.intraPeriod),
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
    XLSX.utils.book_append_sheet(wb, wsInvestment, 'Investment Breakdown')
    XLSX.utils.book_append_sheet(wb, wsEnding, 'Ending Values')
    XLSX.utils.book_append_sheet(wb, wsDrawdowns, 'Max Drawdowns')
    XLSX.utils.book_append_sheet(wb, wsLoss, 'Loss Probabilities')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `monte-carlo-simulation-${mode}-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  const handleExportExcel = () => {
    triggerHaptic('light')
    // Run simulation first to ensure data matches current inputs
    runSimulation(undefined, undefined, undefined, (results) => {
       generateExcel(results)
    })
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window === 'undefined') return
    // Run simulation first to ensure data matches current inputs
    runSimulation(undefined, undefined, undefined, () => {
        // Wait briefly for DOM to update with new results before printing
        setTimeout(() => window.print(), 100)
    })
  }

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

  const runSimulation = (
    overrideParams?: SimulationParams, 
    seedOverride?: string, 
    preservedLogScales?: LogScaleSettings,
    onComplete?: (results: any) => void
  ) => {
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
      
      if (onComplete) {
        onComplete(results)
      }
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
      
      // Restore full precision setting
      if (typeof decoded.showFullPrecision === 'boolean') {
        setShowFullPrecision(decoded.showFullPrecision)
      }

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
              <span className="font-semibold">Selected Profile:</span> {PRESET_PROFILES[profile].name}
              {profile !== 'custom' && ` (${PRESET_PROFILES[profile].expectedReturn}% Return, ${PRESET_PROFILES[profile].volatility}% Volatility)`}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 print:hidden">
              {PRESET_PROFILES[profile].description}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 shrink-0 -ml-1">
              <DollarSign className="h-5 w-5 text-violet-500" />
              <CardTitle>Simulation Parameters</CardTitle>
            </div>
            {/* right side content if any */}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mc-initial">Initial Portfolio Value ($)</Label>
              <NumericInput
                id="mc-initial"
                value={params?.initialValue ?? 0}
                onChange={(value) => setParams({ ...params, initialValue: value })}
                min={1}
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
              <Label htmlFor="mc-inflation">
                Inflation Adjustment (%)
              </Label>
              <NumericInput
                id="mc-inflation"
                step={0.1}
                value={params?.inflationAdjustment ?? 0}
                onChange={(value) =>
                  setParams({ ...params, inflationAdjustment: value })
                }
                min={-50}
                max={50}
                maxErrorMessage="Hyperinflation much? :)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-paths">Number of Scenarios</Label>
              <Select
                value={params?.numPaths?.toString?.() ?? '500'}
                onValueChange={(value) => setParams({ ...params, numPaths: Number(value) })}
              >
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
                  <SelectItem value="100000">100,000 scenarios (Slow)</SelectItem>
                </SelectContent>
              </Select>
              
              {params?.numPaths === 100000 && (
                <p className="text-[10px] text-orange-500 font-medium animate-pulse pt-1 print:hidden">
                  Warning: 100,000 paths might freeze the browser UI for a few seconds on slower devices.
                </p>
              )}

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
            className="w-full sm:w-auto print:hidden" 
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
                <Dices className="h-5 w-5 text-violet-500" />
                Simulation Results
              </CardTitle>

              {simulationResults && (
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
                  <div className="flex items-center gap-2 mr-2 border-r border-border pr-3">
                    <Switch
                      id="precision-toggle-mc"
                      checked={showFullPrecision}
                      onCheckedChange={setShowFullPrecision}
                    />
                    <Label htmlFor="precision-toggle-mc" className="font-normal cursor-pointer">
                      Expand
                    </Label>
                  </div>

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
                    <Share className="h-3.5 w-3.5" />
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
                    {renderFormattedResult(simulationResults?.median)}
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
                    {renderFormattedResult(simulationResults?.mean)}
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
                    {renderFormattedResult(simulationResults?.p95)}
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
                    {renderFormattedResult(simulationResults?.p5)}
                  </p>
                </motion.div>
              </div>

              <div className="space-y-2">
                <Label>Outcome Distribution</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">10th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {renderFormattedResult(simulationResults?.p10)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">25th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {renderFormattedResult(simulationResults?.p25)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">75th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {renderFormattedResult(simulationResults?.p75)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">90th percentile</span>
                    <span className="font-bold text-lg leading-tight truncate">
                      {renderFormattedResult(simulationResults?.p90)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">Best outcome</span>
                    <span className="font-bold text-lg leading-tight truncate text-emerald-500">
                      {renderFormattedResult(simulationResults?.best)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
                    <span className="text-muted-foreground text-xs">Worst outcome</span>
                    <span className="font-bold text-lg leading-tight truncate text-orange-500">
                      {renderFormattedResult(simulationResults?.worst)}
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
                      {simulationResults?.goalProbability?.toFixed?.(1) ?? '0'}% chance of reaching ${(simulationResults?.portfolioGoalSnapshot ?? params.portfolioGoal).toLocaleString()}
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
                    {/* Insight 1: Total Invested */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p>
                        <span className="font-semibold">Total Invested:</span> Over {params.duration} years, you invested a total of{' '}
                        <span className="text-indigo-500 font-bold">
                          {renderFormattedResult(totalInvested)}
                        </span>
                      </p>
                    </div>

                    {/* Insight 2: Typical Outcome with Colored Values */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p>
                        <span className="font-semibold">Typical Outcome:</span> There is a 50% chance your balance ends between{' '}
                        <span className="text-orange-500 font-bold">
                          {renderFormattedResult(simulationResults?.p25)}
                        </span>
                        {' '}and{' '}
                        <span className="text-emerald-500 font-bold">
                          {renderFormattedResult(simulationResults?.p75)}
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
                        <span className="font-semibold text-blue-600 dark:text-blue-400">The Multiplier Effect:</span> In the best outcome scenario, your money grew by a factor of{' '}
                        <span className="font-bold">
                          {((simulationResults?.best ?? 0) / (totalInvested || 1)).toFixed(1)}x
                        </span>.
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <p>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {mode === 'withdrawal' ? 'Success Rate:' : 'Profit Probability:'}
                        </span>{' '}
                        You have a{' '}
                        <span className="font-bold">
                          {mode === 'withdrawal' 
                            ? simulationResults?.solventRate?.toFixed?.(1) 
                            : simulationResults?.profitableRate?.toFixed?.(1)
                          }%
                        </span>{' '}
                        chance of {mode === 'withdrawal' ? 'not running out of money' : 'making a profit on your total investment'}.
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

          <InvestmentBreakdownChart 
            data={simulationResults?.investmentData ?? []} 
            isDark={isDark} 
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
  if (params.initialValue <= 0) {
    throw new Error('Initial portfolio value must be greater than zero.')
  }
  const {
    initialValue,
    expectedReturn,
    volatility,
    duration,
    cashflowAmount,
    cashflowFrequency,
    inflationAdjustment = 0,
    numPaths,
    portfolioGoal,
  } = params

  const timeStepsPerYear = 12
  const dt = 1 / timeStepsPerYear
  const totalTimeSteps = duration * timeStepsPerYear

  const r = expectedReturn / 100
  const sigma = volatility / 100
  const mu = Math.log(1 + r)
  const drift = mu * dt
  const diffusion = sigma * Math.sqrt(dt)
  const cashflowPerStep = cashflowFrequency === 'monthly' ? cashflowAmount : cashflowAmount / 12
  const inflationFactor = 1 + inflationAdjustment / 100
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
  let pathsProfitable = 0 // > initialValue
  let pathsSolvent = 0    // > 0

  for (let y = 0; y <= duration; y++) {
    annualCAGRs[y] = []
  }

  for (let path = 0; path < numPaths; path++) {
    const yearlyValues: number[] = [initialValue]
    let currentValue = initialValue
    let pureValue = initialValue // New: Track pure asset performance
    let lowestValue = initialValue
    let currentCashflowPerStep = cashflowPerStep
    
    // NEW: Track the total principal invested for this path
    let totalInvestedSoFar = initialValue

    for (let step = 1; step <= totalTimeSteps; step++) {
      // Calculate growth factor once for this step
      const growthFactor = Math.exp(drift + diffusion * normalRandom())

      // Apply growth to both tracked values
      currentValue = currentValue * growthFactor
      pureValue = pureValue * growthFactor // Pure value only grows by market return

      if (mode === 'growth') {
        currentValue += currentCashflowPerStep
        // NEW: Add contribution to total invested
        totalInvestedSoFar += currentCashflowPerStep
      } else {
        currentValue -= currentCashflowPerStep
        currentValue = Math.max(0, currentValue)
      }

      if (currentValue < lowestValue) lowestValue = currentValue

      if (step % timeStepsPerYear === 0) {
        const yearIndex = step / timeStepsPerYear
        yearlyValues.push(currentValue)
        
        // Increase cashflow by inflation annually
        currentCashflowPerStep *= inflationFactor
        
        if (yearIndex > 0) {
          // Calculate CAGR using pureValue (pure asset performance) instead of account balance
          const cagr = Math.pow(pureValue / initialValue, 1 / yearIndex) - 1
          annualCAGRs[yearIndex].push(cagr * 100)
        }
      }
    }
    
    paths.push(yearlyValues)
    endingValues.push(currentValue)
    lowestValues.push(lowestValue)

    if (portfolioGoal && currentValue >= portfolioGoal) pathsReachingGoal++
    if (currentValue > totalInvestedSoFar) pathsProfitable++
    if (currentValue > 0) pathsSolvent++

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

  // Create sorted copies for percentile calculations so we don't mutate original arrays
  const sortedEndingValues = [...endingValues].sort((a, b) => a - b)
  
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
    const count25 = cagrs.filter(v => v >= 25).length
    const count30 = cagrs.filter(v => v >= 30).length


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
      prob25: (count25 / numPaths) * 100,
      prob30: (count30 / numPaths) * 100,
    })
  }

  // --- NEW: GENERATE INVESTMENT DATA ---
  const investmentData = []
  let simInvInitial = initialValue
  let simInvContrib = 0
  let simInvCashflow = cashflowPerStep

  // Push Year 0
  investmentData.push({
    year: 0,
    initial: simInvInitial,
    contributions: 0,
    total: simInvInitial,
  })

  for (let y = 1; y <= duration; y++) {
    // Add 12 months of contributions (only if growth mode)
    const yearContribution = mode === 'growth' ? simInvCashflow * 12 : 0
    
    simInvContrib += yearContribution
    
    investmentData.push({
      year: y,
      initial: simInvInitial,
      contributions: simInvContrib,
      total: simInvInitial + simInvContrib
    })

    // Apply inflation for next year (matches simulation logic)
    simInvCashflow *= inflationFactor
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

  // Use sorted ending values for stats
  const mean = endingValues.reduce((sum, val) => sum + val, 0) / numPaths
  const median = calculatePercentile(sortedEndingValues, 0.5)
  const p5 = calculatePercentile(sortedEndingValues, 0.05)
  const p10 = calculatePercentile(sortedEndingValues, 0.1)
  const p25 = calculatePercentile(sortedEndingValues, 0.25)
  const p75 = calculatePercentile(sortedEndingValues, 0.75)
  const p90 = calculatePercentile(sortedEndingValues, 0.9)
  const p95 = calculatePercentile(sortedEndingValues, 0.95)
  const best = sortedEndingValues[numPaths - 1]
  const worst = sortedEndingValues[0]

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

  // Use sorted copy for median drawdown calculation
  const sortedMaxDrawdowns = [...maxDrawdowns].sort((a, b) => a - b)
  const medianDrawdown = calculatePercentile(sortedMaxDrawdowns, 0.5)
  const worstDrawdown = Math.max(...maxDrawdowns)
  const recommendLogDrawdown = (medianDrawdown < 0.10 && worstDrawdown > 0.60)
  const goalProbability = portfolioGoal ? (pathsReachingGoal / numPaths) * 100 : 0
  const profitableRate = (pathsProfitable / numPaths) * 100
  const solventRate = (pathsSolvent / numPaths) * 100

  return {
    //paths, //This array is massive and not needed for display.
    endingValues, // Return unsorted array for export
    maxDrawdowns, // Return unsorted array for export
    annualReturnsData,
    lossProbData,
    investmentData, // NEW: Return this
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
    profitableRate,
    solventRate,
    numPathsUsed: numPaths,
    recommendLogLinear,
    recommendLogHistogram,
    recommendLogDrawdown,
    portfolioGoalSnapshot: portfolioGoal
  }
}