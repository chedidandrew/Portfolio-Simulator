import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, HardDrive, Link2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Portfolio Simulator handles calculator inputs, browser storage, shared links, analytics, and external support links.',
  alternates: { canonical: 'https://portfoliosimulator.org/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" className="-ml-3 gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Simulator
          </Link>
        </Button>

        <header className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy</h1>
          <p className="text-muted-foreground">
            Portfolio Simulator is designed to keep your scenario inputs in your browser unless you choose to share them.
          </p>
          <p className="text-xs text-muted-foreground">Last updated August 23, 2026.</p>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <HardDrive className="h-5 w-5 text-primary" aria-hidden="true" />
              Calculator data and browser storage
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Growth, withdrawal, loan, payoff-goal, refinance, invest-versus-debt, display, and simulation inputs are processed in your browser. Portfolio Simulator uses browser local storage for selected calculator settings and preferences so they can persist between visits.
            </p>
            <p>
              The financial tools keep a shared local loan profile for values such as balance, APR, remaining term, first payment month, recurring extra payment, and one-time principal payments. Tool-specific inputs such as a payoff target, refinance proposal, and investment assumptions are also stored locally so moving between financial tools or returning later does not require re-entering the scenario. Results are recalculated in the browser from those saved inputs rather than stored in an application database.
            </p>
            <p>
              The application does not require a user account and does not maintain an application database of your portfolio, loan, refinance, or comparison scenarios. The main simulator Reset option clears simulator-owned browser storage. Financial-tool settings also include a dedicated reset that restores the saved financial profile and financial-tool inputs to defaults while leaving theme and display-currency preferences intact.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Shared scenario links
            </h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              When you deliberately create a share link, the selected portfolio or loan scenario inputs are encoded into the URL fragment after the # symbol. URL fragments are normally not sent to the web server as part of an HTTP request, but they can be read by code running in the browser.
            </p>
            <p>
              A share link is not encrypted. Anyone who receives the complete link can decode the scenario values it contains, so review a link before posting it publicly and do not put sensitive identifiers such as account numbers, loan account numbers, or Social Security numbers into a scenario.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><h2 className="text-lg font-semibold">Hosting and analytics</h2></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Portfolio Simulator is hosted by Vercel and uses Vercel Web Analytics. As part of providing hosting and analytics services, Vercel may process ordinary traffic and service data such as IP address, browser or device information, approximate location derived from IP address, pages viewed, timestamps, and related telemetry.
            </p>
            <p>
              Calculator scenario values are not intentionally sent to Vercel Analytics by Portfolio Simulator. Standard web hosting requests and service logs are still handled by Vercel.
            </p>
            <a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline">
              Read Vercel&apos;s Privacy Notice
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><h2 className="text-lg font-semibold">External support services</h2></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>Support links can open third-party services such as Buy Me a Coffee, Venmo, Cash App, PayPal, or a Bitcoin wallet. If you choose to use one of those services, its own privacy policy and terms apply.</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 text-sm leading-relaxed text-muted-foreground">
            <p>Portfolio Simulator is an educational modeling tool. It does not ask for login credentials, brokerage credentials, bank account numbers, loan account numbers, or government identification numbers. Avoid entering information that you would not want stored locally on your device or included in a shared scenario link.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
