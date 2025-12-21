import { WithdrawalState } from '@/lib/types'

export interface WithdrawalProjectionResult {
  endingBalance: number
  endingBalanceInTodaysDollars: number
  totalWithdrawn: number
  totalWithdrawnNet: number // After tax
  totalTaxPaid: number
  totalWithdrawnInTodaysDollars: number
  isSustainable: boolean
  yearsUntilZero: number | null
  yearData: Array<{
    year: number
    startingBalance: number
    withdrawals: number
    netIncome: number // New: what user actually got
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
    excludeInflationAdjustment,
    taxEnabled,
    taxRate = 0
  } = state

  // --- 1. Engine Configuration ---
  const totalMonths = duration * 12
  const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1
  const inflationFactor = 1 + inflationAdjustment / 100

  // --- 2. Simulation State ---
  let currentBalance = startingBalance
  let currentPeriodicWithdrawal = periodicWithdrawal // This is TARGET NET
  
  let yearsUntilZero: number | null = null
  let totalWithdrawn = 0
  let totalWithdrawnNet = 0
  let totalTaxPaid = 0
  let totalWithdrawnInTodaysDollars = 0

  const yearData = []
  let yearStartBalance = startingBalance
  let yearWithdrawals = 0
  let yearNetIncome = 0

  // --- 3. Run Simulation ---
  for (let month = 1; month <= totalMonths; month++) {
    
    // --- STEP 1: Determine Withdrawal ---
    let targetNetThisMonth = 0
    if (frequency === 'monthly') targetNetThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'quarterly' && month % 3 === 0) targetNetThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'yearly' && month % 12 === 0) targetNetThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'weekly') targetNetThisMonth = (currentPeriodicWithdrawal * 52) / 12

    // Execute Withdrawal
    if (targetNetThisMonth > 0) {
      // GROSS UP Logic: Gross = Net / (1 - Rate)
      let requiredGross = targetNetThisMonth
      
      if (taxEnabled) {
         // EDGE CASE SAFETY: Clamp tax rate to 99% max to prevent divide-by-zero or infinity.
         // This ensures we never divide by less than 0.01.
         let t = taxRate / 100
         if (t >= 0.99) t = 0.99 
         
         requiredGross = targetNetThisMonth / (1 - t)
      }

      // The portfolio pays the Gross amount (or whatever is left)
      const actualGrossWithdrawal = Math.min(currentBalance, requiredGross)
      
      // Calculate actual Tax paid on this gross amount
      // (If partial withdrawal, tax is proportional)
      let taxPaid = 0
      if (taxEnabled) {
        // We use the original rate for calculation, effectively clamped by the logic above 
        // if it was extreme, but here we just apply the rate to the gross.
        // Consistency: If t was clamped to 99% for gross-up, we should nominally 
        // apply that same effective tax logic here to match 'Net'.
        let t = taxRate / 100
        if (t >= 0.99) t = 0.99
        taxPaid = actualGrossWithdrawal * t
      }
      
      const actualNetReceived = actualGrossWithdrawal - taxPaid

      currentBalance -= actualGrossWithdrawal
      
      totalWithdrawn += actualGrossWithdrawal
      totalWithdrawnNet += actualNetReceived
      totalTaxPaid += taxPaid
      
      yearWithdrawals += actualGrossWithdrawal
      yearNetIncome += actualNetReceived

      // Real Value Calculation
      const discountFactor = Math.pow(inflationFactor, month / 12)
      totalWithdrawnInTodaysDollars += (actualNetReceived / discountFactor)
    }

    // --- STEP 2: Apply Growth ---
    if (currentBalance > 0) {
      currentBalance = currentBalance * (1 + monthlyRate)
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
        netIncome: yearNetIncome,
        endingBalance: Math.max(0, currentBalance),
        isSustainable: currentBalance > 0,
      })

      yearStartBalance = currentBalance
      yearWithdrawals = 0
      yearNetIncome = 0

      // E. Apply Inflation
      if (!excludeInflationAdjustment) {
        currentPeriodicWithdrawal *= inflationFactor
      }
    }
  }

  const endingBalance = Math.max(0, currentBalance)
  const isSustainable = endingBalance > 0
  const endingBalanceInTodaysDollars = endingBalance / Math.pow(inflationFactor, duration)

  return {
    endingBalance,
    endingBalanceInTodaysDollars,
    totalWithdrawn,
    totalWithdrawnNet,
    totalTaxPaid,
    totalWithdrawnInTodaysDollars,
    isSustainable,
    yearsUntilZero,
    yearData,
  }
}