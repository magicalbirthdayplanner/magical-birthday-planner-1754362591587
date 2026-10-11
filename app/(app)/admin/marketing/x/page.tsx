import { redirect } from 'next/navigation'

/** Old address of the X dashboard: the console now has one tab per platform. */
export default function AdminMarketingXPage() {
  redirect('/admin/marketing?tab=x')
}
