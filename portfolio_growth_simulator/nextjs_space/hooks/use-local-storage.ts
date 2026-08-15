'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { isValidGrowthState, isValidWithdrawalState } from '@/lib/simulation/deterministic-validation'

interface LocalStorageOptions<T> {
  normalize?: (value: T, persistedValue: unknown | null) => T
  shouldPersist?: (value: T) => boolean
  validatePersisted?: (value: unknown) => value is T
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: LocalStorageOptions<T> = {},
): [T, (value: T | ((val: T) => T)) => void] {
  const normalizeRef = useRef(options.normalize)
  normalizeRef.current = options.normalize
  const shouldPersistRef = useRef(options.shouldPersist)
  shouldPersistRef.current = options.shouldPersist
  const initialRecord = typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue)
    ? initialValue as Record<string, unknown>
    : null
  const defaultValidator = key === 'growth-mode-state' && initialRecord && 'periodicAddition' in initialRecord
    ? isValidGrowthState
    : key === 'withdrawal-mode-state' && initialRecord && 'periodicWithdrawal' in initialRecord
      ? isValidWithdrawalState
      : undefined
  const validatePersistedRef = useRef(options.validatePersisted ?? defaultValidator)
  validatePersistedRef.current = options.validatePersisted ?? defaultValidator

  const normalizeValue = useCallback(
    (value: T, persistedValue: unknown | null) =>
      normalizeRef.current ? normalizeRef.current(value, persistedValue) : value,
    [],
  )
  const [storedValue, setStoredValue] = useState<T>(() => normalizeValue(initialValue, null))
  const initialValueRef = useRef(initialValue)

  useEffect(() => {
    const loadValue = () => {
      if (typeof window === 'undefined') return

      const normalizedDefault = normalizeValue(initialValueRef.current, null)
      let item: string | null
      try {
        item = window.localStorage.getItem(key)
      } catch {
        setStoredValue(normalizedDefault)
        return
      }

      if (item === null) {
        setStoredValue(normalizedDefault)
        try {
          window.localStorage.setItem(key, JSON.stringify(normalizedDefault))
        } catch {
          // Keep the setting in memory when storage is unavailable or full.
        }
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(item)
      } catch {
        try {
          window.localStorage.removeItem(key)
        } catch {
          // Storage may be blocked; the in-memory fallback still recovers.
        }
        setStoredValue(normalizedDefault)
        return
      }

      const initVal = initialValueRef.current
      const merged = (
        typeof initVal === 'object'
        && initVal !== null
        && !Array.isArray(initVal)
        && typeof parsed === 'object'
        && parsed !== null
        && !Array.isArray(parsed)
      ) ? { ...initVal, ...parsed } as T : parsed as T
      const normalized = normalizeValue(merged, parsed)

      if (validatePersistedRef.current && !validatePersistedRef.current(normalized)) {
        try {
          window.localStorage.removeItem(key)
        } catch {
          // Keep the safe default in memory when storage cannot be changed.
        }
        setStoredValue(normalizedDefault)
        return
      }

      setStoredValue(normalized)
      if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
        try {
          window.localStorage.setItem(key, JSON.stringify(normalized))
        } catch {
          // Normalized state remains usable in memory.
        }
      }
    }

    loadValue()

    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      if ((event as StorageEvent).key === key || (event as CustomEvent).detail?.key === key) {
        loadValue()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('local-storage-update', handleStorageChange as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('local-storage-update', handleStorageChange as EventListener)
    }
  }, [key, normalizeValue])

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((currentStoredValue) => {
      const nextValue = value instanceof Function ? value(currentStoredValue) : value
      const valueToStore = normalizeValue(nextValue, nextValue)

      if (
        typeof window !== 'undefined'
        && (!shouldPersistRef.current || shouldPersistRef.current(valueToStore))
      ) {
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
          window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key } }))
        } catch {
          // State updates still succeed in memory if persistence is unavailable.
        }
      }

      return valueToStore
    })
  }, [key, normalizeValue])

  return [storedValue, setValue]
}
