import {
  addMonths,
  calculateLoan,
  isValidMonth,
  roundLoanMoney,
  type LoanInputs,
  type LoanProjection,
} from '../loan/loan-engine'

export interface PayoffGoalEstimate {
  targetPayoffMonth: string
  targetPaymentCount: number
  requiredExtraMonthlyPayment: number
  additionalExtraMonthlyPayment: number
  currentPlanMeetsTarget: boolean
  projected: LoanProjection
}

function monthIndex(value: string): number {
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}

export function getPayoffGoalValidationErrors(inputs: LoanInputs, targetPayoffMonth: string): string[] {
  const errors: string[] = []
  if (!isValidMonth(targetPayoffMonth)) {
    errors.push('Choose a valid target payoff month.')
    return errors
  }
  if (!isValidMonth(inputs.firstPaymentMonth) || !Number.isInteger(inputs.termMonths) || inputs.termMonths < 1) {
    errors.push('Enter valid loan terms before setting a payoff goal.')
    return errors
  }

  const first = monthIndex(inputs.firstPaymentMonth)
  const target = monthIndex(targetPayoffMonth)
  const last = monthIndex(addMonths(inputs.firstPaymentMonth, inputs.termMonths - 1))
  if (target < first) errors.push('Target payoff cannot be before the first payment month.')
  if (target > last) errors.push('Target payoff must fall within the original scheduled loan term.')
  return errors
}

export function estimatePayoffGoal(inputs: LoanInputs, targetPayoffMonth: string): PayoffGoalEstimate {
  const errors = getPayoffGoalValidationErrors(inputs, targetPayoffMonth)
  if (errors.length > 0) throw new Error(errors[0])

  const targetPaymentCount = monthIndex(targetPayoffMonth) - monthIndex(inputs.firstPaymentMonth) + 1
  const currentProjection = calculateLoan(inputs)
  const noRecurringProjection = calculateLoan({ ...inputs, extraMonthlyPayment: 0 })

  if (noRecurringProjection.paymentCount <= targetPaymentCount) {
    return {
      targetPayoffMonth,
      targetPaymentCount,
      requiredExtraMonthlyPayment: 0,
      additionalExtraMonthlyPayment: 0,
      currentPlanMeetsTarget: currentProjection.paymentCount <= targetPaymentCount,
      projected: noRecurringProjection,
    }
  }

  let lowCents = 0
  let highCents = Math.ceil(inputs.principal * 100)

  while (lowCents < highCents) {
    const midpoint = Math.floor((lowCents + highCents) / 2)
    const projection = calculateLoan({ ...inputs, extraMonthlyPayment: midpoint / 100 })
    if (projection.paymentCount <= targetPaymentCount) {
      highCents = midpoint
    } else {
      lowCents = midpoint + 1
    }
  }

  const requiredExtraMonthlyPayment = roundLoanMoney(lowCents / 100)
  const projected = calculateLoan({ ...inputs, extraMonthlyPayment: requiredExtraMonthlyPayment })

  return {
    targetPayoffMonth,
    targetPaymentCount,
    requiredExtraMonthlyPayment,
    additionalExtraMonthlyPayment: roundLoanMoney(Math.max(0, requiredExtraMonthlyPayment - inputs.extraMonthlyPayment)),
    currentPlanMeetsTarget: currentProjection.paymentCount <= targetPaymentCount,
    projected,
  }
}
