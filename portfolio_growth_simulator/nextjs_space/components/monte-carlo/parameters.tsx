// [file] components/monte-carlo/parameters.tsx
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { NumericInput } from '@/components/ui/numeric-input'
import { Coins, Zap, Scale, Settings2 } from 'lucide-react'
import { SimulationParams } from '@/lib/types'
import { getAppCurrency } from '@/lib/utils'
import { useState } from 'react'

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

  const getCashflowLabel = () => {
    if (mode === 'growth') return 'Monthly Contribution'
    if (params.taxEnabled) return 'Monthly Spending (Net/After-Tax)'
    return 'Monthly Withdrawal'
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
                    setParams({ ...params, initialValue: 0 })
                    return
                  }
                  // Currency clamp
                  if (n !== 0 && Math.abs(n) < 0.01) n = 0.01
                  const limited = Number(n.toFixed(2))
                  setParams({ ...params, initialValue: limited })
                }}
                min={1}
                max={1_000_000_000_000_000_000}
                maxErrorMessage="This number violates several economic laws :)"
              />
            </div>

            {/* Expected Return */}
            <div className="space-y-2">
              <Label htmlFor="mc-return">Expected Annual Return (%)</Label>
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
                max={1_000_000_000_000_000_000}
                maxErrorMessage="I admire your confidence, but no :)"
              />
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

            {/* Tax Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-left gap-2">
                <Label htmlFor="mc-tax-enabled" className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Enable Taxes
                </Label>
                <Switch
                  id="mc-tax-enabled"
                  checked={params.taxEnabled ?? false}
                  onCheckedChange={(checked) => {
                    let newRate = params.taxRate ?? 0

                    if (checked && newRate === 0) {
                      if (mode === 'withdrawal') {
                        newRate = 20 // Withdrawal Income Tax default
                      } else {
                        // Growth defaults
                        newRate = params.taxType === 'income' ? 25 : 15
                      }
                    }

                    setParams({ ...params, taxEnabled: checked, taxRate: newRate })
                  }}
                />
              </div>

              {params.taxEnabled && (
                <div className="pt-0 grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label htmlFor="mc-tax-rate" className="text-xs">Tax Rate (%)</Label>
                    <NumericInput
                      id="mc-tax-rate"
                      value={params.taxRate ?? 0}
                      onChange={(value) => setParams({ ...params, taxRate: Math.max(0, Math.min(99, value)) })}
                      min={0}
                      max={99}
                      maxErrorMessage="At 100% you are officially working for free :)"
                    />
                    {mode === 'withdrawal' && params.taxType !== 'income' && (
                      <p className="text-xs text-muted-foreground pt-3">
                        We gross up the withdrawal to give you this Net amount.
                      </p>
                    )}
                  </div>

                  {mode === 'growth' && (
                    <div className="space-y-1">
                      <Label htmlFor="mc-tax-type" className="text-xs">Tax Type</Label>
                      <Select
                        value={params.taxType ?? 'capital_gains'}
                        onValueChange={(value: any) => setParams({ ...params, taxType: value })}
                      >
                        <SelectTrigger id="mc-tax-type" className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="capital_gains">
                            {mode === 'growth' ? 'Deferred (Cap Gains)' : 'Transaction (Gross Up)'}
                          </SelectItem>
                          <SelectItem value="income">Annual (Tax Drag)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground pt-1">
                        {params.taxType === 'income'
                          ? 'Reduces annual return rate.'
                          : (mode === 'growth' ? 'Deducts tax from final profit.' : 'Increases withdrawal amount to cover tax.')}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
                  max={1_000_000_000_000_000_000}
                  maxErrorMessage="Sir, this is a Wendy's :)"
                />
              </div>
            )}

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
              
              {params.numPaths === 100000 && (
                <p className="text-[10px] text-orange-500 font-medium animate-pulse pt-1 print:hidden">
                  Warning: 100,000 paths might freeze the browser UI for a few seconds on slower devices.
                </p>
              )}

              <p className="hidden print:block text-xs text-muted-foreground">
                Selected: {(params.numPaths ?? 500).toLocaleString()}
              </p>
            </div>

          </div>

          {/* Advanced Settings */}
          <div className="pt-4 border-t print:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 p-0 h-auto font-medium hover:bg-transparent hover:text-primary"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="h-4 w-4" />
              Advanced Settings
            </Button>
            
            {showAdvanced && (
              <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
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
                      : "Input is Effective (APY). The simulation's Median (most likely) outcome will match this return rate exactly."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={onRun}
            disabled={isSimulating}
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