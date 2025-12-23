export interface GrowthState {
  startingBalance: number
  annualReturn: number
  duration: number
  periodicAddition: number
  frequency: 'yearly' | 'quarterly' | 'monthly' | 'weekly'
  targetValue?: number
  inflationAdjustment: number
  excludeInflationAdjustment?: boolean
  // Tax Options
  taxEnabled?: boolean
  taxRate?: number
  taxType?: 'capital_gains' | 'income' | 'tax_deferred'
  // Advanced Settings
  calculationMode?: 'effective' | 'nominal'
}

export interface WithdrawalState {
  startingBalance: number
  annualReturn: number
  duration: number
  periodicWithdrawal: number
  inflationAdjustment: number
  frequency: 'yearly' | 'quarterly' | 'monthly' | 'weekly'
  excludeInflationAdjustment?: boolean
  // Tax Options
  taxEnabled?: boolean
  taxRate?: number
  taxType?: 'income' | 'capital_gains' | 'tax_deferred'
  // Advanced Settings
  calculationMode?: 'effective' | 'nominal'
}

export interface SimulationParams {
  initialValue: number
  expectedReturn: number
  volatility: number
  duration: number
  cashflowAmount: number
  cashflowFrequency: 'yearly' | 'monthly'
  inflationAdjustment?: number
  excludeInflationAdjustment?: boolean
  numPaths: number
  portfolioGoal?: number
  // Tax Options
  taxEnabled?: boolean
  taxRate?: number
  taxType?: 'capital_gains' | 'income' | 'tax_deferred'
  // Advanced Settings
  calculationMode?: 'effective' | 'nominal'
}

export interface SharePayload {
  mode: 'growth' | 'withdrawal'
  type: 'deterministic' | 'monte-carlo'
  deterministicParams: GrowthState | WithdrawalState
  mcParams?: SimulationParams
  rngSeed?: string | null
  showFullPrecision?: boolean
  logScales?: { chart: boolean; histogram: boolean; drawdown: boolean }
}