import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'
import { ConsentField } from './ConsentField'
import { Button } from './ui'

const OPEN_PATHS = new Set(['/terms', '/privacy-policy'])

export default function ConsentGate() {
  const { session, profile, profileLoading, profileError, acceptConsent, signOut } = useAuth()
  const { pathname } = useLocation()
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const legalPage = OPEN_PATHS.has(pathname)
  const open = Boolean(session) && !legalPage && !profileLoading && !profileError && !profile?.consent_accepted

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = document.getElementById('consent-gate-dialog')
    dialog?.querySelector('input')?.focus()
    const blockEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const keepFocus = (event) => {
      if (dialog && !dialog.contains(event.target)) {
        dialog.querySelector('input, button')?.focus()
      }
    }
    document.addEventListener('keydown', blockEscape, true)
    document.addEventListener('focusin', keepFocus)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', blockEscape, true)
      document.removeEventListener('focusin', keepFocus)
    }
  }, [open])

  if (!open) return null

  const accept = async () => {
    if (!checked || saving) {
      setError('Confirm that you are 18 or have parent consent, and accept the Terms and Privacy Policy.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await acceptConsent()
      toast.success('Terms accepted')
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  const leave = async () => {
    if (saving || signingOut) return
    setSigningOut(true)
    await signOut()
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-auto bg-black/50 p-3 backdrop-blur-[2px]" role="presentation">
      <div
        id="consent-gate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-gate-title"
        className="relative m-auto w-[95%] max-w-lg rounded-2xl border border-purple-100/50 bg-white p-4 shadow-xl dark:border-zinc-700/50 dark:bg-zinc-900 md:p-6"
      >
        <h2 id="consent-gate-title" className="mb-2 text-center text-2xl font-semibold text-purple-700 dark:text-purple-300">
          Accept terms to continue
        </h2>
        <p className="mb-5 text-center text-sm leading-6 text-gray-600 dark:text-gray-300">
          Your account does not have a recorded acceptance yet. Confirm the statement below to keep using Personal Account.
        </p>
        <ConsentField
          id="consent-gate"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked)
            setError('')
          }}
          error={error}
        />
        <Button type="button" className="mt-5 w-full" loading={saving} disabled={!checked || signingOut} onClick={accept}>
          Accept and continue
        </Button>
        <button
          type="button"
          className="mt-3 w-full text-sm text-gray-500 hover:underline disabled:opacity-60 dark:text-gray-400"
          disabled={saving || signingOut}
          onClick={leave}
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}
