// Sidebar.jsx - the left navigation panel
// Always visible while the user is logged in
// Highlights the currently active page
// Contains nav links and a logout button at the bottom

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

export default function Sidebar({ currentPage, onNavigate, onLogout, profile }) {
  const navItems = profile?.role === 'admin' ? adminNavItems : staffNavItems

  return (
    <div className="w-[250px] shrink-0 bg-surface2 border-r border-sep flex flex-col p-3 gap-6 sticky top-0 h-screen">

      {/* App mark */}
      <div className="flex items-center gap-2.5 px-2 pt-1">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-white text-[15px] font-bold">m</div>
        <h1 className="text-[19px] font-bold text-label tracking-[-0.03em]">medRota</h1>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full flex items-center gap-[11px] px-2.5 py-2.5 rounded-[10px] text-[14.5px] tracking-[-0.015em] transition-colors ${
              currentPage === item.key
                ? 'bg-accent text-white font-semibold'
                : 'text-label2 font-medium hover:bg-fill hover:text-label'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-[11px] px-2.5 py-2.5 rounded-[10px] text-[14.5px] font-medium text-label2 hover:bg-fill hover:text-label transition-colors"
        >
          <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  )
}
