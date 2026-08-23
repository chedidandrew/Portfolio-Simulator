import assert from 'node:assert/strict'
import { webkit } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const browser = await webkit.launch()

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  for (const label of ['Guide', 'Growth', 'Withdrawal']) {
    const tab = page.getByRole('tab', { name: label })
    await tab.waitFor({ state: 'visible' })
    assert.equal(await tab.getByText(label, { exact: true }).isVisible(), true, `${label} text should be visible on mobile`)
  }

  await page.getByRole('tab', { name: 'Growth' }).click()

  const startingBalance = page.locator('#starting-balance')
  await startingBalance.fill('25000')
  await startingBalance.blur()
  await page.getByText('Projected Results').waitFor()

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  assert.ok(
    dimensions.page <= dimensions.viewport + 2,
    `Unexpected WebKit page-level horizontal overflow: ${dimensions.page}px > ${dimensions.viewport}px`,
  )

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
  await page.locator('#loan-principal').fill('300000')
  await page.locator('#loan-extra-monthly').fill('250')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByText('Extra Payment Impact').waitFor()
  await page.getByTestId('loan-balance-chart').waitFor()
  await page.getByRole('button', { name: 'Toggle theme' }).waitFor()

  const loanDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  assert.ok(
    loanDimensions.page <= loanDimensions.viewport + 2,
    `Unexpected loan page horizontal overflow: ${loanDimensions.page}px > ${loanDimensions.viewport}px`,
  )

  await page.getByRole('button', { name: 'View full monthly schedule' }).click()
  await page.getByText('Starting Balance', { exact: true }).waitFor()
  await page.getByRole('navigation', { name: 'Footer navigation' }).waitFor()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/privacy`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Privacy', level: 1 }).waitFor()
  await page.getByRole('navigation', { name: 'Footer navigation' }).waitFor()

  console.log('WebKit browser smoke tests passed.')
  await context.close()
} finally {
  await browser.close()
}
