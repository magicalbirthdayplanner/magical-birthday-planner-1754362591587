/** Client-safe types for host_content (the feature module itself is server-only). */
export type HostKind = 'welcome' | 'activity_intro' | 'cake' | 'closing' | 'thank_you_all' | 'thank_you_guest' | 'reminder'
export interface HostItem { id: string; kind: HostKind; title: string; body: string; activityId: string | null; guestId: string | null; guestName: string | null }
export interface HostResult { kind: HostKind; items: HostItem[] }
