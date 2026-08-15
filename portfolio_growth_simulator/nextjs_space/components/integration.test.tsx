import test, { after, afterEach, describe } from 'node:test'
import assert from 'node:assert/strict'
import { dom } from './test-dom-setup'
import React, { useMemo, useState } from 'react'
import axe from 'axe-core'
import { act, render, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { normalizeWithdrawalState } from '@/lib/state-normalization'
import type { GrowthState, SimulationParams, WithdrawalState } from '@/lib/types'
import { GrowthParameters } from '@/components/growth/parameters'
import { WithdrawalParameters } from '@/components/withdrawal/parameters'
import { MonteCarloParameters } from '@/components/monte-carlo/parameters'
import { WithdrawalTable } from '@/components/withdrawal/table'
import { calculateWithdrawalProjection } from '@/lib/simulation/withdrawal-engine'
import { SensitivityTable } from '@/components/monte-carlo/sensitivity-table'
import type { RunMonteCarlo } from '@/lib/simulation/monte-carlo-client'
import { CashflowChart, buildWithdrawalCashflowChartData } from '@/components/monte-carlo/cashflow-chart'
import type { InvestmentDataPoint } from '@/lib/simulation/monte-carlo-engine'
import MethodologyPage from '@/app/methodology/page'
import { DonationSection } from '@/components/donation-section'
import { Switch } from '@/components/ui/switch'
import { MONTE_CARLO_SWITCH_LABELS } from '@/lib/accessibility-labels'
import { GoalTerminalOutcomeSummary, MonteCarloInvestmentInsight, MonteCarloSuccessInsight } from '@/components/monte-carlo/mode-insights'
import { validateWithdrawalStateRange } from '@/lib/simulation/deterministic-validation'
import { WithdrawalResults } from '@/components/withdrawal/results'
import { GuideTab } from '@/components/guide-tab'
import { GrowthTable } from '@/components/growth/table'
import { GrowthResults } from '@/components/growth/results'
import { buildGrowthChartData } from '@/components/growth-chart'
import { calculateGrowthProjection } from '@/lib/simulation/growth-engine'
import { GrowthMode } from '@/components/growth-mode'

afterEach(() => {
  cleanup()
  dom.window.localStorage.clear()
  dom.window.document.body.innerHTML = ''
})

after(() => dom.window.close())

const withdrawalExample: WithdrawalState = {
  startingBalance: 100_000,
  startingCostBasis: 40_000,
  costBasisIsUserEdited: true,
  annualReturn: 0,
  duration: 1,
  periodicWithdrawal: 10_000,
  inflationAdjustment: 0,
  frequency: 'yearly',
  taxEnabled: true,
  taxType: 'capital_gains',
  taxRate: 15,
}

function FreshWithdrawalHarness() {
  const initialState = useMemo<WithdrawalState>(() => ({
    ...withdrawalExample,
    startingCostBasis: undefined,
    costBasisIsUserEdited: false,
  }), [])
  const [state, setState] = useLocalStorage('withdrawal-mode-state', initialState, {
    normalize: normalizeWithdrawalState,
  })
  const result = calculateWithdrawalProjection(state)
  return <>
    <output data-testid="effective-tax-type">{state.taxType}</output>
    <output data-testid="engine-basis">{state.startingCostBasis}</output>
    <output data-testid="withdrawal-tax">{result.totalTaxWithheld}</output>
    <output data-testid="after-tax-spending">{result.totalWithdrawnNet}</output>
    <button type="button" onClick={() => setState({ ...state, startingCostBasis: 40_000, costBasisIsUserEdited: true })}>Use regression basis</button>
    <WithdrawalParameters state={state} setState={setState} />
  </>
}

function OverflowPersistenceHarness() {
  const [state, setState] = useLocalStorage('withdrawal-mode-state', withdrawalExample, {
    shouldPersist: (nextState) => validateWithdrawalStateRange(nextState) === null,
  })
  const error = validateWithdrawalStateRange(state)
  return <>
    <output data-testid="overflow-error">{error}</output>
    <button type="button" onClick={() => setState({
      ...state,
      startingBalance: 1e18,
      annualReturn: 100_000,
      duration: 200,
      periodicWithdrawal: 1e18,
    })}>Use unsafe values</button>
  </>
}

function StorageRecoveryHarness({ storageKey = 'growth-mode-state' }: { storageKey?: string }) {
  const [value, setValue] = useLocalStorage(storageKey, { amount: 10 })
  return <>
    <output data-testid="storage-amount">{value.amount}</output>
    <button type="button" onClick={() => setValue({ amount: 20 })}>Update in memory</button>
  </>
}

const commitNumericInput = (input: HTMLElement, value: number) => {
  fireEvent.focus(input)
  fireEvent.input(input, { target: { value: String(value) } })
  fireEvent.blur(input)
}

const growthBasisInitialState: GrowthState = {
  startingBalance: 10_000,
  startingCostBasis: 10_000,
  costBasisIsUserEdited: false,
  annualReturn: 8,
  duration: 30,
  periodicAddition: 500,
  frequency: 'monthly',
  targetValue: 500_000,
  inflationAdjustment: 2.5,
  taxEnabled: true,
  taxRate: 15,
  taxType: 'capital_gains',
}

function GrowthBasisHarness() {
  const [state, setState] = useState(growthBasisInitialState)
  return <>
    <output data-testid="growth-basis-state">{state.startingCostBasis}</output>
    <output data-testid="growth-basis-edited">{String(state.costBasisIsUserEdited)}</output>
    <button type="button" onClick={() => setState(growthBasisInitialState)}>Reset tracking</button>
    <GrowthParameters state={state} setState={setState} />
  </>
}

function WithdrawalBasisHarness() {
  const [state, setState] = useState<WithdrawalState>({
    ...withdrawalExample,
    startingBalance: 10_000,
    startingCostBasis: 10_000,
    costBasisIsUserEdited: false,
  })
  return <>
    <output data-testid="withdrawal-basis-state">{state.startingCostBasis}</output>
    <output data-testid="withdrawal-basis-edited">{String(state.costBasisIsUserEdited)}</output>
    <WithdrawalParameters state={state} setState={setState} />
  </>
}

const basisTestProfiles = {
  custom: { name: 'Custom', expectedReturn: 7, volatility: 10, description: 'Custom profile' },
}

function MonteCarloBasisHarness({ mode }: { mode: 'growth' | 'withdrawal' }) {
  const initialValue = mode === 'growth' ? 10_000 : 1_000_000
  const [params, setParams] = useState<SimulationParams>({
    initialValue,
    startingCostBasis: initialValue,
    costBasisIsUserEdited: false,
    expectedReturn: 7,
    volatility: 10,
    duration: 30,
    cashflowAmount: mode === 'growth' ? 500 : 3_000,
    cashflowFrequency: 'monthly',
    inflationAdjustment: 2.5,
    numPaths: 500,
    taxEnabled: true,
    taxRate: 15,
    taxType: 'capital_gains',
  })
  return <>
    <output data-testid="mc-basis-state">{params.startingCostBasis}</output>
    <output data-testid="mc-basis-edited">{String(params.costBasisIsUserEdited)}</output>
    <MonteCarloParameters
      mode={mode}
      params={params}
      setParams={setParams}
      profile="custom"
      setProfile={() => undefined}
      isSimulating={false}
      onRun={() => undefined}
      presetProfiles={basisTestProfiles}
    />
  </>
}

describe('rendered integration regressions', { concurrency: false }, () => {

test('rendered withdrawal fresh localStorage exposes taxable basis to the engine', async () => {
  const view = render(<FreshWithdrawalHarness />)
  await waitFor(() => assert.equal(view.getByTestId('effective-tax-type').textContent, 'capital_gains'))
  assert.ok(view.getByText(/Selected: Taxable Account/))
  const basisInput = view.getByLabelText(/Current Cost Basis/) as HTMLInputElement
  assert.equal(basisInput.value, '100000')
  assert.equal(view.getByTestId('engine-basis').textContent, basisInput.value)

  fireEvent.click(view.getByRole('button', { name: 'Use regression basis' }))
  await waitFor(() => assert.equal(view.getByTestId('engine-basis').textContent, '40000'))
  assert.equal(basisInput.value, '40000')
  assert.equal(view.getByTestId('withdrawal-tax').textContent, '900')
  assert.equal(view.getByTestId('after-tax-spending').textContent, '9100')
})

test('rendered withdrawal taxable table shows canonical zero growth and separate tax values', () => {
  const result = calculateWithdrawalProjection({ ...withdrawalExample, periodicWithdrawal: 20_000 })
  const view = render(<WithdrawalTable data={result.yearData} />)
  const firstRow = view.container.querySelector('tbody tr')
  assert.ok(firstRow)
  assert.deepEqual(within(firstRow as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent?.trim()), [
    '1', '$91,000.00', '$20,000.00', '$18,200.00', '9.0%', '$1,800.00', '$0.00', '$72,800.00',
  ])
  const totalRow = view.getByText('Total').closest('tr')
  assert.ok(totalRow)
  assert.match(totalRow.textContent ?? '', /\$0\.00/)
})

test('rendered growth income-tax table uses canonical tax drag and reconciles with the engine', () => {
  const result = calculateGrowthProjection({
    startingBalance: 10_000,
    annualReturn: 8,
    duration: 1,
    periodicAddition: 0,
    frequency: 'yearly',
    inflationAdjustment: 0,
    taxEnabled: true,
    taxType: 'income',
    taxRate: 25,
  })
  const view = render(<GrowthTable data={result.yearData} taxEnabled taxType="income" />)
  assert.ok(view.getByRole('columnheader', { name: 'Tax Drag' }))
  const firstRow = view.container.querySelector('tbody tr')
  assert.ok(firstRow)
  assert.deepEqual(within(firstRow as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent?.trim()), [
    '1', '$10,000.00', '$0.00', '$800.00', '$200.00', '$10,600.00',
  ])
  assert.match(view.getByText('Total').closest('tr')?.textContent ?? '', /\$200\.00/)
})

test('validated shared payload prop restores deterministic growth without an event timing race', async () => {
  const view = render(<GrowthMode sharedPayload={{
    sharePayloadVersion: 1,
    mode: 'growth',
    type: 'deterministic',
    deterministicParams: {
      startingBalance: 12_345,
      annualReturn: 6,
      duration: 2,
      periodicAddition: 0,
      frequency: 'yearly',
      inflationAdjustment: 0,
    },
    displayCurrency: 'EUR',
  }} />)
  await waitFor(() => assert.equal((view.getByLabelText('Starting Balance ($)') as HTMLInputElement).value, '12345'))
  assert.equal((view.getByLabelText('Duration (Years)') as HTMLInputElement).value, '2')
})

test('growth chart and result card agree on market-value total invested under embedded tax', () => {
  const result = calculateGrowthProjection({
    startingBalance: 100_000,
    startingCostBasis: 40_000,
    annualReturn: 0,
    duration: 1,
    periodicAddition: 0,
    frequency: 'yearly',
    inflationAdjustment: 0,
    taxEnabled: true,
    taxType: 'capital_gains',
    taxRate: 15,
  })
  const point = buildGrowthChartData(result.yearData)[0]
  assert.equal(point.totalInvested, 100_000)
  assert.equal(point.grossValue, 100_000)
  assert.equal(point.value, 91_000)

  const view = render(<GrowthResults
    data={result}
    taxEnabled
    taxType="capital_gains"
    showFullPrecision
    setShowFullPrecision={() => undefined}
    onShare={() => undefined}
    onExportPdf={() => undefined}
    onExportExcel={() => undefined}
  />)
  const investedLabel = view.getAllByText('Total Invested').find((element) => element.tagName === 'P')
  assert.ok(investedLabel)
  assert.match(investedLabel.parentElement?.textContent ?? '', /\$100,000\.00/)
})

test('rendered withdrawal overflow remains recoverable without replacing persisted valid state', async () => {
  const view = render(<OverflowPersistenceHarness />)
  await waitFor(() => assert.ok(localStorage.getItem('withdrawal-mode-state')))
  fireEvent.click(view.getByRole('button', { name: 'Use unsafe values' }))
  await waitFor(() => assert.match(view.getByTestId('overflow-error').textContent ?? '', /safe numeric range/i))
  const persisted = JSON.parse(localStorage.getItem('withdrawal-mode-state') ?? '{}') as WithdrawalState
  assert.equal(persisted.annualReturn, withdrawalExample.annualReturn)
  assert.equal(persisted.startingBalance, withdrawalExample.startingBalance)
})

test('localStorage recovery removes only corrupt owned data and handles malformed cross-tab updates', async () => {
  localStorage.setItem('unrelated-key', 'keep-me')
  localStorage.setItem('growth-mode-state', '{broken json')
  const view = render(<StorageRecoveryHarness />)
  await waitFor(() => assert.equal(view.getByTestId('storage-amount').textContent, '10'))
  assert.equal(localStorage.getItem('growth-mode-state'), null)
  assert.equal(localStorage.getItem('unrelated-key'), 'keep-me')

  localStorage.setItem('growth-mode-state', '{broken again')
  await act(async () => {
    window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'growth-mode-state' }))
  })
  await waitFor(() => assert.equal(localStorage.getItem('growth-mode-state'), null))
  assert.equal(localStorage.getItem('unrelated-key'), 'keep-me')
})

test('localStorage recovery keeps state usable when quota or storage access fails', async () => {
  const storagePrototype = Object.getPrototypeOf(localStorage) as Storage
  const setDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'setItem')
  const getDescriptor = Object.getOwnPropertyDescriptor(storagePrototype, 'getItem')
  assert.ok(setDescriptor && getDescriptor)

  Object.defineProperty(storagePrototype, 'setItem', {
    configurable: true,
    value: () => { throw new dom.window.DOMException('Quota exceeded', 'QuotaExceededError') },
  })
  try {
    const quotaView = render(<StorageRecoveryHarness storageKey="quota-key" />)
    fireEvent.click(quotaView.getByRole('button', { name: 'Update in memory' }))
    await waitFor(() => assert.equal(quotaView.getByTestId('storage-amount').textContent, '20'))
  } finally {
    Object.defineProperty(storagePrototype, 'setItem', setDescriptor)
    cleanup()
  }

  Object.defineProperty(storagePrototype, 'getItem', {
    configurable: true,
    value: () => { throw new dom.window.DOMException('Access denied', 'SecurityError') },
  })
  try {
    const deniedView = render(<StorageRecoveryHarness storageKey="denied-key" />)
    await waitFor(() => assert.equal(deniedView.getByTestId('storage-amount').textContent, '10'))
  } finally {
    Object.defineProperty(storagePrototype, 'getItem', getDescriptor)
  }
})

test('rendered cost basis tracking follows until manual edits across every calculator mode and resets to automatic', async () => {
  const growth = render(<GrowthBasisHarness />)
  commitNumericInput(growth.getByLabelText('Starting Balance ($)'), 100_000)
  await waitFor(() => assert.equal(growth.getByTestId('growth-basis-state').textContent, '100000'))
  assert.equal((growth.getByLabelText('Current Cost Basis ($)') as HTMLInputElement).value, '100000')

  commitNumericInput(growth.getByLabelText('Current Cost Basis ($)'), 4_000)
  await waitFor(() => assert.equal(growth.getByTestId('growth-basis-edited').textContent, 'true'))
  commitNumericInput(growth.getByLabelText('Starting Balance ($)'), 200_000)
  await waitFor(() => assert.equal(growth.getByTestId('growth-basis-state').textContent, '4000'))

  fireEvent.click(growth.getByRole('button', { name: 'Reset tracking' }))
  await waitFor(() => assert.equal(growth.getByTestId('growth-basis-edited').textContent, 'false'))
  commitNumericInput(growth.getByLabelText('Starting Balance ($)'), 300_000)
  await waitFor(() => assert.equal(growth.getByTestId('growth-basis-state').textContent, '300000'))
  cleanup()

  const withdrawal = render(<WithdrawalBasisHarness />)
  commitNumericInput(withdrawal.getByLabelText('Starting Balance ($)'), 100_000)
  await waitFor(() => assert.equal(withdrawal.getByTestId('withdrawal-basis-state').textContent, '100000'))
  commitNumericInput(withdrawal.getByLabelText('Current Cost Basis ($)'), 4_000)
  await waitFor(() => assert.equal(withdrawal.getByTestId('withdrawal-basis-edited').textContent, 'true'))
  commitNumericInput(withdrawal.getByLabelText('Starting Balance ($)'), 200_000)
  await waitFor(() => assert.equal(withdrawal.getByTestId('withdrawal-basis-state').textContent, '4000'))
  cleanup()

  const monteCarloGrowth = render(<MonteCarloBasisHarness mode="growth" />)
  commitNumericInput(monteCarloGrowth.getByLabelText('Initial Portfolio Value ($)'), 100_000)
  await waitFor(() => assert.equal(monteCarloGrowth.getByTestId('mc-basis-state').textContent, '100000'))
  commitNumericInput(monteCarloGrowth.getByLabelText('Current Cost Basis ($)'), 4_000)
  await waitFor(() => assert.equal(monteCarloGrowth.getByTestId('mc-basis-edited').textContent, 'true'))
  commitNumericInput(monteCarloGrowth.getByLabelText('Initial Portfolio Value ($)'), 200_000)
  await waitFor(() => assert.equal(monteCarloGrowth.getByTestId('mc-basis-state').textContent, '4000'))
  cleanup()

  const monteCarloWithdrawal = render(<MonteCarloBasisHarness mode="withdrawal" />)
  commitNumericInput(monteCarloWithdrawal.getByLabelText('Initial Portfolio Value ($)'), 100_000)
  await waitFor(() => assert.equal(monteCarloWithdrawal.getByTestId('mc-basis-state').textContent, '100000'))
  commitNumericInput(monteCarloWithdrawal.getByLabelText('Current Cost Basis ($)'), 40_000)
  await waitFor(() => assert.equal(monteCarloWithdrawal.getByTestId('mc-basis-edited').textContent, 'true'))
  commitNumericInput(monteCarloWithdrawal.getByLabelText('Initial Portfolio Value ($)'), 200_000)
  await waitFor(() => assert.equal(monteCarloWithdrawal.getByTestId('mc-basis-state').textContent, '40000'))
})

test('rendered underfunded withdrawal UI never describes failure as full horizon', () => {
  const data = calculateWithdrawalProjection({
    startingBalance: 50_000,
    annualReturn: 0,
    duration: 1,
    periodicWithdrawal: 100_000,
    inflationAdjustment: 0,
    frequency: 'yearly',
  })
  const view = render(<WithdrawalResults
    data={data}
    duration={1}
    showFullPrecision={false}
    setShowFullPrecision={() => undefined}
    onShare={() => undefined}
    onExportPdf={() => undefined}
    onExportExcel={() => undefined}
  />)
  assert.ok(view.getByText('Unsustainable Plan'))
  assert.match(view.container.textContent ?? '', /could not fully fund the requested withdrawal/i)
  assert.doesNotMatch(view.container.textContent ?? '', /full horizon/i)
  assert.match(view.getByText('Portfolio Lasts').parentElement?.textContent ?? '', /1 year/)
})

test('rendered weekly depletion uses weeks and disables invalid deterministic log scale', () => {
  const data = calculateWithdrawalProjection({
    startingBalance: 50,
    annualReturn: 0,
    duration: 1,
    periodicWithdrawal: 100,
    inflationAdjustment: 0,
    frequency: 'weekly',
  })
  const view = render(<WithdrawalResults
    data={data}
    duration={1}
    showFullPrecision={false}
    setShowFullPrecision={() => undefined}
    onShare={() => undefined}
    onExportPdf={() => undefined}
    onExportExcel={() => undefined}
  />)
  assert.match(view.container.textContent ?? '', /1 week/)
  assert.doesNotMatch(view.container.textContent ?? '', /0 years/)
  assert.ok(view.getByRole('switch', { name: 'Log scale' }).hasAttribute('disabled'))
  assert.ok(view.getByText('Log scale is unavailable when a displayed value reaches zero.'))
})

test('rendered Guide discloses Vercel Analytics and share-link scenario data', () => {
  const view = render(<GuideTab onLaunchMode={() => undefined} />)
  fireEvent.click(view.getByText('Important Disclaimer'))
  assert.ok(view.getByText('Privacy and analytics'))
  assert.ok(view.getByText(/Vercel Analytics is enabled and may collect site-usage data/))
  assert.ok(view.getByText(/share link, its URL contains the scenario settings/))
})

const idsInDocumentOrder = (container: HTMLElement, ids: readonly string[]) => {
  const expected = new Set(ids)
  return Array.from(container.querySelectorAll<HTMLElement>('[id]'))
    .map((element) => element.id)
    .filter((id) => expected.has(id))
}

test('tax toggle layouts preserve core input order across every calculator and tax type', () => {
  const growthState: GrowthState = {
    startingBalance: 10_000,
    startingCostBasis: 8_000,
    annualReturn: 8,
    duration: 30,
    periodicAddition: 500,
    frequency: 'monthly',
    targetValue: 500_000,
    inflationAdjustment: 2.5,
    taxEnabled: false,
    taxRate: 15,
    taxType: 'capital_gains',
  }
  const growthCoreIds = [
    'starting-balance', 'annual-return', 'duration', 'periodic-addition',
    'frequency', 'inflation', 'adjust-contrib', 'tax-enabled', 'target-value',
  ] as const
  const growth = render(<GrowthParameters state={growthState} setState={() => undefined} />)
  assert.deepEqual(idsInDocumentOrder(growth.container, growthCoreIds), growthCoreIds)
  assert.equal(growth.queryByTestId('growth-tax-details'), null)
  growth.rerender(<GrowthParameters state={{ ...growthState, taxEnabled: true }} setState={() => undefined} />)
  assert.deepEqual(idsInDocumentOrder(growth.container, growthCoreIds), growthCoreIds)
  assert.ok(growth.getByTestId('growth-tax-details').contains(document.getElementById('starting-cost-basis')))
  growth.rerender(<GrowthParameters state={{ ...growthState, taxEnabled: true, taxType: 'tax_deferred' }} setState={() => undefined} />)
  assert.deepEqual(idsInDocumentOrder(growth.container, growthCoreIds), growthCoreIds)
  assert.ok(document.getElementById('tax-rate'))
  assert.ok(document.getElementById('tax-type'))
  assert.equal(document.getElementById('starting-cost-basis'), null)
  cleanup()

  const withdrawalCoreIds = [
    'starting-balance-w', 'annual-return-w', 'duration-w', 'periodic-withdrawal',
    'frequency-w', 'inflation', 'adjust-withdrawals', 'tax-enabled-w',
  ] as const
  const withdrawal = render(<WithdrawalParameters state={{ ...withdrawalExample, taxEnabled: false }} setState={() => undefined} />)
  assert.deepEqual(idsInDocumentOrder(withdrawal.container, withdrawalCoreIds), withdrawalCoreIds)
  withdrawal.rerender(<WithdrawalParameters state={withdrawalExample} setState={() => undefined} />)
  assert.deepEqual(idsInDocumentOrder(withdrawal.container, withdrawalCoreIds), withdrawalCoreIds)
  assert.ok(withdrawal.getByTestId('withdrawal-tax-details').contains(document.getElementById('starting-cost-basis-w')))
  withdrawal.rerender(<WithdrawalParameters state={{ ...withdrawalExample, taxType: 'income' }} setState={() => undefined} />)
  assert.deepEqual(idsInDocumentOrder(withdrawal.container, withdrawalCoreIds), withdrawalCoreIds)
  assert.ok(document.getElementById('tax-rate-w'))
  assert.ok(document.getElementById('tax-type-w'))
  assert.equal(document.getElementById('starting-cost-basis-w'), null)
  cleanup()

  const monteCarloCoreIds = [
    'mc-initial', 'mc-return', 'mc-volatility', 'mc-duration', 'mc-cashflow',
    'mc-frequency', 'mc-inflation', 'mc-paths', 'mc-tax-enabled',
  ] as const
  const presetProfiles = {
    custom: { name: 'Custom', expectedReturn: 7, volatility: 10, description: 'Custom profile' },
  }
  const renderMonteCarlo = (params: SimulationParams) => <MonteCarloParameters
    mode="withdrawal"
    params={params}
    setParams={() => undefined}
    profile="custom"
    setProfile={() => undefined}
    isSimulating={false}
    onRun={() => undefined}
    presetProfiles={presetProfiles}
  />
  const monteCarlo = render(renderMonteCarlo(baseSimulationParams))
  assert.deepEqual(idsInDocumentOrder(monteCarlo.container, monteCarloCoreIds), monteCarloCoreIds)
  monteCarlo.rerender(renderMonteCarlo({ ...baseSimulationParams, taxEnabled: true }))
  assert.deepEqual(idsInDocumentOrder(monteCarlo.container, monteCarloCoreIds), monteCarloCoreIds)
  assert.ok(monteCarlo.getByTestId('monte-carlo-tax-details').contains(document.getElementById('mc-starting-cost-basis')))
  monteCarlo.rerender(renderMonteCarlo({ ...baseSimulationParams, taxEnabled: true, taxType: 'tax_deferred' }))
  assert.deepEqual(idsInDocumentOrder(monteCarlo.container, monteCarloCoreIds), monteCarloCoreIds)
  assert.ok(document.getElementById('mc-tax-rate'))
  assert.ok(document.getElementById('mc-tax-type'))
  assert.equal(document.getElementById('mc-starting-cost-basis'), null)
})

const baseSimulationParams: SimulationParams = {
  initialValue: 100_000,
  startingCostBasis: 60_000,
  expectedReturn: 7,
  volatility: 10,
  duration: 3,
  cashflowAmount: 500,
  cashflowFrequency: 'monthly',
  inflationAdjustment: 2,
  excludeInflationAdjustment: false,
  numPaths: 25,
  taxEnabled: false,
  taxType: 'capital_gains',
  taxRate: 15,
  calculationMode: 'effective',
  enableCrashRisk: false,
}

const deterministicWorkerRunner: RunMonteCarlo = async (params, mode) => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  return {
    median: params.initialValue
      + params.cashflowAmount * (params.volatility + (params.taxRate ?? 0) + (params.enableCrashRisk ? 1 : 0)),
    profitableRate: mode === 'growth' ? 80 : 0,
    solventRate: mode === 'withdrawal' ? 80 : 100,
  } as Awaited<ReturnType<RunMonteCarlo>>
}

test('sensitivity medians render and dependency changes recompute without duplicate equivalent inputs', async () => {
  const calls: string[] = []
  const runner: RunMonteCarlo = async (params, mode, seed) => {
    calls.push(JSON.stringify({ params, mode, seed }))
    return deterministicWorkerRunner(params, mode, seed)
  }
  const reactActGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  const previousActEnvironment = reactActGlobal.IS_REACT_ACT_ENVIRONMENT
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = false
  try {
    const view = render(<SensitivityTable params={baseSimulationParams} mode="growth" rngSeed="repeatable" runSimulation={runner} />)
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.equal(view.queryByText(/Calculating scenarios/), null)
    assert.ok(view.getByText('Monthly'))
    assert.equal(calls.length, 5)

    const firstRows = view.container.textContent
    const changed = {
      ...baseSimulationParams,
      cashflowFrequency: 'yearly' as const,
      volatility: 16,
      taxEnabled: true,
      taxRate: 22,
      enableCrashRisk: true,
    }
    view.rerender(<SensitivityTable params={changed} mode="growth" rngSeed="repeatable" runSimulation={runner} />)
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.equal(calls.length, 10)
    assert.ok(view.getByText('Yearly'))
    assert.notEqual(view.container.textContent, firstRows)

    view.rerender(<SensitivityTable params={{ ...changed }} mode="growth" rngSeed="repeatable" runSimulation={runner} />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(calls.length, 10, 'equivalent simulation inputs should not recompute')
  } finally {
    reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  }
})

const cashflowData: InvestmentDataPoint[] = [
  {
    year: 1,
    initial: 100_000,
    contributions: 0,
    withdrawals: 12_000,
    total: 100_000,
    netSpending: 10_920,
    withdrawalTaxes: 1_080,
    incomeTaxDrag: 0,
    taxesPaid: 1_080,
    realInitial: 100_000,
    realContributions: 0,
    realWithdrawals: 12_000,
    realNetSpending: 10_920,
    realWithdrawalTaxes: 1_080,
    realIncomeTaxDrag: 0,
    realTaxesPaid: 1_080,
    realTotal: 100_000,
  },
  {
    year: 2,
    initial: 100_000,
    contributions: 0,
    withdrawals: 24_000,
    total: 100_000,
    netSpending: 21_840,
    withdrawalTaxes: 2_160,
    incomeTaxDrag: 0,
    taxesPaid: 2_160,
    realInitial: 100_000,
    realContributions: 0,
    realWithdrawals: 23_500,
    realNetSpending: 21_385,
    realWithdrawalTaxes: 2_115,
    realIncomeTaxDrag: 0,
    realTaxesPaid: 2_115,
    realTotal: 100_000,
  },
]

test('retirement cashflow chart renders gross/spendable series and exact engine-provided final values in every tax mode', async () => {
  for (const tax of [
    { taxEnabled: false, taxType: 'capital_gains' as const },
    { taxEnabled: true, taxType: 'capital_gains' as const },
    { taxEnabled: true, taxType: 'tax_deferred' as const },
    { taxEnabled: true, taxType: 'income' as const },
  ]) {
    const params: SimulationParams = { ...baseSimulationParams, ...tax }
    const view = render(<CashflowChart params={params} mode="withdrawal" investmentData={cashflowData} />)
    await waitFor(() => assert.ok(view.container.querySelector('#gross-withdrawals-series')), { timeout: 3_000 })
    assert.ok(view.container.querySelector('#after-tax-spending-series'))
    assert.ok(view.getByText('Gross Withdrawals'))
    assert.ok(view.getByText('After-Tax Spending'))
    const chartData = buildWithdrawalCashflowChartData(cashflowData, false)
    const final = chartData[chartData.length - 1]
    const finalInvestmentPoint = cashflowData[cashflowData.length - 1]
    assert.equal(final?.gross, finalInvestmentPoint?.withdrawals)
    assert.equal(final?.spendable, finalInvestmentPoint?.netSpending)
    cleanup()
  }
})

test('retirement cashflow chart group uses mode-specific retirement and one-year growth copy', () => {
  const retirement = render(<>
    <MonteCarloInvestmentInsight mode="withdrawal" duration={30} formattedTotal="$100,000" />
    <MonteCarloSuccessInsight mode="withdrawal" successRate={87.5} />
  </>)
  assert.ok(retirement.getByText(/Starting Portfolio/))
  assert.match(retirement.container.textContent ?? '', /gross withdrawals, after-tax spending, and taxes separately/)
  assert.match(retirement.container.textContent ?? '', /funding every requested withdrawal/)
  assert.doesNotMatch(retirement.container.textContent ?? '', /Total Invested|you invested/)
  cleanup()

  const growth = render(<MonteCarloInvestmentInsight mode="growth" duration={1} formattedTotal="$10,000" />)
  assert.match(growth.container.textContent ?? '', /Over 1 year,/)
  assert.doesNotMatch(growth.container.textContent ?? '', /1 years/)
})

test('retirement cashflow chart group uses explicit terminal goal-probability wording', () => {
  const view = render(<GoalTerminalOutcomeSummary
    probability={62.5}
    formattedGoal="$1,000,000"
    pathsEndedAtOrAboveGoal={625}
    scenarioCount={1000}
  />)
  assert.ok(view.getByText(/Probability of Ending At or Above Goal/))
  assert.ok(view.getByText(/625 out of 1000 scenarios ended at or above the goal/))
  assert.ok(view.getByText(/terminal-value measure/))
  assert.doesNotMatch(view.container.textContent ?? '', /probability of reaching/i)
})

test('rendered accessibility switches have explicit Growth and Withdrawal names', async () => {
  const growth = render(<Switch aria-label={MONTE_CARLO_SWITCH_LABELS.growth} />)
  assert.ok(growth.getByRole('switch', { name: 'Use Monte Carlo simulation for growth' }))
  cleanup()
  const withdrawal = render(<Switch aria-label={MONTE_CARLO_SWITCH_LABELS.withdrawal} />)
  assert.ok(withdrawal.getByRole('switch', { name: 'Use Monte Carlo simulation for withdrawals' }))
})

test('rendered accessibility Methodology buttons operate with Enter and Space', async () => {
  const user = userEvent.setup({ document: dom.window.document })
  const view = render(<MethodologyPage />)
  const withdrawalButton = view.getByRole('button', { name: /Withdrawal Phase/ })
  withdrawalButton.focus()
  await user.keyboard('{Enter}')
  assert.equal(withdrawalButton.getAttribute('aria-expanded'), 'true')
  await user.keyboard(' ')
  assert.equal(withdrawalButton.getAttribute('aria-expanded'), 'false')
  assert.equal(view.container.querySelectorAll('a button, button a').length, 0)
})

test('rendered accessibility donation dialog traps and restores focus with Escape', async () => {
  const user = userEvent.setup({ document: dom.window.document })
  const view = render(<DonationSection />)
  const trigger = view.getByRole('button', { name: /Buy me a coffee/ })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await within(document.body).findByRole('dialog', { name: 'Fuel the simulator' })
  assert.equal(dialog.getAttribute('aria-modal'), 'true')
  assert.ok(within(dialog).getByRole('button', { name: 'Close dialog' }))
  await user.tab()
  assert.ok(dialog.contains(document.activeElement))
  await user.keyboard('{Escape}')
  await waitFor(() => assert.equal(within(document.body).queryByRole('dialog'), null))
  assert.equal(document.activeElement, trigger)
})

test('rendered accessibility scan has no serious or critical violations', async () => {
  await act(async () => {
    render(<MethodologyPage />)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  const report = await axe.run(document.body, {
    rules: {
      'color-contrast': { enabled: false },
    },
  })
  const blockers = report.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
  assert.deepEqual(blockers.map((violation) => violation.id), [])
})

})
