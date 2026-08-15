export const PORTFOLIO_STORAGE_KEYS = new Set([
  'visited',
  'lastTab',
  'theme',
  'growth-mode-state',
  'withdrawal-mode-state',
  'growth-show-monte-carlo',
  'withdrawal-show-monte-carlo',
  'growth-show-full-precision',
  'withdrawal-show-full-precision',
])

const PORTFOLIO_STORAGE_PREFIXES = ['portfolio-sim-', 'mc-']

export interface StorageLike {
  readonly length: number
  key(index: number): string | null
  removeItem(key: string): void
}

export function isPortfolioStorageKey(key: string): boolean {
  return PORTFOLIO_STORAGE_KEYS.has(key)
    || PORTFOLIO_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function clearPortfolioStorage(storage: StorageLike): string[] {
  const removed: string[] = []
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key))

  for (const key of keys) {
    if (!isPortfolioStorageKey(key)) continue
    storage.removeItem(key)
    removed.push(key)
  }

  return removed
}

export function clearSimulatorScenario(storage: StorageLike, mode: 'growth' | 'withdrawal'): void {
  storage.removeItem(`${mode}-mode-state`)
}
