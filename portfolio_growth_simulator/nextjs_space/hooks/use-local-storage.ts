'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface LocalStorageOptions<T> {
  normalize?: (value: T, persistedValue: unknown | null) => T
  shouldPersist?: (value: T) => boolean
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
  const normalizeValue = useCallback(
    (value: T, persistedValue: unknown | null) =>
      normalizeRef.current ? normalizeRef.current(value, persistedValue) : value,
    [],
  )
  const [storedValue, setStoredValue] = useState<T>(() => normalizeValue(initialValue, null))
  
  // Use a ref to hold initialValue to avoid dependency loops in useEffect
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
      setStoredValue(normalized)
      if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
        try {
          window.localStorage.setItem(key, JSON.stringify(normalized))
        } catch {
          // Normalized state remains usable in memory.
        }
      }
    }

    // Initial load
    loadValue()

    // Listen for changes
    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      if ((e as StorageEvent).key === key || (e as CustomEvent).detail?.key === key) {
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

  // FIX: Wrap setValue in useCallback to ensure the function reference remains stable.
  // This prevents infinite render loops in child components that depend on 'setState'.
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
