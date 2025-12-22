'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isMounted, setIsMounted] = useState(false)
  
  // Use a ref to hold initialValue to avoid dependency loops in useEffect
  const initialValueRef = useRef(initialValue)

  useEffect(() => {
    setIsMounted(true)

    const loadValue = () => {
      try {
        if (typeof window !== 'undefined') {
          const item = window.localStorage.getItem(key)
          if (item) {
            const parsed = JSON.parse(item)
            const initVal = initialValueRef.current
            
            // Merge defaults (initVal) with saved data (parsed) if both are objects
            if (
              typeof initVal === 'object' && 
              initVal !== null && 
              !Array.isArray(initVal) &&
              typeof parsed === 'object' &&
              parsed !== null &&
              !Array.isArray(parsed)
            ) {
              setStoredValue({ ...initVal, ...parsed })
            } else {
              setStoredValue(parsed)
            }
          }
        }
      } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error)
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
  }, [key])

  // FIX: Wrap setValue in useCallback to ensure the function reference remains stable.
  // This prevents infinite render loops in child components that depend on 'setState'.
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Use the functional update form to access the current value without adding
      // 'storedValue' to the dependency array (which would recreate the function).
      setStoredValue((currentStoredValue) => {
        const valueToStore = value instanceof Function ? value(currentStoredValue) : value
        
        // Save to local storage inside the updater to ensure we have the correct new value
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore))
          window.dispatchEvent(new CustomEvent('local-storage-update', { detail: { key } }))
        }
        
        return valueToStore
      })
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error)
    }
  }, [key])

  return [storedValue, setValue]
}