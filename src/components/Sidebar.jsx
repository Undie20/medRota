// Sidebar.jsx - the left navigation panel
// Always visible while the user is logged in
// Highlights the currently active page
// Contains nav links and a logout button at the bottom

import { useState, useEffect, useRef } from 'react'

// These are SVG icons - just visual symbols for each nav item
// We're defining them inline to avoid needing an icon library
const icons = {
  schedule: (
    <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  doctors: (
    <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  staff: (
    <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  settings: (
    <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

const adminNavItems = [
  { label: 'Schedule', key: 'schedule', icon: icons.schedule },
  { label: 'Doctors', key: 'doctors', icon: icons.doctors },
  { label: 'Staff', key: 'staff', icon: icons.staff },
  { label: 'Settings', key: 'settings', icon: icons.settings },
]

const staffNavItems = [
  { label: 'Schedule', key: 'schedule', icon: icons.schedule },
]

// Sidebar can be collapsed to an icon-only rail via the toggle button,
// or resized/collapsed by dragging its right edge. Both the collapsed
// state and the last expanded width are remembered between visits.
const MIN_WIDTH = 190
const MAX_WIDTH = 340
const COLLAPSED_WIDTH = 68
const COLLAPSE_DRAG_THRESHOLD = 120

export default function Sidebar({ currentPage, onNavigate, onLogout, profile }) {
  const navItems = profile?.role === 'admin' ? adminNavItems : staffNavItems

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('medrota-sidebar-collapsed') === 'true'
  )
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('medrota-sidebar-width'), 10)
    return Number.isFinite(saved) ? Math.min(Math.max(saved, MIN_WIDTH), MAX_WIDTH) : 250
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef({ startX: 0, startWidth: 0 })

  useEffect(() => {
    localStorage.setItem('medrota-sidebar-collapsed', String(collapsed))
  }, [collapsed])

  useEffect(() => {
    localStorage.setItem('medrota-sidebar-width', String(width))
  }, [width])

  // Wire up drag-to-resize / drag-to-collapse while a drag is in progress
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

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : width

  return (
    <div
      className={`shrink-0 bg-surface2 border-r border-sep flex flex-col p-3 gap-6 sticky top-0 h-screen ${
        isDragging ? '' : 'transition-[width] duration-150'
      }`}
      style={{ width: sidebarWidth }}
    >

      {/* App mark */}
      <div className={`flex items-center pt-1 ${collapsed ? 'flex-col gap-2 px-0' : 'justify-between gap-2.5 px-2'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 shrink-0 rounded-lg bg-accent flex items-center justify-center text-white text-[15px] font-bold">m</div>
          {!collapsed && <h1 className="text-[15px] font-bold text-label tracking-[-0.02em] whitespace-nowrap">medRota</h1>}
        </div>

        {/* Collapse/expand toggle — same panel icon browsers use for sidebar toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-label3 hover:bg-fill hover:text-label transition-colors"
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
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center gap-[11px] py-2.5 rounded-[10px] text-[14.5px] tracking-[-0.015em] transition-colors ${
              collapsed ? 'justify-center px-0' : 'px-2.5'
            } ${
              currentPage === item.key
                ? 'bg-accent text-white font-semibold'
                : 'text-label2 font-medium hover:bg-fill hover:text-label'
            }`}
          >
            {item.icon}
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          onClick={onLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className={`w-full flex items-center gap-[11px] py-2.5 rounded-[10px] text-[14.5px] font-medium text-label2 hover:bg-fill hover:text-label transition-colors ${
            collapsed ? 'justify-center px-0' : 'px-2.5'
          }`}
        >
          <svg className="w-[19px] h-[19px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && 'Sign Out'}
        </button>
      </div>

      {/* Drag handle — grab the right edge to resize, or drag past the
          threshold to collapse to icon-only mode */}
      <div
        onMouseDown={startDrag}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize group z-10"
      >
        <div className="mx-auto h-full w-px bg-transparent group-hover:bg-accent/40 transition-colors" />
      </div>
    </div>
  )
}
