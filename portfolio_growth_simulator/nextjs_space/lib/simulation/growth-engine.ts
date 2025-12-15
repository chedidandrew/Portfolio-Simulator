import { GrowthState } from '@/lib/types'

export interface GrowthProjectionResult {
  finalValue: number
  finalValueInTodaysDollars: number
  totalContributions: number
  totalInterest: number
  totalProfit: number
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
    excludeInflationAdjustment // <--- Make sure to destructure this
  } = state

  // --- 1. Engine Configuration ---
  const totalMonths = duration * 12
  const monthlyRate = Math.pow(1 + annualReturn / 100, 1 / 12) - 1
  const inflationFactor = 1 + (inflationAdjustment / 100)

  // --- 2. Simulation State ---
  let currentBalance = startingBalance
  let totalContributions = startingBalance
  let currentPeriodicAddition = periodicAddition

  const yearData = []
  let yearStartBalance = startingBalance
  let yearContributions = 0
  let yearInterest = 0

  // --- 3. Run Simulation ---
  for (let month = 1; month <= totalMonths; month++) {
    const balanceBeforeInterest = currentBalance
    
    // A. Apply Growth
    currentBalance = currentBalance * (1 + monthlyRate)
    const monthlyInterest = currentBalance - balanceBeforeInterest
    yearInterest += monthlyInterest

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

    // C. End of Year Processing
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

      // D. Apply Inflation to Contributions (CONDITIONAL)
      // Only increase contributions if the user has NOT checked "Exclude Inflation Adjustment"
      if (!excludeInflationAdjustment) {
        currentPeriodicAddition *= inflationFactor
      }
    }
  }

  const finalValue = currentBalance
  const totalProfit = finalValue - totalContributions
  const totalInterest = finalValue - totalContributions

  // --- 4. Real Value Calculation ---
  // Always discount by inflation to show purchasing power, regardless of contribution strategy
  const finalValueInTodaysDollars = finalValue / Math.pow(1 + inflationAdjustment / 100, duration)

  // --- 5. Years to Target ---
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

      // Apply inflation to target loop only if enabled
      if (m % 12 === 0 && !excludeInflationAdjustment) {
        tContribution *= inflationFactor
      }
    }
  }
  
  return { 
    finalValue, 
    finalValueInTodaysDollars,
    totalContributions, 
    totalInterest, 
    totalProfit, 
    yearData, 
    yearsToTarget 
  }
}