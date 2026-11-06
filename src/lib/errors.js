export function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.'
  if (error.code === 'UNAUTHENTICATED' || error.code === 'NOT_CONFIGURED') return error.message

  const message = `${error.message || ''} ${error.details || ''}`

  if (error.code === '23505') return 'That record already exists.'
  if (error.code === '23503') return 'This record is still used somewhere else, so it cannot be removed.'
  if (error.code === '23514') return 'Check the amount, type, and required fields, then try again.'

  if (/relation .* does not exist/i.test(message) || error.code === '42P01') {
    return 'Database tables are missing. Run supabase/schema.sql in the Supabase SQL editor.'
  }

  if (/could not find the .* column/i.test(message)) {
    return 'The database schema is out of date. Run supabase/schema.sql in the Supabase SQL editor, then reload the API schema.'
  }

  if (/merge_categories/i.test(message) && /could not find|schema cache|does not exist/i.test(message)) {
    return 'Category merge is not available yet. Run supabase/schema.sql in the Supabase SQL editor, then try again.'
  }

  if (/schema cache/i.test(message)) {
    return error.message || 'Supabase has not picked up the latest tables yet. In the SQL editor run: notify pgrst, \'reload schema\';'
  }

  if (error.code === '42501' || /row-level security/i.test(message)) {
    return 'You do not have permission to do that. Sign in again.'
  }

  return error.message || 'Something went wrong. Please try again.'
}

export function friendlyAuthError(error) {
  const message = error?.message || ''
  if (error?.code === 'NOT_CONFIGURED') return error.message
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.'
  if (/email not confirmed/i.test(message)) return 'Confirm this email in Supabase, then sign in.'
  if (/user already registered/i.test(message)) return 'An account with this email already exists.'
  if (/fetch|network|failed to fetch/i.test(message)) {
    return 'Could not reach Supabase. Check the project URL in .env and your connection.'
  }
  return message || 'Could not sign in.'
}
