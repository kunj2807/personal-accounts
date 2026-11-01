import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, Card, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { friendlyAuthError } from '../lib/errors'

export default function ForgotPassword() {
  const { sendReset } = useAuth()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    try {
      await sendReset(data.email)
      toast.success('If an account with that email exists, a reset link has been sent.')
    } catch (error) {
      toast.error(friendlyAuthError(error))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 px-2 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-purple-700 dark:text-purple-400">Forgot Password</h1>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Email" id="email" placeholder="you@example.com" error={errors.email?.message} {...register('email', { required: 'Email is required' })} />
          <Button type="submit" className="w-full" loading={isSubmitting}>Send Reset Link</Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="font-medium text-purple-700 hover:underline dark:text-purple-400">Back to sign in</Link>
        </p>
      </Card>
    </div>
  )
}
