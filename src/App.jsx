// App.jsx is the root of the entire application
// It handles routing (which page to show) and tracks whether the user is logged in

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// BrowserRouter - wraps the app and enables URL-based navigation
// Routes - container for all your route definitions
// Route - defines a single page path (e.g. /login → Login component)
// Navigate - programmatically redirects the user to another page

import { useEffect, useState } from 'react'
// useEffect - runs code when the component first loads (like "on startup")
// useState - stores values that can change and trigger re-renders

import { supabase } from './lib/supabase'
// our supabase client we set up earlier - used here to check login status

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
// importing the two pages we've built so we can route to them

export default function App() {
  // session = the current logged-in user's data (null if not logged in)
  const [session, setSession] = useState(null)

  // loading = true while we're checking if the user is already logged in
  // prevents a flash of the wrong page on startup
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // On startup, check if there's already an active session
    // (e.g. user logged in previously and their token is still valid)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false) // done checking, hide the loading screen
    })

    // Also listen for auth changes in real time
    // This fires whenever someone logs in or logs out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session) // update our session state accordingly
    })

    // Cleanup: stop listening when the component unmounts
    return () => subscription.unsubscribe()
  }, []) // empty array = only run this once when the app first loads

  // While we're checking login status, show a simple loading screen
  if (loading) return (
    <div className="app-shell-bg min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-accent-blue animate-spin" />
        <div className="text-slate-400 text-xs tracking-widest uppercase">Loading</div>
      </div>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        {/* /login route:
            - if NOT logged in: show the Login page
            - if already logged in: redirect to /dashboard */}
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />

        {/* /dashboard route:
            - if logged in: show the Dashboard page
            - if NOT logged in: redirect to /login */}
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/login" />} />

        {/* catch-all: any unknown URL redirects based on login status */}
        <Route path="*" element={<Navigate to={session ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )
}