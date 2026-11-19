import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, Card, Input, Modal } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { accountApi } from '../lib/api'
import { friendlyError } from '../lib/errors'

const CONFIRM = 'I want to delete my account'

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Account() {
  const { user, signOut, profile, profileLoading, profileError } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const name = profile?.name || user?.user_metadata?.name || '—'
  const email = profile?.email || user?.email || '—'
  const consentAt = formatDateTime(profile?.consent_accepted_at)

  const close = () => {
    if (deleting) return
    setOpen(false)
    setPhrase('')
  }

  const confirmed = phrase.trim() === CONFIRM

  const remove = async () => {
    if (!confirmed || deleting) return
    setDeleting(true)
    try {
      await accountApi.deleteAccount()
      await signOut()
      toast.success('Your account and data have been deleted')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(friendlyError(error))
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Card title="Manage account">
        <dl className="space-y-3 text-[15px] leading-7 text-gray-700 dark:text-gray-300">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
            <dd className="text-gray-900 dark:text-gray-100">{name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="text-gray-900 dark:text-gray-100">{email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Consent accepted</dt>
            <dd className="text-gray-900 dark:text-gray-100">
              {profileLoading ? 'Loading...' : profileError ? profileError : profile?.consent_accepted ? consentAt : 'Not recorded'}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Delete account">
        <div className="max-w-3xl space-y-4 text-[15px] leading-7 text-gray-700 dark:text-gray-300">
          <p>
            Deleting your account erases your sign-in and every record stored with it: banks, categories, income and expenses, lending and borrowing, deposits and withdrawals, transfers, custom forms, statements, and activity logs.
          </p>
          <p>This cannot be undone.</p>
          <Button type="button" variant="danger" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </div>
      </Card>

      <Modal open={open} onClose={close} title="Delete account" className="max-w-lg">
        <div className="space-y-4 p-2">
          <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
            This permanently deletes your account and all of your data. This cannot be undone.
          </p>
          <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
            To confirm, type{' '}
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-gray-900 dark:bg-zinc-800 dark:text-gray-100">
              {CONFIRM}
            </span>{' '}
            below.
          </p>
          <Input
            label="Confirmation"
            id="delete-confirm"
            value={phrase}
            autoComplete="off"
            spellCheck={false}
            placeholder={CONFIRM}
            onChange={(event) => setPhrase(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={deleting} onClick={close}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={deleting} disabled={!confirmed} onClick={remove}>
              Delete this account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
