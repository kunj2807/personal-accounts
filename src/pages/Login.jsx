import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, Card, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { friendlyAuthError } from '../lib/errors'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    console.log(data)
    try {
      const result = await signIn(data.email, data.password)
      if (!result.session) {
        toast.success('Check your email to confirm the account, then sign in.')
        return
      }
      toast.success('Login successful!')
      navigate('/dashboard')
    } catch (error) {
      toast.error(friendlyAuthError(error))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 px-2 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-purple-700 dark:text-purple-300">Sign in to your account</h1>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Email" id="email" placeholder="you@example.com" error={errors.email?.message} {...register('email', { required: 'Email is required' })} />
          <Input label="Password" id="password" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password', { required: 'Password is required' })} />
          <div className="mt-2 flex justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-purple-700 hover:underline dark:text-purple-400">Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full" loading={isSubmitting}>Sign In</Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Don&apos;t have an account? <Link to="/signup" className="font-medium text-purple-700 hover:underline dark:text-purple-400">Sign up</Link>
        </p>
      </Card>
    </div>
  )
}
