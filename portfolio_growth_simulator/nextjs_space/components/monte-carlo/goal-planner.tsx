'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, CircleAlert, Target, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import type { SimulationParams } from '@/lib/types'
import type { CompletedSimulationResults } from '@/hooks/use-monte-carlo'
import {
  calculateGoalShortfallInsight,
  estimateRequiredContribution,
  type GoalConfidenceLevel,
  type PlanningEstimateProgress,
  type RequiredContributionEstimate,
} from '@/lib/simulation/planning-insights'

const CONFIDENCE_LEVELS: GoalConfidenceLevel[] = [50, 75, 90, 95]

function money(value: number): string {
  return formatCurrency(value, true, 0, true)
}

export function GoalPlanner({
  params,
  results,
}: {
  params: SimulationParams
  results: CompletedSimulationResults
}) {
  const [confidence, setConfidence] = useState<GoalConfidenceLevel>(90)
  const [estimate, setEstimate] = useState<RequiredContributionEstimate | null>(null)
  const [progress, setProgress] = useState<PlanningEstimateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const goal = results.portfolioGoalSnapshot ?? params.portfolioGoal
  const shortfall = useMemo(
    () => goal ? calculateGoalShortfallInsight(goal, results) : null,
    [goal, results],
  )

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    controllerRef.current?.abort()
    setEstimate(null)
    setProgress(null)
    setError(null)
  }, [confidence, params, results.simulationSeed])

  if (!goal || !shortfall) return null

  const calculate = async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setEstimate(null)
    setError(null)
    setProgress({
      fraction: 0.01,
      completedRuns: 0,
      estimatedRuns: 1,
      phase: 'preparing',
      detail: 'Preparing the contribution search...',
    })

    try {
      const next = await estimateRequiredContribution(
        { ...params, portfolioGoal: goal },
        confidence,
        `${results.simulationSeed}:goal-planner:${confidence}`,
        { signal: controller.signal, onProgress: setProgress },
      )
      if (!controller.signal.aborted) setEstimate(next)
    } catch (caught: unknown) {
      const name = caught instanceof Error ? caught.name : undefined
      if (name !== 'AbortError') setError(caught instanceof Error ? caught.message : 'The contribution estimate could not be completed.')
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      if (!controller.signal.aborted) setProgress(null)
    }
  }

  const cancel = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setProgress(null)
  }

  return (
    <section className="space-y-4 rounded-xl border border-blue-500/25 bg-blue-500/5 p-4" aria-labelledby="goal-planner-title">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-500/15 p-2 text-blue-600 dark:text-blue-300">
          <Target className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="goal-planner-title" className="font-semibold">Goal Planner</h3>
          <p className="text-xs text-muted-foreground">
            See the terminal goal risk, then estimate the contribution needed for a selected modeled confidence.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PlannerMetric
          label="Ending At or Above Goal"
          value={`${results.endingAtOrAboveGoalProbability.toFixed(1)}%`}
          tone="text-emerald-700 dark:text-emerald-300"
        />
        <PlannerMetric
          label="Shortfall Risk"
          value={`${shortfall.shortfallRisk.toFixed(1)}%`}
          tone="text-orange-700 dark:text-orange-300"
        />
        <PlannerMetric
          label="Typical Shortfall When Missed"
          value={shortfall.allScenariosEndedAtOrAboveGoal ? 'No misses' : money(shortfall.typicalShortfall)}
        />
        <PlannerMetric label="Goal" value={money(goal)} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Goal confidence</p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Goal confidence">
          {CONFIDENCE_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={confidence === level}
              className={`min-h-11 rounded-lg border px-2 text-sm font-semibold transition-colors ${
                confidence === level
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-border bg-background hover:bg-muted'
              }`}
              onClick={() => setConfidence(level)}
              disabled={Boolean(progress)}
            >
              {level}%
            </button>
          ))}
        </div>
      </div>

      {progress && (
        <div className="space-y-2 rounded-lg border border-blue-500/20 bg-background/70 p-3" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
              style={{ width: `${Math.max(2, progress.fraction * 100)}%` }}
            />
          </div>
          <div className="flex items-start justify-between gap-3 text-xs">
            <div>
              <p className="font-semibold">Estimated {Math.round(progress.fraction * 100)}% complete</p>
              <p className="text-muted-foreground">{progress.detail}</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={cancel} aria-label="Cancel goal estimate">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {estimate && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-background/70 p-3 sm:grid-cols-4" aria-live="polite">
          <PlannerMetric
            label={`Contribution for ${confidence}% Confidence`}
            value={estimate.capped ? `More than ${money(estimate.requiredMonthlyContribution)}/mo` : `${money(estimate.requiredMonthlyContribution)}/mo`}
            tone="text-blue-700 dark:text-blue-300"
          />
          <PlannerMetric label="Current Contribution" value={`${money(estimate.currentMonthlyContribution)}/mo`} />
          <PlannerMetric
            label="Additional Needed"
            value={estimate.currentContributionIsSufficient ? 'Current plan is sufficient' : `+${money(estimate.additionalMonthlyContribution)}/mo`}
            tone={estimate.currentContributionIsSufficient ? 'text-emerald-700 dark:text-emerald-300' : 'text-orange-700 dark:text-orange-300'}
          />
          <PlannerMetric label="Verification Probability" value={`${estimate.achievedProbability.toFixed(1)}%`} />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!estimate && !progress && (
        <Button type="button" className="w-full" onClick={calculate}>
          <Calculator className="mr-2 h-4 w-4" aria-hidden="true" />
          Calculate contribution for {confidence}% confidence
        </Button>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Confidence means the modeled probability of ending at or above the goal at the final horizon. The estimator reuses one seed across candidate contributions to reduce search noise. It is educational, not a guarantee or financial advice.
      </p>
    </section>
  )
}

function PlannerMetric({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold sm:text-base ${tone}`}>{value}</p>
    </div>
  )
}
