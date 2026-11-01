import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, Card, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { friendlyAuthError } from '../lib/errors'

export default function ResetPassword() {
  const { updatePassword, session } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    try {
      await updatePassword(data.password)
      toast.success('Password updated. You can continue.')
      navigate('/dashboard')
    } catch (error) {
      toast.error(friendlyAuthError(error))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 px-2 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-purple-700 dark:text-purple-300">Reset password</h1>
        {!session && <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">Open the reset link from your email. Supabase will sign you in on this page.</p>}
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="New password" type="password" error={errors.password?.message} {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })} />
          <Input label="Confirm password" type="password" error={errors.confirm?.message} {...register('confirm', { required: 'Confirm password is required', validate: (value) => value === watch('password') || 'Passwords do not match' })} />
          <Button type="submit" className="w-full" loading={isSubmitting} disabled={!session}>Update password</Button>
        </form>
      </Card>
    </div>
  )
}
