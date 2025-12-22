import seedrandom from 'seedrandom'
import { SimulationParams } from '@/lib/types'

export function calculatePercentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0
  if (sortedArray.length === 1) return sortedArray[0]

  const index = p * (sortedArray.length - 1)
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)

  if (lowerIndex === upperIndex) {
    return sortedArray[lowerIndex]
  }

  const lowerValue = sortedArray[lowerIndex]
  const upperValue = sortedArray[upperIndex]
  const fraction = index - lowerIndex

  return lowerValue + (upperValue - lowerValue) * fraction
}

export function performMonteCarloSimulation(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed?: string
) {
  if (params.initialValue <= 0) {
    throw new Error('Initial portfolio value must be greater than zero.')
  }

  const {
    initialValue,
    expectedReturn,
    volatility,
    duration,
    cashflowAmount,
    cashflowFrequency,
    inflationAdjustment = 0,
    numPaths,
    portfolioGoal,
    taxEnabled,
    taxRate = 0,
    taxType = 'capital_gains',
    calculationMode = 'effective'
  } = params

  // ... (MAX_PHYSICS_ITERATIONS and timing logic) ...
  const MAX_PHYSICS_ITERATIONS = 100_000_000 
  const opsWeekly = numPaths * duration * 52
  const opsMonthly = numPaths * duration * 12

  let timeStepsPerYear = 52 
  if (opsWeekly > MAX_PHYSICS_ITERATIONS) {
    if (opsMonthly > MAX_PHYSICS_ITERATIONS) timeStepsPerYear = 1
    else timeStepsPerYear = 12
  }

  const MAX_TOTAL_DATA_POINTS = 10_000_000
  const MAX_CHART_STEPS = 500
  const totalSimulationSteps = Math.floor(duration * timeStepsPerYear)
  const memoryAllowedSteps = Math.floor(MAX_TOTAL_DATA_POINTS / numPaths)
  const targetSteps = Math.max(2, Math.min(memoryAllowedSteps, MAX_CHART_STEPS))
  let recordFrequency = Math.ceil(totalSimulationSteps / targetSteps)
  if (recordFrequency < 1) recordFrequency = 1

const dt = 1 / timeStepsPerYear
  const totalTimeSteps = totalSimulationSteps

  // --- REVISED RATE LOGIC START ---
  let effectiveReturn = expectedReturn
  
  // 1. Apply Tax Drag (Income Tax)
  // We apply this to the raw input rate (whether Nominal or Effective)
  if (mode === 'growth' && taxEnabled && taxType === 'income') {
    effectiveReturn = expectedReturn * (1 - taxRate / 100)
  }

  // 2. Convert to Effective Annual (if needed) for Geometric Brownian Motion
  if (calculationMode === 'nominal') {
    // If Nominal, we now have the "Net Nominal Rate". 
    // We must convert this Net Nominal Rate to an Effective Annual Rate (Net APY)
    // to determine the correct drift for the simulation.
    effectiveReturn = (Math.pow(1 + effectiveReturn / 100 / 12, 12) - 1) * 100
  }
  // --- REVISED RATE LOGIC END ---

  // Consistent Rate Conversion (Log Return derived from Effective Annual)
  const r = effectiveReturn / 100
  const sigma = volatility / 100
  const mu = Math.log(1 + r)
  const drift = mu * dt
  const diffusion = sigma * Math.sqrt(dt)
  
  let annualBaseCashflow = cashflowFrequency === 'monthly' ? cashflowAmount * 12 : cashflowAmount

  // FIX: Tax Rate Edge Case Safety (Consistent with Withdrawal Engine)
  if (mode === 'withdrawal' && taxEnabled) {
     let t = taxRate / 100
     if (t >= 0.99) t = 0.99 // Hard clamp to 99% for safety
     annualBaseCashflow = annualBaseCashflow / (1 - t)
  }

  let cashflowPerStep = annualBaseCashflow / timeStepsPerYear
  
  const inflationFactor = 1 + inflationAdjustment / 100
  const rng = seedrandom(seed ?? `monte-carlo-${Date.now()}-${Math.random()}`)

  function normalRandom(): number {
    let u = 0, v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  const numRecordedSteps = Math.floor(totalTimeSteps / recordFrequency)
  
  const stepDistributions: number[][] = Array.from({ length: numRecordedSteps + 1 }, () => [])
  const stepCAGRs: number[][] = Array.from({ length: numRecordedSteps + 1 }, () => [])

  const endingValues: number[] = []
  const maxDrawdowns: number[] = []
  const lowestValues: number[] = [] 

  let pathsReachingGoal = 0
  let pathsProfitable = 0 
  let pathsSolvent = 0 

  for (let path = 0; path < numPaths; path++) {
    let currentValue = initialValue
    let pureValue = initialValue 
    let lowestValue = initialValue
    let currentCashflowPerStep = cashflowPerStep
    let totalInvestedSoFar = initialValue
    let peak = currentValue
    let maxDrawdownForPath = 0

    stepDistributions[0].push(currentValue)
    stepCAGRs[0].push(0)

    for (let step = 1; step <= totalTimeSteps; step++) {
      const growthFactor = Math.exp(drift + diffusion * normalRandom())
      pureValue = pureValue * growthFactor 

      // FIX: Sequence of Returns Logic for Volatility=0 Equivalence
      if (mode === 'withdrawal') {
        // Withdrawal Mode: Withdraw THEN Grow
        currentValue -= currentCashflowPerStep
        currentValue = Math.max(0, currentValue)
        currentValue = currentValue * growthFactor
      } else {
        // Growth Mode: Grow THEN Contribute
        currentValue = currentValue * growthFactor
        currentValue += currentCashflowPerStep
        totalInvestedSoFar += currentCashflowPerStep
      }

      if (currentValue < lowestValue) lowestValue = currentValue
      if (currentValue > peak) peak = currentValue
      if (peak > 0) {
        const dd = (peak - currentValue) / peak
        if (dd > maxDrawdownForPath) maxDrawdownForPath = dd
      }

      if (step % recordFrequency === 0) {
        const recordIndex = step / recordFrequency
        stepDistributions[recordIndex].push(currentValue)
        const timeInYears = step / timeStepsPerYear
        const cagr = Math.pow(pureValue / initialValue, 1 / timeInYears) - 1
        stepCAGRs[recordIndex].push(cagr * 100)
      }

      if (step % timeStepsPerYear === 0) {
        currentCashflowPerStep *= inflationFactor
      }
    }

    // --- TAX LOGIC: DEFERRED CAPITAL GAINS (Growth Mode) ---
    let finalValueEffective = currentValue
    if (mode === 'growth' && taxEnabled && taxType === 'capital_gains') {
      const profit = currentValue - totalInvestedSoFar
      if (profit > 0) {
        finalValueEffective = currentValue - (profit * (taxRate / 100))
      }
    }

    endingValues.push(finalValueEffective)
    lowestValues.push(lowestValue)
    maxDrawdowns.push(maxDrawdownForPath)

    if (portfolioGoal && finalValueEffective >= portfolioGoal) pathsReachingGoal++
    if (finalValueEffective > totalInvestedSoFar) pathsProfitable++
    if (currentValue > 0) pathsSolvent++ 
  }

  // ... (Stats Calculation)
  
  const sortedEndingValues = [...endingValues].sort((a, b) => a - b)

  const annualReturnsData = []
  for (let i = 1; i <= numRecordedSteps; i++) {
    const cagrs = stepCAGRs[i]
    cagrs.sort((a, b) => a - b)
    const count5 = cagrs.filter((v) => v >= 5).length
    const count8 = cagrs.filter((v) => v >= 8).length
    const count10 = cagrs.filter((v) => v >= 10).length
    const count12 = cagrs.filter((v) => v >= 12).length
    const count15 = cagrs.filter((v) => v >= 15).length
    const count20 = cagrs.filter((v) => v >= 20).length
    const count25 = cagrs.filter((v) => v >= 25).length
    const count30 = cagrs.filter((v) => v >= 30).length
    const currentStepNumber = i * recordFrequency
    const yearValue = currentStepNumber / timeStepsPerYear

    annualReturnsData.push({
      year: yearValue,
      p10: calculatePercentile(cagrs, 0.1),
      p25: calculatePercentile(cagrs, 0.25),
      median: calculatePercentile(cagrs, 0.5),
      p75: calculatePercentile(cagrs, 0.75),
      p90: calculatePercentile(cagrs, 0.9),
      prob5: (count5 / numPaths) * 100,
      prob8: (count8 / numPaths) * 100,
      prob10: (count10 / numPaths) * 100,
      prob12: (count12 / numPaths) * 100,
      prob15: (count15 / numPaths) * 100,
      prob20: (count20 / numPaths) * 100,
      prob25: (count25 / numPaths) * 100,
      prob30: (count30 / numPaths) * 100,
    })
  }

  const investmentData = []
  let simInvInitial = initialValue
  let simInvContrib = 0
  let simChartCashflow = mode === 'growth' ? cashflowPerStep : 0

  investmentData.push({
    year: 0,
    initial: simInvInitial,
    contributions: 0,
    total: simInvInitial,
  })

  for (let step = 1; step <= totalTimeSteps; step++) {
    simInvContrib += simChartCashflow

    if (step % recordFrequency === 0) {
      investmentData.push({
        year: step / timeStepsPerYear,
        initial: simInvInitial,
        contributions: simInvContrib,
        total: simInvInitial + simInvContrib,
      })
    }
    if (step % timeStepsPerYear === 0) {
      simChartCashflow *= inflationFactor
    }
  }

  const lossThresholds = [0, 2.5, 5, 10, 15, 20, 30, 50]
  const lossProbData = lossThresholds.map((threshold) => {
    const countEnd = endingValues.filter((val) => {
      if (val >= initialValue) return false
      const lossPct = ((initialValue - val) / initialValue) * 100
      return lossPct >= threshold
    }).length

    const countIntra = lowestValues.filter((val) => {
      const lossPct = ((initialValue - val) / initialValue) * 100
      return lossPct >= threshold
    }).length

    return {
      threshold: `>= ${threshold}%`,
      endPeriod: (countEnd / numPaths) * 100,
      intraPeriod: (countIntra / numPaths) * 100,
    }
  })

  const mean = endingValues.reduce((sum, val) => sum + val, 0) / numPaths
  const median = calculatePercentile(sortedEndingValues, 0.5)
  const p5 = calculatePercentile(sortedEndingValues, 0.05)
  const p10 = calculatePercentile(sortedEndingValues, 0.1)
  const p25 = calculatePercentile(sortedEndingValues, 0.25)
  const p75 = calculatePercentile(sortedEndingValues, 0.75)
  const p90 = calculatePercentile(sortedEndingValues, 0.9)
  const p95 = calculatePercentile(sortedEndingValues, 0.95)
  const best = sortedEndingValues[numPaths - 1]
  const worst = sortedEndingValues[0]

  const chartData = stepDistributions.map((values, index) => {
    const sortedPeriodValues = [...values].sort((a, b) => a - b)
    const stepNumber = index * recordFrequency
    const yearValue = stepNumber / timeStepsPerYear

    return {
      year: yearValue,
      p10: calculatePercentile(sortedPeriodValues, 0.1),
      p25: calculatePercentile(sortedPeriodValues, 0.25),
      p50: calculatePercentile(sortedPeriodValues, 0.5),
      p75: calculatePercentile(sortedPeriodValues, 0.75),
      p90: calculatePercentile(sortedPeriodValues, 0.9),
    }
  })

  const spreadRatio = p95 > 0 && p5 > 0 ? p95 / p5 : 0
  const totalRatio = best > 0 && worst > 0 ? best / worst : 0
  const recommendLogHistogram = spreadRatio > 15 || totalRatio > 50

  const growthRatio = p90 > 0 && initialValue > 0 ? p90 / initialValue : 0
  const recommendLogLinear = growthRatio > 20

  const sortedMaxDrawdowns = [...maxDrawdowns].sort((a, b) => a - b)
  const medianDrawdown = calculatePercentile(sortedMaxDrawdowns, 0.5)
  const worstDrawdown = Math.max(...maxDrawdowns)
  const recommendLogDrawdown = medianDrawdown < 0.1 && worstDrawdown > 0.6

  const goalProbability = portfolioGoal ? (pathsReachingGoal / numPaths) * 100 : 0
  const profitableRate = (pathsProfitable / numPaths) * 100
  const solventRate = (pathsSolvent / numPaths) * 100

  return {
    endingValues,
    maxDrawdowns,
    annualReturnsData,
    lossProbData,
    investmentData,
    chartData,
    mean,
    median,
    p5,
    p10,
    p25,
    p75,
    p90,
    p95,
    best,
    worst,
    goalProbability,
    pathsReachingGoal,
    profitableRate,
    solventRate,
    numPathsUsed: numPaths,
    recommendLogLinear,
    recommendLogHistogram,
    recommendLogDrawdown,
    portfolioGoalSnapshot: portfolioGoal,
  }
}