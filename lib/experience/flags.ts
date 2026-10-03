/**
 * The Party Experience UI (Activities tab, Party Magic hub, timeline/menu/host on Plan) ships dark: it appears only
 * when NEXT_PUBLIC_EXPERIENCE_ENABLED=true at build time. Its AI pieces additionally need their AI_ENABLED_FEATURES
 * flags and the right plan, enforced on the server.
 */
export const EXPERIENCE_ENABLED = process.env.NEXT_PUBLIC_EXPERIENCE_ENABLED === 'true'
