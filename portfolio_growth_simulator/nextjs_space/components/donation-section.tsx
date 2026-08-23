'use client'

import { useRef, useState } from 'react'
import { Coffee, ExternalLink, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useLocalStorage } from '@/hooks/use-local-storage'

const buyMeACoffeeUrl = 'https://buymeacoffee.com/chedidandrew'

const donations = [
  { name: 'Venmo', handle: '@Andrew-Chedid', url: 'https://venmo.com/Andrew-Chedid' },
  { name: 'Cash App', handle: '$AndrewChedid', url: 'https://cash.app/$AndrewChedid' },
  { name: 'PayPal', handle: 'PayPal.me', url: 'https://paypal.me/chedidandrew' },
  { name: 'Bitcoin', handle: 'BTC Wallet', url: 'bitcoin:bc1qnnvqy5fjv33726su7v9ppdd7zntl93zxuaccdl' },
]

export function DonationSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [hasSupported, setHasSupported] = useState(false)
  const [showDonations] = useLocalStorage<boolean>('portfolio-sim-show-donations', true)
  const donationTriggerRef = useRef<HTMLButtonElement>(null)

  const handleSupport = () => {
    setHasSupported(true)
    setIsOpen(false)
  }

  const handleShare = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : 'https://www.portfoliosimulator.org'
      const text = 'Check out this Portfolio Simulator for growth, withdrawals, and Monte Carlo scenarios.'

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Portfolio Simulator', text, url })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }
      setHasSupported(true)
    } catch {
      // Sharing can be cancelled without changing the support state.
    }
  }

  if (!showDonations) return null

  return (
    <>
      <div id="support-this-project" className="mt-6 scroll-mt-24 print:hidden">
        <Card className="border-border/70 bg-muted/20 shadow-none">
          <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Coffee className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {hasSupported ? 'Thanks for supporting Portfolio Simulator' : 'Support this project'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Free, ad-free, and maintained independently.
                </p>
              </div>
            </div>
            {!hasSupported && (
              <Button
                ref={donationTriggerRef}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                className="self-start rounded-full sm:self-auto"
              >
                <Coffee className="mr-2 h-4 w-4" aria-hidden="true" />
                Buy me a coffee
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isOpen && !hasSupported} onOpenChange={setIsOpen}>
        <DialogContent
          className="w-[calc(100%-1.5rem)] max-h-[calc(100vh-3rem)] max-w-lg overflow-y-auto rounded-2xl px-5 py-6 sm:px-7"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            donationTriggerRef.current?.focus()
          }}
        >
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </div>
              <DialogTitle className="text-xl font-bold">Fuel the simulator</DialogTitle>
              <DialogDescription className="mx-auto max-w-sm text-sm">
                If Portfolio Simulator is useful to you, support helps keep it free and ad-free.
              </DialogDescription>
            </div>

            <a
              href={buyMeACoffeeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleSupport}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Support with Coffee
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              {donations.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleSupport}
                  className="rounded-xl border bg-background px-3 py-3 text-center transition-colors hover:bg-muted/50"
                >
                  <p className="text-sm font-medium text-foreground">{platform.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{platform.handle}</p>
                </a>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3 border-t pt-4">
              <div className="rounded-xl border bg-white p-2">
                <QRCodeSVG
                  value={buyMeACoffeeUrl}
                  title="Buy Me a Coffee donation link"
                  size={96}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  includeMargin
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleShare} className="rounded-full">
                <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Share Portfolio Simulator instead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}