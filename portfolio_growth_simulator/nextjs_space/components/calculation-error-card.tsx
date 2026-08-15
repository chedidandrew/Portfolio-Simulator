'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CalculationErrorCardProps {
  message: string
  onReset: () => void
}

export function CalculationErrorCard({ message, onReset }: CalculationErrorCardProps) {
  return (
    <Card role="alert" className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Scenario cannot be calculated safely
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button type="button" variant="outline" onClick={onReset} className="min-h-11 gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset This Scenario
        </Button>
      </CardContent>
    </Card>
  )
}
