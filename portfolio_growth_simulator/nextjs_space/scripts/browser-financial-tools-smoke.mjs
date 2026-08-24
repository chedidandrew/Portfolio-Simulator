import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const browser = await chromium.launch()

async function replaceNumber(page, labelText, value) {
  const field = page.locator('label').filter({ hasText: labelText }).locator('input').first()
  await field.fill('')
  assert.equal(await field.inputValue(), '', `${labelText} should allow a transient empty edit state.`)
  await field.fill(value)
  assert.equal(await field.inputValue(), value, `${labelText} should accept replacement text without forcing a leading zero.`)
  await field.press('Tab')
  return field
}

async function fieldValue(page, labelText) {
  return page.locator('label').filter({ hasText: labelText }).locator('input').first().inputValue()
}

async function openFinancialSettings(page) {
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('menuitem', { name: /Theme/ }).waitFor()
  await page.getByRole('menuitem', { name: /Display Currency/ }).waitFor()
  await page.getByRole('menuitem', { name: 'Reset financial tools' }).waitFor()
}

async function selectCurrency(page, code, expectedSymbol) {
  await openFinancialSettings(page)
  const currencyTrigger = page.getByRole('menuitem', { name: /Display Currency/ })
  await currencyTrigger.hover()
  await page.getByRole('menuitem', { name: new RegExp(`^${code} \\(`) }).click()
  await page.waitForFunction(
    (expected) => {
      try {
        return JSON.parse(localStorage.getItem('portfolio-sim-currency') || 'null') === expected
      } catch {
        return false
      }
    },
    code,
  )

  const payoffValue = page
    .getByText('Required recurring extra payment', { exact: true })
    .locator('xpath=..')
    .locator('h3')
  await payoffValue.waitFor()
  assert.ok(
    (await payoffValue.innerText()).startsWith(expectedSymbol),
    `Payoff result should use ${expectedSymbol} immediately when the saved currency is ${code}.`,
  )
}

async function assertFinanceNav(page, activeLabel) {
  const nav = page.getByRole('navigation', { name: 'Financial calculators' })
  await nav.waitFor()
  for (const label of ['Loan', 'Payoff Goal', 'Refinance', 'Invest vs. Debt']) {
    await nav.getByRole('link', { name: label, exact: true }).waitFor()
  }
  assert.equal(
    await nav.getByRole('link', { name: activeLabel, exact: true }).getAttribute('aria-current'),
    'page',
    `${activeLabel} should be marked as the active financial tool.`,
  )
  return nav
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Guide' }).click()
  const guidePanel = page.getByRole('tabpanel', { name: 'Guide' })
  await guidePanel.getByRole('link', { name: 'Financial Tools' }).waitFor()
  assert.equal(await guidePanel.getByRole('link', { name: 'Loan Calculator' }).count(), 0, 'Guide should use Financial Tools as the single finance entry point.')

  await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Plan around the portfolio, not just inside it.' }).waitFor()
  await page.getByRole('link', { name: /Payoff Goal/ }).waitFor()
  await page.getByRole('link', { name: /Refinance Comparison/ }).waitFor()
  await page.getByRole('link', { name: /Invest vs. Pay Down Debt/ }).waitFor()
  await openFinancialSettings(page)
  await page.keyboard.press('Escape')

  await page.goto(`${baseUrl}/loan/payoff-goal`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Loan Payoff Goal' }).waitFor()
  await assertFinanceNav(page, 'Payoff Goal')
  await page.getByText('Required recurring extra payment', { exact: true }).waitFor()
  const payoffAmount = await page.getByText('Required recurring extra payment', { exact: true }).locator('xpath=..').locator('h3').innerText()
  assert.match(payoffAmount, /[$€£¥]/, 'Payoff goal should show a currency result.')

  // Currency code, input suffixes, and formatCurrency output must change together.
  await selectCurrency(page, 'EUR', '€')
  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('portfolio-sim-currency') || 'null')),
    'EUR',
    'Persisted EUR should survive reload.',
  )
  assert.ok(
    (await page.getByText('Required recurring extra payment', { exact: true }).locator('xpath=..').locator('h3').innerText()).startsWith('€'),
    'Persisted EUR should hydrate with EUR formatting on the same render.',
  )
  await selectCurrency(page, 'JPY', '¥')
  await selectCurrency(page, 'USD', '$')

  // Establish a shared loan profile from Payoff Goal.
  await replaceNumber(page, 'Loan balance', '420000')
  const apr = await replaceNumber(page, 'APR', '8')
  assert.equal(await apr.inputValue(), '8', 'APR should commit as 8, not 08 or 0.')
  await replaceNumber(page, 'Remaining term', '20')
  await replaceNumber(page, 'Already paying extra', '750')
  const sharedFirstPayment = await page.locator('input[type="month"]').first().inputValue()

  // Refinance must reuse the same current-loan assumptions and explicitly
  // include the saved accelerated payoff plan in its comparison.
  const payoffNav = await assertFinanceNav(page, 'Payoff Goal')
  await payoffNav.getByRole('link', { name: 'Refinance', exact: true }).click()
  await page.getByRole('heading', { name: 'Refinance Comparison' }).waitFor()
  await assertFinanceNav(page, 'Refinance')
  assert.equal(await fieldValue(page, 'Remaining balance'), '420000')
  assert.equal(await fieldValue(page, 'Current APR'), '8')
  assert.equal(await fieldValue(page, 'Remaining term'), '20')
  assert.equal(await page.locator('input[type="month"]').first().inputValue(), sharedFirstPayment)
  await page.getByText('Your current plan', { exact: true }).waitFor()
  await replaceNumber(page, 'New APR', '6')
  await replaceNumber(page, 'New term', '15')
  await replaceNumber(page, 'Closing costs', '7000')
  await page.getByText('Estimated lifetime savings vs. your current plan', { exact: true }).waitFor()

  // Invest vs. Debt shares balance/APR/term/extra cash, while keeping its own
  // market assumptions persistent between visits. Its Monte Carlo work runs
  // off the UI thread and large runs require an explicit start.
  const refiNav = await assertFinanceNav(page, 'Refinance')
  await refiNav.getByRole('link', { name: 'Invest vs. Debt', exact: true }).click()
  await page.getByRole('heading', { name: 'Invest vs. Pay Down Debt' }).waitFor()
  await assertFinanceNav(page, 'Invest vs. Debt')
  assert.equal(await fieldValue(page, 'Loan balance'), '420000')
  assert.equal(await fieldValue(page, 'Loan APR'), '8')
  assert.equal(await fieldValue(page, 'Remaining term'), '20')
  assert.equal(await fieldValue(page, 'Extra cash each month'), '750')
  await replaceNumber(page, 'Median geometric return assumption', '7.5')
  await replaceNumber(page, 'Annual volatility', '12.5')

  const scenarios = page.getByRole('combobox', { name: 'Scenarios' })
  await scenarios.click()
  await page.getByRole('option', { name: '5,000 scenarios' }).click()
  await page.getByText('Across 5,000 seeded market scenarios over the remaining loan term.', { exact: true }).waitFor({ timeout: 30_000 })
  await scenarios.click()
  await page.getByRole('option', { name: '50,000 scenarios' }).click()
  await page.getByRole('button', { name: 'Run 50,000 scenarios' }).waitFor()
  await page.getByText('Ready to run 50,000 scenarios. Use the Run button under Investment assumptions.', { exact: true }).waitFor()
  await scenarios.click()
  await page.getByRole('option', { name: '5,000 scenarios' }).click()
  await page.getByText('Across 5,000 seeded market scenarios over the remaining loan term.', { exact: true }).waitFor({ timeout: 30_000 })

  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await fieldValue(page, 'Loan balance'), '420000', 'Shared loan balance should survive reload.')
  assert.equal(await fieldValue(page, 'Extra cash each month'), '750', 'Shared monthly cash should survive reload.')
  assert.equal(await fieldValue(page, 'Median geometric return assumption'), '7.5', 'Invest return assumption should survive reload.')
  assert.equal(await fieldValue(page, 'Annual volatility'), '12.5', 'Invest volatility should survive reload.')
  assert.match(await page.getByRole('combobox', { name: 'Scenarios' }).innerText(), /5,000 scenarios/, 'Scenario count should survive reload.')
  await page.getByText('Across 5,000 seeded market scenarios over the remaining loan term.', { exact: true }).waitFor({ timeout: 30_000 })

  // Refinance-specific proposal values survive a trip through another tool.
  const investNav = await assertFinanceNav(page, 'Invest vs. Debt')
  await investNav.getByRole('link', { name: 'Refinance', exact: true }).click()
  assert.equal(await fieldValue(page, 'New APR'), '6')
  assert.equal(await fieldValue(page, 'New term'), '15')
  assert.equal(await fieldValue(page, 'Closing costs'), '7000')

  // The full Loan Calculator receives the same shared profile through its
  // backward-compatible storage bridge, including the recurring extra payment.
  const navToLoan = await assertFinanceNav(page, 'Refinance')
  await navToLoan.getByRole('link', { name: 'Loan', exact: true }).click()
  await page.getByRole('heading', { name: 'Loan & Amortization Calculator', level: 1 }).waitFor()
  await assertFinanceNav(page, 'Loan')
  assert.equal(await page.locator('#loan-principal').inputValue(), '420000')
  assert.equal(await page.locator('#loan-apr').inputValue(), '8')
  assert.equal(await page.locator('#loan-term').inputValue(), '20')
  assert.equal(await page.locator('#loan-extra-monthly').inputValue(), '750')
  assert.equal(await page.locator('#loan-start-month').inputValue(), sharedFirstPayment)

  // Editing the full Loan Calculator, including a one-time payment, flows back
  // to the focused tools and enables a direct invest-vs-debt handoff.
  await page.locator('#loan-principal').fill('430000')
  await page.locator('#loan-principal').press('Tab')
  await page.locator('#loan-extra-monthly').fill('900')
  await page.locator('#loan-extra-monthly').press('Tab')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByLabel('Amount').last().fill('10000')
  await page.getByLabel('Amount').last().press('Tab')
  await page.getByRole('link', { name: 'Compare investing these extras' }).waitFor()

  const loanNav = await assertFinanceNav(page, 'Loan')
  await loanNav.getByRole('link', { name: 'Payoff Goal', exact: true }).click()
  assert.equal(await fieldValue(page, 'Loan balance'), '430000')
  assert.equal(await fieldValue(page, 'Already paying extra'), '900')
  await page.getByText(/1 saved one-time payment is included in the target calculation\./).waitFor()
  const comparePayment = page.getByRole('button', { name: /Compare this payment vs\. investing/ })
  await comparePayment.waitFor()
  await comparePayment.click()
  await page.getByRole('heading', { name: 'Invest vs. Pay Down Debt' }).waitFor()
  await page.getByText(/1 saved one-time cash event is included/).waitFor()

  // The shared settings gear contains appearance, currency, and a guarded reset.
  await openFinancialSettings(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('menuitem', { name: 'Reset financial tools' }).click()
  assert.equal(await fieldValue(page, 'Loan balance'), '350000')
  assert.equal(await fieldValue(page, 'Loan APR'), '6.5')
  assert.equal(await fieldValue(page, 'Remaining term'), '30')
  assert.equal(await fieldValue(page, 'Extra cash each month'), '0')
  assert.equal(
    await page.evaluate(() => JSON.parse(localStorage.getItem('portfolio-sim-currency') || 'null')),
    'USD',
    'Resetting financial inputs should preserve display currency.',
  )

  const mobile = await browser.newContext({ viewport: { width: 320, height: 740 } })
  const mobilePage = await mobile.newPage()
  for (const path of ['/', '/tools', '/loan', '/loan/payoff-goal', '/loan/refinance', '/invest-vs-debt']) {
    await mobilePage.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    const dimensions = await mobilePage.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }))
    assert.ok(dimensions.page <= dimensions.viewport + 2, `${path} overflowed at 320px: ${dimensions.page}px > ${dimensions.viewport}px`)
  }
  await mobile.close()

  await page.goto(`${baseUrl}/definitely-not-a-real-page`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'This scenario took an unexpected path.' }).waitFor()

  await context.close()
  console.log('Financial tools browser smoke tests passed.')
} finally {
  await browser.close()
}
