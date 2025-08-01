// utils/supabaseTest.ts
import { supabase } from '@/lib/supabase'

export async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...')
    
    // Test basic connection
    const { data, error } = await supabase
      .from('conversations')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase connection failed:', error)
      return false
    }
    
    console.log('✅ Supabase connection successful')
    return true
  } catch (error) {
    console.error('❌ Supabase test failed:', error)
    return false
  }
}

export async function checkDatabaseTables() {
  try {
    console.log('🔍 Checking database tables...')
    
    // Test conversations table
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1)
    
    if (convError) {
      console.error('❌ Conversations table error:', convError)
    } else {
      console.log('✅ Conversations table accessible')
    }
    
    // Test messages table
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .limit(1)
    
    if (msgError) {
      console.error('❌ Messages table error:', msgError)
    } else {
      console.log('✅ Messages table accessible')
    }
    
    return !convError && !msgError
  } catch (error) {
    console.error('❌ Database check failed:', error)
    return false
  }
} 