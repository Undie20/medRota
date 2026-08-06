// TopBar.jsx - the horizontal bar at the top of the main content area
// Shows the organisation name on the left
// Shows the logged in user's name and role on the right
// theme / onToggleTheme are optional - they drive the light/dark switch

export default function TopBar({ org, profile, theme, onToggleTheme }) {
  // org - the organisation object (has .name)
  // profile - the logged in user's profile (has .first_name, .last_name, .role)

  return (
    <div className="h-[58px] shrink-0 bg-surface border-b border-sep flex items-center justify-between gap-4 px-[22px] sticky top-0 z-20">

      {/* Organisation name on the left */}
      <div className="text-label text-[16px] font-semibold tracking-[-0.02em] truncate">
        {/* Show org name if loaded, otherwise show a placeholder */}
        {org ? org.name : '...'}
      </div>

      <div className="flex items-center gap-3.5">

        {/* Light / dark segmented control */}
        {onToggleTheme && (
          <div className="flex p-0.5 bg-fill rounded-[9px]">
            {['light', 'dark'].map(t => (
              <button
                key={t}
                onClick={() => onToggleTheme(t)}
                className={`h-7 px-3 rounded-lg text-[13.5px] capitalize transition-colors ${
                  theme === t
                    ? 'bg-surface text-label font-semibold shadow-sm'
                    : 'text-label2 font-medium'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* User info on the right */}
        <div className="flex items-center gap-2.5">
          {/* Small avatar circle with the user's first initial */}
          <div className="w-[30px] h-[30px] rounded-full bg-accent flex items-center justify-center text-white text-[13px] font-semibold">
            {profile ? profile.first_name?.[0] : '?'}
          </div>
          {/* User's full name and role */}
          <div className="leading-tight">
            <p className="text-label text-[13.5px] font-semibold">
              {profile ? `${profile.first_name} ${profile.last_name}` : '...'}
            </p>
            <p className="text-label3 text-[11.5px] capitalize">
              {profile?.role}
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
