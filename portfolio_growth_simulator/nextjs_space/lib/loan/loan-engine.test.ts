import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addMonths,
  calculateLoan,
  calculateScheduledPayment,
  compareLoanPlans,
  getLoanValidationErrors,
  summarizeLoanByYear,
  type LoanInputs,
} from './loan-engine'
import {
  buildLoanShareUrl,
  cleanLoanShareDataFromUrl,
  parseLoanSharePayload,
  readLoanSharePayload,
} from './loan-share'

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
  const finalPayment = result.schedule[result.schedule.length - 1]
  assert.equal(result.scheduledPayment, 2212.24)
  assert.equal(result.paymentCount, 360)
  assert.equal(finalPayment?.endingBalance, 0)
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
  const finalPayment = result.schedule[result.schedule.length - 1]
  assert.equal(result.scheduledPayment, 333.33)
  assert.equal(result.totalInterest, 0)
  assert.equal(result.totalPaid, 1_000)
  assert.equal(finalPayment?.scheduledPayment, 333.34)
  assert.equal(finalPayment?.endingBalance, 0)
})

test('extra monthly principal shortens payoff and saves interest', () => {
  const comparison = compareLoanPlans({ ...baseLoan, extraMonthlyPayment: 300 })
  const finalPayment = comparison.accelerated.schedule[comparison.accelerated.schedule.length - 1]
  assert.ok(comparison.accelerated.paymentCount < comparison.baseline.paymentCount)
  assert.ok(comparison.monthsSaved > 0)
  assert.ok(comparison.interestSaved > 0)
  assert.equal(finalPayment?.endingBalance, 0)
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
  const finalPayment = comparison.accelerated.schedule[comparison.accelerated.schedule.length - 1]
  assert.ok(january)
  assert.ok(january.extraPrincipal > 0)
  assert.equal(finalPayment?.endingBalance, 0)
  assert.equal(comparison.accelerated.totalPrincipal, 10_000)
})

test('multiple one-time payments in the same month are combined safely', () => {
  const result = calculateLoan({
    ...baseLoan,
    principal: 50_000,
    termMonths: 60,
    lumpSums: [
      { id: 'bonus-a', month: '2027-01', amount: 1_000 },
      { id: 'bonus-b', month: '2027-01', amount: 500 },
    ],
  })
  const january = result.schedule.find((payment) => payment.month === '2027-01')
  assert.ok(january)
  assert.equal(january.extraPrincipal, 1_500)
})

test('one-time payments cannot be scheduled outside the contractual term', () => {
  const errors = getLoanValidationErrors({
    ...baseLoan,
    termMonths: 12,
    lumpSums: [{ id: 'too-late', month: '2027-09', amount: 1_000 }],
  })
  assert.ok(errors.includes('One-time payments must fall within the scheduled loan term.'))
})

test('calendar month helpers handle year boundaries', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', 24), '2028-01')
})

test('year summaries keep scheduled principal and extra principal separate and reconcile', () => {
  const result = calculateLoan({ ...baseLoan, termMonths: 24, extraMonthlyPayment: 100 })
  const years = summarizeLoanByYear(result.schedule)
  const finalYear = years[years.length - 1]
  assert.ok(years.length >= 2)

  const summarizedInterest = Math.round(years.reduce((sum, year) => sum + year.interest, 0) * 100) / 100
  const summarizedScheduledPrincipal = Math.round(years.reduce((sum, year) => sum + year.principal, 0) * 100) / 100
  const summarizedExtraPrincipal = Math.round(years.reduce((sum, year) => sum + year.extraPrincipal, 0) * 100) / 100

  assert.equal(summarizedInterest, result.totalInterest)
  assert.equal(Math.round((summarizedScheduledPrincipal + summarizedExtraPrincipal) * 100) / 100, result.totalPrincipal)
  for (const year of years) {
    assert.equal(
      Math.round((year.principal + year.interest + year.extraPrincipal) * 100) / 100,
      year.totalPayments,
    )
  }
  assert.equal(finalYear?.endingBalance, 0)
})

test('extreme supported APR and term remain bounded and finish without negative balances', () => {
  const result = calculateLoan({
    ...baseLoan,
    principal: 1_000_000_000,
    apr: 100,
    termMonths: 600,
  })
  const finalPayment = result.schedule[result.schedule.length - 1]
  assert.equal(finalPayment?.endingBalance, 0)
  assert.ok(result.schedule.every((payment) => payment.endingBalance >= 0 && payment.principal >= 0 && payment.interest >= 0))
})

test('loan share links validate currencies, reject duplicate payment ids, and clean consumed fragments', () => {
  const sharedUrl = buildLoanShareUrl(
    { ...baseLoan, lumpSums: [{ id: 'bonus', month: '2027-01', amount: 2_000 }] },
    'GBP',
    'https://portfoliosimulator.org/loan',
  )
  const parsedUrl = new URL(sharedUrl)
  const decoded = readLoanSharePayload({ hash: parsedUrl.hash } as Location)
  assert.equal(decoded?.displayCurrency, 'GBP')
  assert.equal(decoded?.loan.lumpSums[0]?.amount, 2_000)
  assert.equal(cleanLoanShareDataFromUrl(sharedUrl), '/loan')

  const fallbackUrl = buildLoanShareUrl(baseLoan, 'NOT-A-CURRENCY', 'https://portfoliosimulator.org/loan')
  const fallbackPayload = readLoanSharePayload({ hash: new URL(fallbackUrl).hash } as Location)
  assert.equal(fallbackPayload?.displayCurrency, 'USD')

  assert.equal(parseLoanSharePayload({
    v: 1,
    loan: {
      ...baseLoan,
      lumpSums: [
        { id: 'duplicate', month: '2027-01', amount: 100 },
        { id: 'duplicate', month: '2027-02', amount: 100 },
      ],
    },
  }), null)
})

test('scheduled payment formula rejects unusable inputs safely', () => {
  assert.equal(calculateScheduledPayment(-1, 5, 360), 0)
  assert.equal(calculateScheduledPayment(100_000, -1, 360), 0)
  assert.equal(calculateScheduledPayment(100_000, 5, 0), 0)
})

test('loan validation rejects terms that round the required monthly payment below one cent', () => {
  const errors = getLoanValidationErrors({
    ...baseLoan,
    principal: 1,
    apr: 0,
    termMonths: 600,
  })
  assert.ok(errors.includes('Loan amount is too small to produce a cent-level monthly payment for the selected term.'))
})
