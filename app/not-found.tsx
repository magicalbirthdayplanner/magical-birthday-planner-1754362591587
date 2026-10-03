import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mbp-app flex min-h-dvh flex-col items-center justify-center bg-magic px-6 text-center">
      <p className="text-5xl" aria-hidden>
        🎈
      </p>
      <h1 className="mt-4 font-display text-3xl font-extrabold">This page floated away</h1>
      <p className="mt-2 text-muted-foreground">The link may be old or mistyped.</p>
      <Link href="/home" className="tap mt-6 inline-flex h-12 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground">
        Back to planning
      </Link>
    </div>
  )
}
