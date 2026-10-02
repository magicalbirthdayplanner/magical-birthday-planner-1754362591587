import { NextRequest } from 'next/server';
import { safeJson } from '@/lib/server/safe-json';
import { searchVenues, SearchParams } from '@/lib/google-places';
import { guardPaidLegacyRoute } from '@/lib/server/legacy-guard';
import { normalizeZip } from '@/lib/geo/zip';
import { snapRadius } from '@/lib/discovery/config';

// Never cache upstream fetches (Supabase, Google, Dodo) in this handler.
export const fetchCache = "force-no-store";

const CATEGORIES = ['indoor', 'outdoor', 'specialty', 'community'] as const;
const SORTS = ['distance', 'rating', 'name', 'reviews'] as const;

/**
 * Legacy planner venue search (legacy Google Places). Signed-in users only, rate
 * limited and charged to the shared Google budget (1 geocode + up to 9 searches);
 * inputs normalized so arbitrary values can't mint new cache keys.
 */
async function handle(request: NextRequest, raw: Record<string, unknown>) {
  const guard = await guardPaidLegacyRoute(request, { key: 'venues-search', perMinute: 10, googleCalls: 10 });
  if (guard.error) return guard.error;

  const zipCode = normalizeZip(typeof raw.zipCode === 'string' ? raw.zipCode : null);
  if (!zipCode) return safeJson({ error: 'Please enter a 5-digit US ZIP code.' }, { status: 400 });
  const category = raw.category as SearchParams['category'];
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return safeJson({ error: 'Valid category is required (indoor, outdoor, specialty, community)' }, { status: 400 });
  }
  const minRating = Number(raw.minRating);
  const sortBy = SORTS.includes(raw.sortBy as (typeof SORTS)[number]) ? (raw.sortBy as SearchParams['sortBy']) : 'distance';
  const searchQuery = typeof raw.searchQuery === 'string' ? raw.searchQuery.trim().slice(0, 80) : '';

  const params: SearchParams = {
    zipCode,
    category,
    radius: snapRadius(raw.radius ?? 20),
    minRating: Number.isFinite(minRating) && minRating > 0 ? Math.min(5, minRating) : undefined,
    searchQuery: searchQuery || undefined,
    sortBy,
  };

  try {
    const venues = await searchVenues(params);
    return safeJson({ success: true, venues, total: venues.length, searchParams: params });
  } catch (error) {
    console.error('API Error searching venues:', error instanceof Error ? error.name : 'unknown');
    return safeJson({ error: 'Failed to search venues' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  return handle(request, { zipCode: sp.get('zipCode'), category: sp.get('category'), radius: sp.get('radius'), minRating: sp.get('minRating'), searchQuery: sp.get('search'), sortBy: sp.get('sortBy') });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return safeJson({ error: 'Invalid request.' }, { status: 400 });
  return handle(request, body as Record<string, unknown>);
}
