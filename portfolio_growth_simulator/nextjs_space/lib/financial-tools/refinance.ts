import {
  addMonths,
  calculateLoan,
  getLoanValidationErrors,
  isValidMonth,
  roundLoanMoney,
  type LoanLumpSum,
  type LoanProjection,
} from '../loan/loan-engine'

export interface RefinanceInputs {
  balance: number
  currentApr: number
  remainingMonths: number
  currentExtraMonthlyPayment: number
  currentLumpSums: LoanLumpSum[]
  newApr: number
  newTermMonths: number
  closingCosts: number
  financeClosingCosts: boolean
  firstPaymentMonth: string
}

export interface RefinanceComparison {
  currentRequired: LoanProjection
  current: LoanProjection
  refinanced: LoanProjection
  hasCurrentAcceleration: boolean
  newLoanAmount: number
  currentRequiredRemainingCost: number
  currentRemainingCost: number
  refinancedRemainingCost: number
  monthlyPaymentSavings: number
  lifetimeSavings: number
  interestSavings: number
  estimatedBreakEvenMonths: number | null
  currentRequiredPayoffMonth: string
  currentPayoffMonth: string
  refinancedPayoffMonth: string
  payoffDifferenceMonths: number
}

const MAX_AMOUNT = 1_000_000_000
const MAX_APR = 100
const MAX_MONTHS = 600

export function getRefinanceValidationErrors(inputs: RefinanceInputs): string[] {
  const errors: string[] = []
  const validBalance = Number.isFinite(inputs.balance) && inputs.balance > 0 && inputs.balance <= MAX_AMOUNT
  const validCurrentApr = Number.isFinite(inputs.currentApr) && inputs.currentApr >= 0 && inputs.currentApr <= MAX_APR
  const validRemainingMonths = Number.isInteger(inputs.remainingMonths) && inputs.remainingMonths >= 1 && inputs.remainingMonths <= MAX_MONTHS
  const validFirstPaymentMonth = isValidMonth(inputs.firstPaymentMonth)

  if (!validBalance) {
    errors.push('Remaining balance must be greater than 0 and no more than 1,000,000,000.')
  }
  if (!validCurrentApr) {
    errors.push('Current APR must be between 0% and 100%.')
  }
  if (!validRemainingMonths) {
    errors.push('Remaining term must be between 1 and 600 months.')
  }
  if (!Number.isFinite(inputs.currentExtraMonthlyPayment) || inputs.currentExtraMonthlyPayment < 0 || inputs.currentExtraMonthlyPayment > MAX_AMOUNT) {
    errors.push('Current extra monthly payment must be 0 or greater and no more than 1,000,000,000.')
  }
  if (!Array.isArray(inputs.currentLumpSums) || inputs.currentLumpSums.length > 24) {
    errors.push('Current plan can include no more than 24 one-time payments.')
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
  if (!validFirstPaymentMonth) {
    errors.push('Choose a valid first payment month.')
  }

  if (
    inputs.financeClosingCosts
    && validBalance
    && Number.isFinite(inputs.closingCosts)
    && inputs.closingCosts >= 0
    && inputs.balance + inputs.closingCosts > MAX_AMOUNT
  ) {
    errors.push('Financed balance plus closing costs cannot exceed 1,000,000,000.')
  }

  if (
    validBalance
    && validCurrentApr
    && validRemainingMonths
    && validFirstPaymentMonth
    && Number.isFinite(inputs.currentExtraMonthlyPayment)
    && inputs.currentExtraMonthlyPayment >= 0
    && inputs.currentExtraMonthlyPayment <= MAX_AMOUNT
    && Array.isArray(inputs.currentLumpSums)
  ) {
    const currentLoanErrors = getLoanValidationErrors({
      principal: inputs.balance,
      apr: inputs.currentApr,
      termMonths: inputs.remainingMonths,
      firstPaymentMonth: inputs.firstPaymentMonth,
      extraMonthlyPayment: inputs.currentExtraMonthlyPayment,
      lumpSums: inputs.currentLumpSums,
    })
    for (const error of currentLoanErrors) {
      if (/one-time payment/i.test(error) && !errors.includes(error)) errors.push(error)
    }
  }

  return errors
}

export function compareRefinance(inputs: RefinanceInputs): RefinanceComparison {
  const errors = getRefinanceValidationErrors(inputs)
  if (errors.length > 0) throw new Error(errors[0])

  const currentRequired = calculateLoan({
    principal: inputs.balance,
    apr: inputs.currentApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })

  const current = calculateLoan({
    principal: inputs.balance,
    apr: inputs.currentApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: inputs.currentExtraMonthlyPayment,
    lumpSums: inputs.currentLumpSums,
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
  const currentRequiredRemainingCost = currentRequired.totalPaid
  const currentRemainingCost = current.totalPaid
  const refinancedRemainingCost = roundLoanMoney(refinanced.totalPaid + upfrontCost)
  const monthlyPaymentSavings = roundLoanMoney(currentRequired.scheduledPayment - refinanced.scheduledPayment)
  const lifetimeSavings = roundLoanMoney(currentRemainingCost - refinancedRemainingCost)
  const interestSavings = roundLoanMoney(current.totalInterest - refinanced.totalInterest)
  const estimatedBreakEvenMonths = inputs.financeClosingCosts
    ? null
    : inputs.closingCosts === 0
      ? 0
      : monthlyPaymentSavings > 0
        ? Math.ceil(inputs.closingCosts / monthlyPaymentSavings)
        : null

  return {
    currentRequired,
    current,
    refinanced,
    hasCurrentAcceleration: inputs.currentExtraMonthlyPayment > 0 || inputs.currentLumpSums.length > 0,
    newLoanAmount,
    currentRequiredRemainingCost,
    currentRemainingCost,
    refinancedRemainingCost,
    monthlyPaymentSavings,
    lifetimeSavings,
    interestSavings,
    estimatedBreakEvenMonths,
    currentRequiredPayoffMonth: currentRequired.payoffMonth,
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
