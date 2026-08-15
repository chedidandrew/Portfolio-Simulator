export type CashflowFrequency = 'yearly' | 'quarterly' | 'monthly' | 'weekly'
export type TaxType = 'capital_gains' | 'income' | 'tax_deferred'
export type CalculationMode = 'effective' | 'nominal'

export interface GrowthState {
  startingBalance: number
  startingCostBasis?: number
  costBasisIsUserEdited?: boolean
  annualReturn: number
  duration: number
  periodicAddition: number
  frequency: CashflowFrequency
  targetValue?: number
  inflationAdjustment: number
  excludeInflationAdjustment?: boolean
  // Tax Options
  taxEnabled?: boolean
  taxRate?: number
  taxType?: TaxType
  // Advanced Settings
  calculationMode?: CalculationMode
}

export interface WithdrawalState {
  startingBalance: number
  startingCostBasis?: number
  costBasisIsUserEdited?: boolean
  annualReturn: number
  duration: number
  periodicWithdrawal: number
  inflationAdjustment: number
  frequency: CashflowFrequency
  excludeInflationAdjustment?: boolean
  // Tax Options
  taxEnabled?: boolean
  taxRate?: number
  taxType?: TaxType
  // Advanced Settings
  calculationMode?: CalculationMode
}

export interface SimulationParams {
  initialValue: number
  startingCostBasis?: number
  costBasisIsUserEdited?: boolean
  expectedReturn: number
  volatility: number
  enableCrashRisk?: boolean
  duration: number
  cashflowAmount: number
  cashflowFrequency: CashflowFrequency
  inflationAdjustment?: number
  excludeInflationAdjustment?: boolean
  numPaths: number
  portfolioGoal?: number
  // Tax Options
  taxEnabled?: boolean
  taxRate?: number
  taxType?: TaxType
  // Advanced Settings
  calculationMode?: CalculationMode
}

export interface SharePayload {
  sharePayloadVersion?: number
  mode: 'growth' | 'withdrawal'
  type: 'deterministic' | 'monte-carlo'
  deterministicParams: GrowthState | WithdrawalState
  /** Legacy deterministic key retained for older shared links. */
  params?: GrowthState | WithdrawalState
  mcParams?: SimulationParams
  rngSeed?: string | null
  showFullPrecision?: boolean
  logScales?: { chart: boolean; histogram: boolean; drawdown: boolean }
  displayCurrency?: string
}
