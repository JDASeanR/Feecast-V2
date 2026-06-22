import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qivwmqoqojqefyiuizjz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdndtcW9xb2pxZWZ5aXVpemp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTE2NDYsImV4cCI6MjA5Njc4NzY0Nn0.qiSmLPh6trCcXNJppDUyl9CWylegraSc18SFnHFjmuU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
