'use client'

import { useEffect } from 'react'
import { shareUrlOnly } from '@/lib/share-url'

type NavigatorWithOptionalShare = Navigator & {
  share?: (data?: ShareData) => Promise<void>
}

/**
 * Existing result components invoke the native Web Share API. Safari includes
 * both `text` and `url` when the user chooses Copy, so pasting that value into
 * an address bar is not a valid URL. This guard keeps every URL share in this
 * app URL-only while preserving non-URL share calls unchanged.
 */
export function UrlOnlyShareGuard() {
  useEffect(() => {
    const shareNavigator = navigator as NavigatorWithOptionalShare
    if (typeof shareNavigator.share !== 'function') return

    const originalShare = shareNavigator.share.bind(navigator)
    const previousDescriptor = Object.getOwnPropertyDescriptor(navigator, 'share')

    const urlOnlyShare = async (data?: ShareData) => {
      if (typeof data?.url === 'string' && data.url.length > 0) {
        await shareUrlOnly(data.url, {
          share: ({ url }) => originalShare({ url }),
        })
        return
      }

      await originalShare(data)
    }

    try {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: urlOnlyShare,
      })
    } catch {
      return
    }

    return () => {
      if (previousDescriptor) {
        Object.defineProperty(navigator, 'share', previousDescriptor)
      } else {
        Reflect.deleteProperty(navigator, 'share')
      }
    }
  }, [])

  return null
}
