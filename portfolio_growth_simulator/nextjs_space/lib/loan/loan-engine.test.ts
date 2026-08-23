import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addMonths,
  calculateLoan,
  calculateScheduledPayment,
  compareLoanPlans,
  summarizeLoanByYear,
  type LoanInputs,
} from './loan-engine'

const baseLoan: LoanInputs = {
  principal: 350_000,
  apr: 6.5,
  termMonths: 360,
  firstPaymentMonth: '2026-09',
  extraMonthlyPayment: 0,
  lumpSums: [],
}

test('standard 30-year loan amortizes to exactly zero', () => {
  const result = calculateLoan(baseLoan)
  assert.equal(result.scheduledPayment, 2212.24)
  assert.equal(result.paymentCount, 360)
  assert.equal(result.schedule.at(-1)?.endingBalance, 0)
  assert.equal(result.totalPrincipal, 350_000)
  assert.ok(result.totalInterest > 445_000 && result.totalInterest < 447_000)
})

test('zero-percent loan handles cent rounding and final payment adjustment', () => {
  const result = calculateLoan({
    ...baseLoan,
    principal: 1_000,
    apr: 0,
    termMonths: 3,
  })
  assert.equal(result.scheduledPayment, 333.33)
  assert.equal(result.totalInterest, 0)
  assert.equal(result.totalPaid, 1_000)
  assert.equal(result.schedule.at(-1)?.scheduledPayment, 333.34)
  assert.equal(result.schedule.at(-1)?.endingBalance, 0)
})

test('extra monthly principal shortens payoff and saves interest', () => {
  const comparison = compareLoanPlans({ ...baseLoan, extraMonthlyPayment: 300 })
  assert.ok(comparison.accelerated.paymentCount < comparison.baseline.paymentCount)
  assert.ok(comparison.monthsSaved > 0)
  assert.ok(comparison.interestSaved > 0)
  assert.equal(comparison.accelerated.schedule.at(-1)?.endingBalance, 0)
  assert.equal(comparison.accelerated.totalPrincipal, 350_000)
})

test('one-time payments apply in their selected month and cannot overpay principal', () => {
  const comparison = compareLoanPlans({
    ...baseLoan,
    principal: 10_000,
    termMonths: 60,
    lumpSums: [
      { id: 'bonus', month: '2027-01', amount: 9_000 },
      { id: 'oversized', month: '2027-02', amount: 99_000 },
    ],
  })
  const january = comparison.accelerated.schedule.find((payment) => payment.month === '2027-01')
  assert.ok(january)
  assert.ok(january.extraPrincipal > 0)
  assert.equal(comparison.accelerated.schedule.at(-1)?.endingBalance, 0)
  assert.equal(comparison.accelerated.totalPrincipal, 10_000)
})

test('calendar month helpers handle year boundaries', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', 24), '2028-01')
})

test('year summaries reconcile to the monthly schedule', () => {
  const result = calculateLoan({ ...baseLoan, termMonths: 24 })
  const years = summarizeLoanByYear(result.schedule)
  assert.ok(years.length >= 2)
  const summarizedInterest = Math.round(years.reduce((sum, year) => sum + year.interest, 0) * 100) / 100
  assert.equal(summarizedInterest, result.totalInterest)
  assert.equal(years.at(-1)?.endingBalance, 0)
})

test('scheduled payment formula rejects unusable inputs safely', () => {
  assert.equal(calculateScheduledPayment(-1, 5, 360), 0)
  assert.equal(calculateScheduledPayment(100_000, -1, 360), 0)
  assert.equal(calculateScheduledPayment(100_000, 5, 0), 0)
})
