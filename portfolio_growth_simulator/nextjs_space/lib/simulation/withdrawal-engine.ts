import { WithdrawalState } from '@/lib/types'

export interface WithdrawalProjectionResult {
  endingBalance: number
  totalWithdrawn: number
  isSustainable: boolean
  yearsUntilZero: number | null
  yearData: Array<{
    year: number
    startingBalance: number
    withdrawals: number
    endingBalance: number
    isSustainable: boolean
  }>
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
}

export function calculateWithdrawalProjection(state: WithdrawalState): WithdrawalProjectionResult {
  const {
    startingBalance,
    annualReturn,
    duration,
    periodicWithdrawal,
    inflationAdjustment,
    frequency,
  } = state

  const periods = FREQUENCY_MULTIPLIER[frequency] || 12
  const yearCount = Math.max(0, duration)
  // Rate per period: (1 + r)^(1/n) - 1
  const ratePerPeriod = Math.pow(1 + annualReturn / 100, 1 / periods) - 1
  const inflationFactorPerYear = 1 + inflationAdjustment / 100

  const yearData = []

  let currentBalance = startingBalance
  let currentWithdrawal = periodicWithdrawal
  let yearsUntilZero: number | null = null

  for (let year = 1; year <= yearCount; year++) {
    const startBalance = currentBalance
    let yearWithdrawals = 0

    for (let period = 0; period < periods; period++) {
      if (currentBalance <= 0) {
        currentBalance = 0
        break
      }
      currentBalance = currentBalance * (1 + ratePerPeriod) - currentWithdrawal
      yearWithdrawals += currentWithdrawal
    }

    const isSustainable = currentBalance > 0

    if (!isSustainable && yearsUntilZero === null) {
      yearsUntilZero = year
    }

    yearData.push({
      year,
      startingBalance: Math.max(0, startBalance),
      withdrawals: yearWithdrawals,
      endingBalance: Math.max(0, currentBalance),
      isSustainable,
    })

    if (currentBalance <= 0) {
      break
    }
    
    // Increase withdrawal amount for next year by inflation
    currentWithdrawal *= inflationFactorPerYear
  }

  const endingBalance = Math.max(0, currentBalance)
  const totalWithdrawn = yearData.reduce((sum, y) => sum + y.withdrawals, 0)
  const isSustainable = endingBalance > 0

  return {
    endingBalance,
    totalWithdrawn,
    isSustainable,
    yearsUntilZero,
    yearData,
  }
}