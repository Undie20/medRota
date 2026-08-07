// Sidebar.jsx - left navigation
//
// Responsive behaviour:
//   < md  (mobile)  hidden entirely - BottomTabs takes over
//   md-lg (tablet)  68px icon-only rail, no resize
//   >= lg (desktop) full sidebar, collapsible + drag-to-resize (as before)
//
// The rail/sidebar uses a translucent glass material with backdrop-blur.

import { useState, useEffect, useRef } from 'react'
import { navItemsFor } from './navItems'

const MIN_WIDTH = 190
const MAX_WIDTH = 340
const COLLAPSED_WIDTH = 68
const COLLAPSE_DRAG_THRESHOLD = 120

export default function Sidebar({ currentPage, onNavigate, onLogout, profile }) {
  const navItems = navItemsFor(profile)

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('medrota-sidebar-collapsed') === 'true'
  )
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('medrota-sidebar-width'), 10)
    return Number.isFinite(saved) ? Math.min(Math.max(saved, MIN_WIDTH), MAX_WIDTH) : 250
  })
  const [isDragging, setIsDragging] = useState(false)
  // Only the desktop breakpoint gets the custom width; below lg we force the rail
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  )
  const dragState = useRef({ startX: 0, startWidth: 0 })

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    localStorage.setItem('medrota-sidebar-collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    localStorage.setItem('medrota-sidebar-width', String(width))
  }, [width])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      const next = dragState.current.startWidth + (e.clientX - dragState.current.startX)
      if (next < COLLAPSE_DRAG_THRESHOLD) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
        setWidth(Math.min(Math.max(next, MIN_WIDTH), MAX_WIDTH))
      }
    }
    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  const startDrag = (e) => {
    dragState.current = { startX: e.clientX, startWidth: collapsed ? COLLAPSED_WIDTH : width }
    setIsDragging(true)
  }

  // Below lg we ignore the saved width and render the icon rail
  const isRail = !isDesktop || collapsed
  const sidebarWidth = isRail ? COLLAPSED_WIDTH : width

  return (
    <div
      className={`hidden md:flex shrink-0 flex-col p-3 gap-6 sticky top-0 h-screen relative
        bg-glass2 backdrop-blur-xl border-r border-sep shadow-[inset_-1px_0_0_var(--c-hair)] ${
        isDragging ? '' : 'transition-[width] duration-150'
      }`}
      style={{ width: sidebarWidth }}
    >
      {/* App mark */}
      <div className={`flex items-center pt-1 ${isRail ? 'flex-col gap-2 px-0' : 'justify-between gap-2.5 px-2'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-accent flex items-center justify-center text-white text-[15px] font-bold">m</div>
          {!isRail && <h1 className="text-[15px] font-bold text-label tracking-[-0.02em] whitespace-nowrap">medRota</h1>}
        </div>

        {/* Collapse/expand toggle - desktop only */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex w-7 h-7 shrink-0 items-center justify-center rounded-md text-label3 hover:bg-fill hover:text-label transition-colors"
        >
          <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <rect x="3.5" y="5" width="17" height="14" rx="3.5" />
            <line x1="9.5" y1="5" x2="9.5" y2="19" />
            {!collapsed && (
              <rect x="4.5" y="6" width="4" height="12" rx="1.5" fill="currentColor" stroke="none" />
            )}
          </svg>
        </button>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            title={isRail ? item.label : undefined}
            className={`w-full flex items-center gap-[11px] min-h-[44px] py-2.5 rounded-[10px] text-[14.5px] tracking-[-0.015em] transition-colors ${
              isRail ? 'justify-center px-0' : 'px-2.5'
            } ${
              currentPage === item.key
                ? 'bg-accent text-white font-semibold'
                : 'text-label2 font-medium hover:bg-fill hover:text-label'
            }`}
          >
            <span className="w-[19px] h-[19px] shrink-0">{item.icon}</span>
            {!isRail && item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          onClick={onLogout}
          title={isRail ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-[11px] min-h-[44px] py-2.5 rounded-[10px] text-[14.5px] font-medium text-label2 hover:bg-fill hover:text-label transition-colors ${
            isRail ? 'justify-center px-0' : 'px-2.5'
          }`}
        >
          <svg className="w-[19px] h-[19px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isRail && 'Sign Out'}
        </button>
      </div>

      {/* Drag handle - desktop only */}
      <div
        onMouseDown={startDrag}
        className="hidden lg:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize group z-10"
      >
        <div className="mx-auto h-full w-px bg-transparent group-hover:bg-accent/40 transition-colors" />
      </div>
    </div>
  )
}
