// Login.jsx - the only entry point into the app
// This is a sign-in-only page. There is no self-registration.
// All user accounts are created by an admin from inside the dashboard.
// If someone doesn't have an account, they contact their administrator.

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logoIcon from '../assets/logo-icon.png'

const fieldClass =
  'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
const fieldLabelClass =
  'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

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
    // Full screen, grouped-grey background with everything centred
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        {/* App mark and tagline at the top */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logoIcon} alt="medRota" className="w-24 h-24 mb-3" />
          <h1 className="text-[24px] font-bold text-label tracking-[-0.03em]">medRota</h1>
          <p className="text-label2 mt-1 text-[14.5px]">Practice scheduling, simplified</p>
        </div>

        {/* The login card */}
        <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-6 flex flex-col gap-4">

          {/* Email input field */}
          <div>
            <label className={fieldLabelClass}>Email</label>
            <input
              type="email"
              value={email}
              // Every keystroke updates the email state
              onChange={e => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="you@example.com"
            />
          </div>

          {/* Password input field */}
          <div>
            <label className={fieldLabelClass}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              // Pressing Enter triggers sign in so the user doesn't have to click the button
              onKeyDown={e => e.key === 'Enter' && handleSignIn()}
              className={fieldClass}
              placeholder="••••••••"
            />
          </div>

          {/* Error message - only shown if login fails */}
          {error && (
            <p className="text-red-500 text-[13px] px-1">{error}</p>
          )}

          {/* Sign in button */}
          {/* disabled={loading} prevents double-clicking while waiting */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full h-11 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-[12px] transition-all"
          >
            {/* Button text changes while loading so the user knows something is happening */}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* Small note at the bottom - no register link, intentionally */}
          <p className="text-label3 text-[12.5px] text-center">
            Contact your administrator if you need access.
          </p>

        </div>
      </div>
    </div>
  )
}
