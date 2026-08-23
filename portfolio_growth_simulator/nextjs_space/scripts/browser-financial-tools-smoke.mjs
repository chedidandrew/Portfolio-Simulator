import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const browser = await chromium.launch()

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

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
  await page.getByRole('button', { name: 'Use this payment in Loan Calculator' }).waitFor()

  await page.goto(`${baseUrl}/loan/refinance`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Refinance Comparison' }).waitFor()
  await page.getByText('Estimated lifetime savings after closing costs', { exact: true }).waitFor()
  await page.getByText('Side-by-side cost', { exact: true }).waitFor()

  await page.goto(`${baseUrl}/invest-vs-debt`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Invest vs. Pay Down Debt' }).waitFor()
  const probability = page.getByText('Probability investing the extra cash finishes ahead', { exact: true }).locator('xpath=..').locator('h3')
  await probability.waitFor()
  assert.match(await probability.innerText(), /^\d+(\.\d)?%$/, 'Invest-vs-debt should report a probability.')
  await page.getByText('Outcome spread', { exact: true }).waitFor()

  const mobile = await browser.newContext({ viewport: { width: 320, height: 740 } })
  const mobilePage = await mobile.newPage()
  for (const path of ['/tools', '/loan/payoff-goal', '/loan/refinance', '/invest-vs-debt']) {
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
