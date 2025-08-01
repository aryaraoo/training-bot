// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Debug environment variables
console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set')
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set')

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase environment variables are not configured!')
  console.error('Please check your .env.local file contains:')
  console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key')
  throw new Error('Supabase environment variables are required')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)



