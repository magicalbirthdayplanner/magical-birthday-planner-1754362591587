'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SheetSnap = 'peek' | 'half' | 'full'
const SNAP_RATIO: Record<SheetSnap, number> = { peek: 0, half: 0.5, full: 0.9 }
const PEEK_PX = 148

/**
 * Non-modal bottom sheet over the map (Google-Maps style). Drag the handle to
 * move between peek / half / full; the map stays interactive above it.
 */
export function MapSheet({ snap, onSnapChange, header, children }: { snap: SheetSnap; onSnapChange: (s: SheetSnap) => void; header: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [containerH, setContainerH] = useState(0)
  const [drag, setDrag] = useState<{ startY: number; startH: number; h: number } | null>(null)

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver(() => setContainerH(parent.clientHeight))
    ro.observe(parent)
    setContainerH(parent.clientHeight)
    return () => ro.disconnect()
  }, [])

  const heightFor = (s: SheetSnap) => (s === 'peek' ? PEEK_PX : Math.max(PEEK_PX, containerH * SNAP_RATIO[s]))
  const height = drag ? drag.h : heightFor(snap)

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDrag({ startY: e.clientY, startH: heightFor(snap), h: heightFor(snap) })
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return
    const h = Math.min(containerH * 0.94, Math.max(96, drag.startH + (drag.startY - e.clientY)))
    setDrag({ ...drag, h })
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return
    const moved = Math.abs(drag.startY - e.clientY)
    let next: SheetSnap
    if (moved < 6) next = snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half' // tap toggles
    else {
      const options: SheetSnap[] = ['peek', 'half', 'full']
      next = options.reduce((best, s) => (Math.abs(heightFor(s) - drag.h) < Math.abs(heightFor(best) - drag.h) ? s : best), 'peek' as SheetSnap)
    }
    setDrag(null)
    onSnapChange(next)
  }

  return (
    <div
      ref={ref}
      className={cn('absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-background shadow-[0_-8px_30px_rgba(30,20,60,0.18)]', !drag && 'transition-[height] duration-300 ease-out')}
      style={{ height }}
      data-testid="map-sheet"
      data-snap={snap}
    >
      <div
        role="slider"
        aria-label="Resize results panel"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={['peek', 'half', 'full'].indexOf(snap)}
        aria-valuetext={snap}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') onSnapChange(snap === 'peek' ? 'half' : 'full')
          if (e.key === 'ArrowDown') onSnapChange(snap === 'full' ? 'half' : 'peek')
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        className="tap flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 focus-visible:outline-none"
      >
        <span className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        <div className="w-full px-4 pb-2 pt-2">{header}</div>
      </div>
      <div className={cn('min-h-0 flex-1 overscroll-contain px-4 pb-4', snap === 'peek' ? 'overflow-hidden' : 'overflow-y-auto')}>{children}</div>
    </div>
  )
}
