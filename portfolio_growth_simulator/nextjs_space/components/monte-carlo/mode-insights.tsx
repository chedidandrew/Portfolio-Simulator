interface InvestmentInsightProps {
  mode: 'growth' | 'withdrawal'
  duration: number
  formattedTotal: string
}

export function MonteCarloInvestmentInsight({ mode, duration, formattedTotal }: InvestmentInsightProps) {
  if (mode === 'withdrawal') {
    return (
      <p>
        <span className="font-semibold">Starting Portfolio:</span>{' '}
        <span className="text-indigo-500 font-bold">{formattedTotal}</span>.{' '}
        The representative path reports gross withdrawals, after-tax spending, and taxes separately; the success rate is the probability of funding every requested withdrawal through the selected horizon.
      </p>
    )
  }

  return (
    <p>
      <span className="font-semibold">Total Invested:</span> Over {duration} {duration === 1 ? 'year' : 'years'}, you invested a total of{' '}
      <span className="text-indigo-500 font-bold">{formattedTotal}</span>
    </p>
  )
}

interface SuccessInsightProps {
  mode: 'growth' | 'withdrawal'
  successRate: number
}

export function MonteCarloSuccessInsight({ mode, successRate }: SuccessInsightProps) {
  return (
    <p>
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {mode === 'withdrawal' ? 'Success Rate:' : 'Profit Probability:'}
      </span>{' '}
      You have a <span className="font-bold">{successRate.toFixed(1)}%</span>{' '}
      chance of {mode === 'withdrawal'
        ? 'funding every requested withdrawal through the selected horizon'
        : 'making a profit on your total investment'}.
    </p>
  )
}

interface GoalOutcomeSummaryProps {
  probability: number
  formattedGoal: string
  pathsEndedAtOrAboveGoal: number
  scenarioCount: number
}

export function GoalTerminalOutcomeSummary({
  probability,
  formattedGoal,
  pathsEndedAtOrAboveGoal,
  scenarioCount,
}: GoalOutcomeSummaryProps) {
  return (
    <div className="flex-1">
      <p className="font-semibold">
        {probability.toFixed(1)}% Probability of Ending At or Above Goal ({formattedGoal})
      </p>
      <p className="text-xs text-muted-foreground">
        {pathsEndedAtOrAboveGoal} out of {scenarioCount} scenarios ended at or above the goal. This is a terminal-value measure, not the probability of touching the goal at any earlier time.
      </p>
    </div>
  )
}
