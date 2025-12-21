'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  TrendingDown, Share, FileText, FileSpreadsheet, 
  CheckCircle2, AlertTriangle, Wallet, ShoppingCart 
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency, getLargeNumberName } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { WithdrawalChart } from '@/components/withdrawal-chart'
import { WithdrawalProjectionResult } from '@/lib/simulation/withdrawal-engine'

interface WithdrawalResultsProps {
  data: WithdrawalProjectionResult
  duration: number
  showFullPrecision: boolean
  setShowFullPrecision: (v: boolean) => void
  onShare: () => void
  onExportPdf: () => void
  onExportExcel: () => void
}

export function WithdrawalResults({
  data,
  duration,
  showFullPrecision,
  setShowFullPrecision,
  onShare,
  onExportPdf,
  onExportExcel
}: WithdrawalResultsProps) {
  
  const { 
    endingBalance, 
    endingBalanceInTodaysDollars,
    totalWithdrawn, 
    totalWithdrawnNet,
    totalTaxPaid,
    totalWithdrawnInTodaysDollars,
    isSustainable, 
    yearsUntilZero, 
    yearData 
  } = data
  
  const sustainabilityColor = isSustainable ? 'text-emerald-500' : 'text-destructive'

  const renderFormattedResult = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '$0'

    const shouldUseCompact = val >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(val, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(val)

    if (shouldUseCompact && fullName) {
      return <CompactValue formatted={formatted} fullName={fullName} />
    }

    return formatted
  }
  
  const showTax = totalTaxPaid > 0

  return (
    <>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            boxShadow: isSustainable
              ? '0 0 30px rgba(16,185,129,0.25)'
              : '0 0 30px rgba(239,68,68,0.25)',
          }}
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <Card
            className={`border-2 ${
              isSustainable
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-destructive/50 bg-destructive/5'
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 16 }}
                >
                  {isSustainable ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                  )}
                </motion.div>

                <div className="flex-1">
                  <h3 className={`text-lg font-bold ${sustainabilityColor}`}>
                    {isSustainable
                      ? 'Sustainable Plan'
                      : 'Unsustainable Plan'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isSustainable
                      ? `Your portfolio can sustain withdrawals for the full ${duration} years`
                      : `Your portfolio will be depleted in approximately ${yearsUntilZero} years`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0 }}
      >
        <Card className="print-section">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 shrink-0">
                <TrendingDown className="h-5 w-5 text-blue-500" />
                Withdrawal Results
              </CardTitle>

              <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
                <div className="flex items-center gap-2 mr-2 border-r border-border pr-3">
                  <Switch
                    id="precision-toggle-withdrawal"
                    checked={showFullPrecision}
                    onCheckedChange={setShowFullPrecision}
                  />
                  <Label htmlFor="precision-toggle-withdrawal" className="font-normal cursor-pointer">
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
            {/* Primary Metrics */}
            <div className={`grid grid-cols-1 gap-4 ${showTax ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
              <MetricCard
                label="Ending Balance"
                value={renderFormattedResult(endingBalance)}
                colorClass={sustainabilityColor}
                bgClass={isSustainable 
                  ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5' 
                  : 'bg-gradient-to-br from-destructive/10 to-destructive/5'
                }
              />

              <MetricCard
                label={showTax ? "Net Withdrawn (After Tax)" : "Total Withdrawn"}
                value={renderFormattedResult(showTax ? totalWithdrawnNet : totalWithdrawn)}
                colorClass="text-blue-500"
                bgClass="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
              />

              {showTax && (
                 <MetricCard
                  label="Total Tax Paid"
                  value={renderFormattedResult(-totalTaxPaid)}
                  colorClass="text-red-500"
                  bgClass="bg-gradient-to-br from-red-500/10 to-red-500/5"
                />
              )}

              <MetricCard
                label="Portfolio Lasts"
                value={`${yearsUntilZero ?? duration}+ years`}
                colorClass="text-purple-500"
                bgClass="bg-gradient-to-br from-purple-500/10 to-purple-500/5"
              />
            </div>

            {/* Secondary Context Metrics (NEW) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
                <div className="p-2 bg-indigo-500/10 rounded-md mt-1">
                  <Wallet className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground"> Real Legacy Value (Purchasing Power)</p>
                  <p className="text-2xl font-bold text-indigo-500 my-1">{renderFormattedResult(endingBalanceInTodaysDollars)}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    This is what your remaining balance would be worth in today&apos;s money.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                <div className="p-2 bg-amber-500/10 rounded-md mt-1">
                  <ShoppingCart className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Total Real Consumption</p>
                  <p className="text-2xl font-bold text-amber-500 my-1">{renderFormattedResult(totalWithdrawnInTodaysDollars)}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    The total effective purchasing power you were able to spend from this portfolio.
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      <WithdrawalChart data={yearData} />
    </>
  )
}

function MetricCard({ 
  label, 
  value, 
  colorClass, 
  bgClass 
}: { 
  label: string, 
  value: React.ReactNode, 
  colorClass: string,
  bgClass: string
}) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`min-w-0 rounded-lg p-4 space-y-1 ${bgClass}`}
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