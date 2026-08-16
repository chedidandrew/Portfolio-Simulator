'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CURRENCIES } from '@/lib/utils'

interface CurrencyPickerDialogProps {
  open: boolean
  value: string
  onOpenChange: (open: boolean) => void
  onValueChange: (value: string) => void
}

export function CurrencyPickerDialog({
  open,
  value,
  onOpenChange,
  onValueChange,
}: CurrencyPickerDialogProps) {
  const [query, setQuery] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const selectedOptionRef = useRef<HTMLButtonElement>(null)

  const filteredCurrencies = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase()
    if (!normalizedQuery) return CURRENCIES

    return CURRENCIES.filter((candidate) => (
      candidate.code.includes(normalizedQuery)
      || candidate.label.toUpperCase().includes(normalizedQuery)
    ))
  }, [query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    const frame = window.requestAnimationFrame(() => {
      selectedOptionRef.current?.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        tabIndex={-1}
        data-testid="currency-picker-dialog"
        className="flex w-[calc(100vw-1rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl p-0"
        style={{ maxHeight: 'calc(100dvh - 1rem)' }}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          window.requestAnimationFrame(() => contentRef.current?.focus())
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle>Display Currency</DialogTitle>
          <DialogDescription>
            Changes symbols and formatting only. Values are not converted using exchange rates.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0 border-b border-border px-4 py-3">
          <Search
            className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search currency code or symbol"
            aria-label="Search display currencies"
            autoComplete="off"
            className="h-11 pl-10"
          />
        </div>

        <div
          data-testid="currency-picker-list"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          {filteredCurrencies.length > 0 ? (
            <div className="space-y-1">
              {filteredCurrencies.map((candidate) => {
                const selected = candidate.code === value
                return (
                  <button
                    key={candidate.code}
                    ref={selected ? selectedOptionRef : undefined}
                    type="button"
                    data-currency-code={candidate.code}
                    aria-pressed={selected}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      selected
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-transparent hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => {
                      onValueChange(candidate.code)
                      onOpenChange(false)
                    }}
                  >
                    <span className="min-w-0 truncate font-medium">{candidate.label}</span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
              No currencies match that search.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
