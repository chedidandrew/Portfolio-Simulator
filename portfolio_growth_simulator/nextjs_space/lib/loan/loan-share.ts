import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { getLoanValidationErrors, type LoanInputs, type LoanLumpSum } from './loan-engine'

const LOAN_SHARE_VERSION = 1
const MAX_LUMP_SUMS = 24
const MAX_COMPRESSED_LENGTH = 8_000

export interface LoanSharePayload {
  v: 1
  loan: LoanInputs
  displayCurrency?: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseLumpSums(value: unknown): LoanLumpSum[] | null {
  if (!Array.isArray(value) || value.length > MAX_LUMP_SUMS) return null

  const parsed: LoanLumpSum[] = []
  for (const item of value) {
    if (!isPlainObject(item)) return null
    if (typeof item.id !== 'string' || item.id.length > 80) return null
    if (typeof item.month !== 'string' || item.month.length !== 7) return null
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount)) return null
    parsed.push({ id: item.id, month: item.month, amount: item.amount })
  }
  return parsed
}

export function parseLoanSharePayload(value: unknown): LoanSharePayload | null {
  if (!isPlainObject(value) || value.v !== LOAN_SHARE_VERSION || !isPlainObject(value.loan)) return null

  const lumpSums = parseLumpSums(value.loan.lumpSums)
  if (!lumpSums) return null

  const loan: LoanInputs = {
    principal: value.loan.principal as number,
    apr: value.loan.apr as number,
    termMonths: value.loan.termMonths as number,
    firstPaymentMonth: value.loan.firstPaymentMonth as string,
    extraMonthlyPayment: value.loan.extraMonthlyPayment as number,
    lumpSums,
  }

  if (getLoanValidationErrors(loan).length > 0) return null

  const displayCurrency = typeof value.displayCurrency === 'string' && value.displayCurrency.length <= 8
    ? value.displayCurrency
    : undefined

  return { v: LOAN_SHARE_VERSION, loan, displayCurrency }
}

export function buildLoanShareUrl(inputs: LoanInputs, displayCurrency: string, currentHref: string): string {
  const payload: LoanSharePayload = { v: LOAN_SHARE_VERSION, loan: inputs, displayCurrency }
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload))
  const url = new URL(currentHref)
  url.pathname = '/loan'
  url.search = ''
  url.hash = `loan=${encoded}`
  return url.toString()
}

export function readLoanSharePayload(locationLike: Pick<Location, 'hash'>): LoanSharePayload | null {
  const prefix = '#loan='
  if (!locationLike.hash.startsWith(prefix)) return null
  const encoded = locationLike.hash.slice(prefix.length)
  if (!encoded || encoded.length > MAX_COMPRESSED_LENGTH) return null

  try {
    const decompressed = decompressFromEncodedURIComponent(encoded)
    if (!decompressed) return null
    return parseLoanSharePayload(JSON.parse(decompressed))
  } catch {
    return null
  }
}
