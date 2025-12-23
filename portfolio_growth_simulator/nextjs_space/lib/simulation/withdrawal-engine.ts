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
    taxRate = 0,
    taxType = 'capital_gains',
    calculationMode = 'effective'
  } = state

  // --- 1. Engine Configuration ---
  const totalMonths = duration * 12
  
  // Effective vs Nominal Rate Calculation
  let effectiveAnnualReturn = annualReturn
  if (taxEnabled && taxType === 'income') {
    effectiveAnnualReturn = annualReturn * (1 - (taxRate / 100))
  }

  let monthlyRate
  if (calculationMode === 'nominal') {
    monthlyRate = effectiveAnnualReturn / 100 / 12
  } else {
    monthlyRate = Math.pow(1 + effectiveAnnualReturn / 100, 1 / 12) - 1
  }

  const inflationFactor = 1 + inflationAdjustment / 100

  // --- 2. Simulation State ---
  let currentBalance = startingBalance
  let totalBasis = startingBalance // Track Tax Basis (Assumes initial balance is contribution)
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
      // GROSS UP Logic: Gross = Net / (1 - EffectiveRate)
      // Only apply Gross Up if NOT 'income' type (Income type uses Tax Drag instead)
      let requiredGross = targetNetThisMonth
      
      // Calculate Gain Fraction for Capital Gains tax
      // Proportional Withdrawal: We withdraw a mix of Principal and Gain
      let gainFraction = 0
      if (currentBalance > totalBasis) {
        // Prevent division by zero if balance is extremely low, though likely covered by >0 check
        gainFraction = (currentBalance - totalBasis) / currentBalance
      }
      // Clamp negative gain (loss) to 0 for tax purposes
      if (gainFraction < 0) gainFraction = 0

      let effectiveTaxRate = 0

      if (taxEnabled && taxType !== 'income') {
         // Adjust effective tax rate based on how much of the withdrawal is actually gain
         // Tax = Gross * GainFraction * Rate
         // Net = Gross - Tax = Gross * (1 - GainFraction * Rate)
         // Gross = Net / (1 - GainFraction * Rate)

         effectiveTaxRate = (taxRate / 100) * gainFraction
         
         // EDGE CASE SAFETY: Clamp tax rate to 99% max
         if (effectiveTaxRate >= 0.99) effectiveTaxRate = 0.99 
         
         requiredGross = targetNetThisMonth / (1 - effectiveTaxRate)
      }

      // The portfolio pays the Gross amount (or whatever is left)
      const actualGrossWithdrawal = Math.min(currentBalance, requiredGross)
      
      // Calculate actual Tax paid on this gross amount
      let taxPaid = 0
      if (taxEnabled && taxType !== 'income') {
        // We use the calculated effective rate derived from the gain fraction
        taxPaid = actualGrossWithdrawal * effectiveTaxRate
      }
      
      const actualNetReceived = actualGrossWithdrawal - taxPaid

      // Update Basis: Reduce basis proportionally to the withdrawal size relative to balance
      // If we withdraw 10% of the account, we reduce the basis by 10%
      if (currentBalance > 0) {
        const withdrawalRatio = actualGrossWithdrawal / currentBalance
        totalBasis = totalBasis * (1 - withdrawalRatio)
      } else {
        totalBasis = 0
      }

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
      const balanceBefore = currentBalance
      currentBalance = currentBalance * (1 + monthlyRate)
      
      if (taxEnabled && taxType === 'income') {
        // Track the tax drag amount for reporting
        const growth = currentBalance - balanceBefore
        // Re-derive tax paid from the net growth: Tax = Growth * (Rate / (1 - Rate))
        let t = taxRate / 100
        if (t >= 0.99) t = 0.99
        totalTaxPaid += growth * (t / (1 - t))
      }
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