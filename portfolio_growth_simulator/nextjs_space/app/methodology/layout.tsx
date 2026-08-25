import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Methodology & Model Assumptions',
  description: 'Review the formulas, timing rules, tax treatments, Monte Carlo assumptions, validation limits, and limitations used by Portfolio Simulator.',
  alternates: { canonical: '/methodology' },
  openGraph: {
    title: 'Portfolio Simulator Methodology & Model Assumptions',
    description: 'A transparent explanation of Portfolio Simulator calculations, assumptions, and limitations.',
    url: '/methodology',
    images: ['/og-image.png'],
  },
}

export default function MethodologyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div
        data-testid="methodology-safe-area"
        aria-hidden="true"
        className="bg-background print:hidden"
        style={{ height: 'var(--safe-area-top, env(safe-area-inset-top, 0px))' }}
      />
      {children}
    </>
  )
}
