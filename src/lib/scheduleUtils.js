// helper functions for schedule calculations
// These functions are used by the calendar to work out which rotation
// week any given calendar date falls into, and to generate the dates
// for each view (day, week, month)

import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval, 
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths
} from 'date-fns'

// Given a calendar date, the cycle start date, and how many weeks in the rotation,
// returns which rotation week number that date falls into (1-based)
// e.g. if rotation is 4 weeks and the date is 8 days after cycle start, it's week 2
export function getRotationWeek(date, cycleStartDate, rotationWeeks) {
  if (!cycleStartDate || rotationWeeks === 1) return 1

  const start = new Date(cycleStartDate)
  const daysDiff = differenceInCalendarDays(date, start)

  // If the date is before the cycle start, return null
  if (daysDiff < 0) return null

  // Which week are we in overall (0-based)?
  const weekIndex = Math.floor(daysDiff / 7)

  // Which rotation week does that map to? (1-based)
  return (weekIndex % rotationWeeks) + 1
}

// Returns an array of dates for a full week containing the given date
// Weeks start on Monday
export function getWeekDates(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // 1 = Monday
  return eachDayOfInterval({ start, end: addDays(start, 6) })
}

// Returns all dates in the month containing the given date,
// padded with dates from adjacent months to fill the calendar grid
export function getMonthDates(date) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

// Format helpers - these just make dates look nice in the UI
export function formatDate(date) {
  return format(date, 'yyyy-MM-dd')
}

export function formatDisplayDate(date) {
  return format(date, 'EEE d MMM') // e.g. "Mon 12 May"
}

export function formatMonthYear(date) {
  return format(date, 'MMMM yyyy') // e.g. "May 2026"
}

export function formatDayFull(date) {
  return format(date, 'EEEE d MMMM yyyy') // e.g. "Monday 12 May 2026"
}

// Navigation helpers - move forward/back depending on the current view
export function navigateDate(date, direction, view) {
  // direction is 1 (forward) or -1 (back)
  if (view === 'day') return addDays(date, direction)
  if (view === 'week') return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1)
  if (view === 'month') return direction === 1 ? addMonths(date, 1) : subMonths(date, 1)
  return date
}

// Returns the days of the week to show based on working days config
// workingDays is an object like { Monday: true, Tuesday: true, Saturday: false, ... }
export function getActiveDays(workingDays) {
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  if (!workingDays) return allDays.slice(0, 5) // default to Mon-Fri
  return allDays.filter(day => workingDays[day])
}

// Given a date, returns the name of the day e.g. "Monday"
export function getDayName(date) {
  return format(date, 'EEEE')
}

export { isSameDay, isSameMonth }