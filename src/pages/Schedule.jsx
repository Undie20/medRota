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
  getTargetWeeks,
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
  // formIsOneOff: when true, this slot exists on formOneOffDate only and
  // never recurs — it ignores the week_number rotation pattern entirely
  const [formIsOneOff, setFormIsOneOff] = useState(false)
  const [formOneOffDate, setFormOneOffDate] = useState(null)
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

  // Formats a Date as YYYY-MM-DD using LOCAL date parts (not toISOString,
  // which converts to UTC first and can shift the date by a day for
  // timezones ahead of UTC — exactly the kind of one-day-off bug we don't
  // want to bake into a brand new feature)
  const formatDateOnly = (date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Parses a YYYY-MM-DD string back into a local Date (avoids the same
  // UTC-shift problem `new Date('YYYY-MM-DD')` has)
  const parseDateOnly = (str) => {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  // Pattern slots only — excludes one-off slots, which are matched by
  // exact date instead (see getOneOffSlotsForDate) regardless of rotation
  const getSlotsForCell = (dayName, weekNumber) => {
    return slots.filter(slot => {
      if (slot.one_off_date) return false
      if (slot.day_of_week !== dayName) return false
      if (rotationWeeks > 1 && slot.week_number !== weekNumber) return false
      return true
    })
  }

  // One-off slots that land on this exact calendar date
  const getOneOffSlotsForDate = (date) => {
    const dateStr = formatDateOnly(date)
    return slots.filter(slot => slot.one_off_date === dateStr)
  }

  const getSlotsForDate = (date) => {
    const dayName = getDayName(date)
    const weekNum = getWeekNum(date)
    return [...getSlotsForCell(dayName, weekNum), ...getOneOffSlotsForDate(date)]
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

  // date is the actual calendar date the user clicked — needed so we can
  // save a genuine one-off (formIsOneOff) slot tied to that exact date
  const openAddModal = (dayName, weekNumber, date = null) => {
    setSelectedSlot(null)
    setSelectedCell({ dayName, weekNumber, date })
    setFormDoctorId(doctors[0]?.id || '')
    setFormLabel('')
    setFormLocation('')
    setFormStartTime('09:00')
    setFormEndTime('17:00')
    setFormWeekNumber(weekNumber)
    setFormDayOfWeek(dayName)
    setFormIsOneOff(false)
    setFormOneOffDate(date)
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
    setFormIsOneOff(!!slot.one_off_date)
    setFormOneOffDate(slot.one_off_date ? parseDateOnly(slot.one_off_date) : null)
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
    setFormIsOneOff(false)
    setFormOneOffDate(null)
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

        // Find which slots match this doctor + day(s) + rotation week
        // daysOfWeek covers multi-day commands like "Monday and Wednesday"
        const toCancel = slots.filter(s =>
          s.doctor_id === result.doctor.id &&
          (!result.daysOfWeek?.length || result.daysOfWeek.includes(s.day_of_week)) &&
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
          (!result.daysOfWeek?.length || result.daysOfWeek.includes(s.day_of_week)) &&
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
        // affectedDate is the exact calendar date the command resolved to —
        // pass it through so the "One-off — this date only" toggle is
        // available, and auto-check it when the phrasing said "only" /
        // "just this once" / etc (see isOneOff in commandParser.js)
        setFormOneOffDate(result.affectedDate || null)
        setFormIsOneOff(!!result.isOneOff)
        setFormNotes('')
        setFormStaffIds(result.staff?.map(s => s.id) || [])
        setFormError('')
        setAiInput('')
        setModalOpen(true)
        setAiLoading(false)
        return
      }

      // ── ADD RECURRING ─────────────────────────────────────────────
      // Adds a slot across the rotation weeks that match the requested
      // interval — e.g. "Dr Andy has a clinic every Friday" hits every
      // rotation week, but "every 3rd week" or "fortnightly" only hits
      // the weeks that pattern actually lands on (see getTargetWeeks).
      // Also covers multiple days at once, e.g. "every Monday and Wednesday"
      if (result.intent === 'add_recurring') {
        if (!result.doctor) {
          setAiError('Could not find that doctor.')
          setAiLoading(false)
          return
        }
        if (!result.daysOfWeek?.length) {
          setAiError('Could not find a day in that command.')
          setAiLoading(false)
          return
        }

        const targetWeeks = getTargetWeeks(rotationWeeks, result.interval, result.startWeek)

        // Insert one slot per target week, per mentioned day
        const insertedSlotIds = []
        for (const dayOfWeek of result.daysOfWeek) {
          for (const week of targetWeeks) {
            const { data, error } = await supabase
              .from('schedule_slots')
              .insert({
                org_id: org.id,
                doctor_id: result.doctor.id,
                // Only store week_number if rotation is more than 1 week
                week_number: rotationWeeks > 1 ? week : null,
                day_of_week: dayOfWeek,
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

    if (formIsOneOff && !formOneOffDate) {
      setFormError('Could not determine the date for this one-off slot.')
      setFormLoading(false)
      return
    }

    // A one-off slot is tied to one exact date and ignores the rotation
    // pattern entirely, so week_number is always null for it
    const slotData = {
      org_id: org.id,
      doctor_id: formDoctorId,
      week_number: (rotationWeeks > 1 && !formIsOneOff) ? formWeekNumber : null,
      day_of_week: formDayOfWeek,
      one_off_date: formIsOneOff ? formatDateOnly(formOneOffDate) : null,
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

  // ─── SHARED STYLES ────────────────────────────────────────────────

  const fieldClass =
    'w-full bg-surface border border-sep rounded-[12px] px-3.5 py-3 text-label text-[15px] placeholder:text-label3 focus:outline-none focus:border-accent transition-colors'
  const fieldLabelClass =
    'text-label3 text-[11.5px] font-semibold uppercase tracking-[0.07em] block mb-2 pl-1'

  // ─── RENDER HELPERS ───────────────────────────────────────────────

  // date param is optional — when provided, checks one-off exceptions for that date
  const renderSlotCard = (slot, date = null) => {
    const doctor = getDoctorForSlot(slot)
    const assignedStaff = getStaffForSlot(slot.id)
    const isCancelled = isSlotCancelledOnDate(slot, date)
    const color = doctor?.color || '#007AFF'

    return (
      <div
        key={slot.id}
        onClick={(e) => { e.stopPropagation(); openEditModal(slot) }}
        className={`rounded-[12px] px-[11px] py-2.5 cursor-pointer transition-all active:scale-[0.98] ${
          isCancelled ? 'opacity-55' : 'hover:brightness-[1.03]'
        }`}
        style={{
          backgroundColor: color + '18',
          boxShadow: `inset 0 0 0 1px ${color}26`,
        }}
      >
        <div className="flex items-center gap-[7px]">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: color }} />
          <p className="text-[13px] font-semibold text-label tracking-[-0.01em] truncate">
            {doctor?.name || 'Unknown'}
          </p>
          {slot.one_off_date && (
            <span className="text-label3 text-[9.5px] font-semibold uppercase tracking-[0.05em] bg-fill px-[5px] py-[1px] rounded-[4px] shrink-0">
              One-off
            </span>
          )}
        </div>
        {slot.slot_label && <p className="text-[12.5px] text-label2 mt-0.5 truncate">{slot.slot_label}</p>}
        {slot.start_time && (
          <p className="text-[12.5px] text-label2 tabular-nums whitespace-nowrap">
            {slot.start_time} – {slot.end_time}
          </p>
        )}
        {slot.location && <p className="text-[12px] text-label3 mt-0.5 truncate">{slot.location}</p>}
        {assignedStaff.length > 0 && (
          <p className="text-[12px] text-label3 truncate">
            {assignedStaff.map(s => s.name).join(', ')}
          </p>
        )}
        {isCancelled && (
          <span className="inline-block mt-1.5 px-[7px] py-0.5 rounded-md bg-red-500/15 text-red-500 text-[10.5px] font-semibold uppercase tracking-[0.05em]">
            Cancelled
          </span>
        )}
      </div>
    )
  }

  // date param passed through so exceptions can be checked per actual calendar
  // date, and so one-off slots (which live on a specific date, not a
  // day_of_week/week_number pattern) show up here too
  const renderCell = (dayName, weekNumber, isToday = false, date = null) => {
    const cellSlots = [
      ...getSlotsForCell(dayName, weekNumber),
      ...(date ? getOneOffSlotsForDate(date) : []),
    ]

    return (
      <div
        key={`${dayName}-${weekNumber}`}
        onClick={() => openAddModal(dayName, weekNumber, date)}
        className={`min-h-[150px] md:min-h-[190px] xl:min-h-[280px] p-2 rounded-[16px] border bg-surface shadow-ios cursor-pointer transition-colors flex flex-col gap-[7px] ${
          isToday ? 'border-accent' : 'border-sep hover:border-label3'
        }`}
      >
        {cellSlots.map(slot => renderSlotCard(slot, date))}
        <button className="text-label3 text-[13px] py-2 rounded-[10px] hover:bg-fill hover:text-accent transition-colors">
          + Add
        </button>
      </div>
    )
  }

  // ─── VIEWS ────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate)
    const activeWeekDates = weekDates.filter(d => activeDays.includes(getDayName(d)))
    const today = new Date()

    return (
      <div className="relative">
        {/* Edge arrows only where there's room for them */}
        <button
          onClick={() => setCurrentDate(navigateDate(currentDate, -1, view))}
          aria-label="Previous week"
          className="hidden xl:flex absolute left-[-20px] top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-surface border border-sep shadow-ios text-label2 text-[18px] leading-none hover:bg-fill hover:text-label transition-colors z-10"
        >‹</button>
        <button
          onClick={() => setCurrentDate(navigateDate(currentDate, 1, view))}
          aria-label="Next week"
          className="hidden xl:flex absolute right-[-20px] top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-surface border border-sep shadow-ios text-label2 text-[18px] leading-none hover:bg-fill hover:text-label transition-colors z-10"
        >›</button>

        {/* Wraps instead of squeezing: 1 column on a phone, 2-3 on a tablet,
            every active day on a laptop. 230px is the narrowest a slot card
            stays readable at. Day headers moved inside each column so the
            header row can't desync from the cells when they wrap. */}
        <div className="grid gap-2.5 md:gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {activeWeekDates.map(date => {
            const weekNum = getWeekNum(date)
            const isToday = isSameDay(date, today)
            return (
              <div key={date.toISOString()} className="flex flex-col gap-2 min-w-0">
                <div className="flex items-baseline gap-[7px] pl-1">
                  <span className="text-label3 text-[11px] font-semibold uppercase tracking-[0.07em]">
                    {getDayName(date).slice(0, 3)}
                  </span>
                  <span className={`text-[19px] font-bold tracking-[-0.03em] ${
                    isToday ? 'text-accent' : 'text-label'
                  }`}>
                    {date.getDate()}
                  </span>
                  {rotationWeeks > 1 && (
                    <span className="text-label3 text-[11px]">Wk {weekNum}</span>
                  )}
                </div>
                {/* Pass the actual date so renderCell checks one-off exceptions */}
                {renderCell(getDayName(date), weekNum, isToday, date)}
              </div>
            )
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
      <div className="w-full max-w-[560px] flex flex-col gap-3">
        {rotationWeeks > 1 && weekNum && (
          <p className="text-accent text-[12px] font-semibold uppercase tracking-[0.07em]">
            Rotation Week {weekNum}
          </p>
        )}
        <div className={`rounded-[18px] border bg-surface shadow-ios p-4 flex flex-col gap-2.5 ${
          isToday ? 'border-accent' : 'border-sep'
        }`}>
          {daySlots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-label2 text-[15px]">No clinics scheduled</p>
              <button
                onClick={() => openAddModal(dayName, weekNum || 1, currentDate)}
                className="mt-3 text-accent text-[15px] font-medium hover:opacity-70 transition-opacity"
              >
                + Add a slot
              </button>
            </div>
          ) : (
            <>
              {/* Pass currentDate so exceptions are checked for this specific date */}
              {daySlots.map(slot => renderSlotCard(slot, currentDate))}
              <button
                onClick={() => openAddModal(dayName, weekNum || 1, currentDate)}
                className="w-full text-label3 hover:text-accent hover:border-accent text-[13.5px] py-3 border border-dashed border-sep rounded-[12px] transition-colors"
              >
                + Add slot
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const renderMonthView = () => {
    const monthDates = getMonthDates(currentDate)
    const today = new Date()

    return (
      <div className="bg-surface border border-sep rounded-[18px] shadow-ios p-2 md:p-3.5 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-label3 text-[11px] font-semibold py-1 uppercase tracking-[0.07em]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
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
                onClick={() => isActive && openAddModal(dayName, weekNum || 1, date)}
                className={`min-h-[52px] md:min-h-[78px] p-1 md:p-1.5 rounded-[10px] md:rounded-[12px] border text-[12px] transition-colors ${
                  isToday
                    ? 'border-accent bg-accent/10'
                    : isCurrentMonth && isActive
                      ? 'border-transparent bg-bg hover:border-label3 cursor-pointer'
                      : 'border-transparent'
                } ${!isCurrentMonth ? 'opacity-35' : ''}`}
              >
                <p className={`text-[13px] mb-1 ${
                  isToday ? 'text-accent font-bold' : 'text-label2 font-medium'
                }`}>
                  {date.getDate()}
                </p>
                {daySlots.slice(0, 2).map(slot => {
                  const doctor = getDoctorForSlot(slot)
                  const isCancelled = isSlotCancelledOnDate(slot, date)
                  return (
                    <div
                      key={slot.id}
                      className={`rounded-md px-1.5 py-0.5 mb-0.5 truncate text-white text-[11px] font-medium ${
                        isCancelled ? 'opacity-40 line-through' : ''
                      }`}
                      style={{ backgroundColor: doctor?.color || '#007AFF' }}
                      onClick={(e) => { e.stopPropagation(); openEditModal(slot) }}
                    >
                      {doctor?.name?.split(' ').pop()}
                    </div>
                  )
                })}
                {daySlots.length > 2 && (
                  <p className="text-label3 text-[11px]">+{daySlots.length - 2} more</p>
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
      <div className="flex-1 flex flex-col gap-[18px] min-w-0">

        <div className="flex items-center justify-between flex-wrap gap-3.5">
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 p-0.5 bg-fill rounded-[10px]">
              <button
                onClick={() => setCurrentDate(navigateDate(currentDate, -1, view))}
                className="w-[30px] h-7 flex items-center justify-center rounded-lg text-label2 text-[17px] leading-none hover:bg-surface hover:text-label transition-colors"
              >‹</button>
              <button
                onClick={() => setCurrentDate(navigateDate(currentDate, 1, view))}
                className="w-[30px] h-7 flex items-center justify-center rounded-lg text-label2 text-[17px] leading-none hover:bg-surface hover:text-label transition-colors"
              >›</button>
            </div>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="h-8 px-3.5 rounded-[10px] bg-surface border border-sep text-label text-[13.5px] font-medium hover:bg-fill transition-colors"
            >Today</button>
            <h2 className="text-label text-[17px] md:text-[19px] lg:text-[22px] font-bold tracking-[-0.03em] truncate">{getViewTitle()}</h2>
          </div>
          <div className="flex p-0.5 bg-fill rounded-[10px]">
            {['day', 'week', 'month'].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`h-7 px-3.5 rounded-lg text-[13.5px] capitalize transition-colors ${
                  view === v
                    ? 'bg-surface text-label font-semibold shadow-sm'
                    : 'text-label2 font-medium hover:text-label'
                }`}
              >{v}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2.5 bg-glass backdrop-blur-xl border border-sep rounded-[14px] shadow-ios pl-3.5 pr-1.5 py-1.5 focus-within:border-accent transition-colors">
            <span className="text-accent text-[15px]">✦</span>
            <input
              type="text"
              value={aiInput}
              onChange={e => { setAiInput(e.target.value); setAiError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAiParse()}
              placeholder='e.g. "Dr Andy is away Friday" or "Dr Andy has a clinic every Friday 9am-5pm at Brisbane Radiology, Athauv is taking care of it"'
              className="flex-1 min-w-0 bg-transparent border-0 text-label text-[14.5px] placeholder:text-label3 focus:outline-none py-[7px] truncate"
            />
            <button
              onClick={handleAiParse}
              disabled={aiLoading || !aiInput.trim()}
              className="h-[38px] sm:h-[34px] px-4 sm:px-[18px] bg-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[14px] font-semibold rounded-[10px] transition-all whitespace-nowrap shrink-0"
            ><span className="hidden sm:inline">{aiLoading ? 'Working...' : 'Run'}</span><span className="sm:hidden">↵</span></button>
          </div>
          {aiError && <p className="text-red-500 text-[12.5px] px-1 mt-2">{aiError}</p>}
        </div>

        {!scheduleConfig && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-[14px] px-4 py-3.5">
            <p className="text-amber-600 dark:text-amber-400 text-[14px]">
              No schedule config found. Go to Settings to configure your rotation.
            </p>
          </div>
        )}

        <div>
          {view === 'day' && renderDayView()}
          {view === 'week' && renderWeekView()}
          {view === 'month' && renderMonthView()}
        </div>
      </div>

      {modalOpen && (
        <div
          onClick={closeModal}
          className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-6 animate-fade-in"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-bg rounded-t-[22px] sm:rounded-[22px] shadow-sheet w-full sm:max-w-[440px] max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-safe sm:pb-0 animate-sheet-in"
          >
            {/* Sheet header — Cancel / title / Save, iOS style */}
            <div className="sticky top-0 z-10 bg-glass backdrop-blur-xl border-b border-sep flex items-center justify-between px-[18px] pt-4 pb-3">
              <button onClick={closeModal} className="text-accent text-[15.5px]">Cancel</button>
              <h3 className="text-label text-[16px] font-semibold tracking-[-0.02em]">
                {selectedSlot
                  ? 'Edit Slot'
                  : `Add Slot${rotationWeeks > 1 && !formIsOneOff ? ` · Week ${formWeekNumber}` : ''}`
                }
              </h3>
              <button
                onClick={handleSaveSlot}
                disabled={formLoading}
                className="text-accent text-[15.5px] font-semibold disabled:opacity-40"
              >
                {formLoading ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="p-[18px] flex flex-col gap-5">

              <div>
                <label className={fieldLabelClass}>Doctor</label>
                <select
                  value={formDoctorId}
                  onChange={e => setFormDoctorId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select a doctor</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Only offered when we know the exact date being added/edited —
                  a plain rotation-pattern slot has no single date to pin to */}
              {formOneOffDate && (
                <div className="bg-surface border border-sep rounded-[14px] shadow-ios p-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="one-off-toggle"
                    checked={formIsOneOff}
                    onChange={e => setFormIsOneOff(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-accent"
                  />
                  <label htmlFor="one-off-toggle" className="flex-1 cursor-pointer">
                    <p className="text-label text-[14px] font-semibold">One-off — this date only</p>
                    <p className="text-label3 text-[12.5px] mt-0.5">
                      {formatDisplayDate(formOneOffDate)} only. Won't repeat on future rotation cycles.
                    </p>
                  </label>
                </div>
              )}

              {rotationWeeks > 1 && !formIsOneOff && (
                <div>
                  <label className={fieldLabelClass}>Rotation Week</label>
                  <select
                    value={formWeekNumber}
                    onChange={e => setFormWeekNumber(parseInt(e.target.value))}
                    className={fieldClass}
                  >
                    {Array.from({ length: rotationWeeks }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={fieldLabelClass}>Day</label>
                <select
                  value={formDayOfWeek}
                  onChange={e => setFormDayOfWeek(e.target.value)}
                  className={fieldClass}
                >
                  {activeDays.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className={fieldLabelClass}>Clinic Label</label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Morning Clinic, Ward Round, Telehealth"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fieldLabelClass}>Start</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={e => setFormStartTime(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>End</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={e => setFormEndTime(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className={fieldLabelClass}>Location</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Room 3B, Brisbane Radiology"
                />
              </div>

              <div>
                <label className={fieldLabelClass}>Assign Staff</label>
                {staffList.length === 0 ? (
                  <p className="text-label3 text-[13px] pl-1">No staff added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-[7px]">
                    {staffList.map(member => (
                      <button
                        key={member.id}
                        onClick={() => toggleStaff(member.id)}
                        className={`h-8 px-3.5 rounded-[9px] text-[13.5px] font-medium transition-colors ${
                          formStaffIds.includes(member.id) ? 'text-white' : 'bg-fill text-label2 hover:text-label'
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
                <label className={fieldLabelClass}>Notes</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className={`${fieldClass} resize-none`}
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>

              {formError && <p className="text-red-500 text-[13px] px-1">{formError}</p>}

              {selectedSlot && (
                <div className="flex gap-2.5">
                  <button
                    onClick={() => handleCancelSlot(selectedSlot.id)}
                    className="flex-1 h-11 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 rounded-[13px] text-[14.5px] font-semibold transition-colors"
                  >
                    {selectedSlot.is_cancelled ? 'Restore Slot' : 'Mark Cancelled'}
                  </button>
                  <button
                    onClick={() => handleDeleteSlot(selectedSlot.id)}
                    className="flex-1 h-11 bg-red-500/15 hover:bg-red-500/25 text-red-500 rounded-[13px] text-[14.5px] font-semibold transition-colors"
                  >
                    Delete Slot
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
