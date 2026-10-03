'use client'

/** Last-resort error page (root layout failed). Never shows error details to users. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  if (typeof console !== 'undefined') console.error('global error', error.digest ?? '')
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#fbf8f3', color: '#221b3a', fontFamily: 'Nunito, ui-rounded, system-ui, -apple-system, Segoe UI, sans-serif' }}>
        <main style={{ maxWidth: 360, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 20px', color: '#6b6480' }}>Please try again. If it keeps happening, come back in a few minutes.</p>
          <button type="button" onClick={() => reset()} style={{ minHeight: 48, padding: '0 24px', borderRadius: 999, border: 0, background: '#5b2fb8', color: '#fff', fontSize: 16, fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
