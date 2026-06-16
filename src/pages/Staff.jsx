// Staff.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Staff({ org, profile }) {
  const [staffList, setStaffList] = useState([])
  const [members, setMembers] = useState([]) // org members from profiles table
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [color, setColor] = useState('#10b981')
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
    setCustomFields([])
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (member) => {
    setEditingStaff(member)
    setName(member.name)
    setRole(member.role || '')
    setColor(member.color || '#10b981')
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
    if (editingStaff) {
      const { error } = await supabase
        .from('staff')
        .update({ name: name.trim(), role: role.trim(), color, fields: fieldsObject })
        .eq('id', editingStaff.id)
      if (error) setError(error.message)
      else { closeModal(); fetchStaff() }
    } else {
      const { error } = await supabase
        .from('staff')
        .insert({ name: name.trim(), role: role.trim(), color, fields: fieldsObject, org_id: org.id })
      if (error) setError(error.message)
      else { closeModal(); fetchStaff() }
    }
    setLoading(false)
  }

  const handleDelete = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return
    const { error } = await supabase.from('staff').delete().eq('id', staffId)
    if (!error) fetchStaff()
  }

  // Invite a new user to this org
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail.trim(), {
      data: { org_id: org.id }
    })
    if (error) {
      setInviteError(error.message)
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
    <div className="space-y-8">

      {/* ── App Users (org members) — admin only ── */}
      {profile?.role === 'admin' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Team Access</h2>
            <p className="text-slate-400 text-sm mt-1">Invite and manage who can log in to this organisation</p>
          </div>

          {/* Invite bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-slate-400 text-xs uppercase tracking-widest">Invite a new user</p>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteError(''); setInviteSuccess('') }}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                placeholder="email@example.com"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {inviteLoading ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
            {inviteError && <p className="text-red-400 text-xs">{inviteError}</p>}
            {inviteSuccess && <p className="text-green-400 text-xs">{inviteSuccess}</p>}
          </div>

          {/* Members list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {members.length === 0 ? (
              <p className="text-slate-400 text-sm p-5">No members yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-slate-400 text-xs uppercase tracking-widest px-5 py-3">Name</th>
                    <th className="text-left text-slate-400 text-xs uppercase tracking-widest px-5 py-3">Role</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id} className="border-b border-slate-800 last:border-0">
                      <td className="px-5 py-3 text-white">
                        {member.first_name || member.last_name
                          ? `${member.first_name} ${member.last_name}`.trim()
                          : <span className="text-slate-500 italic">No name set</span>
                        }
                        {member.id === profile.id && (
                          <span className="ml-2 text-xs text-slate-500">(you)</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {member.id === profile.id ? (
                          // Can't change your own role
                          <span className="text-blue-400 text-xs font-medium capitalize">{member.role}</span>
                        ) : (
                          <select
                            value={member.role}
                            onChange={e => handleRoleChange(member.id, e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
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
                            className="text-slate-500 hover:text-red-400 text-xs transition-colors"
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Staff</h2>
            <p className="text-slate-400 text-sm mt-1">Manage nurses, receptionists and other staff</p>
          </div>
          {profile?.role === 'admin' && (
            <button
              onClick={openAddModal}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Staff
            </button>
          )}
        </div>

        {staffList.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400">No staff added yet.</p>
            {profile?.role === 'admin' && (
              <button
                onClick={openAddModal}
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Add your first staff member
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedStaff).map(([groupRole, members]) => (
              <div key={groupRole}>
                <h3 className="text-slate-400 text-xs uppercase tracking-widest mb-3">{groupRole}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {members.map(member => (
                    <div key={member.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: member.color || '#10b981' }} />
                          <h3 className="text-white font-semibold">{member.name}</h3>
                        </div>
                        {profile?.role === 'admin' && (
                          <div className="flex gap-2">
                            <button onClick={() => openEditModal(member)} className="text-slate-400 hover:text-white text-xs transition-colors">Edit</button>
                            <button onClick={() => handleDelete(member.id)} className="text-slate-400 hover:text-red-400 text-xs transition-colors">Delete</button>
                          </div>
                        )}
                      </div>
                      {Object.entries(member.fields || {}).length > 0 && (
                        <div className="space-y-1 border-t border-slate-800 pt-3">
                          {Object.entries(member.fields).map(([label, value]) => (
                            <div key={label} className="flex justify-between text-xs">
                              <span className="text-slate-400">{label}</span>
                              <span className="text-slate-300">{value}</span>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg">
              {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
            </h3>

            <div>
              <label className="text-slate-400 text-xs uppercase tracking-widest block mb-2">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. Jane Smith" />
            </div>

            <div>
              <label className="text-slate-400 text-xs uppercase tracking-widest block mb-2">Role</label>
              <input type="text" value={role} onChange={e => setRole(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. Nurse, Receptionist, Practice Manager" />
            </div>

            <div>
              <label className="text-slate-400 text-xs uppercase tracking-widest block mb-2">Calendar Colour</label>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-slate-400 text-sm">Used to identify this staff member on the schedule</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-400 text-xs uppercase tracking-widest">Custom Fields</label>
                <button onClick={addCustomField} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">+ Add Field</button>
              </div>
              {customFields.length === 0 && (
                <p className="text-slate-600 text-xs">Add fields like Phone, Email, Qualification, etc.</p>
              )}
              <div className="space-y-2">
                {customFields.map((field, index) => (
                  <div key={index} className="flex gap-2">
                    <input type="text" value={field.label} onChange={e => updateCustomField(index, 'label', e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Field name" />
                    <input type="text" value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Value" />
                    <button onClick={() => removeCustomField(index)} className="text-slate-400 hover:text-red-400 px-2 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-3 text-sm font-medium transition-colors disabled:opacity-50">
                {loading ? 'Saving...' : editingStaff ? 'Save Changes' : 'Add Staff Member'}
              </button>
              <button onClick={closeModal}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-3 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}