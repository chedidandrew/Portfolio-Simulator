'use client'

import { useEffect } from 'react'

const MOBILE_QUERY = '(max-width: 639px)'
const TOOLTIP_SELECTOR = '.recharts-tooltip-wrapper'
const TOOLTIP_HEIGHT_VAR = '--mobile-chart-tooltip-height'

function getChartHost(tooltip: HTMLElement): HTMLElement | null {
  const responsiveContainer = tooltip.closest<HTMLElement>('.recharts-responsive-container')
  return responsiveContainer?.parentElement ?? null
}

function syncTooltipSpace(tooltip: HTMLElement, isMobile: boolean) {
  const host = getChartHost(tooltip)
  if (!host) return

  const style = window.getComputedStyle(tooltip)
  const isVisible = isMobile
    && style.visibility === 'visible'
    && style.display !== 'none'
    && style.opacity !== '0'

  if (!isVisible) {
    host.style.removeProperty(TOOLTIP_HEIGHT_VAR)
    return
  }

  const height = Math.ceil(tooltip.getBoundingClientRect().height)
  if (height > 0) host.style.setProperty(TOOLTIP_HEIGHT_VAR, `${height}px`)
}

export function MobileChartTooltipLayout() {
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY)
    const tracked = new Set<HTMLElement>()

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        syncTooltipSpace(entry.target as HTMLElement, media.matches)
      }
    })

    const syncAll = () => {
      const current = new Set(
        Array.from(document.querySelectorAll<HTMLElement>(TOOLTIP_SELECTOR)),
      )

      for (const tooltip of current) {
        if (!tracked.has(tooltip)) {
          tracked.add(tooltip)
          resizeObserver.observe(tooltip)
        }
        syncTooltipSpace(tooltip, media.matches)
      }

      for (const tooltip of Array.from(tracked)) {
        if (current.has(tooltip)) continue
        getChartHost(tooltip)?.style.removeProperty(TOOLTIP_HEIGHT_VAR)
        resizeObserver.unobserve(tooltip)
        tracked.delete(tooltip)
      }
    }

    const mutationObserver = new MutationObserver((mutations) => {
      let shouldRescan = false

      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes'
          && mutation.target instanceof HTMLElement
          && mutation.target.matches(TOOLTIP_SELECTOR)
        ) {
          syncTooltipSpace(mutation.target, media.matches)
        } else if (mutation.type === 'childList') {
          shouldRescan = true
        }
      }

      if (shouldRescan) syncAll()
    })

    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style'],
    })

    const handleMediaChange = () => syncAll()
    media.addEventListener('change', handleMediaChange)
    syncAll()

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      media.removeEventListener('change', handleMediaChange)
      for (const tooltip of tracked) {
        getChartHost(tooltip)?.style.removeProperty(TOOLTIP_HEIGHT_VAR)
      }
      tracked.clear()
    }
  }, [])

  return null
}
