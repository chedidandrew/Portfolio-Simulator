'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, ArrowDownToLine } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'portfolio-sim-pwa-dismissed-at'
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000

function dismissalIsActive(): boolean {
  try {
    const value = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(value) && value > 0 && Date.now() - value < DISMISS_FOR_MS
  } catch {
    return false
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {}
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      setDeferredPrompt(installEvent)
      setIsVisible(!dismissalIsActive())
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    rememberDismissal()
    setIsVisible(false)
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'dismissed') rememberDismissal()
    setDeferredPrompt(null)
    setIsVisible(false)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border bg-background p-4 shadow-lg md:bottom-8 md:right-8"
        >
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Install App</h4>
            <p className="text-xs text-muted-foreground">Add to home screen for a better experience</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" aria-label="Dismiss install prompt for 30 days" onClick={dismiss}>
              <X className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" onClick={handleInstallClick}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Install
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
