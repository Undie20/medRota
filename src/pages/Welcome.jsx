// Welcome.jsx - onboarding step after accepting an invite
//
// The invite link logs someone in via a token in the URL, but that's not
// enough to actually use the app: they've never set a password, and their
// profile has no name yet. This page collects both, and — if a staff
// roster entry was invited under this email — links it to the new login
// (the actual linking happens server-side in complete_own_profile; the
// staff lookup here is just to pre-fill the name field).

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logoIcon from '../assets/logo-icon.png'

const fieldClass =
  'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
const fieldLabelClass =
  'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

export default function Welcome() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      // Cosmetic only — pre-fills the name if a staff roster entry was
      // invited under this email. The real link is made server-side.
      if (profile?.org_id && user.email) {
        const { data: staffMatch } = await supabase
          .from('staff')
          .select('name')
          .eq('org_id', profile.org_id)
          .ilike('email', user.email)
          .is('profile_id', null)
          .maybeSingle()

        if (staffMatch?.name) {
          const [first, ...rest] = staffMatch.name.trim().split(' ')
          setFirstName(first || '')
          setLastName(rest.join(' '))
        }
      }

      setChecking(false)
    }
    load()
  }, [navigate])

  const handleSubmit = async () => {
    setError('')
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords don\'t match.')
      return
    }

    setLoading(true)

    const { error: passwordErr } = await supabase.auth.updateUser({ password })
    if (passwordErr) {
      setError(passwordErr.message)
      setLoading(false)
      return
    }

    const { error: profileErr } = await supabase.rpc('complete_own_profile', {
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
    })
    if (profileErr) {
      setError(profileErr.message)
      setLoading(false)
      return
    }

    navigate('/dashboard')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-label3 text-[13px] font-medium tracking-[0.07em] uppercase">Loading</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">

        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logoIcon} alt="medRota" className="w-24 h-24 mb-3" />
          <h1 className="text-[24px] font-bold text-label tracking-[-0.03em]">Welcome</h1>
          <p className="text-label2 mt-1 text-[14.5px]">Set up your account to get started</p>
        </div>

        <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-6 flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={fieldLabelClass}>First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                className={fieldClass} placeholder="Jane" />
            </div>
            <div>
              <label className={fieldLabelClass}>Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                className={fieldClass} placeholder="Doe" />
            </div>
          </div>

          <div>
            <label className={fieldLabelClass}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={fieldClass} placeholder="••••••••" />
          </div>

          <div>
            <label className={fieldLabelClass}>Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className={fieldClass} placeholder="••••••••" />
          </div>

          {error && (
            <p className="text-red-500 text-[13px] px-1">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-11 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-[12px] transition-all"
          >
            {loading ? 'Setting up...' : 'Finish Setup'}
          </button>

        </div>
      </div>
    </div>
  )
}
