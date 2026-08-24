import {
  addMonths,
  calculateLoan,
  calculateScheduledPayment,
  compareLoanPlans,
  getLoanValidationErrors,
  roundLoanMoney,
  type LoanLumpSum,
} from '../loan/loan-engine'
import { calculatePercentile, createSeededRandom, normalRandom } from '../simulation/financial-utils'

export interface InvestVsDebtInputs {
  loanBalance: number
  loanApr: number
  remainingMonths: number
  firstPaymentMonth: string
  extraMonthlyCash: number
  lumpSums: LoanLumpSum[]
  expectedReturn: number
  volatility: number
  scenarios: number
  seed: string
}

export interface InvestVsDebtResult {
  scheduledLoanPayment: number
  acceleratedPayoffMonths: number
  interestSavedByDebtFirst: number
  deterministicInvestFirst: number
  deterministicDebtFirst: number
  deterministicDifference: number
  probabilityInvestFirstAhead: number
  medianInvestFirst: number
  medianDebtFirst: number
  p10Difference: number
  medianDifference: number
  p90Difference: number
  scenarios: number
}

export type InvestVsDebtProgressCallback = (completed: number, total: number) => void

const MAX_VOLATILITY = 200
const MIN_SCENARIOS = 100
const MAX_SCENARIOS = 100_000

export function getInvestVsDebtValidationErrors(inputs: InvestVsDebtInputs): string[] {
  const errors = getLoanValidationErrors({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: inputs.extraMonthlyCash,
    lumpSums: inputs.lumpSums,
  })

  if (inputs.extraMonthlyCash === 0 && inputs.lumpSums.length === 0) {
    errors.push('Enter monthly extra cash, at least one one-time payment, or both to compare the strategies.')
  }
  if (!Number.isFinite(inputs.expectedReturn) || inputs.expectedReturn <= -100 || inputs.expectedReturn > 100) {
    errors.push('Median geometric return assumption must be greater than -100% and no more than 100%.')
  }
  if (!Number.isFinite(inputs.volatility) || inputs.volatility < 0 || inputs.volatility > MAX_VOLATILITY) {
    errors.push('Volatility must be between 0% and 200%.')
  }
  if (!Number.isInteger(inputs.scenarios) || inputs.scenarios < MIN_SCENARIOS || inputs.scenarios > MAX_SCENARIOS) {
    errors.push(`Scenarios must be a whole number between ${MIN_SCENARIOS} and ${MAX_SCENARIOS}.`)
  }
  if (typeof inputs.seed !== 'string' || inputs.seed.length < 1 || inputs.seed.length > 100) {
    errors.push('Simulation seed must contain between 1 and 100 characters.')
  }
  return Array.from(new Set(errors))
}

function contributionSchedules(inputs: InvestVsDebtInputs) {
  const baseline = calculateLoan({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })
  const debtFirst = calculateLoan({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: inputs.extraMonthlyCash,
    lumpSums: inputs.lumpSums,
  })

  const oneTimeByMonth = new Map<string, number>()
  for (const payment of inputs.lumpSums) {
    oneTimeByMonth.set(payment.month, roundLoanMoney((oneTimeByMonth.get(payment.month) ?? 0) + payment.amount))
  }

  const scheduledPayment = baseline.scheduledPayment
  const investFirstContributions: number[] = []
  const debtFirstContributions: number[] = []

  for (let index = 0; index < inputs.remainingMonths; index += 1) {
    const month = addMonths(inputs.firstPaymentMonth, index)
    const oneTimeCash = oneTimeByMonth.get(month) ?? 0
    const scheduledActual = baseline.schedule[index]?.totalPayment ?? 0
    const debtActual = debtFirst.schedule[index]?.totalPayment ?? 0
    const monthlyBudget = roundLoanMoney(scheduledPayment + inputs.extraMonthlyCash + oneTimeCash)

    investFirstContributions.push(roundLoanMoney(
      inputs.extraMonthlyCash + oneTimeCash + Math.max(0, scheduledPayment - scheduledActual),
    ))
    debtFirstContributions.push(roundLoanMoney(Math.max(0, monthlyBudget - debtActual)))
  }

  return { baseline, debtFirst, investFirstContributions, debtFirstContributions }
}

function deterministicFutureValue(contributions: number[], annualReturnPct: number): number {
  const annual = annualReturnPct / 100
  const monthlyRate = Math.pow(1 + annual, 1 / 12) - 1
  let balance = 0
  for (const contribution of contributions) {
    balance = balance * (1 + monthlyRate) + contribution
  }
  return balance
}

export function compareInvestVsDebt(
  inputs: InvestVsDebtInputs,
  onProgress?: InvestVsDebtProgressCallback,
): InvestVsDebtResult {
  const errors = getInvestVsDebtValidationErrors(inputs)
  if (errors.length > 0) throw new Error(errors[0])

  const schedules = contributionSchedules(inputs)
  const deterministicInvestFirst = deterministicFutureValue(schedules.investFirstContributions, inputs.expectedReturn)
  const deterministicDebtFirst = deterministicFutureValue(schedules.debtFirstContributions, inputs.expectedReturn)
  const annual = inputs.expectedReturn / 100
  const drift = Math.log1p(annual) / 12
  const diffusion = (inputs.volatility / 100) * Math.sqrt(1 / 12)
  const investValues: number[] = []
  const debtValues: number[] = []
  const differences: number[] = []
  let investWins = 0
  const progressInterval = Math.max(1, Math.floor(inputs.scenarios / 100))

  for (let path = 0; path < inputs.scenarios; path += 1) {
    const random = createSeededRandom(`${inputs.seed}:path:${path}`)
    let investFirst = 0
    let debtFirst = 0

    for (let month = 0; month < inputs.remainingMonths; month += 1) {
      const factor = Math.exp(drift + diffusion * normalRandom(random))
      investFirst = investFirst * factor + schedules.investFirstContributions[month]
      debtFirst = debtFirst * factor + schedules.debtFirstContributions[month]
    }

    const difference = investFirst - debtFirst
    investValues.push(investFirst)
    debtValues.push(debtFirst)
    differences.push(difference)
    if (difference > 0) investWins += 1

    const completed = path + 1
    if (onProgress && (completed === inputs.scenarios || completed % progressInterval === 0)) {
      onProgress(completed, inputs.scenarios)
    }
  }

  investValues.sort((a, b) => a - b)
  debtValues.sort((a, b) => a - b)
  differences.sort((a, b) => a - b)
  const accelerated = compareLoanPlans({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: inputs.firstPaymentMonth,
    extraMonthlyPayment: inputs.extraMonthlyCash,
    lumpSums: inputs.lumpSums,
  })

  return {
    scheduledLoanPayment: calculateScheduledPayment(inputs.loanBalance, inputs.loanApr, inputs.remainingMonths),
    acceleratedPayoffMonths: schedules.debtFirst.paymentCount,
    interestSavedByDebtFirst: accelerated.interestSaved,
    deterministicInvestFirst: roundLoanMoney(deterministicInvestFirst),
    deterministicDebtFirst: roundLoanMoney(deterministicDebtFirst),
    deterministicDifference: roundLoanMoney(deterministicInvestFirst - deterministicDebtFirst),
    probabilityInvestFirstAhead: (investWins / inputs.scenarios) * 100,
    medianInvestFirst: roundLoanMoney(calculatePercentile(investValues, 0.5)),
    medianDebtFirst: roundLoanMoney(calculatePercentile(debtValues, 0.5)),
    p10Difference: roundLoanMoney(calculatePercentile(differences, 0.1)),
    medianDifference: roundLoanMoney(calculatePercentile(differences, 0.5)),
    p90Difference: roundLoanMoney(calculatePercentile(differences, 0.9)),
    scenarios: inputs.scenarios,
  }
}
