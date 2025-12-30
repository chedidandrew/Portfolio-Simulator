'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Dices,
  BookOpen,
  ChevronDown,
  Percent,
  Scale,
  HelpCircle,
  AlertTriangle,
  FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import 'katex/dist/katex.min.css'
import { BlockMath } from 'react-katex'
import { DonationSection } from '@/components/donation-section'

// --- 1. Reusing Animation Variants from GuideTab ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
}

// --- 2. Reusing the GuideSection Component for consistency ---
function MethodologySection({ 
  title, 
  icon: Icon, 
  description, 
  children, 
  defaultOpen = false,
  className,
  headerClassName,
  iconColorClass = "text-foreground", 
  iconWrapperClass = "bg-muted text-muted-foreground group-hover:bg-muted/80" 
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
      <Card className={cn(
        "border-l-4 transition-all duration-300 shadow-sm",
        "bg-gradient-to-br from-card to-muted/5", // Subtle gradient for depth
        isOpen 
          ? "border-l-primary/50 shadow-md ring-1 ring-primary/5" 
          : "border-l-transparent hover:border-l-muted/30 hover:shadow-md",
        className
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className={cn("cursor-pointer py-5 select-none", headerClassName)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg transition-colors duration-300 shadow-sm", 
                  iconWrapperClass
                )}>
                  <Icon className={cn("h-5 w-5", iconColorClass)} />
                </div>
                <div className="space-y-1 text-left">
                  <CardTitle className="text-lg leading-none text-foreground">{title}</CardTitle>
                  {description && <CardDescription>{description}</CardDescription>}
                </div>
              </div>
              <div className={cn(
                "p-1 rounded-full border transition-all duration-300",
                isOpen ? "bg-muted text-foreground rotate-180 shadow-inner" : "bg-transparent text-muted-foreground border-transparent group-hover:border-border"
              )}>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
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

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-4xl space-y-6 pb-8"
      >
        
        {/* Header Section */}
        <motion.div variants={itemVariants} className="space-y-4">
          <Link href="/">
            <Button variant="ghost" className="pl-0 hover:pl-2 transition-all gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Simulator
            </Button>
          </Link>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent sm:text-4xl">
              Methodology & Logic
            </h1>
            <p className="text-xl text-muted-foreground">
              A transparent look at the math, formulas, and assumptions driving your simulation.
            </p>
          </div>
        </motion.div>

        {/* Core Philosophy Card */}
        <motion.div variants={itemVariants}>
          <Card className="border-l-4 border-l-primary bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Scale className="h-5 w-5 shrink-0" />
                Core Philosophy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-foreground/80">
                Portfolio Simulator uses industry standard growth math while you are building wealth. 
                Once withdrawals begin, it shifts to a more conservative modeling approach designed 
                to test sustainability under adverse conditions rather than maximize projections.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* 1. Growth Phase */}
        <motion.div variants={itemVariants}>
          <MethodologySection 
            title="Growth Phase (Accumulation)" 
            icon={TrendingUp} 
            description="How Portfolio Simulator calculates wealth building"
            defaultOpen={true}
            iconColorClass="text-emerald-500"
            iconWrapperClass="bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20"
            className="border-emerald-500/20"
          >
            {/* CHANGED: Removed md:grid-cols-2 to force vertical stacking */}
            <div className="grid gap-6">
              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  The Math: Nominal vs. Effective
                </div>
                <p className="text-sm leading-relaxed">
                  The simulator supports two calculation modes. <strong>Effective (APY)</strong> ensures your annual result matches your input exactly. <strong>Nominal (APR)</strong> simply divides the rate by 12, which results in slightly higher returns due to monthly compounding.
                </p>

                <div className="p-3 bg-background/50 rounded-md border border-border/50">
                  <p className="text-xs font-semibold text-foreground mb-1">Which should I use?</p>
                  <p className="text-xs text-muted-foreground overflow-x-auto">
                    Stick with <strong>Effective (Default)</strong>. This matches how investment returns (CAGR) are typically quoted. Only use Nominal if you are modeling a debt payoff (like a mortgage) calculated as APR.
                  </p>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-background/40 px-3 py-2">
                    <p className="text-xs text-center text-muted-foreground mb-1">Effective (Default)</p>
                    <BlockMath math={String.raw`r_m = (1 + r_{\text{annual}})^{\tfrac{1}{12}} - 1`} />
                  </div>
                  
                  <div className="rounded-md border bg-background/40 px-3 py-2">
                    <p className="text-xs text-center text-muted-foreground mb-1 overflow-x-auto">Nominal (Advanced Settings)</p>
                    <BlockMath math={String.raw`r_m = \frac{r_{\text{annual}}}{12}`} />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Timing: End-of-Month
                </div>
                <p className="text-sm leading-relaxed">
                  Growth assumes you contribute money at the <strong>end</strong> of the month. This means your new contributions don't earn interest in the very first month they are added.
                </p>
                <Badge variant="outline" className="mt-1 text-emerald-600 border-emerald-500/30">
                  Prevents Over-Estimation
                </Badge>
              </div>
            </div>
          </MethodologySection>
        </motion.div>

        {/* 2. Withdrawal Phase */}
        <motion.div variants={itemVariants}>
          <MethodologySection 
            title="Withdrawal Phase (Decumulation)" 
            icon={TrendingDown} 
            description="How Portfolio Simulator helps your money last"
            defaultOpen={false}
            iconColorClass="text-blue-500"
            iconWrapperClass="bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20"
            className="border-blue-500/20"
          >
            {/* CHANGED: Removed md:grid-cols-2 to force vertical stacking */}
            <div className="grid gap-6">
              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Calculator className="h-4 w-4 text-blue-500" />
                  The Math: Nominal vs. Effective
                </div>
                <p className="text-sm leading-relaxed">
                  Just like growth, withdrawals support two modes. <strong>Effective (APY)</strong> pays out interest based on strict annual equivalence. <strong>Nominal (APR)</strong> uses a simple division by 12, often resulting in slightly different monthly interest credits.
                </p>

                <div className="p-3 bg-background/50 rounded-md border border-border/50">
                  <p className="text-xs font-semibold text-foreground mb-1">Which should I use?</p>
                  <p className="text-xs text-muted-foreground">
                    Stick with <strong>Effective (Default)</strong>. This matches how investment returns (CAGR) are typically quoted. Only use Nominal if you are modeling a debt payoff (like a mortgage) calculated as APR.
                  </p>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border bg-background/40 px-3 py-2">
                    <p className="text-xs text-center text-muted-foreground mb-1 overflow-x-auto">Effective (Default)</p>
                    <BlockMath math={String.raw`r_m = (1 + r_{\text{annual}})^{\tfrac{1}{12}} - 1`} />
                  </div>
                  
                  <div className="rounded-md border bg-background/40 px-3 py-2">
                    <p className="text-xs text-center text-muted-foreground mb-1 overflow-x-auto">Nominal (Advanced Settings)</p>
                    <BlockMath math={String.raw`r_m = \frac{r_{\text{annual}}}{12}`} />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Timing: Start-of-Month
                </div>
                <p className="text-sm leading-relaxed">
                  Withdrawals happen at the <strong>start</strong> of the month (like rent/mortgage). This money leaves your account <em>before</em> it earns interest for that month.
                </p>
                <Badge variant="outline" className="mt-1 text-blue-600 border-blue-500/30">
                  Conservative Stress Test
                </Badge>
              </div>
            </div>
          </MethodologySection>
        </motion.div>

        {/* 3. Inflation */}
        <motion.div variants={itemVariants}>
          <MethodologySection 
            title="Inflation & Real Value" 
            icon={DollarSign} 
            description="Calculating purchasing power in today's dollars"
            defaultOpen={false}
            iconColorClass="text-pink-500"
            iconWrapperClass="bg-pink-500/10 text-pink-500 group-hover:bg-pink-500/20"
            className="border-pink-500/20"
          >
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">
                $1 million in 30 years won't buy what $1 million buys today. Portfolio Simulator calculates two values simultaneously:
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                  <span className="font-semibold block mb-1 text-foreground">Nominal Value</span>
                  <span className="text-xs">The actual number written on the check in the future.</span>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg border border-border/50">
                  <span className="font-semibold block mb-1 text-foreground">Real Value (Adjusted)</span>
                  <span className="text-xs">What that check can actually buy in terms of today's goods.</span>
                </div>
              </div>

              <div className="mt-2 rounded-md border bg-background/40 px-4 py-3 flex justify-center overflow-x-auto">
                  <BlockMath math={String.raw`\text{Real Value} = \frac{\text{Future Value}}{(1 + \text{Inflation Rate})^{\text{Years}}}`} />
              </div>

              <div className="rounded-md bg-pink-500/10 p-3 border border-pink-500/20">
                <p className="text-xs text-foreground/90">
                  <strong>Note on Contributions:</strong> By default, the simulator assumes your monthly contributions (or withdrawals) increase annually to match the inflation rate. 
                  This models the real-world scenario where your salary (and savings capacity) tends to rise with the cost of living.
                </p>
              </div>
            </div>
          </MethodologySection>
        </motion.div>

        {/* 4. Monte Carlo */}
        <motion.div variants={itemVariants}>
          <MethodologySection 
            title="Monte Carlo Simulation" 
            icon={Dices} 
            description="Understanding volatility and risk"
            defaultOpen={false}
            iconColorClass="text-violet-500"
            iconWrapperClass="bg-violet-500/10 text-violet-500 group-hover:bg-violet-500/20"
            className="border-violet-500/20"
          >
              <div className="space-y-4">
              <p className="text-sm leading-relaxed">
                Standard calculators assume returns follow a straight line (e.g., 8% every year), which is not how the real world works. 
                The Monte Carlo simulation models this uncertainty by introducing <strong>volatility (Risk)</strong> and generating many possible return paths.
              </p>

              {/* Nominal vs Effective Explanation */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Calculator className="h-4 w-4 text-violet-500" />
                  The Math: Nominal vs. Effective
                </div>
                <p className="text-sm leading-relaxed">
                  The simulation relies on "Drift" μ to generate returns. <strong>Effective (Default)</strong> derives drift directly from your input, ensuring the median result matches your target. <strong>Nominal (APR)</strong> converts the rate to an Effective Annual Rate first.
                </p>

                <div className="p-3 bg-background/50 rounded-md border border-border/50">
                  <p className="text-xs font-semibold text-foreground mb-1">Which should I use?</p>
                  <p className="text-xs text-muted-foreground">
                    Stick with <strong>Effective (Default)</strong>. This guarantees that the "most likely" (median) outcome of the simulation aligns exactly with the return rate you entered.
                  </p>
                </div>
              </div>

              {/* The Formula Title and Block */}
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-violet-500" />
                    The Core Formula: Geometric Brownian Motion
                </h4>
                <div className="rounded-md border bg-background/40 px-4 py-3 flex justify-center overflow-x-auto">
                    <BlockMath
                        math={String.raw`V_{t+\Delta t}=V_t \cdot e^{\mu \Delta t + \sigma \sqrt{\Delta t}\, Z}`}
                    />
                </div>
              </div>

              {/* Translation for Retail Investors */}
                <div className="rounded-lg border bg-violet-500/5 border-violet-500/20 p-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-violet-700 dark:text-violet-300">
                        <HelpCircle className="h-4 w-4" />
                        Plain English Translation
                    </h4>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">Vₜ</span>
                        <span>
                        Your portfolio value at the start of the period (for example, this step).
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">Vₜ₊Δₜ</span>
                        <span>
                        Your portfolio value at the end of the period after growth and volatility are applied.
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">μ</span>
                        <span>
                        Your expected average annual return. <span className="text-muted-foreground italic">(Technically derived as the natural log of your input return: ln(1+r)).</span>
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">σ</span>
                        <span>
                        Volatility. This measures how wild the ups and downs are. Higher values mean bigger swings.
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">Δₜ</span>
                        <span>
                        Time step. In the simulator this is one calculation step (weekly, monthly, or annual), expressed as a fraction of a year.
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">Z</span>
                        <span>
                        A random number drawn from a normal distribution. This is what makes each step unpredictable.
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">Logic</span>
                        <span>
                        Each step starts with your expected growth, then randomness is added to simulate real market behavior.
                        </span>
                    </li>

                    <li className="flex gap-3">
                        <span className="font-bold text-foreground shrink-0 min-w-[3rem]">Result</span>
                        <span>
                        Running this thousands of times shows best-case, worst-case, and most-likely outcomes instead of a single straight-line forecast.
                        </span>
                    </li>
                    </ul>
                </div>
              <div className="grid gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">1</div>
                  <div>
                    <span className="font-medium text-foreground block text-sm">Random Walk</span>
                    <span className="text-xs mt-1">Portfolio Simulator runs 1,000+ different timelines. In some, the market crashes early; in others, it booms late.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">2</div>
                  <div>
                    <span className="font-medium text-foreground block text-sm">Sequence of Returns Risk</span>
                    <span className="text-xs mt-1">This reveals if your portfolio survives a market crash right when you retire, something a simple calculator cannot predict.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">3</div>
                  <div>
                    <span className="font-medium text-foreground block text-sm">Gaussian Distribution</span>
                    <p className="text-xs mt-1">
                        Portfolio Simulator uses a statistical model (Geometric Brownian Motion) to generate random step returns based on your inputs.{` `}
                        <a
                            href="https://en.wikipedia.org/wiki/Geometric_Brownian_motion"
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4 hover:opacity-80"
                        >
                            Learn more here.
                        </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500/10 text-violet-500 text-xs font-bold shrink-0 mt-0.5">4</div>
                  <div>
                    <span className="font-medium text-foreground block text-sm">Dynamic Fidelity</span>
                    <span className="text-xs mt-1">To ensure instant results, the engine intelligently switches between weekly, monthly, or annual calculation steps based on your simulation duration (Dynamic Time-Stepping).</span>
                  </div>
                </div>
              </div>
            </div>
          </MethodologySection>
        </motion.div>

        {/* 5. Taxes & Efficiency */}
        <motion.div variants={itemVariants}>
          <MethodologySection 
            title="Taxes & Efficiency" 
            icon={FileText} 
            description="How the simulator handles different tax environments"
            defaultOpen={false}
            iconColorClass="text-slate-500"
            iconWrapperClass="bg-slate-500/10 text-slate-500 group-hover:bg-slate-500/20"
            className="border-slate-500/20"
          >
            <div className="space-y-6">
              <p className="text-sm leading-relaxed">
                Taxes are calculated differently depending on the &quot;Tax Type&quot; you select in settings. 
                The simulator adapts its math to model how money leaves your account in each scenario.
              </p>

              {/* 1. Income Tax */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type 1:</span>
                  Income Tax (Tax Drag)
                </div>
                <p className="text-sm leading-relaxed">
                  Best for High Yield Savings Accounts (HYSA) or Bonds. Taxes are paid <strong>annually</strong> on the growth, which reduces the compounding effect.
                </p>
                
                <div className="p-3 bg-background/50 rounded-md border border-border/50 overflow-x-auto">
                  <p className="text-xs text-muted-foreground mb-2">
                    The simulator reduces your annual return rate effectively:
                  </p>
                  <BlockMath math={String.raw`r_{\text{after-tax}} = r_{\text{annual}} \times (1 - \text{Tax Rate})`} />
                </div>
              </div>

              {/* 2. Capital Gains */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type 2:</span>
                  Capital Gains (Brokerage)
                </div>
                <p className="text-sm leading-relaxed">
                  Best for Stock Portfolios. You only pay taxes when you <strong>sell</strong> (withdraw). 
                  The simulator tracks your &quot;Cost Basis&quot; (the money you already paid taxes on) vs. your &quot;Gains&quot;.
                </p>
                
                <div className="grid gap-2 sm:grid-cols-2">
                    <div className="p-3 bg-background/50 rounded-md border border-border/50 overflow-x-auto">
                        <p className="text-xs font-semibold text-foreground mb-1">During Growth</p>
                        <p className="text-xs text-muted-foreground">
                            0% tax is paid. Your money compounds tax-free until withdrawal.
                        </p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-md border border-border/50 overflow-x-auto">
                        <p className="text-xs font-semibold text-foreground mb-1">During Withdrawal</p>
                        <p className="text-xs text-muted-foreground">
                            Taxes are calculated <em>pro-rata</em> based on the ratio of profit to balance.
                        </p>
                    </div>
                </div>

                <div className="mt-2 rounded-md border bg-background/40 px-3 py-3 overflow-x-auto">
                   <p className="text-xs text-center text-muted-foreground mb-2">The Pro-Rata Formula used in withdrawals</p>
                   <BlockMath math={String.raw`\text{Tax} = \text{Withdrawal} \times \text{Tax Rate} \times \left( \frac{\text{Current Balance} - \text{Total Basis}}{\text{Current Balance}} \right)`} />
                </div>
              </div>

              {/* 3. Tax Deferred */}
              <div className="space-y-3 p-4 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type 3:</span>
                  Tax Deferred (401k / Traditional IRA)
                </div>
                <p className="text-sm leading-relaxed">
                  You pay 0% tax while growing, but every dollar withdrawn (both principal and interest) is taxed as income.
                </p>
                <div className="p-3 bg-background/50 rounded-md border border-border/50 overflow-x-auto">
                  <BlockMath math={String.raw`\text{Net Withdrawal} = \text{Gross Withdrawal} \times (1 - \text{Tax Rate})`} />
                </div>
              </div>

            </div>
          </MethodologySection>
        </motion.div>

        {/* 6. Limitations */}
        <motion.div variants={itemVariants}>
            <MethodologySection 
                title="Assumptions & Limitations" 
                icon={AlertTriangle} 
                description="Important constraints to keep in mind"
                defaultOpen={false}
                iconColorClass="text-amber-500"
                iconWrapperClass="bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20"
                className="border-amber-500/20"
            >
                <ul className="list-disc pl-5 space-y-2 text-foreground/80">
                <li>
                    <strong>Taxes:</strong> Simulations can optionally include tax modeling, but they are simplified and may not match your exact real-world tax situation.
                </li>
                <li>
                    <strong>Inflation on Cashflows:</strong> The simulator assumes your monthly contributions/withdrawals grow annually by the inflation rate to maintain purchasing power, unless disabled in settings.
                </li>
                <li>
                    <strong>Rebalancing:</strong> The model assumes your portfolio maintains its target allocation and volatility profile constantly without rebalancing fees.
                </li>
                </ul>
            </MethodologySection>
        </motion.div>
        <DonationSection />
      </motion.div>
    </div>
  )
}