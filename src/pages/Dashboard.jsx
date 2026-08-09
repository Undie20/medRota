// Dashboard.jsx - the app shell after login
//
// Layout: sidebar (md+) | [ sticky glass topbar + scrolling main ] | bottom tabs (mobile)
// The scroll container is the right-hand column, NOT <main> - that's what
// lets content pass under the translucent topbar.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import Sidebar from '../components/Sidebar'
import BottomTabs from '../components/BottomTabs'
import TopBar from '../components/Topbar'
import Schedule from './Schedule'
import Doctors from './Doctors'
import Staff from './Staff'
import Settings from './Settings'
import Tasks from './Tasks'
import { navItemsFor } from '../components/navItems'

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState('schedule')
  const [profile, setProfile] = useState(null)
  const [org, setOrg] = useState(null)

  const { mode, setMode } = useTheme()

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profileData) {
        setProfile(profileData)
        const { data: orgData } = await supabase
          .from('organisations')
          .select('*')
          .eq('id', profileData.org_id)
          .single()
        if (orgData) setOrg(orgData)
      }
    }
  }

  useEffect(() => { fetchProfile() }, [])

  const handleLogout = async () => { await supabase.auth.signOut() }

  // Only allow navigating to a page the current role actually has in its nav —
  // falls back to the role's first item (e.g. Schedule) for anything else.
  const allowedKeys = navItemsFor(profile).map(item => item.key)
  const safePage = allowedKeys.includes(currentPage) ? currentPage : allowedKeys[0]

  const renderPage = () => {
    switch (safePage) {
      case 'schedule': return <Schedule org={org} profile={profile} onNavigate={setCurrentPage} />
      case 'tasks': return <Tasks org={org} profile={profile} />
      case 'doctors': return <Doctors org={org} profile={profile} />
      case 'staff': return <Staff org={org} profile={profile} />
      case 'settings': return <Settings org={org} profile={profile} />
      default: return <Schedule org={org} profile={profile} onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="h-[100dvh] bg-bg text-label flex overflow-hidden">
      <Sidebar
        currentPage={safePage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        profile={profile}
      />

      {/* Right column IS the scroller, so the sticky topbar blurs what passes under it */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopBar
          org={org}
          profile={profile}
          mode={mode}
          onSetMode={setMode}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-4 md:p-5 lg:p-[26px]">
          {renderPage()}
        </main>
        <BottomTabs
          currentPage={safePage}
          onNavigate={setCurrentPage}
          profile={profile}
        />
      </div>
    </div>
  )
}
