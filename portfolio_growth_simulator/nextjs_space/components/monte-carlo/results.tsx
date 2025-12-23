'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Dices, Share, FileText, FileSpreadsheet, 
  AlertCircle, Target, Lightbulb, Loader2, Coins 
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { 
  MonteCarloChart 
} from '@/components/monte-carlo-chart'
import { 
  MonteCarloHistogram 
} from '@/components/monte-carlo-histogram'
import { 
  MonteCarloMaxDrawdownHistogram 
} from '@/components/monte-carlo-max-drawdown'
import { 
  AnnualReturnsChart, 
  ReturnProbabilitiesChart, 
  LossProbabilitiesChart, 
  InvestmentBreakdownChart 
} from '@/components/monte-carlo-analytics'
import { SensitivityTable } from '@/components/monte-carlo/sensitivity-table'
import { CashflowChart } from '@/components/monte-carlo/cashflow-chart'
import { TaxImpactChart } from '@/components/monte-carlo/tax-impact-chart'
import { formatCurrency, getLargeNumberName } from '@/lib/utils'
import { SimulationParams } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type ExportState = 'idle' | 'pdf' | 'excel'

interface MonteCarloResultsProps {
  mode: 'growth' | 'withdrawal'
  results: any
  params: SimulationParams
  logScales: { chart: boolean; histogram: boolean; drawdown: boolean }
  setLogScales: (scales: { chart: boolean; histogram: boolean; drawdown: boolean }) => void
  showFullPrecision: boolean
  setShowFullPrecision: (v: boolean) => void
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
  exportState: ExportState
}

export function MonteCarloResults({
  mode,
  results,
  params,
  logScales,
  setLogScales,
  showFullPrecision,
  setShowFullPrecision,
  onShare,
  onExportPdf,
  onExportExcel,
  exportState
}: MonteCarloResultsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isExporting = exportState !== 'idle'

  // --- 1. Real vs Nominal Logic ---
  const [isRealDollars, setIsRealDollars] = useState(false)
  const inflationAdjustment = params.inflationAdjustment ?? 0
  const duration = params.duration

  const deflate = (val: number, years: number) => {
    if (!isRealDollars) return val
    if (inflationAdjustment === 0) return val
    return val / Math.pow(1 + inflationAdjustment / 100, years)
  }

  const getAdjustedScalar = (val: number | undefined) => {
    if (val === undefined) return 0
    return deflate(val, duration)
  }

  const adjustedEndingValues = useMemo(() => {
    if (!results?.endingValues) return []
    if (!isRealDollars) return results.endingValues
    return results.endingValues.map((v: number) => deflate(v, duration))
  }, [results?.endingValues, isRealDollars, duration, inflationAdjustment])

  const adjustedInvestmentData = useMemo(() => {
    if (!results?.investmentData) return []
    if (!isRealDollars) return results.investmentData
    return results.investmentData.map((pt: any) => ({
      ...pt,
      initial: deflate(pt.initial, pt.year),
      contributions: deflate(pt.contributions, pt.year),
      total: deflate(pt.total, pt.year)
    }))
  }, [results?.investmentData, isRealDollars, inflationAdjustment])

  const adjustedAnnualReturnsData = useMemo(() => {
    if (!results?.annualReturnsData) return []
    if (!isRealDollars) return results.annualReturnsData
    
    return results.annualReturnsData.map((pt: any) => {
      const adjustCAGR = (val: number) => {
        const nominal = val / 100
        const inflation = inflationAdjustment / 100
        const real = ((1 + nominal) / (1 + inflation)) - 1
        return real * 100
      }
      return {
        ...pt,
        p10: adjustCAGR(pt.p10),
        p25: adjustCAGR(pt.p25),
        median: adjustCAGR(pt.median),
        p75: adjustCAGR(pt.p75),
        p90: adjustCAGR(pt.p90),
      }
    })
  }, [results?.annualReturnsData, isRealDollars, inflationAdjustment])


  const renderFormattedResult = (val: number | undefined) => {
    const adjusted = getAdjustedScalar(val)
    if (adjusted === undefined) return formatCurrency(0)

    const shouldUseCompact = adjusted >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(adjusted, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(adjusted)

    if (shouldUseCompact && fullName) {
      return <CompactValue formatted={formatted} fullName={fullName} />
    }
    return formatted
  }

  const totalInvested = useMemo(() => {
    const initial = params.initialValue || 0
    if (mode === 'withdrawal') return initial

    const durationYears = params.duration
    const inflationRate = (params.inflationAdjustment ?? 0) / 100
    let currentMonthlyContribution = params.cashflowAmount
    let totalContributions = 0

    const fullYears = Math.floor(durationYears)
    const remainingFraction = durationYears - fullYears

    for (let i = 0; i < fullYears; i++) {
        totalContributions += currentMonthlyContribution * 12
        currentMonthlyContribution *= (1 + inflationRate)
    }

    if (remainingFraction > 0) {
      totalContributions += currentMonthlyContribution * 12 * remainingFraction
    }
    
    return initial + totalContributions
  }, [params, mode])

  if (!results) return null
  
  const taxEnabled = params.taxEnabled
  let taxInfo = ''
  if (taxEnabled) {
    if (mode === 'growth') {
      taxInfo = params.taxType === 'income' 
        ? '(After Annual Tax Drag)' 
        : '(Net of Deferred Tax)'
    }
  }

  return (
    <>
      <Card className="border-primary/20 print-section">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 shrink-0">
              <Dices className="h-5 w-5 text-violet-500" />
              Simulation Results {taxInfo && <span className="text-xs font-normal text-muted-foreground ml-1">{taxInfo}</span>}
            </CardTitle>

            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
              <div className="flex items-center gap-2 mr-2 border-r border-border pr-3">
                 <Switch
                  id="real-nominal-toggle"
                  checked={isRealDollars}
                  onCheckedChange={setIsRealDollars}
                />
                <Label htmlFor="real-nominal-toggle" className="font-normal cursor-pointer">
                  {isRealDollars ? "Real (Today's $)" : "Nominal (Future $)"}
                </Label>
              </div>

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

              <ActionButtons 
                 onShare={onShare} 
                 onExportPdf={onExportPdf} 
                 onExportExcel={onExportExcel}
                 exportState={exportState}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
               label="Median Outcome" 
               value={renderFormattedResult(results.median)} 
               textClass="text-primary"
               bgClass="bg-gradient-to-br from-primary/10 to-primary/5"
            />
            <MetricCard 
               label="Mean Outcome" 
               value={renderFormattedResult(results.mean)} 
               textClass="text-blue-500"
               bgClass="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
               delay={0.05} 
            />
            <MetricCard 
               label="Best Case (95%)" 
               value={renderFormattedResult(results.p95)} 
               textClass="text-emerald-500"
               bgClass="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5"
               delay={0.1} 
            />
            <MetricCard 
               label="Worst Case (5%)" 
               value={renderFormattedResult(results.p5)} 
               textClass="text-orange-500"
               bgClass="bg-gradient-to-br from-orange-500/10 to-orange-500/5"
               delay={0.15} 
            />
          </div>

          {taxEnabled && params.taxType === 'capital_gains' && mode === 'growth' && (
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }}
               className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm"
             >
                <Coins className="h-5 w-5 text-red-500" />
                <div>
                   <span className="font-semibold text-red-600 dark:text-red-400">Estimated Tax Cost: </span>
                   <span className="font-bold">
                      {formatCurrency(getAdjustedScalar(results.taxDragAmount))}
                   </span>
                   <span className="text-muted-foreground ml-1">
                      (Avg diff between pre-tax and post-tax outcome)
                   </span>
                </div>
             </motion.div>
          )}

          <div className="space-y-2">
            <Label>Outcome Distribution {isRealDollars && <span className="text-xs text-muted-foreground font-normal">(Adjusted for Inflation)</span>}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <DistributionItem label="10th percentile" value={renderFormattedResult(results.p10)} />
              <DistributionItem label="25th percentile" value={renderFormattedResult(results.p25)} />
              <DistributionItem label="75th percentile" value={renderFormattedResult(results.p75)} />
              <DistributionItem label="90th percentile" value={renderFormattedResult(results.p90)} />
              <DistributionItem label="Best outcome" value={renderFormattedResult(results.best)} valueClass="text-emerald-500" />
              <DistributionItem label="Worst outcome" value={renderFormattedResult(results.worst)} valueClass="text-orange-500" />
            </div>
          </div>

          {params.portfolioGoal && mode === 'growth' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg"
            >
              <Target className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">
                  {results.goalProbability?.toFixed(1) ?? '0'}% chance of reaching {formatCurrency(getAdjustedScalar(results.portfolioGoalSnapshot ?? params.portfolioGoal))}
                </p>
                <p className="text-xs text-muted-foreground">
                  In {results.pathsReachingGoal ?? 0} out of {results.numPathsUsed ?? params.numPaths} scenarios, you reached your goal
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
                    <span className="font-semibold">Total Invested:</span> Over {params.duration} years, you invested a total of{' '}
                    <span className="text-indigo-500 font-bold">
                      {renderFormattedResult(totalInvested)}
                    </span>
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p>
                    <span className="font-semibold">Typical Outcome:</span> There is a 50% chance your balance ends between{' '}
                    <span className="text-orange-500 font-bold">
                      {renderFormattedResult(results.p25)}
                    </span>
                    {' '}and{' '}
                    <span className="text-emerald-500 font-bold">
                      {renderFormattedResult(results.p75)}
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
                      {((results.best ?? 0) / (totalInvested || 1)).toFixed(1)}x
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
                        ? results.solventRate?.toFixed(1) 
                        : results.profitableRate?.toFixed(1)
                      }%
                    </span>{' '}
                    chance of {mode === 'withdrawal' ? 'not running out of money' : 'making a profit on your total investment'}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 gap-6">
        <MonteCarloChart 
          data={results.chartData ?? []} 
          mode={mode} 
          logScale={logScales.chart}
          onLogScaleChange={(val) => setLogScales({ ...logScales, chart: val })}
          enableAnimation={!isExporting}
          isRealDollars={isRealDollars}
          inflationAdjustment={inflationAdjustment}
          deterministicData={results.deterministicSeries}
        />

        <CashflowChart params={params} mode={mode} />
             
        {taxEnabled && (
           <TaxImpactChart 
              data={results.chartData} 
              investmentData={results.investmentData} 
              params={params} 
              isRealDollars={isRealDollars} 
           />
        )}

        <SensitivityTable params={params} mode={mode} />

        <MonteCarloHistogram 
          data={adjustedEndingValues} 
          logScale={logScales.histogram}
          onLogScaleChange={(val) => setLogScales({ ...logScales, histogram: val })}
          enableAnimation={!isExporting}
        />

        <MonteCarloMaxDrawdownHistogram 
          data={results.maxDrawdowns ?? []} 
          logScale={logScales.drawdown}
          onLogScaleChange={(val) => setLogScales({ ...logScales, drawdown: val })}
          enableAnimation={!isExporting}
        />

        <InvestmentBreakdownChart 
          data={adjustedInvestmentData} 
          isDark={isDark} 
          enableAnimation={!isExporting}
        />

        <AnnualReturnsChart 
          data={adjustedAnnualReturnsData} 
          isDark={isDark} 
          enableAnimation={!isExporting}
        />

        <ReturnProbabilitiesChart 
          data={results.annualReturnsData ?? []} 
          isDark={isDark} 
          enableAnimation={!isExporting}
        />

        <LossProbabilitiesChart 
          data={results.lossProbData ?? []} 
          isDark={isDark} 
          enableAnimation={!isExporting}
        />
      </div>
    </>
  )
}

function MetricCard({ label, value, textClass, bgClass, delay = 0 }: any) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay }}
      className={`min-w-0 rounded-lg p-4 space-y-1 ${bgClass}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg sm:text-xl md:text-2xl font-bold break-words leading-tight ${textClass}`}>
        {value}
      </p>
    </motion.div>
  )
}

function DistributionItem({ label, value, valueClass = '' }: any) {
  return (
    <div className="flex flex-col gap-1 p-3 bg-muted rounded min-w-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-bold text-lg leading-tight truncate ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

function ActionButtons({ onShare, onExportPdf, onExportExcel, exportState }: {
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
  exportState: ExportState
}) {
  const btnClass = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-wait"
  const isAnyExporting = exportState !== 'idle'

  return (
    <>
      <motion.button
        type="button"
        onClick={onShare}
        disabled={isAnyExporting}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${btnClass} border-[#3B82F6]/50 bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/15 hover:border-[#3B82F6]`}
      >
        <Share className="h-3.5 w-3.5" />
        <span>Share</span>
      </motion.button>

      <motion.button
        type="button"
        onClick={onExportPdf}
        disabled={isAnyExporting}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${btnClass} border-red-400/50 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:border-red-400`}
      >
        {exportState === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        <span>{exportState === 'pdf' ? 'Generating...' : 'PDF'}</span>
      </motion.button>

      <motion.button
        type="button"
        onClick={onExportExcel}
        disabled={isAnyExporting}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${btnClass} border-emerald-400/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-400`}
      >
        {exportState === 'excel' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
        <span>{exportState === 'excel' ? 'Generating...' : 'Excel'}</span>
      </motion.button>
    </>
  )
}

function CompactValue({ formatted, fullName }: { formatted: string, fullName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <span 
            className="cursor-help decoration-dotted decoration-foreground/30 underline-offset-4 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(prev => !prev)
            }}
          >
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