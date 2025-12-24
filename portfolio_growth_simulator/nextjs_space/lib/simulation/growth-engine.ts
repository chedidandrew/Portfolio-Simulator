import { GrowthState } from '@/lib/types'

export interface GrowthProjectionResult {
  finalValue: number
  finalValueNet: number
  finalValueInTodaysDollars: number
  totalContributions: number
  totalInterest: number
  taxableGain: number
  totalDeferredTax: number
  totalTaxPaid: number
  yearData: Array<{
    year: number
    startingValue: number
    grossStartingValue: number
    contributions: number
    interest: number
    taxPaid: number
    endingValue: number
    grossEndingValue: number
  }>
  yearsToTarget: number | null
}

export function calculateGrowthProjection(state: GrowthState): GrowthProjectionResult {
  const { 
    startingBalance, 
    startingCostBasis,
    annualReturn, 
    duration, 
    periodicAddition, 
    frequency, 
    inflationAdjustment,
    targetValue,
    excludeInflationAdjustment,
    taxEnabled,
    taxRate = 0,
    taxType = 'capital_gains',
    calculationMode = 'effective'
  } = state

  const totalMonths = duration * 12
  
  // Tax Logic: If 'income' (Annual), apply tax drag to the return rate
  // 'tax_deferred' and 'capital_gains' do NOT reduce annual return
  let effectiveAnnualReturn = annualReturn
  if (taxEnabled && taxType === 'income') {
    effectiveAnnualReturn = annualReturn * (1 - (taxRate / 100))
  }

  // Consistent: Use Effective Monthly Rate or Nominal Monthly Rate
  let monthlyRate
  if (calculationMode === 'nominal') {
    monthlyRate = effectiveAnnualReturn / 100 / 12
  } else {
    monthlyRate = Math.pow(1 + effectiveAnnualReturn / 100, 1 / 12) - 1
  }

  const inflationFactor = 1 + (inflationAdjustment / 100)

  const clampedStartingCostBasis = Math.max(0, startingCostBasis ?? startingBalance)

  let currentBalance = startingBalance
  let totalContributions = startingBalance
  let totalBasis = clampedStartingCostBasis
  let currentPeriodicAddition = periodicAddition
  let totalTaxPaid = 0

  const yearData = []
  const getNetLiquidationValue = (balance: number, basis: number) => {
    if (!taxEnabled) return balance
    if (taxType === 'capital_gains') {
      const profitForTax = balance - basis
      if (profitForTax > 0) return balance - (profitForTax * (taxRate / 100))
      return balance
    }
    if (taxType === 'tax_deferred') {
      return balance * (1 - (taxRate / 100))
    }
    return balance
  }

  let yearStartBalanceGross = startingBalance
  let yearStartBalanceNet = getNetLiquidationValue(startingBalance, totalBasis)
  let yearContributions = 0
  let yearInterest = 0
  let yearTaxPaid = 0

  for (let month = 1; month <= totalMonths; month++) {
    const balanceBeforeInterest = currentBalance
    
    // A. Apply Growth
    currentBalance = currentBalance * (1 + monthlyRate)
    const monthlyInterest = currentBalance - balanceBeforeInterest
    yearInterest += monthlyInterest

    if (taxEnabled && taxType === 'income') {
      // EDGE CASE SAFETY: Clamp tax rate to 99% max for the 'implied tax' division
      let t = taxRate / 100
      if (t >= 0.99) t = 0.99
      const impliedTax = monthlyInterest * (t / (1 - t))
      totalTaxPaid += impliedTax
      yearTaxPaid += impliedTax
    }

    // B. Apply Contributions
    let contributionThisMonth = 0
    if (frequency === 'monthly') contributionThisMonth = currentPeriodicAddition
    else if (frequency === 'quarterly' && month % 3 === 0) contributionThisMonth = currentPeriodicAddition
    else if (frequency === 'yearly' && month % 12 === 0) contributionThisMonth = currentPeriodicAddition
    else if (frequency === 'weekly') contributionThisMonth = (currentPeriodicAddition * 52) / 12

    if (contributionThisMonth > 0) {
      currentBalance += contributionThisMonth
      totalContributions += contributionThisMonth
      totalBasis += contributionThisMonth
      yearContributions += contributionThisMonth
    }

    if (month % 12 === 0) {
      let endingValue = currentBalance
      if (taxEnabled) {
        if (taxType === 'capital_gains') {
          const profitForTax = currentBalance - totalBasis
          if (profitForTax > 0) {
            endingValue = currentBalance - (profitForTax * (taxRate / 100))
          }
        } else if (taxType === 'tax_deferred') {
          endingValue = currentBalance * (1 - (taxRate / 100))
        }
      }

      yearData.push({
        year: month / 12,
        startingValue: yearStartBalanceNet,
        grossStartingValue: yearStartBalanceGross,
        contributions: yearContributions,
        interest: yearInterest,
        taxPaid: yearTaxPaid,
        endingValue,
        grossEndingValue: currentBalance,
      })

      yearStartBalanceGross = currentBalance
      yearStartBalanceNet = endingValue
      yearContributions = 0
      yearInterest = 0
      yearTaxPaid = 0

      if (!excludeInflationAdjustment) {
        currentPeriodicAddition *= inflationFactor
      }
    }
  }

  const finalValue = currentBalance
  const totalInterest = finalValue - totalContributions

  const taxableGain = (taxEnabled && taxType === 'capital_gains') ? Math.max(0, finalValue - totalBasis) : 0

  let totalDeferredTax = 0
  if (taxEnabled) {
    if (taxType === 'capital_gains') {
      // Tax on PROFIT only
      const profitForTax = finalValue - totalBasis
      if (profitForTax > 0) {
        totalDeferredTax = profitForTax * (taxRate / 100)
      }
    } else if (taxType === 'tax_deferred') {
      // Tax on ENTIRE BALANCE (Traditional 401k/IRA style)
      // Assumes the initial balance was also pre-tax or deductible
      totalDeferredTax = finalValue * (taxRate / 100)
    }
  } 

  const finalValueNet = finalValue - totalDeferredTax
  const finalValueInTodaysDollars = finalValueNet / Math.pow(1 + inflationAdjustment / 100, duration)

  let yearsToTarget: number | null = null

  if (targetValue && targetValue > startingBalance) {
    let tBalance = startingBalance
    let tBasis = clampedStartingCostBasis
    let tContribution = periodicAddition
    
    for (let m = 1; m <= 1000 * 12; m++) {
      tBalance = tBalance * (1 + monthlyRate)
      
      let tAdd = 0
      if (frequency === 'monthly') tAdd = tContribution
      else if (frequency === 'quarterly' && m % 3 === 0) tAdd = tContribution
      else if (frequency === 'yearly' && m % 12 === 0) tAdd = tContribution
      else if (frequency === 'weekly') tAdd = (tContribution * 52) / 12
      
      tBalance += tAdd
      if (tAdd > 0) {
        tBasis += tAdd
      }

      let tNet = tBalance
      if (taxEnabled) {
        if (taxType === 'capital_gains') {
          const profitForTax = tBalance - tBasis
          if (profitForTax > 0) {
            tNet = tBalance - (profitForTax * (taxRate / 100))
          }
        } else if (taxType === 'tax_deferred') {
          tNet = tBalance * (1 - (taxRate / 100))
        }
      }

      if (tNet >= targetValue) {
        yearsToTarget = parseFloat((m / 12).toFixed(1))
        break
      }

      if (m % 12 === 0 && !excludeInflationAdjustment) {
        tContribution *= inflationFactor
      }
    }
  }
  
  return { 
    finalValue, 
    finalValueNet,
    finalValueInTodaysDollars,
    totalContributions, 
    totalInterest, 
    taxableGain,
    totalDeferredTax,
    totalTaxPaid,
    yearData, 
    yearsToTarget 
  }
}