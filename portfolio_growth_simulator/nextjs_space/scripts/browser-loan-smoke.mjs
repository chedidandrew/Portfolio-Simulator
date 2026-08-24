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

  const brandText = page.getByRole('link', { name: 'Portfolio Simulator home' }).locator('span')
  await brandText.waitFor({ state: 'visible' })
  const brandStyles = await brandText.evaluate((element) => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
    color: getComputedStyle(element).color,
  }))
  assert.equal(brandStyles.backgroundImage, 'none', 'Header brand text should not render the old green gradient.')
  assert.notEqual(brandStyles.color, 'rgba(0, 0, 0, 0)', 'Header brand text should use a visible foreground color.')

  const editableApr = page.locator('#loan-apr')
  await editableApr.fill('')
  assert.equal(await editableApr.inputValue(), '', 'Loan APR should allow a transient empty edit state.')
  await editableApr.fill('8')
  assert.equal(await editableApr.inputValue(), '8', 'Loan APR should accept 8 without forcing 08 or 0.')
  await editableApr.press('Tab')
  assert.equal(await editableApr.inputValue(), '8')
  await editableApr.fill('6.5')
  await editableApr.press('Tab')

  const editableTerm = page.locator('#loan-term')
  await editableTerm.fill('')
  assert.equal(await editableTerm.inputValue(), '', 'Loan term should allow a transient empty edit state.')
  await editableTerm.fill('30')
  await editableTerm.press('Tab')
  assert.equal(await editableTerm.inputValue(), '30', 'Loan term should remain 30 years after editing.')

  await page.locator('#loan-principal').fill('350000')
  await page.locator('#loan-apr').fill('6.5')
  await page.locator('#loan-term').fill('30')
  await page.locator('#loan-extra-monthly').fill('300')
  await page.getByRole('button', { name: 'Add' }).click()
  await page.getByText('Extra Payment Impact').waitFor()
  await page.getByText('$2,212.24', { exact: true }).first().waitFor()

  const summaryCard = page
    .getByText('Required monthly payment', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"print-section")][1]')
  const interestMetric = summaryCard.getByText('Total interest', { exact: true }).locator('xpath=..')
  const totalPaidMetric = summaryCard.getByText('Total paid', { exact: true }).locator('xpath=..')
  const payoffMetric = summaryCard.getByText('Payoff', { exact: true }).locator('xpath=..')
  const interestBox = await interestMetric.boundingBox()
  const totalPaidBox = await totalPaidMetric.boundingBox()
  const payoffBox = await payoffMetric.boundingBox()
  assert.ok(interestBox && totalPaidBox && payoffBox, 'Expected loan summary metrics to be measurable.')
  assert.ok(Math.abs(interestBox.y - totalPaidBox.y) <= 2, 'Total interest and total paid should share the first summary row.')
  assert.ok(payoffBox.y > interestBox.y + 8, 'Payoff should move to the second summary row on desktop for more room.')

  const interestValue = interestMetric.locator('p').last()
  const valueLayout = await interestValue.evaluate((element) => ({
    whiteSpace: getComputedStyle(element).whiteSpace,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  assert.equal(valueLayout.whiteSpace, 'nowrap', 'Loan currency summary values should stay on one line.')
  assert.ok(
    valueLayout.scrollWidth <= valueLayout.clientWidth + 1,
    `Loan summary value should fit without clipping: ${valueLayout.scrollWidth}px > ${valueLayout.clientWidth}px`,
  )

  const chart = page.getByTestId('loan-balance-chart')
  await chart.scrollIntoViewIfNeeded()
  const chartBox = await chart.boundingBox()
  assert.ok(chartBox, 'Expected the remaining-balance chart to be measurable.')
  await page.mouse.move(chartBox.x + chartBox.width * 0.55, chartBox.y + chartBox.height * 0.55)
  const tooltip = chart.locator('.recharts-default-tooltip').first()
  await tooltip.waitFor({ state: 'visible' })
  const tooltipStyles = await tooltip.evaluate((element) => {
    const probe = document.createElement('div')
    probe.className = 'bg-popover'
    document.body.appendChild(probe)
    const expectedBackground = getComputedStyle(probe).backgroundColor
    probe.remove()
    const styles = getComputedStyle(element)
    return {
      backgroundColor: styles.backgroundColor,
      borderRadius: Number.parseFloat(styles.borderRadius),
      expectedBackground,
    }
  })
  assert.equal(tooltipStyles.backgroundColor, tooltipStyles.expectedBackground, 'Loan chart tooltip should use the current theme popover background.')
  assert.ok(tooltipStyles.borderRadius >= 8, 'Loan chart tooltip should use the rounded app-card treatment.')
  assert.match(await tooltip.locator('.recharts-tooltip-label').innerText(), /^Payment \d+$/, 'Loan chart tooltip should show a readable payment label.')

  const gridOpacity = await chart.locator('.recharts-cartesian-grid line').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).strokeOpacity))
  assert.ok(gridOpacity <= 0.13, `Loan chart grid should remain visually quiet, got opacity ${gridOpacity}.`)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Excel' }).click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /^loan-amortization-.*\.xlsx$/)

  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByText('Loan link copied').waitFor({ timeout: 10_000 })
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText())
  assert.ok(sharedUrl.includes('/loan#loan='), 'Expected a versioned loan share link in the URL fragment.')

  await page.goto(`${baseUrl}/methodology/loan`, { waitUntil: 'networkidle' })
  await page.getByText('Fixed-rate installment formula', { exact: true }).waitFor()
  await page.locator('.katex-display').first().waitFor({ state: 'visible' })
  await context.close()

  const sharedContext = await browser.newContext({ viewport: { width: 320, height: 740 } })
  const sharedPage = await sharedContext.newPage()
  await sharedPage.goto(sharedUrl, { waitUntil: 'networkidle' })
  await sharedPage.getByText('Extra Payment Impact').waitFor()
  assert.equal(await sharedPage.locator('#loan-principal').inputValue(), '350000')
  assert.equal(await sharedPage.locator('#loan-extra-monthly').inputValue(), '300')
  assert.equal(await sharedPage.evaluate(() => window.location.hash), '', 'Consumed loan share data should be removed from the address bar.')

  const dimensions = await sharedPage.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  assert.ok(
    dimensions.page <= dimensions.viewport + 2,
    `Unexpected shared loan page horizontal overflow: ${dimensions.page}px > ${dimensions.viewport}px`,
  )

  await sharedPage.getByRole('button', { name: 'View full monthly schedule' }).click()
  await sharedPage.getByText('Scheduled Principal', { exact: true }).first().waitFor()

  await sharedPage.emulateMedia({ media: 'print' })
  const assumptionsHeading = sharedPage.getByRole('heading', { name: 'Loan Assumptions' })
  await assumptionsHeading.waitFor({ state: 'visible' })
  const assumptionsCard = assumptionsHeading.locator('xpath=ancestor::div[contains(@class,"print-section")]')
  await assumptionsCard.getByText('One-time principal payments', { exact: true }).waitFor({ state: 'visible' })
  await sharedPage.emulateMedia({ media: 'screen' })

  await sharedPage.locator('a[href="/methodology/loan"]').first().waitFor({ state: 'visible' })
  await sharedContext.close()
  console.log('Loan browser smoke tests passed.')
} finally {
  await browser.close()
}
