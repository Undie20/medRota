// TopBar.jsx - the horizontal bar at the top of the main content area
// Shows the organisation name on the left
// Shows the logged in user's name and role on the right

export default function TopBar({ org, profile }) {
  // org - the organisation object (has .name)
  // profile - the logged in user's profile (has .first_name, .last_name, .role)

  return (
    <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">

      {/* Organisation name on the left */}
      <div className="text-white font-semibold">
        {/* Show org name if loaded, otherwise show a placeholder */}
        {org ? org.name : '...'}
      </div>

      {/* User info on the right */}
      <div className="flex items-center gap-3">
        {/* Small avatar circle with the user's first initial */}
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
          {profile ? profile.first_name?.[0] : '?'}
        </div>
        {/* User's full name and role */}
        <div className="text-right">
          <p className="text-white text-sm font-medium">
            {profile ? `${profile.first_name} ${profile.last_name}` : '...'}
          </p>
          <p className="text-slate-400 text-xs capitalize">
            {profile?.role}
          </p>
        </div>
      </div>

    </div>
  )
}