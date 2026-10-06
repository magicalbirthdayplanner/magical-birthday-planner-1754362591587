import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * A real app screen (public/prelaunch/*.webp — v1.0 screens with real AI output; child names blurred) in a simple
 * phone frame. Screens are 390×844 CSS px captures; `crop` shows only their top or bottom (a shorter frame) for
 * screens whose content sits in a sheet.
 */
export function Phone({ src, alt, className, priority, crop, sizes = '(min-width: 768px) 260px, 70vw' }: { src: string; alt: string; className?: string; priority?: boolean; crop?: 'top' | 'bottom'; sizes?: string }) {
  return (
    <div className={cn('relative overflow-hidden', crop ? 'aspect-[600/980]' : 'aspect-[600/1298]', 'rounded-[2rem] border-[5px] border-[hsl(252_32%_14%)] bg-card shadow-xl shadow-primary/15', className)}>
      <Image src={`/prelaunch/${src}.webp`} alt={alt} fill sizes={sizes} priority={priority} className={cn('object-cover', crop === 'bottom' ? 'object-bottom' : 'object-top')} />
    </div>
  )
}
