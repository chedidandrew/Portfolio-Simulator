'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Award } from 'lucide-react'
import { Label } from '@/components/ui/label'

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

interface GrowthMilestonesProps {
  finalValue: number
}

export function GrowthMilestones({ finalValue }: GrowthMilestonesProps) {
  const [confettiBursts, setConfettiBursts] = useState<{
    id: number
    burst: number
    origin: { x: number; y: number }
  }[]>([])

  const achievedMilestones = useMemo(() => {
    return MILESTONES.filter(m => finalValue >= m.value)
  }, [finalValue])

  if (!achievedMilestones.length) return null

  return (
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
            achievedMilestones[achievedMilestones.length - 1]?.value ===
            milestone.value

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
  )
}