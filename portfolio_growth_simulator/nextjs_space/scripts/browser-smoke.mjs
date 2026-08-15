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
