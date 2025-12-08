'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  maxErrorMessage?: string
  className?: string
}

export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, min = 0, max, step = 1, maxErrorMessage, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('')
    const [isFocused, setIsFocused] = React.useState(false)
    const [showError, setShowError] = React.useState(false)
    const [lastValidValue, setLastValidValue] = React.useState<number>(0)

    // Initialize display value from prop value
    React.useEffect(() => {
      if (!isFocused) {
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
        setDisplayValue(numValue.toString())
        setLastValidValue(numValue)
      }
    }, [value, isFocused])

    const handleFocus = () => {
      setIsFocused(true)
      setShowError(false)
      // Show raw number without formatting when focused
      const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
      setDisplayValue(numValue.toString())
    }

    const handleBlur = () => {
      setIsFocused(false)
      setShowError(false)
      
      // Parse and validate on blur
      let numValue = parseFloat(displayValue)
      
      // Handle empty or invalid input
      if (displayValue === '' || isNaN(numValue)) {
        numValue = lastValidValue
        setDisplayValue(lastValidValue.toString())
        onChange(lastValidValue)
        return
      }
      
      // Clamp to min/max
      if (min !== undefined && numValue < min) {
        numValue = min
      }
      if (max !== undefined && numValue > max) {
        numValue = lastValidValue // Revert to last valid value
        setDisplayValue(lastValidValue.toString())
        onChange(lastValidValue)
        return
      }
      
      setLastValidValue(numValue)
      setDisplayValue(numValue.toString())
      onChange(numValue)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value
      
      // Ignore comma inputs - preserve existing value
      if (inputValue.includes(',')) {
        return
      }
      
      // Allow empty string (for clearing)
      if (inputValue === '') {
        setDisplayValue('')
        return
      }
      
      // Allow valid numeric input including decimals and negative sign
      // Only allow digits, one decimal point, and leading minus sign
      const validPattern = /^-?\d*\.?\d*$/
      if (!validPattern.test(inputValue)) {
        return
      }
      
      setDisplayValue(inputValue)
      
      // Try to parse and validate against max
      const numValue = parseFloat(inputValue)
      if (!isNaN(numValue) && max !== undefined && numValue > max) {
        setShowError(true)
      } else {
        setShowError(false)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent comma key
      if (e.key === ',') {
        e.preventDefault()
        return
      }
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            showError && 'border-amber-500 focus-visible:ring-amber-500',
            className
          )}
          {...props}
        />
        {showError && maxErrorMessage && (
          <p className="absolute -bottom-5 left-0 text-xs text-amber-600 dark:text-amber-500 animate-in fade-in slide-in-from-top-1">
            {maxErrorMessage}
          </p>
        )}
      </div>
    )
  }
)

NumericInput.displayName = 'NumericInput'
