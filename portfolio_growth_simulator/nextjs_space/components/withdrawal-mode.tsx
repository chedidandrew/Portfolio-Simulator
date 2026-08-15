'use client'

import { useEffect, useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import type { WithdrawalState, SimulationParams, SharePayload } from '@/lib/types'
import { triggerHaptic } from '@/hooks/use-haptics'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dices } from 'lucide-react'
import { motion } from 'framer-motion'
import { getAppCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { WithdrawalParameters } from '@/components/withdrawal/parameters'
import { WithdrawalResults } from '@/components/withdrawal/results'
import { WithdrawalTable } from '@/components/withdrawal/table'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { useWithdrawalCalculation } from '@/hooks/use-withdrawal-calculation'
import { normalizeWithdrawalState } from '@/lib/state-normalization'
import { CalculationErrorCard } from '@/components/calculation-error-card'
import { clearSimulatorScenario } from '@/lib/owned-storage'
import { validateWithdrawalStateRange } from '@/lib/simulation/deterministic-validation'
import { MONTE_CARLO_SWITCH_LABELS } from '@/lib/accessibility-labels'
import { DEFAULT_WITHDRAWAL_STATE } from '@/lib/default-states'
import { buildShareUrl as buildVersionedShareUrl, cleanShareDataFromUrl } from '@/lib/share-links'

export { DEFAULT_WITHDRAWAL_STATE } from '@/lib/default-states'

export function WithdrawalMode({ sharedPayload }: { sharedPayload?: SharePayload | null }) {
  const [state, setState] = useLocalStorage<WithdrawalState>(
    'withdrawal-mode-state',
    DEFAULT_WITHDRAWAL_STATE,
    {
      normalize: normalizeWithdrawalState,
      shouldPersist: (nextState) => validateWithdrawalStateRange(nextState) === null,
    },
  )

  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('withdrawal-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('withdrawal-show-full-precision', false)

  // NEW: MC state restored from URL (passed into MonteCarloSimulator)
  const [initialRngSeed, setInitialRngSeed] = useState<string | null>(null)
  const [initialMCParams, setInitialMCParams] = useState<SimulationParams | undefined>(undefined)

  const [initialLogScales, setInitialLogScales] = useState<SharePayload['logScales'] | undefined>(undefined)
  const [initialMCShowFullPrecision, setInitialMCShowFullPrecision] = useState<boolean | undefined>(undefined)

  const calculationState = useWithdrawalCalculation(state)
  const calculation = calculationState.result

  // Listen for the event dispatched by app/page.tsx
  useEffect(() => {
    if (typeof window === 'undefined') return

    const applySharedPayload = (decoded: SharePayload) => {
      if (decoded?.mode !== 'withdrawal') return

      // 1) Restore deterministic params (supports new and old keys)
      const loadedParams = decoded.deterministicParams || decoded.params
      if (loadedParams && 'periodicWithdrawal' in loadedParams) setState(loadedParams)

      // Restore precision toggle if present
      if (typeof decoded.showFullPrecision === 'boolean') {
        setShowFullPrecision(decoded.showFullPrecision)
      }

      // 2) Branch on link type
      if (decoded.type === 'deterministic') {
        setUseMonteCarloMode(false)
      } else {
        // 3) Monte Carlo link: enable MC and restore MC inputs
        setUseMonteCarloMode(true)
        if (decoded.rngSeed) setInitialRngSeed(decoded.rngSeed)
        if (decoded.mcParams) setInitialMCParams(decoded.mcParams)
      }
      
      // Clean URL
      window.history.replaceState(null, '', cleanShareDataFromUrl(window.location.href))
    }

    const handleOpenFromLink = (event: Event) => {
      applySharedPayload((event as CustomEvent<SharePayload>).detail)
    }

    if (sharedPayload) applySharedPayload(sharedPayload)

    // Check on mount if we already have the payload in URL (direct load)
    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')
      if (mcParam) {
        window.addEventListener('openMonteCarloFromLink', handleOpenFromLink)
        return () => window.removeEventListener('openMonteCarloFromLink', handleOpenFromLink)
      }
    } catch {}

    window.addEventListener('openMonteCarloFromLink', handleOpenFromLink)
    return () => window.removeEventListener('openMonteCarloFromLink', handleOpenFromLink)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPayload, setInitialMCParams, setInitialMCShowFullPrecision, setInitialRngSeed, setInitialLogScales, setShowFullPrecision, setState, setUseMonteCarloMode])

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)

    const payload: SharePayload = {
      mode: 'withdrawal',
      type: useMonteCarloMode ? 'monte-carlo' : 'deterministic',
      deterministicParams: state,
      params: state, // legacy compatibility
      showFullPrecision,
    }

    return buildVersionedShareUrl(url.toString(), payload, getAppCurrency().code)
  }

  const handleShareLink = async () => {
    triggerHaptic('light')
    const url = buildShareUrl()
    if (!url) return

    try {
      const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      if (canNativeShare) {
        await navigator.share({
          title: 'Portfolio Simulator',
          text: 'Take a look at my portfolio results',
          url,
        })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        toast('Link copied')
        return
      }

      toast('Copy not supported on this browser')
    } catch (error: unknown) {
      const name = error instanceof DOMException || error instanceof Error ? error.name : undefined
      if (name === 'AbortError' || name === 'NotAllowedError') return
      toast('Could not share or copy link')
    }
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window !== 'undefined') window.print()
  }

  const handleExportExcel = async () => {
    triggerHaptic('light')
    if (!calculation?.yearData.length) return

    const { buildWithdrawalWorkbook } = await import('@/lib/export/withdrawal-workbook')
    const workbook = buildWithdrawalWorkbook(state, calculation, getAppCurrency().symbol, getAppCurrency().code)

    // Generate and Download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-withdrawal-deterministic-${date}.xlsx`
    
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const handleResetScenario = () => {
    if (typeof window !== 'undefined') clearSimulatorScenario(window.localStorage, 'withdrawal')
    setState(DEFAULT_WITHDRAWAL_STATE)
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold">Plan Your Retirement Spending</h2>
        <p className="text-muted-foreground">
          Calculate how long your portfolio can sustain regular withdrawals
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Dices className="h-4 w-4 text-violet-500" />
                  <Label className="text-base font-semibold">Monte Carlo Simulation</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Model portfolio sustainability with randomized scenarios
                </p>
              </div>
              <Switch
                id="withdrawal-monte-carlo-mode"
                aria-label={MONTE_CARLO_SWITCH_LABELS.withdrawal}
                checked={useMonteCarloMode}
                onCheckedChange={setUseMonteCarloMode}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {useMonteCarloMode ? (
        <MonteCarloSimulator
          mode="withdrawal"
          initialValues={state}
          initialRngSeed={initialRngSeed}
          initialMCParams={initialMCParams}
          initialLogScales={initialLogScales}
          initialShowFullPrecision={initialMCShowFullPrecision}
        />
      ) : (
        <>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <WithdrawalParameters state={state} setState={setState} />
          </motion.div>

          {calculationState.error ? (
            <CalculationErrorCard message={calculationState.error} onReset={handleResetScenario} />
          ) : calculation ? (
            <>
              <WithdrawalResults
                data={calculation}
                duration={state.duration}
                showFullPrecision={showFullPrecision}
                setShowFullPrecision={setShowFullPrecision}
                onShare={handleShareLink}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <WithdrawalTable data={calculation.yearData} />
              </motion.div>
            </>
          ) : null}
        </>
      )}

      <DonationSection />
    </div>
  )
}
