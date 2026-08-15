import type { SimulationParams } from '../types'
import type { SimulationResults } from './monte-carlo-engine'
import {
  MAX_CHART_POINTS,
  MAX_RECORDED_VALUES,
  stepsPerYear,
} from './financial-utils'

/**
 * A chart-only second pass is capped so dense tooltips do not materially
 * increase the cost of the primary simulation.
 */
export const MAX_TIMELINE_REFINEMENT_WORK = 20_000_000

export interface TimelineRefinementPlan {
  required: boolean
  samplePaths: number
  totalSteps: number
  primaryPointCount: number
  refinedPointCount: number
  additionalWork: number
}

export type TimelineEnhancedResults = SimulationResults & {
  timelineScenarioCount: number
  timelinePointCount: number
  timelineUsesSample: boolean
}

function estimateRecordedPointCount(totalSteps: number, numPaths: number): number {
  const maxRecordedStepsByMemory = Math.max(1, Math.floor(MAX_RECORDED_VALUES / Math.max(1, numPaths)))
  const targetRecordedSteps = Math.max(1, Math.min(MAX_CHART_POINTS, maxRecordedStepsByMemory, totalSteps))
  const recordFrequency = Math.max(1, Math.ceil(totalSteps / targetRecordedSteps))

  let pointCount = 1 // Start point.
  for (let step = recordFrequency; step < totalSteps; step += recordFrequency) pointCount += 1
  return pointCount + 1 // Final point.
}

export function buildTimelineRefinementPlan(params: SimulationParams): TimelineRefinementPlan {
  const periods = stepsPerYear(params.cashflowFrequency)
  const totalSteps = Math.max(1, Math.round(params.duration * periods))
  const memoryBoundPaths = Math.max(1, Math.floor(MAX_RECORDED_VALUES / MAX_CHART_POINTS))
  const workBoundPaths = Math.max(1, Math.floor(MAX_TIMELINE_REFINEMENT_WORK / totalSteps))
  const samplePaths = Math.max(1, Math.min(params.numPaths, memoryBoundPaths, workBoundPaths))
  const primaryPointCount = estimateRecordedPointCount(totalSteps, params.numPaths)
  const refinedPointCount = estimateRecordedPointCount(totalSteps, samplePaths)
  const required = samplePaths < params.numPaths && refinedPointCount > primaryPointCount

  return {
    required,
    samplePaths,
    totalSteps,
    primaryPointCount,
    refinedPointCount,
    additionalWork: required ? samplePaths * totalSteps : 0,
  }
}

export function attachTimelineMetadata(
  results: SimulationResults,
): TimelineEnhancedResults {
  return {
    ...results,
    timelineScenarioCount: results.numPathsUsed,
    timelinePointCount: results.chartData?.length ?? 0,
    timelineUsesSample: false,
  }
}

function timelineKey(year: number): number {
  return Number(year.toFixed(10))
}

function preserveExactCheckpoints<T extends { year: number }>(
  refinedPoints: T[],
  fullRunPoints: T[],
): T[] {
  const pointsByYear = new Map<number, T>()
  for (const point of refinedPoints) pointsByYear.set(timelineKey(point.year), point)
  // Exact full-run checkpoints win, including the terminal point that must
  // reconcile with the headline percentiles calculated from every scenario.
  for (const point of fullRunPoints) pointsByYear.set(timelineKey(point.year), point)
  return [...pointsByYear.values()].sort((left, right) => left.year - right.year)
}

export function mergeTimelineRefinement(
  fullResults: SimulationResults,
  timelineResults: SimulationResults,
): TimelineEnhancedResults {
  const chartData = preserveExactCheckpoints(timelineResults.chartData, fullResults.chartData)
  const chartDataGross = preserveExactCheckpoints(timelineResults.chartDataGross, fullResults.chartDataGross)
  const annualReturnsData = preserveExactCheckpoints(timelineResults.annualReturnsData, fullResults.annualReturnsData)
  const investmentData = preserveExactCheckpoints(timelineResults.investmentData, fullResults.investmentData)
  const solvencySeries = preserveExactCheckpoints(timelineResults.solvencySeries, fullResults.solvencySeries)
  const deterministicSeries = preserveExactCheckpoints(timelineResults.deterministicSeries, fullResults.deterministicSeries)
  const deterministicSeriesGross = preserveExactCheckpoints(
    timelineResults.deterministicSeriesGross,
    fullResults.deterministicSeriesGross,
  )
  const hasDepletion = chartData.some((point) => point.p10 <= 0 || point.p25 <= 0 || point.p50 <= 0)

  return {
    ...fullResults,
    chartData,
    chartDataGross,
    annualReturnsData,
    investmentData,
    solvencySeries,
    deterministicSeries,
    deterministicSeriesGross,
    hasDepletion,
    recommendLogLinear: hasDepletion ? false : fullResults.recommendLogLinear,
    timelineScenarioCount: timelineResults.numPathsUsed,
    timelinePointCount: chartData.length,
    timelineUsesSample: true,
  }
}
