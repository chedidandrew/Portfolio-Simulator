import assert from 'node:assert/strict'
import test from 'node:test'
import { compareRefinance, getRefinanceValidationErrors, type RefinanceInputs } from './refinance'
import { compareInvestVsDebt, getInvestVsDebtValidationErrors, type InvestVsDebtInputs } from './invest-vs-debt'
import { estimatePayoffGoal } from './payoff-goal'
import type { LoanInputs } from '../loan/loan-engine'

const loan: LoanInputs = {
  principal: 350_000,
  apr: 6.5,
  termMonths: 360,
  firstPaymentMonth: '2026-09',
  extraMonthlyPayment: 0,
  lumpSums: [],
}

test('payoff goal finds the minimum cent-level recurring extra payment', () => {
  const estimate = estimatePayoffGoal(loan, '2045-08')
  assert.ok(estimate.requiredExtraMonthlyPayment > 0)
  assert.ok(estimate.projected.paymentCount <= estimate.targetPaymentCount)

  if (estimate.requiredExtraMonthlyPayment >= 0.01) {
    const almost = estimatePayoffGoal(
      { ...loan, extraMonthlyPayment: estimate.requiredExtraMonthlyPayment - 0.01 },
      '2045-08',
    )
    assert.ok(almost.additionalExtraMonthlyPayment >= 0)
  }
})

test('payoff goal recognizes an already-met target', () => {
  const estimate = estimatePayoffGoal({ ...loan, extraMonthlyPayment: 2_000 }, '2050-08')
  assert.equal(estimate.currentPlanMeetsTarget, true)
  assert.ok(estimate.additionalExtraMonthlyPayment === 0)
})

test('payoff goal includes saved one-time payments when solving recurring extra cash', () => {
  const withoutLump = estimatePayoffGoal(loan, '2041-08')
  const withLump = estimatePayoffGoal({
    ...loan,
    lumpSums: [{ id: 'bonus', month: '2030-01', amount: 25_000 }],
  }, '2041-08')
  assert.ok(withLump.requiredExtraMonthlyPayment < withoutLump.requiredExtraMonthlyPayment)
  assert.ok(withLump.projected.paymentCount <= withLump.targetPaymentCount)
})

test('refinance comparison includes the saved current payoff plan and closing costs', () => {
  const inputs: RefinanceInputs = {
    balance: 300_000,
    currentApr: 7,
    remainingMonths: 300,
    currentExtraMonthlyPayment: 400,
    currentLumpSums: [{ id: 'bonus', month: '2028-01', amount: 5_000 }],
    newApr: 5.75,
    newTermMonths: 300,
    closingCosts: 6_000,
    financeClosingCosts: false,
    firstPaymentMonth: '2026-09',
  }
  const result = compareRefinance(inputs)
  assert.ok(result.refinanced.scheduledPayment < result.currentRequired.scheduledPayment)
  assert.ok(result.monthlyPaymentSavings > 0)
  assert.ok(result.current.paymentCount < result.currentRequired.paymentCount)
  assert.equal(result.currentRemainingCost, result.current.totalPaid)
  assert.equal(result.refinancedRemainingCost, Math.round((result.refinanced.totalPaid + 6_000) * 100) / 100)
  assert.ok(result.estimatedBreakEvenMonths && result.estimatedBreakEvenMonths > 0)
})

test('financed refinance closing costs increase the new principal and have no upfront break-even', () => {
  const result = compareRefinance({
    balance: 200_000,
    currentApr: 6.5,
    remainingMonths: 240,
    currentExtraMonthlyPayment: 0,
    currentLumpSums: [],
    newApr: 5.5,
    newTermMonths: 240,
    closingCosts: 5_000,
    financeClosingCosts: true,
    firstPaymentMonth: '2026-09',
  })
  assert.equal(result.newLoanAmount, 205_000)
  assert.equal(result.estimatedBreakEvenMonths, null)
})

test('refinance rejects financed principal above the supported loan ceiling', () => {
  const errors = getRefinanceValidationErrors({
    balance: 999_000_000,
    currentApr: 6,
    remainingMonths: 120,
    currentExtraMonthlyPayment: 0,
    currentLumpSums: [],
    newApr: 5,
    newTermMonths: 120,
    closingCosts: 2_000_000,
    financeClosingCosts: true,
    firstPaymentMonth: '2026-09',
  })
  assert.ok(errors.some((error) => error.includes('Financed balance plus closing costs')))
})

const investBase: InvestVsDebtInputs = {
  loanBalance: 300_000,
  loanApr: 6.5,
  remainingMonths: 300,
  firstPaymentMonth: '2026-09',
  extraMonthlyCash: 500,
  lumpSums: [],
  expectedReturn: 8,
  volatility: 18,
  scenarios: 500,
  seed: 'financial-tools-test',
}

test('invest versus debt comparison is deterministic for the same seed', () => {
  const first = compareInvestVsDebt(investBase)
  const second = compareInvestVsDebt(investBase)
  assert.deepEqual(first, second)
  assert.ok(first.probabilityInvestFirstAhead >= 0 && first.probabilityInvestFirstAhead <= 100)
  assert.ok(first.acceleratedPayoffMonths < investBase.remainingMonths)
  assert.ok(first.interestSavedByDebtFirst > 0)
})

test('invest versus debt supports a one-time cash decision without recurring extra cash', () => {
  const result = compareInvestVsDebt({
    ...investBase,
    extraMonthlyCash: 0,
    lumpSums: [{ id: 'windfall', month: '2028-01', amount: 20_000 }],
  })
  assert.ok(result.acceleratedPayoffMonths < investBase.remainingMonths)
  assert.ok(result.interestSavedByDebtFirst > 0)
})

test('invest versus debt accepts up to 100,000 scenarios and rejects larger runs', () => {
  const inputs: InvestVsDebtInputs = {
    ...investBase,
    scenarios: 100_000,
    seed: 'scenario-limit-test',
  }

  assert.equal(getInvestVsDebtValidationErrors(inputs).length, 0)
  assert.ok(
    getInvestVsDebtValidationErrors({ ...inputs, scenarios: 100_001 })
      .some((error) => error.includes('100000')),
  )
})

test('zero volatility makes the Monte Carlo median agree closely with deterministic paths', () => {
  const result = compareInvestVsDebt({
    loanBalance: 100_000,
    loanApr: 5,
    remainingMonths: 120,
    firstPaymentMonth: '2026-09',
    extraMonthlyCash: 300,
    lumpSums: [],
    expectedReturn: 7,
    volatility: 0,
    scenarios: 200,
    seed: 'zero-volatility',
  })
  assert.ok(Math.abs(result.medianInvestFirst - result.deterministicInvestFirst) < 0.02)
  assert.ok(Math.abs(result.medianDebtFirst - result.deterministicDebtFirst) < 0.02)
})

test('invest versus debt progress callback reaches the requested scenario count', () => {
  let completed = 0
  const result = compareInvestVsDebt({ ...investBase, scenarios: 100 }, (done) => {
    completed = done
  })
  assert.equal(result.scenarios, 100)
  assert.equal(completed, 100)
})
