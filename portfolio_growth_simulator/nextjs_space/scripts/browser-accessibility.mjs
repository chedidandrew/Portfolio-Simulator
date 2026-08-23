import assert from 'node:assert/strict'
import axe from 'axe-core'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'
const browser = await chromium.launch()

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  for (const path of [
    '/',
    '/tools',
    '/loan',
    '/loan/payoff-goal',
    '/loan/refinance',
    '/invest-vs-debt',
    '/methodology',
    '/methodology/loan',
    '/methodology/refinance',
    '/methodology/invest-vs-debt',
    '/privacy',
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
    await page.addScriptTag({ content: axe.source })
    const report = await page.evaluate(async () => window.axe.run(document.body))
    const blockers = report.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    if (blockers.length > 0) {
      const details = blockers.map((violation) => ({
        id: violation.id,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      }))
      console.error(`Accessibility violations on ${path}:\n${JSON.stringify(details, null, 2)}`)
    }

    assert.deepEqual(
      blockers.map((violation) => violation.id),
      [],
      `Serious or critical accessibility violations on ${path}`,
    )
  }

  console.log('Real-browser accessibility checks passed.')
  await context.close()
} finally {
  await browser.close()
}
