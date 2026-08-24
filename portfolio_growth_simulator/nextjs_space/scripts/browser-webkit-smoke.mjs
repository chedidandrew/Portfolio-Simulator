import assert from 'node:assert/strict'
import { webkit } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const browser = await webkit.launch()

async function assertFinancialToolSafeArea(page, path) {
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-top', '48px'))
  const safeArea = page.getByTestId('financial-tool-safe-area')
  await safeArea.waitFor({ state: 'visible' })
  const safeAreaBox = await safeArea.boundingBox()
  assert.ok(safeAreaBox, `${path} safe-area spacer should be measurable`)
  assert.ok(safeAreaBox.height >= 47, `${path} should reserve the simulated iPhone safe area`)

  const settingsButton = page.getByRole('button', { name: 'Open settings' })
  await settingsButton.waitFor({ state: 'visible' })
  const settingsButtonBox = await settingsButton.boundingBox()
  assert.ok(settingsButtonBox, `${path} settings button should be measurable`)
  assert.ok(settingsButtonBox.y >= 48, `${path} settings button should sit below the iPhone safe area`)
}

async function assertMonthInputsFit(page, path) {
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth)
  const inputs = page.locator('input[type="month"]:visible')
  const count = await inputs.count()
  for (let index = 0; index < count; index += 1) {
    const box = await inputs.nth(index).boundingBox()
    assert.ok(box, `${path} month input ${index + 1} should be measurable`)
    assert.ok(box.x >= -1, `${path} month input ${index + 1} should not extend past the left edge: ${JSON.stringify(box)}`)
    assert.ok(
      box.x + box.width <= viewportWidth + 1,
      `${path} month input ${index + 1} should fit the iPhone viewport: ${JSON.stringify(box)} > ${viewportWidth}px`,
    )
  }
  return count
}

async function assertFinanceNav(page, activeLabel) {
  const nav = page.getByRole('navigation', { name: 'Financial calculators' })
  await nav.waitFor({ state: 'visible' })
  for (const label of ['Loan', 'Payoff Goal', 'Refinance', 'Invest vs. Debt']) {
    await nav.getByRole('link', { name: label, exact: true }).waitFor({ state: 'visible' })
  }
  assert.equal(await nav.getByRole('link', { name: activeLabel, exact: true }).getAttribute('aria-current'), 'page')
}

async function verifyFinanceSettingsMenu(page) {
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('menuitem', { name: /Theme/ }).waitFor()
  await page.getByRole('menuitem', { name: /Display Currency/ }).waitFor()
  await page.getByRole('menuitem', { name: 'Reset financial tools' }).waitFor()
  await page.keyboard.press('Escape')
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  for (const label of ['Guide', 'Growth', 'Withdrawal']) {
    const tab = page.getByRole('tab', { name: label })
    await tab.waitFor({ state: 'visible' })
    assert.equal(await tab.getByText(label, { exact: true }).isVisible(), true, `${label} text should be visible on mobile`)
  }
  const guidePanel = page.getByRole('tabpanel', { name: 'Guide' })
  await guidePanel.getByRole('link', { name: 'Financial Tools' }).waitFor({ state: 'visible' })
  assert.equal(await guidePanel.getByRole('link', { name: 'Loan Calculator' }).count(), 0, 'Guide should use Financial Tools as the single finance entry point.')

  await page.getByRole('tab', { name: 'Growth' }).click()
  const startingBalance = page.locator('#starting-balance')
  await startingBalance.fill('25000')
  await startingBalance.blur()
  await page.getByText('Projected Results').waitFor()

  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }))
  assert.ok(dimensions.page <= dimensions.viewport + 2, `Unexpected WebKit page-level horizontal overflow: ${dimensions.page}px > ${dimensions.viewport}px`)

  // Verify the top-level settings flow before deeper page interactions cause the
  // auto-hiding mobile header to intentionally move out of the viewport.
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('menuitem', { name: 'Display Currency' }).click()
  const currencyDialog = page.getByRole('dialog', { name: 'Display Currency' })
  await currencyDialog.waitFor({ state: 'visible' })
  const dialogBox = await currencyDialog.boundingBox()
  assert.ok(dialogBox, 'Expected the WebKit currency dialog to be measurable.')
  assert.ok(dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= 391)
  assert.ok(dialogBox.y >= -1 && dialogBox.y + dialogBox.height <= 845)
  await currencyDialog.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('switch', { name: 'Use Monte Carlo simulation for growth' }).click()
  const returnInput = page.locator('#mc-return')
  const volatilityInput = page.locator('#mc-volatility')
  await returnInput.waitFor({ state: 'visible' })
  assert.equal(await returnInput.getAttribute('readonly'), '', 'Preset return should begin read-only.')
  assert.equal(await returnInput.isEditable(), false, 'Preset return should not edit before activation.')
  await returnInput.click()
  await page.waitForFunction(() => !document.querySelector('#mc-return')?.hasAttribute('readonly'))
  assert.equal(await returnInput.isEditable(), true, 'Tapping preset return should switch to Custom and make it editable.')
  await returnInput.fill('8.25')
  await returnInput.blur()
  assert.equal(await returnInput.inputValue(), '8.25')

  await page.getByRole('button', { name: /^Balanced/ }).click()
  await page.waitForFunction(() => document.querySelector('#mc-volatility')?.hasAttribute('readonly'))
  assert.equal(await volatilityInput.isEditable(), false, 'Preset volatility should return to read-only after selecting Balanced.')
  await volatilityInput.click()
  await page.waitForFunction(() => !document.querySelector('#mc-volatility')?.hasAttribute('readonly'))
  assert.equal(await volatilityInput.isEditable(), true, 'Tapping preset volatility should switch to Custom and make it editable.')
  await volatilityInput.fill('12.5')
  await volatilityInput.blur()
  assert.equal(await volatilityInput.inputValue(), '12.5')

  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`${baseUrl}/loan`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Loan & Amortization Calculator', level: 1 }).waitFor()
  await assertFinancialToolSafeArea(page, '/loan')
  await assertFinanceNav(page, 'Loan')
  await verifyFinanceSettingsMenu(page)
  assert.equal(await assertMonthInputsFit(page, '/loan before lump sum'), 1, 'Loan page should start with one visible month input.')

  // The same gear-menu flow used by Guide/Growth/Withdrawal should expose
  // currency through a mobile dialog instead of a separate header button.
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('menuitem', { name: /Display Currency/ }).click()
  const financeCurrencyDialog = page.getByRole('dialog', { name: 'Display Currency' })
  await financeCurrencyDialog.waitFor({ state: 'visible' })
  const financeDialogBox = await financeCurrencyDialog.boundingBox()
  assert.ok(financeDialogBox)
  assert.ok(financeDialogBox.x >= -1 && financeDialogBox.x + financeDialogBox.width <= 321)
  assert.ok(financeDialogBox.y >= -1 && financeDialogBox.y + financeDialogBox.height <= 741)
  await financeCurrencyDialog.getByRole('button', { name: 'Close dialog' }).click()

  await page.locator('#loan-principal').fill('300000')
  await page.locator('#loan-extra-monthly').fill('250')
  await page.getByRole('button', { name: 'Add' }).click()
  assert.equal(await assertMonthInputsFit(page, '/loan with lump sum'), 2, 'Loan page should keep both first-payment and one-time-payment month inputs inside the viewport.')
  await page.getByText('Extra Payment Impact').waitFor()
  await page.getByTestId('loan-balance-chart').waitFor()
  const loanDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }))
  assert.ok(loanDimensions.page <= loanDimensions.viewport + 2, `Unexpected loan page horizontal overflow: ${loanDimensions.page}px > ${loanDimensions.viewport}px`)

  for (const [path, heading, activeLabel, expectedMonthInputs] of [
    ['/loan/payoff-goal', 'Loan Payoff Goal', 'Payoff Goal', 2],
    ['/loan/refinance', 'Refinance Comparison', 'Refinance', 1],
    ['/invest-vs-debt', 'Invest vs. Pay Down Debt', 'Invest vs. Debt', 0],
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
    await assertFinancialToolSafeArea(page, path)
    await assertFinanceNav(page, activeLabel)
    await verifyFinanceSettingsMenu(page)
    assert.equal(await assertMonthInputsFit(page, path), expectedMonthInputs, `${path} should expose the expected iPhone-safe month controls.`)
    const toolDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }))
    assert.ok(toolDimensions.page <= toolDimensions.viewport + 2, `${path} overflowed in WebKit at 320px: ${toolDimensions.page}px > ${toolDimensions.viewport}px`)
  }

  await page.goto(`${baseUrl}/tools`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Plan around the portfolio, not just inside it.', level: 1 }).waitFor()
  await assertFinancialToolSafeArea(page, '/tools')
  await verifyFinanceSettingsMenu(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/privacy`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Privacy', level: 1 }).waitFor()
  await page.getByRole('navigation', { name: 'Footer navigation' }).waitFor()

  console.log('WebKit browser smoke tests passed.')
  await context.close()
} finally {
  await browser.close()
}
