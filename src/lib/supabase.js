import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nudceqwihwezkbtjvwtw.supabase.co'
const supabaseAnonKey = 'sb_publishable_429nvCwqNLcUS1HptW-FVw_d4Igv1p8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
import.meta.env.VITE_ANTHROPIC_API_KEY