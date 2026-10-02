/**
 * The Ideavo builder's helper scripts (iframe navigation + ideavo.min.js) are only
 * for the builder's own preview. Vercel sets VERCEL_ENV on every deployment
 * (preview and production), where an unpinned third-party script must not run
 * alongside user sessions.
 */
export const builderScriptsEnabled = (env: Record<string, string | undefined> = process.env) => !env.VERCEL_ENV
