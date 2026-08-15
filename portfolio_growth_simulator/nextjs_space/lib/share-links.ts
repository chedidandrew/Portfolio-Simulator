import LZString from 'lz-string'
import type { GrowthState, SharePayload, SimulationParams, WithdrawalState } from '@/lib/types'
import { CURRENCIES } from '@/lib/utils'
import {
  MAX_RNG_SEED_LENGTH,
  MAX_SHARE_JSON_LENGTH,
  MAX_SHARE_PAYLOAD_LENGTH,
  isValidGrowthState,
  isValidSimulationParams,
  isValidWithdrawalState,
} from '@/lib/simulation/deterministic-validation'

export const SHARE_PAYLOAD_VERSION = 1
const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code))

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)
const optionalBoolean = (value: unknown): value is boolean | undefined => (
  value === undefined || typeof value === 'boolean'
)

export function validateSharePayload(value: unknown): SharePayload | null {
  if (!isRecord(value)) return null
  if (value.sharePayloadVersion !== undefined && value.sharePayloadVersion !== SHARE_PAYLOAD_VERSION) return null
  if (value.mode !== 'growth' && value.mode !== 'withdrawal') return null
  if (value.type !== 'deterministic' && value.type !== 'monte-carlo') return null

  const deterministicParams = value.deterministicParams ?? value.params
  const validDeterministic = value.mode === 'growth'
    ? isValidGrowthState(deterministicParams)
    : isValidWithdrawalState(deterministicParams)
  if (!validDeterministic) return null
  if (value.type === 'monte-carlo' && !isValidSimulationParams(value.mcParams)) return null
  if (
    value.rngSeed !== undefined
    && value.rngSeed !== null
    && (typeof value.rngSeed !== 'string' || value.rngSeed.length > MAX_RNG_SEED_LENGTH)
  ) return null
  if (!optionalBoolean(value.showFullPrecision)) return null

  if (value.logScales !== undefined) {
    if (
      !isRecord(value.logScales)
      || typeof value.logScales.chart !== 'boolean'
      || typeof value.logScales.histogram !== 'boolean'
      || typeof value.logScales.drawdown !== 'boolean'
    ) return null
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
  if (!text || text.length > MAX_SHARE_JSON_LENGTH) return null
  try {
    return validateSharePayload(JSON.parse(text))
  } catch {
    return null
  }
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  if (!encoded || encoded.length > MAX_SHARE_PAYLOAD_LENGTH) return null

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
  if (compressed.length > MAX_SHARE_PAYLOAD_LENGTH) {
    throw new Error('This scenario is too large to share in a browser link.')
  }
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
