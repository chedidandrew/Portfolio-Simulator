import type { SimulationParams } from '../types'
import type { DrawdownDurationPoint } from './drawdown-analysis'
import {
  MAX_CHART_POINTS,
  MAX_RECORDED_VALUES,
  annualReturnAfterIncomeTaxDrag,
  assertFiniteResult,
  assertMonteCarloWorkload,
  calculatePercentile,
  createSeededRandom,
  effectiveAnnualReturnFromInput,
  inflationFactor,
  mean,
  netLiquidationValue,
  normalRandom,
  normalizeTaxRate,
  poissonRandom,
  proportionalCapitalGainsTax,
  reduceBasisProportionally,
  stepsPerYear,
  toTodaysDollars,
} from './financial-utils'

export { calculatePercentile } from './financial-utils'

export interface InvestmentDataPoint {
  year: number
  initial: number
  contributions: number
  withdrawals: number
  total: number
  realInitial: number
  realContributions: number
  realWithdrawals: number
  realTotal: number
  netSpending?: number
  realNetSpending?: number
  taxesPaid?: number
  realTaxesPaid?: number
  withdrawalTaxes?: number
  realWithdrawalTaxes?: number
  incomeTaxDrag?: number
  realIncomeTaxDrag?: number
}

interface StressSchedule {
  multipliers: Float64Array
  eventCount: number
}

function createStressSchedule(
  totalSteps: number,
  periodsPerYear: number,
  durationYears: number,
  seed: string,
  enabled: boolean,
): StressSchedule {
  const multipliers = new Float64Array(totalSteps + 1)
  multipliers.fill(1)
  if (!enabled || totalSteps < 1) return { multipliers, eventCount: 0 }

  const random = createSeededRandom(seed)
  // Roughly 1.2 stress events per decade. A short horizon can legitimately have none.
  const eventCount = Math.min(12, poissonRandom(Math.max(0, durationYears) * 0.12, random))

  for (let event = 0; event < eventCount; event += 1) {
    const crashStep = 1 + Math.floor(random() * totalSteps)
    const decline = 0.15 + random() * 0.35
    const recoveredLossFraction = 0.35 + random() * 0.55
    const recoverySteps = Math.max(1, Math.round(periodsPerYear * (0.25 + random() * 0.75)))

    multipliers[crashStep] *= 1 - decline

    const afterCrash = 1 - decline
    const targetLevel = afterCrash + decline * recoveredLossFraction
    const recoveryMultiplier = Math.pow(targetLevel / afterCrash, 1 / recoverySteps)

    for (let offset = 1; offset <= recoverySteps; offset += 1) {
      const step = crashStep + offset
      if (step > totalSteps) break
      multipliers[step] *= recoveryMultiplier
    }
  }

  return { multipliers, eventCount }
}

function sorted(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

function percentileSet(values: number[]) {
  const s = sorted(values)
  return {
    p5: calculatePercentile(s, 0.05),
    p10: calculatePercentile(s, 0.10),
    p25: calculatePercentile(s, 0.25),
    p50: calculatePercentile(s, 0.50),
    p75: calculatePercentile(s, 0.75),
    p90: calculatePercentile(s, 0.90),
    p95: calculatePercentile(s, 0.95),
  }
}

export async function performMonteCarloSimulationAsync(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed?: string,
) {
  // The audited CPU implementation is the source of truth. The former WebGPU
  // implementation used Float32 arithmetic and had diverging tax/risk logic.
  // Yield once so React can paint its loading state before the synchronous work.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  return performMonteCarloSimulation(params, mode, seed)
}

export function performMonteCarloSimulation(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed = 'portfolio-simulator',
) {
  const {
    initialValue,
    startingCostBasis,
    expectedReturn,
    volatility,
    enableCrashRisk = false,
    duration,
    cashflowAmount,
    cashflowFrequency,
    inflationAdjustment = 0,
    excludeInflationAdjustment,
    numPaths,
    portfolioGoal,
    taxEnabled,
    taxRate = 0,
    taxType = 'capital_gains',
    calculationMode = 'effective',
  } = params

  if (!Number.isFinite(initialValue) || initialValue < 0) throw new Error('Initial portfolio value cannot be negative.')
  if (mode === 'withdrawal' && initialValue <= 0) throw new Error('Withdrawal simulations require a positive starting portfolio.')
  if (mode === 'growth' && initialValue === 0 && cashflowAmount <= 0) {
    throw new Error('Enter a starting portfolio or a positive contribution.')
  }
  if (!Number.isFinite(volatility) || volatility < 0) throw new Error('Volatility cannot be negative.')
  if (!Number.isFinite(cashflowAmount) || cashflowAmount < 0) throw new Error('Cashflow cannot be negative.')

  const periods = stepsPerYear(cashflowFrequency)
  const totalSteps = Math.max(1, Math.round(duration * periods))
  assertMonteCarloWorkload(numPaths, duration, periods)

  const postTaxReturnPct = annualReturnAfterIncomeTaxDrag(expectedReturn, taxEnabled, taxType, taxRate)
  const postTaxAnnual = effectiveAnnualReturnFromInput(postTaxReturnPct, periods, calculationMode)
  const preTaxAnnual = effectiveAnnualReturnFromInput(expectedReturn, periods, calculationMode)
  if (postTaxAnnual <= -1 || preTaxAnnual <= -1) throw new Error('The selected return produces an invalid logarithmic growth rate.')

  const dt = 1 / periods
  const sigma = volatility / 100
  const drift = Math.log1p(postTaxAnnual) * dt
  const driftPreTax = Math.log1p(preTaxAnnual) * dt
  const diffusion = sigma * Math.sqrt(dt)
  const inflator = inflationFactor(inflationAdjustment)
  const rate = normalizeTaxRate(taxRate)
  const isIncomeTax = Boolean(taxEnabled && taxType === 'income')

  const maxRecordedStepsByMemory = Math.max(1, Math.floor(MAX_RECORDED_VALUES / numPaths))
  const targetRecordedSteps = Math.max(1, Math.min(MAX_CHART_POINTS, maxRecordedStepsByMemory, totalSteps))
  const recordFrequency = Math.max(1, Math.ceil(totalSteps / targetRecordedSteps))
  const recordSteps: number[] = [0]
  for (let step = recordFrequency; step < totalSteps; step += recordFrequency) recordSteps.push(step)
  if (recordSteps[recordSteps.length - 1] !== totalSteps) recordSteps.push(totalSteps)

  const recordIndexByStep = new Map<number, number>()
  recordSteps.forEach((step, index) => recordIndexByStep.set(step, index))

  const netDistributions = recordSteps.map(() => [] as number[])
  const grossDistributions = recordSteps.map(() => [] as number[])
  const cagrDistributions = recordSteps.map(() => [] as number[])
  const grossWithdrawalDistributions = recordSteps.map(() => [] as number[])
  const netSpendingDistributions = recordSteps.map(() => [] as number[])
  const taxPaidDistributions = recordSteps.map(() => [] as number[])
  const grossWithdrawalRealDistributions = recordSteps.map(() => [] as number[])
  const netSpendingRealDistributions = recordSteps.map(() => [] as number[])
  const taxPaidRealDistributions = recordSteps.map(() => [] as number[])
  const survivalDistributions = recordSteps.map(() => [] as number[])

  const endingValues: number[] = []
  const endingValuesGross: number[] = []
  const maxDrawdowns: number[] = []
  const maxDrawdownDurations: DrawdownDurationPoint[] = []
  const depletionYears: Array<number | null> = []
  const finalPerformanceValues: number[] = []
  const lowestPerformanceValues: number[] = []
  const totalGrossWithdrawals: number[] = []
  const totalNetSpending: number[] = []
  const totalTaxesPaid: number[] = []
  const totalTaxWithheld: number[] = []
  const totalIncomeTaxDrag: number[] = []
  const remainingEmbeddedTaxes: number[] = []
  const totalModeledTaxCosts: number[] = []
  const totalGrossWithdrawalsReal: number[] = []
  const totalNetSpendingReal: number[] = []
  const totalTaxesPaidReal: number[] = []
  const totalTaxWithheldReal: number[] = []
  const totalIncomeTaxDragReal: number[] = []
  const remainingEmbeddedTaxesReal: number[] = []
  const totalModeledTaxCostsReal: number[] = []

  let pathsEndingAtOrAboveGoal = 0
  let pathsProfitable = 0
  let pathsSolvent = 0

  const startingBasis = Math.max(0, startingCostBasis ?? initialValue)
  const baseSeed = seed || 'portfolio-simulator'

  for (let path = 0; path < numPaths; path += 1) {
    const random = createSeededRandom(`${baseSeed}:path:${path}`)
    const stress = createStressSchedule(totalSteps, periods, duration, `${baseSeed}:stress:${path}`, enableCrashRisk)

    let currentValue = initialValue
    let preTaxValue = initialValue
    let basis = startingBasis
    let performanceBasis = initialValue
    let currentCashflow = cashflowAmount
    let performanceIndex = 1
    let performancePeak = 1
    let performancePeakStep = 0
    let performanceLow = 1
    let maxDrawdown = 0
    let maxDrawdownPeakValue = 1
    let maxDrawdownPeakStep = 0
    let maxDrawdownTroughStep = 0
    let maxDrawdownRecoveryStep: number | null = null
    let pathDepletionYear: number | null = null
    let grossWithdrawn = 0
    let netSpending = 0
    let taxesPaid = 0
    let taxWithheld = 0
    let incomeTaxDrag = 0
    let grossWithdrawnReal = 0
    let netSpendingReal = 0
    let taxesPaidReal = 0
    let taxWithheldReal = 0
    let incomeTaxDragReal = 0
    let pathMetAllWithdrawals = true

    netDistributions[0].push(netLiquidationValue({ balance: currentValue, basis, taxEnabled, taxType, taxRate }))
    grossDistributions[0].push(isIncomeTax ? preTaxValue : currentValue)
    cagrDistributions[0].push(0)
    grossWithdrawalDistributions[0].push(0)
    netSpendingDistributions[0].push(0)
    taxPaidDistributions[0].push(0)
    grossWithdrawalRealDistributions[0].push(0)
    netSpendingRealDistributions[0].push(0)
    taxPaidRealDistributions[0].push(0)
    survivalDistributions[0].push(1)

    for (let step = 1; step <= totalSteps; step += 1) {
      const yearsElapsed = step / periods
      const z = normalRandom(random)
      const stressMultiplier = stress.multipliers[step]
      const growthFactor = Math.exp(drift + diffusion * z) * stressMultiplier
      const preTaxGrowthFactor = Math.exp(driftPreTax + diffusion * z) * stressMultiplier
      const incomeDragDifferenceBefore = isIncomeTax ? preTaxValue - currentValue : 0

      performanceIndex *= growthFactor
      if (
        maxDrawdown > 1e-12
        && maxDrawdownRecoveryStep === null
        && step > maxDrawdownTroughStep
        && performanceIndex >= maxDrawdownPeakValue
      ) {
        maxDrawdownRecoveryStep = step
      }
      performanceLow = Math.min(performanceLow, performanceIndex)
      if (performanceIndex > performancePeak) {
        performancePeak = performanceIndex
        performancePeakStep = step
      }
      if (performancePeak > 0) {
        const drawdown = (performancePeak - performanceIndex) / performancePeak
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown
          maxDrawdownPeakValue = performancePeak
          maxDrawdownPeakStep = performancePeakStep
          maxDrawdownTroughStep = step
          maxDrawdownRecoveryStep = null
        }
      }

      if (mode === 'growth') {
        currentValue *= growthFactor
        if (isIncomeTax) preTaxValue *= preTaxGrowthFactor

        if (currentCashflow > 0) {
          currentValue += currentCashflow
          if (isIncomeTax) preTaxValue += currentCashflow
          basis += currentCashflow
          performanceBasis += currentCashflow
        }
      } else {
        const beforeWithdrawal = currentValue
        const grossWithdrawal = Math.min(beforeWithdrawal, currentCashflow)
        if (grossWithdrawal + 1e-9 < currentCashflow) {
          pathMetAllWithdrawals = false
          if (pathDepletionYear === null) pathDepletionYear = Math.ceil(step / periods)
        }
        let withholding = 0
        if (taxEnabled && taxType === 'tax_deferred') withholding = grossWithdrawal * rate
        if (taxEnabled && taxType === 'capital_gains') {
          withholding = proportionalCapitalGainsTax(beforeWithdrawal, basis, grossWithdrawal, taxRate)
          basis = reduceBasisProportionally(beforeWithdrawal, basis, grossWithdrawal)
        }
        const netReceived = Math.max(0, grossWithdrawal - withholding)

        currentValue = Math.max(0, currentValue - grossWithdrawal) * growthFactor
        if (isIncomeTax) preTaxValue = Math.max(0, preTaxValue - Math.min(preTaxValue, grossWithdrawal)) * preTaxGrowthFactor

        // Income-tax drag is measured from the no-drag comparison at the end of
        // the path. Transaction withholding is tracked at the time it occurs.
        grossWithdrawn += grossWithdrawal
        netSpending += netReceived
        taxesPaid += withholding
        taxWithheld += withholding
        grossWithdrawnReal += toTodaysDollars(grossWithdrawal, inflationAdjustment, yearsElapsed)
        netSpendingReal += toTodaysDollars(netReceived, inflationAdjustment, yearsElapsed)
        const withholdingReal = toTodaysDollars(withholding, inflationAdjustment, yearsElapsed)
        taxesPaidReal += withholdingReal
        taxWithheldReal += withholdingReal
      }

      if (isIncomeTax) {
        const incomeDragDifferenceAfter = preTaxValue - currentValue
        const dragChange = incomeDragDifferenceAfter - incomeDragDifferenceBefore
        incomeTaxDrag += dragChange
        incomeTaxDragReal += toTodaysDollars(dragChange, inflationAdjustment, yearsElapsed)
      }

      assertFiniteResult(currentValue, 'Monte Carlo portfolio value')
      if (isIncomeTax) assertFiniteResult(preTaxValue, 'Monte Carlo pre-tax comparison value')

      const recordIndex = recordIndexByStep.get(step)
      if (recordIndex !== undefined) {
        const netValue = netLiquidationValue({ balance: currentValue, basis, taxEnabled, taxType, taxRate })
        const grossValue = isIncomeTax ? preTaxValue : currentValue
        netDistributions[recordIndex].push(netValue)
        grossDistributions[recordIndex].push(grossValue)
        const cagr = yearsElapsed > 0 ? Math.pow(performanceIndex, 1 / yearsElapsed) - 1 : 0
        cagrDistributions[recordIndex].push(cagr * 100)
        grossWithdrawalDistributions[recordIndex].push(grossWithdrawn)
        netSpendingDistributions[recordIndex].push(netSpending)
        taxPaidDistributions[recordIndex].push(taxesPaid + (isIncomeTax ? incomeTaxDrag : 0))
        grossWithdrawalRealDistributions[recordIndex].push(grossWithdrawnReal)
        netSpendingRealDistributions[recordIndex].push(netSpendingReal)
        taxPaidRealDistributions[recordIndex].push(taxesPaidReal + (isIncomeTax ? incomeTaxDragReal : 0))
        survivalDistributions[recordIndex].push(pathMetAllWithdrawals ? 1 : 0)
      }

      if (step % periods === 0 && !excludeInflationAdjustment) currentCashflow *= inflator
    }

    const endingNet = netLiquidationValue({ balance: currentValue, basis, taxEnabled, taxType, taxRate })
    const endingGross = isIncomeTax ? preTaxValue : currentValue
    endingValues.push(endingNet)
    endingValuesGross.push(endingGross)
    maxDrawdowns.push(maxDrawdown)

    let drawdownRecovered = true
    let drawdownDurationSteps = 0
    if (maxDrawdown > 1e-12) {
      if (maxDrawdownRecoveryStep !== null) {
        drawdownDurationSteps = Math.max(0, maxDrawdownRecoveryStep - maxDrawdownPeakStep)
      } else {
        drawdownRecovered = false
        drawdownDurationSteps = Math.max(0, totalSteps - maxDrawdownPeakStep)
      }
    }
    maxDrawdownDurations.push({
      maxDrawdown,
      durationYears: drawdownDurationSteps / periods,
      recovered: drawdownRecovered,
    })
    depletionYears.push(mode === 'withdrawal' ? pathDepletionYear : null)
    finalPerformanceValues.push(performanceIndex)
    lowestPerformanceValues.push(performanceLow)

    if (isIncomeTax) {
      incomeTaxDrag = Math.max(0, incomeTaxDrag)
      incomeTaxDragReal = Math.max(0, incomeTaxDragReal)
      taxesPaid += incomeTaxDrag
      taxesPaidReal += incomeTaxDragReal
    }

    totalGrossWithdrawals.push(grossWithdrawn)
    totalNetSpending.push(netSpending)
    totalTaxesPaid.push(taxesPaid)
    const remainingEmbeddedTax = taxType === 'income'
      ? 0
      : Math.max(0, endingGross - endingNet)
    const remainingEmbeddedTaxReal = toTodaysDollars(remainingEmbeddedTax, inflationAdjustment, duration)

    totalTaxWithheld.push(taxWithheld)
    totalIncomeTaxDrag.push(incomeTaxDrag)
    remainingEmbeddedTaxes.push(remainingEmbeddedTax)
    totalModeledTaxCosts.push(taxesPaid + remainingEmbeddedTax)
    totalGrossWithdrawalsReal.push(grossWithdrawnReal)
    totalNetSpendingReal.push(netSpendingReal)
    totalTaxesPaidReal.push(taxesPaidReal)
    totalTaxWithheldReal.push(taxWithheldReal)
    totalIncomeTaxDragReal.push(incomeTaxDragReal)
    remainingEmbeddedTaxesReal.push(remainingEmbeddedTaxReal)
    totalModeledTaxCostsReal.push(taxesPaidReal + remainingEmbeddedTaxReal)

    if (portfolioGoal && endingNet >= portfolioGoal) pathsEndingAtOrAboveGoal += 1
    if (mode === 'growth' && endingNet > performanceBasis) pathsProfitable += 1
    if (mode === 'withdrawal' ? pathMetAllWithdrawals : currentValue > 0.01) pathsSolvent += 1
  }

  const netSorted = sorted(endingValues)
  const grossSorted = sorted(endingValuesGross)
  const netP = percentileSet(netSorted)
  const grossP = percentileSet(grossSorted)

  const chartData = netDistributions.map((values, index) => {
    const p = percentileSet(values)
    return { year: recordSteps[index] / periods, p10: p.p10, p25: p.p25, p50: p.p50, p75: p.p75, p90: p.p90 }
  })
  const chartDataGross = grossDistributions.map((values, index) => {
    const p = percentileSet(values)
    return { year: recordSteps[index] / periods, p10: p.p10, p25: p.p25, p50: p.p50, p75: p.p75, p90: p.p90 }
  })

  const annualReturnsData = cagrDistributions.slice(1).map((values, offset) => {
    const s = sorted(values)
    const p = percentileSet(s)
    const probabilityAtLeast = (threshold: number) => values.length
      ? values.filter((value) => value >= threshold).length / values.length * 100
      : 0
    return {
      year: recordSteps[offset + 1] / periods,
      p10: p.p10,
      p25: p.p25,
      median: p.p50,
      p75: p.p75,
      p90: p.p90,
      prob5: probabilityAtLeast(5),
      prob8: probabilityAtLeast(8),
      prob10: probabilityAtLeast(10),
      prob12: probabilityAtLeast(12),
      prob15: probabilityAtLeast(15),
      prob20: probabilityAtLeast(20),
      prob25: probabilityAtLeast(25),
      prob30: probabilityAtLeast(30),
    }
  })

  const lossThresholds = [2.5, 5, 10, 15, 20, 30, 50]
  const lossProbData = lossThresholds.map((threshold) => ({
    threshold: `>= ${threshold}%`,
    endPeriod: finalPerformanceValues.filter((value) => (1 - value) * 100 >= threshold).length / numPaths * 100,
    intraPeriod: lowestPerformanceValues.filter((value) => (1 - value) * 100 >= threshold).length / numPaths * 100,
  }))

  const investmentData: InvestmentDataPoint[] = []

  if (mode === 'growth') {
    let scheduledCashflow = cashflowAmount
    let cumulativeContributions = 0
    let realContributions = 0
    const recordSet = new Set(recordSteps)

    investmentData.push({
      year: 0,
      initial: initialValue,
      contributions: 0,
      withdrawals: 0,
      total: initialValue,
      realInitial: initialValue,
      realContributions: 0,
      realWithdrawals: 0,
      realTotal: initialValue,
    })

    for (let step = 1; step <= totalSteps; step += 1) {
      const yearsElapsed = step / periods
      cumulativeContributions += scheduledCashflow
      realContributions += toTodaysDollars(scheduledCashflow, inflationAdjustment, yearsElapsed)

      if (recordSet.has(step)) {
        investmentData.push({
          year: yearsElapsed,
          initial: initialValue,
          contributions: cumulativeContributions,
          withdrawals: 0,
          total: initialValue + cumulativeContributions,
          realInitial: initialValue,
          realContributions,
          realWithdrawals: 0,
          realTotal: initialValue + realContributions,
        })
      }

      if (step % periods === 0 && !excludeInflationAdjustment) scheduledCashflow *= inflator
    }
  } else {
    for (let index = 0; index < recordSteps.length; index += 1) {
      const medianOf = (values: number[]) => calculatePercentile(sorted(values), 0.5)
      const gross = medianOf(grossWithdrawalDistributions[index])
      const spending = medianOf(netSpendingDistributions[index])
      const tax = medianOf(taxPaidDistributions[index])
      const grossReal = medianOf(grossWithdrawalRealDistributions[index])
      const spendingReal = medianOf(netSpendingRealDistributions[index])
      const taxReal = medianOf(taxPaidRealDistributions[index])
      // Component-wise medians do not generally add exactly. For retirement
      // cashflow presentation, derive transaction tax from the displayed gross
      // and spendable medians so the accounting identity remains exact. Income
      // tax drag is a portfolio-return cost rather than withdrawal withholding.
      const withdrawalTax = Math.max(0, gross - spending)
      const withdrawalTaxReal = Math.max(0, grossReal - spendingReal)
      const incomeDrag = isIncomeTax ? Math.max(0, tax) : 0
      const incomeDragReal = isIncomeTax ? Math.max(0, taxReal) : 0
      investmentData.push({
        year: recordSteps[index] / periods,
        initial: initialValue,
        contributions: 0,
        withdrawals: gross,
        total: initialValue,
        realInitial: initialValue,
        realContributions: 0,
        realWithdrawals: grossReal,
        realTotal: initialValue,
        netSpending: spending,
        realNetSpending: spendingReal,
        withdrawalTaxes: withdrawalTax,
        realWithdrawalTaxes: withdrawalTaxReal,
        incomeTaxDrag: incomeDrag,
        realIncomeTaxDrag: incomeDragReal,
        taxesPaid: withdrawalTax + incomeDrag,
        realTaxesPaid: withdrawalTaxReal + incomeDragReal,
      })
    }
  }

  const deterministic = createDeterministicPath(params, mode, recordSteps, periods)
  const solvencySeries = mode === 'withdrawal'
    ? survivalDistributions.map((values, index) => ({
        year: recordSteps[index] / periods,
        solventRate: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length * 100 : 100,
      }))
    : netDistributions.map((values, index) => ({
        year: recordSteps[index] / periods,
        solventRate: values.filter((value) => value > 0.01).length / numPaths * 100,
      }))

  const taxDragAmount = Math.max(0, mean(endingValuesGross) - mean(endingValues))
  const sortedDrawdowns = sorted(maxDrawdowns)
  const medianDrawdown = calculatePercentile(sortedDrawdowns, 0.5)
  const worstDrawdown = sortedDrawdowns[sortedDrawdowns.length - 1] ?? 0
  const spreadRatio = netP.p5 > 0 ? netP.p95 / netP.p5 : 0
  const hasDepletion = chartData.some((point) => point.p10 <= 0 || point.p25 <= 0 || point.p50 <= 0)
  const growthRatio = initialValue > 0 ? netP.p90 / initialValue : 0
  const depletedYears = mode === 'withdrawal'
    ? depletionYears.filter((year): year is number => year !== null).sort((left, right) => left - right)
    : []
  const medianDepletionYear = depletedYears.length
    ? calculatePercentile(depletedYears, 0.5)
    : null
  const worst10DepletionYear = depletedYears.length
    ? calculatePercentile(depletedYears, 0.1)
    : null
  const neverDepletedRate = mode === 'withdrawal'
    ? depletionYears.filter((year) => year === null).length / numPaths * 100
    : 100
  const survivalRate = pathsSolvent / numPaths * 100

  // Retirement cashflow components are also exposed from one actual simulated
  // path: the path whose ending spendable value is closest to the median ending
  // value. This keeps gross withdrawals, spendable cash, transaction taxes and
  // modeled tax drag internally reconcilable instead of mixing independent
  // marginal medians from different paths.
  let representativePathIndex = -1
  if (mode === 'withdrawal' && endingValues.length > 0) {
    let closestDistance = Number.POSITIVE_INFINITY
    endingValues.forEach((value, index) => {
      const distance = Math.abs(value - netP.p50)
      if (distance < closestDistance) {
        closestDistance = distance
        representativePathIndex = index
      }
    })
  }

  const representativeCashflowBreakdown = representativePathIndex >= 0
    ? {
        basis: 'path-closest-to-median-ending-value' as const,
        endingValue: endingValues[representativePathIndex],
        endingValueGross: endingValuesGross[representativePathIndex],
        grossWithdrawn: totalGrossWithdrawals[representativePathIndex],
        netSpending: totalNetSpending[representativePathIndex],
        withdrawalTaxes: totalTaxWithheld[representativePathIndex],
        incomeTaxDrag: totalIncomeTaxDrag[representativePathIndex],
        taxesPaid: totalTaxesPaid[representativePathIndex],
        remainingEmbeddedTax: remainingEmbeddedTaxes[representativePathIndex],
        totalTaxCost: totalModeledTaxCosts[representativePathIndex],
        grossWithdrawnInTodaysDollars: totalGrossWithdrawalsReal[representativePathIndex],
        netSpendingInTodaysDollars: totalNetSpendingReal[representativePathIndex],
        withdrawalTaxesInTodaysDollars: totalTaxWithheldReal[representativePathIndex],
        incomeTaxDragInTodaysDollars: totalIncomeTaxDragReal[representativePathIndex],
        taxesPaidInTodaysDollars: totalTaxesPaidReal[representativePathIndex],
        remainingEmbeddedTaxInTodaysDollars: remainingEmbeddedTaxesReal[representativePathIndex],
        totalTaxCostInTodaysDollars: totalModeledTaxCostsReal[representativePathIndex],
      }
    : null

  return {
    endingValues,
    endingValuesGross,
    maxDrawdowns,
    maxDrawdownDurations,
    depletionYears,
    annualReturnsData,
    lossProbData,
    investmentData,
    chartData,
    chartDataGross,
    solvencySeries,
    deterministicSeries: deterministic.netSeries,
    deterministicSeriesGross: deterministic.grossSeries,
    deterministicYearData: deterministic.yearData,
    representativeCashflowBreakdown,
    taxDragAmount,
    totalTaxWithheld: mode === 'withdrawal'
      ? calculatePercentile(sorted(totalTaxWithheld), 0.5)
      : 0,
    totalTaxWithheldInTodaysDollars: mode === 'withdrawal'
      ? calculatePercentile(sorted(totalTaxWithheldReal), 0.5)
      : 0,
    totalTaxDrag: mode === 'withdrawal'
      ? calculatePercentile(sorted(totalIncomeTaxDrag), 0.5)
      : taxDragAmount,
    totalTaxDragInTodaysDollars: mode === 'withdrawal'
      ? calculatePercentile(sorted(totalIncomeTaxDragReal), 0.5)
      : (isIncomeTax ? mean(totalIncomeTaxDragReal) : 0),
    remainingEmbeddedTax: mode === 'withdrawal'
      ? calculatePercentile(sorted(remainingEmbeddedTaxes), 0.5)
      : (isIncomeTax ? 0 : taxDragAmount),
    remainingEmbeddedTaxInTodaysDollars: mode === 'withdrawal'
      ? calculatePercentile(sorted(remainingEmbeddedTaxesReal), 0.5)
      : (isIncomeTax ? 0 : toTodaysDollars(taxDragAmount, inflationAdjustment, duration)),
    totalTaxCost: mode === 'withdrawal'
      ? calculatePercentile(sorted(totalModeledTaxCosts), 0.5)
      : taxDragAmount,
    totalTaxCostInTodaysDollars: mode === 'withdrawal'
      ? calculatePercentile(sorted(totalModeledTaxCostsReal), 0.5)
      : (isIncomeTax ? mean(totalIncomeTaxDragReal) : toTodaysDollars(taxDragAmount, inflationAdjustment, duration)),
    medianGrossWithdrawn: calculatePercentile(sorted(totalGrossWithdrawals), 0.5),
    medianNetSpending: calculatePercentile(sorted(totalNetSpending), 0.5),
    medianTaxesPaid: calculatePercentile(sorted(totalTaxesPaid), 0.5),
    medianGrossWithdrawnInTodaysDollars: calculatePercentile(sorted(totalGrossWithdrawalsReal), 0.5),
    medianNetSpendingInTodaysDollars: calculatePercentile(sorted(totalNetSpendingReal), 0.5),
    medianTaxesPaidInTodaysDollars: calculatePercentile(sorted(totalTaxesPaidReal), 0.5),
    mean: mean(endingValues),
    meanGross: mean(endingValuesGross),
    median: netP.p50,
    medianGross: grossP.p50,
    p5: netP.p5,
    p5Gross: grossP.p5,
    p10: netP.p10,
    p10Gross: grossP.p10,
    p25: netP.p25,
    p25Gross: grossP.p25,
    p75: netP.p75,
    p75Gross: grossP.p75,
    p90: netP.p90,
    p90Gross: grossP.p90,
    p95: netP.p95,
    p95Gross: grossP.p95,
    best: netSorted[netSorted.length - 1] ?? 0,
    bestGross: grossSorted[grossSorted.length - 1] ?? 0,
    worst: netSorted[0] ?? 0,
    worstGross: grossSorted[0] ?? 0,
    endingAtOrAboveGoalProbability: portfolioGoal ? pathsEndingAtOrAboveGoal / numPaths * 100 : 0,
    pathsEndingAtOrAboveGoal,
    profitableRate: mode === 'growth' ? pathsProfitable / numPaths * 100 : 0,
    solventRate: survivalRate,
    survivalRate,
    runningOutProbability: mode === 'withdrawal' ? 100 - survivalRate : 0,
    medianDepletionYear,
    worst10DepletionYear,
    neverDepletedRate,
    numPathsUsed: numPaths,
    recommendLogLinear: !hasDepletion && growthRatio > 20,
    recommendLogHistogram: spreadRatio > 15,
    recommendLogDrawdown: medianDrawdown < 0.1 && worstDrawdown > 0.6,
    portfolioGoalSnapshot: portfolioGoal,
    performanceBasisAtEnd: investmentData[investmentData.length - 1]?.total ?? initialValue,
    hasDepletion,
    engine: 'audited-cpu-float64',
  }
}

export type SimulationResults = ReturnType<typeof performMonteCarloSimulation>

function createDeterministicPath(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  recordSteps: number[],
  periods: number,
) {
  const afterTaxReturnPct = annualReturnAfterIncomeTaxDrag(
    params.expectedReturn,
    params.taxEnabled,
    params.taxType,
    params.taxRate,
  )
  const afterTaxAnnual = effectiveAnnualReturnFromInput(afterTaxReturnPct, periods, params.calculationMode)
  const grossAnnual = effectiveAnnualReturnFromInput(params.expectedReturn, periods, params.calculationMode)
  const netGrowth = Math.pow(1 + afterTaxAnnual, 1 / periods)
  const grossGrowth = Math.pow(1 + grossAnnual, 1 / periods)
  const inflator = inflationFactor(params.inflationAdjustment)
  const taxRate = normalizeTaxRate(params.taxRate)
  const startingBasis = Math.max(0, params.startingCostBasis ?? params.initialValue)
  const totalSteps = Math.max(1, Math.round(params.duration * periods))
  const recordSet = new Set(recordSteps)

  let balance = params.initialValue
  let grossComparison = params.initialValue
  let basis = startingBasis
  let cashflow = params.cashflowAmount
  let yearStartGross = balance
  let yearGrossWithdrawals = 0
  let yearNetIncome = 0
  let yearTax = 0
  let allScheduledWithdrawalsFulfilled = true

  const netSeries: Array<{ year: number; value: number }> = [
    { year: 0, value: netLiquidationValue({ balance, basis, taxEnabled: params.taxEnabled, taxType: params.taxType, taxRate: params.taxRate }) },
  ]
  const grossSeries: Array<{ year: number; value: number }> = [{ year: 0, value: grossComparison }]
  const yearData: Array<{
    year: number
    startingBalance: number
    withdrawals: number
    netIncome: number
    taxPaid: number
    endingBalance: number
    isSustainable: boolean
  }> = []

  for (let step = 1; step <= totalSteps; step += 1) {
    if (mode === 'growth') {
      balance *= netGrowth
      grossComparison *= grossGrowth
      balance += cashflow
      grossComparison += cashflow
      basis += cashflow
    } else {
      const before = balance
      const grossWithdrawal = Math.min(balance, cashflow)
      if (grossWithdrawal + 1e-9 < cashflow) allScheduledWithdrawalsFulfilled = false
      let tax = 0
      if (params.taxEnabled && params.taxType === 'tax_deferred') tax = grossWithdrawal * taxRate
      if (params.taxEnabled && params.taxType === 'capital_gains') {
        tax = proportionalCapitalGainsTax(before, basis, grossWithdrawal, params.taxRate)
        basis = reduceBasisProportionally(before, basis, grossWithdrawal)
      }
      balance = Math.max(0, balance - grossWithdrawal) * netGrowth
      grossComparison = Math.max(0, grossComparison - Math.min(grossComparison, grossWithdrawal)) * grossGrowth
      yearGrossWithdrawals += grossWithdrawal
      yearNetIncome += grossWithdrawal - tax
      yearTax += tax
    }

    if (recordSet.has(step)) {
      netSeries.push({
        year: step / periods,
        value: netLiquidationValue({ balance, basis, taxEnabled: params.taxEnabled, taxType: params.taxType, taxRate: params.taxRate }),
      })
      grossSeries.push({ year: step / periods, value: params.taxType === 'income' && params.taxEnabled ? grossComparison : balance })
    }

    if (step % periods === 0 || step === totalSteps) {
      if (mode === 'withdrawal') {
        yearData.push({
          year: step / periods,
          startingBalance: yearStartGross,
          withdrawals: yearGrossWithdrawals,
          netIncome: yearNetIncome,
          taxPaid: yearTax,
          endingBalance: netLiquidationValue({ balance, basis, taxEnabled: params.taxEnabled, taxType: params.taxType, taxRate: params.taxRate }),
          isSustainable: allScheduledWithdrawalsFulfilled,
        })
        yearStartGross = balance
        yearGrossWithdrawals = 0
        yearNetIncome = 0
        yearTax = 0
      }
      if (!params.excludeInflationAdjustment && step < totalSteps) cashflow *= inflator
    }
  }

  return { netSeries, grossSeries, yearData }
}
