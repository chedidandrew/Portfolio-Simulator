'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { GrowthProjectionYear } from '@/lib/simulation/growth-engine'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'

interface GrowthTableProps {
  data: GrowthProjectionYear[]
  taxEnabled?: boolean
  taxType?: 'capital_gains' | 'income' | 'tax_deferred'
}

export function GrowthTable({ data, taxEnabled, taxType }: GrowthTableProps) {
  if (!data?.length) return null

  const showTaxDrag = !!taxEnabled && taxType === 'income'
  const showDeferredValues = !!taxEnabled && (taxType === 'capital_gains' || taxType === 'tax_deferred')
  const totals = data.reduce(
    (acc, row) => ({
      contributions: acc.contributions + row.contributions,
      interest: acc.interest + row.interest,
      taxPaid: acc.taxPaid + row.taxPaid,
      changeInEmbeddedTax: acc.changeInEmbeddedTax + row.changeInEmbeddedTax,
    }),
    { contributions: 0, interest: 0, taxPaid: 0, changeInEmbeddedTax: 0 },
  )

  const money = (value: number) => formatCurrency(value, true, 2, false)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Value By Year
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-muted">
              <tr className="border-b">
                <th className="p-3 text-left text-sm font-semibold">Year</th>
                {showDeferredValues ? (
                  <>
                    <th className="p-3 text-right text-sm font-semibold">Starting Value, Gross</th>
                    <th className="p-3 text-right text-sm font-semibold">Starting Value, Spendable</th>
                  </>
                ) : (
                  <th className="p-3 text-right text-sm font-semibold">Starting {showTaxDrag ? 'Spendable ' : ''}Value</th>
                )}
                <th className="p-3 text-right text-sm font-semibold">Contributions</th>
                <th className="p-3 text-right text-sm font-semibold">Gross Market Growth</th>
                {showTaxDrag && <th className="p-3 text-right text-sm font-semibold">Tax Drag</th>}
                {showDeferredValues && <th className="p-3 text-right text-sm font-semibold">Change in Embedded Tax</th>}
                {showDeferredValues ? (
                  <>
                    <th className="p-3 text-right text-sm font-semibold">Ending Value, Gross</th>
                    <th className="p-3 text-right text-sm font-semibold">Ending Value, Spendable</th>
                  </>
                ) : (
                  <th className="p-3 text-right text-sm font-semibold">Ending {showTaxDrag ? 'Spendable ' : ''}Value</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <motion.tr
                  key={row.year}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 1) }}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3 text-sm font-medium">{row.year}</td>
                  {showDeferredValues && <td className="p-3 text-sm text-right">{money(row.grossStartingValue)}</td>}
                  <td className="p-3 text-sm text-right">{money(row.startingValue)}</td>
                  <td className="p-3 text-sm text-right text-muted-foreground">{money(row.contributions)}</td>
                  <td className="p-3 text-sm text-right">{money(row.interest)}</td>
                  {showTaxDrag && <td className="p-3 text-sm text-right text-muted-foreground">{money(row.taxPaid)}</td>}
                  {showDeferredValues && <td className="p-3 text-sm text-right text-muted-foreground">{money(row.changeInEmbeddedTax)}</td>}
                  {showDeferredValues && <td className="p-3 text-sm text-right font-semibold">{money(row.grossEndingValue)}</td>}
                  <td className="p-3 text-sm text-right font-semibold text-primary">{money(row.endingValue)}</td>
                </motion.tr>
              ))}
              <tr className="border-t bg-muted/40">
                <td className="p-3 text-sm font-semibold">Total</td>
                <td className="p-3" />
                {showDeferredValues && <td className="p-3" />}
                <td className="p-3 text-sm text-right font-semibold">{money(totals.contributions)}</td>
                <td className="p-3 text-sm text-right font-semibold">{money(totals.interest)}</td>
                {showTaxDrag && <td className="p-3 text-sm text-right font-semibold">{money(totals.taxPaid)}</td>}
                {showDeferredValues && <td className="p-3 text-sm text-right font-semibold">{money(totals.changeInEmbeddedTax)}</td>}
                {showDeferredValues && <td className="p-3" />}
                <td className="p-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
