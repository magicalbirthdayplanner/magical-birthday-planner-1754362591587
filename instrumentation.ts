import * as Sentry from '@sentry/nextjs'

// Node.js runtime only: the app has no middleware and no edge routes.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
}

// Uncaught errors in route handlers, server components and server actions → Sentry.
export const onRequestError = Sentry.captureRequestError
