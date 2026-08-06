// Settings.jsx - organisation settings page
// This is where the admin configures:
// 1. The organisation name
// 2. The rotation type (no rotation, 2 week, 3 week, 4 week, custom)
// 3. The cycle start date (which Monday does week 1 start from)
// This data gets saved to the schedule_config and organisations tables
// and is used by the calendar to calculate which rotation week any given date falls into

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fieldClass =
  'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
const fieldLabelClass =
  'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

export default function Settings({ org, profile }) {
  // rotationWeeks = how many weeks in the cycle (1 = no rotation, 2, 3, 4, or custom)
  const [rotationWeeks, setRotationWeeks] = useState(4)

  // customWeeks = used when the admin picks 'Custom' rotation
  const [customWeeks, setCustomWeeks] = useState('')

  // cycleStartDate = the Monday that week 1 begins from
  // All rotation week calculations are based on this date
  const [cycleStartDate, setCycleStartDate] = useState('')

  // orgName = editable organisation name
  const [orgName, setOrgName] = useState('')

  // workingDays = which days of the week the practice operates
  // admin can turn off Saturday/Sunday if they don't work weekends
  const [workingDays, setWorkingDays] = useState({
    Monday: true,
    Tuesday: true,
    Wednesday: true,
    Thursday: true,
    Friday: true,
    Saturday: false,
    Sunday: false,
  })

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // When the component loads, fetch the existing config from the database
  useEffect(() => {
    if (org) {
      setOrgName(org.name)
      fetchConfig()
    }
  }, [org])

  const fetchConfig = async () => {
    // Look for an existing schedule_config row for this organisation
    const { data } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('org_id', org.id)
      .single()

    if (data) {
      // If config exists, populate the form with the saved values
      setRotationWeeks(data.rotation_weeks)
      setCycleStartDate(data.cycle_start_date || '')

      // If it's not a standard option (1,2,3,4) treat it as custom
      if (![1, 2, 3, 4].includes(data.rotation_weeks)) {
        setCustomWeeks(data.rotation_weeks.toString())
      }

      // Parse saved working days if they exist
      if (data.working_days) {
        setWorkingDays(data.working_days)
      }
    }
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    setSaved(false)

    // Work out the final rotation weeks number
    // If they chose custom, use the custom value they typed
    const finalRotationWeeks = rotationWeeks === 'custom'
      ? parseInt(customWeeks)
      : rotationWeeks

    // Validate custom weeks input
    if (rotationWeeks === 'custom' && (!customWeeks || isNaN(finalRotationWeeks) || finalRotationWeeks < 1)) {
      setError('Please enter a valid number of weeks.')
      setLoading(false)
      return
    }

    // Step 1: Update the organisation name
    const { error: orgError } = await supabase
      .from('organisations')
      .update({ name: orgName })
      .eq('id', org.id)

    if (orgError) {
      setError('Failed to update organisation name.')
      setLoading(false)
      return
    }

    // Step 2: Save or update the schedule config
    // 'upsert' means: insert if it doesn't exist, update if it does
    // onConflict: 'org_id' tells it to update the existing row if org_id already exists
    const { error: configError } = await supabase
      .from('schedule_config')
      .upsert({
        org_id: org.id,
        rotation_type: finalRotationWeeks === 1 ? 'none' : `${finalRotationWeeks}week`,
        rotation_weeks: finalRotationWeeks,
        cycle_start_date: cycleStartDate || null,
        working_days: workingDays,
      }, { onConflict: 'org_id' })

    if (configError) {
      setError('Failed to save schedule config.')
      setLoading(false)
      return
    }

    setSaved(true)
    setLoading(false)

    // Hide the success message after 3 seconds
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleDay = (day) => {
    // Flip the boolean for the clicked day
    setWorkingDays(prev => ({ ...prev, [day]: !prev[day] }))
  }

  // The rotation options shown as buttons
  const rotationOptions = [
    { label: 'No Rotation', value: 1, description: 'Same schedule every week' },
    { label: '2 Weeks', value: 2, description: 'Alternating 2 week cycle' },
    { label: '3 Weeks', value: 3, description: 'Rotating 3 week cycle' },
    { label: '4 Weeks', value: 4, description: 'Standard 4 week cycle' },
    { label: 'Custom', value: 'custom', description: 'Set your own cycle length' },
  ]

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="max-w-2xl flex flex-col gap-8">

      {/* Page title */}
      <div>
        <h2 className="text-[22px] font-bold text-label tracking-[-0.03em]">Settings</h2>
        <p className="text-label2 mt-1 text-[14px]">Configure your organisation and schedule preferences</p>
      </div>

      {/* Organisation name */}
      <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-6 flex flex-col gap-4">
        <h3 className="text-label font-semibold text-[15px]">Organisation</h3>
        <div>
          <label className={fieldLabelClass}>Organisation Name</label>
          <input
            type="text"
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            className={fieldClass}
            placeholder="e.g. Riverside Medical Practice"
          />
        </div>
      </div>

      {/* Rotation type */}
      <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-label font-semibold text-[15px]">Schedule Rotation</h3>
          <p className="text-label2 text-[12.5px] mt-1">
            How many weeks before the schedule repeats?
          </p>
        </div>

        {/* Rotation option buttons */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {rotationOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setRotationWeeks(option.value)}
              className={`p-3 rounded-[12px] border text-left transition-colors ${
                rotationWeeks === option.value
                  ? 'border-accent bg-accent/10'
                  : 'border-sep bg-fill hover:border-label3'
              }`}
            >
              <p className={`font-semibold text-[13.5px] ${rotationWeeks === option.value ? 'text-accent' : 'text-label'}`}>{option.label}</p>
              <p className="text-[11.5px] mt-0.5 text-label3">{option.description}</p>
            </button>
          ))}
        </div>

        {/* Custom weeks input - only shown when Custom is selected */}
        {rotationWeeks === 'custom' && (
          <div>
            <label className={fieldLabelClass}>Number of Weeks</label>
            <input
              type="number"
              min="1"
              max="52"
              value={customWeeks}
              onChange={e => setCustomWeeks(e.target.value)}
              className={`${fieldClass} w-32`}
              placeholder="e.g. 6"
            />
          </div>
        )}
      </div>

      {/* Cycle start date - only shown if rotation is more than 1 week */}
      {rotationWeeks !== 1 && (
        <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-label font-semibold text-[15px]">Cycle Start Date</h3>
            <p className="text-label2 text-[12.5px] mt-1">
              Which Monday does Week 1 of the rotation start from?
              All rotation week calculations are based on this date.
            </p>
          </div>
          <input
            type="date"
            value={cycleStartDate}
            onChange={e => setCycleStartDate(e.target.value)}
            className={`${fieldClass} w-auto`}
          />
        </div>
      )}

      {/* Working days */}
      <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-label font-semibold text-[15px]">Working Days</h3>
          <p className="text-label2 text-[12.5px] mt-1">
            Which days does your practice operate?
            Disabled days won't show in the calendar.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {days.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`h-9 px-4 rounded-[10px] text-[13.5px] font-medium transition-all border ${
                workingDays[day]
                  ? 'bg-accent text-white border-transparent'
                  : 'bg-fill text-label2 border-sep hover:text-label'
              }`}
            >
              {/* Show 3-letter abbreviation */}
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Error message */}
      {error && <p className="text-red-500 text-[13.5px]">{error}</p>}

      {/* Success message */}
      {saved && (
        <p className="text-emerald-600 dark:text-emerald-400 text-[13.5px]">✓ Settings saved successfully</p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="self-start h-11 px-8 bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-[12px] transition-all"
      >
        {loading ? 'Saving...' : 'Save Settings'}
      </button>

    </div>
  )
}
