'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign } from 'lucide-react'
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
                
                // Currency clamp: 0 is allowed, but if >0, min is 0.01
                if (n !== 0 && Math.abs(n) < 0.01) {
                   n = 0.01
                }
                
                // Standardize to 2 decimals
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

                // Clamp extremely tiny non-zero values to avoid floating point weirdness
                const MIN_ABS = 0.000001
                if (n !== 0 && Math.abs(n) < MIN_ABS) {
                  n = MIN_ABS * Math.sign(n)
                }

                // Limit precision to 6 decimals
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
                
                // Non-negative constraint
                if (n < 0) n = 0
                
                // Currency clamp: min 0.01 if non-zero
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
            <Label htmlFor="inflation">Inflation Adjustment (%)</Label>
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
                
                // Clamp tiny values (inflation is usually 2 decimals)
                const MIN_ABS = 0.01
                if (n !== 0 && Math.abs(n) < MIN_ABS) {
                  n = MIN_ABS * Math.sign(n)
                }
                
                // Limit precision
                const limited = Number(n.toFixed(2))
                setState({ ...state, inflationAdjustment: limited })
              }}
              min={-50}
              max={100}
              maxErrorMessage="Hyperinflation much? :)"
            />
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
                
                // Currency clamp if > 0
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