import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Rounds a number to 2 decimal places (cents) for Excel export
 * Uses Number.EPSILON to ensure accurate rounding for floating point numbers
 */
export function roundToCents(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Format a number as currency with human-readable suffixes (k, M, B, T, etc.)
 * @param value - The number to format
 * @param showDollarSign - Whether to prepend $ (default: true)
 * @param decimals - Number of decimal places (default: 2 for suffixes, 0 for < 1000)
 * @param compact - Whether to use compact notation like 1.5M (default: true)
 */
export function formatCurrency(
  value: number | undefined | null,
  showDollarSign: boolean = true,
  decimals: number = 2,
  compact: boolean = true
): string {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return showDollarSign ? '$0' : '0'
  }

  const absValue = Math.abs(value)
  
  if (compact) {
    // Ordered from largest to smallest
    const units = [
      { value: 1e33, suffix: 'De' }, // Decillion
      { value: 1e30, suffix: 'No' }, // Nonillion
      { value: 1e27, suffix: 'Oc' }, // Octillion
      { value: 1e24, suffix: 'Sp' }, // Septillion
      { value: 1e21, suffix: 'Sx' }, // Sextillion
      { value: 1e18, suffix: 'Qi' }, // Quintillion
      { value: 1e15, suffix: 'Q' },  // Quadrillion
      { value: 1e12, suffix: 'T' },  // Trillion
      { value: 1e9,  suffix: 'B' },  // Billion
      { value: 1e6,  suffix: 'M' },  // Million
      { value: 1e3,  suffix: 'k' },  // Thousand
    ]

    for (const unit of units) {
      if (absValue >= unit.value) {
        const sign = value < 0 ? '-' : ''
        const dollarSign = showDollarSign ? '$' : ''
        return `${sign}${dollarSign}${(absValue / unit.value).toFixed(decimals)}${unit.suffix}`
      }
    }
  }

  // Fallback to standard formatting (full precision or small numbers)
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    // If we are strictly not compact, we generally want 2 decimals. 
    // If we are compact but falling through (< 1000), we stick to 0 unless specified.
    maximumFractionDigits: compact ? 0 : 2, 
    minimumFractionDigits: compact ? 0 : 2,
  })
  
  let formatted = formatter.format(value)
  
  if (!showDollarSign) {
      formatted = formatted.replace('$', '')
  }
  
  return formatted
}

/**
 * Formats large integers compactly (e.g. 1.5k, 2M) without currency symbols.
 * Useful for chart axes representing counts/frequency.
 */
export function formatCompactNumber(value: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}