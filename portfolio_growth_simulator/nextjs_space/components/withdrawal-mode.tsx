'use client'
import { useMemo, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  DollarSign,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Share,
  FileText,
  FileSpreadsheet,
  Dices,
} from 'lucide-react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { WithdrawalChart } from '@/components/withdrawal-chart'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { motion } from 'framer-motion'
import * as XLSX from 'xlsx'
import { triggerHaptic } from '@/hooks/use-haptics'
import { roundToCents, formatCurrency, getLargeNumberName } from '@/lib/utils'
import { WithdrawalState } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface YearData {
  year: number
  startingBalance: number
  withdrawals: number
  endingBalance: number
  isSustainable: boolean
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

export function WithdrawalMode() {
  const [state, setState] = useLocalStorage<WithdrawalState>(
    'withdrawal-mode-state',
    {
      startingBalance: 1000000,
      annualReturn: 7,
      duration: 30,
      periodicWithdrawal: 3000,
      inflationAdjustment: 2.5,
      frequency: 'monthly',
    },
  )

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('withdrawal-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('withdrawal-show-full-precision', false)

  // Renders the formatted currency. If the value is > 1M and compact mode is on,
  // it wraps the value in a tooltip showing the full name (e.g., "1.50 Quinquagintillion").
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

  // Load state from URL if sharing link is used
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')
      if (!mcParam) return

      const decoded = JSON.parse(decodeURIComponent(atob(mcParam)))
      if (decoded?.mode === 'withdrawal') {
        if (decoded.type === 'deterministic' && decoded.params) {
          // Restore deterministic state
          setUseMonteCarloMode(false)
          setState(decoded.params)
          // Restore full precision setting
          if (typeof decoded.showFullPrecision === 'boolean') {
            setShowFullPrecision(decoded.showFullPrecision)
          }
           // Clean URL
           window.history.replaceState(null, '', window.location.pathname)
        } else if (decoded.type !== 'deterministic' && !useMonteCarloMode) {
          // Default to MC
          setUseMonteCarloMode(true)
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    const payload = {
      mode: 'withdrawal',
      type: 'deterministic',
      params: state,
      showFullPrecision, // Include in share link
    }
    const encoded = typeof btoa !== 'undefined' ? btoa(encodeURIComponent(JSON.stringify(payload))) : ''
    if (encoded) url.searchParams.set('mc', encoded)
    return url.toString()
  }

  const handleShareLink = async () => {
    triggerHaptic('light')
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

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window === 'undefined') return
    window.print()
  }

  const calculateWithdrawal = useMemo(() => {
    const {
      startingBalance,
      annualReturn,
      duration,
      periodicWithdrawal,
      inflationAdjustment,
      frequency,
    } = state

    const periods = FREQUENCY_MULTIPLIER[frequency]
    const yearCount = Math.max(0, duration)
    const ratePerPeriod = Math.pow(1 + annualReturn / 100, 1 / periods) - 1
    const inflationFactorPerYear = 1 + inflationAdjustment / 100

    const yearData: YearData[] = []

    let currentBalance = startingBalance
    let currentWithdrawal = periodicWithdrawal
    let yearsUntilZero: number | null = null

    for (let year = 1; year <= yearCount; year++) {
      const startBalance = currentBalance
      let yearWithdrawals = 0

      for (let period = 0; period < periods; period++) {
        if (currentBalance <= 0) {
          currentBalance = 0
          break
        }
        currentBalance = currentBalance * (1 + ratePerPeriod) - currentWithdrawal
        yearWithdrawals += currentWithdrawal
      }

      const isSustainable = currentBalance > 0

      if (!isSustainable && yearsUntilZero === null) {
        yearsUntilZero = year
      }

      yearData.push({
        year,
        startingBalance: Math.max(0, startBalance),
        withdrawals: yearWithdrawals,
        endingBalance: Math.max(0, currentBalance),
        isSustainable,
      })

      if (currentBalance <= 0) {
        break
      }
      currentWithdrawal *= inflationFactorPerYear
    }

    const endingBalance = Math.max(0, currentBalance)
    const totalWithdrawn = yearData.reduce((sum, y) => sum + y.withdrawals, 0)
    const isSustainable = endingBalance > 0

    return {
      endingBalance,
      totalWithdrawn,
      isSustainable,
      yearsUntilZero,
      yearData,
    }
  }, [state])

  const handleExportExcel = () => {
    triggerHaptic('light')
    if (!calculateWithdrawal?.yearData || calculateWithdrawal.yearData.length === 0) return

    const summaryRows = [
        { Key: 'Mode', Value: 'Withdrawal (Deterministic)' },
        { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
        { Key: 'Annual Return %', Value: state.annualReturn },
        { Key: 'Duration Years', Value: state.duration },
        { Key: 'Withdrawal Amount', Value: roundToCents(state.periodicWithdrawal) },
        { Key: 'Inflation Adj %', Value: state.inflationAdjustment },
        { Key: 'Frequency', Value: state.frequency },
        { Key: 'Ending Balance', Value: roundToCents(calculateWithdrawal.endingBalance) },
        { Key: 'Total Withdrawn', Value: roundToCents(calculateWithdrawal.totalWithdrawn) },
        { Key: 'Sustainable', Value: calculateWithdrawal.isSustainable ? 'Yes' : 'No' },
      ]
  
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
      ;(wsSummary as any)['!cols'] = [{ wch: 20 }, { wch: 20 }]

    const excelData = calculateWithdrawal.yearData.map(row => ({
      Year: row.year,
      'Starting Balance': roundToCents(row.startingBalance),
      'Withdrawals': roundToCents(row.withdrawals),
      'Ending Balance': roundToCents(row.endingBalance),
      'Sustainable': row.isSustainable ? 'Yes' : 'No',
    }))

    const wsData = XLSX.utils.json_to_sheet(excelData)
    ;(wsData as any)['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsData, 'Balance By Year')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-withdrawal-deterministic-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }

  const sustainabilityColor = calculateWithdrawal?.isSustainable
    ? 'text-emerald-500'
    : 'text-destructive'

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold">Plan Your Retirement Spending</h2>
        <p className="text-muted-foreground">
          Calculate how long your portfolio can sustain regular withdrawals
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0 }}
      >
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Dices className="h-4 w-4 text-violet-500" />
                <Label className="text-base font-semibold">
                  Monte Carlo Simulation
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Model portfolio sustainability with randomized scenarios
              </p>
            </div>
            <Switch
              checked={useMonteCarloMode}
              onCheckedChange={setUseMonteCarloMode}
            />
          </div>
        </CardContent>
      </Card>
      </motion.div>
      
      {useMonteCarloMode ? (
        <MonteCarloSimulator mode="withdrawal" initialValues={state} />
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                Withdrawal Parameters
              </CardTitle>
              <CardDescription>
                Configure your retirement spending plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starting-balance-w">
                    Starting Balance ($)
                  </Label>
                  <NumericInput
                    id="starting-balance-w"
                    value={state?.startingBalance ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      if (!isFinite(n)) {
                        setState({ ...state, startingBalance: 0 })
                        return
                      }
                      // Currency clamp
                      if (n !== 0 && Math.abs(n) < 0.01) n = 0.01
                      
                      const limited = Number(n.toFixed(2))
                      setState({ ...state, startingBalance: limited })
                    }}
                    min={0}
                    max={1_000_000_000_000_000_000}
                    maxErrorMessage="The Fed wants its printer back :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annual-return-w">
                    Annual Return (%)
                  </Label>
                  <NumericInput
                    id="annual-return-w"
                    step={0.1}
                    value={state?.annualReturn ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      if (!isFinite(n)) {
                         setState({ ...state, annualReturn: 0 })
                         return
                      }
                      // Rate clamp
                      const MIN_ABS = 0.000001
                      if (n !== 0 && Math.abs(n) < MIN_ABS) {
                        n = MIN_ABS * Math.sign(n)
                      }
                      const limited = Number(n.toFixed(6))
                      setState({ ...state, annualReturn: limited })
                    }}
                    min={-100}
                    max={100000}
                    maxErrorMessage="Even Medallion doesn't pull returns like that :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration-w">Duration (Years)</Label>
                  <NumericInput
                    id="duration-w"
                    value={state?.duration ?? 0}
                    onChange={(value) =>
                      setState({ ...state, duration: Math.max(1, Math.floor(value)) })
                    }
                    min={1}
                    max={200}
                    maxErrorMessage="Planning for the next two centuries? :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodic-withdrawal">
                    Withdrawal Amount ($)
                  </Label>
                  <NumericInput
                    id="periodic-withdrawal"
                    value={state?.periodicWithdrawal ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      if (!isFinite(n)) n = 0
                      if (n < 0) n = 0
                      // Currency clamp
                      if (n !== 0 && n < 0.01) n = 0.01
                      
                      const limited = Number(n.toFixed(2))
                      setState({ ...state, periodicWithdrawal: limited })
                    }}
                    min={0}
                    max={1_000_000_000_000_000_000}
                    maxErrorMessage="Speedrunning bankruptcy? :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inflation">
                    Inflation Adjustment (%)
                  </Label>
                  <NumericInput
                    id="inflation"
                    step={0.1}
                    value={state?.inflationAdjustment ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      if (!isFinite(n)) {
                        setState({ ...state, inflationAdjustment: 0 })
                        return
                      }
                      // Rate clamp
                      const MIN_ABS = 0.000001
                      if (n !== 0 && Math.abs(n) < MIN_ABS) {
                        n = MIN_ABS * Math.sign(n)
                      }
                      const limited = Number(n.toFixed(6))
                      setState({ ...state, inflationAdjustment: limited })
                    }}
                    min={-50}
                    max={100}
                    maxErrorMessage="Your grocery bill just fainted :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency-w">Withdrawal Frequency</Label>
                  <Select
                    value={state?.frequency ?? 'monthly'}
                    onValueChange={(value: any) =>
                      setState({ ...state, frequency: value })
                    }
                  >
                    <SelectTrigger id="frequency-w">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>
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
				boxShadow: calculateWithdrawal?.isSustainable
				  ? '0 0 30px rgba(16,185,129,0.25)'
				  : '0 0 30px rgba(239,68,68,0.25)',
			  }}
			  whileHover={{ y: -6, scale: 1.02 }}
			  whileTap={{ scale: 0.98 }}
			  transition={{ duration: 0.45, ease: 'easeOut' }}
			>
			  <Card
				className={`border-2 ${
				  calculateWithdrawal?.isSustainable
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
					  {calculateWithdrawal?.isSustainable ? (
						<CheckCircle2 className="h-8 w-8 text-emerald-500" />
					  ) : (
						<AlertTriangle className="h-8 w-8 text-destructive" />
					  )}
					</motion.div>

					<div className="flex-1">
					  <h3 className={`text-lg font-bold ${sustainabilityColor}`}>
						{calculateWithdrawal?.isSustainable
						  ? 'Sustainable Plan'
						  : 'Unsustainable Plan'}
					  </h3>
					  <p className="text-sm text-muted-foreground">
						{calculateWithdrawal?.isSustainable
						  ? `Your portfolio can sustain withdrawals for the full ${state?.duration} years`
						  : `Your portfolio will be depleted in approximately ${calculateWithdrawal?.yearsUntilZero} years`}
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
                    <span>Share</span>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <motion.div
                  key={calculateWithdrawal?.endingBalance}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`rounded-lg p-4 space-y-1 ${
                    calculateWithdrawal?.isSustainable
                      ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
                      : 'bg-gradient-to-br from-destructive/10 to-destructive/5'
                  }`}
                >
                  <p className="text-xs text-muted-foreground">
                    Ending Balance
                  </p>
                  <p
                    className={`text-lg sm:text-xl md:text-2xl font-bold ${sustainabilityColor} break-words leading-tight`}
                  >
                    {renderFormattedResult(calculateWithdrawal?.endingBalance)}
                  </p>
                </motion.div>
                <motion.div
                  key={calculateWithdrawal?.totalWithdrawn}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">
                    Total Withdrawn
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-500 break-words leading-tight">
                    {renderFormattedResult(calculateWithdrawal?.totalWithdrawn)}
                  </p>
                </motion.div>
                <motion.div
                  key={calculateWithdrawal?.yearsUntilZero}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">
                    Portfolio Lasts
                  </p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-500 break-words leading-tight">
                    {calculateWithdrawal?.yearsUntilZero ??
                      state?.duration}
                    + years
                  </p>
                </motion.div>
              </div>
            </CardContent>
          </Card>
          </motion.div>
          <WithdrawalChart data={calculateWithdrawal?.yearData ?? []} />

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Balance By Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="border-b">
                        <th className="p-3 text-left text-sm font-semibold">
                          Year
                        </th>
                        <th className="p-3 text-right text-sm font-semibold">
                          Starting Balance
                        </th>
                        <th className="p-3 text-right text-sm font-semibold">
                          Withdrawals
                        </th>
                        <th className="p-3 text-right text-sm font-semibold">
                          Ending Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculateWithdrawal?.yearData?.map?.(
                        (row, idx) => (
                          <motion.tr
                            key={row?.year}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0 }}
                            className={`border-b hover:bg-muted/50 transition-colors ${
                              !row?.isSustainable
                                ? 'bg-destructive/5'
                                : ''
                            }`}
                          >
                            <td className="p-3 text-sm font-medium">
                              {row?.year}
                              {!row?.isSustainable && (
                                <XCircle className="inline-block ml-2 h-4 w-4 text-destructive" />
                              )}
                            </td>
                            <td className="p-3 text-sm text-right">
                              $
                              {row?.startingBalance?.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 0 },
                              ) ?? '0'}
                            </td>
                            <td className="p-3 text-sm text-right text-muted-foreground">
                              $
                              {row?.withdrawals?.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 0 },
                              ) ?? '0'}
                            </td>
                            <td
                              className={`p-3 text-sm text-right font-semibold ${
                                row?.isSustainable
                                  ? 'text-primary'
                                  : 'text-destructive'
                              }`}
                            >
                              $
                              {row?.endingBalance?.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 0 },
                              ) ?? '0'}
                            </td>
                          </motion.tr>
                        ),
                      ) ?? []}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </>
      )}

      <DonationSection />
    </div>
  )
}