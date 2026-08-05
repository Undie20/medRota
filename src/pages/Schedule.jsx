// Schedule.jsx - the main calendar page
// Shows doctor slots in day, week, or month view
// Supports flexible rotations (1 week, 2 week, 4 week, custom, or none)
// Admins can add, edit and cancel slots manually
// The quick-add bar uses a free local command parser (no API needed)
// Cancellations use one-off exceptions so rotation patterns stay intact
// add_recurring intent adds a slot across all rotation weeks at once

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { parseCommand } from '../lib/commandParser'
import GlassCard from '../components/ui/GlassCard'
import GlassButton from '../components/ui/GlassButton'
import GlassInput from '../components/ui/GlassInput'
import GlassLabel from '../components/ui/GlassLabel'
import GlassModal from '../components/ui/GlassModal'
import {
  getRotationWeek,
  getWeekDates,
  getMonthDates,
  formatDisplayDate,
  formatMonthYear,
  formatDayFull,
  navigateDate,
  getActiveDays,
  getDayName,
  isSameDay,
  isSameMonth,
} from '../lib/scheduleUtils'

export default function Schedule({ org, profile }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('week')
  const [scheduleConfig, setScheduleConfig] = useState(null)
  const [slots, setSlots] = useState([])
  const [doctors, setDoctors] = useState([])
  const [staffList, setStaffList] = useState([])
  const [slotStaff, setSlotStaff] = useState([])
  const [slotExceptions, setSlotExceptions] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedCell, setSelectedCell] = useState(null)
  const [formDoctorId, setFormDoctorId] = useState('')
  const [formLabel, setFormLabel] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('17:00')
  const [formWeekNumber, setFormWeekNumber] = useState(1)
  const [formDayOfWeek, setFormDayOfWeek] = useState('Monday')
  const [formNotes, setFormNotes] = useState('')
  const [formStaffIds, setFormStaffIds] = useState([])
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  // ─── DATA FETCHING ────────────────────────────────────────────────

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('org_id', org.id)
      .single()
    if (data) setScheduleConfig(data)
  }

  const fetchSlots = async () => {
    const { data } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('org_id', org.id)
    if (data) setSlots(data)
  }

  const fetchDoctors = async () => {
    const { data } = await supabase
      .from('doctors')
      .select('*')
      .eq('org_id', org.id)
      .order('name')
    if (data) setDoctors(data)
  }

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('org_id', org.id)
      .order('name')
    if (data) setStaffList(data)
  }

  const fetchSlotStaff = async () => {
    const { data } = await supabase
      .from('slot_staff')
      .select('*')
    if (data) setSlotStaff(data)
  }

  const fetchSlotExceptions = async () => {
    // Fetch all one-off date-specific cancellations for this org
    const { data } = await supabase
      .from('slot_exceptions')
      .select('*')
      .eq('org_id', org.id)
    if (data) setSlotExceptions(data)
  }

  useEffect(() => {
    if (org) {
      fetchConfig()
      fetchSlots()
      fetchDoctors()
      fetchStaff()
      fetchSlotStaff()
      fetchSlotExceptions()
    }
  }, [org])

  // ─── DERIVED VALUES ───────────────────────────────────────────────

  const rotationWeeks = scheduleConfig?.rotation_weeks || 1
  const cycleStartDate = scheduleConfig?.cycle_start_date
  const workingDays = scheduleConfig?.working_days
  const activeDays = getActiveDays(workingDays)
  const getWeekNum = (date) => getRotationWeek(date, cycleStartDate, rotationWeeks)

  // ─── SLOT LOOKUP HELPERS ──────────────────────────────────────────

  const getSlotsForCell = (dayName, weekNumber) => {
    return slots.filter(slot => {
      if (slot.day_of_week !== dayName) return false
      if (rotationWeeks > 1 && slot.week_number !== weekNumber) return false
      return true
    })
  }

  const getSlotsForDate = (date) => {
    const dayName = getDayName(date)
    const weekNum = getWeekNum(date)
    return getSlotsForCell(dayName, weekNum)
  }

  const getDoctorForSlot = (slot) => doctors.find(d => d.id === slot.doctor_id)

  const getStaffForSlot = (slotId) => {
    const assignments = slotStaff.filter(ss => ss.slot_id === slotId)
    return assignments.map(a => staffList.find(s => s.id === a.staff_id)).filter(Boolean)
  }

  // Checks if a slot is cancelled on a specific calendar date
  // Checks one-off exceptions first, then falls back to the permanent pattern flag
  const isSlotCancelledOnDate = (slot, date) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0]
      const exception = slotExceptions.find(
        e => e.slot_id === slot.id && e.exception_date === dateStr
      )
      // If a one-off exception exists for this date, use it
      if (exception) return exception.is_cancelled
    }
    // No exception — fall back to the slot's permanent cancelled state
    return slot.is_cancelled
  }

  // ─── MODAL HELPERS ────────────────────────────────────────────────

  const openAddModal = (dayName, weekNumber) => {
    setSelectedSlot(null)
    setSelectedCell({ dayName, weekNumber })
    setFormDoctorId(doctors[0]?.id || '')
    setFormLabel('')
    setFormLocation('')
    setFormStartTime('09:00')
    setFormEndTime('17:00')
    setFormWeekNumber(weekNumber)
    setFormDayOfWeek(dayName)
    setFormNotes('')
    setFormStaffIds([])
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (slot) => {
    setSelectedSlot(slot)
    setSelectedCell(null)
    setFormDoctorId(slot.doctor_id)
    setFormLabel(slot.slot_label || '')
    setFormLocation(slot.location || '')
    setFormStartTime(slot.start_time || '09:00')
    setFormEndTime(slot.end_time || '17:00')
    setFormWeekNumber(slot.week_number || 1)
    setFormDayOfWeek(slot.day_of_week)
    setFormNotes(slot.notes || '')
    const assigned = slotStaff.filter(ss => ss.slot_id === slot.id).map(ss => ss.staff_id)
    setFormStaffIds(assigned)
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedSlot(null)
    setSelectedCell(null)
  }

  const toggleStaff = (staffId) => {
    setFormStaffIds(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    )
  }

  // ─── COMMAND PARSER HANDLER ───────────────────────────────────────

  const handleAiParse = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)
    setAiError('')

    try {
      const result = parseCommand(
        aiInput,
        doctors,
        staffList,
        currentDate,
        rotationWeeks,
        cycleStartDate
      )

      // Debug log — remove this once everything is working
      console.log('Parser result:', JSON.stringify(result))

      if (!result) {
        setAiError('Could not understand that. Try: "Dr X is away Friday" or "Dr X has a clinic at Location, Thursday 9am-5pm"')
        setAiLoading(false)
        return
      }

      // ── CANCEL ──────────────────────────────────────────────────
      // Uses one-off exceptions so only THIS occurrence is cancelled
      // The rotation pattern itself is never touched
      if (result.intent === 'cancel') {
        if (!result.doctor) {
          setAiError('Could not find that doctor. Check the name and try again.')
          setAiLoading(false)
          return
        }

        // Find which slots match this doctor + day + rotation week
        const toCancel = slots.filter(s =>
          s.doctor_id === result.doctor.id &&
          (!result.dayOfWeek || s.day_of_week === result.dayOfWeek) &&
          (rotationWeeks === 1 || s.week_number === result.rotationWeekNum)
        )

        for (const slot of toCancel) {
          // Find the specific calendar dates in the affected week that match this slot's day
          const matchingDates = result.affectedWeekDates.filter(
            d => getDayName(d) === slot.day_of_week
          )
          for (const date of matchingDates) {
            const dateStr = date.toISOString().split('T')[0]
            // Insert a one-off exception for this specific date only
            await supabase
              .from('slot_exceptions')
              .upsert({
                org_id: org.id,
                slot_id: slot.id,
                exception_date: dateStr,
                is_cancelled: true,
              }, { onConflict: 'slot_id,exception_date' })
          }
        }

        await fetchSlots()
        await fetchSlotExceptions()
        setAiInput('')
        setAiLoading(false)
        return
      }

      // ── RESTORE ──────────────────────────────────────────────────
      // Sets is_cancelled = false on the exception for this specific date
      if (result.intent === 'restore') {
        if (!result.doctor) {
          setAiError('Could not find that doctor.')
          setAiLoading(false)
          return
        }

        const toRestore = slots.filter(s =>
          s.doctor_id === result.doctor.id &&
          (!result.dayOfWeek || s.day_of_week === result.dayOfWeek) &&
          (rotationWeeks === 1 || s.week_number === result.rotationWeekNum)
        )

        for (const slot of toRestore) {
          const matchingDates = result.affectedWeekDates.filter(
            d => getDayName(d) === slot.day_of_week
          )
          for (const date of matchingDates) {
            const dateStr = date.toISOString().split('T')[0]
            await supabase
              .from('slot_exceptions')
              .upsert({
                org_id: org.id,
                slot_id: slot.id,
                exception_date: dateStr,
                is_cancelled: false,
              }, { onConflict: 'slot_id,exception_date' })
          }
        }

        await fetchSlots()
        await fetchSlotExceptions()
        setAiInput('')
        setAiLoading(false)
        return
      }

      // ── ADD ───────────────────────────────────────────────────────
      // Opens the modal pre-filled so the user can review before saving
      if (result.intent === 'add') {
        setSelectedSlot(null)
        setSelectedCell(null)
        setFormDoctorId(result.doctor?.id || doctors[0]?.id || '')
        setFormDayOfWeek(result.dayOfWeek || activeDays[0])
        setFormStartTime(result.startTime || '09:00')
        setFormEndTime(result.endTime || '17:00')
        setFormLabel(result.slotLabel || '')
        setFormLocation(result.location || '')
        setFormWeekNumber(result.rotationWeekNum || 1)
        setFormNotes('')
        setFormStaffIds(result.staff?.map(s => s.id) || [])
        setFormError('')
        setAiInput('')
        setModalOpen(true)
        setAiLoading(false)
        return
      }

      // ── ADD RECURRING ─────────────────────────────────────────────
      // Adds a slot for EVERY rotation week on the specified day
      // e.g. "Dr Andy has a clinic every Friday" inserts a slot for
      // week 1 Friday, week 2 Friday, week 3 Friday, week 4 Friday
      if (result.intent === 'add_recurring') {
        if (!result.doctor) {
          setAiError('Could not find that doctor.')
          setAiLoading(false)
          return
        }
        if (!result.dayOfWeek) {
          setAiError('Could not find a day in that command.')
          setAiLoading(false)
          return
        }

        // Insert one slot per rotation week
        const insertedSlotIds = []
        for (let week = 1; week <= rotationWeeks; week++) {
          const { data, error } = await supabase
            .from('schedule_slots')
            .insert({
              org_id: org.id,
              doctor_id: result.doctor.id,
              // Only store week_number if rotation is more than 1 week
              week_number: rotationWeeks > 1 ? week : null,
              day_of_week: result.dayOfWeek,
              slot_label: result.slotLabel || '',
              location: result.location || '',
              start_time: result.startTime || '09:00',
              end_time: result.endTime || '17:00',
              is_cancelled: false,
            })
            .select()
            .single()

          if (!error && data) {
            insertedSlotIds.push(data.id)
          }
        }

        // Assign staff to all the newly created slots
        if (result.staff?.length > 0 && insertedSlotIds.length > 0) {
          const staffAssignments = insertedSlotIds.flatMap(slotId =>
            result.staff.map(s => ({ slot_id: slotId, staff_id: s.id }))
          )
          await supabase.from('slot_staff').insert(staffAssignments)
        }

        await fetchSlots()
        await fetchSlotStaff()
        setAiInput('')
        setAiLoading(false)
        return
      }

    } catch (err) {
      console.error(err)
      setAiError('Something went wrong. Please try again.')
    }

    setAiLoading(false)
  }

  // ─── SLOT CRUD ────────────────────────────────────────────────────

  const handleSaveSlot = async () => {
    setFormLoading(true)
    setFormError('')

    if (!formDoctorId) {
      setFormError('Please select a doctor.')
      setFormLoading(false)
      return
    }

    const slotData = {
      org_id: org.id,
      doctor_id: formDoctorId,
      week_number: rotationWeeks > 1 ? formWeekNumber : null,
      day_of_week: formDayOfWeek,
      slot_label: formLabel,
      location: formLocation,
      start_time: formStartTime,
      end_time: formEndTime,
      notes: formNotes,
      is_cancelled: false,
    }

    let slotId = selectedSlot?.id

    if (selectedSlot) {
      const { error } = await supabase
        .from('schedule_slots')
        .update(slotData)
        .eq('id', selectedSlot.id)
      if (error) { setFormError(error.message); setFormLoading(false); return }
    } else {
      const { data, error } = await supabase
        .from('schedule_slots')
        .insert(slotData)
        .select()
        .single()
      if (error) { setFormError(error.message); setFormLoading(false); return }
      slotId = data.id
    }

    await supabase.from('slot_staff').delete().eq('slot_id', slotId)
    if (formStaffIds.length > 0) {
      await supabase.from('slot_staff').insert(
        formStaffIds.map(staffId => ({ slot_id: slotId, staff_id: staffId }))
      )
    }

    await fetchSlots()
    await fetchSlotStaff()
    closeModal()
    setFormLoading(false)
  }

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Delete this slot?')) return
    await supabase.from('schedule_slots').delete().eq('id', slotId)
    await fetchSlots()
    await fetchSlotStaff()
    closeModal()
  }

  const handleCancelSlot = async (slotId) => {
    // Manual cancel button in the edit modal
    // Permanently toggles the slot pattern
    // Use the command bar for one-off cancellations
    const slot = slots.find(s => s.id === slotId)
    await supabase
      .from('schedule_slots')
      .update({ is_cancelled: !slot.is_cancelled })
      .eq('id', slotId)
    await fetchSlots()
  }

  // ─── RENDER HELPERS ───────────────────────────────────────────────

  // date param is optional — when provided, checks one-off exceptions for that date
  const renderSlotCard = (slot, date = null) => {
    const doctor = getDoctorForSlot(slot)
    const assignedStaff = getStaffForSlot(slot.id)
    const isCancelled = isSlotCancelledOnDate(slot, date)

    return (
      <div
        key={slot.id}
        onClick={(e) => { e.stopPropagation(); openEditModal(slot) }}
        className={`rounded-lg p-2 cursor-pointer text-xs space-y-0.5 backdrop-blur-xl border border-white/5 transition-all ${
          isCancelled ? 'opacity-40 line-through' : 'hover:-translate-y-0.5 hover:brightness-110'
        }`}
        style={{
          backgroundColor: (doctor?.color || '#3b82f6') + '2b',
          borderLeft: `3px solid ${doctor?.color || '#3b82f6'}`
        }}
      >
        <p className="font-semibold text-white truncate">{doctor?.name || 'Unknown'}</p>
        {slot.slot_label && <p className="text-slate-300 truncate">{slot.slot_label}</p>}
        {slot.start_time && <p className="text-slate-400">{slot.start_time} – {slot.end_time}</p>}
        {slot.location && <p className="text-slate-400 truncate">📍 {slot.location}</p>}
        {assignedStaff.length > 0 && (
          <p className="text-slate-400 truncate">
            👤 {assignedStaff.map(s => s.name).join(', ')}
          </p>
        )}
        {isCancelled && <p className="text-red-400 font-medium">CANCELLED</p>}
      </div>
    )
  }

  // date param passed through so exceptions can be checked per actual calendar date
  const renderCell = (dayName, weekNumber, isToday = false, date = null) => {
    const cellSlots = getSlotsForCell(dayName, weekNumber)

    return (
      <div
        key={`${dayName}-${weekNumber}`}
        onClick={() => openAddModal(dayName, weekNumber)}
        className={`min-h-24 p-2 rounded-xl border backdrop-blur-xl cursor-pointer transition-colors space-y-1 ${
          isToday
            ? 'border-accent-blue/50 bg-accent-blue/5'
            : 'border-glass-border bg-glass-50 hover:border-glass-border-strong'
        }`}
      >
        {cellSlots.map(slot => renderSlotCard(slot, date))}
        {cellSlots.length === 0 && (
          <p className="text-slate-700 text-xs text-center pt-4">+ Add</p>
        )}
      </div>
    )
  }

  // ─── VIEWS ────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    const activeWeekDates = weekDates.filter(d => activeDays.includes(getDayName(d)))
    const today = new Date()

    return (
      <div>
        <div
          className="grid gap-2 mb-2"
          style={{ gridTemplateColumns: `repeat(${activeWeekDates.length}, 1fr)` }}
        >
          {activeWeekDates.map(date => (
            <div key={date.toISOString()} className="text-center">
              <p className="text-slate-400 text-xs uppercase tracking-widest">
                {getDayName(date).slice(0, 3)}
              </p>
              <p className={`text-sm font-semibold mt-0.5 ${
                isSameDay(date, today) ? 'text-blue-400' : 'text-white'
              }`}>
                {date.getDate()}
              </p>
              {rotationWeeks > 1 && (
                <p className="text-slate-600 text-xs">Wk {getWeekNum(date)}</p>
              )}
            </div>
          ))}
        </div>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${activeWeekDates.length}, 1fr)` }}
        >
          {activeWeekDates.map(date => {
            const weekNum = getWeekNum(date)
            // Pass the actual date so renderCell checks one-off exceptions
            return renderCell(getDayName(date), weekNum, isSameDay(date, today), date)
          })}
        </div>
      </div>
    )
  }

  const renderDayView = () => {
    const dayName = getDayName(currentDate)
    const weekNum = getWeekNum(currentDate)
    const today = new Date()
    const isToday = isSameDay(currentDate, today)
    const daySlots = getSlotsForDate(currentDate)

    return (
      <div className="max-w-lg">
        <div className={`rounded-xl border backdrop-blur-xl bg-glass-50 p-4 space-y-2 ${
          isToday ? 'border-accent-blue/50' : 'border-glass-border'
        }`}>
          {rotationWeeks > 1 && weekNum && (
            <p className="text-blue-400 text-xs font-medium uppercase tracking-widest">
              Rotation Week {weekNum}
            </p>
          )}
          {daySlots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">No clinics scheduled</p>
              <button
                onClick={() => openAddModal(dayName, weekNum || 1)}
                className="mt-3 text-blue-400 text-sm hover:text-blue-300"
              >
                + Add a slot
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Pass currentDate so exceptions are checked for this specific date */}
              {daySlots.map(slot => renderSlotCard(slot, currentDate))}
              <button
                onClick={() => openAddModal(dayName, weekNum || 1)}
                className="w-full text-slate-600 hover:text-slate-400 text-xs py-2 border border-dashed border-glass-border rounded-lg transition-colors"
              >
                + Add slot
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const today = new Date()

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-slate-500 text-xs py-1 uppercase tracking-widest">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDates.map(date => {
            const dayName = getDayName(date)
            const weekNum = getWeekNum(date)
            const isActive = activeDays.includes(dayName)
            const isCurrentMonth = isSameMonth(date, currentDate)
            const isToday = isSameDay(date, today)
            const daySlots = isActive ? getSlotsForDate(date) : []

            return (
              <div
                key={date.toISOString()}
                onClick={() => isActive && openAddModal(dayName, weekNum || 1)}
                className={`min-h-16 p-1 rounded-lg border backdrop-blur-xl text-xs transition-colors ${
                  isToday ? 'border-accent-blue/50 bg-accent-blue/5' :
                  isCurrentMonth && isActive
                    ? 'border-glass-border bg-glass-50 hover:border-glass-border-strong cursor-pointer'
                    : 'border-transparent'
                } ${!isCurrentMonth ? 'opacity-30' : ''}`}
              >
                <p className={`font-medium mb-1 ${
                  isToday ? 'text-blue-400' : 'text-slate-400'
                }`}>
                  {date.getDate()}
                </p>
                {daySlots.slice(0, 2).map(slot => {
                  const doctor = getDoctorForSlot(slot)
                  const isCancelled = isSlotCancelledOnDate(slot, date)
                  return (
                    <div
                      key={slot.id}
                      className={`rounded px-1 py-0.5 mb-0.5 truncate text-white ${isCancelled ? 'opacity-40 line-through' : ''}`}
                      style={{ backgroundColor: doctor?.color || '#3b82f6' }}
                      onClick={(e) => { e.stopPropagation(); openEditModal(slot) }}
                    >
                      {doctor?.name?.split(' ').pop()}
                    </div>
                  )
                })}
                {daySlots.length > 2 && (
                  <p className="text-slate-500">+{daySlots.length - 2} more</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const getViewTitle = () => {
    if (view === 'day') return formatDayFull(currentDate)
    if (view === 'week') {
      const dates = getWeekDates(currentDate)
      return `${formatDisplayDate(dates[0])} — ${formatDisplayDate(dates[6])}`
    }
    return formatMonthYear(currentDate)
  }

  // ─── MAIN RENDER ──────────────────────────────────────────────────

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 space-y-4 min-w-0">

        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentDate(navigateDate(currentDate, -1, view))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-glass-50 border border-glass-border backdrop-blur-xl hover:bg-glass-100 text-white transition-colors"
              >‹</button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-lg bg-glass-50 border border-glass-border backdrop-blur-xl hover:bg-glass-100 text-white text-xs font-medium transition-colors"
              >Today</button>
              <button
                onClick={() => setCurrentDate(navigateDate(currentDate, 1, view))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-glass-50 border border-glass-border backdrop-blur-xl hover:bg-glass-100 text-white transition-colors"
              >›</button>
              <h2 className="text-white font-semibold text-sm">{getViewTitle()}</h2>
            </div>
            <div className="flex items-center gap-2">
              {['day', 'week', 'month'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all backdrop-blur-xl border ${
                    view === v
                      ? 'bg-gradient-to-b from-accent-blue to-[#3f5fc4] text-white border-white/20 shadow-glow-accent'
                      : 'bg-glass-50 text-slate-400 hover:text-white border-glass-border'
                  }`}
                >{v}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassInput
              type="text"
              value={aiInput}
              onChange={e => { setAiInput(e.target.value); setAiError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAiParse()}
              placeholder='✦ e.g. "Dr Andy is away Friday" or "Dr Andy has a clinic every Friday 9am-5pm at Brisbane Radiology, Athauv is taking care of it"'
              className="flex-1 px-4 py-2"
            />
            <GlassButton
              onClick={handleAiParse}
              disabled={aiLoading || !aiInput.trim()}
              className="px-4 py-2 whitespace-nowrap"
            >{aiLoading ? 'Working...' : 'Run'}</GlassButton>
          </div>
          {aiError && <p className="text-red-400 text-xs px-1">{aiError}</p>}
        </div>

        {!scheduleConfig && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-xl rounded-xl p-4">
            <p className="text-yellow-400 text-sm">
              ⚠️ No schedule config found. Go to Settings to configure your rotation.
            </p>
          </div>
        )}

        <div className="rounded-xl">
          {view === 'day' && renderDayView()}
          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>
      </div>

      <GlassModal open={modalOpen} onClose={closeModal} className="space-y-4 max-h-[90vh] overflow-y-auto">

        <h3 className="text-white font-bold text-lg">
          {selectedSlot
            ? 'Edit Slot'
            : `Add Slot — ${formDayOfWeek}${rotationWeeks > 1 ? ` (Week ${formWeekNumber})` : ''}`
          }
        </h3>

            <div>
              <GlassLabel>Doctor</GlassLabel>
              <GlassInput
                as="select"
                value={formDoctorId}
                onChange={e => setFormDoctorId(e.target.value)}
              >
                <option value="">Select a doctor</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </GlassInput>
            </div>

            {rotationWeeks > 1 && (
              <div>
                <GlassLabel>Rotation Week</GlassLabel>
                <GlassInput
                  as="select"
                  value={formWeekNumber}
                  onChange={e => setFormWeekNumber(parseInt(e.target.value))}
                >
                  {Array.from({ length: rotationWeeks }, (_, i) => i + 1).map(w => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </GlassInput>
              </div>
            )}

            <div>
              <GlassLabel>Day</GlassLabel>
              <GlassInput
                as="select"
                value={formDayOfWeek}
                onChange={e => setFormDayOfWeek(e.target.value)}
              >
                {activeDays.map(d => <option key={d} value={d}>{d}</option>)}
              </GlassInput>
            </div>

            <div>
              <GlassLabel>Clinic Label</GlassLabel>
              <GlassInput
                type="text"
                value={formLabel}
                onChange={e => setFormLabel(e.target.value)}
                placeholder="e.g. Morning Clinic, Ward Round, Telehealth"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <GlassLabel>Start</GlassLabel>
                <GlassInput
                  type="time"
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                />
              </div>
              <div>
                <GlassLabel>End</GlassLabel>
                <GlassInput
                  type="time"
                  value={formEndTime}
                  onChange={e => setFormEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <GlassLabel>Location</GlassLabel>
              <GlassInput
                type="text"
                value={formLocation}
                onChange={e => setFormLocation(e.target.value)}
                placeholder="e.g. Room 3B, Brisbane Radiology"
              />
            </div>

            <div>
              <GlassLabel>Assign Staff</GlassLabel>
              {staffList.length === 0 ? (
                <p className="text-slate-600 text-xs">No staff added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {staffList.map(member => (
                    <button
                      key={member.id}
                      onClick={() => toggleStaff(member.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-xl border transition-colors ${
                        formStaffIds.includes(member.id) ? 'text-white border-white/20' : 'bg-glass-50 border-glass-border text-slate-400 hover:text-white'
                      }`}
                      style={formStaffIds.includes(member.id) ? { backgroundColor: member.color } : {}}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <GlassLabel>Notes</GlassLabel>
              <GlassInput
                as="textarea"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                className="resize-none"
                rows={2}
                placeholder="Any additional notes..."
              />
            </div>

            {formError && <p className="text-red-400 text-xs">{formError}</p>}

            <div className="flex gap-3 pt-2">
              <GlassButton
                onClick={handleSaveSlot}
                disabled={formLoading}
                className="flex-1"
              >
                {formLoading ? 'Saving...' : selectedSlot ? 'Save Changes' : 'Add Slot'}
              </GlassButton>
              <GlassButton
                variant="secondary"
                onClick={closeModal}
                className="flex-1"
              >
                Cancel
              </GlassButton>
            </div>

            {selectedSlot && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleCancelSlot(selectedSlot.id)}
                  className="flex-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg py-2 text-xs font-medium transition-colors"
                >
                  {selectedSlot.is_cancelled ? 'Restore Slot' : 'Mark Cancelled'}
                </button>
                <button
                  onClick={() => handleDeleteSlot(selectedSlot.id)}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg py-2 text-xs font-medium transition-colors"
                >
                  Delete Slot
                </button>
              </div>
            )}

      </GlassModal>
    </div>
  )
}