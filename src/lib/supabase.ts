import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qdkwkmezlitqjxrapuip.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFka3drbWV6bGl0cWp4cmFwdWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTIwOTYsImV4cCI6MjA5MTMyODA5Nn0.ScjStfnNB19n5YdJX43w-L3KAymPI0Y_bnM0gUI3S14'

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
