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
  } = params

  const timeStepsPerYear = 12
  const dt = 1 / timeStepsPerYear
  const totalTimeSteps = duration * timeStepsPerYear

  const r = expectedReturn / 100
  const sigma = volatility / 100
  const mu = Math.log(1 + r)
  const drift = mu * dt
  const diffusion = sigma * Math.sqrt(dt)
  const cashflowPerStep =
    cashflowFrequency === 'monthly' ? cashflowAmount : cashflowAmount / 12
  const inflationFactor = 1 + inflationAdjustment / 100
  const rng = seedrandom(seed ?? `monte-carlo-${Date.now()}-${Math.random()}`)

  // Helper for normal random
  function normalRandom(): number {
    let u = 0,
      v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  // 1) Distributions per TIME UNIT across all paths
  // We now ALWAYS record monthly data (granularity = 1 step)
  // This allows the chart to show monthly volatility wiggles for any duration.
  const recordFrequency = 1 
  const numRecordingSteps = totalTimeSteps
  
  const distributions: number[][] = Array.from(
    { length: numRecordingSteps + 1 },
    () => []
  )

  // 2) Ending stats per path
  const endingValues: number[] = []
  const maxDrawdowns: number[] = []
  const lowestValues: number[] = [] 

  // 3) Annual CAGR distribution per year
  const annualCAGRs: number[][] = []
  for (let y = 0; y <= duration; y++) {
    annualCAGRs[y] = []
  }

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

    // Store Time 0 value
    distributions[0].push(currentValue)

    for (let step = 1; step <= totalTimeSteps; step++) {
      // Calculate growth factor once for this step
      const growthFactor = Math.exp(drift + diffusion * normalRandom())

      currentValue = currentValue * growthFactor
      pureValue = pureValue * growthFactor 

      if (mode === 'growth') {
        currentValue += currentCashflowPerStep
        totalInvestedSoFar += currentCashflowPerStep
      } else {
        currentValue -= currentCashflowPerStep
        currentValue = Math.max(0, currentValue)
      }

      if (currentValue < lowestValue) lowestValue = currentValue

      // Max drawdown on the fly
      if (currentValue > peak) peak = currentValue
      if (peak > 0) {
        const dd = (peak - currentValue) / peak
        if (dd > maxDrawdownForPath) maxDrawdownForPath = dd
      }

      // Always record distribution for chart (every step)
      distributions[step].push(currentValue)

      // Perform ANNUAL adjustments (Inflation, CAGR)
      if (step % timeStepsPerYear === 0) {
        const yearIndex = step / timeStepsPerYear

        currentCashflowPerStep *= inflationFactor

        if (yearIndex > 0) {
          const cagr = Math.pow(pureValue / initialValue, 1 / yearIndex) - 1
          annualCAGRs[yearIndex].push(cagr * 100)
        }
      }
    }

    endingValues.push(currentValue)
    lowestValues.push(lowestValue)
    maxDrawdowns.push(maxDrawdownForPath)

    if (portfolioGoal && currentValue >= portfolioGoal) pathsReachingGoal++
    if (currentValue > totalInvestedSoFar) pathsProfitable++
    if (currentValue > 0) pathsSolvent++
  }

  const sortedEndingValues = [...endingValues].sort((a, b) => a - b)

  const annualReturnsData = []
  for (let year = 1; year <= duration; year++) {
    const cagrs = annualCAGRs[year]
    cagrs.sort((a, b) => a - b)

    const count5 = cagrs.filter((v) => v >= 5).length
    const count8 = cagrs.filter((v) => v >= 8).length
    const count10 = cagrs.filter((v) => v >= 10).length
    const count12 = cagrs.filter((v) => v >= 12).length
    const count15 = cagrs.filter((v) => v >= 15).length
    const count20 = cagrs.filter((v) => v >= 20).length
    const count25 = cagrs.filter((v) => v >= 25).length
    const count30 = cagrs.filter((v) => v >= 30).length

    annualReturnsData.push({
      year,
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
  let simInvCashflow = cashflowPerStep

  investmentData.push({
    year: 0,
    initial: simInvInitial,
    contributions: 0,
    total: simInvInitial,
  })

  for (let y = 1; y <= duration; y++) {
    const yearContribution = mode === 'growth' ? simInvCashflow * 12 : 0
    simInvContrib += yearContribution

    investmentData.push({
      year: y,
      initial: simInvInitial,
      contributions: simInvContrib,
      total: simInvInitial + simInvContrib,
    })
    simInvCashflow *= inflationFactor
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

  const chartData = distributions.map((values, index) => {
    const sortedPeriodValues = [...values].sort((a, b) => a - b)
    
    // index is the month number (0 to totalMonths). 
    // We convert to partial years for the chart x-axis.
    const yearValue = index / 12 

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

  const goalProbability = portfolioGoal
    ? (pathsReachingGoal / numPaths) * 100
    : 0
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