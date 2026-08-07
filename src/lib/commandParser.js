// commandParser.js - free local natural language parser for schedule commands
// No API needed - uses regex and fuzzy matching to understand plain English
// Handles commands like:
// - "Dr Arvind is away Friday this week"
// - "Dr Rakshitha has a clinic at Brisbane Radiology Thursday 9am-4pm, Athauv is taking care of it"
// - "Cancel all of Dr Norman's clinics this week"
// - "Restore Dr Aundy's Monday clinic"

import { getWeekDates, getDayName, getRotationWeek } from './scheduleUtils'
import { addWeeks, addDays } from 'date-fns'

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
// matches before "thu" would — used both to stop location matching at a day
// name (e.g. "...at Brisbane Radiology Thursday 9am-4pm") and to find days
const DAY_WORDS_PATTERN = Object.keys(DAY_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join('|')

// Matches every day word in a string, in order, allowing a trailing "s"
// for plurals (e.g. "Fridays"). Global so it finds ALL days mentioned,
// not just the first — needed for "Monday and Wednesday" style commands.
const ALL_DAYS_REGEX = new RegExp(`\\b(${DAY_WORDS_PATTERN})s?\\b`, 'gi')

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

// Finds every day name mentioned in a string, in the order they appear,
// with duplicates removed. Handles plurals ("Fridays") and multi-day
// commands like "Monday and Wednesday" or "Mon, Wed & Fri".
function extractDays(text) {
  const lower = text.toLowerCase()
  const found = []
  ALL_DAYS_REGEX.lastIndex = 0 // it's a shared regex object — always reset before reuse
  let match
  while ((match = ALL_DAYS_REGEX.exec(lower)) !== null) {
    const canonical = DAY_ALIASES[match[1]]
    if (canonical && !found.includes(canonical)) found.push(canonical)
  }
  return found
}

// Finds the first day name in a string e.g. "this Friday" → "Friday"
// Kept for call sites that only care about a single day
function extractDay(text) {
  return extractDays(text)[0] || null
}

// "today" / "tomorrow" resolve straight to a specific date rather than
// a day-of-week name, since they're relative to right now, not the week grid
function resolveRelativeDate(text, currentDate) {
  const lower = text.toLowerCase()
  if (/\btomorrow\b/.test(lower)) return addDays(currentDate, 1)
  if (/\btoday\b/.test(lower)) return currentDate
  return null
}

// Word forms for small numbers, used in interval phrases like
// "every third week" or "every second week"
const NUMBER_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

// Works out how often a recurring slot repeats, in rotation weeks.
// Covers as many real-world phrasings as we could think of:
// - "every Friday" / no qualifier / "weekly" / "each week" / "once a week" = 1
// - "fortnightly" / "fortnighly"/"forthnightly" (typos) / "biweekly" /
//   "bi-weekly" / "every other week" / "every other Friday" / "every 2nd
//   week" / "every second Friday" / "alternate weeks" / "alternating
//   weeks" / "every couple of weeks" = 2
// - "every 3rd week" / "every third week" / "every three weeks" / "every
//   third Friday" / "every few weeks" (approximate) = 3
// - "every Nth week" / "every N weeks" / "N-weekly" / "every Nth <day>",
//   numeric or spelled-out, for any N
function extractInterval(text) {
  const lower = text.toLowerCase()

  // Phrases that always mean "every 2 weeks", regardless of typos or
  // whether a day name or the word "week" follows
  if (
    lower.includes('fortnightly') ||
    lower.includes('fortnighly') ||      // common typo
    lower.includes('forthnightly') ||    // common typo
    lower.includes('forthnighly') ||     // common typo
    lower.includes('biweekly') ||
    lower.includes('bi-weekly') ||
    lower.includes('bi weekly') ||
    lower.includes('every other') ||         // "every other week/Friday/Monday"
    lower.includes('every alternate') ||
    lower.includes('alternate week') ||
    lower.includes('alternating week') ||
    lower.includes('on alternate weeks') ||
    lower.includes('every couple of weeks') ||
    lower.includes('every couple weeks') ||
    lower.includes('a couple of weeks') ||
    lower.includes('once every other week') ||
    lower.includes('once every 2 weeks') ||
    lower.includes('once every two weeks')
  ) {
    return 2
  }

  // Vague "every few weeks" — no exact number given, 3 is a reasonable
  // middle-ground default rather than failing to recognise it at all
  if (lower.includes('few weeks')) {
    return 3
  }

  const numberWordsPattern = Object.keys(NUMBER_WORDS).join('|')

  // "every 3rd week", "every 3 weeks", "every 3-week cycle", "every 3rd Friday"
  const numMatch = lower.match(new RegExp(
    `every\\s+(\\d+)(?:st|nd|rd|th)?[\\s-]+(?:weeks?|${DAY_WORDS_PATTERN}s?)\\b`
  ))
  if (numMatch) return parseInt(numMatch[1], 10)

  // "every third week", "every second Friday", "every fourth Monday"
  const wordMatch = lower.match(new RegExp(
    `every\\s+\\b(${numberWordsPattern})\\b\\s+(?:weeks?|${DAY_WORDS_PATTERN}s?)\\b`
  ))
  if (wordMatch) return NUMBER_WORDS[wordMatch[1]]

  // "N-weekly" / "N weekly" (e.g. "4-weekly", "2 weekly") — British convention
  const weeklyMatch = lower.match(/\b(\d+)[\s-]?weekly\b/)
  if (weeklyMatch) return parseInt(weeklyMatch[1], 10)

  // "on a 2 week cycle", "on a 2-week cycle", "a two week cycle"
  const cycleNumMatch = lower.match(/(\d+)[\s-]?weeks?\s+cycle/)
  if (cycleNumMatch) return parseInt(cycleNumMatch[1], 10)

  const cycleWordMatch = lower.match(new RegExp(`\\b(${numberWordsPattern})\\b[\\s-]?weeks?\\s+cycle`))
  if (cycleWordMatch) return NUMBER_WORDS[cycleWordMatch[1]]

  // "once every N weeks" / "repeats every N weeks" / "recurring every N
  // weeks" all contain "every N week(s)" as a substring, so numMatch /
  // wordMatch above already catch them — nothing extra needed here.

  return 1
}

// Looks for an explicit override of which week the pattern starts from:
// "starting week N", "starting from week N", "start on week N",
// "beginning week N", "from week N onwards", "week N onwards"
// Returns null if not specified, so the caller can fall back to a sensible default
function extractStartWeek(text) {
  const lower = text.toLowerCase()
  const patterns = [
    /start(?:ing)?\s+(?:from\s+|on\s+)?week\s+(\d+)/,
    /begin(?:ning)?\s+(?:from\s+|on\s+)?week\s+(\d+)/,
    /from\s+week\s+(\d+)\s+onwards?/,
    /week\s+(\d+)\s+onwards?/,
  ]
  for (const pattern of patterns) {
    const match = lower.match(pattern)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

// Standard edit-distance calculation — how many single-character
// insertions/deletions/substitutions turn string a into string b
function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// Fuzzy matches a name fragment against a list of objects with a .name property
// e.g. "Arvind" matches "Dr Arvind Sharma"
// Tries, in order: exact substring, shared word, then typo tolerance so a
// small misspelling like "Andyy" or "Aundy" still finds "Dr Andy"
function fuzzyMatchName(fragment, list) {
  if (!fragment) return null
  const lower = fragment.toLowerCase().trim()

  // 1. Exact substring match
  const exact = list.find(item => item.name.toLowerCase().includes(lower))
  if (exact) return exact

  const words = lower.split(/\s+/).filter(w => w.length > 2)

  // 2. Any word in the fragment appears in / contains any word in the name
  const wordMatch = list.find(item => {
    const nameWords = item.name.toLowerCase().split(/\s+/)
    return words.some(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)))
  })
  if (wordMatch) return wordMatch

  // 3. Typo tolerance — small edit distance against any word in the name.
  // Threshold scales with word length so short names aren't matched too loosely.
  let best = null
  let bestDistance = Infinity
  for (const item of list) {
    const nameWords = item.name.toLowerCase().split(/\s+/)
    for (const w of words.length ? words : [lower]) {
      for (const nw of nameWords) {
        if (Math.abs(nw.length - w.length) > 2) continue
        const distance = levenshtein(w, nw)
        const threshold = nw.length <= 4 ? 1 : 2
        if (distance <= threshold && distance < bestDistance) {
          bestDistance = distance
          best = item
        }
      }
    }
  }
  return best
}

// Works out which specific dates are affected by "this week", "next week",
// or "next <day>" (e.g. "next Friday" means the Friday of next week, even
// without the word "week" showing up) — relative to the currentDate
// (what the user is viewing)
const NEXT_DAY_REGEX = new RegExp(`next\\s+(?:${DAY_WORDS_PATTERN})s?\\b`, 'i')

function resolveWeekDates(text, currentDate) {
  const lower = text.toLowerCase()
  if (lower.includes('next week') || NEXT_DAY_REGEX.test(lower)) {
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
    lower.includes('leave') ||
    lower.includes('unavailable') ||
    lower.includes("won't be in") ||
    lower.includes('wont be in') ||
    lower.includes('out of office') ||
    lower.includes('day off') ||
    lower.includes('taking the day')

  const isRestore =
    lower.includes('back') ||
    lower.includes('restore') ||
    lower.includes('uncance') ||
    lower.includes('returning') ||
    lower.includes('reinstate') ||
    lower.includes('available again') ||
    lower.includes('no longer away') ||
    lower.includes('no longer sick') ||
    lower.includes('no longer off')

  const isAdd =
    lower.includes('has a clinic') ||
    lower.includes('add') ||
    lower.includes('new clinic') ||
    lower.includes('schedule') ||
    lower.includes('working at') ||
    lower.includes('clinic at') ||
    lower.includes('book') ||
    lower.includes('put on') ||
    lower.includes('set up a clinic') ||
    lower.includes('is covering') ||
    lower.includes('is doing a clinic')
  // Detects if the user wants to add a recurring slot across all rotation weeks
  const isRecurring =
    lower.includes('every') ||
    lower.includes('each') ||
    lower.includes('fortnightly') ||
    lower.includes('fortnighly') ||
    lower.includes('forthnightly') ||
    lower.includes('forthnighly') ||
    lower.includes('biweekly') ||
    lower.includes('bi-weekly') ||
    lower.includes('bi weekly') ||
    lower.includes('weekly') ||
    lower.includes('once a week') ||
    lower.includes('once every') ||
    lower.includes('alternate week') ||
    lower.includes('alternating week') ||
    lower.includes('recurring') ||
    lower.includes('repeats every') ||
    lower.includes('repeat every') ||
    lower.includes('on a rotation') ||
    lower.includes('couple of weeks') ||
    lower.includes('few weeks') ||
    lower.includes('week cycle') ||
    lower.includes('weekly cycle') ||
    /\d+[\s-]?weeks?\s+cycle/.test(lower) ||
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

  // ── EXTRACT DAY(S) ─────────────────────────────────────────────────
  // "today"/"tomorrow" resolve to a specific date directly; otherwise
  // pick up every day name mentioned, e.g. "Monday and Wednesday"
  const relativeDate = resolveRelativeDate(lower, currentDate)
  const daysOfWeek = relativeDate ? [getDayName(relativeDate)] : extractDays(lower)
  const dayOfWeek = daysOfWeek[0] || null

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
  `clinic\\s+at\\s+([A-Za-z][A-Za-z0-9\\s]+?)(?:\\s+(?:on|from|this|next|every|each|fortnightly|biweekly|weekly|starting|start|recurring|repeats?|\\d|(?:${DAY_WORDS_PATTERN})s?\\b)|,|$)`, 'i'
))
if (clinicAtMatch) {
  location = clinicAtMatch[1].trim()
}

// Fall back to plain "at X" — but exclude time expressions like "at 9am"
if (!location) {
  const atMatch = text.match(new RegExp(
    `\\bat\\s+([A-Za-z][A-Za-z\\s]+?)(?:\\s+(?:on|from|this|next|every|each|fortnightly|biweekly|weekly|starting|start|recurring|repeats?|\\d|(?:${DAY_WORDS_PATTERN})s?\\b)|,|$)`, 'i'
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
  // "this week" = current view week, "next week"/"next <day>" = next week

  const affectedWeekDates = resolveWeekDates(lower, currentDate)

  // Work out which specific date(s) are affected. "today"/"tomorrow" map
  // straight to a date; otherwise look up each mentioned day within the
  // resolved week. affectedDate is kept as the first one for call sites
  // that only handle a single day (e.g. the one-off "add" modal).
  const affectedDates = relativeDate
    ? [relativeDate]
    : daysOfWeek
        .map(d => affectedWeekDates.find(wd => getDayName(wd) === d))
        .filter(Boolean)
  const affectedDate = affectedDates[0] || null

  // Work out the rotation week number for the affected date
  const rotationWeekNum = affectedDate
    ? getRotationWeek(affectedDate, cycleStartDate, rotationWeeks)
    : getRotationWeek(currentDate, cycleStartDate, rotationWeeks)

  // ── BUILD RESULT ───────────────────────────────────────────────────

  if (isCancellation && !isAdd) {
    return {
      intent: 'cancel',
      doctor: matchedDoctor,
      dayOfWeek,          // first affected day (kept for backward compatibility)
      daysOfWeek,         // ALL affected days, e.g. ["Monday", "Wednesday"]
      affectedDate,       // first affected calendar date
      affectedDates,       // every affected calendar date
      rotationWeekNum,    // which rotation week this falls in
      wholeWeek: daysOfWeek.length === 0, // if no day mentioned, cancel the whole week
      affectedWeekDates,
    }
  }

  if (isRestore) {
    return {
      intent: 'restore',
      doctor: matchedDoctor,
      dayOfWeek,
      daysOfWeek,
      affectedDate,
      affectedDates,
      rotationWeekNum,
      wholeWeek: daysOfWeek.length === 0,
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
      daysOfWeek, // add_recurring loops over every day mentioned, e.g. "Mondays and Wednesdays"
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