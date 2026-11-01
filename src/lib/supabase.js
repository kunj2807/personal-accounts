import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  url &&
    anonKey &&
    !String(url).includes('your-project-ref') &&
    anonKey !== 'your-anon-key',
)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export async function requireAuth() {
  if (!supabase) {
    const error = new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the dev server.',
    )
    error.code = 'NOT_CONFIGURED'
    throw error
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error

  if (!data.session) {
    const err = new Error('You must be signed in to continue.')
    err.code = 'UNAUTHENTICATED'
    throw err
  }

  return data.session
}
