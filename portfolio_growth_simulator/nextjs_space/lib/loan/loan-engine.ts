export interface LoanLumpSum {
  id: string
  month: string
  amount: number
}

export interface LoanInputs {
  principal: number
  apr: number
  termMonths: number
  firstPaymentMonth: string
  extraMonthlyPayment: number
  lumpSums: LoanLumpSum[]
}

export interface LoanPayment {
  paymentNumber: number
  month: string
  startingBalance: number
  scheduledPayment: number
  principal: number
  interest: number
  extraPrincipal: number
  totalPayment: number
  endingBalance: number
}

export interface LoanProjection {
  scheduledPayment: number
  totalInterest: number
  totalPaid: number
  totalPrincipal: number
  payoffMonth: string
  paymentCount: number
  schedule: LoanPayment[]
}

export interface LoanYearSummary {
  year: string
  startingBalance: number
  totalPayments: number
  principal: number
  interest: number
  extraPrincipal: number
  endingBalance: number
}

export interface LoanComparison {
  baseline: LoanProjection
  accelerated: LoanProjection
  interestSaved: number
  monthsSaved: number
}

const MAX_PRINCIPAL = 1_000_000_000
const MAX_APR = 100
const MAX_TERM_MONTHS = 600

export function roundLoanMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const [, month] = value.split('-').map(Number)
  return month >= 1 && month <= 12
}

function monthIndex(value: string): number {
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}

export function addMonths(value: string, offset: number): string {
  if (!isValidMonth(value)) throw new Error('Invalid month')
  const index = monthIndex(value) + offset
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`
}

export function getLoanValidationErrors(inputs: LoanInputs): string[] {
  const errors: string[] = []

  if (!Number.isFinite(inputs.principal) || inputs.principal <= 0 || inputs.principal > MAX_PRINCIPAL) {
    errors.push('Loan amount must be greater than 0 and no more than 1,000,000,000.')
  }
  if (!Number.isFinite(inputs.apr) || inputs.apr < 0 || inputs.apr > MAX_APR) {
    errors.push('APR must be between 0% and 100%.')
  }
  if (!Number.isInteger(inputs.termMonths) || inputs.termMonths < 1 || inputs.termMonths > MAX_TERM_MONTHS) {
    errors.push('Loan term must be between 1 and 600 months.')
  }
  if (!isValidMonth(inputs.firstPaymentMonth)) {
    errors.push('Choose a valid first payment month.')
  }
  if (!Number.isFinite(inputs.extraMonthlyPayment) || inputs.extraMonthlyPayment < 0 || inputs.extraMonthlyPayment > MAX_PRINCIPAL) {
    errors.push('Extra monthly payment must be 0 or greater.')
  }

  for (const payment of inputs.lumpSums) {
    if (!isValidMonth(payment.month)) {
      errors.push('Each one-time payment needs a valid month.')
      continue
    }
    if (isValidMonth(inputs.firstPaymentMonth) && monthIndex(payment.month) < monthIndex(inputs.firstPaymentMonth)) {
      errors.push('One-time payments cannot occur before the first payment month.')
    }
    if (!Number.isFinite(payment.amount) || payment.amount <= 0 || payment.amount > MAX_PRINCIPAL) {
      errors.push('Each one-time payment must be greater than 0.')
    }
  }

  return Array.from(new Set(errors))
}

export function calculateScheduledPayment(principal: number, apr: number, termMonths: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  if (!Number.isFinite(apr) || apr < 0) return 0
  if (!Number.isInteger(termMonths) || termMonths < 1) return 0

  if (apr === 0) return roundLoanMoney(principal / termMonths)

  const monthlyRate = apr / 100 / 12
  const factor = Math.pow(1 + monthlyRate, termMonths)
  const payment = principal * (monthlyRate * factor) / (factor - 1)
  return roundLoanMoney(payment)
}

export function calculateLoan(inputs: LoanInputs): LoanProjection {
  const errors = getLoanValidationErrors(inputs)
  if (errors.length > 0) throw new Error(errors[0])

  const scheduledPayment = calculateScheduledPayment(inputs.principal, inputs.apr, inputs.termMonths)
  const monthlyRate = inputs.apr / 100 / 12
  const oneTimeByMonth = new Map<string, number>()

  for (const payment of inputs.lumpSums) {
    oneTimeByMonth.set(
      payment.month,
      roundLoanMoney((oneTimeByMonth.get(payment.month) ?? 0) + payment.amount),
    )
  }

  const schedule: LoanPayment[] = []
  let balance = roundLoanMoney(inputs.principal)

  for (let index = 0; index < inputs.termMonths && balance > 0; index += 1) {
    const paymentNumber = index + 1
    const month = addMonths(inputs.firstPaymentMonth, index)
    const startingBalance = balance
    const interest = roundLoanMoney(startingBalance * monthlyRate)

    const amountDue = roundLoanMoney(startingBalance + interest)
    const scheduled = index === inputs.termMonths - 1
      ? amountDue
      : Math.min(scheduledPayment, amountDue)
    const principalFromScheduled = Math.min(
      startingBalance,
      roundLoanMoney(Math.max(0, scheduled - interest)),
    )
    const remainingAfterScheduled = roundLoanMoney(startingBalance - principalFromScheduled)
    const requestedExtra = roundLoanMoney(
      inputs.extraMonthlyPayment + (oneTimeByMonth.get(month) ?? 0),
    )
    const extraPrincipal = Math.min(remainingAfterScheduled, requestedExtra)
    const endingBalance = roundLoanMoney(Math.max(0, remainingAfterScheduled - extraPrincipal))
    const totalPayment = roundLoanMoney(scheduled + extraPrincipal)

    schedule.push({
      paymentNumber,
      month,
      startingBalance,
      scheduledPayment: roundLoanMoney(scheduled),
      principal: principalFromScheduled,
      interest,
      extraPrincipal,
      totalPayment,
      endingBalance,
    })

    balance = endingBalance
  }

  const totalInterest = roundLoanMoney(schedule.reduce((sum, payment) => sum + payment.interest, 0))
  const totalPaid = roundLoanMoney(schedule.reduce((sum, payment) => sum + payment.totalPayment, 0))
  const totalPrincipal = roundLoanMoney(
    schedule.reduce((sum, payment) => sum + payment.principal + payment.extraPrincipal, 0),
  )
  const finalPayment = schedule.length > 0 ? schedule[schedule.length - 1] : undefined

  return {
    scheduledPayment,
    totalInterest,
    totalPaid,
    totalPrincipal,
    payoffMonth: finalPayment?.month ?? inputs.firstPaymentMonth,
    paymentCount: schedule.length,
    schedule,
  }
}

export function compareLoanPlans(inputs: LoanInputs): LoanComparison {
  const baseline = calculateLoan({
    ...inputs,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })
  const accelerated = calculateLoan(inputs)

  return {
    baseline,
    accelerated,
    interestSaved: roundLoanMoney(Math.max(0, baseline.totalInterest - accelerated.totalInterest)),
    monthsSaved: Math.max(0, baseline.paymentCount - accelerated.paymentCount),
  }
}

export function summarizeLoanByYear(schedule: LoanPayment[]): LoanYearSummary[] {
  const summaries = new Map<string, LoanYearSummary>()

  for (const payment of schedule) {
    const year = payment.month.slice(0, 4)
    const existing = summaries.get(year)

    if (!existing) {
      summaries.set(year, {
        year,
        startingBalance: payment.startingBalance,
        totalPayments: payment.totalPayment,
        principal: roundLoanMoney(payment.principal + payment.extraPrincipal),
        interest: payment.interest,
        extraPrincipal: payment.extraPrincipal,
        endingBalance: payment.endingBalance,
      })
      continue
    }

    existing.totalPayments = roundLoanMoney(existing.totalPayments + payment.totalPayment)
    existing.principal = roundLoanMoney(existing.principal + payment.principal + payment.extraPrincipal)
    existing.interest = roundLoanMoney(existing.interest + payment.interest)
    existing.extraPrincipal = roundLoanMoney(existing.extraPrincipal + payment.extraPrincipal)
    existing.endingBalance = payment.endingBalance
  }

  return Array.from(summaries.values())
}
