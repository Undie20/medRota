// Topbar.jsx - the bar at the top of the main content area
// Glass material, sticky, so page content scrolls underneath it.
// The appearance control is now three-way: System / Light / Dark.
// On mobile the org name shrinks and the user's name/role is hidden
// (the avatar alone carries it).

export default function TopBar({ org, profile, mode, onSetMode, onLogout }) {
  return (
    <div
      className="h-[54px] md:h-[58px] shrink-0 sticky top-0 z-20 flex items-center justify-between gap-3 px-4 md:px-[22px]
        bg-glass backdrop-blur-xl border-b border-sep shadow-[inset_0_1px_0_var(--c-hair)]"
    >
      {/* Organisation name */}
      <div className="text-label text-[15.5px] md:text-[16px] font-semibold tracking-[-0.02em] truncate">
        {org ? org.name : '...'}
      </div>

      <div className="flex items-center gap-2.5 md:gap-3.5">
        {/* Appearance: System / Light / Dark. Hidden on the smallest screens -
            put it in Settings there. */}
        {onSetMode && (
          <div className="hidden sm:flex p-0.5 bg-fill rounded-[9px]">
            {['system', 'light', 'dark'].map(m => (
              <button
                key={m}
                onClick={() => onSetMode(m)}
                className={`h-7 px-2.5 lg:px-3 rounded-lg text-[13px] capitalize transition-colors ${
                  mode === m
                    ? 'bg-surface text-label font-semibold shadow-sm'
                    : 'text-label2 font-medium'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div className="w-[32px] h-[32px] md:w-[30px] md:h-[30px] rounded-full bg-accent flex items-center justify-center text-white text-[13px] font-semibold shrink-0">
            {profile ? profile.first_name?.[0] : '?'}
          </div>
          <div className="hidden lg:block leading-tight">
            <p className="text-label text-[13.5px] font-semibold">
              {profile ? `${profile.first_name} ${profile.last_name}` : '...'}
            </p>
            <p className="text-label3 text-[11.5px] capitalize">{profile?.role}</p>
          </div>
        </div>

        {/* Mobile sign-out (the sidebar that used to hold it is hidden here) */}
        {onLogout && (
          <button
            onClick={onLogout}
            aria-label="Sign out"
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-label2"
          >
            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
