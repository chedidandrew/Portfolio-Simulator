'use client'

import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { CURRENCIES, setAppCurrency } from '@/lib/utils'

type CurrencyContextValue = {
  currency: string
  setCurrency: (currency: string) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setStoredCurrency] = useLocalStorage<string>('portfolio-sim-currency', 'USD')

  // formatCurrency/getAppCurrency still use a small module-level bridge. Keep that bridge
  // synchronized before descendants render so the displayed code and formatted symbols
  // can never be one selection behind, including after localStorage hydration.
  setAppCurrency(currency)

  const setCurrency = useCallback((nextCurrency: string) => {
    if (CURRENCIES.some((candidate) => candidate.code === nextCurrency)) {
      // Synchronize immediately for any formatter calls made before React's next render,
      // then persist/update context through the normal state path.
      setAppCurrency(nextCurrency)
      setStoredCurrency(nextCurrency)
    }
  }, [setStoredCurrency])

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used within CurrencyProvider')
  return context
}
