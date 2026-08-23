'use client'

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { CURRENCIES, setAppCurrency } from '@/lib/utils'

type CurrencyContextValue = {
  currency: string
  setCurrency: (currency: string) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setStoredCurrency] = useLocalStorage<string>('portfolio-sim-currency', 'USD')

  useEffect(() => {
    setAppCurrency(currency)
  }, [currency])

  const setCurrency = useCallback((nextCurrency: string) => {
    if (CURRENCIES.some((candidate) => candidate.code === nextCurrency)) {
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
