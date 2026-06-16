// gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash-lite",
  generationConfig: { responseMimeType: "application/json" } 
});

export async function parseSlotFromText(text, doctors, activeDays, staffList = [], contextDate = new Date(), rotationWeeks = 1, cycleStartDate = null) {
  let currentRotationWeek = 1
  if (rotationWeeks > 1 && cycleStartDate) {
    const start = new Date(cycleStartDate)
    const daysDiff = Math.floor((contextDate - start) / (1000 * 60 * 60 * 24))
    if (daysDiff >= 0) {
      currentRotationWeek = (Math.floor(daysDiff / 7) % rotationWeeks) + 1
    }
  }

  const nextRotationWeek = rotationWeeks > 1
    ? (currentRotationWeek % rotationWeeks) + 1
    : 1

  const prompt = `
    You are a scheduling assistant for a medical clinic. Extract scheduling details from natural language.
    Be flexible and generous — infer as much as possible from casual language.
    Known doctors: ${doctors.map(d => d.name).join(', ')}
    Known staff: ${staffList.map(s => s.name).join(', ')}
    Available days: ${activeDays.join(', ')}
    Total rotation weeks: ${rotationWeeks}
    Current rotation week being viewed: ${currentRotationWeek}
    Next rotation week: ${nextRotationWeek}
    User input: "${text}"
    Extraction rules — follow these carefully:
    DOCTOR: Match to the closest known doctor using first name, last name, or partial match.
    e.g. "Arvind" matches "Dr Arvind", "Dr Smith" matches "Dr John Smith"
    STAFF: Match to the closest known staff member using any part of their name.
    Any of these phrases mean someone is the assigned staff:
    "X is taking care of it", "X is covering", "X is assigned", "X will be there",
    "managed by X", "with X", "X is on it", "X is handling it"
    e.g. "Eric is taking care of it" → staffName: "Eric"
    LOCATION: Extract any place name, hospital, clinic name, or room mentioned after words like
    "at", "in", "located at", "based at".
    e.g. "clinic at Brisbane Radiology" → location: "Brisbane Radiology"
    e.g. "at Greenslopes Private" → location: "Greenslopes Private"
    DAY: Extract the day of the week from available days.
    e.g. "on Friday" → dayOfWeek: "Friday"
    e.g. "Tuesday morning" → dayOfWeek: "Tuesday"
    WEEK NUMBER: Use the rotation week context above.
    - "this week" or no week mentioned → weekNumber: ${currentRotationWeek}
    - "next week" → weekNumber: ${nextRotationWeek}
    - "week 1", "week 2" etc → use that number directly
    - If rotation is 1 week, always return weekNumber: 1
    TIME: Convert any time format to HH:MM 24hr.
    e.g. "12pm" → "12:00", "5pm" → "17:00", "9am" → "09:00", "9:30am" → "09:30"
    IMPORTANT: Always return valid JSON. Never refuse. If something is unclear, return null for that field.
    Return ONLY this JSON with no explanation and no markdown fences:
    {
      "doctorName": "matched doctor name or null",
      "staffName": "matched staff name or null",
      "dayOfWeek": "exact day from available days or null",
      "startTime": "HH:MM or null",
      "endTime": "HH:MM or null",
      "slotLabel": "short clinic label if mentioned or null",
      "location": "location name or null",
      "weekNumber": ${currentRotationWeek}
    }
  `

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text()
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (err) {
    console.error('Gemini parse error:', err)
    return {
      doctorName: null, staffName: null, dayOfWeek: null,
      startTime: null, endTime: null, slotLabel: null,
      location: null, weekNumber: currentRotationWeek,
    }
  }
}