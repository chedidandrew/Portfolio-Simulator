'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { NumericInput } from '@/components/ui/numeric-input'
import { Coins, Zap, Scale, Settings2 } from 'lucide-react'
import { SimulationParams } from '@/lib/types'
import { getAppCurrency, formatCurrency } from '@/lib/utils'
import { useState } from 'react'
import { MAX_MONTE_CARLO_WORK, stepsPerYear } from '@/lib/simulation/financial-utils'
import { TaxSettingsPanel } from '@/components/tax-settings-panel'
import { markCostBasisUserEdited, updateInitialValueWithTrackedBasis } from '@/lib/state-normalization'

interface MonteCarloParametersProps {
  mode: 'growth' | 'withdrawal'
  params: SimulationParams
  setParams: (p: SimulationParams) => void
  profile: string
  setProfile: (p: any) => void
  isSimulating: boolean
  onRun: () => void
  presetProfiles: Record<string, { name: string; expectedReturn: number; volatility: number; description: string }>
}

export function MonteCarloParameters({
  mode,
  params,
  setParams,
  profile,
  setProfile,
  isSimulating,
  onRun,
  presetProfiles
}: MonteCarloParametersProps) {
  
  const currencySymbol = getAppCurrency().symbol
  const [showAdvanced, setShowAdvanced] = useState(false)
  const estimatedWork = params.numPaths * Math.ceil(params.duration * stepsPerYear(params.cashflowFrequency))
  const workloadTooLarge = !Number.isSafeInteger(estimatedWork) || estimatedWork > MAX_MONTE_CARLO_WORK

  const formatCurrencyFullUnder100m = (amount: number) => {
    const n = Number(amount)
    if (!isFinite(n)) return formatCurrency(0)
    if (Math.abs(n) >= 100_000_000) return formatCurrency(n)
    const appCurrency: any = getAppCurrency()
    const code = appCurrency?.code || appCurrency?.currency || 'USD'
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'symbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n)
    } catch {
      const symbol = appCurrency?.symbol ?? ''
      return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }

  const getCashflowPeriodTitle = () => {
    if (params.cashflowFrequency === 'weekly') return 'Weekly'
    if (params.cashflowFrequency === 'monthly') return 'Monthly'
    if (params.cashflowFrequency === 'quarterly') return 'Quarterly'
    return 'Yearly'
  }

  const getCashflowPeriodNoun = () => {
    if (params.cashflowFrequency === 'weekly') return 'week'
    if (params.cashflowFrequency === 'monthly') return 'month'
    if (params.cashflowFrequency === 'quarterly') return 'quarter'
    return 'year'
  }

  const getCashflowLabel = () => {
    const period = getCashflowPeriodTitle()
    if (mode === 'growth') return `${period} Contribution`
    if (params.taxEnabled) {
       if (params.taxType === 'capital_gains') return `${period} Withdrawal (Gross)`
       if (params.taxType === 'tax_deferred') return `${period} Withdrawal (Gross)`
    }
    return `${period} Withdrawal`
  }

  return (
    <div className="space-y-6">
      <Card>
         {/* ... (Existing Profile Selection Card Code) ... */}
         <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Monte Carlo Simulation
          </CardTitle>
          <CardDescription>
            Run thousands of scenarios to test portfolio outcomes under market volatility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="print:hidden">Select Profile</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:hidden">
              {Object.entries(presetProfiles).map(([key, preset]) => (
                <Button
                  key={key}
                  variant={profile === key ? 'default' : 'outline'}
                  onClick={() => setProfile(key)}
                  className="flex flex-col h-auto py-3"
                >
                  <span className="font-semibold text-right break-all text-xs sm:text-sm leading-tight">{preset.name}</span>
                  {key !== 'custom' && (
                    <span className="text-xs opacity-80">
                      {preset.expectedReturn}% / {preset.volatility}% vol
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Print-only view of selected profile */}
            <div className="hidden print:block text-sm">
              <span className="font-semibold">Selected Profile:</span> {presetProfiles[profile].name}
              {profile !== 'custom' && ` (${presetProfiles[profile].expectedReturn}% Return, ${presetProfiles[profile].volatility}% Volatility)`}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 print:hidden">
              {presetProfiles[profile].description}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 shrink-0 -ml-1">
              <Coins className="h-5 w-5 text-violet-500" />
              <CardTitle>Simulation Parameters</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Initial Value */}
            <div className="space-y-2">
              <Label htmlFor="mc-initial">Initial Portfolio Value ({currencySymbol})</Label>
              <NumericInput
                id="mc-initial"
                value={params.initialValue}
                onChange={(value) => {
                  let n = Number(value)
                  if (!isFinite(n)) {
                    setParams(updateInitialValueWithTrackedBasis(params, 0))
                    return
                  }
                  // Currency clamp
                  if (n !== 0 && Math.abs(n) < 0.01) n = 0.01
                  const limited = Number(n.toFixed(2))
                  setParams(updateInitialValueWithTrackedBasis(params, limited))
                }}
                min={mode === 'growth' ? 0 : 0.01}
                max={1e18}
                maxErrorMessage="This number violates several economic laws :)"
              />
            </div>

            {/* Expected Return */}
            <div className="space-y-2">
              <Label htmlFor="mc-return">Expected Annual Growth Rate (%)</Label>
              <NumericInput
                id="mc-return"
                step={0.1}
                value={params.expectedReturn}
                onChange={(value) => {
                  let n = Number(value)
                  if (!isFinite(n)) {
                    setParams({ ...params, expectedReturn: 0 })
                    return
                  }
                  // Rate clamp
                  const MIN_ABS = 0.000001
                  if (n !== 0 && Math.abs(n) < MIN_ABS) {
                    n = MIN_ABS * Math.sign(n)
                  }
                  const limited = Number(n.toFixed(6))
                  setParams({ ...params, expectedReturn: limited })
                }}
                disabled={profile !== 'custom'}
                min={-100}
                max={100000}
                maxErrorMessage="Easy there, Jeff Bezos :)"
              />
            </div>

            {/* Volatility */}
            <div className="space-y-2">
              <Label htmlFor="mc-volatility">Volatility / Std Dev (%)</Label>
              <NumericInput
                id="mc-volatility"
                step={0.1}
                value={params.volatility}
                onChange={(value) => {
                  let n = Number(value)
                  if (!isFinite(n)) {
                    setParams({ ...params, volatility: 0 })
                    return
                  }
                  // Volatility should be positive. Clamp tiny positive.
                  const MIN_ABS = 0.000001
                  if (n !== 0 && Math.abs(n) < MIN_ABS) {
                    n = MIN_ABS
                  }
                  const limited = Number(n.toFixed(6))
                  setParams({ ...params, volatility: limited })
                }}
                disabled={profile !== 'custom'}
                min={0}
                max={100}
                maxErrorMessage="Even crypto thinks that's volatile :)"
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="mc-duration">Duration (Years)</Label>
              <NumericInput
                id="mc-duration"
                value={params.duration}
                onChange={(value) => setParams({ ...params, duration: Math.max(1, Math.floor(value)) })}
                min={1}
                max={200}
                maxErrorMessage="Even Michael Newman didn't live to 200 years :)"
              />
            </div>

            {/* Cashflow (Contribution or Withdrawal) */}
            <div className="space-y-2">
              <Label htmlFor="mc-cashflow">
                {getCashflowLabel()} ({currencySymbol})
              </Label>
              <NumericInput
                id="mc-cashflow"
                value={params.cashflowAmount}
                onChange={(value) => {
                  let n = Number(value)
                  if (!isFinite(n)) n = 0
                  if (n < 0) n = 0
                  // Currency clamp
                  if (n !== 0 && n < 0.01) n = 0.01
                  const limited = Number(n.toFixed(2))
                  setParams({ ...params, cashflowAmount: limited })
                }}
                min={0}
                max={1e18}
                maxErrorMessage="I admire your confidence, but no :)"
              />
            </div>

            {/* Cashflow Frequency */}
            <div className="space-y-2">
              <Label htmlFor="mc-frequency">Cashflow Frequency</Label>
              <Select
                value={params.cashflowFrequency}
                onValueChange={(value: any) => setParams({ ...params, cashflowFrequency: value })}
              >
                <SelectTrigger id="mc-frequency" className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Inflation */}
            <div className="space-y-2">
              <Label htmlFor="mc-inflation">
                Annual Inflation (%)
              </Label>
              <NumericInput
                id="mc-inflation"
                step={0.1}
                value={params.inflationAdjustment ?? 0}
                onChange={(value) => {
                  let n = Number(value)
                  if (!isFinite(n)) {
                    setParams({ ...params, inflationAdjustment: 0 })
                    return
                  }
                  const MIN_ABS = 0.000001
                  if (n !== 0 && Math.abs(n) < MIN_ABS) {
                    n = MIN_ABS * Math.sign(n)
                  }
                  const limited = Number(n.toFixed(6))
                  setParams({ ...params, inflationAdjustment: limited })
                }}
                min={-50}
                max={100}
                maxErrorMessage="Easy there, Zimbabwe :)"
              />
            </div>

            {/* Number of Scenarios */}
            <div className="space-y-2">
              <Label htmlFor="mc-paths">Number of Scenarios</Label>
              <Select
                value={params.numPaths?.toString() ?? '500'}
                onValueChange={(value) => setParams({ ...params, numPaths: Number(value) })}
              >
                <SelectTrigger id="mc-paths" className="print:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 scenario - sample path</SelectItem>
                  <SelectItem value="100">100 scenarios</SelectItem>
                  <SelectItem value="500">500 scenarios</SelectItem>
                  <SelectItem value="1000">1,000 scenarios</SelectItem>
                  <SelectItem value="5000">5,000 scenarios</SelectItem>
                  <SelectItem value="10000">10,000 scenarios</SelectItem>
                  <SelectItem value="50000">50,000 scenarios</SelectItem>
                  <SelectItem value="100000">100,000 scenarios (Slow)</SelectItem>
                </SelectContent>
              </Select>
              {workloadTooLarge ? (
                <p className="text-[10px] text-destructive font-medium pt-1 print:hidden">
                  This request contains {estimatedWork.toLocaleString()} path-period calculations. Reduce scenarios, duration, or frequency to {MAX_MONTE_CARLO_WORK.toLocaleString()} or less.
                </p>
              ) : params.numPaths >= 50_000 ? (
                <p className="text-[10px] text-orange-500 font-medium pt-1 print:hidden">
                  Large simulations can take noticeable time. More scenarios reduce sampling noise but do not improve the assumptions themselves.
                </p>
              ) : null}

              <p className="hidden print:block text-xs text-muted-foreground">
                Selected: {(params.numPaths ?? 500).toLocaleString()}
              </p>
            </div>

            {/* Portfolio Goal (Growth Mode Only) */}
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
                    let n = Number(value)
                    if (!isFinite(n)) return
                    if (n < 0) n = 0
                    if (n !== 0 && n < 0.01) n = 0.01
                    const limited = Number(n.toFixed(2))
                    setParams({ ...params, portfolioGoal: limited })
                  }}
                  min={0}
                  max={1e18}
                  maxErrorMessage="Sir, this is a Wendy's :)"
                />
              </div>
            )}

            {/* Tax Options */}
            <div className={`space-y-2 self-start sm:pt-1 ${mode === 'withdrawal' ? 'sm:col-span-2' : ''}`}>
              <div className="flex items-center justify-left gap-2">
                <Label htmlFor="mc-tax-enabled" className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Enable Taxes
                  <span className="hidden print:inline font-normal text-muted-foreground">
                    {params.taxEnabled ? '(Enabled)' : '(Disabled)'}
                  </span>
                </Label>
                <Switch
                  id="mc-tax-enabled"
                  className="print:hidden"
                  checked={params.taxEnabled ?? false}
                  onCheckedChange={(checked) => {
                    let newRate = params.taxRate ?? 0
                    if (checked && newRate === 0) {
                      newRate = mode === 'withdrawal' ? 20 : params.taxType === 'income' ? 25 : 15
                    }
                    setParams({ ...params, taxEnabled: checked, taxRate: newRate })
                  }}
                />
              </div>
            </div>

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
                basisHelp="Automatically follows Initial Portfolio Value until you edit it. Tax basis is then tracked separately for the taxable-account calculation."
                taxRateErrorMessage="At 100% you are officially working for free :)"
                onTaxRateChange={(value) => setParams({ ...params, taxRate: Math.max(0, Math.min(99, value)) })}
                onTaxTypeChange={(value) => setParams({ ...params, taxType: value })}
                onCostBasisChange={(value) => setParams(markCostBasisUserEdited(params, value))}
                description={mode === 'growth'
                  ? params.taxType === 'income'
                    ? 'Taxes reduce the annual return rate.'
                    : params.taxType === 'tax_deferred'
                      ? 'The full balance is valued after the assumed effective tax rate.'
                      : 'Capital gains tax is deducted from final profit.'
                  : params.taxType === 'tax_deferred'
                    ? <>
                        Withdrawing <span className="font-semibold text-primary">{formatCurrency(params.cashflowAmount ?? 0, true, 0, false)}</span> per {getCashflowPeriodNoun()}, you will net{' '}
                        <span className="font-semibold text-primary">
                          {formatCurrency((params.cashflowAmount ?? 0) * (1 - Math.min(params.taxRate ?? 0, 99) / 100), true, 2, false)}
                        </span>{' '}after taxes.
                      </>
                    : params.taxType === 'income'
                      ? <>Taxes are paid annually on interest and slow portfolio growth. Your withdrawal remains {formatCurrency(params.cashflowAmount ?? 0, true, 0, false)}.</>
                      : <>Withdrawing <span className="font-semibold">{formatCurrencyFullUnder100m(params.cashflowAmount ?? 0)}</span> gross, capital gains tax is deducted from this amount. Net spending varies as cost basis changes.</>}
              />
            )}

          </div>

          {/* Advanced Settings */}
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 p-0 h-auto font-medium hover:bg-transparent hover:text-primary print:hidden"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="h-4 w-4" />
              Advanced Settings
            </Button>

            <div className="hidden print:block pt-1">
               <div className="flex items-center gap-2 font-medium text-sm">
                  <Settings2 className="h-4 w-4" />
                  Advanced Settings
               </div>
               <p className="text-xs text-muted-foreground pt-1">
                  Interest Rate Calculation: {(params.calculationMode ?? 'effective') === 'nominal' ? 'Nominal Rate (APR)' : 'Effective Rate (APY)'}
               </p>
               <p className="text-xs text-muted-foreground pt-1">
                  Extreme crash cycles: {params.enableCrashRisk ? 'Enabled' : 'Disabled'}
               </p>
            </div>
            
            {showAdvanced && (
              <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 print:hidden">
                 <div className="space-y-2">
                  <Label htmlFor="mc-calc-mode">Interest Rate Calculation</Label>
                  <Select
                    value={params.calculationMode ?? 'effective'}
                    onValueChange={(value: any) => setParams({ ...params, calculationMode: value })}
                  >
                    <SelectTrigger id="mc-calc-mode" className="w-full sm:w-[50%]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="effective">Effective Rate (APY)</SelectItem>
                      <SelectItem value="nominal">Nominal Rate (APR)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {params.calculationMode === 'nominal'
                      ? "Input is Nominal (APR). We convert this to a higher Effective Annual Rate for the simulation to account for monthly compounding."
                      : "Input is Effective (APY). With stress events off, the model centers its median geometric path around this assumption."}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="mc-crash-risk">Market crash and recovery stress events</Label>
                    <Switch
                      id="mc-crash-risk"
                      checked={params.enableCrashRisk ?? false}
                      onCheckedChange={(checked) => setParams({ ...params, enableCrashRisk: checked })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adds optional horizon-scaled market declines followed by partial recoveries. Short simulations may have no stress event.
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={onRun}
            disabled={isSimulating || workloadTooLarge}
            className="w-full sm:w-auto print:hidden" 
          >
            <Zap className="h-4 w-4 mr-2" />
            {isSimulating ? 'Simulating...' : 'Run New Simulation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
