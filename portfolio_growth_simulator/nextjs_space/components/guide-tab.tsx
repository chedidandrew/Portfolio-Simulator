'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Target,
  BarChart3,
  Percent,
  Activity,
  LaptopMinimalCheck,
  Laptop,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { DonationSection } from '@/components/donation-section'

interface GuideTabProps {
  onLaunchMode: (mode: string) => void
}

export function GuideTab({ onLaunchMode }: GuideTabProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
          <TrendingUp className="h-10 w-10 text-primary" strokeWidth={2.5} />
        </div>
        <h2 className="text-3xl font-bold">Welcome to Portfolio Simulator</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          A powerful tool to model portfolio growth, plan retirement spending, and test strategies with Monte Carlo simulations
        </p>
        <Badge variant="outline" className="mt-2">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Educational tool only - Not financial advice
        </Badge>
      </motion.div>

      {/* Quick Start Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onLaunchMode('growth')}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Growth Mode
                  </CardTitle>
                  <CardDescription>Build wealth with compound interest</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Calculate how regular contributions and compound returns grow your portfolio over time.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onLaunchMode('withdrawal')}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-primary" />
                    Withdrawal Mode
                  </CardTitle>
                  <CardDescription>Plan sustainable retirement spending</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Test if your portfolio can sustain regular withdrawals throughout retirement.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

    {/* Quick Start Guide */}
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Quick Start Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Growth Mode Tutorial */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Using Growth Mode</h3>
            </div>
            <ol className="space-y-2 text-sm pl-6">
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">1.</span>
                <span>Navigate to the Growth tab and enter your starting portfolio balance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">2.</span>
                <span>Set your expected annual return rate (e.g., 8% for diversified portfolio)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">3.</span>
                <span>Choose how long you plan to invest (duration in years)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">4.</span>
                <span>Add your regular contribution amount and frequency (monthly, quarterly, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">5.</span>
                <span>Optional: Set a target goal to see when you'll reach it</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">6.</span>
                <span>View your projected growth chart and year-by-year breakdown</span>
              </li>
            </ol>
          </div>

          {/* Withdrawal Mode Tutorial */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Using Withdrawal Mode</h3>
            </div>
            <ol className="space-y-2 text-sm pl-6">
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">1.</span>
                <span>Go to the Withdrawal tab and enter your retirement portfolio balance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">2.</span>
                <span>Set your expected return rate during retirement (often lower, e.g., 6-7%)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">3.</span>
                <span>Enter how many years you need the money to last</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">4.</span>
                <span>Set your withdrawal amount and frequency for living expenses</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">5.</span>
                <span>Add inflation adjustment to account for rising costs (e.g., 2-3%)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">6.</span>
                <span>Check the sustainability assessment and ending balance</span>
              </li>
            </ol>
          </div>

          {/* Monte Carlo Tutorial */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Dices className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Using Monte Carlo Simulation</h3>
            </div>
            <ol className="space-y-2 text-sm pl-6">
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">1.</span>
                <span>Toggle on "Monte Carlo Simulation" in either Growth or Withdrawal mode</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">2.</span>
                <span>Select a preset profile (Conservative, Moderate, or Aggressive)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">3.</span>
                <span>Or choose Custom to set your own expected return and volatility</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">4.</span>
                <span>Configure parameters and choose number of scenarios (1-100,000)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">5.</span>
                <span>Click "Run Simulation" to generate thousands of possible outcomes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary min-w-[1.5rem]">6.</span>
                <span>Review percentiles, probability statements, and outcome distribution</span>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </motion.div>

      {/* Key Concepts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Key Concepts Explained
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Compound Interest</h4>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              The process where investment returns generate their own returns over time. Your money grows exponentially rather than linearly, making it one of the most powerful wealth-building concepts.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Expected Return</h4>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              The average annual return you anticipate from your investments. Historical stock market returns average around 10% before inflation, but future returns may vary. Conservative estimates use 6-8%.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Volatility (Standard Deviation)</h4>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              A measure of how much returns fluctuate from year to year. Higher volatility means more uncertainty. Stock-heavy portfolios have ~15-18% volatility, while bond-heavy portfolios have ~5-8%.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Dices className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Monte Carlo Simulation</h4>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              A technique that runs thousands of scenarios with randomized returns based on expected return and volatility. It shows the range of possible outcomes instead of a single projection, helping you understand risk.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Percentiles</h4>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              Statistical markers showing outcome distribution. The 50th percentile (median) means half of scenarios are above, half below. The 10th percentile represents bad outcomes - only 10% of scenarios are worse.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              <h4 className="font-semibold">Inflation Adjustment</h4>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              The rate at which the cost of goods increases over time. Inflation erodes purchasing power, so withdrawal amounts should increase annually (typically 2-3%) to maintain your standard of living.
            </p>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Best Practices */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
      >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Best Practices & Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Use Conservative Assumptions</p>
              <p className="text-muted-foreground">
                It's better to be pleasantly surprised by exceeding your goals than to fall short. Consider using lower return estimates (6-7% instead of 10%) for more realistic planning.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Account for Inflation</p>
              <p className="text-muted-foreground">
                Always adjust for inflation, especially in withdrawal planning. A dollar today won't buy the same amount in 20 years. Use 2-3% as a standard inflation estimate.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Understand the Limitations</p>
              <p className="text-muted-foreground">
                This tool uses simplified models. Real markets have crashes, recoveries, and sequence-of-returns risk. Past performance doesn't guarantee future results. Consider consulting a financial advisor.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Focus on What You Control</p>
              <p className="text-muted-foreground">
                You can't control market returns, but you can control: contribution amounts, spending rates, asset allocation, and time horizon. Adjust these to improve your outcomes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
            <Dices className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Use Monte Carlo for Reality Checks</p>
              <p className="text-muted-foreground">
                If your plan only works in the best 25% of scenarios, it's too risky. Aim for plans that succeed in 80-90% of Monte Carlo simulations to have adequate margin of safety.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Install on iPhone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
      <Card className="border-gray-300 bg-white dark:bg-zinc-900 dark:border-zinc-700"> {/* White background, light gray border */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white"> {/* Dark text for title/icon */}
            <Smartphone className="h-5 w-5" /> 
            Install on iPhone Home Screen
          </CardTitle>
          <CardDescription className="text-gray-700 dark:text-gray-300"> {/* Dark gray description */}
            Add this app to your iPhone for quick access like a native app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              {/* Dark gray circle, white number */}
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">1</span>
              <div>
                <p className="font-semibold text-foreground dark:text-white">Open in Safari</p>
                <p className="text-muted-foreground">Make sure you're viewing this page in Safari browser</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              {/* Dark gray circle, white number */}
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">2</span>
              <div>
                <p className="font-semibold flex items-center gap-2 text-foreground dark:text-white">
                  Tap the Share button <Share className="h-4 w-4" />
                </p>
                <p className="text-muted-foreground">Located at the bottom of the screen (square with arrow pointing up)</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              {/* Dark gray circle, white number */}
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">3</span>
              <div>
                <p className="font-semibold flex items-center gap-2 text-foreground dark:text-white">
                  Select "Add to Home Screen" <Plus className="h-4 w-4" />
                </p>
                <p className="text-muted-foreground">Scroll down in the share menu to find this option</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              {/* Dark gray circle, white number */}
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold shrink-0 dark:bg-gray-700">4</span>
              <div>
                <p className="font-semibold text-foreground dark:text-white">Confirm and Add</p>
                <p className="text-muted-foreground">You can customize the name, then tap "Add" in the top right</p>
              </div>
            </li>
          </ol>
          {/* Light gray box, dark gray text */}
          <div className="mt-4 p-3 bg-gray-100 rounded-lg dark:bg-zinc-800"> 
            <p className="text-xs text-gray-700 dark:text-gray-300">
              🎉 Once installed, you can launch Portfolio Simulator directly from your home screen like any other app and saves your parameters when you close the app!
            </p>
          </div>
        </CardContent>
      </Card>
      </motion.div>
	  
      {/* Install on Android */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05 }}
      >
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
            Install on Android Home Screen
          </CardTitle>
          <CardDescription>
            Add this app to your Android device for quick access like a native app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">1</span>
              <div>
                <p className="font-semibold">Open in Chrome</p>
                <p className="text-muted-foreground">Android PWA installs work best in Chrome</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">2</span>
              <div>
                <p className="font-semibold flex items-center gap-2">Tap the Menu button •••</p>
                <p className="text-muted-foreground">Located in the top right corner</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">3</span>
              <div>
                <p className="font-semibold">Select "Add to Home screen" or "Install App"</p>
                <p className="text-muted-foreground">The option name depends on your Android version</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">4</span>
              <div>
                <p className="font-semibold">Confirm installation</p>
                <p className="text-muted-foreground">The app icon will appear on your home screen instantly</p>
              </div>
            </li>
          </ol>

          <div className="mt-4 p-3 bg-background/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              🎉 Android installation fully supports native full screen app experience.
            </p>
          </div>
        </CardContent>
      </Card>
      </motion.div>
	  
      {/* Install on Chrome Desktop */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Install on Chrome Desktop
          </CardTitle>
          <CardDescription>
            Install this app on your Windows, Mac, or Linux desktop using Google Chrome
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <p className="font-semibold">Look for the Install Icon</p>
                <p className="text-muted-foreground">A small computer-with-arrow icon appears in the address bar</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">3</span>
              <div>
                <p className="font-semibold">Click "Install"</p>
                <p className="text-muted-foreground">Chrome will create a standalone app window on your desktop</p>
              </div>
            </li>
          </ol>

          <div className="mt-4 p-3 bg-background/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              💻 Desktop installation gives you a distraction-free windowed version of Portfolio Simulator.
            </p>
          </div>
        </CardContent>
      </Card>
	  </motion.div>

      {/* Install on Microsoft Edge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.35 }}
      >
      <Card className="border-cyan-500/30 bg-cyan-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Laptop className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            Install on Microsoft Edge
          </CardTitle>
          <CardDescription>
            Install the app on Windows using Microsoft Edge for full PWA support
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <p className="font-semibold">Click the App Icon</p>
                <p className="text-muted-foreground">Located in the top right of the address bar</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600 text-white text-xs font-bold shrink-0">3</span>
              <div>
                <p className="font-semibold">Choose "Install"</p>
                <p className="text-muted-foreground">Edge installs Portfolio Simulator as a native-style Windows app</p>
              </div>
            </li>
          </ol>

          <div className="mt-4 p-3 bg-background/50 rounded-lg rounded">
            <p className="text-xs text-muted-foreground">
              🖥️ Edge PWAs automatically appear in the Start Menu for easy access.
            </p>
          </div>
        </CardContent>
      </Card>
	  </motion.div>

      {/* Install on Mozilla Firefox */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
      >
        <Card className="border-[#FF7139]/30 bg-[#FF7139]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LaptopMinimalCheck className="h-5 w-5 text-[#FF7139]" />
              Install on Firefox (Windows)
            </CardTitle>
            <CardDescription>
              Install this app as a standalone window on Windows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7139] text-white text-xs font-bold shrink-0">1</span>
                <div>
                  <p className="font-semibold">Open in Firefox</p>
                  <p className="text-muted-foreground">This feature is currently available on Firefox for Windows</p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7139] text-white text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="font-semibold">Open the Menu</p>
                  <p className="text-muted-foreground">Click the three lines (≡) in the top right corner</p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FF7139] text-white text-xs font-bold shrink-0">3</span>
                <div>
                  <p className="font-semibold">Select "Install" or "Use as App"</p>
                  <p className="text-muted-foreground">This will pin the app to your taskbar in its own window</p>
                </div>
              </li>
            </ol>

            <div className="mt-4 p-3 bg-background/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                🦊 <strong>Mac & Linux users:</strong> Firefox does not support app installation on your platform yet. Please use Chrome or Edge for the best experience.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Install on Brave */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.65 }}
      >
        <Card className="border-[#FB542B]/30 bg-[#FB542B]/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LaptopMinimalCheck className="h-5 w-5 text-[#FB542B]" />
              Install on Brave
            </CardTitle>
            <CardDescription>
              Install this app as a Brave desktop application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FB542B] text-white text-xs font-bold shrink-0">1</span>
                <div>
                  <p className="font-semibold">Open in Brave browser</p>
                  <p className="text-muted-foreground">Use Brave on Windows, macOS, or Linux</p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FB542B] text-white text-xs font-bold shrink-0">2</span>
                <div>
                  <p className="font-semibold">Open the browser menu</p>
                  <p className="text-muted-foreground">Click the Brave menu and look for "Apps" or "Install Portfolio Simulator"</p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#FB542B] text-white text-xs font-bold shrink-0">3</span>
                <div>
                  <p className="font-semibold">Click "Install"</p>
                  <p className="text-muted-foreground">Brave will create a separate app style window on your desktop</p>
                </div>
              </li>
            </ol>

            <div className="mt-4 p-3 bg-background/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                🦁 Brave uses the same PWA install flow as Chromium browsers while keeping your privacy features.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8 }}
      >
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Important Disclaimer
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            This Portfolio Growth Simulator is an educational tool designed to help you understand investment concepts and plan scenarios. It is <strong>not financial advice</strong> and should not be your only resource for making investment decisions.
          </p>
          <p>
            The calculations and projections are based on simplified models and assumptions that may not reflect real market conditions. Actual investment returns can be significantly higher or lower due to market volatility, economic conditions, fees, taxes, and other factors.
          </p>
          <p>
            <strong>Past performance does not guarantee future results.</strong> All investments involve risk, including the potential loss of principal. Before making any financial decisions, please consult with a qualified financial advisor who can assess your individual situation.
          </p>
        </CardContent>
      </Card>
	  </motion.div>

      {/* Donation Section */}
      <DonationSection />
    </div>
  )
}