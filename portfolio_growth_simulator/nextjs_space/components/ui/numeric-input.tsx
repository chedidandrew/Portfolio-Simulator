'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string
  onChange: (value: number) => void
  onEmpty?: () => void
  allowEmpty?: boolean
  min?: number
  max?: number
  step?: number
  maxErrorMessage?: string
  className?: string
}

const displayFromValue = (value: number | string) => {
  if (value === '') return ''
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? String(numeric) : ''
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({
    value,
    onChange,
    onEmpty,
    allowEmpty = false,
    min = 0,
    max,
    step = 1,
    maxErrorMessage,
    className,
    id,
    'aria-describedby': ariaDescribedBy,
    ...props
  }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => displayFromValue(value))
    const [isFocused, setIsFocused] = React.useState(false)
    const [showError, setShowError] = React.useState(false)
    const [lastValidValue, setLastValidValue] = React.useState<number>(() => {
      const numeric = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(numeric) ? numeric : 0
    })
    const permitsEmpty = allowEmpty || Boolean(props.placeholder)
    const errorId = id && maxErrorMessage ? `${id}-error` : undefined
    const describedBy = [ariaDescribedBy, showError ? errorId : undefined].filter(Boolean).join(' ') || undefined

    React.useEffect(() => {
      if (isFocused) return
      const nextDisplay = displayFromValue(value)
      setDisplayValue(nextDisplay)
      if (nextDisplay !== '') {
        const numeric = Number(nextDisplay)
        if (Number.isFinite(numeric)) setLastValidValue(numeric)
      }
    }, [value, isFocused])

    const handleFocus = () => {
      setIsFocused(true)
      setShowError(false)
      setDisplayValue(displayFromValue(value))
    }

    const handleBlur = () => {
      setIsFocused(false)
      setShowError(false)

      if (displayValue === '') {
        if (permitsEmpty) {
          if (onEmpty) onEmpty()
          else onChange(Number.NaN)
          return
        }
        setDisplayValue(lastValidValue.toString())
        onChange(lastValidValue)
        return
      }

      let numericValue = Number(displayValue)
      if (!Number.isFinite(numericValue)) {
        setDisplayValue(lastValidValue.toString())
        onChange(lastValidValue)
        return
      }

      if (min !== undefined && numericValue < min) numericValue = min
      if (max !== undefined && numericValue > max) {
        setDisplayValue(lastValidValue.toString())
        onChange(lastValidValue)
        return
      }

      setLastValidValue(numericValue)
      setDisplayValue(numericValue.toString())
      onChange(numericValue)
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = event.target.value
      if (inputValue.includes(',')) return
      if (inputValue === '') {
        setDisplayValue('')
        setShowError(false)
        return
      }

      const validPattern = /^-?\d*\.?\d*$/
      if (!validPattern.test(inputValue)) return

      setDisplayValue(inputValue)
      const numericValue = Number(inputValue)
      setShowError(Number.isFinite(numericValue) && max !== undefined && numericValue > max)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === ',') event.preventDefault()
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy}
          className={cn(
            showError && 'border-amber-500 focus-visible:ring-amber-500',
            className,
          )}
          {...props}
        />
        {showError && maxErrorMessage && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="absolute -bottom-5 left-0 text-xs text-amber-600 dark:text-amber-500 animate-in fade-in slide-in-from-top-1"
          >
            {maxErrorMessage}
          </p>
        )}
      </div>
    )
  },
)

NumericInput.displayName = 'NumericInput'
