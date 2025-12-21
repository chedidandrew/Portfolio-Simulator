'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

interface GrowthTableProps {
  data: Array<{
    year: number
    startingValue: number
    contributions: number
    interest: number
    endingValue: number
  }>
  taxEnabled?: boolean
  taxType?: 'capital_gains' | 'income'
  taxRate?: number
}

export function GrowthTable({ data, taxEnabled, taxType, taxRate }: GrowthTableProps) {
  if (!data || data.length === 0) return null

  const showTaxColumn = !!taxEnabled && taxType === 'income'

  let t = (taxRate || 0) / 100
  if (t >= 0.99) t = 0.99
  const taxMultiplier = showTaxColumn ? (t / (1 - t)) : 0

  const totals = data.reduce(
    (acc, row) => {
      acc.contributions += row.contributions
      acc.interest += row.interest
      if (showTaxColumn) acc.taxPaid += row.interest * taxMultiplier
      return acc
    },
    { contributions: 0, interest: 0, taxPaid: 0 }
  )

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
                <th className="p-3 text-right text-sm font-semibold">Starting Value</th>
                <th className="p-3 text-right text-sm font-semibold">Contributions</th>
                <th className="p-3 text-right text-sm font-semibold">Interest Earned</th>
                {showTaxColumn && (
                  <th className="p-3 text-right text-sm font-semibold">Tax Paid</th>
                )}
                <th className="p-3 text-right text-sm font-semibold">Ending Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <motion.tr
                  key={row.year}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 1.0) }} 
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3 text-sm font-medium">{row.year}</td>
                  <td className="p-3 text-sm text-right">
                    ${row.startingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="p-3 text-sm text-right text-muted-foreground">
                    ${row.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="p-3 text-sm text-right">
                    ${row.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  {showTaxColumn && (
                    <td className="p-3 text-sm text-right text-muted-foreground">
                      ${(row.interest * taxMultiplier).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  )}
                  <td className="p-3 text-sm text-right font-semibold text-primary">
                    ${row.endingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </motion.tr>
              ))}

              <tr className="border-t bg-muted/40">
                <td className="p-3 text-sm font-semibold">Total</td>
                <td className="p-3" />
                <td className="p-3 text-sm text-right font-semibold">
                  ${totals.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="p-3 text-sm text-right font-semibold">
                  ${totals.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                {showTaxColumn && (
                  <td className="p-3 text-sm text-right font-semibold">
                    ${totals.taxPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                )}
                <td className="p-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
