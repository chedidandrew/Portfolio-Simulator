import { GrowthState } from '@/lib/types'

export interface GrowthProjectionResult {
  finalValue: number
  totalContributions: number
  totalProfit: number
  yearData: Array<{
    year: number
    startingValue: number
    contributions: number
    endingValue: number
  }>
  yearsToTarget: number | null
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  weekly: 52,
}

export function calculateGrowthProjection(state: GrowthState): GrowthProjectionResult {
  const { 
    startingBalance, 
    annualReturn, 
    duration, 
    periodicAddition, 
    frequency, 
    inflationAdjustment,
    targetValue 
  } = state

  const periods = FREQUENCY_MULTIPLIER[frequency] || 12
  // Rate per period: (1 + r)^(1/n) - 1
  const ratePerPeriod = Math.pow(1 + annualReturn / 100, 1 / periods) - 1
  
  // Inflation adjustment factor per year (contributions increase by this % annually)
  const inflationFactor = 1 + (inflationAdjustment / 100)

  const yearData = []
  let currentValue = startingBalance
  
  // Track the current periodic addition which might change yearly due to inflation
  let currentPeriodicAddition = periodicAddition
  let runningTotalContributions = startingBalance

  // 1. Calculate Standard Projection
  for (let year = 1; year <= duration; year++) {
    const startingValue = currentValue
    let yearContributions = 0
    
    for (let period = 0; period < periods; period++) {
      currentValue = currentValue * (1 + ratePerPeriod) + currentPeriodicAddition
      yearContributions += currentPeriodicAddition
    }
    
    runningTotalContributions += yearContributions
    
    yearData.push({
      year,
      startingValue,
      contributions: yearContributions,
      endingValue: currentValue,
    })

    // Increase contribution for the NEXT year by inflation rate
    currentPeriodicAddition *= inflationFactor
  }
  
  const finalValue = currentValue
  const totalContributions = runningTotalContributions
  const totalProfit = finalValue - totalContributions
  
  // 2. Calculate Years to Target (if applicable)
  const MAX_YEARS_TO_TARGET = 1000
  let yearsToTarget: number | null = null

  // Only attempt calculation if target exists, target > start, and there is growth potential
  if (
    targetValue &&
    targetValue > startingBalance &&
    (ratePerPeriod > 0 || periodicAddition > 0)
  ) {
    let tempValue = startingBalance
    let tempPeriodicAddition = periodicAddition
    
    // We run a separate simulation loop just for finding the target year
    for (let year = 1; year <= MAX_YEARS_TO_TARGET; year++) {
      for (let period = 0; period < periods; period++) {
        tempValue = tempValue * (1 + ratePerPeriod) + tempPeriodicAddition
      }
      
      if (tempValue >= targetValue) {
        yearsToTarget = year
        break
      }
      
      // Apply inflation to the simulation for target
      tempPeriodicAddition *= inflationFactor
    }
  }
  
  return { 
    finalValue, 
    totalContributions, 
    totalProfit, 
    yearData, 
    yearsToTarget 
  }
}