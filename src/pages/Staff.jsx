// Staff.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fieldClass =
  'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
const fieldLabelClass =
  'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

export default function Staff({ org, profile }) {
  const [staffList, setStaffList] = useState([])
  const [members, setMembers] = useState([]) // org members from profiles table
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [color, setColor] = useState('#10b981')
  const [email, setEmail] = useState('')
  const [customFields, setCustomFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('org_id', org.id)
      .order('name')
    if (data) setStaffList(data)
  }

  // Fetch all profiles belonging to this org (the actual app users)
  const fetchMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('org_id', org.id)
      .order('first_name')
    if (data) setMembers(data)
  }

  useEffect(() => {
    if (org) {
      fetchStaff()
      fetchMembers()
    }
  }, [org])

  const openAddModal = () => {
    setEditingStaff(null)
    setName('')
    setRole('')
    setColor('#10b981')
    setEmail('')
    setCustomFields([])
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (member) => {
    setEditingStaff(member)
    setName(member.name)
    setRole(member.role || '')
    setColor(member.color || '#10b981')
    setEmail(member.email || '')
    const fields = Object.entries(member.fields || {}).map(([label, value]) => ({ label, value }))
    setCustomFields(fields)
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingStaff(null)
  }

  const addCustomField = () => setCustomFields([...customFields, { label: '', value: '' }])

  const updateCustomField = (index, key, value) => {
    const updated = [...customFields]
    updated[index][key] = value
    setCustomFields(updated)
  }

  const removeCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    if (!name.trim()) {
      setError('Staff name is required.')
      setLoading(false)
      return
    }
    const fieldsObject = {}
    customFields.forEach(f => {
      if (f.label.trim()) fieldsObject[f.label.trim()] = f.value
    })
    const trimmedEmail = email.trim()
    // Only invite when the email is new or has changed — editing an
    // unrelated field (role, colour, ...) shouldn't re-send the email.
    const shouldInvite = trimmedEmail && trimmedEmail !== (editingStaff?.email || '')
    const payload = { name: name.trim(), role: role.trim(), color, email: trimmedEmail || null, fields: fieldsObject }

    const { error } = editingStaff
      ? await supabase.from('staff').update(payload).eq('id', editingStaff.id)
      : await supabase.from('staff').insert({ ...payload, org_id: org.id })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (shouldInvite) {
      const { data, error: inviteErr } = await supabase.functions.invoke('inviteuser', {
        body: { email: trimmedEmail, org_id: org.id }
      })
      if (inviteErr || data?.error) {
        // The staff row is already saved — surface the invite failure but
        // don't discard it, so the admin can retry the invite from Edit.
        setError(`Saved, but the invite couldn't be sent: ${data?.error || inviteErr.message}`)
        setLoading(false)
        fetchStaff()
        return
      }
    }

    closeModal()
    fetchStaff()
    setLoading(false)
  }

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return
    const { error } = await supabase.from('staff').delete().eq('id', staffId)
    if (!error) fetchStaff()
  }

  // Invite a new user to this org
  // Routed through the "inviteuser" edge function — inviting requires the
  // service role key, which must stay server-side and never ship to the browser.
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')
    const { data, error } = await supabase.functions.invoke('inviteuser', {
      body: { email: inviteEmail.trim(), org_id: org.id }
    })
    if (error || data?.error) {
      setInviteError(data?.error || error.message)
    } else {
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
    }
    setInviteLoading(false)
  }

  // Toggle a member's role between admin and staff
  const handleRoleChange = async (memberId, newRole) => {
    await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', memberId)
    fetchMembers()
  }

  // Remove a user's access to this org
  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this user\'s access to the organisation?')) return
    await supabase
      .from('profiles')
      .update({ org_id: null })
      .eq('id', memberId)
    fetchMembers()
  }

  const groupedStaff = staffList.reduce((groups, member) => {
    const key = member.role || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(member)
    return groups
  }, {})

  return (
    <div className="flex flex-col gap-8">

      {/* ── App Users (org members) — admin only ── */}
      {profile?.role === 'admin' && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-[22px] font-bold text-label tracking-[-0.03em]">Team Access</h2>
            <p className="text-label2 text-[14px] mt-1">Invite and manage who can log in to this organisation</p>
          </div>

          {/* Invite bar */}
          <div className="bg-surface border border-sep rounded-[16px] shadow-ios p-4 flex flex-col gap-3">
            <p className="text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em]">Invite a new user</p>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess('') }}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                placeholder="email@example.com"
                className={`${fieldClass} flex-1 px-4 py-2.5`}
              />
              <button
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail.trim()}
                className="h-11 px-4 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[14px] font-semibold rounded-[12px] transition-all whitespace-nowrap"
              >
                {inviteLoading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
            {inviteError && <p className="text-red-500 text-[12.5px]">{inviteError}</p>}
            {inviteSuccess && <p className="text-emerald-600 dark:text-emerald-400 text-[12.5px]">{inviteSuccess}</p>}
          </div>

          {/* Members list */}
          <div className="bg-surface border border-sep rounded-[16px] shadow-ios overflow-hidden">
            {members.length === 0 ? (
              <p className="text-label2 text-[14px] p-5">No members yet.</p>
            ) : (
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-sep">
                    <th className="text-left text-label3 text-[11px] font-semibold uppercase tracking-[0.07em] px-5 py-3">Name</th>
                    <th className="text-left text-label3 text-[11px] font-semibold uppercase tracking-[0.07em] px-5 py-3">Role</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id} className="border-b border-sep last:border-0">
                      <td className="px-5 py-3 text-label">
                        {member.first_name || member.last_name
                          ? `${member.first_name} ${member.last_name}`.trim()
                          : <span className="text-label3 italic">No name set</span>
                        }
                        {member.id === profile.id && (
                          <span className="ml-2 text-[12px] text-label3">(you)</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {member.id === profile.id ? (
                          // Can't change your own role
                          <span className="text-accent text-[12.5px] font-medium capitalize">{member.role}</span>
                        ) : (
                          <select
                            value={member.role}
                            onChange={e => handleRoleChange(member.id, e.target.value)}
                            className="bg-fill border border-sep rounded-[9px] px-3 py-1.5 text-label text-[12.5px] focus:outline-none focus:border-accent transition-colors"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {member.id !== profile.id && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-label3 hover:text-red-500 text-[12.5px] font-medium transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Staff (clinic staff for scheduling) ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-label tracking-[-0.03em]">Staff</h2>
            <p className="text-label2 text-[14px] mt-1">Manage nurses, receptionists and other staff</p>
          </div>
          {profile?.role === 'admin' && (
            <button
              onClick={openAddModal}
              className="h-9 px-4 bg-accent hover:brightness-110 text-white text-[14px] font-semibold rounded-[10px] transition-all"
            >
              + Add Staff
            </button>
          )}
        </div>

        {staffList.length === 0 ? (
          <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-12 text-center">
            <p className="text-label2 text-[15px]">No staff added yet.</p>
            {profile?.role === 'admin' && (
              <button
                onClick={openAddModal}
                className="mt-4 h-9 px-4 bg-accent hover:brightness-110 text-white text-[14px] font-semibold rounded-[10px] transition-all"
              >
                Add your first staff member
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(groupedStaff).map(([groupRole, members]) => (
              <div key={groupRole}>
                <h3 className="text-label3 text-[11px] font-semibold uppercase tracking-[0.07em] mb-3">{groupRole}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {members.map(member => (
                    <div key={member.id} className="bg-surface border border-sep rounded-[16px] shadow-ios p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ backgroundColor: member.color || '#10b981' }} />
                          <h3 className="text-label font-semibold text-[15px] tracking-[-0.01em] truncate">{member.name}</h3>
                          {member.email && (
                            <span className="shrink-0 text-label3 text-[9.5px] font-semibold uppercase tracking-[0.05em] bg-fill px-[5px] py-[1px] rounded-[4px]">
                              App access
                            </span>
                          )}
                        </div>
                        {profile?.role === 'admin' && (
                          <div className="flex gap-3">
                            <button onClick={() => openEditModal(member)} className="text-label2 hover:text-accent text-[12.5px] font-medium transition-colors">Edit</button>
                            <button onClick={() => handleDelete(member.id)} className="text-label2 hover:text-red-500 text-[12.5px] font-medium transition-colors">Delete</button>
                          </div>
                        )}
                      </div>
                      {Object.entries(member.fields || {}).length > 0 && (
                        <div className="flex flex-col gap-1 border-t border-sep pt-3">
                          {Object.entries(member.fields).map(([label, value]) => (
                            <div key={label} className="flex justify-between text-[12.5px]">
                              <span className="text-label3">{label}</span>
                              <span className="text-label2">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div
          onClick={closeModal}
          className="fixed inset-0 bg-black/35 flex items-center justify-center z-50 p-6 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-bg rounded-[22px] shadow-sheet w-full max-w-[440px] max-h-[88vh] overflow-y-auto animate-sheet-in"
          >
            {/* Sheet header — Cancel / title / Save, iOS style */}
            <div className="sticky top-0 z-10 bg-bg border-b border-sep flex items-center justify-between px-[18px] pt-4 pb-3">
              <button onClick={closeModal} className="text-accent text-[15.5px]">Cancel</button>
              <h3 className="text-label text-[16px] font-semibold tracking-[-0.02em]">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button
                onClick={handleSave}
                disabled={loading}
                className="text-accent text-[15.5px] font-semibold disabled:opacity-40"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="p-[18px] flex flex-col gap-5">

              <div>
                <label className={fieldLabelClass}>Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Jane Smith" />
              </div>

              <div>
                <label className={fieldLabelClass}>Role</label>
                <input type="text" value={role} onChange={e => setRole(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Nurse, Receptionist, Practice Manager" />
              </div>

              <div>
                <label className={fieldLabelClass}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. jane@example.com" />
                <p className="text-label3 text-[12.5px] mt-1.5 pl-1">Optional — sends them an invite to log in and use the app, including Tasks</p>
              </div>

              <div>
                <label className={fieldLabelClass}>Calendar Colour</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="w-10 h-10 rounded-[10px] cursor-pointer bg-transparent border-0" />
                  <span className="text-label2 text-[13.5px]">Used to identify this staff member on the schedule</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`${fieldLabelClass} mb-0`}>Custom Fields</label>
                  <button onClick={addCustomField} className="text-accent text-[12.5px] font-medium transition-opacity hover:opacity-70">+ Add Field</button>
                </div>
                {customFields.length === 0 && (
                  <p className="text-label3 text-[13px] pl-1">Add fields like Phone, Email, Qualification, etc.</p>
                )}
                <div className="flex flex-col gap-2">
                  {customFields.map((field, index) => (
                    <div key={index} className="flex gap-2">
                      <input type="text" value={field.label} onChange={e => updateCustomField(index, 'label', e.target.value)}
                        className={`${fieldClass} flex-1 px-3 py-2`}
                        placeholder="Field name" />
                      <input type="text" value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)}
                        className={`${fieldClass} flex-1 px-3 py-2`}
                        placeholder="Value" />
                      <button onClick={() => removeCustomField(index)} className="text-label3 hover:text-red-500 px-2 transition-colors">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-[13px] px-1">{error}</p>}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
