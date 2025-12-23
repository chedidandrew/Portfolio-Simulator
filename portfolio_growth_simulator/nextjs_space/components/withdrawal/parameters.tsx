'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Coins, Scale, Settings2 } from 'lucide-react'
import { WithdrawalState } from '@/lib/types'
import { getAppCurrency, formatCurrency } from '@/lib/utils'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface WithdrawalParametersProps {
  state: WithdrawalState
  setState: (state: WithdrawalState) => void
}

export function WithdrawalParameters({ state, setState }: WithdrawalParametersProps) {
  const currencySymbol = getAppCurrency().symbol
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-blue-500" />
          Withdrawal Parameters
        </CardTitle>
        <CardDescription>Configure your retirement spending plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Starting Balance */}
          <div className="space-y-2">
            <Label htmlFor="starting-balance-w">Starting Balance ({currencySymbol})</Label>
            <NumericInput
              id="starting-balance-w"
              value={state.startingBalance ?? 0}
              onChange={(value) => {
                let n = Number(value)
                if (!isFinite(n)) {
                  setState({ ...state, startingBalance: 0 })
                  return
                }
                if (n !== 0 && Math.abs(n) < 0.01) n = 0.01
                const limited = Number(n.toFixed(2))
                setState({ ...state, startingBalance: limited })
              }}
              min={0}
              max={1_000_000_000_000_000_000}
              maxErrorMessage="The Fed wants its printer back :)"
            />
          </div>

          {/* Annual Return */}
          <div className="space-y-2">
            <Label htmlFor="annual-return-w">Annual Return (Geometric/CAGR) (%)</Label>
            <NumericInput
              id="annual-return-w"
              step={0.1}
              value={state.annualReturn ?? 0}
              onChange={(value) => {
                let n = Number(value)
                if (!isFinite(n)) {
                    setState({ ...state, annualReturn: 0 })
                    return
                }
                const MIN_ABS = 0.000001
                if (n !== 0 && Math.abs(n) < MIN_ABS) {
                  n = MIN_ABS * Math.sign(n)
                }
                const limited = Number(n.toFixed(6))
                setState({ ...state, annualReturn: limited })
              }}
              min={-100}
              max={100000}
              maxErrorMessage="Even Medallion doesn't pull returns like that :)"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration-w">Duration (Years)</Label>
            <NumericInput
              id="duration-w"
              value={state.duration ?? 0}
              onChange={(value) =>
                setState({ ...state, duration: Math.max(1, Math.floor(value)) })
              }
              min={1}
              max={200}
              maxErrorMessage="Planning for the next two centuries? :)"
            />
          </div>

          {/* Withdrawal Amount */}
          <div className="space-y-2">
            <Label htmlFor="periodic-withdrawal">
               Withdrawal Amount ({currencySymbol})
            </Label>
            <NumericInput
              id="periodic-withdrawal"
              value={state.periodicWithdrawal ?? 0}
              onChange={(value) => {
                let n = Number(value)
                if (!isFinite(n)) n = 0
                if (n < 0) n = 0
                if (n !== 0 && n < 0.01) n = 0.01
                const limited = Number(n.toFixed(2))
                setState({ ...state, periodicWithdrawal: limited })
              }}
              min={0}
              max={1e18}
              maxErrorMessage="Speedrunning bankruptcy? :)"
            />
            
            {/* --- TAX MESSAGE LOGIC START --- */}
            {state.taxEnabled && state.taxType === 'tax_deferred' && (
              <p className="text-[11px] text-muted-foreground pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                Withdrawing <span className="font-semibold text-primary">{formatCurrencyFullUnder100m(state.periodicWithdrawal ?? 0)}</span> per {state.frequency?.replace('ly', '') || 'month'}, you will net{' '}
                <span className="font-semibold text-primary">
                  {formatCurrencyFullUnder100m(
                    (state.periodicWithdrawal ?? 0) * (1 - Math.min(state.taxRate ?? 0, 99) / 100)
                  )}
                </span>{' '}
                after taxes.
              </p>
            )}

            {state.taxEnabled && state.taxType === 'capital_gains' && (
              <p className="text-[11px] text-muted-foreground pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                 The simulator will automatically increase your withdrawal to cover capital gains tax, ensuring you net exactly <span className="font-semibold">{formatCurrencyFullUnder100m(state.periodicWithdrawal ?? 0)}</span>.
                 <br/>
                 <span className="opacity-80">This gross-up amount varies each year based on your profit margin.</span>
              </p>
            )}

            {state.taxEnabled && state.taxType === 'income' && (
              <p className="text-[11px] text-muted-foreground pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                Like a High-Yield Savings account. Taxes are paid annually on interest, which <span className="font-semibold text-orange-600/90 dark:text-orange-400/90">slows down your growth</span>. 
                Your withdrawal remains exactly {formatCurrencyFullUnder100m(state.periodicWithdrawal ?? 0)}.
              </p>
            )}
            {/* --- TAX MESSAGE LOGIC END --- */}

          </div>
          
          {/* Inflation Adjustment - With Toggle */}
          <div className="space-y-2">
            <Label htmlFor="inflation">Annual Inflation (%)</Label>
            <div className="flex flex-col gap-3">
              <NumericInput
                id="inflation"
                step={0.1}
                value={state.inflationAdjustment ?? 0}
                onChange={(value) => {
                  let n = Number(value)
                  if (!isFinite(n)) {
                    setState({ ...state, inflationAdjustment: 0 })
                    return
                  }
                  const MIN_ABS = 0.000001
                  if (n !== 0 && Math.abs(n) < MIN_ABS) {
                    n = MIN_ABS * Math.sign(n)
                  }
                  const limited = Number(n.toFixed(6))
                  setState({ ...state, inflationAdjustment: limited })
                }}
                min={-50}
                max={100}
                maxErrorMessage="Your grocery bill just fainted :)"
              />
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="adjust-withdrawals"
                  checked={!(state.excludeInflationAdjustment ?? false)}
                  onCheckedChange={(checked) =>
                    setState({ ...state, excludeInflationAdjustment: !checked })
                  }
                />
                <Label
                  htmlFor="adjust-withdrawals"
                  className="text-xs font-normal text-muted-foreground cursor-pointer"
                >
                  Increase withdrawals annually by this rate?
                </Label>
              </div>
            </div>
          </div>
          
          {/* Tax Configuration */}
          <div className="space-y-2">
             <div className="flex items-center justify-left gap-2">
              <Label htmlFor="tax-enabled-w" className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Enable Taxes
                <span className="hidden print:inline font-normal text-muted-foreground">
                  {state.taxEnabled ? '(Enabled)' : '(Disabled)'}
                </span>
              </Label>
              <Switch
                id="tax-enabled-w"
                className="print:hidden"
                checked={state.taxEnabled ?? false}
                onCheckedChange={(checked) => {
                  const currentRate = state.taxRate ?? 0
                  const newRate = checked && currentRate === 0 ? 20 : currentRate
                  setState({ ...state, taxEnabled: checked, taxRate: newRate })
                }}
              />
            </div>

            {state.taxEnabled && (
               <div className="pt-2 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                 <div className="space-y-1">
                   <Label htmlFor="tax-rate-w" className="text-xs">Tax Rate (%)</Label>
                   <NumericInput
                     id="tax-rate-w"
                     value={state.taxRate ?? 0}
                     onChange={(value) => setState({ ...state, taxRate: Math.max(0, Math.min(99, value)) })}
                     min={0}
                     max={99}
                   />
                 </div>
                 <div className="space-y-1">
                   <Label htmlFor="tax-type-w" className="text-xs">Tax Type</Label>
                   <Select
                      value={state.taxType ?? 'capital_gains'}
                      onValueChange={(value: any) => setState({ ...state, taxType: value })}
                    >
                      <SelectTrigger id="tax-type-w" className="h-10 print:hidden">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="capital_gains">Taxable Account</SelectItem>
                        <SelectItem value="tax_deferred">Tax-Deferred (401k/IRA)</SelectItem>
                        <SelectItem value="income">Annual (Tax Drag)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="hidden print:block text-xs text-muted-foreground pt-1">
                      Selected: {state.taxType === 'income' ? 'Annual (Tax Drag)' : (state.taxType === 'tax_deferred' ? 'Tax-Deferred (401k/IRA)' : 'Taxable Account')}
                    </p>
                 </div>
               </div>
            )}
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency-w">Withdrawal Frequency</Label>
            <Select
              value={state.frequency ?? 'monthly'}
              onValueChange={(value: any) =>
                setState({ ...state, frequency: value })
              }
            >
              <SelectTrigger id="frequency-w" className="print:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="hidden print:block text-xs text-muted-foreground pt-1 capitalize">
              Selected: {state.frequency ?? 'monthly'}
            </p>
          </div>
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
                Interest Rate Calculation: {(state.calculationMode ?? 'effective') === 'nominal' ? 'Nominal Rate (APR)' : 'Effective Rate (APY)'}
             </p>
          </div>
          
          {showAdvanced && (
            <div className="pt-4 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 print:hidden">
               <div className="space-y-2">
                <Label htmlFor="calc-mode-w">Interest Rate Calculation</Label>
                <Select
                  value={state.calculationMode ?? 'effective'}
                  onValueChange={(value: any) => setState({ ...state, calculationMode: value })}
                >
                  <SelectTrigger id="calc-mode-w">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="effective">Effective Rate (APY)</SelectItem>
                    <SelectItem value="nominal">Nominal Rate (APR)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {state.calculationMode === 'nominal'
                    ? "Divides annual rate by 12. Actual yield will be higher than the input rate due to compounding."
                    : "Calculates monthly rate so the annual yield matches exactly. Best for comparing advertised APYs."}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}