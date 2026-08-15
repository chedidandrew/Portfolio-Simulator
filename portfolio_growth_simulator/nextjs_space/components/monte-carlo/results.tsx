'use client'

import { useCallback, useMemo, useState } from 'react'
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
import { formatCurrency, getLargeNumberName, getAppCurrency } from '@/lib/utils'
import { SimulationParams } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CompletedSimulationResults } from '@/hooks/use-monte-carlo'
import { GoalTerminalOutcomeSummary, MonteCarloInvestmentInsight, MonteCarloSuccessInsight } from './mode-insights'

export type ExportState = 'idle' | 'pdf' | 'excel'

interface MonteCarloResultsProps {
  mode: 'growth' | 'withdrawal'
  results: CompletedSimulationResults
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

  const showGrossSummary = !!params.taxEnabled && mode === 'growth' && (params.taxType === 'capital_gains' || params.taxType === 'tax_deferred')


  // --- 1. Real vs Nominal Logic ---
  const [isRealDollars, setIsRealDollars] = useState(false)
  const inflationAdjustment = params.inflationAdjustment ?? 0
  const duration = params.duration

  const deflate = useCallback((val: number, years: number) => {
    if (!isRealDollars) return val
    if (inflationAdjustment === 0) return val
    return val / Math.pow(1 + inflationAdjustment / 100, years)
  }, [inflationAdjustment, isRealDollars])

  const getAdjustedScalar = (val: number | undefined) => {
    if (val === undefined) return 0
    return deflate(val, duration)
  }

  const adjustedEndingValues = useMemo(() => {
    if (!results?.endingValues) return []
    if (!isRealDollars) return results.endingValues
    return results.endingValues.map((v: number) => deflate(v, duration))
  }, [results?.endingValues, isRealDollars, duration, deflate])

  const adjustedInvestmentData = useMemo(() => {
    if (!results?.investmentData) return []
    if (!isRealDollars) return results.investmentData
    return results.investmentData.map((point: any) => ({
      ...point,
      initial: point.realInitial ?? point.initial,
      contributions: point.realContributions ?? point.contributions,
      withdrawals: point.realWithdrawals ?? point.withdrawals,
      netSpending: point.realNetSpending ?? point.netSpending,
      taxesPaid: point.realTaxesPaid ?? point.taxesPaid,
      total: point.realTotal ?? point.total,
    }))
  }, [results?.investmentData, isRealDollars])

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


  const formatDisplayCurrency = (value: number | undefined) => {
    const safeValue = value ?? 0
    const compact = Math.abs(safeValue) >= 1e100 || !showFullPrecision
    return formatCurrency(safeValue, true, 2, compact)
  }

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
    const points = results?.investmentData ?? []
    const last = points[points.length - 1]
    if (!last) return params.initialValue || 0
    if (mode === 'withdrawal') return isRealDollars ? (last.realInitial ?? last.initial) : last.initial
    return isRealDollars ? (last.realTotal ?? last.total) : last.total
  }, [results?.investmentData, params.initialValue, mode, isRealDollars])

  if (!results) return null
  
  const taxEnabled = params.taxEnabled
  let taxInfo = ''
  if (taxEnabled) {
    if (mode === 'growth') {
      taxInfo = params.taxType === 'income' 
        ? '(After annual income tax drag)' 
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
                  {isRealDollars ? `Real (Today's ${getAppCurrency().symbol})` : `Nominal (Future ${getAppCurrency().symbol})`}
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

        <p className="hidden print:block px-6 pb-2 text-xs text-muted-foreground">
          Completed simulation seed: {results.simulationSeed}
        </p>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard 
               label={showGrossSummary ? "Median Outcome (Net)" : "Median Outcome"} 
               value={renderFormattedResult(results.median)}
               subLabel={showGrossSummary ? "Gross:" : undefined}
               subValue={showGrossSummary ? renderFormattedResult(results.medianGross) : undefined} 
               textClass="text-primary"
               bgClass="bg-gradient-to-br from-primary/10 to-primary/5"
            />
            <MetricCard 
               label={showGrossSummary ? "Mean Outcome (Net)" : "Mean Outcome"} 
               value={renderFormattedResult(results.mean)}
               subLabel={showGrossSummary ? "Gross:" : undefined}
               subValue={showGrossSummary ? renderFormattedResult(results.meanGross) : undefined} 
               textClass="text-blue-500"
               bgClass="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
               delay={0.05} 
            />
            <MetricCard 
               label={showGrossSummary ? "95th Percentile (Upside) (Net)" : "95th Percentile (Upside)"}
               value={renderFormattedResult(results.p95)}
               subLabel={showGrossSummary ? "Gross:" : undefined}
               subValue={showGrossSummary ? renderFormattedResult(results.p95Gross) : undefined} 
               textClass="text-emerald-500"
               bgClass="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5"
               delay={0.1} 
            />
            <MetricCard 
               label={showGrossSummary ? "5th Percentile (Downside) (Net)" : "5th Percentile (Downside)"}
               value={renderFormattedResult(results.p5)}
               subLabel={showGrossSummary ? "Gross:" : undefined}
               subValue={showGrossSummary ? renderFormattedResult(results.p5Gross) : undefined} 
               textClass="text-orange-500"
               bgClass="bg-gradient-to-br from-orange-500/10 to-orange-500/5"
               delay={0.15} 
            />
          </div>

          {taxEnabled && mode === 'growth' && (params.taxType === 'capital_gains' || params.taxType === 'tax_deferred') && (
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }}
               className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm"
             >
                <Coins className="h-5 w-5 text-red-500" />
                <div>
                   <span className="font-semibold text-red-600 dark:text-red-400">Estimated Tax Cost: </span>
                   <span className="font-bold">
                      {formatDisplayCurrency(isRealDollars ? (results.totalTaxCostInTodaysDollars ?? getAdjustedScalar(results.totalTaxCost ?? results.taxDragAmount)) : (results.totalTaxCost ?? results.taxDragAmount))}
                   </span>
                   <span className="text-muted-foreground ml-1">
                      (Modeled difference between gross and spendable outcomes)
                   </span>
                </div>
             </motion.div>
          )}

          {mode === 'withdrawal' && results.representativeCashflowBreakdown && (
            <div className="space-y-2">
              <Label>Representative Median-Ending Path</Label>
              <p className="text-xs text-muted-foreground">
                Cashflow components below come from the single simulated path whose ending spendable value is closest to the median, so the accounting components reconcile exactly.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <DistributionItem
                  label="Gross withdrawn"
                  value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.grossWithdrawnInTodaysDollars : results.representativeCashflowBreakdown.grossWithdrawn)}
                />
                <DistributionItem
                  label="After-tax spending"
                  value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.netSpendingInTodaysDollars : results.representativeCashflowBreakdown.netSpending)}
                />
                <DistributionItem
                  label="Withdrawal taxes"
                  value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.withdrawalTaxesInTodaysDollars : results.representativeCashflowBreakdown.withdrawalTaxes)}
                />
                <DistributionItem
                  label="Return tax drag"
                  value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.incomeTaxDragInTodaysDollars : results.representativeCashflowBreakdown.incomeTaxDrag)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Outcome Distribution {isRealDollars && <span className="text-xs text-muted-foreground font-normal">(Adjusted for Inflation)</span>}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <DistributionItem label="10th percentile" value={renderFormattedResult(results.p10)} />
              <DistributionItem label="25th percentile" value={renderFormattedResult(results.p25)} />
              <DistributionItem label="75th percentile" value={renderFormattedResult(results.p75)} />
              <DistributionItem label="90th percentile" value={renderFormattedResult(results.p90)} />
              <DistributionItem label="Sample maximum" value={renderFormattedResult(results.best)} valueClass="text-emerald-500" />
              <DistributionItem label="Sample minimum" value={renderFormattedResult(results.worst)} valueClass="text-orange-500" />
            </div>
          </div>

          {params.portfolioGoal && mode === 'growth' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg"
            >
              <Target className="h-6 w-6 text-primary" />
              <GoalTerminalOutcomeSummary
                probability={results.endingAtOrAboveGoalProbability ?? 0}
                formattedGoal={formatCurrency(getAdjustedScalar(results.portfolioGoalSnapshot ?? params.portfolioGoal))}
                pathsEndedAtOrAboveGoal={results.pathsEndingAtOrAboveGoal ?? 0}
                scenarioCount={results.numPathsUsed ?? params.numPaths}
              />
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
                  <MonteCarloInvestmentInsight
                    mode={mode}
                    duration={params.duration}
                    formattedTotal={formatDisplayCurrency(totalInvested)}
                  />
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
                    <span className="font-semibold text-blue-600 dark:text-blue-400">The Multiplier Effect:</span> At the 95th-percentile outcome, the modeled ending value was{' '}
                    <span className="font-bold">
                      {((isRealDollars ? deflate(results.p95 ?? 0, duration) : (results.p95 ?? 0)) / (totalInvested || 1)).toFixed(1)}x
                    </span>.
                  </p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <MonteCarloSuccessInsight
                    mode={mode}
                    successRate={mode === 'withdrawal' ? results.solventRate : results.profitableRate}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 gap-6">
        <MonteCarloChart 
          data={results.chartData ?? []} 
          grossData={results.chartDataGross ?? []} 
          deterministicGrossData={results.deterministicSeriesGross ?? []} 
          mode={mode} 
          logScale={logScales.chart}
          onLogScaleChange={(val) => setLogScales({ ...logScales, chart: val })}
          enableAnimation={!isExporting}
          isRealDollars={isRealDollars}
          inflationAdjustment={inflationAdjustment}
          deterministicData={results.deterministicSeries}
        />

        <CashflowChart params={params} mode={mode} investmentData={results.investmentData ?? []} isRealDollars={isRealDollars} />
             
        {taxEnabled && (
           <TaxImpactChart 
              data={results.chartData}
              grossData={results.chartDataGross}
              investmentData={results.investmentData} 
              params={params} 
              isRealDollars={isRealDollars} 
           />
        )}

        <SensitivityTable params={params} mode={mode} rngSeed={results.simulationSeed} />

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

        {mode === 'growth' && (
          <InvestmentBreakdownChart
            data={adjustedInvestmentData}
            isDark={isDark}
            enableAnimation={!isExporting}
          />
        )}

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

function MetricCard({ label, value, subLabel, subValue, textClass, bgClass, delay = 0 }: any) {
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
      {subValue !== undefined && subValue !== null && (
        <p className="text-xs text-muted-foreground">
          {subLabel ? subLabel : ''} <span className="font-medium text-foreground">{subValue}</span>
        </p>
      )}
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
  const btnClass = "inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-2 font-medium shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-wait"
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
