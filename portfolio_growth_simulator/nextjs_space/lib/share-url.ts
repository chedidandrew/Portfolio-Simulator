export type ShareUrlResult = 'shared' | 'copied' | 'unsupported'

export interface ShareUrlTarget {
  share?: (data: { url: string }) => Promise<void>
  clipboard?: {
    writeText?: (text: string) => Promise<void>
  }
}

function getShareTarget(target?: ShareUrlTarget): ShareUrlTarget | undefined {
  if (target) return target
  if (typeof navigator === 'undefined') return undefined
  return navigator
}

/**
 * Shares only the scenario URL. Omitting title and text is intentional: on
 * iOS, the native share sheet's Copy action otherwise copies the accompanying
 * prose before the URL, which produces an invalid browser address when pasted.
 */
export async function shareUrlOnly(
  url: string,
  target?: ShareUrlTarget,
): Promise<ShareUrlResult> {
  const shareTarget = getShareTarget(target)

  if (typeof shareTarget?.share === 'function') {
    await shareTarget.share({ url })
    return 'shared'
  }

  if (typeof shareTarget?.clipboard?.writeText === 'function') {
    await shareTarget.clipboard.writeText(url)
    return 'copied'
  }

  return 'unsupported'
}
