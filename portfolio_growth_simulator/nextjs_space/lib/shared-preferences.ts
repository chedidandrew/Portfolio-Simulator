import type { SharePayload } from '@/lib/types'

function writeStorageValue(storage: Pick<Storage, 'setItem'>, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value))

  if (typeof window !== 'undefined' && storage === window.localStorage) {
    window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key } }))
  }
}

export function persistSharedMonteCarloPreferences(
  payload: SharePayload,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  if (payload.type !== 'monte-carlo') return

  if (payload.logScales) {
    writeStorageValue(storage, `mc-log-scales-${payload.mode}`, payload.logScales)
  }

  if (typeof payload.showFullPrecision === 'boolean') {
    writeStorageValue(
      storage,
      `mc-show-full-precision-${payload.mode}`,
      payload.showFullPrecision,
    )
  }
}
