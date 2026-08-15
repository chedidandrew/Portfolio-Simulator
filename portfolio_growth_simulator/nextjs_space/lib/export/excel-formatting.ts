import type { Workbook, Worksheet } from 'exceljs'

const HEADER_FILL = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FF0F766E' },
}

const CURRENCY_TERMS = /balance|value|invested|contribution|withdrawal|spending|tax|profit|cost|basis|income|consumption|portfolio|cashflow|growth|principal|interest|earnings/i
const PERCENT_TERMS = /(^|\s)%|percent|probability|rate|cagr|drawdown|volatility|inflation/i
const DURATION_TERMS = /year|duration/i

function currencyFormat(symbol: string): string {
  const escaped = symbol.replace(/"/g, '""')
  return `"${escaped}"#,##0.00;[Red]("${escaped}"#,##0.00);-`
}

function styleHeader(worksheet: Worksheet): void {
  const header = worksheet.getRow(1)
  header.height = 28
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF0B4F4A' } } }
  })
}

function applySemanticFormats(worksheet: Worksheet, symbol: string): void {
  const headers = worksheet.getRow(1).values as Array<unknown>
  const isSummary = String(headers[1] ?? '').toLowerCase() === 'key'

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.alignment = { vertical: 'middle' }

    row.eachCell((cell, columnNumber) => {
      let semanticLabel = String(headers[columnNumber] ?? '')
      if (isSummary && columnNumber === 2) semanticLabel = String(row.getCell(1).value ?? '')
      if (typeof cell.value !== 'number') {
        cell.alignment = { vertical: 'middle', wrapText: true }
        return
      }
      if (PERCENT_TERMS.test(semanticLabel)) cell.numFmt = '0.00"%"'
      else if (CURRENCY_TERMS.test(semanticLabel)) cell.numFmt = currencyFormat(symbol)
      else if (DURATION_TERMS.test(semanticLabel)) cell.numFmt = '0.00'
      else cell.numFmt = '#,##0.00'
    })
  })
}

export function formatFinancialWorkbook(workbook: Workbook, currencySymbol = '$'): void {
  for (const worksheet of workbook.worksheets) {
    worksheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }]
    styleHeader(worksheet)
    applySemanticFormats(worksheet, currencySymbol)

    worksheet.columns.forEach((column, index) => {
      const minimum = index === 0 ? 12 : 16
      const maximum = worksheet.name === 'Summary' && index === 1 ? 46 : 30
      column.width = Math.min(maximum, Math.max(minimum, column.width ?? minimum))
    })

    if (worksheet.name === 'Summary') {
      worksheet.getColumn(1).width = Math.max(28, worksheet.getColumn(1).width ?? 0)
      worksheet.getColumn(2).width = Math.max(38, worksheet.getColumn(2).width ?? 0)
      worksheet.getColumn(2).alignment = { vertical: 'middle', wrapText: true }
    }

    const lastRow = worksheet.lastRow
    if (lastRow && String(lastRow.getCell(1).value ?? '').toLowerCase() === 'total') {
      lastRow.font = { bold: true }
      lastRow.border = { top: { style: 'double', color: { argb: 'FF0F766E' } } }
    }
  }
}
