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

async function selectCurrency(page, code, expectedSymbol) {
  await page.getByRole('button', { name: /^Display currency:/ }).click()
  await page.locator(`[data-currency-code="${code}"]`).click()
  await page.getByRole('button', { name: `Display currency: ${code}` }).waitFor()

  const payoffValue = page
    .getByText('Required recurring extra payment', { exact: true })
    .locator('xpath=..')
    .locator('h3')
  await payoffValue.waitFor()
  assert.ok(
    (await payoffValue.innerText()).startsWith(expectedSymbol),
    `Payoff result should use ${expectedSymbol} immediately when the header shows ${code}.`,
  )
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

  await page.goto(`${baseUrl}/loan/payoff-goal`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Loan Payoff Goal' }).waitFor()
  await page.getByText('Required recurring extra payment', { exact: true }).waitFor()
  const payoffAmount = await page.getByText('Required recurring extra payment', { exact: true }).locator('xpath=..').locator('h3').innerText()
  assert.match(payoffAmount, /[$€£¥]/, 'Payoff goal should show a currency result.')

  // Currency code, input suffixes, and formatCurrency output must change together.
  // This specifically guards against the formatter bridge being one selection behind.
  await selectCurrency(page, 'EUR', '€')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Display currency: EUR' }).waitFor()
  assert.ok(
    (await page.getByText('Required recurring extra payment', { exact: true }).locator('xpath=..').locator('h3').innerText()).startsWith('€'),
    'Persisted EUR should hydrate with EUR formatting on the same render.',
  )
  await selectCurrency(page, 'JPY', '¥')
  await selectCurrency(page, 'USD', '$')

  const apr = await replaceNumber(page, 'APR', '8')
  assert.equal(await apr.inputValue(), '8', 'APR should commit as 8, not 08 or 0.')
  const remainingTerm = await replaceNumber(page, 'Remaining term', '8')
  assert.equal(await remainingTerm.inputValue(), '8', 'Remaining term should remain 8 years after editing.')
  await page.getByText('Required recurring extra payment', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Use this payment in Loan Calculator' }).waitFor()

  await page.goto(`${baseUrl}/loan/refinance`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Refinance Comparison' }).waitFor()
  await replaceNumber(page, 'Current APR', '8')
  await replaceNumber(page, 'New APR', '6')
  await replaceNumber(page, 'Remaining term', '20')
  await replaceNumber(page, 'New term', '15')
  await page.getByText('Estimated lifetime savings after closing costs', { exact: true }).waitFor()
  await page.getByText('Side-by-side cost', { exact: true }).waitFor()

  await page.goto(`${baseUrl}/invest-vs-debt`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Invest vs. Pay Down Debt' }).waitFor()
  await replaceNumber(page, 'Loan APR', '8')
  await replaceNumber(page, 'Extra cash each month', '750')
  await replaceNumber(page, 'Expected annual return', '7.5')
  await replaceNumber(page, 'Remaining term', '1')

  const scenarios = page.getByRole('combobox', { name: 'Scenarios' })
  await scenarios.waitFor()
  assert.match(await scenarios.innerText(), /1,000 scenarios/, 'Invest-vs-debt should default to the same 1,000-scenario preset used by Monte Carlo.')
  await scenarios.click()
  await page.getByRole('option', { name: '100,000 scenarios' }).click()
  await page.getByText('Large runs reduce sampling noise but can take noticeably longer.', { exact: true }).waitFor()
  await page.getByText('Across 100,000 seeded market scenarios over the remaining loan term.', { exact: true }).waitFor()

  const probability = page.getByText('Probability investing the extra cash finishes ahead', { exact: true }).locator('xpath=..').locator('h3')
  await probability.waitFor()
  assert.match(await probability.innerText(), /^\d+(\.\d)?%$/, 'Invest-vs-debt should report a probability.')
  await page.getByText('Outcome spread', { exact: true }).waitFor()

  const mobile = await browser.newContext({ viewport: { width: 320, height: 740 } })
  const mobilePage = await mobile.newPage()
  for (const path of ['/', '/tools', '/loan/payoff-goal', '/loan/refinance', '/invest-vs-debt']) {
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
