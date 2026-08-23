import { addMonths, calculateLoan, roundLoanMoney, type LoanProjection } from '../loan/loan-engine'

export interface RefinanceInputs {
  balance: number
  currentApr: number
  remainingMonths: number
  newApr: number
  newTermMonths: number
  closingCosts: number
  financeClosingCosts: boolean
  firstPaymentMonth: string
}

export interface RefinanceComparison {
  current: LoanProjection
  refinanced: LoanProjection
  newLoanAmount: number
  currentRemainingCost: number
  refinancedRemainingCost: number
  monthlyPaymentSavings: number
  lifetimeSavings: number
  interestSavings: number
  estimatedBreakEvenMonths: number | null
  currentPayoffMonth: string
  refinancedPayoffMonth: string
  payoffDifferenceMonths: number
}

const MAX_AMOUNT = 1_000_000_000
const MAX_APR = 100
const MAX_MONTHS = 600

export function getRefinanceValidationErrors(inputs: RefinanceInputs): string[] {
  const errors: string[] = []
  if (!Number.isFinite(inputs.balance) || inputs.balance <= 0 || inputs.balance > MAX_AMOUNT) {
    errors.push('Remaining balance must be greater than 0 and no more than 1,000,000,000.')
  }
  if (!Number.isFinite(inputs.currentApr) || inputs.currentApr < 0 || inputs.currentApr > MAX_APR) {
    errors.push('Current APR must be between 0% and 100%.')
  }
  if (!Number.isInteger(inputs.remainingMonths) || inputs.remainingMonths < 1 || inputs.remainingMonths > MAX_MONTHS) {
    errors.push('Remaining term must be between 1 and 600 months.')
  }
  if (!Number.isFinite(inputs.newApr) || inputs.newApr < 0 || inputs.newApr > MAX_APR) {
    errors.push('New APR must be between 0% and 100%.')
  }
  if (!Number.isInteger(inputs.newTermMonths) || inputs.newTermMonths < 1 || inputs.newTermMonths > MAX_MONTHS) {
    errors.push('New term must be between 1 and 600 months.')
  }
  if (!Number.isFinite(inputs.closingCosts) || inputs.closingCosts < 0 || inputs.closingCosts > MAX_AMOUNT) {
    errors.push('Closing costs must be 0 or greater and no more than 1,000,000,000.')
  }
  if (!/^\d{4}-\d{2}$/.test(inputs.firstPaymentMonth)) {
    errors.push('Choose a valid first payment month.')
  }
  return errors
}

export function compareRefinance(inputs: RefinanceInputs): RefinanceComparison {
  const errors = getRefinanceValidationErrors(inputs)
  if (errors.length > 0) throw new Error(errors[0])

  const current = calculateLoan({
    principal: inputs.balance,
    apr: inputs.currentApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })

  const newLoanAmount = roundLoanMoney(inputs.balance + (inputs.financeClosingCosts ? inputs.closingCosts : 0))
  const refinanced = calculateLoan({
    principal: newLoanAmount,
    apr: inputs.newApr,
    termMonths: inputs.newTermMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })

  const upfrontCost = inputs.financeClosingCosts ? 0 : inputs.closingCosts
  const currentRemainingCost = current.totalPaid
  const refinancedRemainingCost = roundLoanMoney(refinanced.totalPaid + upfrontCost)
  const monthlyPaymentSavings = roundLoanMoney(current.scheduledPayment - refinanced.scheduledPayment)
  const lifetimeSavings = roundLoanMoney(currentRemainingCost - refinancedRemainingCost)
  const interestSavings = roundLoanMoney(current.totalInterest - refinanced.totalInterest)
  const estimatedBreakEvenMonths = inputs.closingCosts === 0
    ? 0
    : monthlyPaymentSavings > 0
      ? Math.ceil(inputs.closingCosts / monthlyPaymentSavings)
      : null

  return {
    current,
    refinanced,
    newLoanAmount,
    currentRemainingCost,
    refinancedRemainingCost,
    monthlyPaymentSavings,
    lifetimeSavings,
    interestSavings,
    estimatedBreakEvenMonths,
    currentPayoffMonth: current.payoffMonth,
    refinancedPayoffMonth: refinanced.payoffMonth,
    payoffDifferenceMonths: current.paymentCount - refinanced.paymentCount,
  }
}

export function defaultRefinanceFirstPaymentMonth(now = new Date()): string {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const current = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`
  return addMonths(current, 1)
}
