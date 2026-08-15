import type { GrowthState } from '../types'
import {
  annualReturnAfterIncomeTaxDrag,
  assertFiniteResult,
  embeddedTaxLiability,
  inflationFactor,
  netLiquidationValue,
  normalizeTaxRate,
  periodicRate,
  stepsPerYear,
  toTodaysDollars,
} from './financial-utils'

export interface GrowthProjectionYear {
  year: number
  startingValue: number
  grossStartingValue: number
  contributions: number
  contributionsInTodaysDollars: number
  cumulativeContributions: number
  cumulativeContributionsInTodaysDollars: number
  totalInvested: number
  totalInvestedInTodaysDollars: number
  interest: number
  taxPaid: number
  changeInEmbeddedTax: number
  endingValue: number
  grossEndingValue: number
}

export interface GrowthProjectionResult {
  finalValue: number
  finalValueNet: number
  endingBalanceGross: number
  endingBalanceNet: number
  finalValueInTodaysDollars: number
  totalContributions: number
  totalInvested: number
  periodicContributions: number
  periodicContributionsInTodaysDollars: number
  totalInvestedInTodaysDollars: number
  totalInterest: number
  totalProfit: number
  profitGross: number
  profitNet: number
  taxableGain: number
  totalDeferredTax: number
  totalTaxPaid: number
  totalTaxWithheld: number
  totalTaxDrag: number
  totalTaxCost: number
  yearData: GrowthProjectionYear[]
  yearsToTarget: number | null
  targetStep: number | null
  targetFrequency: GrowthState['frequency']
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
    calculationMode = 'effective',
  } = state

  if (!Number.isFinite(startingBalance) || startingBalance < 0) throw new Error('Starting balance cannot be negative.')
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Duration must be greater than zero.')
  if (!Number.isFinite(periodicAddition) || periodicAddition < 0) throw new Error('Contribution cannot be negative.')

  const periods = stepsPerYear(frequency)
  const totalSteps = Math.max(1, Math.round(duration * periods))
  const afterTaxAnnualReturn = annualReturnAfterIncomeTaxDrag(annualReturn, taxEnabled, taxType, taxRate)
  const netStepRate = periodicRate(afterTaxAnnualReturn, periods, calculationMode)
  const grossStepRate = periodicRate(annualReturn, periods, calculationMode)
  const inflator = inflationFactor(inflationAdjustment)
  const taxRateFraction = normalizeTaxRate(taxRate)

  let netBalance = startingBalance
  let grossBalance = startingBalance
  let basis = Math.max(0, startingCostBasis ?? startingBalance)
  let currentContribution = periodicAddition
  let periodicContributions = 0
  let periodicContributionsReal = 0
  let totalTaxPaid = 0
  let totalInterestGross = 0
  let cumulativeContributions = 0
  let cumulativeContributionsReal = 0

  const yearData: GrowthProjectionYear[] = []
  let yearStartGross = grossBalance
  let yearStartNet = netLiquidationValue({ balance: netBalance, basis, taxEnabled, taxType, taxRate })
  let yearContributions = 0
  let yearContributionsReal = 0
  let yearGrossInterest = 0
  let yearTax = 0

  for (let step = 1; step <= totalSteps; step += 1) {
    const yearsElapsed = step / periods
    const grossBefore = grossBalance
    const netBefore = netBalance

    grossBalance *= 1 + grossStepRate
    netBalance *= 1 + netStepRate

    const grossGrowth = grossBalance - grossBefore
    const netGrowth = netBalance - netBefore
    const taxOnGrowth = taxEnabled && taxType === 'income' ? Math.max(0, grossGrowth - netGrowth) : 0

    totalInterestGross += grossGrowth
    totalTaxPaid += taxOnGrowth
    yearGrossInterest += grossGrowth
    yearTax += taxOnGrowth

    if (currentContribution > 0) {
      grossBalance += currentContribution
      netBalance += currentContribution
      basis += currentContribution
      periodicContributions += currentContribution
      cumulativeContributions += currentContribution
      yearContributions += currentContribution

      const realContribution = toTodaysDollars(currentContribution, inflationAdjustment, yearsElapsed)
      periodicContributionsReal += realContribution
      cumulativeContributionsReal += realContribution
      yearContributionsReal += realContribution
    }

    assertFiniteResult(netBalance, 'Portfolio balance')
    assertFiniteResult(grossBalance, 'Gross portfolio balance')

    const isYearEnd = step % periods === 0 || step === totalSteps
    if (isYearEnd) {
      const endingNet = netLiquidationValue({ balance: netBalance, basis, taxEnabled, taxType, taxRate })
      const hasDeferredTax = !!taxEnabled && (taxType === 'capital_gains' || taxType === 'tax_deferred')
      const startingEmbeddedTax = hasDeferredTax ? Math.max(0, yearStartGross - yearStartNet) : 0
      const endingEmbeddedTax = hasDeferredTax ? Math.max(0, grossBalance - endingNet) : 0
      yearData.push({
        year: yearsElapsed,
        startingValue: yearStartNet,
        grossStartingValue: yearStartGross,
        contributions: yearContributions,
        contributionsInTodaysDollars: yearContributionsReal,
        cumulativeContributions,
        cumulativeContributionsInTodaysDollars: cumulativeContributionsReal,
        totalInvested: startingBalance + cumulativeContributions,
        totalInvestedInTodaysDollars: startingBalance + cumulativeContributionsReal,
        interest: yearGrossInterest,
        taxPaid: yearTax,
        changeInEmbeddedTax: endingEmbeddedTax - startingEmbeddedTax,
        endingValue: endingNet,
        grossEndingValue: grossBalance,
      })

      yearStartGross = grossBalance
      yearStartNet = endingNet
      yearContributions = 0
      yearContributionsReal = 0
      yearGrossInterest = 0
      yearTax = 0

      if (!excludeInflationAdjustment && step < totalSteps) currentContribution *= inflator
    }
  }

  const finalValue = netBalance
  const finalValueNet = netLiquidationValue({ balance: netBalance, basis, taxEnabled, taxType, taxRate })
  const endingBalanceGross = taxType === 'income' && taxEnabled ? grossBalance : netBalance
  const endingBalanceNet = finalValueNet
  const totalDeferredTax = embeddedTaxLiability({ balance: netBalance, basis, taxEnabled, taxType, taxRate })
  const totalTaxDrag = taxEnabled && taxType === 'income' ? Math.max(0, grossBalance - netBalance) : 0
  const totalTaxCost = totalTaxPaid + totalDeferredTax
  const taxableGain = taxEnabled && taxType === 'capital_gains' ? Math.max(0, netBalance - basis) : 0
  const totalContributions = startingBalance + periodicContributions
  const totalInvestedInTodaysDollars = startingBalance + periodicContributionsReal
  const profitGross = endingBalanceGross - totalContributions
  const profitNet = finalValueNet - totalContributions

  let yearsToTarget: number | null = null
  let targetStep: number | null = null
  if (targetValue && targetValue > 0) {
    if (netLiquidationValue({ balance: startingBalance, basis: Math.max(0, startingCostBasis ?? startingBalance), taxEnabled, taxType, taxRate }) >= targetValue) {
      yearsToTarget = 0
    } else {
      let targetNet = startingBalance
      let targetGross = startingBalance
      let targetBasis = Math.max(0, startingCostBasis ?? startingBalance)
      let targetContribution = periodicAddition
      const maxSteps = 1_000 * periods

      for (let step = 1; step <= maxSteps; step += 1) {
        targetGross *= 1 + grossStepRate
        targetNet *= 1 + netStepRate
        if (targetContribution > 0) {
          targetGross += targetContribution
          targetNet += targetContribution
          targetBasis += targetContribution
        }

        const targetLiquidation = netLiquidationValue({ balance: targetNet, basis: targetBasis, taxEnabled, taxType, taxRate })
        if (targetLiquidation >= targetValue) {
          targetStep = step
          yearsToTarget = step / periods
          break
        }

        if (step % periods === 0 && !excludeInflationAdjustment) targetContribution *= inflator
      }
    }
  }

  // Preserve compatibility: finalValue is the modeled account balance before deferred liquidation tax.
  return {
    finalValue,
    finalValueNet,
    endingBalanceGross,
    endingBalanceNet,
    finalValueInTodaysDollars: toTodaysDollars(finalValueNet, inflationAdjustment, duration),
    totalContributions,
    totalInvested: totalContributions,
    periodicContributions,
    periodicContributionsInTodaysDollars: periodicContributionsReal,
    totalInvestedInTodaysDollars,
    totalInterest: totalInterestGross,
    totalProfit: profitNet,
    profitGross,
    profitNet,
    taxableGain,
    totalDeferredTax,
    totalTaxPaid,
    totalTaxWithheld: 0,
    totalTaxDrag,
    totalTaxCost,
    yearData,
    yearsToTarget,
    targetStep,
    targetFrequency: frequency,
  }
}
