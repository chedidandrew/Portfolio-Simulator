import type { WithdrawalState } from '../types'
import {
  annualReturnAfterIncomeTaxDrag,
  assertFiniteResult,
  embeddedTaxLiability,
  inflationFactor,
  netLiquidationValue,
  normalizeTaxRate,
  periodicRate,
  proportionalCapitalGainsTax,
  reduceBasisProportionally,
  stepsPerYear,
  toTodaysDollars,
} from './financial-utils'
import {
  MAX_DETERMINISTIC_STEPS,
  MAX_SCENARIO_AMOUNT,
  MAX_SCENARIO_DURATION_YEARS,
  MAX_SCENARIO_INFLATION_PERCENT,
  MAX_SCENARIO_RETURN_PERCENT,
  MAX_SCENARIO_TAX_PERCENT,
  MIN_SCENARIO_INFLATION_PERCENT,
} from './deterministic-validation'

export interface WithdrawalProjectionYear {
  year: number
  startingBalance: number
  startingBalanceNet: number
  grossStartingBalance: number
  withdrawals: number
  withdrawalsInTodaysDollars: number
  netIncome: number
  netIncomeInTodaysDollars: number
  taxPaid: number
  taxPaidInTodaysDollars: number
  taxWithheld: number
  taxDrag: number
  marketGrowth: number
  endingCostBasis: number
  endingBalance: number
  endingBalanceNet: number
  grossEndingBalance: number
  isSustainable: boolean
}

export interface WithdrawalProjectionResult {
  endingBalance: number
  endingBalanceGross: number
  endingBalanceNet: number
  endingBalanceInTodaysDollars: number
  totalWithdrawn: number
  totalWithdrawnNet: number
  totalTaxPaid: number
  totalTaxPaidInTodaysDollars: number
  totalTaxWithheld: number
  totalTaxDrag: number
  totalMarketGrowth: number
  endingCostBasis: number
  remainingEmbeddedTax: number
  remainingEmbeddedTaxInTodaysDollars: number
  totalTaxCost: number
  totalTaxCostInTodaysDollars: number
  totalWithdrawnInTodaysDollars: number
  totalGrossWithdrawnInTodaysDollars: number
  isSustainable: boolean
  yearsUntilZero: number | null
  depletionStep: number | null
  depletionFrequency: WithdrawalState['frequency']
  yearData: WithdrawalProjectionYear[]
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
    calculationMode = 'effective',
  } = state

  if (!Number.isFinite(startingBalance) || startingBalance < 0 || startingBalance > MAX_SCENARIO_AMOUNT) {
    throw new Error('Starting balance is outside the supported range.')
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_SCENARIO_DURATION_YEARS) {
    throw new Error(`Duration must be greater than zero and no more than ${MAX_SCENARIO_DURATION_YEARS} years.`)
  }
  if (!Number.isFinite(periodicWithdrawal) || periodicWithdrawal < 0 || periodicWithdrawal > MAX_SCENARIO_AMOUNT) {
    throw new Error('Withdrawal is outside the supported range.')
  }
  if (!Number.isFinite(annualReturn) || annualReturn < -100 || annualReturn > MAX_SCENARIO_RETURN_PERCENT) {
    throw new Error(`Expected return must be between -100% and ${MAX_SCENARIO_RETURN_PERCENT.toLocaleString()}%.`)
  }
  if (!Number.isFinite(inflationAdjustment) || inflationAdjustment < MIN_SCENARIO_INFLATION_PERCENT || inflationAdjustment > MAX_SCENARIO_INFLATION_PERCENT) {
    throw new Error(`Inflation must be between ${MIN_SCENARIO_INFLATION_PERCENT}% and ${MAX_SCENARIO_INFLATION_PERCENT}%.`)
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > MAX_SCENARIO_TAX_PERCENT) {
    throw new Error(`Tax rate must be between 0% and ${MAX_SCENARIO_TAX_PERCENT}%.`)
  }
  if (startingCostBasis !== undefined && (!Number.isFinite(startingCostBasis) || startingCostBasis < 0 || startingCostBasis > MAX_SCENARIO_AMOUNT)) {
    throw new Error('Starting cost basis is outside the supported range.')
  }

  const periods = stepsPerYear(frequency)
  const totalSteps = Math.max(1, Math.round(duration * periods))
  if (!Number.isSafeInteger(totalSteps) || totalSteps > MAX_DETERMINISTIC_STEPS) {
    throw new Error(`This scenario exceeds the ${MAX_DETERMINISTIC_STEPS.toLocaleString()}-period deterministic limit.`)
  }

  const afterTaxAnnualReturn = annualReturnAfterIncomeTaxDrag(annualReturn, taxEnabled, taxType, taxRate)
  const netStepRate = periodicRate(afterTaxAnnualReturn, periods, calculationMode)
  const grossStepRate = periodicRate(annualReturn, periods, calculationMode)
  const inflator = inflationFactor(inflationAdjustment)
  const taxRateFraction = normalizeTaxRate(taxRate)
  const isIncomeTax = Boolean(taxEnabled && taxType === 'income')

  let balance = startingBalance
  let noDragBalance = startingBalance
  let basis = Math.max(0, startingCostBasis ?? startingBalance)
  let currentWithdrawal = periodicWithdrawal
  let yearsUntilZero: number | null = null
  let depletionStep: number | null = null
  let allScheduledWithdrawalsFulfilled = true

  let totalWithdrawn = 0
  let totalWithdrawnNet = 0
  let totalTaxPaid = 0
  let totalTaxPaidReal = 0
  let totalTaxWithheld = 0
  let totalTaxDrag = 0
  let totalMarketGrowth = 0
  let totalNetReal = 0
  let totalGrossReal = 0

  const yearData: WithdrawalProjectionYear[] = []
  let yearStartBalance = balance
  let yearStartGross = isIncomeTax ? noDragBalance : balance
  let yearStartBasis = basis
  let yearWithdrawals = 0
  let yearWithdrawalsReal = 0
  let yearNetIncome = 0
  let yearNetIncomeReal = 0
  let yearTaxPaid = 0
  let yearTaxPaidReal = 0
  let yearTaxWithheld = 0
  let yearTaxDrag = 0
  let yearMarketGrowth = 0

  for (let step = 1; step <= totalSteps; step += 1) {
    const yearsElapsed = step / periods
    const balanceBeforeWithdrawal = balance
    const grossWithdrawal = Math.min(balance, currentWithdrawal)
    if (grossWithdrawal + 1e-9 < currentWithdrawal) {
      allScheduledWithdrawalsFulfilled = false
      if (yearsUntilZero === null) {
        yearsUntilZero = yearsElapsed
        depletionStep = step
      }
    }

    let withholdingTax = 0
    if (taxEnabled && grossWithdrawal > 0) {
      if (taxType === 'tax_deferred') withholdingTax = grossWithdrawal * taxRateFraction
      if (taxType === 'capital_gains') {
        withholdingTax = proportionalCapitalGainsTax(balanceBeforeWithdrawal, basis, grossWithdrawal, taxRate)
      }
    }

    const netReceived = Math.max(0, grossWithdrawal - withholdingTax)
    if (taxType === 'capital_gains') {
      basis = reduceBasisProportionally(balanceBeforeWithdrawal, basis, grossWithdrawal)
    }

    balance = Math.max(0, balance - grossWithdrawal)
    noDragBalance = Math.max(0, noDragBalance - Math.min(noDragBalance, grossWithdrawal))

    const grossWithdrawalReal = toTodaysDollars(grossWithdrawal, inflationAdjustment, yearsElapsed)
    const netReceivedReal = toTodaysDollars(netReceived, inflationAdjustment, yearsElapsed)
    const withholdingReal = toTodaysDollars(withholdingTax, inflationAdjustment, yearsElapsed)

    totalWithdrawn += grossWithdrawal
    totalWithdrawnNet += netReceived
    totalTaxPaid += withholdingTax
    totalTaxWithheld += withholdingTax
    totalTaxPaidReal += withholdingReal
    totalNetReal += netReceivedReal
    totalGrossReal += grossWithdrawalReal

    yearWithdrawals += grossWithdrawal
    yearWithdrawalsReal += grossWithdrawalReal
    yearNetIncome += netReceived
    yearNetIncomeReal += netReceivedReal
    yearTaxPaid += withholdingTax
    yearTaxPaidReal += withholdingReal
    yearTaxWithheld += withholdingTax

    if (balance > 0) {
      const beforeNetGrowth = balance
      const beforeGrossGrowth = noDragBalance
      balance *= 1 + netStepRate
      noDragBalance *= 1 + grossStepRate
      const grossMarketGrowth = noDragBalance - beforeGrossGrowth
      yearMarketGrowth += grossMarketGrowth
      totalMarketGrowth += grossMarketGrowth

      if (isIncomeTax) {
        const taxDrag = Math.max(0, (noDragBalance - beforeGrossGrowth) - (balance - beforeNetGrowth))
        totalTaxDrag += taxDrag
        totalTaxPaid += taxDrag
        const taxDragReal = toTodaysDollars(taxDrag, inflationAdjustment, yearsElapsed)
        totalTaxPaidReal += taxDragReal
        yearTaxDrag += taxDrag
        yearTaxPaid += taxDrag
        yearTaxPaidReal += taxDragReal
      }
    }

    assertFiniteResult(balance, 'Portfolio balance')
    assertFiniteResult(noDragBalance, 'Pre-tax comparison balance')

    if (balance <= 0.01) {
      balance = 0
      noDragBalance = Math.max(0, noDragBalance)
      if (step < totalSteps && yearsUntilZero === null) {
        yearsUntilZero = yearsElapsed
        depletionStep = step
      }
    }

    const isYearEnd = step % periods === 0 || step === totalSteps
    if (isYearEnd) {
      const startingNet = netLiquidationValue({
        balance: yearStartBalance,
        basis: yearStartBasis,
        taxEnabled,
        taxType,
        taxRate,
      })
      const endingNet = netLiquidationValue({ balance, basis, taxEnabled, taxType, taxRate })
      const grossEndingBalance = isIncomeTax ? noDragBalance : balance

      yearData.push({
        year: yearsElapsed,
        startingBalance: startingNet,
        startingBalanceNet: startingNet,
        grossStartingBalance: yearStartGross,
        withdrawals: yearWithdrawals,
        withdrawalsInTodaysDollars: yearWithdrawalsReal,
        netIncome: yearNetIncome,
        netIncomeInTodaysDollars: yearNetIncomeReal,
        taxPaid: yearTaxPaid,
        taxPaidInTodaysDollars: yearTaxPaidReal,
        taxWithheld: yearTaxWithheld,
        taxDrag: yearTaxDrag,
        marketGrowth: yearMarketGrowth,
        endingCostBasis: basis,
        endingBalance: endingNet,
        endingBalanceNet: endingNet,
        grossEndingBalance,
        isSustainable: allScheduledWithdrawalsFulfilled,
      })

      yearStartBalance = balance
      yearStartGross = grossEndingBalance
      yearStartBasis = basis
      yearWithdrawals = 0
      yearWithdrawalsReal = 0
      yearNetIncome = 0
      yearNetIncomeReal = 0
      yearTaxPaid = 0
      yearTaxPaidReal = 0
      yearTaxWithheld = 0
      yearTaxDrag = 0
      yearMarketGrowth = 0

      if (!excludeInflationAdjustment && step < totalSteps) currentWithdrawal *= inflator
    }
  }

  const endingBalanceGross = Math.max(0, isIncomeTax ? noDragBalance : balance)
  const endingBalanceNet = netLiquidationValue({ balance: Math.max(0, balance), basis, taxEnabled, taxType, taxRate })
  const remainingEmbeddedTax = embeddedTaxLiability({
    balance: Math.max(0, balance),
    basis,
    taxEnabled,
    taxType,
    taxRate,
  })

  return {
    endingBalance: endingBalanceNet,
    endingBalanceGross,
    endingBalanceNet,
    endingBalanceInTodaysDollars: toTodaysDollars(endingBalanceNet, inflationAdjustment, duration),
    totalWithdrawn,
    totalWithdrawnNet,
    totalTaxPaid,
    totalTaxPaidInTodaysDollars: totalTaxPaidReal,
    totalTaxWithheld,
    totalTaxDrag,
    totalMarketGrowth,
    endingCostBasis: basis,
    remainingEmbeddedTax,
    remainingEmbeddedTaxInTodaysDollars: toTodaysDollars(remainingEmbeddedTax, inflationAdjustment, duration),
    totalTaxCost: totalTaxPaid + remainingEmbeddedTax,
    totalTaxCostInTodaysDollars: totalTaxPaidReal + toTodaysDollars(remainingEmbeddedTax, inflationAdjustment, duration),
    totalWithdrawnInTodaysDollars: totalNetReal,
    totalGrossWithdrawnInTodaysDollars: totalGrossReal,
    isSustainable: allScheduledWithdrawalsFulfilled,
    yearsUntilZero,
    depletionStep,
    depletionFrequency: frequency,
    yearData,
  }
}
