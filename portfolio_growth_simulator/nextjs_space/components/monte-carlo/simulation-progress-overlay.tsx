'use client'

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  ChartSpline,
  Clock3,
  Cpu,
  Dices,
  Gauge,
  Layers3,
  OctagonX,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getCurrentSimulationProgress,
  requestSimulationCancel,
  subscribeSimulationProgress,
  type SimulationProgressPhase,
  type SimulationProgressSnapshot,
} from '@/lib/simulation/simulation-progress-events'

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const compactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const phaseLabels: Record<SimulationProgressPhase, string> = {
  preparing: 'Preparing simulation',
  running_scenarios: 'Running seeded scenarios',
  building_timeline: 'Refining chart timelines',
  finalizing: 'Finalizing results',
  cancelling: 'Cancelling simulation',
  complete: 'Simulation complete',
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function frequencyLabel(value: SimulationProgressSnapshot['frequency']): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function estimatedRemaining(snapshot: SimulationProgressSnapshot, elapsedMs: number): string {
  if (snapshot.phase === 'complete') return 'Done'
  if (snapshot.phase === 'cancelling') return 'Stopping'
  if (snapshot.fraction < 0.04 || elapsedMs < 1_000) return 'Calculating'
  const remainingMs = elapsedMs * (1 - snapshot.fraction) / Math.max(snapshot.fraction, 0.01)
  if (!Number.isFinite(remainingMs) || remainingMs > 86_400_000) return 'Calculating'
  return `About ${formatElapsed(remainingMs)}`
}

export function SimulationProgressHost() {
  const [snapshot, setSnapshot] = useState<SimulationProgressSnapshot | null>(() => getCurrentSimulationProgress())
  const [now, setNow] = useState(() => Date.now())
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const snapshotRef = useRef<SimulationProgressSnapshot | null>(getCurrentSimulationProgress())

  useEffect(() => subscribeSimulationProgress(
    (next) => {
      snapshotRef.current = next
      setSnapshot(next)
    },
    (runId) => setSnapshot((current) => {
      if (current?.runId !== runId) return current
      snapshotRef.current = null
      return null
    }),
  ), [])

  useEffect(() => {
    if (!snapshot?.runId) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [snapshot?.runId])

  useEffect(() => {
    if (!snapshot?.runId) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      const current = snapshotRef.current
      if (event.key !== 'Escape' || !current || current.phase === 'cancelling') return
      requestSimulationCancel(current.runId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [snapshot?.runId])

  const elapsedMs = snapshot ? Math.max(0, now - snapshot.startedAt) : 0
  const percent = snapshot ? Math.min(100, Math.max(0, Math.round(snapshot.fraction * 100))) : 0
  const warning = useMemo(() => {
    if (!snapshot) return null
    if (snapshot.totalPathPeriods >= 1_000_000_000) {
      return 'This is an extremely large local calculation. Keep this tab open; completion time depends heavily on your device.'
    }
    if (snapshot.totalPathPeriods >= 100_000_000) {
      return 'Large simulation detected. The browser worker keeps the page responsive, but the calculation may take a while.'
    }
    return null
  }, [snapshot])

  if (!snapshot) return null

  const isCancelling = snapshot.phase === 'cancelling'
  const displayedFraction = Math.min(1, Math.max(0.01, snapshot.fraction))

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulation-progress-title"
      aria-describedby="simulation-progress-detail"
      data-testid="simulation-progress-overlay"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border bg-gradient-to-br from-primary/15 via-card to-violet-500/10 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/15 p-2.5 text-primary">
              <Dices className="h-6 w-6 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="simulation-progress-title" className="text-xl font-bold tracking-tight sm:text-2xl">
                Running simulation...
              </h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {integerFormatter.format(snapshot.scenarios)} scenarios across {integerFormatter.format(snapshot.duration)} years
              </p>
              <p id="simulation-progress-detail" className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                {snapshot.detail}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="space-y-2.5">
            <div
              className="h-3 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Estimated simulation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="relative h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${displayedFraction * 100}%` }}
              >
                <div className="absolute inset-0 animate-pulse bg-gradient-to-r motion-reduce:animate-none from-transparent via-white/30 to-transparent" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold text-foreground">Estimated {percent}% complete</span>
              <span className="font-medium text-muted-foreground">{phaseLabels[snapshot.phase]}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Current phase</p>
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">{phaseLabels[snapshot.phase]}</p>
                <p className="text-xs text-muted-foreground">Progress is estimated while the worker calculates locally.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-3">
            <InfoTile icon={<Clock3 />} label="Elapsed" value={formatElapsed(elapsedMs)} />
            <InfoTile icon={<Gauge />} label="Est. remaining" value={estimatedRemaining(snapshot, elapsedMs)} />
            <InfoTile icon={<Cpu />} label="Execution" value={snapshot.executionMode} />
            <InfoTile
              icon={<Layers3 />}
              label="Periods / scenario"
              value={integerFormatter.format(snapshot.periodsPerScenario)}
            />
            <InfoTile
              icon={<Dices />}
              label="Path-periods"
              value={compactFormatter.format(snapshot.totalPathPeriods)}
              title={integerFormatter.format(snapshot.totalPathPeriods)}
            />
            <InfoTile
              icon={<ChartSpline />}
              label="Timeline points"
              value={integerFormatter.format(snapshot.timelinePointCount)}
            />
          </div>

          <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-200">
            <p className="font-semibold">Calculation detail</p>
            <p className="mt-1 leading-relaxed">
              Headline statistics use all {integerFormatter.format(snapshot.scenarios)} scenarios.{' '}
              {snapshot.timelineUsesSample
                ? `Time-series charts use a seeded ${integerFormatter.format(snapshot.timelineScenarioCount)}-scenario refinement pass for dense, responsive tooltips.`
                : `Time-series charts use all ${integerFormatter.format(snapshot.timelineScenarioCount)} scenarios.`}
              {' '}Cashflow frequency is {frequencyLabel(snapshot.frequency).toLowerCase()}.
            </p>
          </div>

          {warning && (
            <div className="flex items-start gap-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-800 dark:text-orange-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="leading-relaxed">{warning}</p>
            </div>
          )}

          <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Seed: <span className="font-mono" title={snapshot.seed}>{snapshot.seed.length > 48 ? `${snapshot.seed.slice(0, 45)}...` : snapshot.seed}</span>
          </div>

          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            disabled={isCancelling || snapshot.phase === 'complete'}
            className="min-h-12 w-full border-red-500/45 bg-red-500/10 text-base font-semibold text-red-700 hover:bg-red-500/20 dark:text-red-300"
            onClick={() => requestSimulationCancel(snapshot.runId)}
          >
            <OctagonX className="mr-2 h-5 w-5" aria-hidden="true" />
            {isCancelling ? 'Stopping worker...' : 'Cancel simulation'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  title,
}: {
  icon: ReactElement<{ className?: string }>
  label: string
  value: string
  title?: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/30 p-3" title={title}>
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden="true">{icon}</span>
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="truncate font-semibold text-foreground">{value}</p>
    </div>
  )
}
