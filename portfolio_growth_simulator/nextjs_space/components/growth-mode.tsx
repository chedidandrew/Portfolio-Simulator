'use client'

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NumericInput } from '@/components/ui/numeric-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { DollarSign, TrendingUp, Calendar, Target, Award, Share, FileText, FileSpreadsheet, Dices } from 'lucide-react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { GrowthChart } from '@/components/growth-chart'
import { MonteCarloSimulator } from '@/components/monte-carlo-simulator'
import { DonationSection } from '@/components/donation-section'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { triggerHaptic } from '@/hooks/use-haptics'
import { roundToCents, formatCurrency, getLargeNumberName } from '@/lib/utils'
import { GrowthState } from '@/lib/types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface YearData {
  year: number
  startingValue: number
  contributions: number
  endingValue: number
}

const MILESTONES = [
  { value: 10000, label: 'First $10K', icon: '🎯' },
  { value: 50000, label: '$50K Club', icon: '⭐' },
  { value: 100000, label: '$100K Milestone', icon: '💎' },
  { value: 250000, label: 'Quarter Million', icon: '🏆' },
  { value: 500000, label: 'Half Million', icon: '👑' },
  { value: 1000000, label: 'Millionaire!', icon: '🚀' },
  { value: 2000000, label: 'Multi-Millionaire', icon: '🏝️' },
  { value: 5000000, label: 'FIRE', icon: '🔥' },
  { value: 10000000, label: 'fatFIRE', icon: '🔥🔥🔥' },
  { value: 25000000, label: 'Ultra Wealthy', icon: '🏰' },
  { value: 50000000, label: 'Seriously Rich', icon: '🛥️' },
  { value: 100000000, label: 'Money is no object', icon: '💰' },
  { value: 500000000, label: 'Half Billion Club', icon: '🌍' },
  { value: 1000000000, label: 'Billionaire!', icon: '🌌' },
  { value: 2000000000, label: 'Two Billion Level', icon: '🛰️' },
  { value: 5000000000, label: 'Five Billion Level', icon: '🪐' },
  { value: 10000000000, label: 'Ten Billion Titan', icon: '👾' },
  { value: 25000000000, label: 'Quarter-Centibillionaire', icon: '⚡' },
  { value: 50000000000, label: 'Half-Centibillionaire', icon: '🌋' },
  { value: 100000000000, label: 'Centibillionaire+', icon: '🎡' },
  { value: 250000000000, label: 'Quarter Trillion', icon: '🌠' },
  { value: 500000000000, label: 'Half Trillion', icon: '🧭' },
  { value: 1000000000000, label: 'Trillionaire!', icon: '👽' },
  { value: 2500000000000, label: 'Compound interest is OP', icon: '📈' },
  { value: 5000000000000, label: 'Half Trillionaire+', icon: '🚁' },

  // --- THE QUADRILLIONS (10^15) ---
  { value: 10000000000000, label: 'Keep Dreaming...', icon: '💤' },
  { value: 25000000000000, label: 'US Debt Payoff', icon: '🇺🇸' },
  { value: 50000000000000, label: 'Global Economy Owner', icon: '🌐' },
  { value: 1e15, label: 'Quadrillionaire', icon: '🤖' },
  { value: 5e15, label: 'Earth is your NFT', icon: '🖼️' },

  // --- THE QUINTILLIONS (10^18) ---
  { value: 1e16, label: 'Buying Mars (Cash)', icon: '🔴' },
  { value: 1e17, label: 'Jeff Bezos is your pet', icon: '🐕' },
  { value: 1e18, label: 'Quintillionaire', icon: '🍬' },
  { value: 5e18, label: 'Solar System CEO', icon: '☀️' },

  // --- THE SEXTILLIONS (10^21) ---
  { value: 1e19, label: 'Dyson Sphere Funder', icon: '🔋' },
  { value: 1e20, label: 'Buying Physics DLC', icon: '⚛️' },
  { value: 1e21, label: 'Sextillionaire', icon: '🌌' },
  { value: 5e21, label: 'Milky Way Landlord', icon: '🛸' },

  // --- THE SEPTILLIONS (10^24) ---
  { value: 6.02e23, label: 'A Mole of Dollars', icon: '🧪' },
  { value: 1e24, label: 'Septillionaire', icon: '🍷' },
  { value: 5e24, label: 'Galactic Emperor', icon: '👑' },

  // --- THE OCTILLIONS (10^27) ---
  { value: 1e25, label: 'Bribing Black Holes', icon: '🕳️' },
  { value: 1e26, label: 'Buying the Universe', icon: '🌀' },
  { value: 1e27, label: 'Octillionaire', icon: '🐙' },
  { value: 5e27, label: 'Atoms in the Human Body', icon: '🧬' },

  // --- THE NONILLIONS (10^30) ---
  { value: 1e28, label: 'Developer Console Access', icon: '💻' },
  { value: 1e29, label: 'Why are you doing this?', icon: '🤨' },
  { value: 1e30, label: 'Nonillionaire', icon: '🤯' },

  // --- THE ABSURD / INSULTING TIER ---
  { value: 1e31, label: 'Go Touch Grass', icon: '🌳' },
  { value: 1e32, label: 'Integer Overflow Error', icon: '⚠️' },
  { value: 1e33, label: 'You Broke Mathematics', icon: '✖️' },
  { value: 1e34, label: 'Please Stop Clicking', icon: '🛑' },
  { value: 1e35, label: 'Needs A Bigger Number Type', icon: '🧮' },
  { value: 1e36, label: 'The Simulation Crashing', icon: '🖥️' },
  { value: 1e37, label: 'Undecillionaire', icon: '🧊' },
  { value: 1e38, label: 'Please Go Outside Immediately', icon: '🚪' },

  // --- THE DUODECILLIONS (10^39) ---
  { value: 1e39, label: 'Duodecillionaire (Seek Help)', icon: '🛋️' },
  { value: 3e39, label: 'Owns Several Universes', icon: '🌌' },
  { value: 5e39, label: 'Too Rich To Render', icon: '🧾' },

  // --- THE TREDECILLIONS (10^42) ---
  { value: 1e42, label: 'Tredecillionaire', icon: '🧠' },
  { value: 5e42, label: 'Wallet Needs Its Own Server', icon: '🗄️' },

  // --- THE QUATTUORDECILLIONS (10^45) ---
  { value: 1e45, label: 'Quattuordecillionaire', icon: '📚' },
  { value: 5e45, label: 'Owns Every Timeline', icon: '⏳' },

  // --- THE QUINDECILLIONS (10^48) ---
  { value: 1e48, label: 'Quindecillionaire', icon: '🎭' },
  { value: 5e48, label: 'Can Tip Type III civilizations For Fun', icon: '💸' },

  // --- THE SEXDECILLIONS (10^51) ---
  { value: 1e51, label: 'Sexdecillionaire', icon: '🔥' },
  { value: 5e51, label: 'Central Bank Of Reality', icon: '🏛️' },

  // --- THE SEPTENDECILLIONS (10^54) ---
  { value: 1e54, label: 'Septendecillionaire', icon: '🛰️' },
  { value: 5e54, label: 'Bored Of Owning the multiverse', icon: '😐' },

  // --- THE OCTODECILLIONS (10^57) ---
  { value: 1e57, label: 'Octodecillionaire', icon: '🧬' },
  { value: 5e57, label: 'Buys Laws Of Physics', icon: '📜' },

  // --- THE NOVEMDECILLIONS (10^60) ---
  { value: 1e60, label: 'Novemdecillionaire', icon: '🧨' },
  { value: 5e60, label: 'You Broke The Simulator UI', icon: '👁️' },

  // --- THE VIGINTILLIONS (10^63) ---
  { value: 1e63, label: 'Vigintillionaire (Get a life)', icon: '💀' },
  { value: 3e63, label: 'Why are you still clicking?', icon: '🖱️' },
  { value: 5e63, label: 'Okay, you win. Happy?', icon: '🏳️' },
  { value: 1e64, label: 'Ran out of emojis to give you'},
  { value: 3e64, label: 'At'},
  { value: 5e64, label: 'least'},
  { value: 1e65, label: 'save'},
  { value: 3e65, label: 'some'},
  { value: 5e65, label: 'milestones'},
  { value: 1e66, label: 'for'},
  { value: 3e66, label: 'everyone'},
  { value: 5e66, label: 'else'},
  { value: 1e67, label: '.'},
  { value: 3e67, label: '.'},
  { value: 5e67, label: '.'},
  { value: 1e68, label: '*sigh*'},
  { value: 1e68, label: 'Last one'},
  { value: 1e69, label: '.'},
  { value: 3e69, label: '.'},
  { value: 5e69, label: '.'},
  // --- THE EXPANDED INSANITY (10^70+) ---
  { value: 1e70, label: 'Lol (I lied)', icon: '🤥' },
  { value: 1e72, label: 'Buying the Writer’s Room', icon: '✍️' },
  { value: 1e75, label: 'Hostile Takeover of String Theory', icon: '🤝' },
  { value: 1e78, label: 'Owning the Existance itself', icon: '🔵' },
  
  // 10^80 is roughly the number of atoms in the observable universe
  { value: 1e80, label: 'Owned Every Possibility in Existence', icon: '⚛️' },
  { value: 1e85, label: 'Renting all laws of the Multiverse', icon: '🏘️' },
  { value: 1e90, label: 'Bribing Mathematics and Physics Itself', icon: '🍎' },
  { value: 1e95, label: 'downloading_more_ram.exe', icon: '💾' },

  // GOOGOL (10^100)
  { value: 1e100, label: 'GOOGOLNAIRE', icon: '🔎' },
  { value: 1e105, label: 'Google is now your subsidiary', icon: '📉' },
  { value: 1e110, label: 'Deleting the number 0', icon: '0️⃣' },
  { value: 1e120, label: 'Buying the concept of Math', icon: '➗' },
  
  // The absurd
  { value: 1e130, label: 'You are the Simulation', icon: '👾' },
  { value: 1e140, label: '404: Economy Not Found', icon: '🚫' },
  { value: 1e150, label: 'Money buys happiness', icon: '🙂' },
  { value: 1e160, label: 'Your wallet has an event horizon', icon: '🕳️' },
  { value: 1e180, label: 'Admin Access Granted', icon: '🔑' },
  { value: 1e200, label: 'Buying Heaven & Hell', icon: '⚖️' },
  
  // Approaching limits
  { value: 1e250, label: 'JavaScript is crying', icon: '😭' },
  { value: 1e280, label: 'Buffer Overflow Imminent', icon: '🌊' },
  { value: 1e300, label: 'The End is Nigh', icon: '🔚' },

  // CENTILLION (10^303)
  { value: 1e303, label: 'CENTILLIONAIRE', icon: '💯' },
  
  // MAX_VALUE is ~1.79e308
  { value: 1.7e308, label: '(1 = 0) GAME OVER ', icon: '🎮' },
  { value: Infinity, label: 'TO INFINITY AND BEYOND', icon: '🚀' },
]

const milestoneVariants = {
  hidden: { scale: 0, opacity: 0, y: 10 },
  visible: (index: number) => ({
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 * index,
      type: 'spring',
      stiffness: 260,
      damping: 18,
    },
  }),
}

const ConfettiBurst = ({
  seed,
  origin,
}: {
  seed: number
  origin: { x: number; y: number }
}) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, index) => {
        const rand = (() => {
          let t = seed + index * 9973
          return () => {
            t ^= t << 13
            t ^= t >> 17
            t ^= t << 5
            return ((t >>> 0) % 10000) / 10000
          }
        })()

        const angle = rand() * Math.PI * 2
        const distance = 40 + rand() * 80
        const driftX = (rand() - 0.5) * 80
        const driftY = (rand() - 0.5) * 80

        const x = Math.cos(angle) * distance + driftX
        const y = Math.sin(angle) * distance + driftY
        const hue = rand() * 360

        return {
          key: `${seed}-${index}`,
          x,
          y,
          color: `hsl(${hue}, 85%, 55%)`,
          rotation: rand() * 720,
          scale: 0.5 + rand() * 0.5,
        }
      }),
    [seed]
  )

  if (!mounted || typeof document === 'undefined') return null

  return (
    <>
      {createPortal(
        (
          <div
            className="pointer-events-none fixed inset-0 z-[9999] overflow-visible"
            style={{
              transform: 'translate3d(0,0,0)',
            }}
          >
            {pieces.map((piece) => (
              <motion.div
                key={piece.key}
                className="absolute h-2 w-2 rounded-sm shadow-sm"
                style={{
                  left: origin.x,
                  top: origin.y,
                  backgroundColor: piece.color,
                  willChange: 'transform, opacity',
                }}
                initial={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                  scale: piece.scale,
                  rotate: 0,
                }}
                animate={{
                  opacity: 0,
                  x: piece.x,
                  y: piece.y,
                  scale: 0,
                  rotate: piece.rotation,
                }}
                transition={{
                  duration: 1.2,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            ))}
          </div>
        ) as any,
        document.body
      )}
    </>
  )
}

export function GrowthMode() {
  const [state, setState] = useLocalStorage<GrowthState>('growth-mode-state', {
    startingBalance: 10000,
    annualReturn: 8,
    duration: 30,
    periodicAddition: 500,
    frequency: 'monthly',
    targetValue: 500000,
    inflationAdjustment: 0,
  })

  // Changed to useLocalStorage to persist the toggle state
  const [useMonteCarloMode, setUseMonteCarloMode] = useLocalStorage('growth-show-monte-carlo', false)
  const [showFullPrecision, setShowFullPrecision] = useLocalStorage('growth-show-full-precision', false)
  
  const [isCalculated, setIsCalculated] = useState(false)
  const [confettiBursts, setConfettiBursts] = useState<{
    id: number
    burst: number
    origin: { x: number; y: number }
  }[]>([])

  // Helper for formatting result cards: Full Precision if toggled AND < 100M
  // REPLACED: Updated to return tooltip component
  const formatResult = (val: number | undefined) => {
    if (val === undefined) return '$0'

    const shouldUseCompact = val >= 1e100 || !showFullPrecision
    const formatted = formatCurrency(val, true, 2, shouldUseCompact)
    const fullName = getLargeNumberName(val)

    if (shouldUseCompact && fullName) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help decoration-dotted decoration-foreground/30 underline-offset-4 hover:underline">
                {formatted}
              </span>
            </TooltipTrigger>
            <TooltipContent className="bg-card text-foreground border-border rounded-lg shadow-lg p-3 text-xs">
              <p>{fullName}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return formatted
  }

  // Load state from URL if sharing link is used
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const search = new URLSearchParams(window.location.search)
      const mcParam = search.get('mc')
      if (!mcParam) return

      const decoded = JSON.parse(decodeURIComponent(atob(mcParam)))
      
      if (decoded?.mode === 'growth') {
        if (decoded.type === 'deterministic' && decoded.params) {
          // Restore deterministic state
          setUseMonteCarloMode(false)
          setState(decoded.params)
          // Restore full precision setting
          if (typeof decoded.showFullPrecision === 'boolean') {
            setShowFullPrecision(decoded.showFullPrecision)
          }
          // Clean URL to prevent re-reading on reload if desired, or keep it
          window.history.replaceState(null, '', window.location.pathname)
        } else if (decoded.type !== 'deterministic' && !useMonteCarloMode) {
          // Default to MC if no type specified (legacy) or type is monte-carlo
          setUseMonteCarloMode(true)
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  const frequencyMultiplier = {
    yearly: 1,
    quarterly: 4,
    monthly: 12,
    weekly: 52,
  }

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.href)
    const payload = {
      mode: 'growth',
      type: 'deterministic',
      params: state,
      showFullPrecision, // Include in share link
    }
    const encoded = typeof btoa !== 'undefined' ? btoa(encodeURIComponent(JSON.stringify(payload))) : ''
    if (encoded) url.searchParams.set('mc', encoded)
    return url.toString()
  }

  const handleShareLink = async () => {
    triggerHaptic('light')
    const url = buildShareUrl()
    if (!url) return

    try {
      const shareText = 'Check my results in Portfolio Simulator.'
      const cleanMarkdown = `[Check my results](${url})`

      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({
          title: 'Portfolio Simulator',
          text: shareText,
          url,
        })
        return
      }

      if (navigator?.clipboard) {
        await navigator.clipboard.writeText(cleanMarkdown)
      }
    } catch {
      // ignore
    }
  }

  const handleExportPdf = () => {
    triggerHaptic('light')
    if (typeof window === 'undefined') return
    window.print()
  }

  const calculateGrowth = useMemo(() => {
    const { startingBalance, annualReturn, duration, periodicAddition, frequency, inflationAdjustment } = state
    const periods = frequencyMultiplier[frequency]
    const ratePerPeriod = Math.pow(1 + annualReturn / 100, 1 / periods) - 1
    const totalPeriods = duration * periods
    
    // Inflation adjustment factor per year
    const inflationFactor = 1 + (inflationAdjustment / 100);

    const yearData: YearData[] = []
    let currentValue = startingBalance
    
    // We need to track the current periodic addition which might change yearly
    let currentPeriodicAddition = periodicAddition;
    let runningTotalContributions = startingBalance;

    for (let year = 1; year <= duration; year++) {
      const startingValue = currentValue
      let yearContributions = 0
      
      for (let period = 0; period < periods; period++) {
        currentValue = currentValue * (1 + ratePerPeriod) + currentPeriodicAddition
        yearContributions += currentPeriodicAddition
      }
      
      runningTotalContributions += yearContributions;
      
      yearData.push({
        year,
        startingValue,
        contributions: yearContributions,
        endingValue: currentValue,
      })

      // Increase contribution for the NEXT year by inflation rate
      currentPeriodicAddition *= inflationFactor;
    }
    
    const finalValue = currentValue
    const totalContributions = runningTotalContributions
    const totalProfit = finalValue - totalContributions
    
    // FIXED: Infinite Loop Protection & Logical Guards
    const MAX_YEARS_TO_TARGET = 1000
    let yearsToTarget: number | null = null

    // Only attempt calculation if growth is possible or we have a positive contribution
    if (
      state.targetValue &&
      state.targetValue > startingBalance &&
      (ratePerPeriod > 0 || periodicAddition > 0)
    ) {
      let tempValue = startingBalance
      let tempPeriodicAddition = periodicAddition
      
      for (let year = 1; year <= MAX_YEARS_TO_TARGET; year++) {
        for (let period = 0; period < periods; period++) {
          tempValue = tempValue * (1 + ratePerPeriod) + tempPeriodicAddition
        }
        if (tempValue >= state.targetValue) {
          yearsToTarget = year
          break
        }
        // Apply inflation to the simulation for target
        tempPeriodicAddition *= inflationFactor;
      }
    }
    
    return { finalValue, totalContributions, totalProfit, yearData, yearsToTarget }
  }, [state, frequencyMultiplier])

  const handleExportExcel = () => {
    triggerHaptic('light')
    if (!calculateGrowth?.yearData || calculateGrowth.yearData.length === 0) return

    const summaryRows = [
      { Key: 'Mode', Value: 'Growth (Deterministic)' },
      { Key: 'Starting Balance', Value: roundToCents(state.startingBalance) },
      { Key: 'Annual Return %', Value: state.annualReturn },
      { Key: 'Duration Years', Value: state.duration },
      { Key: 'Contribution Amount', Value: roundToCents(state.periodicAddition) },
      { Key: 'Frequency', Value: state.frequency },
      { Key: 'Inflation Adjustment %', Value: state.inflationAdjustment },
      { Key: 'Target Value', Value: roundToCents(state.targetValue) || 'N/A' },
      { Key: 'Final Value', Value: roundToCents(calculateGrowth.finalValue) },
      { Key: 'Total Contributions', Value: roundToCents(calculateGrowth.totalContributions) },
      { Key: 'Total Profit', Value: roundToCents(calculateGrowth.totalProfit) },
    ]

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    ;(wsSummary as any)['!cols'] = [{ wch: 20 }, { wch: 20 }]

    const excelData = calculateGrowth.yearData.map(row => ({
      Year: row.year,
      'Starting Value': roundToCents(row.startingValue),
      'Contributions': roundToCents(row.contributions),
      'Ending Value': roundToCents(row.endingValue),
    }))

    const wsData = XLSX.utils.json_to_sheet(excelData)
    ;(wsData as any)['!cols'] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')
    XLSX.utils.book_append_sheet(wb, wsData, 'Value By Year')

    const date = new Date().toISOString().split('T')[0]
    const fileName = `portfolio-growth-deterministic-${date}.xlsx`

    XLSX.writeFile(wb, fileName)
  }
  
  const isProfitNegative = (calculateGrowth?.totalProfit ?? 0) < 0
  const achievedMilestones = useMemo(() => {
    return MILESTONES.filter(m => calculateGrowth?.finalValue >= m.value)
  }, [calculateGrowth?.finalValue])

  useEffect(() => {
    setIsCalculated(true)
    const timer = setTimeout(() => setIsCalculated(false), 1500)
    return () => clearTimeout(timer)
  }, [calculateGrowth])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h2 className="text-2xl font-bold">Calculate Your Portfolio Growth</h2>
        <p className="text-muted-foreground">
          See how compound interest and regular contributions can build wealth over time
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0 }}
      >
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Dices className="h-4 w-4 text-violet-500" />
                <Label className="text-base font-semibold">
                  Monte Carlo Simulation
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Model market volatility with randomized scenarios
              </p>
            </div>
            <Switch
              checked={useMonteCarloMode}
              onCheckedChange={setUseMonteCarloMode}
            />
          </div>
        </CardContent>
      </Card>
      </motion.div>
      
      {useMonteCarloMode ? (
        <MonteCarloSimulator mode="growth" initialValues={state} />
      ) : (
        <>
          <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Growth Parameters
              </CardTitle>
              <CardDescription>Configure your investment scenario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starting-balance">Starting Balance ($)</Label>
                  <NumericInput
                    id="starting-balance"
                    value={state?.startingBalance ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      if (!isFinite(n)) {
                        setState({ ...state, startingBalance: 0 })
                        return
                      }
                      
                      // Currency clamp: 0 is allowed, but if >0, min is 0.01
                      if (n !== 0 && Math.abs(n) < 0.01) {
                         n = 0.01
                      }
                      
                      // Standardize to 2 decimals
                      const limited = Number(n.toFixed(2))
                      setState({ ...state, startingBalance: limited })
                    }}
                    min={0}
                    max={1_000_000_000_000_000_000}
                    maxErrorMessage="Now you are just being too greedy :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annual-return">Annual Return (%)</Label>
                  <NumericInput
                    id="annual-return"
                    step={0.0001}
                    value={state?.annualReturn ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      
                      if (!isFinite(n)) {
                        setState({ ...state, annualReturn: 0 })
                        return
                      }

                      // Clamp extremely tiny non-zero values to avoid floating point weirdness
                      const MIN_ABS = 0.000001
                      if (n !== 0 && Math.abs(n) < MIN_ABS) {
                        n = MIN_ABS * Math.sign(n)
                      }

                      // Limit precision to 6 decimals
                      const limited = Number(n.toFixed(6))
                      setState({ ...state, annualReturn: limited })
                    }}
                    min={-100}
                    max={100000}
                    maxErrorMessage="Now you are just being too greedy :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (Years)</Label>
                  <NumericInput
                    id="duration"
                    value={state?.duration ?? 0}
                    onChange={(value) => setState({ ...state, duration: Math.max(1, Math.floor(value)) })}
                    min={1}
                    max={100}
                    maxErrorMessage="Planning for the next century? :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodic-addition">Contribution Amount ($)</Label>
                  <NumericInput
                    id="periodic-addition"
                    value={state?.periodicAddition ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      if (!isFinite(n)) n = 0
                      
                      // Non-negative constraint
                      if (n < 0) n = 0
                      
                      // Currency clamp: min 0.01 if non-zero
                      if (n !== 0 && n < 0.01) n = 0.01
                      
                      const limited = Number(n.toFixed(2))
                      setState({ ...state, periodicAddition: limited })
                    }}
                    min={0}
                    max={1_000_000_000_000_000_000}
                    maxErrorMessage="Now you are just being too greedy :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Contribution Frequency</Label>
                  <Select
                    value={state?.frequency ?? 'monthly'}
                    onValueChange={(value: any) => setState({ ...state, frequency: value })}
                  >
                    <SelectTrigger id="frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inflation">Inflation Adjustment (%)</Label>
                  <NumericInput
                    id="inflation"
                    step={0.1}
                    value={state?.inflationAdjustment ?? 0}
                    onChange={(value) => {
                      let n = Number(value)
                      
                      if (!isFinite(n)) {
                        setState({ ...state, inflationAdjustment: 0 })
                        return
                      }
                      
                      // Clamp tiny values (inflation is usually 2 decimals)
                      const MIN_ABS = 0.01
                      if (n !== 0 && Math.abs(n) < MIN_ABS) {
                        n = MIN_ABS * Math.sign(n)
                      }
                      
                      // Limit precision
                      const limited = Number(n.toFixed(2))
                      setState({ ...state, inflationAdjustment: limited })
                    }}
                    min={-50}
                    max={100}
                    maxErrorMessage="Hyperinflation much? :)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-value">Target Value (Optional)</Label>
                  <NumericInput
                    id="target-value"
                    placeholder="e.g., 1000000"
                    value={state?.targetValue ?? ''}
                    onChange={(value) => {
                      if (!value && value !== 0) {
                        setState({ ...state, targetValue: undefined })
                        return
                      }
                      
                      let n = Number(value)
                      if (!isFinite(n)) return
                      
                      if (n < 0) n = 0
                      
                      // Currency clamp if > 0
                      if (n !== 0 && n < 0.01) n = 0.01
                      
                      const limited = Number(n.toFixed(2))
                      setState({ ...state, targetValue: limited })
                    }}
                    min={0}
                    max={1_000_000_000_000_000_000}
                    maxErrorMessage="What are you trying to buy, the moon? 🌝"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0 }}
          >
          <Card className="border-primary/20 print-section">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 shrink-0">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Projected Results
                </CardTitle>

                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm print:hidden">
                  <div className="flex items-center gap-2 mr-2 border-r border-border pr-3">
                    <Switch
                      id="precision-toggle"
                      checked={showFullPrecision}
                      onCheckedChange={setShowFullPrecision}
                    />
                    <Label htmlFor="precision-toggle" className="font-normal cursor-pointer">
                      Expand
                    </Label>
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleShareLink}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-full border border-[#3B82F6]/50 
                    bg-[#3B82F6]/10 px-2.5 py-1.5 font-medium text-[#3B82F6]
                    shadow-sm shadow-[#3B82F6]/20
                    transition-colors duration-150
                    hover:bg-[#3B82F6]/15 hover:border-[#3B82F6]"
                  >
                    <Share className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleExportPdf}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-full border border-red-400/50 
                              bg-red-500/10 px-2.5 py-1.5 font-medium text-red-300
                              shadow-sm shadow-red-500/20
                              transition-colors duration-150
                              hover:bg-red-500/15 hover:border-red-400"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleExportExcel}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.96, y: 0 }}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 
                              bg-emerald-500/10 px-2.5 py-1.5 font-medium text-emerald-300
                              shadow-sm shadow-emerald-500/20
                              transition-colors duration-150
                              hover:bg-emerald-500/15 hover:border-emerald-400"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Excel</span>
                  </motion.button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <motion.div
                  // FIX: use static key so the element is reused instead of remounted
                  key="metric-final-value"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="min-w-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">Final Portfolio Value</p>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary break-words leading-tight">
                    {formatResult(calculateGrowth?.finalValue)}
                  </div>
                </motion.div>

                <motion.div
                  // FIX: static key
                  key="metric-total-contributions"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="min-w-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-4 space-y-1"
                >
                  <p className="text-xs text-muted-foreground">Total Contributions</p>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-500 break-words leading-tight">
                    {formatResult(calculateGrowth?.totalContributions)}
                  </div>
                </motion.div>

                <motion.div
                  // FIX: static key
                  key="metric-total-profit"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`min-w-0 bg-gradient-to-br rounded-lg p-4 space-y-1 ${
                    isProfitNegative
                      ? 'from-destructive/10 to-destructive/5'
                      : 'from-emerald-500/10 to-emerald-500/5'
                  }`}
                >
                  <p className="text-xs text-muted-foreground">Total Profit</p>

                  <div
                    className={`text-lg sm:text-xl md:text-2xl font-bold break-words leading-tight ${
                      isProfitNegative ? 'text-destructive' : 'text-emerald-500'
                    }`}
                  >
                    {formatResult(calculateGrowth?.totalProfit)}
                  </div>
                </motion.div>

              </div>

              {state?.targetValue && calculateGrowth?.yearsToTarget && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 p-4 bg-primary/10 rounded-lg"
                >
                  <Target className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    You'll reach your target of <span className="font-bold">${state.targetValue.toLocaleString()}</span> in approximately{' '}
                    <span className="font-bold text-primary">{calculateGrowth.yearsToTarget} years</span>
                  </p>
                </motion.div>
              )}

              {achievedMilestones?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    <Label>Milestones Achieved</Label>
                  </div>
                  
                  <AnimatePresence>
                    {confettiBursts.map((burst) => (
                      <ConfettiBurst
                        key={burst.burst}
                        seed={burst.burst}
                        origin={burst.origin}
                      />
                    ))}
                  </AnimatePresence>

                  <div className="flex flex-wrap gap-2">
                    {achievedMilestones.map((milestone, index) => {
                      const isTopMilestone =
                        achievedMilestones[achievedMilestones.length - 1]?.value === milestone.value

                      return (
                        <motion.button
                          key={milestone.value}
                          type="button"
                          onClick={(e) => {
                            const x = e.clientX
                            const y = e.clientY

                            setConfettiBursts((prev) => {
                              const next = [
                                ...prev,
                                {
                                  id: milestone.value,
                                  burst: Date.now(),
                                  origin: { x, y },
                                },
                              ]
                              return next.slice(-15) 
                            })
                          }}
                          variants={milestoneVariants}
                          initial="hidden"
                          animate="visible"
                          custom={index}
                          whileHover={{
                            scale: 1.06,
                            y: -2,
                            boxShadow:
                              '0 0 0 1px rgba(16,185,129,0.3), 0 0 25px rgba(56,189,248,0.35)',
                          }}
                          whileTap={{ scale: 0.97, rotate: -2 }}
                          className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <Badge
                            className={[
                              'bg-primary/15 text-primary hover:bg-primary/25',
                              'border border-primary/30',
                              'backdrop-blur-xs',
                              isTopMilestone
                                ? 'shadow-[0_0_25px_rgba(16,185,129,0.6)] ring-1 ring-primary/60'
                                : 'shadow-[0_0_12px_rgba(56,189,248,0.25)]',
                              'transition-all duration-200',
                            ].join(' ')}
                          >
                            <span className="mr-1 text-base">{milestone.icon}</span>
                            <span className="text-xs sm:text-sm font-medium">
                              {milestone.label}
                            </span>
                          </Badge>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>

          <GrowthChart data={calculateGrowth?.yearData ?? []} />

          <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0 }}
          >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Value By Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="border-b">
                      <th className="p-3 text-left text-sm font-semibold">Year</th>
                      <th className="p-3 text-right text-sm font-semibold">Starting Value</th>
                      <th className="p-3 text-right text-sm font-semibold">Contributions</th>
                      <th className="p-3 text-right text-sm font-semibold">Ending Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateGrowth?.yearData?.map?.((row, idx) => (
                      <motion.tr
                        key={row?.year}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="p-3 text-sm font-medium">{row?.year}</td>
                        <td className="p-3 text-sm text-right">
                          ${row?.startingValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-sm text-right text-muted-foreground">
                          ${row?.contributions?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-3 text-sm text-right font-semibold text-primary">
                          ${row?.endingValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </>
      )}

      <DonationSection />
    </div>
  )
}