'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowLeftRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import type { SimulationParams } from '@/lib/types'
import type { InvestmentDataPoint } from '@/lib/simulation/monte-carlo-engine'
import { stepsPerYear, toTodaysDollars } from '@/lib/simulation/financial-utils'

interface CashflowChartProps {
  params: SimulationParams
  mode: 'growth' | 'withdrawal'
  investmentData?: InvestmentDataPoint[]
  isRealDollars?: boolean
}

export interface CashflowChartPoint {
  year: number
  nominal?: number
  real?: number
  gross?: number
  spendable?: number
  withdrawalTaxes?: number
  incomeTaxDrag?: number
}

function isFinitePoint(point: CashflowChartPoint): boolean {
  return Object.values(point).every((value) => value === undefined || Number.isFinite(value))
}

export function buildWithdrawalCashflowChartData(
  investmentData: InvestmentDataPoint[],
  isRealDollars: boolean,
): CashflowChartPoint[] {
  return investmentData.map((point) => ({
    year: Number(point.year.toFixed(2)),
    gross: isRealDollars ? point.realWithdrawals : point.withdrawals,
    spendable: isRealDollars
      ? (point.realNetSpending ?? point.realWithdrawals)
      : (point.netSpending ?? point.withdrawals),
    withdrawalTaxes: isRealDollars ? (point.realWithdrawalTaxes ?? 0) : (point.withdrawalTaxes ?? 0),
    incomeTaxDrag: isRealDollars ? (point.realIncomeTaxDrag ?? 0) : (point.incomeTaxDrag ?? 0),
  })).filter(isFinitePoint)
}

export function CashflowChart({
  params,
  mode,
  investmentData = [],
  isRealDollars = false,
}: CashflowChartProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const currencySymbol = getAppCurrency().symbol

  const growthData = useMemo(() => {
    if (mode !== 'growth') return []
    const periods = stepsPerYear(params.cashflowFrequency)
    const totalSteps = Math.max(1, Math.round(params.duration * periods))
    const annualInflator = 1 + (params.inflationAdjustment ?? 0) / 100
    let periodicCashflow = params.cashflowAmount
    const annualRows: CashflowChartPoint[] = []
    let nominalForYear = 0
    let realForYear = 0

    for (let step = 1; step <= totalSteps; step += 1) {
      const yearsElapsed = step / periods
      nominalForYear += periodicCashflow
      realForYear += toTodaysDollars(periodicCashflow, params.inflationAdjustment, yearsElapsed)

      if (step % periods === 0 || step === totalSteps) {
        annualRows.push({ year: Number(yearsElapsed.toFixed(2)), nominal: nominalForYear, real: realForYear })
        nominalForYear = 0
        realForYear = 0
        if (!params.excludeInflationAdjustment && step < totalSteps) periodicCashflow *= annualInflator
      }
    }
    return annualRows
  }, [mode, params])

  const withdrawalData = useMemo(() => {
    if (mode !== 'withdrawal') return []
    return buildWithdrawalCashflowChartData(investmentData, isRealDollars)
  }, [mode, investmentData, isRealDollars])

  const data = mode === 'growth' ? growthData : withdrawalData
  const hasWithdrawalTaxes = withdrawalData.some((row) => (row.withdrawalTaxes ?? 0) > 0.005)
  const hasIncomeTaxDrag = withdrawalData.some((row) => (row.incomeTaxDrag ?? 0) > 0.005)

  return (
    <Card className="print-break-inside-avoid border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="h-4 w-4 text-blue-500" />
          {mode === 'growth' ? 'Annual Contributions' : 'Cumulative Retirement Cashflow Medians'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground" role="status">
            No usable cashflow data is available for this scenario.
          </div>
        ) : (
        <div className="h-64 w-full" data-testid="cashflow-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <XAxis dataKey="year" tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }} />
              <YAxis
                tickLine={false}
                tickFormatter={(value) => formatCurrency(value, true, 0, true)}
                tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#71717a' }}
                width={52}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Year ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
              />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
              {mode === 'growth' && <Line id="nominal-contributions-series" type="linear" dataKey="nominal" name={`Nominal (Future ${currencySymbol})`} stroke="#3b82f6" strokeWidth={2} dot={false} />}
              {mode === 'growth' && <Line id="real-contributions-series" type="linear" dataKey="real" name={`Real (Today's ${currencySymbol})`} stroke="#10b981" strokeWidth={2} dot={false} />}
              {mode === 'withdrawal' && <Line id="gross-withdrawals-series" type="linear" dataKey="gross" name="Gross Withdrawals" stroke="#3b82f6" strokeWidth={2} dot={false} />}
              {mode === 'withdrawal' && <Line id="after-tax-spending-series" type="linear" dataKey="spendable" name="After-Tax Spending" stroke="#10b981" strokeWidth={2} dot={false} />}
              {mode === 'withdrawal' && hasWithdrawalTaxes && <Line id="withdrawal-taxes-series" type="linear" dataKey="withdrawalTaxes" name="Withdrawal Taxes" stroke="#ef4444" strokeWidth={2} dot={false} />}
              {mode === 'withdrawal' && hasIncomeTaxDrag && <Line id="return-tax-drag-series" type="linear" dataKey="incomeTaxDrag" name="Return Tax Drag" stroke="#f59e0b" strokeWidth={2} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {mode === 'growth'
            ? `Blue shows scheduled future contributions. Green discounts each payment to today's ${currencySymbol} purchasing power.`
            : `Gross withdrawals and after-tax spending are displayed as component medians. Withdrawal tax is derived from those displayed values so the cashflow identity reconciles; return tax drag is shown separately. Unfunded scheduled withdrawals are never counted. ${isRealDollars ? `Values are shown in today's ${currencySymbol}.` : 'Values are nominal.'}`}
        </p>
      </CardContent>
    </Card>
  )
}
