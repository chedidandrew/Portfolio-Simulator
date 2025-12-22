'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Coffee, ExternalLink, X, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useLocalStorage } from '@/hooks/use-local-storage'

let sessionHidden = false

export function DonationSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [hideForSession, setHideForSession] = useState(sessionHidden)
  const [hasSupported, setHasSupported] = useState(false)
  const [showDonations, setShowDonations] = useLocalStorage<boolean>('portfolio-sim-show-donations', true)
  const [donationsHiddenUntil, setDonationsHiddenUntil] = useLocalStorage<number>('portfolio-sim-donations-hidden-until', 0)
  const donationPopupUrl = 'https://buymeacoffee.com/chedidandrew'
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

  useEffect(() => {
    if (showDonations && hideForSession) {
      setHideForSession(false)
      sessionHidden = false
    }
  }, [showDonations, hideForSession])

  useEffect(() => {
    if (showDonations && donationsHiddenUntil !== 0) {
      setDonationsHiddenUntil(0)
    }
  }, [showDonations, donationsHiddenUntil, setDonationsHiddenUntil])

  useEffect(() => {
    if (!showDonations && donationsHiddenUntil === 0) {
      setDonationsHiddenUntil(Date.now() + ONE_WEEK_MS)
    }
  }, [showDonations, donationsHiddenUntil, setDonationsHiddenUntil])

  useEffect(() => {
    if (showDonations) return
    if (!donationsHiddenUntil) return

    const now = Date.now()
    if (now >= donationsHiddenUntil) {
      setShowDonations(true)
      setDonationsHiddenUntil(0)
      setHideForSession(false)
      sessionHidden = false
      return
    }

    const ms = donationsHiddenUntil - now
    const t = window.setTimeout(() => {
      setShowDonations(true)
      setDonationsHiddenUntil(0)
      setHideForSession(false)
      sessionHidden = false
    }, ms)
    return () => window.clearTimeout(t)
  }, [showDonations, donationsHiddenUntil, setShowDonations, setDonationsHiddenUntil])

  const donations = [
    {
      name: 'Venmo',
      handle: '@Andrew-Chedid',
      url: 'https://venmo.com/Andrew-Chedid',
      color: 'hover:bg-[#008CFF]/10 hover:shadow-[0_0_24px_rgba(0,140,255,0.35)]',
    },
    {
      name: 'Cash App',
      handle: '$AndrewChedid',
      url: 'https://cash.app/$AndrewChedid',
      color: 'hover:bg-[#00D632]/10 hover:shadow-[0_0_24px_rgba(0,214,50,0.35)]',
    },
    {
      name: 'PayPal',
      handle: 'PayPal.me',
      url: 'https://paypal.me/chedidandrew',
      color: 'hover:bg-[#0070BA]/10 hover:shadow-[0_0_24px_rgba(0,112,186,0.35)]',
    },
    {
      name: 'Bitcoin',
      handle: 'BTC Wallet',
      url: 'bitcoin:bc1qnnvqy5fjv33726su7v9ppdd7zntl93zxuaccdl',
      color: 'hover:bg-[#F7931A]/10 hover:shadow-[0_0_24px_rgba(247,147,26,0.35)]',
    },
  ]

  const buyMeACoffeeUrl = 'https://buymeacoffee.com/chedidandrew'

  const handleSupport = () => {
    setHasSupported(true)
    setIsOpen(false)
  }

  const handleShare = async () => {
    try {
      const url =
        typeof window !== 'undefined'
          ? window.location.href
          : 'https://www.portfoliosimulator.org'
      const text =
        'Check out this Portfolio Simulator that models long term growth, withdrawals, and Monte Carlo scenarios.'

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Portfolio Simulator',
          text,
          url,
        })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      }

      handleSupport()
    } catch {
      // ignore
    }
  }

  if (hideForSession || !showDonations) {
    return null
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 20 }}
        className="mt-8 print:hidden"
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 800) {
              setHideForSession(true)
              sessionHidden = true
              setShowDonations(false)
              setDonationsHiddenUntil(Date.now() + ONE_WEEK_MS)
            }
          }}
          className="cursor-grab active:cursor-grabbing"
        >
          <Card className="rounded-xl border-[3px] border-amber-400/80 dark:border-[#FACC15] outline outline-1 outline-amber-200/60 dark:outline-[#FDE047]/40 shadow-[0_0_18px_rgba(251,191,36,0.3)] bg-white/70 dark:bg-muted/10 backdrop-blur-sm">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.55,
                      type: 'spring',
                      stiffness: 260,
                      damping: 18,
                    }}
                    className="p-2 rounded-full bg-amber-100/70 dark:bg-amber-500/10"
                  >
                    <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                  </motion.div>
                  <div>
                    {hasSupported ? (
                      <>
                        <p className="text-sm font-semibold bg-gradient-to-r from-amber-500 via-amber-600 to-amber-400 dark:from-amber-300 dark:via-amber-400 dark:to-amber-200 bg-clip-text text-transparent">
                          Thank you for your support
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-200 mt-0.5">
                          You are amazing.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-zinc-900 dark:text-foreground">
                          Enjoying this tool?
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-muted-foreground mt-0.5">
                          Consider supporting me :)
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {!hasSupported && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.65,
                        type: 'spring',
                        stiffness: 260,
                        damping: 18,
                      }}
                    >
                      <Button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className={`
                          relative overflow-hidden
                          inline-flex items-center gap-2
                          rounded-full px-6 py-2.5
                          text-sm font-semibold
                          bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500
                          text-black
                          border border-amber-200/80
                          shadow-[0_0_22px_rgba(250,204,21,0.85)]
                          transition-all duration-300
                          hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_0_32px_rgba(250,204,21,1)]
                          group
                        `}
                      >
                        <span className="relative flex items-center gap-2">
                          <span className="bg-gradient-to-r from-black to-black bg-clip-text text-transparent">
                            Buy me a coffee
                          </span>

                          <Coffee className="h-4 w-4 text-black transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6" />
                        </span>

                        <span className="pointer-events-none absolute inset-0 rounded-full bg-amber-400/20 opacity-0 group-hover:opacity-100 group-hover:animate-pulse" />
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
                      </Button>
                    </motion.div>

                    {/* Print only QR code for donations */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8, type: 'spring', stiffness: 260, damping: 20 }}
                      className="print-only justify-center mt-4"
                    >
                      <div className="p-3 rounded-2xl bg-white shadow-[0_0_20px_rgba(250,204,21,0.4)] border border-amber-300/40">
                        <QRCodeSVG
                          value={donationPopupUrl}
                          size={120}
                          bgColor="#ffffff"   // always light background
                          fgColor="#000000"
                          level="M"
                          includeMargin={true}
                        />
                        <p className="mt-2 text-center text-[11px] text-zinc-700">
                          Scan me 📸
                        </p>
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isOpen && !hasSupported && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-3 py-6 sm:px-0 sm:py-0 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative w-full max-w-lg mx-auto rounded-2xl border-[3px] border-amber-400/80 dark:border-[#FACC15] bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-black shadow-[0_0_30px_rgba(251,191,36,0.45)] px-4 py-4 sm:px-8 sm:py-7 max-h-[calc(100vh-3rem)] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-200/20 dark:bg-amber-300/5 blur-3xl" />

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="
                  absolute right-3 top-3
                  flex items-center justify-center
                  h-6 w-6
                  rounded-full
                  bg-zinc-900/80 dark:bg-black/40
                  border border-amber-300/50
                  text-amber-100/90
                  shadow-[0_0_10px_rgba(250,204,21,0.55)]
                  transition-all duration-200
                  hover:bg-amber-500/30 hover:text-white hover:scale-105
                  active:scale-95
                "
              >
                <X className="h-4 w-4 pointer-events-none" />
              </button>

              <div className="relative space-y-6 pt-2">
                <div className="flex flex-col items-center text-center gap-2">
                   <div className="
                      p-3 rounded-full
                      bg-amber-200/60 text-amber-700         /* light mode */
                      shadow-[0_0_20px_rgba(250,204,21,0.55)]
                      dark:bg-yellow-500/20 dark:text-yellow-300 /* dark mode */
                      mb-1
                    "
                  >
                    <Coffee className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-foreground">
                      Fuel the simulator
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-muted-foreground max-w-[80%] mx-auto">
                      I’ve always hated ads. Your support keeps this tool free - forever.
                    </p>
                  </div>
                </div>

                {/* Primary Buy Me a Coffee options - NO BOX */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="mt-6"
                >
                   <div className="flex flex-col gap-3">
                    <motion.a
                      href={buyMeACoffeeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSupport}
                      className="
                        w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-3
                        text-sm font-bold
                        bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500
                        text-black
                        shadow-[0_0_26px_rgba(250,204,21,0.9)]
                        transition-all
                        hover:shadow-[0_0_35px_rgba(250,204,21,0.6)]
                      "
                    >
                      Support with Coffee
                      <ExternalLink className="h-4 w-4" />
                    </motion.a>
                  </div>
                </motion.div>

                {/* Other options */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {donations.map((platform, index) => (
                      <motion.a
                        key={platform.name}
                        href={platform.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + index * 0.04 }}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSupport}
                        className={`
                          relative overflow-hidden rounded-xl border border-amber-100/40 dark:border-amber-100/15
                          bg-white/80 dark:bg-black/40 px-3 py-2.5
                          text-center
                          shadow-[0_0_12px_rgba(17,24,39,0.18)]
                          transition-all duration-300
                          group
                          ${platform.color}
                        `}
                      >
                         <p className="font-medium text-sm text-zinc-900 dark:text-amber-50">
                            {platform.name}
                          </p>
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-200/25 via-transparent to-transparent opacity-0 group-hover:opacity-100" />
                      </motion.a>
                    ))}
                  </div>
                </motion.div>

                {/* Share option as final fallback */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="flex justify-center pt-2"
                >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleShare}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/5 transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share with a friend instead
                    </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRINT ONLY SECTION - BUY ME A COFFEE */}
      <div className="hidden print:flex w-full flex-col items-center justify-center p-6 pt-10 border border-zinc-200 rounded-lg break-inside-avoid text-center bg-white">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Coffee className="h-5 w-5 text-black" />
          <p className="text-sm font-bold text-black">Buy me a coffee</p>
        </div>
        <p className="text-xs text-zinc-600 mb-4">
          Supporting a free app that somehow still charges me.
        </p>

        <div className="p-2 bg-white border border-zinc-200 rounded-lg">
          <QRCodeSVG
            value={donationPopupUrl}
            size={200}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
            includeMargin={true}
          />
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">
          Scan to help keep this app free
        </p>
      </div>
    </>
  )
}