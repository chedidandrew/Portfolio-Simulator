import LZString from 'lz-string'
import type {
  CalculationMode,
  CashflowFrequency,
  GrowthState,
  SharePayload,
  SimulationParams,
  TaxType,
  WithdrawalState,
} from '@/lib/types'
import { CURRENCIES } from '@/lib/utils'
import { validateGrowthStateRange, validateWithdrawalStateRange } from '@/lib/simulation/deterministic-validation'
import { assertMonteCarloWorkload, stepsPerYear } from '@/lib/simulation/financial-utils'

export const SHARE_PAYLOAD_VERSION = 1
const FREQUENCIES: CashflowFrequency[] = ['yearly', 'quarterly', 'monthly', 'weekly']
const TAX_TYPES: TaxType[] = ['capital_gains', 'income', 'tax_deferred']
const CALCULATION_MODES: CalculationMode[] = ['effective', 'nominal']
const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code))

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const optionalFinite = (value: unknown) => value === undefined || isFiniteNumber(value)
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean'
const isFrequency = (value: unknown): value is CashflowFrequency => FREQUENCIES.includes(value as CashflowFrequency)
const isTaxType = (value: unknown): value is TaxType => TAX_TYPES.includes(value as TaxType)
const isCalculationMode = (value: unknown): value is CalculationMode => CALCULATION_MODES.includes(value as CalculationMode)

function hasValidTaxSettings(value: Record<string, unknown>): boolean {
  return optionalBoolean(value.taxEnabled)
    && optionalFinite(value.taxRate)
    && (value.taxRate === undefined || (value.taxRate >= 0 && value.taxRate <= 100))
    && (value.taxType === undefined || isTaxType(value.taxType))
    && (value.calculationMode === undefined || isCalculationMode(value.calculationMode))
    && optionalFinite(value.startingCostBasis)
    && (value.startingCostBasis === undefined || value.startingCostBasis >= 0)
    && optionalBoolean(value.costBasisIsUserEdited)
}

function isGrowthState(value: unknown): value is GrowthState {
  if (!isRecord(value) || !isFiniteNumber(value.startingBalance) || value.startingBalance < 0) return false
  if (!isFiniteNumber(value.annualReturn) || value.annualReturn <= -100) return false
  if (!isFiniteNumber(value.duration) || value.duration <= 0) return false
  if (!isFiniteNumber(value.periodicAddition) || value.periodicAddition < 0) return false
  if (!isFrequency(value.frequency) || !isFiniteNumber(value.inflationAdjustment)) return false
  if (!optionalFinite(value.targetValue) || (value.targetValue !== undefined && value.targetValue < 0)) return false
  if (!optionalBoolean(value.excludeInflationAdjustment) || !hasValidTaxSettings(value)) return false
  try {
    return validateGrowthStateRange(value as unknown as GrowthState) === null
  } catch {
    return false
  }
}

function isWithdrawalState(value: unknown): value is WithdrawalState {
  if (!isRecord(value) || !isFiniteNumber(value.startingBalance) || value.startingBalance < 0) return false
  if (!isFiniteNumber(value.annualReturn) || value.annualReturn <= -100) return false
  if (!isFiniteNumber(value.duration) || value.duration <= 0) return false
  if (!isFiniteNumber(value.periodicWithdrawal) || value.periodicWithdrawal < 0) return false
  if (!isFrequency(value.frequency) || !isFiniteNumber(value.inflationAdjustment)) return false
  if (!optionalBoolean(value.excludeInflationAdjustment) || !hasValidTaxSettings(value)) return false
  try {
    return validateWithdrawalStateRange(value as unknown as WithdrawalState) === null
  } catch {
    return false
  }
}

function isSimulationParams(value: unknown): value is SimulationParams {
  if (!isRecord(value) || !isFiniteNumber(value.initialValue) || value.initialValue < 0) return false
  if (!isFiniteNumber(value.expectedReturn) || value.expectedReturn <= -100) return false
  if (!isFiniteNumber(value.volatility) || value.volatility < 0) return false
  if (!isFiniteNumber(value.duration) || value.duration <= 0) return false
  if (!isFiniteNumber(value.cashflowAmount) || value.cashflowAmount < 0) return false
  if (!isFrequency(value.cashflowFrequency)) return false
  if (typeof value.numPaths !== 'number' || !Number.isInteger(value.numPaths) || value.numPaths < 1) return false
  if (!optionalFinite(value.inflationAdjustment) || !optionalFinite(value.portfolioGoal)) return false
  if (value.portfolioGoal !== undefined && value.portfolioGoal < 0) return false
  if (!optionalBoolean(value.excludeInflationAdjustment) || !optionalBoolean(value.enableCrashRisk)) return false
  if (!hasValidTaxSettings(value)) return false
  try {
    assertMonteCarloWorkload(value.numPaths as number, value.duration as number, stepsPerYear(value.cashflowFrequency as CashflowFrequency))
    return true
  } catch {
    return false
  }
}

export function validateSharePayload(value: unknown): SharePayload | null {
  if (!isRecord(value)) return null
  if (value.sharePayloadVersion !== undefined && value.sharePayloadVersion !== SHARE_PAYLOAD_VERSION) return null
  if (value.mode !== 'growth' && value.mode !== 'withdrawal') return null
  if (value.type !== 'deterministic' && value.type !== 'monte-carlo') return null

  const deterministicParams = value.deterministicParams ?? value.params
  const validDeterministic = value.mode === 'growth'
    ? isGrowthState(deterministicParams)
    : isWithdrawalState(deterministicParams)
  if (!validDeterministic) return null
  if (value.type === 'monte-carlo' && !isSimulationParams(value.mcParams)) return null
  if (value.rngSeed !== undefined && value.rngSeed !== null && (typeof value.rngSeed !== 'string' || value.rngSeed.length > 500)) return null
  if (!optionalBoolean(value.showFullPrecision)) return null

  if (value.logScales !== undefined) {
    if (!isRecord(value.logScales)
      || typeof value.logScales.chart !== 'boolean'
      || typeof value.logScales.histogram !== 'boolean'
      || typeof value.logScales.drawdown !== 'boolean') return null
  }

  const displayCurrency = typeof value.displayCurrency === 'string' && CURRENCY_CODES.has(value.displayCurrency)
    ? value.displayCurrency
    : undefined

  return {
    sharePayloadVersion: value.sharePayloadVersion as number | undefined,
    mode: value.mode,
    type: value.type,
    deterministicParams: deterministicParams as GrowthState | WithdrawalState,
    ...(value.params ? { params: deterministicParams as GrowthState | WithdrawalState } : {}),
    ...(value.type === 'monte-carlo' ? { mcParams: value.mcParams as SimulationParams } : {}),
    ...(value.rngSeed !== undefined ? { rngSeed: value.rngSeed as string | null } : {}),
    ...(typeof value.showFullPrecision === 'boolean' ? { showFullPrecision: value.showFullPrecision } : {}),
    ...(value.logScales ? { logScales: value.logScales as SharePayload['logScales'] } : {}),
    ...(displayCurrency ? { displayCurrency } : {}),
  }
}

function parsePayloadText(text: string | null): SharePayload | null {
  if (!text) return null
  try {
    return validateSharePayload(JSON.parse(text))
  } catch {
    return null
  }
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  const compressed = parsePayloadText(LZString.decompressFromEncodedURIComponent(encoded))
  if (compressed) return compressed

  try {
    return parsePayloadText(decodeURIComponent(atob(encoded)))
  } catch {
    return null
  }
}

export function readSharePayload(location: Pick<Location, 'hash' | 'search'>): { payload: SharePayload | null; hadShareData: boolean } {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  const hashValue = new URLSearchParams(hash).get('mc')
  const queryValue = new URLSearchParams(location.search).get('mc')
  const encoded = hashValue ?? queryValue
  return { payload: encoded ? decodeSharePayload(encoded) : null, hadShareData: encoded !== null }
}

export function buildShareUrl(href: string, payload: SharePayload, displayCurrency: string): string {
  const url = new URL(href)
  const versionedPayload: SharePayload = {
    ...payload,
    sharePayloadVersion: SHARE_PAYLOAD_VERSION,
    displayCurrency: CURRENCY_CODES.has(displayCurrency) ? displayCurrency : 'USD',
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(versionedPayload))
  url.searchParams.delete('mc')
  url.hash = new URLSearchParams({ mc: compressed }).toString()
  return url.toString()
}

export function cleanShareDataFromUrl(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('mc')
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  hash.delete('mc')
  url.hash = hash.toString()
  return `${url.pathname}${url.search}${url.hash}`
}
