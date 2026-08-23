'use client'

import Image from 'next/image'
import Link from 'next/link'
import { RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5">
          <Image src="/favicon.svg" alt="" width={32} height={32} />
        </div>
        <p className="text-sm font-medium text-amber-500">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">The calculation could not finish.</h1>
        <p className="mt-3 text-muted-foreground">Try the page again. If the problem continues, return to the simulator and re-enter the scenario.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}><RefreshCw className="mr-2 h-4 w-4" />Try Again</Button>
          <Button asChild variant="outline"><Link href="/"><Home className="mr-2 h-4 w-4" />Simulator</Link></Button>
        </div>
      </div>
    </main>
  )
}
