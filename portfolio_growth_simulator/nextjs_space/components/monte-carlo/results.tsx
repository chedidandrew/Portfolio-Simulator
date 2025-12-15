'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Dices, Share, FileText, FileSpreadsheet, 
  AlertCircle, Target, Lightbulb, Loader2 
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

  const renderFormattedResult = (val: number | undefined) => {
    if (val === undefined) return '$0'

    const shouldUseCompact = val >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(val, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(val)

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

  return (
    <>
      <Card className="border-primary/20 print-section">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 shrink-0">
              <Dices className="h-5 w-5 text-violet-500" />
              Simulation Results
            </CardTitle>

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

          <div className="space-y-2">
            <Label>Outcome Distribution</Label>
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
                  {results.goalProbability?.toFixed(1) ?? '0'}% chance of reaching ${(results.portfolioGoalSnapshot ?? params.portfolioGoal).toLocaleString()}
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
        />

        <MonteCarloHistogram 
          data={results.endingValues ?? []} 
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
          data={results.investmentData ?? []} 
          isDark={isDark} 
          enableAnimation={!isExporting}
        />

        <AnnualReturnsChart 
          data={results.annualReturnsData ?? []} 
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