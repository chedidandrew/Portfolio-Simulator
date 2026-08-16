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
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Growth' }).click()

  const startingBalance = page.locator('#starting-balance')
  await startingBalance.fill('25000')
  await startingBalance.blur()
  await page.getByText('Projected Results').waitFor()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Excel' }).click()
  const download = await downloadPromise
  assert.match(download.suggestedFilename(), /portfolio-growth-deterministic-.*\.xlsx$/)

  await page.getByRole('switch', { name: 'Use Monte Carlo simulation for growth' }).click()
  await page.locator('#mc-paths').click()
  await page.getByRole('option', { name: '100 scenarios' }).click()
  await page.getByRole('button', { name: 'Run New Simulation' }).click()
  await page.getByText('Simulation Results').waitFor({ timeout: 120_000 })

  const precisionSwitch = page.locator('#precision-toggle-mc')
  await precisionSwitch.click()
  assert.equal(await precisionSwitch.getAttribute('data-state'), 'checked')

  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByText('Link copied').waitFor({ timeout: 10_000 })
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText())
  assert.ok(sharedUrl.includes('#mc='), 'Expected a versioned Monte Carlo share link.')
  await context.close()

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(sharedUrl, { waitUntil: 'networkidle' })
  await mobilePage.getByText('Simulation Results').waitFor({ timeout: 120_000 })
  assert.equal(await mobilePage.locator('#mc-initial').inputValue(), '25000')
  assert.equal(await mobilePage.locator('#precision-toggle-mc').getAttribute('data-state'), 'checked')

  const dimensions = await mobilePage.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }))
  assert.ok(
    dimensions.page <= dimensions.viewport + 2,
    `Unexpected page-level horizontal overflow: ${dimensions.page}px > ${dimensions.viewport}px`,
  )

  await mobilePage.getByRole('button', { name: 'Open settings' }).click()
  await mobilePage.getByRole('menuitem', { name: 'Display Currency' }).click()

  const currencyDialog = mobilePage.getByRole('dialog', { name: 'Display Currency' })
  const currencyList = mobilePage.getByTestId('currency-picker-list')
  await currencyDialog.waitFor({ state: 'visible' })

  const usdOption = currencyDialog.locator('[data-currency-code="USD"]')
  await usdOption.waitFor({ state: 'visible' })

  const [currencyDialogBox, currencyListBox, usdOptionBox, currencyListLayout] = await Promise.all([
    currencyDialog.boundingBox(),
    currencyList.boundingBox(),
    usdOption.boundingBox(),
    currencyList.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: style.overflowY,
      }
    }),
  ])

  assert.ok(currencyDialogBox, 'Expected the mobile currency dialog to be measurable.')
  assert.ok(currencyListBox, 'Expected the mobile currency list to be measurable.')
  assert.ok(usdOptionBox, 'Expected the selected currency option to be visible.')
  assert.ok(
    currencyDialogBox.x >= -1 && currencyDialogBox.x + currencyDialogBox.width <= 391,
    'Currency dialog must stay inside the iPhone-width viewport.',
  )
  assert.ok(
    currencyDialogBox.y >= -1 && currencyDialogBox.y + currencyDialogBox.height <= 845,
    'Currency dialog must stay inside the iPhone-height viewport.',
  )
  assert.ok(
    currencyListLayout.scrollHeight > currencyListLayout.clientHeight,
    'Currency choices should scroll inside the dialog instead of extending off-screen.',
  )
  assert.ok(
    currencyListLayout.overflowY === 'auto' || currencyListLayout.overflowY === 'scroll',
    `Expected a scrollable currency list, received overflow-y: ${currencyListLayout.overflowY}`,
  )
  assert.ok(
    usdOptionBox.x >= currencyListBox.x - 1
      && usdOptionBox.x + usdOptionBox.width <= currencyListBox.x + currencyListBox.width + 1,
    'Currency options must remain within the dialog width.',
  )

  const lastCurrencyOption = currencyDialog.locator('[data-currency-code]').last()
  await lastCurrencyOption.scrollIntoViewIfNeeded()
  const lastCurrencyOptionBox = await lastCurrencyOption.boundingBox()
  assert.ok(lastCurrencyOptionBox, 'Expected the final currency option to be reachable by scrolling.')
  assert.ok(
    lastCurrencyOptionBox.y >= currencyListBox.y - 1
      && lastCurrencyOptionBox.y + lastCurrencyOptionBox.height <= currencyListBox.y + currencyListBox.height + 1,
    'The final currency option must remain visible inside the scrollable list.',
  )

  await currencyDialog.getByRole('button', { name: 'Close dialog' }).click()
  await currencyDialog.waitFor({ state: 'hidden' })

  const annualReturnHeading = mobilePage.getByText('Expected Annual Return (CAGR)', { exact: true })
  await annualReturnHeading.scrollIntoViewIfNeeded()
  const annualReturnCard = annualReturnHeading.locator(
    'xpath=ancestor::div[.//div[contains(@class, "recharts-responsive-container")]][1]',
  )
  const annualReturnPlot = annualReturnCard.locator('.recharts-surface').first()
  const plotBox = await annualReturnPlot.boundingBox()
  assert.ok(plotBox, 'Expected annual return chart to be measurable on mobile.')

  await mobilePage.mouse.move(
    plotBox.x + plotBox.width * 0.58,
    plotBox.y + plotBox.height * 0.52,
  )

  const activeChartTooltip = annualReturnCard
    .locator('.recharts-tooltip-wrapper[style*="visibility: visible"]')
    .first()
  await activeChartTooltip.waitFor({ state: 'visible', timeout: 10_000 })

  const [tooltipBox, tooltipLayout] = await Promise.all([
    activeChartTooltip.boundingBox(),
    activeChartTooltip.evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        position: style.position,
        transform: style.transform,
      }
    }),
  ])
  assert.ok(tooltipBox, 'Expected active mobile chart tooltip to be measurable.')
  assert.equal(tooltipLayout.position, 'static', 'Mobile chart tooltip should participate in card layout.')
  assert.equal(tooltipLayout.transform, 'none', 'Mobile chart tooltip should not float over the plot.')
  assert.ok(
    tooltipBox.y >= plotBox.y + plotBox.height - 2,
    `Mobile chart tooltip should render beneath the graph: tooltip y=${tooltipBox.y}, plot bottom=${plotBox.y + plotBox.height}`,
  )
  assert.ok(
    tooltipBox.x >= -1 && tooltipBox.x + tooltipBox.width <= 391,
    'Mobile chart tooltip must stay within the iPhone-width viewport.',
  )

  const annualReturnDescription = annualReturnCard
    .locator('p')
    .filter({ hasText: 'Shows the expected compound annual return' })
    .first()
  const probabilityHeading = mobilePage.getByText('Probability of Returns', { exact: true })
  const probabilityCard = probabilityHeading.locator(
    'xpath=ancestor::div[.//div[contains(@class, "recharts-responsive-container")]][1]',
  )

  const [descriptionBox, annualCardBox, probabilityCardBox] = await Promise.all([
    annualReturnDescription.boundingBox(),
    annualReturnCard.boundingBox(),
    probabilityCard.boundingBox(),
  ])
  assert.ok(descriptionBox, 'Expected the annual return graph description to be measurable.')
  assert.ok(annualCardBox, 'Expected the annual return card to be measurable.')
  assert.ok(probabilityCardBox, 'Expected the probability card to be measurable.')
  assert.ok(
    tooltipBox.y + tooltipBox.height <= descriptionBox.y + 1,
    `Mobile tooltip must sit between chart and description: tooltip bottom=${tooltipBox.y + tooltipBox.height}, description top=${descriptionBox.y}`,
  )
  assert.ok(
    annualCardBox.y + annualCardBox.height <= probabilityCardBox.y + 1,
    `Adjacent graph cards must not overlap: annual card bottom=${annualCardBox.y + annualCardBox.height}, probability card top=${probabilityCardBox.y}`,
  )

  await mobilePage.mouse.move(4, 4)

  await mobilePage.evaluate(() => {
    window.dispatchEvent(new CustomEvent('portfolio-simulator:simulation-progress', {
      detail: {
        runId: 'mobile-smoke-run',
        mode: 'growth',
        phase: 'running_scenarios',
        fraction: 0.16,
        detail: 'Calculating 100,000 independent portfolio paths...',
        scenarios: 100_000,
        duration: 200,
        frequency: 'weekly',
        periodsPerScenario: 10_400,
        totalPathPeriods: 1_040_000_000,
        timelineScenarioCount: 1_923,
        timelinePointCount: 299,
        timelineUsesSample: true,
        executionMode: 'Web Worker',
        seed: 'monte-carlo-mobile-smoke-seed-1234567890',
        startedAt: Date.now() - 32_000,
      },
    }))
  })

  const progressOverlay = mobilePage.getByTestId('simulation-progress-overlay')
  await progressOverlay.waitFor()
  const progressCard = progressOverlay.locator(':scope > div')
  const cancelButton = mobilePage.getByRole('button', { name: 'Cancel simulation' })
  const [cardBox, cancelBox] = await Promise.all([
    progressCard.boundingBox(),
    cancelButton.boundingBox(),
  ])
  assert.ok(cardBox, 'Expected mobile simulation progress card to be measurable.')
  assert.ok(cancelBox, 'Expected mobile simulation cancel button to be visible.')
  assert.ok(cardBox.y >= -1, `Progress card starts above viewport: y=${cardBox.y}`)
  assert.ok(
    cardBox.y + cardBox.height <= 845,
    `Progress card extends below mobile viewport: ${cardBox.y + cardBox.height}px`,
  )
  assert.ok(cancelBox.y >= 0 && cancelBox.y + cancelBox.height <= 844, 'Cancel button must remain inside the mobile viewport.')

  await mobilePage.evaluate(() => {
    window.dispatchEvent(new CustomEvent('portfolio-simulator:simulation-progress-clear', { detail: 'mobile-smoke-run' }))
  })
  await mobileContext.close()

  console.log('Browser smoke tests passed.')
} finally {
  await browser.close()
}
