// Dashboard.jsx - the main app shell after login
// This file is the container that holds the sidebar and renders
// whichever page the user navigates to.
// Think of it like a picture frame - the sidebar stays the same,
// only the content in the middle changes.
// Dashboard.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/Topbar'
import Schedule from './Schedule'
import Doctors from './Doctors'
import Staff from './Staff'
import Settings from './Settings'

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState('schedule')
  const [profile, setProfile] = useState(null)
  const [org, setOrg] = useState(null)

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

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // Redirect staff away from admin-only pages if they somehow land there
  const safePage = profile?.role !== 'admin' ? 'schedule' : currentPage

  const renderPage = () => {
    switch (safePage) {
      case 'schedule': return <Schedule org={org} profile={profile} />
      case 'doctors': return <Doctors org={org} profile={profile} />
      case 'staff': return <Staff org={org} profile={profile} />
      case 'settings': return <Settings org={org} profile={profile} />
      default: return <Schedule org={org} profile={profile} />
    }
  }

  return (
    <div className="app-shell-bg min-h-screen flex">
      <Sidebar
        currentPage={safePage}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        profile={profile}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar org={org} profile={profile} />
        <main className="flex-1 p-6 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}