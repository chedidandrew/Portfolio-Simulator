'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

interface WithdrawalTableProps {
  data: Array<{
    year: number
    startingBalance: number
    withdrawals: number
    netIncome: number
    endingBalance: number
    isSustainable: boolean
  }>
}

export function WithdrawalTable({ data }: WithdrawalTableProps) {
  if (!data || data.length === 0) return null

  // Check if we need to show Net Income (if it differs from Gross Withdrawal)
  const hasTax = data.some(row => row.withdrawals !== row.netIncome)

  const totals = data.reduce(
    (acc, row) => {
      acc.withdrawals += row.withdrawals
      acc.netIncome += row.netIncome
      acc.taxPaid += (row.withdrawals - row.netIncome)
      acc.growth += (row.endingBalance - row.startingBalance + row.withdrawals)
      return acc
    },
    { withdrawals: 0, netIncome: 0, taxPaid: 0, growth: 0 }
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          Balance By Year
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted">
                <tr className="border-b">
                  <th className="p-3 text-left text-sm font-semibold">Year</th>
                  <th className="p-3 text-right text-sm font-semibold">Starting Balance</th>
                  <th className="p-3 text-right text-sm font-semibold">Withdrawals</th>
                  {hasTax && (
                    <th className="p-3 text-right text-sm font-semibold text-emerald-600">Net Income</th>
                  )}
                  <th className="p-3 text-right text-sm font-semibold">Growth Earned</th>
                  {hasTax && (
                    <th className="p-3 text-right text-sm font-semibold">Tax Paid</th>
                  )}
                  <th className="p-3 text-right text-sm font-semibold">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <motion.tr
                    key={row.year}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0 }}
                    className={`border-b hover:bg-muted/50 transition-colors ${
                      !row.isSustainable ? 'bg-destructive/5' : ''
                    }`}
                  >
                    <td className="p-3 text-sm font-medium">
                      {row.year}
                      {!row.isSustainable && (
                        <XCircle className="inline-block ml-2 h-4 w-4 text-destructive" />
                      )}
                    </td>
                    <td className="p-3 text-sm text-right">
                      {formatCurrency(row.startingBalance, true, 2, false)}
                    </td>
                    <td className="p-3 text-sm text-right text-muted-foreground">
                      {formatCurrency(row.withdrawals, true, 2, false)}
                    </td>
                    {hasTax && (
                      <td className="p-3 text-sm text-right font-medium text-emerald-600">
                        {formatCurrency(row.netIncome, true, 2, false)}
                      </td>
                    )}
                    <td className="p-3 text-sm text-right">
                      {formatCurrency(row.endingBalance - row.startingBalance + row.withdrawals, true, 2, false)}
                    </td>
                    {hasTax && (
                      <td className="p-3 text-sm text-right text-muted-foreground">
                         {formatCurrency(row.withdrawals - row.netIncome, true, 2, false)}
                      </td>
                    )}
                    <td className={`p-3 text-sm text-right font-semibold ${
                      row.isSustainable ? 'text-primary' : 'text-destructive'
                    }`}>
                      {formatCurrency(row.endingBalance, true, 2, false)}
                    </td>
                  </motion.tr>
                ))}

                <tr className="border-t bg-muted/40">
                  <td className="p-3 text-sm font-semibold">Total</td>
                  <td className="p-3" />
                  <td className="p-3 text-sm text-right font-semibold">
                    {formatCurrency(totals.withdrawals, true, 2, false)}
                  </td>
                  {hasTax && (
                    <td className="p-3 text-sm text-right font-semibold text-emerald-600">
                      {formatCurrency(totals.netIncome, true, 2, false)}
                    </td>
                  )}
                  <td className="p-3 text-sm text-right font-semibold">
                    {formatCurrency(totals.growth, true, 2, false)}
                  </td>
                  {hasTax && (
                    <td className="p-3 text-sm text-right font-semibold">
                      {formatCurrency(totals.taxPaid, true, 2, false)}
                    </td>
                  )}
                  <td className="p-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}