'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TrendingUp, Share, FileText, FileSpreadsheet, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import { GrowthChart } from '@/components/growth-chart'
import { formatCurrency, getLargeNumberName } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GrowthMilestones } from './milestones'

interface GrowthResultsProps {
  data: {
    finalValue: number
    totalContributions: number
    totalProfit: number
    yearsToTarget: number | null
    yearData: any[]
  }
  targetValue?: number
  showFullPrecision: boolean
  setShowFullPrecision: (v: boolean) => void
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
}

export function GrowthResults({
  data,
  targetValue,
  showFullPrecision,
  setShowFullPrecision,
  onShare,
  onExportPdf,
  onExportExcel
}: GrowthResultsProps) {
  
  const { finalValue, totalContributions, totalProfit, yearsToTarget, yearData } = data
  const isProfitNegative = totalProfit < 0

  // Helper for formatting result cards: Full Precision if toggled AND < 100M (or compact otherwise)
  const formatResult = (val: number) => {
    if (val === undefined) return '$0'

    const shouldUseCompact = val >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(val, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(val)

    if (shouldUseCompact && fullName) {
      return <CompactValue formatted={formatted} fullName={fullName} />
    }

    return formatted
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 print-section">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
              Projected Results
            </CardTitle>

            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
              <div className="flex items-center gap-2 mr-2 border-r border-border pr-3">
                <Switch
                  id="precision-toggle"
                  checked={showFullPrecision}
                  onCheckedChange={setShowFullPrecision}
                />
                <Label htmlFor="precision-toggle" className="font-normal cursor-pointer">
                  Expand
                </Label>
              </div>

              <ActionButtons 
                onShare={onShare} 
                onExportPdf={onExportPdf} 
                onExportExcel={onExportExcel} 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard 
              label="Final Portfolio Value" 
              value={formatResult(finalValue)} 
              colorClass="text-primary" 
            />
            <MetricCard 
              label="Total Contributions" 
              value={formatResult(totalContributions)} 
              colorClass="text-blue-500" 
            />
            <MetricCard 
              label="Total Profit" 
              value={formatResult(totalProfit)} 
              colorClass={isProfitNegative ? 'text-destructive' : 'text-emerald-500'} 
            />
          </div>

          {targetValue && yearsToTarget && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg"
            >
              <Target className="h-5 w-5 text-primary" />
              <p className="text-sm">
                You'll reach your target of <span className="font-bold">${targetValue.toLocaleString()}</span> in approximately{' '}
                <span className="font-bold text-primary">{yearsToTarget} years</span>
              </p>
            </motion.div>
          )}

          {/* Restored: Milestones inside the card content */}
          <GrowthMilestones finalValue={finalValue} />
        </CardContent>
      </Card>

      <GrowthChart data={yearData} />
    </div>
  )
}

function MetricCard({ label, value, colorClass }: { label: string, value: React.ReactNode, colorClass: string }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="min-w-0 bg-gradient-to-br from-muted/50 to-muted/10 rounded-lg p-4 space-y-1"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={`text-lg sm:text-xl md:text-2xl font-bold break-words leading-tight ${colorClass}`}>
        {value}
      </div>
    </motion.div>
  )
}

function ActionButtons({ onShare, onExportPdf, onExportExcel }: any) {
  const btnClass = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 font-medium shadow-sm transition-colors duration-150"
  
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

function CompactValue({ formatted, fullName }: { formatted: string, fullName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <span 
            className="cursor-help decoration-dotted decoration-foreground/30 underline-offset-4 hover:underline"
            onClick={(e) => {
              // Ensure tap works on mobile by toggling state
              setIsOpen(!isOpen)
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