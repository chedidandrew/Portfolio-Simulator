'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  TrendingDown, Share, FileText, FileSpreadsheet, 
  CheckCircle2, AlertTriangle, XCircle 
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency, getLargeNumberName } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { WithdrawalChart } from '@/components/withdrawal-chart'

interface WithdrawalResultsProps {
  data: {
    endingBalance: number
    totalWithdrawn: number
    isSustainable: boolean
    yearsUntilZero: number | null
    yearData: any[]
  }
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
  
  const { endingBalance, totalWithdrawn, isSustainable, yearsUntilZero, yearData } = data
  const sustainabilityColor = isSustainable ? 'text-emerald-500' : 'text-destructive'

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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <motion.div
                key={endingBalance}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`rounded-lg p-4 space-y-1 ${
                  isSustainable
                    ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
                    : 'bg-gradient-to-br from-destructive/10 to-destructive/5'
                }`}
              >
                <p className="text-xs text-muted-foreground">Ending Balance</p>
                <p className={`text-lg sm:text-xl md:text-2xl font-bold ${sustainabilityColor} break-words leading-tight`}>
                  {renderFormattedResult(endingBalance)}
                </p>
              </motion.div>

              <motion.div
                key={totalWithdrawn}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 space-y-1"
              >
                <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-500 break-words leading-tight">
                  {renderFormattedResult(totalWithdrawn)}
                </p>
              </motion.div>

              <motion.div
                key={yearsUntilZero}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-4 space-y-1"
              >
                <p className="text-xs text-muted-foreground">Portfolio Lasts</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-500 break-words leading-tight">
                  {yearsUntilZero ?? duration}+ years
                </p>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <WithdrawalChart data={yearData} />
    </>
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