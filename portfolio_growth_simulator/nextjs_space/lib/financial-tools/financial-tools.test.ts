import assert from 'node:assert/strict'
import test from 'node:test'
import { compareRefinance, type RefinanceInputs } from './refinance'
import { compareInvestVsDebt, type InvestVsDebtInputs } from './invest-vs-debt'
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

test('refinance comparison includes closing costs and lifetime cost', () => {
  const inputs: RefinanceInputs = {
    balance: 300_000,
    currentApr: 7,
    remainingMonths: 300,
    newApr: 5.75,
    newTermMonths: 300,
    closingCosts: 6_000,
    financeClosingCosts: false,
    firstPaymentMonth: '2026-09',
  }
  const result = compareRefinance(inputs)
  assert.ok(result.refinanced.scheduledPayment < result.current.scheduledPayment)
  assert.ok(result.monthlyPaymentSavings > 0)
  assert.equal(result.refinancedRemainingCost, Math.round((result.refinanced.totalPaid + 6_000) * 100) / 100)
  assert.ok(result.estimatedBreakEvenMonths && result.estimatedBreakEvenMonths > 0)
})

test('financed refinance closing costs increase the new principal', () => {
  const result = compareRefinance({
    balance: 200_000,
    currentApr: 6.5,
    remainingMonths: 240,
    newApr: 5.5,
    newTermMonths: 240,
    closingCosts: 5_000,
    financeClosingCosts: true,
    firstPaymentMonth: '2026-09',
  })
  assert.equal(result.newLoanAmount, 205_000)
})

test('invest versus debt comparison is deterministic for the same seed', () => {
  const inputs: InvestVsDebtInputs = {
    loanBalance: 300_000,
    loanApr: 6.5,
    remainingMonths: 300,
    extraMonthlyCash: 500,
    expectedReturn: 8,
    volatility: 18,
    scenarios: 500,
    seed: 'financial-tools-test',
  }
  const first = compareInvestVsDebt(inputs)
  const second = compareInvestVsDebt(inputs)
  assert.deepEqual(first, second)
  assert.ok(first.probabilityInvestFirstAhead >= 0 && first.probabilityInvestFirstAhead <= 100)
  assert.ok(first.acceleratedPayoffMonths < inputs.remainingMonths)
  assert.ok(first.interestSavedByDebtFirst > 0)
})

test('zero volatility makes the Monte Carlo median agree closely with deterministic paths', () => {
  const result = compareInvestVsDebt({
    loanBalance: 100_000,
    loanApr: 5,
    remainingMonths: 120,
    extraMonthlyCash: 300,
    expectedReturn: 7,
    volatility: 0,
    scenarios: 200,
    seed: 'zero-volatility',
  })
  assert.ok(Math.abs(result.medianInvestFirst - result.deterministicInvestFirst) < 0.02)
  assert.ok(Math.abs(result.medianDebtFirst - result.deterministicDebtFirst) < 0.02)
})
