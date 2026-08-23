import { calculateLoan, calculateScheduledPayment, compareLoanPlans, roundLoanMoney } from '../loan/loan-engine'
import { calculatePercentile, createSeededRandom, normalRandom } from '../simulation/financial-utils'

export interface InvestVsDebtInputs {
  loanBalance: number
  loanApr: number
  remainingMonths: number
  extraMonthlyCash: number
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

const MAX_AMOUNT = 1_000_000_000
const MAX_APR = 100
const MAX_MONTHS = 600
const MAX_VOLATILITY = 200
const MIN_SCENARIOS = 100
const MAX_SCENARIOS = 5_000

export function getInvestVsDebtValidationErrors(inputs: InvestVsDebtInputs): string[] {
  const errors: string[] = []
  if (!Number.isFinite(inputs.loanBalance) || inputs.loanBalance <= 0 || inputs.loanBalance > MAX_AMOUNT) {
    errors.push('Loan balance must be greater than 0 and no more than 1,000,000,000.')
  }
  if (!Number.isFinite(inputs.loanApr) || inputs.loanApr < 0 || inputs.loanApr > MAX_APR) {
    errors.push('Loan APR must be between 0% and 100%.')
  }
  if (!Number.isInteger(inputs.remainingMonths) || inputs.remainingMonths < 1 || inputs.remainingMonths > MAX_MONTHS) {
    errors.push('Remaining term must be between 1 and 600 months.')
  }
  if (!Number.isFinite(inputs.extraMonthlyCash) || inputs.extraMonthlyCash < 0 || inputs.extraMonthlyCash > MAX_AMOUNT) {
    errors.push('Extra monthly cash must be 0 or greater.')
  }
  if (!Number.isFinite(inputs.expectedReturn) || inputs.expectedReturn <= -100 || inputs.expectedReturn > 100) {
    errors.push('Expected investment return must be greater than -100% and no more than 100%.')
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
  return errors
}

function contributionSchedules(inputs: InvestVsDebtInputs) {
  const firstPaymentMonth = '2000-01'
  const baseline = calculateLoan({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth,
    extraMonthlyPayment: 0,
    lumpSums: [],
  })
  const debtFirst = calculateLoan({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth,
    extraMonthlyPayment: inputs.extraMonthlyCash,
    lumpSums: [],
  })

  const scheduledPayment = baseline.scheduledPayment
  const monthlyBudget = scheduledPayment + inputs.extraMonthlyCash
  const investFirstContributions: number[] = []
  const debtFirstContributions: number[] = []

  for (let index = 0; index < inputs.remainingMonths; index += 1) {
    const scheduledActual = baseline.schedule[index]?.totalPayment ?? 0
    const debtActual = debtFirst.schedule[index]?.totalPayment ?? 0

    investFirstContributions.push(roundLoanMoney(
      inputs.extraMonthlyCash + Math.max(0, scheduledPayment - scheduledActual),
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

export function compareInvestVsDebt(inputs: InvestVsDebtInputs): InvestVsDebtResult {
  const errors = getInvestVsDebtValidationErrors(inputs)
  if (errors.length > 0) throw new Error(errors[0])

  const schedules = contributionSchedules(inputs)
  const deterministicInvestFirst = deterministicFutureValue(
    schedules.investFirstContributions,
    inputs.expectedReturn,
  )
  const deterministicDebtFirst = deterministicFutureValue(
    schedules.debtFirstContributions,
    inputs.expectedReturn,
  )

  const annual = inputs.expectedReturn / 100
  const drift = Math.log1p(annual) / 12
  const diffusion = (inputs.volatility / 100) * Math.sqrt(1 / 12)
  const investValues: number[] = []
  const debtValues: number[] = []
  const differences: number[] = []
  let investWins = 0

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
  }

  investValues.sort((a, b) => a - b)
  debtValues.sort((a, b) => a - b)
  differences.sort((a, b) => a - b)
  const accelerated = compareLoanPlans({
    principal: inputs.loanBalance,
    apr: inputs.loanApr,
    termMonths: inputs.remainingMonths,
    firstPaymentMonth: '2000-01',
    extraMonthlyPayment: inputs.extraMonthlyCash,
    lumpSums: [],
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
