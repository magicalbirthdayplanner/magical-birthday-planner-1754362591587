const { withSentryConfig } = require('@sentry/nextjs/config')

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Never framed (clickjacking on login/checkout); no plugins or <base> hijacking.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
]

const nextConfig = {
  // Separate output dir lets E2E builds (local keys) coexist with production builds.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  images: { unoptimized: true },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }] },
      // Photo redirects and ZIP lookups set their own public caching.
      { source: '/api/:path((?!discovery/photo|discovery/zip).*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  }
};

// Sentry: source maps are uploaded at build time only when SENTRY_AUTH_TOKEN is set (Vercel build env), then
// deleted from the output, so no .map file is ever served. Without the token the build still succeeds (no upload).
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || 'magical-birthday-planner',
  project: process.env.SENTRY_PROJECT || 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI && !process.env.VERCEL,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
  widenClientFileUpload: false,
  telemetry: false,
  webpack: { treeshake: { removeDebugLogging: true }, automaticVercelMonitors: false },
});
