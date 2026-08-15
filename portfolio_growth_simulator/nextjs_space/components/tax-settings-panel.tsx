'use client'

import { useRef, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/ui/numeric-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TaxType } from '@/lib/types'

interface TaxSettingsPanelProps {
  testId: string
  taxRateId: string
  taxTypeId: string
  costBasisId: string
  taxRate: number
  taxType: TaxType
  currentCostBasis: number
  currencySymbol: string
  basisHelp: string
  description: ReactNode
  taxRateErrorMessage?: string
  onTaxRateChange: (value: number) => void
  onTaxTypeChange: (value: TaxType) => void
  onCostBasisChange: (value: number) => void
}

export function TaxSettingsPanel({
  testId,
  taxRateId,
  taxTypeId,
  costBasisId,
  taxRate,
  taxType,
  currentCostBasis,
  currencySymbol,
  basisHelp,
  description,
  taxRateErrorMessage,
  onTaxRateChange,
  onTaxTypeChange,
  onCostBasisChange,
}: TaxSettingsPanelProps) {
  const costBasisWasEdited = useRef(false)

  return (
    <div
      data-testid={testId}
      className="sm:col-span-2 rounded-md border border-border/60 bg-muted/20 p-3 sm:p-4 animate-in fade-in duration-150 print:border-0 print:bg-transparent print:p-0"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={taxRateId} className="text-xs">Tax Rate (%)</Label>
          <NumericInput
            id={taxRateId}
            value={taxRate}
            onChange={onTaxRateChange}
            min={0}
            max={99}
            maxErrorMessage={taxRateErrorMessage}
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor={taxTypeId} className="text-xs">Tax Type</Label>
          <Select value={taxType} onValueChange={(value: TaxType) => onTaxTypeChange(value)}>
            <SelectTrigger id={taxTypeId} className="h-10 min-w-0 print:hidden [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="capital_gains">Taxable Account (capital gains on liquidation)</SelectItem>
              <SelectItem value="tax_deferred">Fully pre-tax retirement account, taxed on withdrawal</SelectItem>
              <SelectItem value="income">Annual income tax drag</SelectItem>
            </SelectContent>
          </Select>
          <p className="hidden print:block text-xs text-muted-foreground pt-1">
            Selected: {taxType === 'income'
              ? 'Annual income tax drag'
              : taxType === 'tax_deferred'
                ? 'Fully pre-tax retirement account, taxed on withdrawal'
                : 'Taxable Account (capital gains on liquidation)'}
          </p>
        </div>
      </div>

      {taxType === 'capital_gains' && (
        <div className="mt-3 space-y-1.5 animate-in fade-in duration-150">
          <Label htmlFor={costBasisId} className="text-xs">Current Cost Basis ({currencySymbol})</Label>
          <NumericInput
            id={costBasisId}
            value={currentCostBasis}
            onInput={() => {
              costBasisWasEdited.current = true
            }}
            onChange={(value) => {
              if (!costBasisWasEdited.current) return
              costBasisWasEdited.current = false
              const amount = Number(value)
              onCostBasisChange(Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0)
            }}
            min={0}
            max={1_000_000_000_000_000_000}
          />
          <p className="text-[10px] leading-relaxed text-muted-foreground">{basisHelp}</p>
        </div>
      )}

      <div className="mt-3 min-h-8 text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </div>
    </div>
  )
}
