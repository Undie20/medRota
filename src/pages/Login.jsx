// Login.jsx - the only entry point into the app
// This is a sign-in-only page. There is no self-registration.
// All user accounts are created by an admin from inside the dashboard.
// If someone doesn't have an account, they contact their administrator.

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  // Tracks what the user types into each input field
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // error = displayed in red if login fails (e.g. wrong password)
  const [error, setError] = useState('')

  // loading = true while we're waiting for Supabase to respond
  // disables the button so the user can't click multiple times
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    setError('') // clear any previous error before trying again

    // Ask Supabase to check the email + password against its auth system
    // If correct, it sets a session automatically
    // App.jsx is listening for that session change and will redirect to /dashboard
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    // If Supabase returns an error (wrong password, user not found, etc.)
    // store it in state so it displays below the inputs
    if (error) setError(error.message)

    setLoading(false)
  }

  return (
    // Full screen dark background with everything centred
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* App name and tagline at the top */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">medRota</h1>
          <p className="text-slate-400 mt-2 text-sm">Practice scheduling, simplified</p>
        </div>

        {/* The login card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">

          {/* Email input field */}
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-widest block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              // Every keystroke updates the email state
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>

          {/* Password input field */}
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-widest block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              // Pressing Enter triggers sign in so the user doesn't have to click the button
              onKeyDown={e => e.key === 'Enter' && handleSignIn()}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {/* Error message - only shown if login fails */}
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          {/* Sign in button */}
          {/* disabled={loading} prevents double-clicking while waiting */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-3 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {/* Button text changes while loading so the user knows something is happening */}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Small note at the bottom - no register link, intentionally */}
          <p className="text-slate-600 text-xs text-center">
            Contact your administrator if you need access.
          </p>

        </div>
      </div>
    </div>
  )
}