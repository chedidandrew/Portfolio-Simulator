import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5">
          <Image src="/favicon.svg" alt="" width={32} height={32} />
        </div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">This scenario took an unexpected path.</h1>
        <p className="mt-3 text-muted-foreground">The page you requested does not exist or may have moved. Your saved calculator data has not been changed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Simulator</Link></Button>
          <Button asChild variant="outline"><Link href="/tools"><Compass className="mr-2 h-4 w-4" />Financial Tools</Link></Button>
        </div>
      </div>
    </main>
  )
}
