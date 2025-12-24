import { WithdrawalState } from '@/lib/types'

export interface WithdrawalProjectionResult {
  endingBalance: number
  endingBalanceGross: number
  endingBalanceNet: number
  endingBalanceInTodaysDollars: number
  totalWithdrawn: number
  totalWithdrawnNet: number // After tax
  totalTaxPaid: number
  totalTaxWithheld: number
  totalTaxDrag: number
  totalWithdrawnInTodaysDollars: number
  isSustainable: boolean
  yearsUntilZero: number | null
  yearData: Array<{
    year: number
    startingBalance: number
    startingBalanceNet: number
    grossStartingBalance: number
    withdrawals: number
    netIncome: number // what user actually got
    taxPaid: number   // New: explicit tax tracking (withheld + drag)
    taxWithheld: number
    taxDrag: number
    endingBalance: number
    endingBalanceNet: number
    grossEndingBalance: number
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
  let totalTaxWithheld = 0
  let totalTaxDrag = 0
  let totalWithdrawnInTodaysDollars = 0

  const yearData = []
  let yearStartBalance = startingBalance
  let yearStartBasis = totalBasis
  let yearWithdrawals = 0
  let yearNetIncome = 0
  let yearTaxPaid = 0 // New accumulator
  let yearTaxWithheld = 0
  let yearTaxDrag = 0

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
      totalTaxWithheld += actualTaxPaid
      
      yearWithdrawals += actualGrossWithdrawal
      yearNetIncome += actualNetReceived
      yearTaxPaid += actualTaxPaid // Accumulate withdrawal tax
      yearTaxWithheld += actualTaxPaid

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
        totalTaxDrag += dragAmount
        yearTaxPaid += dragAmount // Accumulate drag tax
        yearTaxDrag += dragAmount
      }
    }

    if (currentBalance <= 0.01 && yearsUntilZero === null) {
      currentBalance = 0
      yearsUntilZero = parseFloat((month / 12).toFixed(1))
    }

    // D. End of Year Processing
    if (month % 12 === 0) {
      const endingGross = Math.max(0, currentBalance)
      const startingGross = Math.max(0, yearStartBalance)

      let startingNet = startingGross
      let endingNet = endingGross

      if (taxEnabled) {
        if (taxType === 'capital_gains') {
          const profitStart = startingGross - yearStartBasis
          if (profitStart > 0) {
            startingNet = startingGross - (profitStart * (taxRate / 100))
          }

          const profitEnd = endingGross - totalBasis
          if (profitEnd > 0) {
            endingNet = endingGross - (profitEnd * (taxRate / 100))
          }
        } else if (taxType === 'tax_deferred') {
          const effectiveRate = taxRate / 100
          startingNet = startingGross * (1 - effectiveRate)
          endingNet = endingGross * (1 - effectiveRate)
        }
      }

      yearData.push({
        year: month / 12,
        startingBalance: startingNet,
        startingBalanceNet: startingNet,
        grossStartingBalance: startingGross,
        withdrawals: yearWithdrawals,
        netIncome: yearNetIncome,
        taxPaid: yearTaxPaid, // Pass the tracked total (withheld + drag)
        taxWithheld: yearTaxWithheld,
        taxDrag: yearTaxDrag,
        endingBalance: endingNet,
        endingBalanceNet: endingNet,
        grossEndingBalance: endingGross,
        isSustainable: currentBalance > 0,
      })

      yearStartBalance = currentBalance
      yearStartBasis = totalBasis
      yearWithdrawals = 0
      yearNetIncome = 0
      yearTaxPaid = 0
      yearTaxWithheld = 0
      yearTaxDrag = 0

      if (!excludeInflationAdjustment) {
        currentPeriodicWithdrawal *= inflationFactor
      }
    }
  }

  const endingBalanceGross = Math.max(0, currentBalance)
  let endingBalanceNet = endingBalanceGross

  if (taxEnabled) {
    if (taxType === 'capital_gains') {
      const profitForTax = endingBalanceGross - totalBasis
      if (profitForTax > 0) {
        endingBalanceNet = endingBalanceGross - (profitForTax * (taxRate / 100))
      }
    } else if (taxType === 'tax_deferred') {
      const effectiveRate = taxRate / 100
      endingBalanceNet = endingBalanceGross * (1 - effectiveRate)
    }
  }

  const endingBalance = endingBalanceNet
  const isSustainable = endingBalanceGross > 0
  const endingBalanceInTodaysDollars = endingBalance / Math.pow(inflationFactor, duration)

  return {
    endingBalance,
    endingBalanceGross,
    endingBalanceNet,
    endingBalanceInTodaysDollars,
    totalWithdrawn,
    totalWithdrawnNet,
    totalTaxPaid,
    totalTaxWithheld,
    totalTaxDrag,
    totalWithdrawnInTodaysDollars,
    isSustainable,
    yearsUntilZero,
    yearData,
  }
}