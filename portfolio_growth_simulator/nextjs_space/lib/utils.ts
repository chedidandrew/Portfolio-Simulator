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
 * Format a number as currency with human-readable suffixes (k, M, B, T)
 * @param value - The number to format
 * @param showDollarSign - Whether to prepend $ (default: true)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "$12.35M", "$950k", "$1.2B"
 */
export function formatCurrency(value: number, showDollarSign: boolean = true, decimals: number = 2): string {
  const absValue = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const dollarSign = showDollarSign ? '$' : ''
  
  if (absValue === 0) {
    return `${sign}${dollarSign}0`
  }
  
  if (absValue >= 1_000_000_000_000) {
    // Trillions
    return `${sign}${dollarSign}${(absValue / 1_000_000_000_000).toFixed(decimals)}T`
  } else if (absValue >= 1_000_000_000) {
    // Billions
    return `${sign}${dollarSign}${(absValue / 1_000_000_000).toFixed(decimals)}B`
  } else if (absValue >= 1_000_000) {
    // Millions
    return `${sign}${dollarSign}${(absValue / 1_000_000).toFixed(decimals)}M`
  } else if (absValue >= 1_000) {
    // Thousands
    return `${sign}${dollarSign}${(absValue / 1_000).toFixed(decimals)}k`
  } else {
    // Less than 1000
    return `${sign}${dollarSign}${absValue.toFixed(0)}`
  }
}