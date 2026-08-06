// App.jsx is the root of the entire application
// It handles routing (which page to show) and tracks whether the user is logged in

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore the saved appearance before anything paints
    if (localStorage.getItem('medrota-theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // While we're checking login status, show a simple loading screen
  if (loading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-label3 text-[13px] font-medium tracking-[0.07em] uppercase">Loading</div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}
