'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign } from 'lucide-react'
import { WithdrawalState } from '@/lib/types'

interface WithdrawalParametersProps {
  state: WithdrawalState
  setState: (state: WithdrawalState) => void
}

export function WithdrawalParameters({ state, setState }: WithdrawalParametersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-500" />
          Withdrawal Parameters
        </CardTitle>
        <CardDescription>Configure your retirement spending plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="starting-balance-w">Starting Balance ($)</Label>
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
          <div className="space-y-2">
            <Label htmlFor="periodic-withdrawal">Withdrawal Amount ($)</Label>
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
          </div>
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
          </div>
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