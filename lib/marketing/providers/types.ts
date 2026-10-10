/**
 * MarketingProvider: one interface per social channel (X today; Instagram, Facebook, Reddit, LinkedIn later).
 * The pipeline only talks to this interface — adding a channel = one new provider + its registry entry.
 */
import type { XMeter } from '../budget'
import type { Platform, PlatformMetrics, PollSpec } from '../types'

export interface MediaInput { bytes: Uint8Array; mimeType: string; altText?: string | null }
export interface PublishInput {
  text: string
  /** Up to 4 images, or exactly one video. */
  media?: MediaInput[] | MediaInput | null
  poll?: PollSpec | null
  /** Further parts of a thread, posted as replies to the first post (and to each other). */
  thread?: string[] | null
  /** Spend an extra call per image on alt text. */
  altText?: boolean
}
export interface PublishResult { externalId: string; url: string; mediaId: string | null; mediaIds?: string[]; threadIds?: string[]; mediaError?: string | null }
/** accessLevel: X's x-access-level header ('read' | 'read-write' | …); posting needs 'read-write'. */
export interface AccountInfo { id: string; username: string; name: string | null; accessLevel?: string | null }
export interface OwnPost { id: string; text: string; createdAt: string | null; metrics: PlatformMetrics }

export type MarketingErrorKind =
  | 'not_configured' | 'auth' | 'forbidden' | 'rate_limited' | 'duplicate' | 'invalid' | 'payment_required' | 'unavailable' | 'timeout' | 'unknown'

/**
 * `unconfirmed` = the request may have reached the platform (timeout or network error after sending): the post MUST NOT
 * be retried automatically, because it could already be live.
 */
export class MarketingProviderError extends Error {
  constructor(public kind: MarketingErrorKind, message: string, public status?: number, public unconfirmed = false, public retryAfterSec?: number) {
    super(message)
    this.name = 'MarketingProviderError'
  }
}

export interface MarketingProvider {
  readonly platform: Platform
  /** Weighted characters allowed per post for this account. */
  readonly maxChars: number
  configured(): boolean
  /** Every billable request is reported here (budget ledger). */
  setMeter(meter: XMeter | null): void
  verify(): Promise<AccountInfo>
  uploadImage(media: MediaInput, altText?: boolean): Promise<string>
  uploadVideo(media: MediaInput): Promise<string>
  createPost(input: { text: string; mediaIds?: string[]; poll?: PollSpec | null; replyTo?: string | null }): Promise<{ externalId: string; url: string }>
  /** Upload (if any) then post (and thread replies). If an image upload fails the text is still posted (mediaError says why). */
  publish(input: PublishInput): Promise<PublishResult>
  /** Metrics for up to 100 posts by id (paid "post read" per post); ids the platform did not return are missing. */
  getMetrics(externalIds: string[]): Promise<Map<string, PlatformMetrics>>
  /** The account's own posts in a time window (cheaper "owned read" per post), with metrics. */
  getOwnPosts(userId: string, opts: { startTime?: string; endTime?: string; maxResults?: number }): Promise<OwnPost[]>
}
