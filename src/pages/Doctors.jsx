// Doctors.jsx - doctor management page
// Admins can add, edit, and view doctors here
// Each doctor has a name plus flexible custom fields
// (the admin defines what fields they want - specialty, room, phone, etc.)

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fieldClass =
  'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
const fieldLabelClass =
  'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

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
    <div className="flex flex-col gap-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[22px] font-bold text-label tracking-[-0.03em]">Doctors</h2>
          <p className="text-label2 text-[14px] mt-1">Manage the doctors in your practice</p>
        </div>
        {/* Only admins can add doctors */}
        {profile?.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="h-9 px-4 bg-accent hover:brightness-110 text-white text-[14px] font-semibold rounded-[10px] transition-all"
          >
            + Add Doctor
          </button>
        )}
      </div>

      {/* Doctors grid */}
      {doctors.length === 0 ? (
        // Empty state - shown when no doctors have been added yet
        <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-12 text-center">
          <p className="text-label2 text-[15px]">No doctors added yet.</p>
          <button
            onClick={openAddModal}
            className="mt-4 h-9 px-4 bg-accent hover:brightness-110 text-white text-[14px] font-semibold rounded-[10px] transition-all"
          >
            Add your first doctor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {doctors.map(doctor => (
            <div
              key={doctor.id}
              className="bg-surface border border-sep rounded-[16px] shadow-ios p-4 flex flex-col gap-3"
            >
              {/* Doctor name with colour indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Colour dot - used to identify this doctor on the calendar */}
                  <span
                    className="w-[9px] h-[9px] rounded-full shrink-0"
                    style={{ backgroundColor: doctor.color || '#3b82f6' }}
                  />
                  <h3 className="text-label font-semibold text-[15px] tracking-[-0.01em]">{doctor.name}</h3>
                </div>

                {/* Edit and delete buttons - admin only */}
                {profile?.role === 'admin' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => openEditModal(doctor)}
                      className="text-label2 hover:text-accent text-[12.5px] font-medium transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(doctor.id)}
                      className="text-label2 hover:text-red-500 text-[12.5px] font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Custom fields - displayed as key: value pairs */}
              {Object.entries(doctor.fields || {}).length > 0 && (
                <div className="flex flex-col gap-1 border-t border-sep pt-3">
                  {Object.entries(doctor.fields).map(([label, value]) => (
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
      )}

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
                {editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
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

              {/* Doctor name */}
              <div>
                <label className={fieldLabelClass}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Dr. Jane Smith"
                />
              </div>

              {/* Colour picker - used to identify this doctor on the calendar */}
              <div>
                <label className={fieldLabelClass}>Calendar Colour</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-10 h-10 rounded-[10px] cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-label2 text-[13.5px]">
                    This colour will identify the doctor on the calendar
                  </span>
                </div>
              </div>

              {/* Custom fields section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`${fieldLabelClass} mb-0`}>Custom Fields</label>
                  <button
                    onClick={addCustomField}
                    className="text-accent text-[12.5px] font-medium transition-opacity hover:opacity-70"
                  >
                    + Add Field
                  </button>
                </div>

                {customFields.length === 0 && (
                  <p className="text-label3 text-[13px] pl-1">
                    Add fields like Specialty, Room, Phone, Provider Number, etc.
                  </p>
                )}

                {/* Each custom field row */}
                <div className="flex flex-col gap-2">
                  {customFields.map((field, index) => (
                    <div key={index} className="flex gap-2">
                      {/* Field label e.g. "Specialty" */}
                      <input
                        type="text"
                        value={field.label}
                        onChange={e => updateCustomField(index, 'label', e.target.value)}
                        className={`${fieldClass} flex-1 px-3 py-2`}
                        placeholder="Field name"
                      />
                      {/* Field value e.g. "Cardiology" */}
                      <input
                        type="text"
                        value={field.value}
                        onChange={e => updateCustomField(index, 'value', e.target.value)}
                        className={`${fieldClass} flex-1 px-3 py-2`}
                        placeholder="Value"
                      />
                      {/* Remove this field */}
                      <button
                        onClick={() => removeCustomField(index)}
                        className="text-label3 hover:text-red-500 px-2 transition-colors"
                      >
                        ✕
                      </button>
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
