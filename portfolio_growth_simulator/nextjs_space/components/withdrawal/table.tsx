'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

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
                      ${row.startingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="p-3 text-sm text-right text-muted-foreground">
                      ${row.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    {hasTax && (
                      <td className="p-3 text-sm text-right font-medium text-emerald-600">
                        ${row.netIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    )}
                    <td className={`p-3 text-sm text-right font-semibold ${
                      row.isSustainable ? 'text-primary' : 'text-destructive'
                    }`}>
                      ${row.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}