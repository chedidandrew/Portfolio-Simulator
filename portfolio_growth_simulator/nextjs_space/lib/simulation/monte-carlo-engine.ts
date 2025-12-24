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


export async function performMonteCarloSimulationAsync(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed?: string
) {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      const { performMonteCarloSimulationWebGPU } = await import('./monte-carlo-webgpu')
      return await performMonteCarloSimulationWebGPU(params, mode, seed)
    }
  } catch (e) {
    // Fall back to CPU implementation
  }
  return performMonteCarloSimulation(params, mode, seed)
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
    startingCostBasis,
    expectedReturn,
    volatility,
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
    calculationMode = 'effective'
  } = params

  const getStepsPerYear = (f: SimulationParams['cashflowFrequency']) => {
    if (f === 'weekly') return 52
    if (f === 'monthly') return 12
    if (f === 'quarterly') return 4
    return 1
  }

  const timeStepsPerYear = getStepsPerYear(cashflowFrequency)

  const MAX_TOTAL_DATA_POINTS = 10_000_000
  const MAX_CHART_STEPS = 500
  const totalSimulationSteps = Math.floor(duration * timeStepsPerYear)
  const memoryAllowedSteps = Math.floor(MAX_TOTAL_DATA_POINTS / numPaths)
  const targetSteps = Math.max(2, Math.min(memoryAllowedSteps, MAX_CHART_STEPS))
  let recordFrequency = Math.ceil(totalSimulationSteps / targetSteps)
  if (recordFrequency < 1) recordFrequency = 1

  const dt = 1 / timeStepsPerYear
  const totalTimeSteps = totalSimulationSteps

  const isIncomeTax = taxEnabled && taxType === 'income'

  let preTaxReturn = expectedReturn
  let postTaxReturn = expectedReturn

  if (isIncomeTax) {
    postTaxReturn = expectedReturn * (1 - taxRate / 100)
  }

  if (calculationMode === 'nominal') {
    preTaxReturn = (Math.pow(1 + preTaxReturn / 100 / timeStepsPerYear, timeStepsPerYear) - 1) * 100
    postTaxReturn = (Math.pow(1 + postTaxReturn / 100 / timeStepsPerYear, timeStepsPerYear) - 1) * 100
  }

  const r = postTaxReturn / 100
  const rPreTax = preTaxReturn / 100
  const sigma = volatility / 100
  const mu = Math.log(1 + r)
  const muPreTax = Math.log(1 + rPreTax)
  const drift = mu * dt
  const driftPreTax = muPreTax * dt
  const diffusion = sigma * Math.sqrt(dt)
  
  let cashflowPerStep = cashflowAmount
  
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
  const stepDistributionsGross: number[][] = Array.from({ length: numRecordedSteps + 1 }, () => [])
  const stepCAGRs: number[][] = Array.from({ length: numRecordedSteps + 1 }, () => [])

  const solvencySeries: { year: number, solventRate: number }[] = []
  const deterministicSeries: { year: number, value: number }[] = []
  const deterministicSeriesGross: { year: number, value: number }[] = []
  
  const deterministicYearData: Array<{
    year: number
    startingBalance: number
    withdrawals: number
    netIncome: number
    taxPaid: number
    endingBalance: number
    isSustainable: boolean
  }> = []

  const endingValues: number[] = []
  const preTaxEndingValues: number[] = [] 
  const maxDrawdowns: number[] = []
  const lowestValues: number[] = [] 

  const clampedStartingCostBasis = Math.max(0, startingCostBasis ?? initialValue)

  function getNetLiquidationValue(balance: number, basis: number): number {
    if (!taxEnabled) return balance
    if (taxType === 'income') return balance
    if (taxType === 'tax_deferred') {
      return balance * (1 - (taxRate / 100))
    }
    if (taxType === 'capital_gains') {
      const profitForTax = balance - basis
      if (profitForTax > 0) {
        return balance - (profitForTax * (taxRate / 100))
      }
      return balance
    }
    return balance
  }

  let pathsReachingGoal = 0
  let pathsProfitable = 0 
  let pathsSolvent = 0 

  // --- DETERMINISTIC PATH CALCULATION ---
  let detValue = initialValue
  let detBasis = clampedStartingCostBasis 
  let detCashflow = cashflowPerStep
  const detStepRate = Math.pow(1 + r, dt) - 1

  let detYearStartBalance = initialValue
  let detYearWithdrawals = 0
  let detYearNetIncome = 0
  let detYearTaxPaid = 0

  deterministicSeries.push({ year: 0, value: getNetLiquidationValue(initialValue, detBasis) })
  deterministicSeriesGross.push({ year: 0, value: initialValue })
  
  for (let step = 1; step <= totalTimeSteps; step++) {
    let stepTaxPaid = 0
    let stepWithdrawal = 0
    let stepNet = 0 // Initialize to 0

    if (mode === 'withdrawal') {
       stepWithdrawal = detCashflow
       stepNet = detCashflow // Default
       
       if (taxEnabled && taxType !== 'income') {
         if (taxType === 'tax_deferred') {
             // Gross Input
             stepWithdrawal = detCashflow
             stepTaxPaid = detCashflow * (taxRate / 100)
             stepNet = stepWithdrawal - stepTaxPaid
         } else {
             // Capital Gains
             const gainFraction = detValue > detBasis ? (detValue - detBasis) / detValue : 0
             let effectiveTaxRate = (taxRate / 100) * gainFraction
             if (effectiveTaxRate >= 0.99) effectiveTaxRate = 0.99
             
             stepWithdrawal = detCashflow
             stepTaxPaid = stepWithdrawal * effectiveTaxRate
             stepNet = stepWithdrawal - stepTaxPaid
         }
       }

       if (stepWithdrawal > detValue) {
           const ratio = detValue / (stepWithdrawal || 1)
           stepWithdrawal = detValue
           stepNet = stepNet * ratio
           stepTaxPaid = stepTaxPaid * ratio
       }

       if (taxType !== 'tax_deferred') {
          if (detValue > 0) {
            detBasis = detBasis * (1 - (stepWithdrawal / detValue))
          }
       }

       detValue -= stepWithdrawal
       detValue = Math.max(0, detValue)
       
       detYearWithdrawals += stepWithdrawal
       detYearNetIncome += stepNet
       detYearTaxPaid += stepTaxPaid
       
       // Apply Growth
       const valueBeforeGrowth = detValue
       detValue = detValue * (1 + detStepRate)

       // If Income Tax, apply drag
       if (taxEnabled && taxType === 'income') {
           const growth = detValue - valueBeforeGrowth
           let t = taxRate / 100
           if (t >= 0.99) t = 0.99
           const drag = growth * (t / (1 - t))
           detYearTaxPaid += drag
       }

    } else {
       // Growth Mode
       detValue = detValue * (1 + detStepRate)
       detValue += detCashflow
       detBasis += detCashflow
    }

    if (step % recordFrequency === 0) {
      deterministicSeries.push({ 
        year: step / timeStepsPerYear, 
        value: getNetLiquidationValue(detValue, detBasis) 
      })
      deterministicSeriesGross.push({
        year: step / timeStepsPerYear,
        value: detValue
      })
    }
    
    if (step % timeStepsPerYear === 0) {
        if (mode === 'withdrawal') {
            deterministicYearData.push({
                year: step / timeStepsPerYear,
                startingBalance: detYearStartBalance,
                withdrawals: detYearWithdrawals,
                netIncome: detYearNetIncome,
                taxPaid: detYearTaxPaid,
                endingBalance: getNetLiquidationValue(detValue, detBasis),
                isSustainable: detValue > 0
            })
            detYearStartBalance = getNetLiquidationValue(detValue, detBasis)
            detYearWithdrawals = 0
            detYearNetIncome = 0
            detYearTaxPaid = 0
        }

        if (!excludeInflationAdjustment) {
            detCashflow *= inflationFactor
        }
    }
  }

  // --- END DETERMINISTIC ---

  for (let path = 0; path < numPaths; path++) {
    let currentValue = initialValue
    let pureValue = initialValue 
    let lowestValue = initialValue
    let currentCashflowPerStep = cashflowPerStep
    let totalInvestedSoFar = clampedStartingCostBasis
    let totalBasis = clampedStartingCostBasis 
    let peak = getNetLiquidationValue(currentValue, totalBasis)
    let maxDrawdownForPath = 0
    let preTaxValue = initialValue 

    stepDistributions[0].push(getNetLiquidationValue(currentValue, totalBasis))
    stepDistributionsGross[0].push(currentValue)
    stepCAGRs[0].push(0)

    for (let step = 1; step <= totalTimeSteps; step++) {
      const z = normalRandom()
      const growthFactor = Math.exp(drift + diffusion * z)
      const growthFactorPreTax = isIncomeTax ? Math.exp(driftPreTax + diffusion * z) : 0
      pureValue = pureValue * growthFactor 

      if (mode === 'withdrawal') {
        let stepWithdrawal = currentCashflowPerStep

        if (taxEnabled && taxType !== 'income') {
            if (taxType === 'tax_deferred') {
                stepWithdrawal = currentCashflowPerStep
            } else {
                const gainFraction = currentValue > totalBasis ? (currentValue - totalBasis) / currentValue : 0
                let effectiveTaxRate = (taxRate / 100) * gainFraction
                if (effectiveTaxRate >= 0.99) effectiveTaxRate = 0.99
                stepWithdrawal = currentCashflowPerStep
            }
        }

        if (stepWithdrawal > currentValue) stepWithdrawal = currentValue

        if (taxType !== 'tax_deferred') {
            if (currentValue > 0) {
              totalBasis = totalBasis * (1 - (stepWithdrawal / currentValue))
            }
        }

        currentValue -= stepWithdrawal
        currentValue = Math.max(0, currentValue)
        currentValue = currentValue * growthFactor

        if (isIncomeTax) {
          let preTaxWithdrawal = stepWithdrawal
          if (preTaxWithdrawal > preTaxValue) preTaxWithdrawal = preTaxValue
          preTaxValue -= preTaxWithdrawal
          preTaxValue = Math.max(0, preTaxValue)
          preTaxValue = preTaxValue * growthFactorPreTax
        }
        
      } else {
        currentValue = currentValue * growthFactor
        currentValue += currentCashflowPerStep
        totalInvestedSoFar += currentCashflowPerStep

        if (isIncomeTax) {
          preTaxValue = preTaxValue * growthFactorPreTax
          preTaxValue += currentCashflowPerStep
        }
      }

      const basisForNet = mode === 'growth' ? totalInvestedSoFar : totalBasis
      const netValue = getNetLiquidationValue(currentValue, basisForNet)

      if (netValue < lowestValue) lowestValue = netValue
      if (netValue > peak) peak = netValue
      if (peak > 0) {
        const dd = (peak - netValue) / peak
        if (dd > maxDrawdownForPath) maxDrawdownForPath = dd
      }

      if (step % recordFrequency === 0) {
        const recordIndex = step / recordFrequency
        stepDistributions[recordIndex].push(netValue)
        stepDistributionsGross[recordIndex].push(currentValue)
        const timeInYears = step / timeStepsPerYear
        const initialNet = getNetLiquidationValue(initialValue, clampedStartingCostBasis)
        const cagr = Math.pow((netValue || 1) / (initialNet || 1), 1 / timeInYears) - 1
        stepCAGRs[recordIndex].push(cagr * 100)
      }

      if (step % timeStepsPerYear === 0 && !excludeInflationAdjustment) {
        currentCashflowPerStep *= inflationFactor
      }
    }

    let finalValueEffective = currentValue
    let finalValuePreTax = isIncomeTax ? preTaxValue : currentValue 

    if (mode === 'growth' && taxEnabled) {
        if (taxType === 'capital_gains') {
            const profit = currentValue - totalInvestedSoFar
            if (profit > 0) {
                finalValueEffective = currentValue - (profit * (taxRate / 100))
            }
        } else if (taxType === 'tax_deferred') {
            finalValueEffective = currentValue * (1 - (taxRate / 100))
        }
    }

    endingValues.push(finalValueEffective)
    preTaxEndingValues.push(finalValuePreTax)
    lowestValues.push(lowestValue)
    maxDrawdowns.push(maxDrawdownForPath)

    if (portfolioGoal && finalValueEffective >= portfolioGoal) pathsReachingGoal++
    if (finalValueEffective > totalInvestedSoFar) pathsProfitable++
    if (finalValueEffective > 0) pathsSolvent++ 
  }

  // --- SOLVENCY SERIES ---
  stepDistributions.forEach((stepValues, index) => {
    const solventCount = stepValues.filter(v => v > 0.01).length 
    const rate = (solventCount / numPaths) * 100
    const stepNumber = index * recordFrequency
    solvencySeries.push({
      year: stepNumber / timeStepsPerYear,
      solventRate: rate
    })
  })

  // ... (Stats Calculation omitted for brevity) ...
  const sortedEndingValues = [...endingValues].sort((a, b) => a - b)
  const annualReturnsData = []
  
  for (let i = 1; i <= numRecordedSteps; i++) {
     const cagrs = stepCAGRs[i]
     cagrs.sort((a, b) => a - b)
     const currentStepNumber = i * recordFrequency
     const yearValue = currentStepNumber / timeStepsPerYear
     annualReturnsData.push({
      year: yearValue,
      p10: calculatePercentile(cagrs, 0.1),
      p25: calculatePercentile(cagrs, 0.25),
      median: calculatePercentile(cagrs, 0.5),
      p75: calculatePercentile(cagrs, 0.75),
      p90: calculatePercentile(cagrs, 0.9),
      prob5: 0, prob8: 0, prob10: 0, prob12: 0, prob15: 0, prob20: 0, prob25: 0, prob30: 0
    })
  }

  // FIXED: Explicitly typed investmentData
  const investmentData: {
    year: number
    initial: number
    contributions: number
    total: number
  }[] = []

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

  // FIXED: Explicitly typed lossProbData
  const lossThresholds = [0, 2.5, 5, 10, 15, 20, 30, 50]
  const lossProbData: {
    threshold: string
    endPeriod: number
    intraPeriod: number
  }[] = lossThresholds.map((threshold) => {
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

  // Tax Drag Calc
  const mean = endingValues.reduce((sum, val) => sum + val, 0) / numPaths
  const meanPreTax = preTaxEndingValues.reduce((sum, val) => sum + val, 0) / numPaths
  let taxDragAmount = 0
  
  if (taxEnabled && mode === 'growth') {
    taxDragAmount = meanPreTax - mean
  }
  
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

  const chartDataGross = stepDistributionsGross.map((values, index) => {
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
    chartDataGross,
    solvencySeries,
    deterministicSeries,
    deterministicSeriesGross,
    deterministicYearData, 
    taxDragAmount,
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