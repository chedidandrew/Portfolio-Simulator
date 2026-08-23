import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t bg-background/80 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>Portfolio Simulator is an educational scenario modeling tool.</p>
        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/loan" className="transition-colors hover:text-foreground">
            Loan Calculator
          </Link>
          <Link href="/methodology" className="transition-colors hover:text-foreground">
            Methodology
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <a
            href="https://buymeacoffee.com/chedidandrew"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  )
}
