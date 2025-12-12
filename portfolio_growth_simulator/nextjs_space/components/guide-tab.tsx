'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Rocket,
  TrendingUp,
  TrendingDown,
  Dices,
  DollarSign,
  AlertTriangle,
  Lightbulb,
  Smartphone,
  Share,
  Plus,
  ChevronRight,
  ChevronDown,
  Target,
  BarChart3,
  Percent,
  Activity,
  LaptopMinimalCheck,
  Laptop,
  Download,
  Info
} from 'lucide-react'
import { motion } from 'framer-motion'
import { DonationSection } from '@/components/donation-section'

interface GuideTabProps {
  onLaunchMode: (mode: string) => void
}

// Reusable compact card component with collapse functionality
function GuideSection({ 
  title, 
  icon: Icon, 
  description, 
  children, 
  defaultOpen = false,
  className,
  headerClassName,
  iconColorClass = "text-foreground", // Default to standard text color (Black/White)
  iconWrapperClass = "bg-muted text-muted-foreground group-hover:bg-muted/80" // Default icon background
}: { 
  title: string, 
  icon: any, 
  description?: string, 
  children: React.ReactNode, 
  defaultOpen?: boolean,
  className?: string,
  headerClassName?: string,
  iconColorClass?: string,
  iconWrapperClass?: string
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("group", className)}>
      <Card className={cn("border-l-4 border-l-transparent transition-all duration-300 hover:shadow-md", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className={cn("cursor-pointer py-5 select-none", headerClassName)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors duration-300", 
                  iconWrapperClass
                )}>
                  <Icon className={cn("h-5 w-5", iconColorClass)} />
                </div>
                <div className="space-y-1 text-left">
                  <CardTitle className={cn("text-lg leading-none", iconColorClass)}>{title}</CardTitle>
                  {description && <CardDescription className="line-clamp-1">{description}</CardDescription>}
                </div>
              </div>
              <div className={cn(
                "p-1 rounded-full border transition-all duration-300",
                isOpen ? "bg-muted text-foreground rotate-180" : "bg-transparent text-muted-foreground border-transparent group-hover:border-border"
              )}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="animate-accordion-down overflow-hidden data-[state=closed]:animate-accordion-up">
          <CardContent className="pt-0 pb-6 text-sm text-muted-foreground">
            <div className="pl-0 sm:pl-[3.25rem]"> 
              {children}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function GuideTab({ onLaunchMode }: GuideTabProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4 mb-8"
      >
        <motion.div 
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner mb-2"
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          <TrendingUp className="h-10 w-10 text-primary drop-shadow-sm" strokeWidth={2.5} />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Portfolio Simulator
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base">
            Model portfolio growth, plan sustainable withdrawals, and stress-test your strategy with Monte Carlo simulations.
          </p>
        </div>
        <Badge variant="outline" className="mt-2 bg-background/50 backdrop-blur-sm border-amber-500/30 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-3 w-3 mr-1.5" />
          Educational tool only - Not financial advice
        </Badge>
      </motion.div>

      {/* Navigation Cards - Kept colorful as requested */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card 
            className="h-full group cursor-pointer border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/40 hover:shadow-lg transition-all duration-300" 
            onClick={() => onLaunchMode('growth')}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                    <TrendingUp className="h-5 w-5" />
                    Launch Growth Mode
                  </CardTitle>
                  <CardDescription>Simulate wealth accumulation with compound interest</CardDescription>
                </div>
                <div className="p-2 rounded-full bg-background/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card 
            className="h-full group cursor-pointer border-primary/20 bg-gradient-to-br from-primary/5 to-transparent hover:border-primary/40 hover:shadow-lg transition-all duration-300" 
            onClick={() => onLaunchMode('withdrawal')}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                    <TrendingDown className="h-5 w-5" />
                    Launch Withdrawal Mode
                  </CardTitle>
                  <CardDescription>Plan sustainable retirement spending strategies</CardDescription>
                </div>
                <div className="p-2 rounded-full bg-background/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>
      </div>

      <div className="h-px bg-border/50 my-6" />

      {/* Guide Content Section */}
      <div className="space-y-4">
        
        {/* 1. How to Use - Standard Colors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <GuideSection 
            title="How to Use This Simulator" 
            icon={Rocket} 
            description="Step-by-step guides for Growth, Withdrawal, and Monte Carlo"
            defaultOpen={true}
            // Uses standard Card background and text-foreground by default
            iconColorClass="text-primary" // Icon can stay colored for accent, or change to text-foreground if you want icon b/w too
            iconWrapperClass="bg-primary/10 text-primary" // Keep icon distinct, but card background is standard
          >
            <Accordion type="single" collapsible className="w-full">
              {/* Growth Mode Guide */}
              <AccordionItem value="growth-guide">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-foreground">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Growth Mode Guide
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-3 pt-2 text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold shrink-0 mt-0.5">
                        1
                      </span>
                      <span>Navigate to the <strong>Growth</strong> tab and enter your starting portfolio balance.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold shrink-0 mt-0.5">
                        2
                      </span>
                      <span>Set your expected annual return rate (e.g., <strong>8%</strong> for a diversified stock portfolio).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Choose how long you plan to invest (duration in years).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold shrink-0 mt-0.5">
                        4
                      </span>
                      <span>Add your regular contribution amount and frequency (e.g., monthly).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold shrink-0 mt-0.5">
                        5
                      </span>
                      <span>Optional: Set a <strong>Target Goal</strong> to calculate time to reach it.</span>
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              {/* Withdrawal Mode Guide */}
              <AccordionItem value="withdrawal-guide">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-foreground">
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                    Withdrawal Mode Guide
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-3 pt-2 text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold shrink-0 mt-0.5">
                        1
                      </span>
                      <span>Navigate to the <strong>Withdrawal</strong> tab and enter your retirement portfolio balance.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold shrink-0 mt-0.5">
                        2
                      </span>
                      <span>Set your expected return rate (often lower in retirement, e.g., <strong>6-7%</strong>).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Enter the duration you need the money to last.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold shrink-0 mt-0.5">
                        4
                      </span>
                      <span>Set your withdrawal amount and <strong>Inflation Adjustment</strong> (e.g., 2-3%).</span>
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              {/* Monte Carlo Simulation */}
              <AccordionItem value="monte-carlo-guide">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-foreground">
                    <Dices className="h-4 w-4 text-violet-500" />
                    Monte Carlo Simulation
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Toggle the <strong>Monte Carlo Simulation</strong> switch at the top of either mode to test your plan against market volatility.
                  </p>
                  <ol className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">
                        1
                      </span>
                      <span>Select a risk profile (<strong>Conservative</strong>, <strong>Moderate</strong>, or <strong>Aggressive</strong>).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">
                        2
                      </span>
                      <span>Choose the number of scenarios (up to 100,000 for high precision).</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Click <strong>Run Simulation</strong> to see the range of possible outcomes (10th percentile to 90th percentile).</span>
                    </li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </GuideSection>
        </motion.div>

        {/* 2. Key Concepts - Standard Colors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <GuideSection 
            title="Key Concepts Explained" 
            icon={BookOpen}
            description="Terminology used in the simulator"
            iconColorClass="text-emerald-500"
            iconWrapperClass="bg-muted text-muted-foreground group-hover:bg-muted/80"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Compound Interest
                </div>
                <p className="text-xs text-muted-foreground">
                  The process where investment returns generate their own returns over time. Your money grows exponentially rather than linearly, making it one of the most powerful wealth-building concepts.
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Expected Return
                </div>
                <p className="text-xs text-muted-foreground">
                  The average annual return you anticipate. Historical stock market returns average around 10% before inflation, but future returns may vary. Conservative estimates use 6-8%.
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Activity className="h-4 w-4 text-orange-500" />
                  Volatility (Std Dev)
                </div>
                <p className="text-xs text-muted-foreground">
                  A measure of how much returns fluctuate year-to-year. Higher volatility means more uncertainty. Stocks are volatile (~15-18%), while bonds are more stable (~5-8%).
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Dices className="h-4 w-4 text-violet-500" />
                  Monte Carlo
                </div>
                <p className="text-xs text-muted-foreground">
                  Runs thousands of scenarios with randomized returns based on volatility. It shows the range of possible outcomes instead of a single projection, helping you understand risk.
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  Percentiles
                </div>
                <p className="text-xs text-muted-foreground">
                  Statistical markers. The 50th percentile (median) means half of scenarios are better, half worse. The 10th percentile represents a "bad case" scenario (only 10% were worse).
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Percent className="h-4 w-4 text-pink-500" />
                  Inflation
                </div>
                <p className="text-xs text-muted-foreground">
                  The rate at which costs increase. A dollar today buys less in 20 years. Always adjust for inflation (typically 2-3%) to maintain purchasing power in long-term plans.
                </p>
              </div>
            </div>
          </GuideSection>
        </motion.div>

        {/* 3. Best Practices - Standard Colors */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <GuideSection 
            title="Best Practices" 
            icon={Lightbulb}
            description="Tips for realistic financial planning"
            iconColorClass="text-emerald-500"
            iconWrapperClass="bg-muted text-muted-foreground group-hover:bg-muted/80"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">Use Conservative Assumptions</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    It is better to be pleasantly surprised by exceeding your goals than to fall short. Consider using lower return estimates (6-7% instead of 10%) for more realistic planning.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <Target className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">Focus on What You Control</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    You cannot control market returns, but you can control your contribution amounts, spending rates, asset allocation, and time horizon. Adjust these to improve outcomes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
                <Dices className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">Check the "Worst Case"</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    If your plan fails in the bottom 10% of Monte Carlo scenarios, it might be too risky. Aim for plans that succeed in 80-90% of simulations to have a margin of safety.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                <TrendingDown className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground text-sm">Account for Inflation</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Always adjust for inflation, especially in withdrawal planning. Use 2-3% as a standard estimate to ensure your future withdrawals cover your real living expenses.
                  </p>
                </div>
              </div>
            </div>
          </GuideSection>
        </motion.div>

        {/* 4. Installation Guides - Standard Outer Card, Colorful Inner Accordion Items */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <GuideSection 
            title="Installation Guides" 
            icon={Download}
            description="Install as a native app on your device"
            iconColorClass="text-emerald-500"
            iconWrapperClass="bg-muted text-muted-foreground group-hover:bg-muted/80"
          >
            <div className="grid gap-3">
              <Accordion type="single" collapsible className="w-full">
                {/* iPhone Installation */}
                <AccordionItem value="iphone" className="border-b-0 mb-3">
                  <AccordionTrigger className="hover:no-underline py-0 group">
                    <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 group-data-[state=open]:rounded-b-none transition-all">
                      <Smartphone className="h-5 w-5 text-gray-900 dark:text-white" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">Install on iPhone (Safari)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-x border-b border-gray-300 dark:border-zinc-700 rounded-b-lg bg-white dark:bg-zinc-900 p-4 mt-[-1px]">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">1</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Open in Safari</p>
                          <p className="text-gray-700 dark:text-gray-300 text-xs">Make sure you're viewing this page in Safari browser</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">2</span>
                        <div>
                          <p className="font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                            Tap the Share button <Share className="h-3 w-3" />
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 text-xs">Located at the bottom of the screen</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">3</span>
                        <div>
                          <p className="font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                            Select "Add to Home Screen" <Plus className="h-3 w-3" />
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 text-xs">Scroll down in the share menu to find this option</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">4</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Confirm and Add</p>
                          <p className="text-gray-700 dark:text-gray-300 text-xs">Customize the name and tap "Add" in top right</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-gray-100 rounded-lg dark:bg-zinc-800">
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        🎉 Once installed, you can launch Portfolio Simulator directly from your home screen like any other app and saves your parameters when you close the app!
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Android Installation */}
                <AccordionItem value="android" className="border-b-0 mb-3">
                  <AccordionTrigger className="hover:no-underline py-0 group">
                    <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-green-500/30 bg-green-500/5 group-data-[state=open]:rounded-b-none transition-all">
                      <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-semibold text-foreground">Install on Android (Chrome)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-x border-b border-green-500/30 rounded-b-lg bg-green-500/5 p-4 mt-[-1px]">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">1</span>
                        <div>
                          <p className="font-semibold">Open in Chrome</p>
                          <p className="text-muted-foreground text-xs">Android PWA installs work best in Chrome</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">2</span>
                        <div>
                          <p className="font-semibold flex items-center gap-2">Tap the Menu button •••</p>
                          <p className="text-muted-foreground text-xs">Located in the top right corner</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">3</span>
                        <div>
                          <p className="font-semibold">Select "Install App"</p>
                          <p className="text-muted-foreground text-xs">Or "Add to Home screen" depending on version</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">4</span>
                        <div>
                          <p className="font-semibold">Confirm installation</p>
                          <p className="text-muted-foreground text-xs">The app icon will appear on your home screen instantly</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        🎉 Android installation fully supports native full screen app experience.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Chrome Desktop */}
                <AccordionItem value="desktop-chrome" className="border-b-0 mb-3">
                  <AccordionTrigger className="hover:no-underline py-0 group">
                    <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-blue-500/30 bg-blue-500/5 group-data-[state=open]:rounded-b-none transition-all">
                      <Laptop className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-foreground">Install on Chrome Desktop</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-x border-b border-blue-500/30 rounded-b-lg bg-blue-500/5 p-4 mt-[-1px]">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">1</span>
                        <div>
                          <p className="font-semibold">Open in Google Chrome</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">2</span>
                        <div>
                          <p className="font-semibold">Click the Install Icon</p>
                          <p className="text-muted-foreground text-xs">Small computer-with-arrow icon in the address bar</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">3</span>
                        <div>
                          <p className="font-semibold">Click "Install"</p>
                          <p className="text-muted-foreground text-xs">Chrome will create a standalone app window on your desktop</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        💻 Desktop installation gives you a distraction-free windowed version of Portfolio Simulator.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Edge Desktop */}
                <AccordionItem value="desktop-edge" className="border-b-0 mb-3">
                  <AccordionTrigger className="hover:no-underline py-0 group">
                    <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5 group-data-[state=open]:rounded-b-none transition-all">
                      <Laptop className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-sm font-semibold text-foreground">Install on Microsoft Edge</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-x border-b border-cyan-500/30 rounded-b-lg bg-cyan-500/5 p-4 mt-[-1px]">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold shrink-0">1</span>
                        <div>
                          <p className="font-semibold">Open in Microsoft Edge</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold shrink-0">2</span>
                        <div>
                          <p className="font-semibold">Click "App Available"</p>
                          <p className="text-muted-foreground text-xs">Located in the top right of the address bar</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold shrink-0">3</span>
                        <div>
                          <p className="font-semibold">Choose "Install"</p>
                          <p className="text-muted-foreground text-xs">Edge installs Portfolio Simulator as a native-style Windows app</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-background/50 rounded-lg rounded">
                      <p className="text-xs text-muted-foreground">
                        🖥️ Edge PWAs automatically appear in the Start Menu for easy access.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                {/* Firefox Desktop */}
                <AccordionItem value="desktop-firefox" className="border-b-0 mb-3">
                  <AccordionTrigger className="hover:no-underline py-0 group">
                    <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-[#FF7139]/30 bg-[#FF7139]/5 group-data-[state=open]:rounded-b-none transition-all">
                      <LaptopMinimalCheck className="h-5 w-5 text-[#FF7139]" />
                      <span className="text-sm font-semibold text-foreground">Install on Firefox (Windows)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-x border-b border-[#FF7139]/30 rounded-b-lg bg-[#FF7139]/5 p-4 mt-[-1px]">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7139] text-white text-xs font-bold shrink-0">1</span>
                        <div>
                          <p className="font-semibold">Open in Firefox</p>
                          <p className="text-muted-foreground text-xs">Currently available on Windows</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7139] text-white text-xs font-bold shrink-0">2</span>
                        <div>
                          <p className="font-semibold">Open the Menu (≡)</p>
                          <p className="text-muted-foreground text-xs">Click the three lines in the top right corner</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7139] text-white text-xs font-bold shrink-0">3</span>
                        <div>
                          <p className="font-semibold">Select "Install" or "Use as App"</p>
                          <p className="text-muted-foreground text-xs">This will pin the app to your taskbar in its own window</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        🦊 <strong>Mac & Linux users:</strong> Firefox does not support app installation on your platform yet. Please use Chrome or Edge for the best experience.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                 {/* Brave Desktop */}
                <AccordionItem value="desktop-brave" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline py-0 group">
                    <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-[#FB542B]/30 bg-[#FB542B]/5 group-data-[state=open]:rounded-b-none transition-all">
                      <LaptopMinimalCheck className="h-5 w-5 text-[#FB542B]" />
                      <span className="text-sm font-semibold text-foreground">Install on Brave</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-x border-b border-[#FB542B]/30 rounded-b-lg bg-[#FB542B]/5 p-4 mt-[-1px]">
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FB542B] text-white text-xs font-bold shrink-0">1</span>
                         <div>
                           <p className="font-semibold">Open in Brave browser</p>
                           <p className="text-muted-foreground text-xs">Use Brave on Windows, macOS, or Linux</p>
                         </div>
                      </li>
                      <li className="flex items-start gap-3">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FB542B] text-white text-xs font-bold shrink-0">2</span>
                         <div>
                           <p className="font-semibold">Open the browser menu</p>
                           <p className="text-muted-foreground text-xs">Click the Brave menu and look for "Apps" or "Install Portfolio Simulator"</p>
                         </div>
                      </li>
                      <li className="flex items-start gap-3">
                         <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FB542B] text-white text-xs font-bold shrink-0">3</span>
                         <div>
                           <p className="font-semibold">Click "Install"</p>
                           <p className="text-muted-foreground text-xs">Brave will create a separate app style window on your desktop</p>
                         </div>
                      </li>
                    </ol>
                    <div className="mt-4 p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        🦁 Brave uses the same PWA install flow as Chromium browsers while keeping your privacy features.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground flex gap-2">
                <Info className="h-4 w-4 shrink-0" />
                Once installed, the app launches in a dedicated window, preserving your settings between sessions.
              </p>
            </div>
          </GuideSection>
        </motion.div>

        {/* Disclaimer - Kept specific color as requested */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <GuideSection 
            title="Important Disclaimer" 
            icon={AlertTriangle}
            className="border-amber-500/30 bg-amber-500/5 data-[state=open]:border-l-amber-500"
            iconColorClass="text-amber-600 dark:text-amber-500"
            iconWrapperClass="bg-amber-500/10 text-amber-600 dark:text-amber-500"
          >
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                This Portfolio Growth Simulator is an educational tool designed to help you understand investment concepts and plan scenarios. It is <strong>not financial advice</strong> and should not be your only resource for making investment decisions.
              </p>
              <p>
                The calculations and projections are based on simplified models and assumptions that may not reflect real market conditions. Actual investment returns can be significantly higher or lower due to market volatility, economic conditions, fees, taxes, and other factors.
              </p>
              <p>
                <strong>Past performance does not guarantee future results.</strong> All investments involve risk, including the potential loss of principal. Before making any financial decisions, please consult with a qualified financial advisor who can assess your individual situation.
              </p>
            </div>
          </GuideSection>
        </motion.div>
      </div>

      {/* Donation Section */}
      <DonationSection />
    </div>
  )
}