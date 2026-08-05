// Doctors.jsx - doctor management page
// Admins can add, edit, and view doctors here
// Each doctor has a name plus flexible custom fields
// (the admin defines what fields they want - specialty, room, phone, etc.)

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import GlassCard from '../components/ui/GlassCard'
import GlassButton from '../components/ui/GlassButton'
import GlassInput from '../components/ui/GlassInput'
import GlassLabel from '../components/ui/GlassLabel'
import GlassModal from '../components/ui/GlassModal'

export default function Doctors({ org, profile }) {
  // List of all doctors in this organisation
  const [doctors, setDoctors] = useState([])

  // Controls whether the Add/Edit modal is open
  const [modalOpen, setModalOpen] = useState(false)

  // The doctor currently being edited (null if adding a new one)
  const [editingDoctor, setEditingDoctor] = useState(null)

  // Form fields
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  // Custom fields - array of { label, value } objects
  // The admin can add as many as they want
  const [customFields, setCustomFields] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const fetchDoctors = async () => {
    const { data } = await supabase
      .from('doctors')
      .select('*')
      .eq('org_id', org.id)
      .order('name')

    if (data) setDoctors(data)
  }
  // Fetch doctors when the org loads
  useEffect(() => {
    if (org) fetchDoctors()
  }, [org])



  const openAddModal = () => {
    // Reset form to blank for a new doctor
    setEditingDoctor(null)
    setName('')
    setColor('#3b82f6')
    setCustomFields([])
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (doctor) => {
    // Pre-fill form with the doctor's existing data
    setEditingDoctor(doctor)
    setName(doctor.name)
    setColor(doctor.color || '#3b82f6')
    // Convert the stored fields object back into an array of { label, value }
    const fields = Object.entries(doctor.fields || {}).map(([label, value]) => ({ label, value }))
    setCustomFields(fields)
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingDoctor(null)
  }

  const addCustomField = () => {
    // Add a blank field row to the form
    setCustomFields([...customFields, { label: '', value: '' }])
  }

  const updateCustomField = (index, key, value) => {
    // Update a specific field's label or value
    const updated = [...customFields]
    updated[index][key] = value
    setCustomFields(updated)
  }

  const removeCustomField = (index) => {
    // Remove a field row from the form
    setCustomFields(customFields.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    if (!name.trim()) {
      setError('Doctor name is required.')
      setLoading(false)
      return
    }

    // Convert the array of { label, value } back into a plain object for storage
    // e.g. [{ label: 'Specialty', value: 'Cardiology' }] becomes { Specialty: 'Cardiology' }
    const fieldsObject = {}
    customFields.forEach(f => {
      if (f.label.trim()) fieldsObject[f.label.trim()] = f.value
    })

    if (editingDoctor) {
      // Update existing doctor
      const { error } = await supabase
        .from('doctors')
        .update({ name: name.trim(), color, fields: fieldsObject })
        .eq('id', editingDoctor.id)

      if (error) setError(error.message)
      else { closeModal(); fetchDoctors() }
    } else {
      // Insert new doctor
      const { error } = await supabase
        .from('doctors')
        .insert({ name: name.trim(), color, fields: fieldsObject, org_id: org.id })

      if (error) setError(error.message)
      else { closeModal(); fetchDoctors() }
    }

    setLoading(false)
  }

  const handleDelete = async (doctorId) => {
    // Simple confirmation before deleting
    if (!window.confirm('Are you sure you want to delete this doctor?')) return

    const { error } = await supabase
      .from('doctors')
      .delete()
      .eq('id', doctorId)

    if (!error) fetchDoctors()
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Doctors</h2>
          <p className="text-slate-400 text-sm mt-1">Manage the doctors in your practice</p>
        </div>
        {/* Only admins can add doctors */}
        {profile?.role === 'admin' && (
          <GlassButton onClick={openAddModal} className="px-4 py-2">
            + Add Doctor
          </GlassButton>
        )}
      </div>

      {/* Doctors grid */}
      {doctors.length === 0 ? (
        // Empty state - shown when no doctors have been added yet
        <GlassCard className="p-12 text-center">
          <p className="text-slate-400">No doctors added yet.</p>
          <GlassButton onClick={openAddModal} className="mt-4 px-4 py-2">
            Add your first doctor
          </GlassButton>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map(doctor => (
            <GlassCard
              key={doctor.id}
              className="p-5 space-y-3"
            >
              {/* Doctor name with colour indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Colour dot - used to identify this doctor on the calendar */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: doctor.color || '#3b82f6' }}
                  />
                  <h3 className="text-white font-semibold">{doctor.name}</h3>
                </div>

                {/* Edit and delete buttons - admin only */}
                {profile?.role === 'admin' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(doctor)}
                      className="text-slate-400 hover:text-white text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(doctor.id)}
                      className="text-slate-400 hover:text-red-400 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Custom fields - displayed as key: value pairs */}
              {Object.entries(doctor.fields || {}).length > 0 && (
                <div className="space-y-1 border-t border-glass-border pt-3">
                  {Object.entries(doctor.fields).map(([label, value]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-300">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <GlassModal open={modalOpen} onClose={closeModal} className="space-y-4 max-h-[90vh] overflow-y-auto">

        <h3 className="text-white font-bold text-lg">
          {editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
        </h3>

        {/* Doctor name */}
        <div>
          <GlassLabel>Full Name</GlassLabel>
          <GlassInput
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Dr. Jane Smith"
          />
        </div>

        {/* Colour picker - used to identify this doctor on the calendar */}
        <div>
          <GlassLabel>Calendar Colour</GlassLabel>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
            />
            <span className="text-slate-400 text-sm">
              This colour will identify the doctor on the calendar
            </span>
          </div>
        </div>

        {/* Custom fields section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <GlassLabel className="mb-0">Custom Fields</GlassLabel>
            <button
              onClick={addCustomField}
              className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              + Add Field
            </button>
          </div>

          {customFields.length === 0 && (
            <p className="text-slate-600 text-xs">
              Add fields like Specialty, Room, Phone, Provider Number, etc.
            </p>
          )}

          {/* Each custom field row */}
          <div className="space-y-2">
            {customFields.map((field, index) => (
              <div key={index} className="flex gap-2">
                {/* Field label e.g. "Specialty" */}
                <GlassInput
                  type="text"
                  value={field.label}
                  onChange={e => updateCustomField(index, 'label', e.target.value)}
                  className="flex-1 px-3 py-2"
                  placeholder="Field name"
                />
                {/* Field value e.g. "Cardiology" */}
                <GlassInput
                  type="text"
                  value={field.value}
                  onChange={e => updateCustomField(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2"
                  placeholder="Value"
                />
                {/* Remove this field */}
                <button
                  onClick={() => removeCustomField(index)}
                  className="text-slate-400 hover:text-red-400 px-2 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Modal action buttons */}
        <div className="flex gap-3 pt-2">
          <GlassButton
            onClick={handleSave}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Saving...' : editingDoctor ? 'Save Changes' : 'Add Doctor'}
          </GlassButton>
          <GlassButton
            variant="secondary"
            onClick={closeModal}
            className="flex-1"
          >
            Cancel
          </GlassButton>
        </div>

      </GlassModal>

    </div>
  )
}