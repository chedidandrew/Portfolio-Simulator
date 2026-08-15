'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, ArrowDownToLine } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      setDeferredPrompt(installEvent)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
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
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 p-4 bg-background border rounded-lg shadow-lg md:bottom-8 md:right-8"
        >
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Install App</h4>
            <p className="text-xs text-muted-foreground">
              Add to home screen for a better experience
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Dismiss install prompt"
              onClick={() => setIsVisible(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" onClick={handleInstallClick}>
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Install
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
