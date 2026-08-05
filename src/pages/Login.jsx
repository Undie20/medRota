// Login.jsx - the only entry point into the app
// This is a sign-in-only page. There is no self-registration.
// All user accounts are created by an admin from inside the dashboard.
// If someone doesn't have an account, they contact their administrator.

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import GlassCard from '../components/ui/GlassCard'
import GlassInput from '../components/ui/GlassInput'
import GlassLabel from '../components/ui/GlassLabel'
import GlassButton from '../components/ui/GlassButton'

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
    // Full screen gradient-mesh background with everything centred
    <div className="app-shell-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* App name and tagline at the top */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-shine">medRota</h1>
          <p className="text-slate-400 mt-2 text-sm">Practice scheduling, simplified</p>
        </div>

        {/* The login card */}
        <GlassCard className="glass-panel--deep p-8 space-y-5">

          {/* Email input field */}
          <div>
            <GlassLabel>Email</GlassLabel>
            <GlassInput
              type="email"
              value={email}
              // Every keystroke updates the email state
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {/* Password input field */}
          <div>
            <GlassLabel>Password</GlassLabel>
            <GlassInput
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              // Pressing Enter triggers sign in so the user doesn't have to click the button
              onKeyDown={e => e.key === 'Enter' && handleSignIn()}
              placeholder="••••••••"
            />
          </div>

          {/* Error message - only shown if login fails */}
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          {/* Sign in button */}
          {/* disabled={loading} prevents double-clicking while waiting */}
          <GlassButton
            onClick={handleSignIn}
            disabled={loading}
            className="w-full"
          >
            {/* Button text changes while loading so the user knows something is happening */}
            {loading ? 'Signing in...' : 'Sign In'}
          </GlassButton>

          {/* Small note at the bottom - no register link, intentionally */}
          <p className="text-slate-500 text-xs text-center">
            Contact your administrator if you need access.
          </p>

        </GlassCard>
      </div>
    </div>
  )
}