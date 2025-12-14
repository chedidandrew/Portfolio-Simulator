export interface GrowthState {
  startingBalance: number
  annualReturn: number
  duration: number
  periodicAddition: number
  frequency: 'yearly' | 'quarterly' | 'monthly' | 'weekly'
  targetValue?: number
  inflationAdjustment: number
}

export interface WithdrawalState {
  startingBalance: number
  annualReturn: number
  duration: number
  periodicWithdrawal: number
  inflationAdjustment: number
  frequency: 'yearly' | 'quarterly' | 'monthly' | 'weekly'
}

export interface SimulationParams {
  initialValue: number
  expectedReturn: number
  volatility: number
  duration: number
  cashflowAmount: number
  cashflowFrequency: 'yearly' | 'monthly'
  inflationAdjustment?: number
  numPaths: number
  portfolioGoal?: number
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