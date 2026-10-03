/** Client-safe result type for discover_explain (the feature module itself is server-only). */
export interface DiscoverExplainResult { picks: { id: string; placeId: string; name: string; reason: string }[] }
