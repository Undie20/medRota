// commandParser.js - free local natural language parser for schedule commands
// No API needed - uses regex and fuzzy matching to understand plain English
// Handles commands like:
// - "Dr Arvind is away Friday this week"
// - "Dr Rakshitha has a clinic at Brisbane Radiology Thursday 9am-4pm, Athauv is taking care of it"
// - "Cancel all of Dr Norman's clinics this week"
// - "Restore Dr Aundy's Monday clinic"

import { getWeekDates, getDayName, getRotationWeek } from './scheduleUtils'
import { addWeeks } from 'date-fns'

// All the day name variations we recognise
const DAY_ALIASES = {
  monday: 'Monday', mon: 'Monday',
  tuesday: 'Tuesday', tue: 'Tuesday', tues: 'Tuesday',
  wednesday: 'Wednesday', wed: 'Wednesday',
  thursday: 'Thursday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday',
  friday: 'Friday', fri: 'Friday',
  saturday: 'Saturday', sat: 'Saturday',
  sunday: 'Sunday', sun: 'Sunday',
}

// All day-name words (and abbreviations), longest first so e.g. "thursday"
// matches before "thu" would — used to stop location matching at a day name
// like "...at Brisbane Radiology Thursday 9am-4pm"
const DAY_WORDS_PATTERN = Object.keys(DAY_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join('|')

// Converts "9am", "9:30am", "14:00" etc into "HH:MM" 24hr format
function parseTime(str) {
  if (!str) return null
  str = str.trim().toLowerCase()

  // Already in 24hr format e.g. "14:00"
  const plain24 = str.match(/^(\d{1,2}):(\d{2})$/)
  if (plain24) {
    return `${plain24[1].padStart(2, '0')}:${plain24[2]}`
  }

  // e.g. "9am", "9:30am", "9:30pm"
  const ampm = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (ampm) {
    let hours = parseInt(ampm[1])
    const mins = ampm[2] || '00'
    const period = ampm[3]
    if (period === 'pm' && hours !== 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0
    return `${String(hours).padStart(2, '0')}:${mins}`
  }

  return null
}

// Finds a day name in a string e.g. "this Friday" → "Friday"
// Also matches plural forms like "Fridays" (as in "every Fridays" / "on Fridays")
function extractDay(text) {
  const lower = text.toLowerCase()
  for (const [alias, fullName] of Object.entries(DAY_ALIASES)) {
    // Match as a whole word using word boundaries, allowing an optional trailing "s"
    const regex = new RegExp(`\\b${alias}s?\\b`)
    if (regex.test(lower)) return fullName
  }
  return null
}

// Word forms for small numbers, used in interval phrases like
// "every third week" or "every second week"
const NUMBER_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
}

// Works out how often a recurring slot repeats, in rotation weeks.
// "every Friday" / no qualifier = 1 (every week)
// "fortnightly" / "every other week" / "every 2nd week" = 2
// "every 3rd week" / "every three weeks" = 3, etc.
function extractInterval(text) {
  const lower = text.toLowerCase()

  if (lower.includes('fortnightly') || lower.includes('biweekly') || lower.includes('every other week')) {
    return 2
  }

  // "every 3rd week", "every 3 weeks"
  const numMatch = lower.match(/every\s+(\d+)(?:st|nd|rd|th)?\s+weeks?/)
  if (numMatch) return parseInt(numMatch[1], 10)

  // "every third week", "every second week"
  const wordMatch = lower.match(/every\s+(first|second|third|fourth|fifth|sixth|one|two|three|four|five|six)\s+weeks?/)
  if (wordMatch) return NUMBER_WORDS[wordMatch[1]]

  return 1
}

// Looks for an explicit "starting week N" / "starting from week N" override
// Returns null if not specified, so the caller can fall back to a sensible default
function extractStartWeek(text) {
  const lower = text.toLowerCase()
  const match = lower.match(/start(?:ing)?\s+(?:from\s+)?week\s+(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// Fuzzy matches a name fragment against a list of objects with a .name property
// e.g. "Arvind" matches "Dr Arvind Sharma"
function fuzzyMatchName(fragment, list) {
  if (!fragment) return null
  const lower = fragment.toLowerCase().trim()
  // Try exact substring match first
  const exact = list.find(item => item.name.toLowerCase().includes(lower))
  if (exact) return exact
  // Try matching any word in the fragment against any word in the name
  const words = lower.split(/\s+/).filter(w => w.length > 2)
  return list.find(item => {
    const nameWords = item.name.toLowerCase().split(/\s+/)
    return words.some(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)))
  }) || null
}

// Works out which specific dates are affected by "this week", "next week" etc
// relative to the currentDate (what the user is viewing)
function resolveWeekDates(text, currentDate) {
  const lower = text.toLowerCase()
  if (lower.includes('next week')) {
    return getWeekDates(addWeeks(currentDate, 1))
  }
  // "this week" or no week qualifier = the week currently being viewed
  return getWeekDates(currentDate)
}

// ─── MAIN PARSER ─────────────────────────────────────────────────────────────

// Takes a plain English command and returns a structured action object
// Returns null if the command can't be understood
export function parseCommand(text, doctors, staffList, currentDate, rotationWeeks, cycleStartDate) {
  const lower = text.toLowerCase().trim()

  // ── DETECT INTENT ──────────────────────────────────────────────────
  // We check for keywords to work out what the user wants to do

  const isCancellation =
    lower.includes('away') ||
    lower.includes('cancel') ||
    lower.includes('not working') ||
    lower.includes('off') ||
    lower.includes('sick') ||
    lower.includes('leave')

  const isRestore =
    lower.includes('back') ||
    lower.includes('restore') ||
    lower.includes('uncance') ||
    lower.includes('returning')

  const isAdd =
    lower.includes('has a clinic') ||
    lower.includes('add') ||
    lower.includes('new clinic') ||
    lower.includes('schedule') ||
    lower.includes('working at') ||
    lower.includes('clinic at')
  // Detects if the user wants to add a recurring slot across all rotation weeks
  const isRecurring =
    lower.includes('every') ||
    lower.includes('each') ||
    lower.includes('fortnightly') ||
    lower.includes('biweekly') ||
    lower.includes('weekly') ||
    lower.includes('all fridays') ||
    lower.includes('all mondays') ||
    lower.includes('all tuesdays') ||
    lower.includes('all wednesdays') ||
    lower.includes('all thursdays') ||
    lower.includes('all saturdays') ||
    lower.includes('all sundays')
  // ── EXTRACT DOCTOR ─────────────────────────────────────────────────
  // Look for "Dr X" or just a name that matches a doctor

  let doctorName = null
  const drMatch = text.match(/Dr\.?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i)
  if (drMatch) {
    doctorName = drMatch[1]
  }
  const matchedDoctor = fuzzyMatchName(doctorName, doctors)

  // ── EXTRACT STAFF ──────────────────────────────────────────────────
  // Look for staff names mentioned after "Athauv is taking care", "assigned to", etc.

  let matchedStaff = []

  // Pattern: "<name> is taking care" or "assign <name>" or "<name> is responsible"
  const staffPatterns = [
    /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+is taking care/i,
    /assign(?:ed)?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
    /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+is responsible/i,
    /([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+will (?:be )?covering/i,
    /covered by\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
  ]

  for (const pattern of staffPatterns) {
    const match = text.match(pattern)
    if (match) {
      const found = fuzzyMatchName(match[1], staffList)
      if (found && !matchedStaff.find(s => s.id === found.id)) {
        matchedStaff.push(found)
      }
    }
  }

  // ── EXTRACT DAY ────────────────────────────────────────────────────
  const dayOfWeek = extractDay(lower)

  // ── EXTRACT TIME ───────────────────────────────────────────────────
  // Supports "9am-4pm", "9am to 4pm", "9:30am-5pm" etc

  let startTime = null
  let endTime = null

  const timeRangeMatch = text.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i
  )
  if (timeRangeMatch) {
    startTime = parseTime(timeRangeMatch[1])
    endTime = parseTime(timeRangeMatch[2])
  }

  // Single time e.g. "from 9am"
  if (!startTime) {
    const singleTime = text.match(/(?:from|at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
    if (singleTime) startTime = parseTime(singleTime[1])
  }

  // ── EXTRACT LOCATION ───────────────────────────────────────────────
// Looks for "at X" or "clinic at X" where X is a location
// Handles commas and longer location names like "Brisbane Radiology"

let location = null

// Try "clinic at X" first — more specific
const clinicAtMatch = text.match(new RegExp(
  `clinic\\s+at\\s+([A-Za-z][A-Za-z0-9\\s]+?)(?:\\s+(?:on|from|this|next|\\d|(?:${DAY_WORDS_PATTERN})s?\\b)|,|$)`, 'i'
))
if (clinicAtMatch) {
  location = clinicAtMatch[1].trim()
}

// Fall back to plain "at X" — but exclude time expressions like "at 9am"
if (!location) {
  const atMatch = text.match(new RegExp(
    `\\bat\\s+([A-Za-z][A-Za-z\\s]+?)(?:\\s+(?:on|from|this|next|\\d|(?:${DAY_WORDS_PATTERN})s?\\b)|,|$)`, 'i'
  ))
  if (atMatch) {
    const candidate = atMatch[1].trim()
    // Ignore if it looks like a time e.g. "at 9am"
    if (!candidate.match(/^\d/) && !candidate.match(/^(nine|ten|eleven|twelve)/i)) {
      location = candidate
    }
  }
}

  // ── EXTRACT LABEL ──────────────────────────────────────────────────
// Only pick up known clinic type keywords — don't grab full sentences

let slotLabel = null
const knownLabels = [
  'morning clinic', 'afternoon clinic', 'ward round', 'telehealth',
  'phone consult', 'procedure', 'injection', 'review', 'full day clinic',
  'half day clinic', 'home visit', 'nursing home'
]
for (const label of knownLabels) {
  if (lower.includes(label)) {
    slotLabel = label.replace(/\b\w/g, c => c.toUpperCase()) // Title Case
    break
  }
}
  // ── RESOLVE WHICH DATES ARE AFFECTED ──────────────────────────────
  // "this week" = current view week, "next week" = next week

  const affectedWeekDates = resolveWeekDates(lower, currentDate)

  // Work out which specific date is affected (if a day was mentioned)
  let affectedDate = null
  if (dayOfWeek) {
    affectedDate = affectedWeekDates.find(d => getDayName(d) === dayOfWeek) || null
  }

  // Work out the rotation week number for the affected date
  const rotationWeekNum = affectedDate
    ? getRotationWeek(affectedDate, cycleStartDate, rotationWeeks)
    : getRotationWeek(currentDate, cycleStartDate, rotationWeeks)

  // ── BUILD RESULT ───────────────────────────────────────────────────

  if (isCancellation && !isAdd) {
    return {
      intent: 'cancel',
      doctor: matchedDoctor,
      dayOfWeek,
      affectedDate,       // the specific calendar date (for one-off cancellations)
      rotationWeekNum,    // which rotation week this falls in
      wholeWeek: !dayOfWeek, // if no day mentioned, cancel the whole week
      affectedWeekDates,
    }
  }

  if (isRestore) {
    return {
      intent: 'restore',
      doctor: matchedDoctor,
      dayOfWeek,
      affectedDate,
      rotationWeekNum,
      wholeWeek: !dayOfWeek,
      affectedWeekDates,
    }
  }
  if (isAdd || (!isCancellation && !isRestore && (matchedDoctor || dayOfWeek || location))) {
    // interval/startWeek only matter for recurring adds — e.g. "every 3rd week"
    // starting from the week currently being viewed, unless overridden with
    // an explicit "starting week N"
    const interval = isRecurring ? extractInterval(lower) : 1
    const startWeek = isRecurring ? (extractStartWeek(lower) || rotationWeekNum || 1) : null

    return {
      intent: isRecurring ? 'add_recurring' : 'add',
      doctor: matchedDoctor,
      dayOfWeek,
      startTime,
      endTime,
      location,
      slotLabel,
      staff: matchedStaff,
      rotationWeekNum,
      affectedDate,
      isRecurring,
      interval,
      startWeek,
    }
  }

  // Couldn't understand the command
  return null
}