import test from 'node:test'
import assert from 'node:assert/strict'
import type { SimulationParams } from '../types'
import {
  MAX_TIMELINE_REFINEMENT_WORK,
  buildTimelineRefinementPlan,
  mergeTimelineRefinement,
} from './timeline-refinement'

const longWeeklyRun: SimulationParams = {
  initialValue: 10_000,
  expectedReturn: 7,
  volatility: 10,
  duration: 200,
  cashflowAmount: 500,
  cashflowFrequency: 'weekly',
  inflationAdjustment: 2.5,
  numPaths: 100_000,
}

test('timeline refinement removes multi-year chart gaps within a bounded second pass', () => {
  const plan = buildTimelineRefinementPlan(longWeeklyRun)
  assert.equal(plan.required, true)
  assert.ok(plan.primaryPointCount < 10)
  assert.ok(plan.refinedPointCount >= 250)
  assert.ok(plan.samplePaths < longWeeklyRun.numPaths)
  assert.ok(plan.additionalWork <= MAX_TIMELINE_REFINEMENT_WORK)
})

test('small simulations keep their original full-path timeline', () => {
  const plan = buildTimelineRefinementPlan({
    ...longWeeklyRun,
    duration: 20,
    cashflowFrequency: 'monthly',
    numPaths: 500,
  })
  assert.equal(plan.required, false)
  assert.equal(plan.samplePaths, 500)
  assert.equal(plan.additionalWork, 0)
})

test('timeline merge preserves full-run headline statistics and exact checkpoints', () => {
  const full = {
    median: 123,
    numPathsUsed: 100_000,
    chartData: [
      { year: 0, p10: 1, p25: 1, p50: 1 },
      { year: 1, p10: 123, p25: 123, p50: 123 },
    ],
    chartDataGross: [{ year: 0, p50: 2 }, { year: 1, p50: 246 }],
    annualReturnsData: [{ year: 20 }],
    investmentData: [{ year: 0 }],
    solvencySeries: [{ year: 0, solventRate: 100 }],
    deterministicSeries: [{ year: 0, value: 1 }],
    deterministicSeriesGross: [{ year: 0, value: 2 }],
    hasDepletion: false,
    recommendLogLinear: true,
  } as any
  const refined = {
    ...full,
    median: 999,
    numPathsUsed: 1_250,
    chartData: [
      { year: 0, p10: 0, p25: 0, p50: 0 },
      { year: 0.5, p10: 50, p25: 50, p50: 50 },
      { year: 1, p10: 999, p25: 999, p50: 999 },
    ],
    chartDataGross: [
      { year: 0, p50: 0 },
      { year: 0.5, p50: 100 },
      { year: 1, p50: 999 },
    ],
    annualReturnsData: [{ year: 1 }],
    investmentData: [{ year: 0 }, { year: 1 }],
    solvencySeries: [{ year: 0, solventRate: 100 }, { year: 1, solventRate: 99 }],
    deterministicSeries: [{ year: 0, value: 1 }, { year: 1, value: 2 }],
    deterministicSeriesGross: [{ year: 0, value: 2 }, { year: 1, value: 3 }],
  } as any

  const merged = mergeTimelineRefinement(full, refined)
  const terminalPoint = merged.chartData[merged.chartData.length - 1]
  assert.equal(merged.median, 123)
  assert.equal(merged.numPathsUsed, 100_000)
  assert.deepEqual(merged.chartData.map((point: any) => point.year), [0, 0.5, 1])
  assert.equal(terminalPoint?.p50, 123, 'full-run terminal checkpoint must win')
  assert.equal(merged.chartData[1]?.p50, 50, 'refinement fills the gap between exact checkpoints')
  assert.equal(merged.timelineScenarioCount, 1_250)
  assert.equal(merged.timelinePointCount, 3)
  assert.equal(merged.timelineUsesSample, true)
})
