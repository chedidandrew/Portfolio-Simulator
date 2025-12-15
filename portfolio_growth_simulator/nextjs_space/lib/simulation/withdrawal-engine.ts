import { WithdrawalState } from '@/lib/types'

export interface WithdrawalProjectionResult {
  endingBalance: number
  endingBalanceInTodaysDollars: number
  totalWithdrawn: number
  totalWithdrawnInTodaysDollars: number
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

export function calculateWithdrawalProjection(state: WithdrawalState): WithdrawalProjectionResult {
  const {
    startingBalance,
    annualReturn,
    duration,
    periodicWithdrawal,
    inflationAdjustment,
    frequency,
    excludeInflationAdjustment // <--- Destructure this
  } = state

  // --- 1. Engine Configuration ---
  const totalMonths = duration * 12
  const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1
  const inflationFactor = 1 + inflationAdjustment / 100

  // --- 2. Simulation State ---
  let currentBalance = startingBalance
  let currentPeriodicWithdrawal = periodicWithdrawal
  
  let yearsUntilZero: number | null = null
  let totalWithdrawn = 0
  let totalWithdrawnInTodaysDollars = 0

  const yearData = []
  let yearStartBalance = startingBalance
  let yearWithdrawals = 0

  // --- 3. Run Simulation ---
  for (let month = 1; month <= totalMonths; month++) {
    // A. Apply Growth
    if (currentBalance > 0) {
      currentBalance = currentBalance * (1 + monthlyRate)
    }

    // B. Determine Withdrawal Amount
    let withdrawalThisMonth = 0
    if (frequency === 'monthly') withdrawalThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'quarterly' && month % 3 === 0) withdrawalThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'yearly' && month % 12 === 0) withdrawalThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'weekly') withdrawalThisMonth = (currentPeriodicWithdrawal * 52) / 12

    // C. Execute Withdrawal
    if (withdrawalThisMonth > 0) {
      const actualWithdrawal = Math.min(currentBalance, withdrawalThisMonth)
      currentBalance -= actualWithdrawal
      totalWithdrawn += actualWithdrawal
      yearWithdrawals += actualWithdrawal

      // Real Value Calculation (Always applies, regardless of strategy)
      const discountFactor = Math.pow(inflationFactor, month / 12)
      totalWithdrawnInTodaysDollars += (actualWithdrawal / discountFactor)
    }

    // Check for depletion
    if (currentBalance <= 0.01 && yearsUntilZero === null) {
      currentBalance = 0
      yearsUntilZero = parseFloat((month / 12).toFixed(1))
    }

    // D. End of Year Processing
    if (month % 12 === 0) {
      yearData.push({
        year: month / 12,
        startingBalance: yearStartBalance,
        withdrawals: yearWithdrawals,
        endingBalance: Math.max(0, currentBalance),
        isSustainable: currentBalance > 0,
      })

      yearStartBalance = currentBalance
      yearWithdrawals = 0

      // E. Apply Inflation to Withdrawal Amount (CONDITIONAL)
      // Only increase the monthly withdrawal amount if the user wants to keep up with inflation.
      if (!excludeInflationAdjustment) {
        currentPeriodicWithdrawal *= inflationFactor
      }
    }
  }

  const endingBalance = Math.max(0, currentBalance)
  const isSustainable = endingBalance > 0
  
  // Real Value of Legacy (Always applies)
  const endingBalanceInTodaysDollars = endingBalance / Math.pow(inflationFactor, duration)

  return {
    endingBalance,
    endingBalanceInTodaysDollars,
    totalWithdrawn,
    totalWithdrawnInTodaysDollars,
    isSustainable,
    yearsUntilZero,
    yearData,
  }
}