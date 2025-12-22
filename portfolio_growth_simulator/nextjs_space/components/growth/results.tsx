'use client'

import { useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TrendingUp, Share, FileText, FileSpreadsheet, Target, ShoppingCart, Percent } from 'lucide-react'
import { motion } from 'framer-motion'
import { GrowthChart } from '@/components/growth-chart'
import { formatCurrency, getLargeNumberName } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GrowthMilestones } from './milestones'
import { GrowthProjectionResult } from '@/lib/simulation/growth-engine'

interface GrowthResultsProps {
  data: GrowthProjectionResult
  targetValue?: number
  // NEW: Tax props for header label
  taxEnabled?: boolean
  taxType?: 'capital_gains' | 'income'
  showFullPrecision: boolean
  setShowFullPrecision: (v: boolean) => void
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
}

export function GrowthResults({
  data,
  targetValue,
  taxEnabled,
  taxType,
  showFullPrecision,
  setShowFullPrecision,
  onShare,
  onExportPdf,
  onExportExcel,
}: GrowthResultsProps) {
  const {
    finalValue,
    finalValueNet,
    finalValueInTodaysDollars,
    totalContributions,
    totalProfit,
    totalDeferredTax,
    totalTaxPaid,
    yearsToTarget,
    yearData,
  } = data

  const isProfitNegative = totalProfit < 0
  
  const roi = totalContributions > 0 
    ? ((totalProfit - totalDeferredTax) / totalContributions) * 100 
    : 0

  const formatResult = (val: number) => {
    if (val === undefined || isNaN(val)) return formatCurrency(0)

    const shouldUseCompact = val >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(val, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(val)

    if (shouldUseCompact && fullName) {
      return <CompactValue formatted={formatted} fullName={fullName} />
    }

    return formatted
  }

  // Logic to determine which tax to show
  const showDeferredTax = totalDeferredTax > 0
  const showPaidTax = totalTaxPaid > 0
  const showAnyTax = showDeferredTax || showPaidTax

  // For Capital Gains: Main number is Net.
  // For Income: Main number is Net (which is same as Gross/FinalValue in this engine structure).
  const displayValue = showDeferredTax ? finalValueNet : finalValue

  // Header Label Logic
  let headerLabel = ''
  if (taxEnabled) {
    headerLabel = taxType === 'income' 
      ? '(After Annual Tax Drag)' 
      : '(Net of Deferred Tax)'
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 print-section">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>
                Projected Results 
                {headerLabel && <span className="text-xs font-normal text-muted-foreground ml-1.5">{headerLabel}</span>}
              </span>
            </CardTitle>

            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
              <div className="flex items-center gap-2 mr-2 border-r border-border pr-3">
                <Switch id="precision-toggle" checked={showFullPrecision} onCheckedChange={setShowFullPrecision} />
                <Label htmlFor="precision-toggle" className="font-normal cursor-pointer">
                  Expand
                </Label>
              </div>

              <ActionButtons onShare={onShare} onExportPdf={onExportPdf} onExportExcel={onExportExcel} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className={`grid grid-cols-1 gap-4 ${showAnyTax ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <MetricCard 
              label={showDeferredTax ? "Final Value (After Tax)" : "Final Portfolio Value"} 
              value={formatResult(displayValue)} 
              colorClass="text-primary" 
              bgClass="bg-gradient-to-br from-primary/10 to-primary/5"
            />
            <MetricCard 
              label="Total Contributions" 
              value={formatResult(totalContributions)} 
              colorClass="text-blue-500" 
              bgClass="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
            />
            <MetricCard
              label={showDeferredTax ? "Total Profit (After Tax)" : "Total Profit"}
              value={formatResult(showDeferredTax ? totalProfit - totalDeferredTax : totalProfit)}
              colorClass={isProfitNegative ? 'text-destructive' : 'text-emerald-500'}
              bgClass={isProfitNegative 
                ? 'bg-gradient-to-br from-destructive/10 to-destructive/5' 
                : 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
              }
            />
            
            {showDeferredTax && (
               <MetricCard 
                label="Est. Tax Liability" 
                value={formatResult(-totalDeferredTax)}
                colorClass="text-red-500" 
                bgClass="bg-gradient-to-br from-red-500/10 to-red-500/5"
              />
            )}

            {showPaidTax && (
               <MetricCard 
                label="Total Tax Paid" 
                value={formatResult(-totalTaxPaid)} 
                colorClass="text-red-500" 
                bgClass="bg-gradient-to-br from-red-500/10 to-red-500/5"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
              <div className="p-2 bg-indigo-500/10 rounded-md mt-1">
                <ShoppingCart className="h-4 w-4 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {showDeferredTax ? "Purchasing Power (Real Value After Tax)" : "Purchasing Power (Real Value)"}
                </p>
                <p className="text-2xl font-bold text-indigo-500 my-1">{formatResult(finalValueInTodaysDollars)}</p>
                <p className="text-xs text-muted-foreground leading-tight">
                  This is what your final balance would be worth in today&apos;s money, adjusted for inflation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <div className="p-2 bg-amber-500/10 rounded-md mt-1">
                <Percent className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{taxEnabled ? "Return on Investment (ROI After Tax)" : "Return on Investment (ROI)"}</p>
                <p className={`text-2xl font-bold my-1 ${roi < 0 ? 'text-destructive' : 'text-amber-500'}`}>
                  {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  Your total percentage return on invested capital.
                </p>
              </div>
            </div>
          </div>

          {targetValue && yearsToTarget ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg border border-primary/20"
            >
              <Target className="h-5 w-5 text-primary" />
              <p className="text-sm">
                You&apos;ll reach your target of <span className="font-bold">{formatCurrency(targetValue)}</span> in
                approximately <span className="font-bold text-primary">{yearsToTarget} years</span>
              </p>
            </motion.div>
          ) : null}

          <GrowthMilestones finalValue={displayValue} />
        </CardContent>
      </Card>

      <GrowthChart data={yearData} />
    </div>
  )
}

function MetricCard({
  label,
  value,
  colorClass,
  bgClass
}: {
  label: string
  value: ReactNode
  colorClass: string
  bgClass: string
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`min-w-0 rounded-lg p-4 space-y-1 ${bgClass}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={`text-lg sm:text-xl md:text-2xl font-bold break-words leading-tight ${colorClass}`}>{value}</div>
    </motion.div>
  )
}

function ActionButtons({
  onShare,
  onExportPdf,
  onExportExcel,
}: {
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
}) {
  const btnClass =
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 font-medium shadow-sm transition-colors duration-150'

  return (
    <>
      <motion.button
        type="button"
        onClick={onShare}
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
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${btnClass} border-red-400/50 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:border-red-400`}
      >
        <FileText className="h-3.5 w-3.5" />
        <span>PDF</span>
      </motion.button>

      <motion.button
        type="button"
        onClick={onExportExcel}
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.96, y: 0 }}
        className={`${btnClass} border-emerald-400/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-400`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        <span>Excel</span>
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
          <span
            className="cursor-help decoration-dotted decoration-foreground/30 underline-offset-4 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen((prev) => !prev)
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