/**
 * Vitest global setup: run the suite with the launch campaign OFF (it is active on the real calendar until Nov 13,
 * 2026 and would make every account Pro), and restore its real window afterwards. No-op without local Supabase
 * (unit-only runs).
 */
import { isSupabaseUp, restoreLaunchCampaign, setLaunchCampaign } from './helpers/supabase'

export async function setup() {
  if (await isSupabaseUp()) await setLaunchCampaign(false).catch(() => undefined)
}

export async function teardown() {
  if (await isSupabaseUp()) await restoreLaunchCampaign().catch(() => undefined)
}
