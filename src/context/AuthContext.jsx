import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { banksApi } from '../lib/api'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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
    if (!session) return undefined
    banksApi.ensureCash().catch(() => {})
    return undefined
  }, [session?.user?.id])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        if (!supabase) throw configError()
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        return data
      },
      async signUp({ name, email, password }) {
        if (!supabase) throw configError()
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        })
        if (error) throw error
        return data
      },
      async sendReset(email) {
        if (!supabase) throw configError()
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${import.meta.env.VITE_SITE_URL}/reset-password`,
        })
        console.log(import.meta.env.VITE_SITE_URL)
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
    [session, loading],
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
