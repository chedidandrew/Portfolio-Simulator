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
 */
export function roundToCents(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0
  return Math.round(value * 100) / 100
}

/**
 * Format a number as currency with human-readable suffixes (k, M, B, T)
 * @param value - The number to format
 * @param showDollarSign - Whether to prepend $ (default: true)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "$12.35M", "$950k", "$1.2B"
 */
export function formatCurrency(
  value: number,
  showDollarSign: boolean = true,
  decimals: number = 2
): string {
  if (!Number.isFinite(value)) {
    return showDollarSign ? '$0' : '0'
  }

  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const dollarSign = showDollarSign ? '$' : ''

  if (absValue === 0) {
    return `${sign}${dollarSign}0`
  }

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
      return `${sign}${dollarSign}${(absValue / unit.value).toFixed(decimals)}${unit.suffix}`
    }
  }

  // Less than 1k, show integer dollars
  return `${sign}${dollarSign}${absValue.toFixed(0)}`
}
