export interface DrawdownDurationPoint {
  maxDrawdown: number
  durationYears: number
  recovered: boolean
}

export interface DrawdownDurationSummary {
  scenarioCount: number
  medianDepth: number
  medianDuration: number
  longestDuration: number
  recoveryRate: number
  notRecoveredRate: number
  medianRecoveryTime: number | null
  longestRecoveryTime: number | null
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle]
}

export function summarizeDrawdownDurations(
  points: DrawdownDurationPoint[],
): DrawdownDurationSummary | null {
  if (!points.length) return null

  const cleanPoints = points.map((point) => ({
    maxDrawdown: Math.min(1, Math.max(0, Number.isFinite(point.maxDrawdown) ? point.maxDrawdown : 0)),
    durationYears: Math.max(0, Number.isFinite(point.durationYears) ? point.durationYears : 0),
    recovered: Boolean(point.recovered),
  }))
  const recoveredDurations = cleanPoints
    .filter((point) => point.recovered && point.maxDrawdown > 1e-12)
    .map((point) => point.durationYears)
  const recoveredCount = cleanPoints.filter((point) => point.recovered).length
  const scenarioCount = cleanPoints.length

  return {
    scenarioCount,
    medianDepth: median(cleanPoints.map((point) => point.maxDrawdown)) ?? 0,
    medianDuration: median(cleanPoints.map((point) => point.durationYears)) ?? 0,
    longestDuration: Math.max(...cleanPoints.map((point) => point.durationYears), 0),
    recoveryRate: recoveredCount / scenarioCount * 100,
    notRecoveredRate: (scenarioCount - recoveredCount) / scenarioCount * 100,
    medianRecoveryTime: median(recoveredDurations),
    longestRecoveryTime: recoveredDurations.length ? Math.max(...recoveredDurations) : null,
  }
}
