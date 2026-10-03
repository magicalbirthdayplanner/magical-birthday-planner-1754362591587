// Node.js runtime Sentry init (loaded from instrumentation.ts). No DSN → disabled.
import * as Sentry from '@sentry/nextjs'
import { sentryOptions } from '@/lib/observability/sentry-options'

Sentry.init(sentryOptions('server', process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN))
