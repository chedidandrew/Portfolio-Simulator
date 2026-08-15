import type { CashflowFrequency } from '@/lib/types'

interface FinancialHorizonInput {
  years: number
  periods?: number | null
  frequency?: CashflowFrequency
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`
}

export function formatFinancialHorizon({ years, periods, frequency }: FinancialHorizonInput): string {
  if (!Number.isFinite(years) || years < 0) return 'Unknown'
  if (years === 0 && periods == null) return 'now'

  if (frequency === 'weekly' && periods != null && periods > 0 && periods < 8) {
    return plural(Math.round(periods), 'week')
  }

  let totalMonths: number
  if (periods != null && periods >= 0 && frequency) {
    if (frequency === 'monthly') totalMonths = periods
    else if (frequency === 'quarterly') totalMonths = periods * 3
    else if (frequency === 'yearly') totalMonths = periods * 12
    else totalMonths = (periods / 52) * 12
  } else {
    totalMonths = years * 12
  }

  const roundedMonths = Math.max(0, Math.round(totalMonths))
  if (roundedMonths < 12) return plural(Math.max(1, roundedMonths), 'month')

  const wholeYears = Math.floor(roundedMonths / 12)
  const remainingMonths = roundedMonths % 12
  if (remainingMonths === 0) return plural(wholeYears, 'year')
  return `${plural(wholeYears, 'year')}, ${plural(remainingMonths, 'month')}`
}
