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

  const themeButton = page.getByRole('button', { name: 'Toggle theme' })
  await themeButton.waitFor({ state: 'visible' })
  const themeButtonBox = await themeButton.boundingBox()
  assert.ok(themeButtonBox, `${path} theme button should be measurable`)
  assert.ok(themeButtonBox.y >= 48, `${path} theme button should sit below the iPhone safe area`)
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

  const startMonth = page.locator('#loan-start-month')
  const loanDetailsCard = startMonth.locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rounded-lg ")][1]')
  const [startMonthBox, loanDetailsCardBox] = await Promise.all([
    startMonth.boundingBox(),
    loanDetailsCard.boundingBox(),
  ])
  assert.ok(startMonthBox, 'First payment month should be measurable on iPhone width.')
  assert.ok(loanDetailsCardBox, 'Loan Details card should be measurable on iPhone width.')
  assert.ok(
    startMonthBox.x >= loanDetailsCardBox.x + 22
      && startMonthBox.x + startMonthBox.width <= loanDetailsCardBox.x + loanDetailsCardBox.width - 22,
    `First payment month must stay inside the Loan Details card padding: input=${JSON.stringify(startMonthBox)}, card=${JSON.stringify(loanDetailsCardBox)}`,
  )

  await page.locator('#loan-principal').fill('300000')
  await page.locator('#loan-extra-monthly').fill('250')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByText('Extra Payment Impact').waitFor()
  await page.getByTestId('loan-balance-chart').waitFor()
  const loanDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }))
  assert.ok(loanDimensions.page <= loanDimensions.viewport + 2, `Unexpected loan page horizontal overflow: ${loanDimensions.page}px > ${loanDimensions.viewport}px`)
  await page.getByRole('button', { name: 'View full monthly schedule' }).click()
  await page.getByText('Starting Balance', { exact: true }).waitFor()
  await page.getByRole('navigation', { name: 'Footer navigation' }).waitFor()

  for (const [path, heading] of [
    ['/tools', 'Plan around the portfolio, not just inside it.'],
    ['/loan/payoff-goal', 'Loan Payoff Goal'],
    ['/loan/refinance', 'Refinance Comparison'],
    ['/invest-vs-debt', 'Invest vs. Pay Down Debt'],
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
    await assertFinancialToolSafeArea(page, path)
    const toolDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }))
    assert.ok(toolDimensions.page <= toolDimensions.viewport + 2, `${path} overflowed in WebKit at 320px: ${toolDimensions.page}px > ${toolDimensions.viewport}px`)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/privacy`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Privacy', level: 1 }).waitFor()
  await page.getByRole('navigation', { name: 'Footer navigation' }).waitFor()

  console.log('WebKit browser smoke tests passed.')
  await context.close()
} finally {
  await browser.close()
}
