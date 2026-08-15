import ExcelJS from 'exceljs'
import type { WithdrawalState } from '@/lib/types'
import type { WithdrawalProjectionResult } from '@/lib/simulation/withdrawal-engine'
import { roundToCents } from '@/lib/utils'
import { formatFinancialWorkbook } from './excel-formatting'

export type ExportCell = string | number
export type ExportRow = Record<string, ExportCell>

export function buildWithdrawalWorkbook(
  state: WithdrawalState,
  calculation: WithdrawalProjectionResult,
  currencySymbol = '$',
  currencyCode = 'USD',
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const wsSummary = workbook.addWorksheet('Summary')
  wsSummary.columns = [
    { header: 'Key', key: 'Key', width: 28 },
    { header: 'Value', key: 'Value', width: 38 },
  ]

  const summaryRows: ExportRow[] = [
    { Key: 'Mode', Value: 'Withdrawal (Deterministic)' },
    { Key: 'Display Currency', Value: currencyCode },
    { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
    { Key: 'Annual Return %', Value: state.annualReturn },
    { Key: 'Duration Years', Value: state.duration },
    { Key: 'Withdrawal Amount (Gross)', Value: roundToCents(state.periodicWithdrawal) },
    { Key: 'Inflation Adjustment %', Value: state.inflationAdjustment },
    { Key: 'Frequency', Value: state.frequency },
    { Key: 'Ending Balance (Spendable)', Value: roundToCents(calculation.endingBalance) },
    { Key: 'Ending Balance (Gross)', Value: roundToCents(calculation.endingBalanceGross) },
    { Key: "Ending Balance (Today's Dollars)", Value: roundToCents(calculation.endingBalanceInTodaysDollars) },
    { Key: 'Total Real Consumption', Value: roundToCents(calculation.totalWithdrawnInTodaysDollars) },
    { Key: 'Total Withdrawn (Gross)', Value: roundToCents(calculation.totalWithdrawn) },
    { Key: 'Total Market Growth', Value: roundToCents(calculation.totalMarketGrowth) },
    { Key: 'Sustainable', Value: calculation.isSustainable ? 'Yes' : 'No' },
  ]

  if (state.taxEnabled) {
    const taxTypeLabel = state.taxType === 'income'
      ? 'Annual income tax drag'
      : state.taxType === 'tax_deferred'
        ? 'Tax deferred (401k/IRA), taxed on withdrawal'
        : 'Taxable Account (capital gains on liquidation)'
    summaryRows.push(
      { Key: 'Tax Enabled', Value: 'Yes' },
      { Key: 'Tax Rate %', Value: state.taxRate ?? 0 },
      { Key: 'Tax Type', Value: taxTypeLabel },
      { Key: 'Starting Cost Basis', Value: roundToCents(state.startingCostBasis ?? state.startingBalance) },
      { Key: 'Remaining Cost Basis', Value: roundToCents(calculation.endingCostBasis) },
      { Key: 'Total Withdrawal Tax', Value: roundToCents(calculation.totalTaxWithheld) },
      { Key: 'Total Return Tax Drag', Value: roundToCents(calculation.totalTaxDrag) },
      { Key: 'Total Tax (Combined)', Value: roundToCents(calculation.totalTaxPaid) },
      { Key: 'Total Withdrawn (After Tax)', Value: roundToCents(calculation.totalWithdrawnNet) },
      { Key: 'Remaining Embedded Tax', Value: roundToCents(calculation.remainingEmbeddedTax) },
    )
  }
  wsSummary.addRows(summaryRows)

  const wsData = workbook.addWorksheet('Balance By Year')
  const showBasis = Boolean(state.taxEnabled && state.taxType === 'capital_gains')
  wsData.columns = [
    { header: 'Year', key: 'Year', width: 10 },
    { header: 'Starting Balance (Spendable)', key: 'Starting Balance (Spendable)', width: 24 },
    ...(state.taxEnabled ? [{ header: 'Starting Balance (Gross)', key: 'Starting Balance (Gross)', width: 22 }] : []),
    { header: 'Withdrawals (Gross)', key: 'Withdrawals (Gross)', width: 20 },
    { header: 'After-Tax Spending', key: 'After-Tax Spending', width: 20 },
    ...(state.taxEnabled ? [
      { header: 'Withdrawal Tax', key: 'Withdrawal Tax', width: 18 },
      { header: 'Return Tax Drag', key: 'Return Tax Drag', width: 18 },
      { header: 'Tax (Total)', key: 'Tax (Total)', width: 18 },
    ] : []),
    { header: 'Market Growth', key: 'Market Growth', width: 20 },
    ...(showBasis ? [{ header: 'Ending Cost Basis', key: 'Ending Cost Basis', width: 20 }] : []),
    { header: 'Ending Balance (Spendable)', key: 'Ending Balance (Spendable)', width: 24 },
    ...(state.taxEnabled ? [{ header: 'Ending Balance (Gross)', key: 'Ending Balance (Gross)', width: 22 }] : []),
    { header: 'Sustainable', key: 'Sustainable', width: 15 },
  ]

  const rows: ExportRow[] = calculation.yearData.map((row) => ({
    Year: row.year,
    'Starting Balance (Spendable)': roundToCents(row.startingBalanceNet),
    ...(state.taxEnabled ? { 'Starting Balance (Gross)': roundToCents(row.grossStartingBalance) } : {}),
    'Withdrawals (Gross)': roundToCents(row.withdrawals),
    'After-Tax Spending': roundToCents(row.netIncome),
    ...(state.taxEnabled ? {
      'Withdrawal Tax': roundToCents(row.taxWithheld),
      'Return Tax Drag': roundToCents(row.taxDrag),
      'Tax (Total)': roundToCents(row.taxPaid),
    } : {}),
    'Market Growth': roundToCents(row.marketGrowth),
    ...(showBasis ? { 'Ending Cost Basis': roundToCents(row.endingCostBasis) } : {}),
    'Ending Balance (Spendable)': roundToCents(row.endingBalanceNet),
    ...(state.taxEnabled ? { 'Ending Balance (Gross)': roundToCents(row.grossEndingBalance) } : {}),
    Sustainable: row.isSustainable ? 'Yes' : 'No',
  }))

  rows.push({
    Year: 'Total',
    'Withdrawals (Gross)': roundToCents(calculation.totalWithdrawn),
    'After-Tax Spending': roundToCents(calculation.totalWithdrawnNet),
    ...(state.taxEnabled ? {
      'Withdrawal Tax': roundToCents(calculation.totalTaxWithheld),
      'Return Tax Drag': roundToCents(calculation.totalTaxDrag),
      'Tax (Total)': roundToCents(calculation.totalTaxPaid),
    } : {}),
    'Market Growth': roundToCents(calculation.totalMarketGrowth),
  })
  wsData.addRows(rows)

  formatFinancialWorkbook(workbook, currencySymbol)
  return workbook
}
