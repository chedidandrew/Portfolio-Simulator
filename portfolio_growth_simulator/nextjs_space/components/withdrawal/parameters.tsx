'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Coins, Scale } from 'lucide-react'
import { WithdrawalState } from '@/lib/types'
import { getAppCurrency, formatCurrency } from '@/lib/utils'

interface WithdrawalParametersProps {
  state: WithdrawalState
  setState: (state: WithdrawalState) => void
}

export function WithdrawalParameters({ state, setState }: WithdrawalParametersProps) {
  const currencySymbol = getAppCurrency().symbol
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
            <Label htmlFor="annual-return-w">Annual Return (%)</Label>
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
               {state.taxEnabled ? `Target Withdrawal (Net/After-Tax) (${currencySymbol})` : `Withdrawal Amount (${currencySymbol})`}
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
              max={1_000_000_000_000_000_000}
              maxErrorMessage="Speedrunning bankruptcy? :)"
            />
            {state.taxEnabled && (
              <p className="text-[11px] text-muted-foreground pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                You should withdraw{' '}
                <span className="font-semibold text-primary">
                  {formatCurrencyFullUnder100m(
                    (state.periodicWithdrawal ?? 0) /
                    (1 - Math.min(state.taxRate ?? 0, 99) / 100)
                  )}
                </span>{' '}
                per {state.frequency?.replace('ly', '') || 'month'} to have an effective net
                withdrawal of{' '}
                {formatCurrencyFullUnder100m(state.periodicWithdrawal ?? 0)}
                .
              </p>
            )}
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
              </Label>
              <Switch
                id="tax-enabled-w"
                checked={state.taxEnabled ?? false}
                onCheckedChange={(checked) => {
                  const currentRate = state.taxRate ?? 0
                  const newRate = checked && currentRate === 0 ? 20 : currentRate
                  setState({ ...state, taxEnabled: checked, taxRate: newRate })
                }}
              />
            </div>

            {state.taxEnabled && (
               <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                 <div className="space-y-1">
                   <Label htmlFor="tax-rate-w" className="text-xs">Income Tax Rate on Withdrawals (%)</Label>
                   <NumericInput
                     id="tax-rate-w"
                     value={state.taxRate ?? 0}
                     onChange={(value) => setState({ ...state, taxRate: Math.max(0, Math.min(99, value)) })}
                     min={0}
                     max={99}
                   />
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
              <SelectTrigger id="frequency-w">
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
        </div>
      </CardContent>
    </Card>
  )
}