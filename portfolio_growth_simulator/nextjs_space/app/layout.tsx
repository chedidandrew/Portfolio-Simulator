import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import './mobile-chart-tooltips.css'
import 'katex/dist/katex.min.css'
import { ThemeProvider } from '@/components/theme-provider'
import { CurrencyProvider } from '@/components/currency-provider'
import Script from 'next/script'
import Image from 'next/image'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { SimulationProgressHost } from '@/components/monte-carlo/simulation-progress-overlay'
import { MobileChartTooltipLayout } from '@/components/mobile-chart-tooltip-layout'
import { UrlOnlyShareGuard } from '@/components/url-only-share-guard'
import { SiteFooter } from '@/components/site-footer'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://portfoliosimulator.org'),
  title: {
    default: 'Portfolio Simulator | Growth, Monte Carlo, & Withdrawal Calculator',
    template: '%s | Portfolio Simulator',
  },
  description: 'Free portfolio simulator for growth and withdrawal strategies. Run Monte Carlo simulations, calculate compound interest, and test withdrawal sustainability.',
  alternates: { canonical: 'https://portfoliosimulator.org' },
  robots: { index: true, follow: true },
  keywords: ['portfolio simulator', 'monte carlo simulation', 'retirement calculator', 'investment growth', 'fire calculator', 'safe withdrawal rate'],
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  openGraph: {
    title: 'Portfolio Simulator | Growth, Monte Carlo, & Withdrawal Calculator',
    description: 'Free portfolio simulator for growth and withdrawal strategies. Run Monte Carlo simulations, calculate compound interest, and test withdrawal sustainability.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Portfolio Sim',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Portfolio Simulator',
    image: 'https://portfoliosimulator.org/og-image.png',
    url: 'https://portfoliosimulator.org',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Monte Carlo Simulation',
      'Portfolio Growth Calculator',
      'Withdrawal Sustainability Analysis',
      'Sequence of Returns Risk',
      'Loan and Amortization Calculator',
      'Target Loan Payoff Planning',
      'Refinance Cost Comparison',
      'Invest vs. Debt Payoff Comparison',
    ],
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="color-scheme" content="light dark" />
        <meta name="forced-color-adjust" content="none" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <CurrencyProvider>
            <header className="print-header">
              <Image
                src="/favicon.png"
                alt="Portfolio Simulator"
                width={24}
                height={24}
                style={{ borderRadius: 6 }}
              />
              <span className="print-header__title">Portfolio Simulator</span>
            </header>
            {children}
            <SiteFooter />
            <Toaster />
            <PwaInstallPrompt />
            <SimulationProgressHost />
            <MobileChartTooltipLayout />
            <UrlOnlyShareGuard />
          </CurrencyProvider>
        </ThemeProvider>
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  const isLocalDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
                  if (isLocalDevelopment) {
                    navigator.serviceWorker.getRegistrations()
                      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                      .catch(() => {});
                    if ('caches' in window) {
                      caches.keys()
                        .then((keys) => Promise.all(keys.filter((key) => key.startsWith('portfolio-simulator-')).map((key) => caches.delete(key))))
                        .catch(() => {});
                    }
                    return;
                  }
                  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
                });
              }
            `,
          }}
        />
        <Analytics />
      </body>
    </html>
  )
}
