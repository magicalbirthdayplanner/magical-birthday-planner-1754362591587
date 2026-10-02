import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server/admin'

export const fetchCache = "force-no-store";
export const dynamic = 'force-dynamic'

/** GET /api/admin/session → 200 for a Super Admin, 404 for everyone else. */
export async function GET(req: Request) {
  const { auth, error } = await requireSuperAdmin(req)
  if (error) return error
  return NextResponse.json({ admin: true, role: 'super_admin', userId: auth.user.id })
}
