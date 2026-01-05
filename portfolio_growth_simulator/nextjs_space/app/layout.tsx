import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import Script from 'next/script'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'

const inter = Inter({ subsets: ['latin'] })

export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // This sets viewport-fit=cover
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
  description: 'Free portfolio simulator for growth and withdrawal strategies. Run Monte Carlo simulations, calculate compound interest, and test safe withdrawal rates.',
  keywords: ['portfolio simulator', 'monte carlo simulation', 'retirement calculator', 'investment growth', 'fire calculator', 'safe withdrawal rate'],
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: 'Portfolio Simulator | Growth, Monte Carlo, & Withdrawal Calculator',
    description: 'Free portfolio simulator for growth and withdrawal strategies. Run Monte Carlo simulations, calculate compound interest, and test safe withdrawal rates.',
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
    name: 'Portfolio Growth Simulator',
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
      'Safe Withdrawal Rate Analysis',
      'Sequence of Returns Risk',
    ],
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
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
        enableSystem={false}
        disableTransitionOnChange
      >
        {/* Print only header */}
        <header className="print-header">
          <img
            src="/favicon.png"
            alt="Portfolio Simulator"
            width={24}
            height={24}
            style={{ borderRadius: 6 }}
          />
          <span className="print-header__title">Portfolio Simulator</span>
        </header>
        {children}
        <PwaInstallPrompt />
      </ThemeProvider>
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/service-worker.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}