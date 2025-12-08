'use client'

export type HapticStrength = 'light' | 'medium' | 'heavy'

export function triggerHaptic(strength: HapticStrength = 'light') {
  if (typeof window === 'undefined') return

  const nav = window.navigator as any

  if (!nav || typeof nav.vibrate !== 'function') return

  const ua = window.navigator.userAgent || ''
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  if (!isMobile) return

  switch (strength) {
    case 'heavy':
      nav.vibrate([0, 40])
      break
    case 'medium':
      nav.vibrate([0, 25])
      break
    case 'light':
    default:
      nav.vibrate(12)
      break
  }
}
