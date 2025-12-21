'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DollarSign, Scale } from 'lucide-react'
import { GrowthState } from '@/lib/types'

interface GrowthParametersProps {
  state: GrowthState
  setState: (state: GrowthState) => void
}

export function GrowthParameters({ state, setState }: GrowthParametersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Growth Parameters
        </CardTitle>
        <CardDescription>Configure your investment scenario</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Starting Balance */}
          <div className="space-y-2">
            <Label htmlFor="starting-balance">Starting Balance ($)</Label>
            <NumericInput
              id="starting-balance"
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
              maxErrorMessage="Not even Thanos snapped up numbers this big :)"
            />
          </div>

          {/* Annual Return */}
          <div className="space-y-2">
            <Label htmlFor="annual-return">Annual Return (%)</Label>
            <NumericInput
              id="annual-return"
              step={0.0001}
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
              maxErrorMessage="Bruce Wayne called. He said relax :)"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (Years)</Label>
            <NumericInput
              id="duration"
              value={state.duration ?? 0}
              onChange={(value) => setState({ ...state, duration: Math.max(1, Math.floor(value)) })}
              min={1}
              max={200}
              maxErrorMessage="Immortality isn't implemented yet :)"
            />
          </div>

          {/* Contribution Amount */}
          <div className="space-y-2">
            <Label htmlFor="periodic-addition">Contribution Amount ($)</Label>
            <NumericInput
              id="periodic-addition"
              value={state.periodicAddition ?? 0}
              onChange={(value) => {
                let n = Number(value)
                if (!isFinite(n)) n = 0

                if (n < 0) n = 0
                if (n !== 0 && n < 0.01) n = 0.01

                const limited = Number(n.toFixed(2))
                setState({ ...state, periodicAddition: limited })
              }}
              min={0}
              max={1_000_000_000_000_000_000}
              maxErrorMessage="Tony Stark couldn't afford that one :)"
            />
          </div>

          {/* Contribution Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Contribution Frequency</Label>
            <Select
              value={state.frequency ?? 'monthly'}
              onValueChange={(value: any) => setState({ ...state, frequency: value })}
            >
              <SelectTrigger id="frequency">
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

          {/* Inflation Adjustment */}
          <div className="space-y-2">
            <Label htmlFor="inflation">Annual Inflation Adjustment (%)</Label>

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

                  const MIN_ABS = 0.01
                  if (n !== 0 && Math.abs(n) < MIN_ABS) {
                    n = MIN_ABS * Math.sign(n)
                  }

                  const limited = Number(n.toFixed(2))
                  setState({ ...state, inflationAdjustment: limited })
                }}
                min={-50}
                max={100}
                maxErrorMessage="Hyperinflation much? :)"
              />

              <div className="flex items-center space-x-2">
                <Switch
                  id="adjust-contrib"
                  checked={!(state.excludeInflationAdjustment ?? false)}
                  onCheckedChange={(checked) =>
                    setState({ ...state, excludeInflationAdjustment: !checked })
                  }
                />
                <Label
                  htmlFor="adjust-contrib"
                  className="text-xs font-normal text-muted-foreground cursor-pointer"
                >
                  Increase contributions annually by this rate?
                </Label>
              </div>
            </div>
          </div>
          
          {/* Tax Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tax-enabled" className="flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Enable Taxes
              </Label>
              <Switch
                id="tax-enabled"
                checked={state.taxEnabled ?? false}
                onCheckedChange={(checked) => {
                  // Smart Default: Set 15% for Cap Gains, 25% for Income if currently 0
                  const currentRate = state.taxRate ?? 0
                  const newRate = checked && currentRate === 0 
                    ? (state.taxType === 'income' ? 25 : 15) 
                    : currentRate
                    
                  setState({ ...state, taxEnabled: checked, taxRate: newRate })
                }}
              />
            </div>
            
            {state.taxEnabled && (
               <div className="pt-2 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                 <div className="space-y-1">
                   <Label htmlFor="tax-rate" className="text-xs">Tax Rate (%)</Label>
                   <NumericInput
                     id="tax-rate"
                     value={state.taxRate ?? 0}
                     onChange={(value) => setState({ ...state, taxRate: Math.max(0, Math.min(100, value)) })}
                     min={0}
                     max={100}
                   />
                 </div>
                 <div className="space-y-1">
                   <Label htmlFor="tax-type" className="text-xs">Tax Type</Label>
                   <Select
                      value={state.taxType ?? 'capital_gains'}
                      onValueChange={(value: any) => setState({ ...state, taxType: value })}
                    >
                      <SelectTrigger id="tax-type" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="capital_gains">Deferred (Cap Gains)</SelectItem>
                        <SelectItem value="income">Annual (Income)</SelectItem>
                      </SelectContent>
                    </Select>
                 </div>
               </div>
            )}
            {state.taxEnabled && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {state.taxType === 'income' 
                    ? 'Reduces annual return by tax rate.' 
                    : 'Deducts tax from total profit at end.'}
                </p>
            )}
          </div>

          {/* Target Value */}
          <div className="space-y-2">
            <Label htmlFor="target-value">Target Value (Optional)</Label>
            <NumericInput
              id="target-value"
              placeholder="e.g., 1000000"
              value={state.targetValue ?? ''}
              onChange={(value) => {
                if (!value && value !== 0) {
                  setState({ ...state, targetValue: undefined })
                  return
                }

                let n = Number(value)
                if (!isFinite(n)) return

                if (n < 0) n = 0
                if (n !== 0 && n < 0.01) n = 0.01

                const limited = Number(n.toFixed(2))
                setState({ ...state, targetValue: limited })
              }}
              min={0}
              max={1_000_000_000_000_000_000}
              maxErrorMessage="Trying to buy the moon? :)"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}