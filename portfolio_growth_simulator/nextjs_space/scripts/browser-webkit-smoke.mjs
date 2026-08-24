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
  await page.getByRole('tabpanel', { name: 'Guide' }).getByRole('link', { name: 'Loan Calculator' }).waitFor({ state: 'visible' })

  await page.getByRole('tab', { name: 'Growth' }).click()
  const startingBalance = page.locator('#starting-balance')
  await startingBalance.fill('25000')
  await startingBalance.blur()
  await page.getByText('Projected Results').waitFor()

  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }))
  assert.ok(dimensions.page <= dimensions.viewport + 2, `Unexpected WebKit page-level horizontal overflow: ${dimensions.page}px > ${dimensions.viewport}px`)

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('menuitem', { name: 'Display Currency' }).click()
  const currencyDialog = page.getByRole('dialog', { name: 'Display Currency' })
  await currencyDialog.waitFor({ state: 'visible' })
  const dialogBox = await currencyDialog.boundingBox()
  assert.ok(dialogBox, 'Expected the WebKit currency dialog to be measurable.')
  assert.ok(dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= 391)
  assert.ok(dialogBox.y >= -1 && dialogBox.y + dialogBox.height <= 845)
  await currencyDialog.getByRole('button', { name: 'Close dialog' }).click()

  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto(`${baseUrl}/loan`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Loan & Amortization Calculator', level: 1 }).waitFor()
  await assertFinancialToolSafeArea(page, '/loan')
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
