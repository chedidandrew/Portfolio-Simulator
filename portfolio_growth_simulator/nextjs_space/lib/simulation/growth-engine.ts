import { GrowthState } from '@/lib/types'

export interface GrowthProjectionResult {
  finalValue: number
  finalValueNet: number
  finalValueInTodaysDollars: number
  totalContributions: number
  totalInterest: number
  totalProfit: number
  totalDeferredTax: number
  totalTaxPaid: number
  yearData: Array<{
    year: number
    startingValue: number
    contributions: number
    interest: number
    endingValue: number
  }>
  yearsToTarget: number | null
}

export function calculateGrowthProjection(state: GrowthState): GrowthProjectionResult {
  const { 
    startingBalance, 
    annualReturn, 
    duration, 
    periodicAddition, 
    frequency, 
    inflationAdjustment,
    targetValue,
    excludeInflationAdjustment,
    taxEnabled,
    taxRate = 0,
    taxType = 'capital_gains'
  } = state

  const totalMonths = duration * 12
  
  // Tax Logic: If 'income' (Annual), apply tax drag to the return rate
  let effectiveAnnualReturn = annualReturn
  if (taxEnabled && taxType === 'income') {
    effectiveAnnualReturn = annualReturn * (1 - (taxRate / 100))
  }

  // Consistent: Use Effective Monthly Rate
  const monthlyRate = Math.pow(1 + effectiveAnnualReturn / 100, 1 / 12) - 1
  const inflationFactor = 1 + (inflationAdjustment / 100)

  let currentBalance = startingBalance
  let totalContributions = startingBalance
  let currentPeriodicAddition = periodicAddition
  let totalTaxPaid = 0

  const yearData = []
  let yearStartBalance = startingBalance
  let yearContributions = 0
  let yearInterest = 0

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
      yearContributions += contributionThisMonth
    }

    if (month % 12 === 0) {
      yearData.push({
        year: month / 12,
        startingValue: yearStartBalance,
        contributions: yearContributions,
        interest: yearInterest,
        endingValue: currentBalance,
      })

      yearStartBalance = currentBalance
      yearContributions = 0
      yearInterest = 0

      if (!excludeInflationAdjustment) {
        currentPeriodicAddition *= inflationFactor
      }
    }
  }

  const finalValue = currentBalance
  const totalProfit = finalValue - totalContributions
  const totalInterest = finalValue - totalContributions

  let totalDeferredTax = 0
  if (taxEnabled && taxType === 'capital_gains') {
    if (totalProfit > 0) {
      totalDeferredTax = totalProfit * (taxRate / 100)
    }
  } 

  const finalValueNet = finalValue - totalDeferredTax
  const finalValueInTodaysDollars = finalValueNet / Math.pow(1 + inflationAdjustment / 100, duration)

  let yearsToTarget: number | null = null

  if (targetValue && targetValue > startingBalance) {
    let tBalance = startingBalance
    let tContribution = periodicAddition
    
    for (let m = 1; m <= 1000 * 12; m++) {
      tBalance = tBalance * (1 + monthlyRate)
      
      let tAdd = 0
      if (frequency === 'monthly') tAdd = tContribution
      else if (frequency === 'quarterly' && m % 3 === 0) tAdd = tContribution
      else if (frequency === 'yearly' && m % 12 === 0) tAdd = tContribution
      else if (frequency === 'weekly') tAdd = (tContribution * 52) / 12
      
      tBalance += tAdd

      if (tBalance >= targetValue) {
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
    totalProfit, 
    totalDeferredTax,
    totalTaxPaid,
    yearData, 
    yearsToTarget 
  }
}