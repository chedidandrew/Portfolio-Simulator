'use client'

import { useState } from 'react'
import { Coins, Scale, Settings2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { TaxSettingsPanel } from '@/components/tax-settings-panel'
import type { SimulationParams } from '@/lib/types'
import { formatCurrency, getAppCurrency } from '@/lib/utils'
import { MAX_MONTE_CARLO_WORK, stepsPerYear } from '@/lib/simulation/financial-utils'
import { markCostBasisUserEdited, updateInitialValueWithTrackedBasis } from '@/lib/state-normalization'

interface MonteCarloParametersProps {
  mode: 'growth' | 'withdrawal'
  params: SimulationParams
  setParams: (params: SimulationParams) => void
  profile: string
  setProfile: (profile: any) => void
  isSimulating: boolean
  onRun: () => void
  presetProfiles: Record<string, { name: string; expectedReturn: number; volatility: number; description: string }>
}

const periodTitle = (frequency: SimulationParams['cashflowFrequency']) => (
  frequency.charAt(0).toUpperCase() + frequency.slice(1)
)

const periodNoun = (frequency: SimulationParams['cashflowFrequency']) => {
  if (frequency === 'weekly') return 'week'
  if (frequency === 'monthly') return 'month'
  if (frequency === 'quarterly') return 'quarter'
  return 'year'
}

export function MonteCarloParameters({
  mode,
  params,
  setParams,
  profile,
  setProfile,
  isSimulating,
  onRun,
  presetProfiles,
}: MonteCarloParametersProps) {
  const currencySymbol = getAppCurrency().symbol
  const [showAdvanced, setShowAdvanced] = useState(false)
  const estimatedWork = params.numPaths * Math.ceil(params.duration * stepsPerYear(params.cashflowFrequency))
  const workloadTooLarge = !Number.isSafeInteger(estimatedWork) || estimatedWork > MAX_MONTE_CARLO_WORK
  const selectedProfile = presetProfiles[profile] ?? presetProfiles.custom ?? Object.values(presetProfiles)[0]
  const cashflowLabel = mode === 'growth'
    ? `${periodTitle(params.cashflowFrequency)} Contribution`
    : `${periodTitle(params.cashflowFrequency)} Withdrawal${params.taxEnabled && params.taxType !== 'income' ? ' (Gross)' : ''}`

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
          <CardDescription>
            Run seeded scenarios to examine a range of outcomes under market volatility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="print:hidden">Select Profile</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:hidden">
            {Object.entries(presetProfiles).map(([key, preset]) => (
              <Button
                key={key}
                type="button"
                variant={profile === key ? 'default' : 'outline'}
                onClick={() => setProfile(key)}
                className="h-auto flex-col py-3"
              >
                <span className="text-xs font-semibold leading-tight sm:text-sm">{preset.name}</span>
                {key !== 'custom' && (
                  <span className="text-xs opacity-80">{preset.expectedReturn}% / {preset.volatility}% vol</span>
                )}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground print:hidden">{selectedProfile?.description}</p>
          <p className="hidden text-sm print:block">
            <span className="font-semibold">Selected Profile:</span> {selectedProfile?.name}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-violet-500" aria-hidden="true" />
            Simulation Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mc-initial">Initial Portfolio Value ({currencySymbol})</Label>
              <NumericInput
                id="mc-initial"
                value={params.initialValue}
                onChange={(value) => {
                  let amount = Number(value)
                  if (!Number.isFinite(amount)) amount = 0
                  if (amount !== 0 && Math.abs(amount) < 0.01) amount = 0.01
                  setParams(updateInitialValueWithTrackedBasis(params, Number(amount.toFixed(2))))
                }}
                min={mode === 'growth' ? 0 : 0.01}
                max={1e18}
                maxErrorMessage="This value is outside the supported range."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-return">Median Geometric Return Assumption (%)</Label>
              <NumericInput
                id="mc-return"
                step={0.1}
                value={params.expectedReturn}
                onChange={(value) => {
                  const rate = Number.isFinite(Number(value)) ? Number(value) : 0
                  setParams({ ...params, expectedReturn: Number(rate.toFixed(6)) })
                }}
                disabled={profile !== 'custom'}
                min={-99.999999}
                max={100000}
                maxErrorMessage="This return is outside the supported range."
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                With stress events off, this centers the median geometric path. It is not an arithmetic-mean forecast.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-volatility">Volatility / Std Dev (%)</Label>
              <NumericInput
                id="mc-volatility"
                step={0.1}
                value={params.volatility}
                onChange={(value) => {
                  const volatility = Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0)
                  setParams({ ...params, volatility: Number(volatility.toFixed(6)) })
                }}
                disabled={profile !== 'custom'}
                min={0}
                max={100}
                maxErrorMessage="Volatility must be between 0% and 100%."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-duration">Duration (Years)</Label>
              <NumericInput
                id="mc-duration"
                value={params.duration}
                onChange={(value) => setParams({ ...params, duration: Math.max(1, Math.floor(value)) })}
                min={1}
                max={200}
                maxErrorMessage="Duration is limited to 200 years."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-cashflow">{cashflowLabel} ({currencySymbol})</Label>
              <NumericInput
                id="mc-cashflow"
                value={params.cashflowAmount}
                onChange={(value) => {
                  let amount = Number(value)
                  if (!Number.isFinite(amount) || amount < 0) amount = 0
                  if (amount !== 0 && amount < 0.01) amount = 0.01
                  setParams({ ...params, cashflowAmount: Number(amount.toFixed(2)) })
                }}
                min={0}
                max={1e18}
                maxErrorMessage="This cashflow is outside the supported range."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-frequency">Cashflow Frequency</Label>
              <Select
                value={params.cashflowFrequency}
                onValueChange={(value) => setParams({ ...params, cashflowFrequency: value as SimulationParams['cashflowFrequency'] })}
              >
                <SelectTrigger id="mc-frequency" className="h-10 print:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <p className="hidden text-xs capitalize text-muted-foreground print:block">Selected: {params.cashflowFrequency}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-inflation">Annual Inflation (%)</Label>
              <NumericInput
                id="mc-inflation"
                step={0.1}
                value={params.inflationAdjustment ?? 0}
                onChange={(value) => {
                  const inflation = Number.isFinite(Number(value)) ? Number(value) : 0
                  setParams({ ...params, inflationAdjustment: Number(inflation.toFixed(6)) })
                }}
                min={-50}
                max={100}
                maxErrorMessage="Inflation must be between -50% and 100%."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mc-paths">Number of Scenarios</Label>
              <Select
                value={params.numPaths.toString()}
                onValueChange={(value) => setParams({ ...params, numPaths: Number(value) })}
              >
                <SelectTrigger id="mc-paths" className="print:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 scenario, sample path</SelectItem>
                  <SelectItem value="100">100 scenarios</SelectItem>
                  <SelectItem value="500">500 scenarios</SelectItem>
                  <SelectItem value="1000">1,000 scenarios</SelectItem>
                  <SelectItem value="5000">5,000 scenarios</SelectItem>
                  <SelectItem value="10000">10,000 scenarios</SelectItem>
                  <SelectItem value="50000">50,000 scenarios</SelectItem>
                  <SelectItem value="100000">100,000 scenarios</SelectItem>
                </SelectContent>
              </Select>
              {workloadTooLarge ? (
                <p role="alert" className="text-[10px] font-medium text-destructive print:hidden">
                  This request contains {estimatedWork.toLocaleString()} path-period calculations. Reduce scenarios, duration, or frequency to {MAX_MONTE_CARLO_WORK.toLocaleString()} or less.
                </p>
              ) : params.numPaths >= 50_000 ? (
                <p className="text-[10px] font-medium text-orange-600 dark:text-orange-400 print:hidden">
                  Large runs reduce sampling noise but can take noticeably longer.
                </p>
              ) : null}
              <p className="hidden text-xs text-muted-foreground print:block">Selected: {params.numPaths.toLocaleString()}</p>
            </div>

            <div className={`space-y-2 self-start sm:pt-1 ${mode === 'withdrawal' ? 'sm:col-span-2' : ''}`}>
              <div className="flex items-center gap-2">
                <Label htmlFor="mc-tax-enabled" className="flex items-center gap-2">
                  <Scale className="h-4 w-4" aria-hidden="true" />
                  Enable Taxes
                  <span className="hidden font-normal text-muted-foreground print:inline">
                    {params.taxEnabled ? '(Enabled)' : '(Disabled)'}
                  </span>
                </Label>
                <Switch
                  id="mc-tax-enabled"
                  className="print:hidden"
                  checked={params.taxEnabled ?? false}
                  onCheckedChange={(checked) => {
                    let taxRate = params.taxRate ?? 0
                    if (checked && taxRate === 0) {
                      taxRate = mode === 'withdrawal' ? 20 : params.taxType === 'income' ? 25 : 15
                    }
                    setParams({ ...params, taxEnabled: checked, taxRate })
                  }}
                />
              </div>
            </div>

            {mode === 'growth' && (
              <div className="space-y-2">
                <Label htmlFor="mc-goal">Portfolio Goal (Optional)</Label>
                <NumericInput
                  id="mc-goal"
                  placeholder="e.g., 1000000"
                  value={params.portfolioGoal ?? ''}
                  onChange={(value) => {
                    if (!value && value !== 0) {
                      setParams({ ...params, portfolioGoal: undefined })
                      return
                    }
                    const goal = Math.max(0, Number(value))
                    setParams({ ...params, portfolioGoal: Number(goal.toFixed(2)) })
                  }}
                  min={0}
                  max={1e18}
                  maxErrorMessage="This goal is outside the supported range."
                />
              </div>
            )}

            {params.taxEnabled && (
              <TaxSettingsPanel
                testId="monte-carlo-tax-details"
                taxRateId="mc-tax-rate"
                taxTypeId="mc-tax-type"
                costBasisId="mc-starting-cost-basis"
                taxRate={params.taxRate ?? 0}
                taxType={params.taxType ?? 'capital_gains'}
                currentCostBasis={params.startingCostBasis ?? params.initialValue}
                currencySymbol={currencySymbol}
                basisHelp="Automatically follows Initial Portfolio Value until you edit it. Tax basis is then tracked separately."
                taxRateErrorMessage="Tax rate is limited to 99%."
                onTaxRateChange={(value) => setParams({ ...params, taxRate: Math.max(0, Math.min(99, value)) })}
                onTaxTypeChange={(value) => setParams({ ...params, taxType: value })}
                onCostBasisChange={(value) => setParams(markCostBasisUserEdited(params, value))}
                description={mode === 'growth'
                  ? params.taxType === 'income'
                    ? 'Positive expected growth is reduced by the selected annual income-tax drag.'
                    : params.taxType === 'tax_deferred'
                      ? 'The full ending balance is valued after the selected effective tax rate.'
                      : 'Capital-gains tax is estimated from gains above the tracked cost basis.'
                  : params.taxType === 'tax_deferred'
                    ? <>A gross {periodNoun(params.cashflowFrequency)}ly withdrawal of <strong>{formatCurrency(params.cashflowAmount, true, 0, false)}</strong> produces after-tax spending based on the selected rate.</>
                    : params.taxType === 'income'
                      ? <>Taxes reduce positive portfolio growth. The requested withdrawal remains gross spending.</>
                      : <>Capital-gains tax is estimated proportionally from unrealized gains, so net spending changes as cost basis changes.</>}
              />
            )}
          </div>

          <div className="border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto gap-2 p-0 font-medium hover:bg-transparent hover:text-primary print:hidden"
              onClick={() => setShowAdvanced((current) => !current)}
              aria-expanded={showAdvanced}
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Advanced Settings
            </Button>

            {showAdvanced && (
              <div className="space-y-4 pt-4 print:hidden">
                <div className="space-y-2">
                  <Label htmlFor="mc-calc-mode">Interest Rate Calculation</Label>
                  <Select
                    value={params.calculationMode ?? 'effective'}
                    onValueChange={(value) => setParams({ ...params, calculationMode: value as 'effective' | 'nominal' })}
                  >
                    <SelectTrigger id="mc-calc-mode" className="w-full sm:w-1/2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="effective">Effective Rate (APY)</SelectItem>
                      <SelectItem value="nominal">Nominal Rate (APR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {params.calculationMode === 'nominal'
                      ? 'The entered APR is divided across the selected periods, producing a compounded effective annual rate.'
                      : 'The entered effective annual assumption is converted to an equivalent per-period rate.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="mc-crash-risk">Market crash and recovery stress events</Label>
                    <Switch
                      id="mc-crash-risk"
                      checked={params.enableCrashRisk ?? false}
                      onCheckedChange={(checked) => setParams({ ...params, enableCrashRisk: checked })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adds seeded, horizon-scaled declines followed by partial recoveries. These are heuristic stress events, not forecasts.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={onRun}
            disabled={isSimulating || workloadTooLarge}
            className="w-full sm:w-auto print:hidden"
          >
            <Zap className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSimulating ? 'Simulating...' : 'Run New Simulation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
