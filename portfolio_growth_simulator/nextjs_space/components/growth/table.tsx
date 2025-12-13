'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

interface GrowthTableProps {
  data: Array<{
    year: number
    startingValue: number
    contributions: number
    endingValue: number
  }>
}

export function GrowthTable({ data }: GrowthTableProps) {
  if (!data || data.length === 0) return null

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
                  <td className="p-3 text-sm text-right font-semibold text-primary">
                    ${row.endingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}