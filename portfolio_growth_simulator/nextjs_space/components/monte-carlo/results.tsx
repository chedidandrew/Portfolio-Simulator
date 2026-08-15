'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Coins,
  Dices,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Loader2,
  Share,
  Target,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MonteCarloChart } from '@/components/monte-carlo-chart'
import { MonteCarloHistogram } from '@/components/monte-carlo-histogram'
import { MonteCarloMaxDrawdownHistogram } from '@/components/monte-carlo-max-drawdown'
import {
  AnnualReturnsChart,
  InvestmentBreakdownChart,
  LossProbabilitiesChart,
  ReturnProbabilitiesChart,
} from '@/components/monte-carlo-analytics'
import { SensitivityTable } from '@/components/monte-carlo/sensitivity-table'
import { CashflowChart } from '@/components/monte-carlo/cashflow-chart'
import { TaxImpactChart } from '@/components/monte-carlo/tax-impact-chart'
import { formatCurrency, getAppCurrency, getLargeNumberName } from '@/lib/utils'
import type { SimulationParams } from '@/lib/types'
import type { CompletedSimulationResults } from '@/hooks/use-monte-carlo'
import {
  GoalTerminalOutcomeSummary,
  MonteCarloInvestmentInsight,
  MonteCarloSuccessInsight,
} from './mode-insights'

export type ExportState = 'idle' | 'pdf' | 'excel'

interface MonteCarloResultsProps {
  mode: 'growth' | 'withdrawal'
  results: CompletedSimulationResults
  params: SimulationParams
  logScales: { chart: boolean; histogram: boolean; drawdown: boolean }
  setLogScales: (scales: { chart: boolean; histogram: boolean; drawdown: boolean }) => void
  showFullPrecision: boolean
  setShowFullPrecision: (value: boolean) => void
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
  exportState,
}: MonteCarloResultsProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isExporting = exportState !== 'idle'
  const [isRealDollars, setIsRealDollars] = useState(false)
  const inflationAdjustment = params.inflationAdjustment ?? 0
  const duration = params.duration
  const taxEnabled = Boolean(params.taxEnabled)
  const showGrossSummary = taxEnabled
    && mode === 'growth'
    && (params.taxType === 'capital_gains' || params.taxType === 'tax_deferred')

  const deflate = useCallback((value: number, years: number) => {
    if (!isRealDollars || inflationAdjustment === 0) return value
    return value / Math.pow(1 + inflationAdjustment / 100, years)
  }, [inflationAdjustment, isRealDollars])

  const getAdjustedScalar = (value: number | undefined) => deflate(value ?? 0, duration)

  const adjustedEndingValues = useMemo(() => {
    if (!isRealDollars) return results.endingValues ?? []
    return (results.endingValues ?? []).map((value) => deflate(value, duration))
  }, [deflate, duration, isRealDollars, results.endingValues])

  const adjustedInvestmentData = useMemo(() => {
    if (!isRealDollars) return results.investmentData ?? []
    return (results.investmentData ?? []).map((point) => ({
      ...point,
      initial: point.realInitial ?? point.initial,
      contributions: point.realContributions ?? point.contributions,
      withdrawals: point.realWithdrawals ?? point.withdrawals,
      netSpending: point.realNetSpending ?? point.netSpending,
      taxesPaid: point.realTaxesPaid ?? point.taxesPaid,
      total: point.realTotal ?? point.total,
    }))
  }, [isRealDollars, results.investmentData])

  const adjustedAnnualReturnsData = useMemo(() => {
    if (!isRealDollars) return results.annualReturnsData ?? []
    const adjustCagr = (value: number) => (
      ((1 + value / 100) / (1 + inflationAdjustment / 100) - 1) * 100
    )
    return (results.annualReturnsData ?? []).map((point) => ({
      ...point,
      p10: adjustCagr(point.p10),
      p25: adjustCagr(point.p25),
      median: adjustCagr(point.median),
      p75: adjustCagr(point.p75),
      p90: adjustCagr(point.p90),
    }))
  }, [inflationAdjustment, isRealDollars, results.annualReturnsData])

  const formatDisplayCurrency = (value: number | undefined) => {
    const safeValue = value ?? 0
    const compact = Math.abs(safeValue) >= 1e100 || !showFullPrecision
    return formatCurrency(safeValue, true, 2, compact)
  }

  const renderFormattedResult = (value: number | undefined): ReactNode => {
    const adjusted = getAdjustedScalar(value)
    const compact = Math.abs(adjusted) >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(adjusted, true, 2, compact)
    const fullName = getLargeNumberName(adjusted)
    return compact && fullName
      ? <CompactValue formatted={formatted} fullName={fullName} />
      : formatted
  }

  const totalInvested = useMemo(() => {
    const points = results.investmentData ?? []
    const last = points[points.length - 1]
    if (!last) return params.initialValue || 0
    if (mode === 'withdrawal') return isRealDollars ? (last.realInitial ?? last.initial) : last.initial
    return isRealDollars ? (last.realTotal ?? last.total) : last.total
  }, [isRealDollars, mode, params.initialValue, results.investmentData])

  const taxInfo = taxEnabled && mode === 'growth'
    ? params.taxType === 'income'
      ? '(After annual income-tax drag)'
      : '(Net of deferred tax)'
    : ''

  return (
    <>
      <Card className="border-primary/20 print-section">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Dices className="h-5 w-5 text-violet-500" aria-hidden="true" />
              Simulation Results
              {taxInfo && <span className="ml-1 text-xs font-normal text-muted-foreground">{taxInfo}</span>}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end sm:gap-3 sm:text-sm print:hidden">
              <div className="mr-2 flex items-center gap-2 border-r border-border pr-3">
                <Switch id="real-nominal-toggle" checked={isRealDollars} onCheckedChange={setIsRealDollars} />
                <Label htmlFor="real-nominal-toggle" className="cursor-pointer font-normal">
                  {isRealDollars ? `Real (Today's ${getAppCurrency().symbol})` : `Nominal (Future ${getAppCurrency().symbol})`}
                </Label>
              </div>
              <div className="mr-2 flex items-center gap-2 border-r border-border pr-3">
                <Switch id="precision-toggle-mc" checked={showFullPrecision} onCheckedChange={setShowFullPrecision} />
                <Label htmlFor="precision-toggle-mc" className="cursor-pointer font-normal">Expand</Label>
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

        <p className="hidden px-6 pb-2 text-xs text-muted-foreground print:block">
          Completed simulation seed: {results.simulationSeed}
        </p>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label={showGrossSummary ? 'Median Outcome (Net)' : 'Median Outcome'}
              value={renderFormattedResult(results.median)}
              subLabel={showGrossSummary ? 'Gross:' : undefined}
              subValue={showGrossSummary ? renderFormattedResult(results.medianGross) : undefined}
              textClass="text-primary"
              bgClass="bg-gradient-to-br from-primary/10 to-primary/5"
            />
            <MetricCard
              label={showGrossSummary ? 'Mean Outcome (Net)' : 'Mean Outcome'}
              value={renderFormattedResult(results.mean)}
              subLabel={showGrossSummary ? 'Gross:' : undefined}
              subValue={showGrossSummary ? renderFormattedResult(results.meanGross) : undefined}
              textClass="text-blue-600 dark:text-blue-400"
              bgClass="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
              delay={0.05}
            />
            <MetricCard
              label={showGrossSummary ? '95th Percentile (Net)' : '95th Percentile (Upside)'}
              value={renderFormattedResult(results.p95)}
              subLabel={showGrossSummary ? 'Gross:' : undefined}
              subValue={showGrossSummary ? renderFormattedResult(results.p95Gross) : undefined}
              textClass="text-emerald-700 dark:text-emerald-400"
              bgClass="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5"
              delay={0.1}
            />
            <MetricCard
              label={showGrossSummary ? '5th Percentile (Net)' : '5th Percentile (Downside)'}
              value={renderFormattedResult(results.p5)}
              subLabel={showGrossSummary ? 'Gross:' : undefined}
              subValue={showGrossSummary ? renderFormattedResult(results.p5Gross) : undefined}
              textClass="text-orange-700 dark:text-orange-400"
              bgClass="bg-gradient-to-br from-orange-500/10 to-orange-500/5"
              delay={0.15}
            />
          </div>

          {showGrossSummary && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm">
              <Coins className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
              <p>
                <span className="font-semibold text-red-700 dark:text-red-400">Estimated Tax Cost: </span>
                <span className="font-bold">
                  {formatDisplayCurrency(
                    isRealDollars
                      ? (results.totalTaxCostInTodaysDollars ?? getAdjustedScalar(results.totalTaxCost ?? results.taxDragAmount))
                      : (results.totalTaxCost ?? results.taxDragAmount),
                  )}
                </span>
                <span className="ml-1 text-muted-foreground">(modeled difference between gross and spendable outcomes)</span>
              </p>
            </div>
          )}

          {mode === 'withdrawal' && results.representativeCashflowBreakdown && (
            <div className="space-y-2">
              <Label>Representative Median-Ending Path</Label>
              <p className="text-xs text-muted-foreground">
                These components come from one actual path whose ending spendable value is closest to the median, so the accounting reconciles.
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <DistributionItem label="Gross withdrawn" value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.grossWithdrawnInTodaysDollars : results.representativeCashflowBreakdown.grossWithdrawn)} />
                <DistributionItem label="After-tax spending" value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.netSpendingInTodaysDollars : results.representativeCashflowBreakdown.netSpending)} />
                <DistributionItem label="Withdrawal taxes" value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.withdrawalTaxesInTodaysDollars : results.representativeCashflowBreakdown.withdrawalTaxes)} />
                <DistributionItem label="Return tax drag" value={formatDisplayCurrency(isRealDollars ? results.representativeCashflowBreakdown.incomeTaxDragInTodaysDollars : results.representativeCashflowBreakdown.incomeTaxDrag)} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Outcome Distribution
              {isRealDollars && <span className="ml-1 text-xs font-normal text-muted-foreground">(inflation adjusted)</span>}
            </Label>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <DistributionItem label="10th percentile" value={renderFormattedResult(results.p10)} />
              <DistributionItem label="25th percentile" value={renderFormattedResult(results.p25)} />
              <DistributionItem label="75th percentile" value={renderFormattedResult(results.p75)} />
              <DistributionItem label="90th percentile" value={renderFormattedResult(results.p90)} />
              <DistributionItem label="Sample maximum" value={renderFormattedResult(results.best)} valueClass="text-emerald-700 dark:text-emerald-400" />
              <DistributionItem label="Sample minimum" value={renderFormattedResult(results.worst)} valueClass="text-orange-700 dark:text-orange-400" />
            </div>
          </div>

          {params.portfolioGoal && mode === 'growth' && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-4">
              <Target className="h-6 w-6 text-primary" aria-hidden="true" />
              <GoalTerminalOutcomeSummary
                probability={results.endingAtOrAboveGoalProbability ?? 0}
                formattedGoal={formatCurrency(getAdjustedScalar(results.portfolioGoalSnapshot ?? params.portfolioGoal))}
                pathsEndedAtOrAboveGoal={results.pathsEndingAtOrAboveGoal ?? 0}
                scenarioCount={results.numPathsUsed ?? params.numPaths}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                Key Insights
              </Label>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-muted/50 p-3">
                  <MonteCarloInvestmentInsight mode={mode} duration={params.duration} formattedTotal={formatDisplayCurrency(totalInvested)} />
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p>
                    <span className="font-semibold">Middle 50%:</span> modeled ending values fall between{' '}
                    <span className="font-bold text-orange-700 dark:text-orange-400">{renderFormattedResult(results.p25)}</span>
                    {' '}and{' '}
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{renderFormattedResult(results.p75)}</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                Did you know?
              </Label>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                  <p>
                    <span className="font-semibold text-blue-700 dark:text-blue-400">Upside multiplier:</span> the 95th-percentile ending value was{' '}
                    <span className="font-bold">
                      {((isRealDollars ? deflate(results.p95 ?? 0, duration) : (results.p95 ?? 0)) / (totalInvested || 1)).toFixed(1)}x
                    </span> the modeled invested amount.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <MonteCarloSuccessInsight mode={mode} successRate={mode === 'withdrawal' ? results.solventRate : results.profitableRate} />
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
          onLogScaleChange={(value) => setLogScales({ ...logScales, chart: value })}
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
          onLogScaleChange={(value) => setLogScales({ ...logScales, histogram: value })}
          enableAnimation={!isExporting}
        />
        <MonteCarloMaxDrawdownHistogram
          data={results.maxDrawdowns ?? []}
          logScale={logScales.drawdown}
          onLogScaleChange={(value) => setLogScales({ ...logScales, drawdown: value })}
          enableAnimation={!isExporting}
        />
        {mode === 'growth' && (
          <InvestmentBreakdownChart data={adjustedInvestmentData} isDark={isDark} enableAnimation={!isExporting} />
        )}
        <AnnualReturnsChart data={adjustedAnnualReturnsData} isDark={isDark} enableAnimation={!isExporting} />
        <ReturnProbabilitiesChart data={results.annualReturnsData ?? []} isDark={isDark} enableAnimation={!isExporting} />
        <LossProbabilitiesChart data={results.lossProbData ?? []} isDark={isDark} enableAnimation={!isExporting} />
      </div>
    </>
  )
}

interface MetricCardProps {
  label: string
  value: ReactNode
  subLabel?: string
  subValue?: ReactNode
  textClass: string
  bgClass: string
  delay?: number
}

function MetricCard({ label, value, subLabel, subValue, textClass, bgClass, delay = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay }}
      className={`min-w-0 space-y-1 rounded-lg p-4 ${bgClass}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`break-words text-lg font-bold leading-tight sm:text-xl md:text-2xl ${textClass}`}>{value}</p>
      {subValue !== undefined && subValue !== null && (
        <p className="text-xs text-muted-foreground">
          {subLabel ?? ''} <span className="font-medium text-foreground">{subValue}</span>
        </p>
      )}
    </motion.div>
  )
}

function DistributionItem({ label, value, valueClass = '' }: { label: string; value: ReactNode; valueClass?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded bg-muted p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`truncate text-lg font-bold leading-tight ${valueClass}`}>{value}</span>
    </div>
  )
}

function ActionButtons({ onShare, onExportPdf, onExportExcel, exportState }: {
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
  exportState: ExportState
}) {
  const buttonClass = 'inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-2 font-medium shadow-sm transition-colors duration-150 disabled:cursor-wait disabled:opacity-50'
  const isExporting = exportState !== 'idle'

  return (
    <>
      <motion.button
        type="button"
        onClick={onShare}
        disabled={isExporting}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${buttonClass} border-blue-500/50 bg-blue-500/10 text-blue-700 hover:border-blue-600 hover:bg-blue-500/20 dark:text-blue-300`}
      >
        <Share className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Share</span>
      </motion.button>
      <motion.button
        type="button"
        onClick={onExportPdf}
        disabled={isExporting}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${buttonClass} border-red-500/50 bg-red-500/10 text-red-700 hover:border-red-600 hover:bg-red-500/20 dark:text-red-300`}
      >
        {exportState === 'pdf'
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          : <FileText className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{exportState === 'pdf' ? 'Generating...' : 'PDF'}</span>
      </motion.button>
      <motion.button
        type="button"
        onClick={onExportExcel}
        disabled={isExporting}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${buttonClass} border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300`}
      >
        {exportState === 'excel'
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          : <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{exportState === 'excel' ? 'Generating...' : 'Excel'}</span>
      </motion.button>
    </>
  )
}

function CompactValue({ formatted, fullName }: { formatted: string; fullName: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${formatted}. ${fullName}`}
            className="inline rounded-sm text-left decoration-dotted decoration-foreground/40 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation()
              setIsOpen((current) => !current)
            }}
          >
            {formatted}
          </button>
        </TooltipTrigger>
        <TooltipContent className="rounded-lg border-border bg-card p-3 text-xs text-foreground shadow-lg">
          <p>{fullName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
