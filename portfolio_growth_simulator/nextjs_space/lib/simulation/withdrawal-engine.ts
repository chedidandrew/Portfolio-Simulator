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
    netIncome: number // what user actually got
    taxPaid: number   // New: explicit tax tracking
    endingBalance: number
    isSustainable: boolean
  }>
}

export function calculateWithdrawalProjection(state: WithdrawalState): WithdrawalProjectionResult {
  const {
    startingBalance,
    startingCostBasis,
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

  const clampedStartingCostBasis = Math.max(0, startingCostBasis ?? startingBalance)

  // --- 2. Simulation State ---
  let currentBalance = startingBalance
  let totalBasis = clampedStartingCostBasis
  let currentPeriodicWithdrawal = periodicWithdrawal 
  
  let yearsUntilZero: number | null = null
  let totalWithdrawn = 0
  let totalWithdrawnNet = 0
  let totalTaxPaid = 0
  let totalWithdrawnInTodaysDollars = 0

  const yearData = []
  let yearStartBalance = startingBalance
  let yearWithdrawals = 0
  let yearNetIncome = 0
  let yearTaxPaid = 0 // New accumulator

  // --- 3. Run Simulation ---
  for (let month = 1; month <= totalMonths; month++) {
    
    // --- STEP 1: Determine Withdrawal ---
    let inputAmountThisMonth = 0
    if (frequency === 'monthly') inputAmountThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'quarterly' && month % 3 === 0) inputAmountThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'yearly' && month % 12 === 0) inputAmountThisMonth = currentPeriodicWithdrawal
    else if (frequency === 'weekly') inputAmountThisMonth = (currentPeriodicWithdrawal * 52) / 12

    // Execute Withdrawal
    if (inputAmountThisMonth > 0) {
      let requiredGross = inputAmountThisMonth
      let calculatedTax = 0

      // TAX LOGIC BRANCH
      if (taxEnabled && taxType !== 'income') {
         if (taxType === 'tax_deferred') {
           const effectiveRate = taxRate / 100
           requiredGross = inputAmountThisMonth
           calculatedTax = requiredGross * effectiveRate
           
         } else {
           // Capital Gains
           let gainFraction = 0
           if (currentBalance > totalBasis) {
             gainFraction = (currentBalance - totalBasis) / currentBalance
           }
           if (gainFraction < 0) gainFraction = 0
           
           let effectiveTaxRate = (taxRate / 100) * gainFraction
           if (effectiveTaxRate >= 0.99) effectiveTaxRate = 0.99 
           
           requiredGross = inputAmountThisMonth
           calculatedTax = requiredGross * effectiveTaxRate
         }
      }

      const actualGrossWithdrawal = Math.min(currentBalance, requiredGross)
      
      let actualTaxPaid = 0
      if (requiredGross > 0) {
          actualTaxPaid = calculatedTax * (actualGrossWithdrawal / requiredGross)
      }
      
      const actualNetReceived = actualGrossWithdrawal - actualTaxPaid

      if (taxType === 'capital_gains') {
        if (currentBalance > 0) {
          const withdrawalRatio = actualGrossWithdrawal / currentBalance
          totalBasis = totalBasis * (1 - withdrawalRatio)
        } else {
          totalBasis = 0
        }
      }

      currentBalance -= actualGrossWithdrawal
      
      totalWithdrawn += actualGrossWithdrawal
      totalWithdrawnNet += actualNetReceived
      totalTaxPaid += actualTaxPaid
      
      yearWithdrawals += actualGrossWithdrawal
      yearNetIncome += actualNetReceived
      yearTaxPaid += actualTaxPaid // Accumulate withdrawal tax

      const discountFactor = Math.pow(inflationFactor, month / 12)
      totalWithdrawnInTodaysDollars += (actualNetReceived / discountFactor)
    }

    // --- STEP 2: Apply Growth ---
    if (currentBalance > 0) {
      const balanceBefore = currentBalance
      currentBalance = currentBalance * (1 + monthlyRate)
      
      if (taxEnabled && taxType === 'income') {
        const growth = currentBalance - balanceBefore
        let t = taxRate / 100
        if (t >= 0.99) t = 0.99
        
        // "Implied Tax" calculation: Tax = Growth_PreTax - Growth_PostTax
        // Growth_PreTax = Growth_PostTax / (1 - Rate)
        // Tax = Growth_PostTax * (Rate / (1 - Rate))
        const dragAmount = growth * (t / (1 - t))
        
        totalTaxPaid += dragAmount
        yearTaxPaid += dragAmount // Accumulate drag tax
      }
    }

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
        taxPaid: yearTaxPaid, // Pass the tracked total
        endingBalance: Math.max(0, currentBalance),
        isSustainable: currentBalance > 0,
      })

      yearStartBalance = currentBalance
      yearWithdrawals = 0
      yearNetIncome = 0
      yearTaxPaid = 0

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