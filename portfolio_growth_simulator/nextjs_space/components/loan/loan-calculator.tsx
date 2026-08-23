'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  Gauge,
  Landmark,
  List,
  Moon,
  Plus,
  Printer,
  RotateCcw,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  WalletCards,
} from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyPickerDialog } from '@/components/currency-picker-dialog'
import { useCurrency } from '@/components/currency-provider'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import {
  addMonths,
  compareLoanPlans,
  getLoanValidationErrors,
  summarizeLoanByYear,
  type LoanInputs,
  type LoanLumpSum,
} from '@/lib/loan/loan-engine'
import {
  buildLoanShareUrl,
  cleanLoanShareDataFromUrl,
  readLoanSharePayload,
} from '@/lib/loan/loan-share'

const STORAGE_KEY = 'portfolio-sim-loan-state'

function nextUtcMonth(): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function defaultLoanInputs(): LoanInputs {
  return {
    principal: 350_000,
    apr: 6.5,
    termMonths: 360,
    firstPaymentMonth: nextUtcMonth(),
    extraMonthlyPayment: 0,
    lumpSums: [],
  }
}

function isPersistedLoanInputs(value: unknown): value is LoanInputs {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.principal !== 'number'
    || typeof candidate.apr !== 'number'
    || typeof candidate.termMonths !== 'number'
    || typeof candidate.firstPaymentMonth !== 'string'
    || typeof candidate.extraMonthlyPayment !== 'number'
    || !Array.isArray(candidate.lumpSums)
    || candidate.lumpSums.length > 24
  ) return false

  const seenIds = new Set<string>()
  for (const item of candidate.lumpSums) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false
    const payment = item as Record<string, unknown>
    if (
      typeof payment.id !== 'string'
      || payment.id.length === 0
      || payment.id.length > 80
      || seenIds.has(payment.id)
      || typeof payment.month !== 'string'
      || typeof payment.amount !== 'number'
    ) return false
    seenIds.add(payment.id)
  }

  return getLoanValidationErrors(candidate as unknown as LoanInputs).length === 0
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1, 1))
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatMonthsSaved(months: number): string {
  if (months <= 0) return 'No change'
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (years === 0) return `${remainder} ${remainder === 1 ? 'month' : 'months'}`
  if (remainder === 0) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years} ${years === 1 ? 'year' : 'years'} ${remainder} ${remainder === 1 ? 'month' : 'months'}`
}

function numberValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function LoanCalculator() {
  const { currency, setCurrency } = useCurrency()
  const { resolvedTheme, setTheme } = useTheme()
  const defaults = useMemo(() => defaultLoanInputs(), [])
  const [inputs, setInputs] = useLocalStorage<LoanInputs>(STORAGE_KEY, defaults, {
    validatePersisted: isPersistedLoanInputs,
  })
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [showMonthlySchedule, setShowMonthlySchedule] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash.startsWith('#loan=')) return
    const shared = readLoanSharePayload(window.location)
    const cleanUrl = cleanLoanShareDataFromUrl(window.location.href)

    if (!shared) {
      window.setTimeout(() => toast.error('This shared loan scenario could not be loaded.'), 50)
      window.history.replaceState(null, '', cleanUrl)
      return
    }

    setInputs(shared.loan)
    if (shared.displayCurrency) setCurrency(shared.displayCurrency)
    window.history.replaceState(null, '', cleanUrl)
  }, [setCurrency, setInputs])

  const validationErrors = useMemo(() => getLoanValidationErrors(inputs), [inputs])
  const comparison = useMemo(() => {
    if (validationErrors.length > 0) return null
    try {
      return compareLoanPlans(inputs)
    } catch {
      return null
    }
  }, [inputs, validationErrors])

  const yearlySummary = useMemo(
    () => comparison ? summarizeLoanByYear(comparison.accelerated.schedule) : [],
    [comparison],
  )

  const hasAcceleration = inputs.extraMonthlyPayment > 0 || inputs.lumpSums.length > 0
  const currencySymbol = getAppCurrency().symbol
  const lastScheduledMonth = useMemo(() => {
    if (!Number.isInteger(inputs.termMonths) || inputs.termMonths < 1 || inputs.termMonths > 600) return undefined
    try {
      return addMonths(inputs.firstPaymentMonth, inputs.termMonths - 1)
    } catch {
      return undefined
    }
  }, [inputs.firstPaymentMonth, inputs.termMonths])

  const unappliedLumpSums = useMemo(() => {
    if (!comparison) return []
    return inputs.lumpSums.filter((payment) => payment.month > comparison.accelerated.payoffMonth)
  }, [comparison, inputs.lumpSums])

  const chartData = useMemo(() => {
    if (!comparison) return []
    return comparison.baseline.schedule.map((baseline, index) => ({
      payment: baseline.paymentNumber,
      baseline: baseline.endingBalance,
      accelerated: comparison.accelerated.schedule[index]?.endingBalance ?? 0,
    }))
  }, [comparison])

  const updateInput = <K extends keyof LoanInputs>(key: K, value: LoanInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }))
  }

  const addLumpSum = () => {
    if (inputs.lumpSums.length >= 24 || !lastScheduledMonth) return
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `payment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const payment: LoanLumpSum = {
      id,
      month: addMonths(inputs.firstPaymentMonth, Math.min(12, Math.max(0, inputs.termMonths - 1))),
      amount: 5_000,
    }
    updateInput('lumpSums', [...inputs.lumpSums, payment])
  }

  const updateLumpSum = (id: string, patch: Partial<LoanLumpSum>) => {
    updateInput('lumpSums', inputs.lumpSums.map((payment) => payment.id === id ? { ...payment, ...patch } : payment))
  }

  const removeLumpSum = (id: string) => {
    updateInput('lumpSums', inputs.lumpSums.filter((payment) => payment.id !== id))
  }

  const handleShare = async () => {
    if (typeof window === 'undefined' || !comparison) return

    let url: string
    try {
      url = buildLoanShareUrl(inputs, currency, window.location.href)
    } catch {
      toast.error('This scenario is too large to share in a browser link.')
      return
    }

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Loan & Amortization Calculator', url })
        return
      } catch (error: unknown) {
        const name = error instanceof DOMException || error instanceof Error ? error.name : undefined
        if (name === 'AbortError') return
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        toast.success('Loan link copied')
        return
      }
      toast('Copy not supported on this browser')
    } catch {
      toast.error('Could not share or copy this scenario.')
    }
  }

  const handleExcelExport = async () => {
    if (!comparison) return
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Portfolio Simulator'
      workbook.created = new Date()

      const summary = workbook.addWorksheet('Summary')
      summary.columns = [{ width: 32 }, { width: 24 }]
      summary.addRows([
        ['Loan & Amortization Calculator'],
        ['Display Currency', currency],
        ['Loan Amount', inputs.principal],
        ['APR (%)', inputs.apr],
        ['Term (months)', inputs.termMonths],
        ['First Payment Month', inputs.firstPaymentMonth],
        ['Required Monthly Payment', comparison.baseline.scheduledPayment],
        ['Extra Monthly Payment', inputs.extraMonthlyPayment],
        ['Scheduled Total Interest', comparison.baseline.totalInterest],
        ['Accelerated Total Interest', comparison.accelerated.totalInterest],
        ['Accelerated Total Paid', comparison.accelerated.totalPaid],
        ['Accelerated Payoff Month', comparison.accelerated.payoffMonth],
        ['Interest Saved', comparison.interestSaved],
        ['Months Saved', comparison.monthsSaved],
      ])
      summary.getRow(1).font = { bold: true, size: 16 }
      const moneyLabels = new Set([
        'Loan Amount',
        'Required Monthly Payment',
        'Extra Monthly Payment',
        'Scheduled Total Interest',
        'Accelerated Total Interest',
        'Accelerated Total Paid',
        'Interest Saved',
      ])
      for (let rowNumber = 2; rowNumber <= summary.rowCount; rowNumber += 1) {
        if (moneyLabels.has(String(summary.getCell(`A${rowNumber}`).value ?? ''))) {
          summary.getCell(`B${rowNumber}`).numFmt = '#,##0.00'
        }
      }

      if (inputs.lumpSums.length > 0) {
        const extraPayments = workbook.addWorksheet('Extra Payments')
        extraPayments.columns = [
          { header: 'Month', key: 'month', width: 16 },
          { header: 'Requested Extra Principal', key: 'amount', width: 28 },
        ]
        extraPayments.getRow(1).font = { bold: true }
        extraPayments.addRows(
          [...inputs.lumpSums]
            .sort((a, b) => a.month.localeCompare(b.month))
            .map((payment) => ({ month: payment.month, amount: payment.amount })),
        )
        extraPayments.getColumn(2).numFmt = '#,##0.00'
        extraPayments.views = [{ state: 'frozen', ySplit: 1 }]
      }

      const scheduleSheet = workbook.addWorksheet('Amortization')
      scheduleSheet.columns = [
        { header: '#', key: 'paymentNumber', width: 8 },
        { header: 'Month', key: 'month', width: 14 },
        { header: 'Starting Balance', key: 'startingBalance', width: 20 },
        { header: 'Scheduled Payment', key: 'scheduledPayment', width: 20 },
        { header: 'Scheduled Principal', key: 'principal', width: 20 },
        { header: 'Interest', key: 'interest', width: 18 },
        { header: 'Extra Principal', key: 'extraPrincipal', width: 18 },
        { header: 'Total Payment', key: 'totalPayment', width: 18 },
        { header: 'Ending Balance', key: 'endingBalance', width: 20 },
      ]
      scheduleSheet.getRow(1).font = { bold: true }
      scheduleSheet.addRows(comparison.accelerated.schedule)
      for (let column = 3; column <= 9; column += 1) scheduleSheet.getColumn(column).numFmt = '#,##0.00'
      scheduleSheet.views = [{ state: 'frozen', ySplit: 1 }]

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `loan-amortization-${new Date().toISOString().slice(0, 10)}.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Excel export could not be created.')
    }
  }

  const reset = () => {
    setInputs(defaultLoanInputs())
    setShowMonthlySchedule(false)
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#loan=')) {
      window.history.replaceState(null, '', cleanLoanShareDataFromUrl(window.location.href))
    }
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 print:bg-white">
      <header className="border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Portfolio Simulator home">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 shadow-sm">
              <Image src="/favicon.svg" alt="" width={24} height={24} className="rounded-md" priority />
            </div>
            <span className="hidden truncate text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent sm:inline">
              Portfolio Simulator
            </span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
              {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrencyOpen(true)} aria-label={`Display currency: ${currency}`}>
              {currency}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/" aria-label="Back to Portfolio Simulator">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Simulator</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <CurrencyPickerDialog
        open={currencyOpen}
        value={currency}
        onOpenChange={setCurrencyOpen}
        onValueChange={setCurrency}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-16 sm:py-8 print:max-w-none print:p-0">
        <section className="space-y-3 print:mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary print:hidden">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Loan & Amortization Calculator</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              See what a fixed-rate loan really costs, then test how extra payments change your interest and payoff date.
            </p>
          </div>
        </section>

        {comparison && (
          <div className="hidden print:block">
            <LoanAssumptions inputs={inputs} currency={currency} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="h-fit print:hidden">
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
              <CardDescription>Start with the required loan terms, then add payoff accelerators only if you want them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Loan amount" htmlFor="loan-principal" suffix={currencySymbol}>
                  <Input
                    id="loan-principal"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="1000000000"
                    step="1000"
                    value={inputs.principal}
                    onChange={(event) => updateInput('principal', numberValue(event.target.value))}
                  />
                </Field>
                <Field label="APR" htmlFor="loan-apr" suffix="%">
                  <Input
                    id="loan-apr"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={inputs.apr}
                    onChange={(event) => updateInput('apr', numberValue(event.target.value))}
                  />
                </Field>
                <Field label="Loan term" htmlFor="loan-term" suffix="years">
                  <Input
                    id="loan-term"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="50"
                    step="0.5"
                    value={inputs.termMonths / 12}
                    onChange={(event) => updateInput('termMonths', Math.round(numberValue(event.target.value) * 12))}
                  />
                </Field>
                <Field label="First payment month" htmlFor="loan-start-month">
                  <Input
                    id="loan-start-month"
                    type="month"
                    value={inputs.firstPaymentMonth}
                    onChange={(event) => updateInput('firstPaymentMonth', event.target.value)}
                  />
                </Field>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Accelerate payoff</p>
                    <p className="text-xs text-muted-foreground">Optional. Extra principal is applied after each scheduled payment.</p>
                  </div>
                </div>
                <Field label="Extra every month" htmlFor="loan-extra-monthly" suffix={currencySymbol}>
                  <Input
                    id="loan-extra-monthly"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1000000000"
                    step="50"
                    value={inputs.extraMonthlyPayment}
                    onChange={(event) => updateInput('extraMonthlyPayment', numberValue(event.target.value))}
                  />
                </Field>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">One-time principal payments</p>
                      <p className="text-xs text-muted-foreground">Bonuses, windfalls, or other lump sums.</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addLumpSum} disabled={inputs.lumpSums.length >= 24 || !lastScheduledMonth}>
                      <Plus className="mr-1.5 h-4 w-4" /> Add
                    </Button>
                  </div>

                  {inputs.lumpSums.map((payment) => (
                    <div key={payment.id} className="grid gap-2 rounded-lg border bg-background/60 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:border-0 sm:bg-transparent sm:p-0">
                      <Field label="Month" htmlFor={`loan-lump-month-${payment.id}`}>
                        <Input
                          id={`loan-lump-month-${payment.id}`}
                          type="month"
                          min={inputs.firstPaymentMonth}
                          max={lastScheduledMonth}
                          value={payment.month}
                          onChange={(event) => updateLumpSum(payment.id, { month: event.target.value })}
                        />
                      </Field>
                      <Field label="Amount" htmlFor={`loan-lump-amount-${payment.id}`} suffix={currencySymbol}>
                        <Input
                          id={`loan-lump-amount-${payment.id}`}
                          type="number"
                          inputMode="decimal"
                          min="1"
                          max="1000000000"
                          step="100"
                          value={payment.amount}
                          onChange={(event) => updateLumpSum(payment.id, { amount: numberValue(event.target.value) })}
                        />
                      </Field>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="justify-self-end sm:justify-self-auto"
                        aria-label="Remove one-time payment"
                        onClick={() => removeLumpSum(payment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {unappliedLumpSums.length > 0 && (
                    <div role="status" className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span>
                        {unappliedLumpSums.length === 1 ? 'One payment occurs' : `${unappliedLumpSums.length} payments occur`} after the projected accelerated payoff date and will not be applied unless the payoff plan changes.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {validationErrors[0]}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {comparison ? (
              <>
                <Card className="border-primary/20 print-section">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardDescription>Required monthly payment</CardDescription>
                        <CardTitle className="mt-1 text-4xl tracking-tight text-primary sm:text-5xl">
                          {formatCurrency(comparison.baseline.scheduledPayment, true, 2, false)}
                        </CardTitle>
                        {inputs.extraMonthlyPayment > 0 && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Planned recurring outflow with extra principal: <strong className="text-foreground">{formatCurrency(comparison.baseline.scheduledPayment + inputs.extraMonthlyPayment, true, 2, false)}</strong>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 print:hidden">
                        <Button type="button" variant="outline" size="sm" onClick={handleShare}>
                          <Share2 className="mr-2 h-4 w-4" /> Share
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleExcelExport}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                          <Printer className="mr-2 h-4 w-4" /> Print / PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <Metric icon={Gauge} label="Total interest" value={formatCurrency(comparison.accelerated.totalInterest, true, 2, false)} />
                      <Metric icon={WalletCards} label="Total paid" value={formatCurrency(comparison.accelerated.totalPaid, true, 2, false)} />
                      <Metric icon={CalendarDays} label="Payoff" value={formatMonth(comparison.accelerated.payoffMonth)} />
                      <Metric icon={Clock3} label="Payments" value={comparison.accelerated.paymentCount.toLocaleString()} />
                    </div>
                  </CardContent>
                </Card>

                {hasAcceleration && (
                  <Card className="overflow-hidden border-emerald-500/25 print-section">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-emerald-500" />
                        Extra Payment Impact
                      </CardTitle>
                      <CardDescription>Compared with making only the required scheduled payment.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl bg-emerald-500/10 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interest saved</p>
                          <p className="mt-1 text-3xl font-bold text-emerald-500">{formatCurrency(comparison.interestSaved, true, 2, false)}</p>
                        </div>
                        <div className="rounded-xl bg-primary/10 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Paid off sooner</p>
                          <p className="mt-1 text-3xl font-bold text-primary">{formatMonthsSaved(comparison.monthsSaved)}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <PlanSummary
                          title="Scheduled plan"
                          payoff={comparison.baseline.payoffMonth}
                          interest={comparison.baseline.totalInterest}
                        />
                        <PlanSummary
                          title="Your accelerated plan"
                          payoff={comparison.accelerated.payoffMonth}
                          interest={comparison.accelerated.totalInterest}
                          emphasized
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Enter valid loan details to calculate the amortization schedule.
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {comparison && (
          <>
            <Card className="print-section">
              <CardHeader>
                <CardTitle>Remaining Balance</CardTitle>
                <CardDescription>{hasAcceleration ? 'Compare the scheduled payoff path with your accelerated plan.' : 'See how principal declines over the life of the loan.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px] w-full" data-testid="loan-balance-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis
                        dataKey="payment"
                        minTickGap={28}
                        tickFormatter={(value) => `${Math.max(1, Math.ceil(Number(value) / 12))}y`}
                      />
                      <YAxis width={76} tickFormatter={(value) => formatCurrency(Number(value), true, 0, true)} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [formatCurrency(value, true, 2, false), name === 'baseline' ? 'Scheduled' : 'Accelerated']}
                        labelFormatter={(value) => `Payment ${value}`}
                      />
                      {hasAcceleration && <Legend formatter={(value) => value === 'baseline' ? 'Scheduled' : 'Accelerated'} />}
                      <Line type="monotone" dataKey="baseline" dot={false} stroke="hsl(var(--muted-foreground))" strokeWidth={2} />
                      {hasAcceleration && <Line type="monotone" dataKey="accelerated" dot={false} stroke="hsl(var(--primary))" strokeWidth={2.5} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="print-section">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Amortization Schedule</CardTitle>
                    <CardDescription>Yearly summary by default, with the full payment-by-payment schedule available when needed.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="print:hidden"
                    onClick={() => setShowMonthlySchedule((current) => !current)}
                  >
                    <List className="mr-2 h-4 w-4" />
                    {showMonthlySchedule ? 'Show yearly summary' : 'View full monthly schedule'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {showMonthlySchedule ? (
                    <table className="w-full min-w-[860px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <TableHead>#</TableHead><TableHead>Month</TableHead><TableHead>Starting Balance</TableHead><TableHead>Payment</TableHead><TableHead>Scheduled Principal</TableHead><TableHead>Interest</TableHead><TableHead>Extra</TableHead><TableHead>Ending Balance</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.accelerated.schedule.map((payment) => (
                          <tr key={payment.paymentNumber} className="border-b last:border-0">
                            <TableCell>{payment.paymentNumber}</TableCell>
                            <TableCell>{formatMonth(payment.month)}</TableCell>
                            <MoneyCell value={payment.startingBalance} />
                            <MoneyCell value={payment.totalPayment} />
                            <MoneyCell value={payment.principal} />
                            <MoneyCell value={payment.interest} />
                            <MoneyCell value={payment.extraPrincipal} />
                            <MoneyCell value={payment.endingBalance} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full min-w-[780px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <TableHead>Year</TableHead><TableHead>Starting Balance</TableHead><TableHead>Total Payments</TableHead><TableHead>Scheduled Principal</TableHead><TableHead>Interest</TableHead><TableHead>Extra Principal</TableHead><TableHead>Ending Balance</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {yearlySummary.map((year) => (
                          <tr key={year.year} className="border-b last:border-0">
                            <TableCell className="font-medium">{year.year}</TableCell>
                            <MoneyCell value={year.startingBalance} />
                            <MoneyCell value={year.totalPayments} />
                            <MoneyCell value={year.principal} />
                            <MoneyCell value={year.interest} />
                            <MoneyCell value={year.extraPrincipal} />
                            <MoneyCell value={year.endingBalance} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-muted-foreground print:hidden">
          Fixed-rate educational model. It does not include taxes, insurance, PMI, HOA fees, origination fees, points, escrow, variable rates, or lender-specific daily-interest conventions. See <Link href="/methodology/loan" className="underline underline-offset-4 hover:text-foreground">Loan Methodology</Link> for assumptions.
        </p>
      </main>
    </div>
  )
}

function LoanAssumptions({ inputs, currency }: { inputs: LoanInputs; currency: string }) {
  return (
    <Card className="print-section">
      <CardHeader className="pb-3">
        <CardTitle>Loan Assumptions</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <PrintFact label="Display currency" value={currency} />
          <PrintFact label="Loan amount" value={formatCurrency(inputs.principal, true, 2, false)} />
          <PrintFact label="APR" value={`${inputs.apr}%`} />
          <PrintFact label="Term" value={`${inputs.termMonths} months`} />
          <PrintFact label="First payment" value={formatMonth(inputs.firstPaymentMonth)} />
          <PrintFact label="Extra every month" value={formatCurrency(inputs.extraMonthlyPayment, true, 2, false)} />
        </dl>
        {inputs.lumpSums.length > 0 && (
          <div className="mt-4 border-t pt-3 text-sm">
            <p className="font-medium">One-time principal payments</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {[...inputs.lumpSums]
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((payment) => (
                  <li key={payment.id}>{formatMonth(payment.month)}: {formatCurrency(payment.amount, true, 2, false)}</li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PrintFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  suffix,
  children,
}: {
  label: string
  htmlFor: string
  suffix?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {children}
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/35 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className="break-words text-lg font-semibold leading-tight">{value}</p>
    </div>
  )
}

function PlanSummary({
  title,
  payoff,
  interest,
  emphasized = false,
}: {
  title: string
  payoff: string
  interest: number
  emphasized?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${emphasized ? 'border-primary/30 bg-primary/5' : 'bg-muted/15'}`}>
      <p className="font-medium">{title}</p>
      <dl className="mt-3 space-y-2 text-muted-foreground">
        <div className="flex justify-between gap-4"><dt>Payoff</dt><dd className="text-right text-foreground">{formatMonth(payoff)}</dd></div>
        <div className="flex justify-between gap-4"><dt>Total interest</dt><dd className="text-right text-foreground">{formatCurrency(interest, true, 2, false)}</dd></div>
      </dl>
    </div>
  )
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-3 font-medium">{children}</th>
}

function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-3 ${className}`}>{children}</td>
}

function MoneyCell({ value }: { value: number }) {
  return <TableCell>{formatCurrency(value, true, 2, false)}</TableCell>
}
