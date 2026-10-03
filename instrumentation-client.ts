// Browser Sentry init (Next.js loads this file before the app hydrates). No DSN → disabled.
import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/observability/sentry-options'

Sentry.init(sentryOptions('client', process.env.NEXT_PUBLIC_SENTRY_DSN))

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
