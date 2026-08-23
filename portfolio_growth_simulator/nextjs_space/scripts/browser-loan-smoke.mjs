import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const browser = await chromium.launch()

try {
  const context = await browser.newContext({
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  await page.goto(`${baseUrl}/loan`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Loan & Amortization Calculator', level: 1 }).waitFor()

  await page.locator('#loan-principal').fill('350000')
  await page.locator('#loan-apr').fill('6.5')
  await page.locator('#loan-term').fill('30')
  await page.locator('#loan-extra-monthly').fill('300')
  await page.getByText('Extra Payment Impact').waitFor()
  await page.getByText('$2,212.24', { exact: true }).first().waitFor()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Excel' }).click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /^loan-amortization-.*\.xlsx$/)

  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByText('Loan link copied').waitFor({ timeout: 10_000 })
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText())
  assert.ok(sharedUrl.includes('/loan#loan='), 'Expected a versioned loan share link in the URL fragment.')
  await context.close()

  const sharedContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const sharedPage = await sharedContext.newPage()
  await sharedPage.goto(sharedUrl, { waitUntil: 'networkidle' })
  await sharedPage.getByText('Extra Payment Impact').waitFor()
  assert.equal(await sharedPage.locator('#loan-principal').inputValue(), '350000')
  assert.equal(await sharedPage.locator('#loan-extra-monthly').inputValue(), '300')

  const dimensions = await sharedPage.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  assert.ok(
    dimensions.page <= dimensions.viewport + 2,
    `Unexpected shared loan page horizontal overflow: ${dimensions.page}px > ${dimensions.viewport}px`,
  )

  await sharedContext.close()
  console.log('Loan browser smoke tests passed.')
} finally {
  await browser.close()
}
