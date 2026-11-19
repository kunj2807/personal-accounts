import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { accountApi, banksApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const cashReady = new Set()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setLoading(false)
      return undefined
    }

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      setProfileError('')
      setProfileLoading(false)
      return undefined
    }

    let active = true
    setProfileLoading(true)
    setProfileError('')
    accountApi.profile()
      .then((row) => {
        if (!active) return
        setProfile(row)
      })
      .catch((error) => {
        if (!active) return
        setProfile(null)
        setProfileError(friendlyError(error))
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [session?.user?.id])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return undefined
    const key = `cash-bank:${userId}`
    if (cashReady.has(userId) || sessionStorage.getItem(key) === '1') return undefined
    cashReady.add(userId)
    banksApi.ensureCash().then(() => sessionStorage.setItem(key, '1')).catch(() => cashReady.delete(userId))
    return undefined
  }, [session?.user?.id])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      profile,
      profileLoading,
      profileError,
      async signIn(email, password) {
        if (!supabase) throw configError()
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        return data
      },
      async signUp({ name, email, password, consentAccepted }) {
        if (!supabase) throw configError()
        if (!consentAccepted) {
          const error = new Error('Confirm that you are 18 or have parent consent, and accept the Terms and Privacy Policy.')
          error.code = 'CONSENT_REQUIRED'
          throw error
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
              consent_accepted: true,
              consent_accepted_at: new Date().toISOString(),
            },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        })
        if (error) throw error
        return data
      },
      async acceptConsent() {
        if (!supabase) throw configError()
        const row = await accountApi.acceptConsent()
        setProfile(row)
        try {
          await supabase.auth.updateUser({
            data: {
              consent_accepted: true,
              consent_accepted_at: row?.consent_accepted_at,
            },
          })
        } catch {
          // The user row and activity log are already saved.
        }
        return row
      },
      async sendReset(email) {
        if (!supabase) throw configError()
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
      },
      async updatePassword(password) {
        if (!supabase) throw configError()
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
      },
      async signOut() {
        try {
          if (supabase) await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // Leave the panel even if the network call fails.
        }
        setSession(null)
      },
    }),
    [session, loading, profile, profileLoading, profileError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function configError() {
  const error = new Error(
    'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the dev server.',
  )
  error.code = 'NOT_CONFIGURED'
  return error
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
