import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { CURRENCIES } from '@/lib/utils'
import { getLoanValidationErrors, type LoanInputs, type LoanLumpSum } from './loan-engine'

const LOAN_SHARE_VERSION = 1
const MAX_LUMP_SUMS = 24
const MAX_COMPRESSED_LENGTH = 8_000
const MAX_DECOMPRESSED_LENGTH = 24_000
const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code))

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
  const seenIds = new Set<string>()

  for (const item of value) {
    if (!isPlainObject(item)) return null
    if (typeof item.id !== 'string' || item.id.length === 0 || item.id.length > 80 || seenIds.has(item.id)) return null
    if (typeof item.month !== 'string' || item.month.length !== 7) return null
    if (typeof item.amount !== 'number' || !Number.isFinite(item.amount)) return null
    seenIds.add(item.id)
    parsed.push({ id: item.id, month: item.month, amount: item.amount })
  }
  return parsed
}

export function parseLoanSharePayload(value: unknown): LoanSharePayload | null {
  if (!isPlainObject(value) || value.v !== LOAN_SHARE_VERSION || !isPlainObject(value.loan)) return null

  const lumpSums = parseLumpSums(value.loan.lumpSums)
  if (!lumpSums) return null
  if (
    typeof value.loan.principal !== 'number'
    || typeof value.loan.apr !== 'number'
    || typeof value.loan.termMonths !== 'number'
    || typeof value.loan.firstPaymentMonth !== 'string'
    || typeof value.loan.extraMonthlyPayment !== 'number'
  ) return null

  const loan: LoanInputs = {
    principal: value.loan.principal,
    apr: value.loan.apr,
    termMonths: value.loan.termMonths,
    firstPaymentMonth: value.loan.firstPaymentMonth,
    extraMonthlyPayment: value.loan.extraMonthlyPayment,
    lumpSums,
  }

  if (getLoanValidationErrors(loan).length > 0) return null

  const displayCurrency = typeof value.displayCurrency === 'string' && CURRENCY_CODES.has(value.displayCurrency)
    ? value.displayCurrency
    : undefined

  return { v: LOAN_SHARE_VERSION, loan, displayCurrency }
}

export function buildLoanShareUrl(inputs: LoanInputs, displayCurrency: string, currentHref: string): string {
  const payload: LoanSharePayload = {
    v: LOAN_SHARE_VERSION,
    loan: inputs,
    displayCurrency: CURRENCY_CODES.has(displayCurrency) ? displayCurrency : 'USD',
  }
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload))
  if (encoded.length > MAX_COMPRESSED_LENGTH) {
    throw new Error('This loan scenario is too large to share in a browser link.')
  }

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
    if (!decompressed || decompressed.length > MAX_DECOMPRESSED_LENGTH) return null
    return parseLoanSharePayload(JSON.parse(decompressed))
  } catch {
    return null
  }
}

export function cleanLoanShareDataFromUrl(href: string): string {
  const url = new URL(href)
  if (url.hash.startsWith('#loan=')) url.hash = ''
  return `${url.pathname}${url.search}${url.hash}`
}
