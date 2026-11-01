import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Button, Card, Input } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { friendlyAuthError } from '../lib/errors'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    try {
      const result = await signUp(data)
      if (result.session) {
        toast.success('Signup successful!')
        navigate('/dashboard')
        return
      }
      toast.success('Account created. Confirm the email, then sign in.')
      navigate('/login')
    } catch (error) {
      toast.error(friendlyAuthError(error))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 px-2 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-purple-700 dark:text-purple-300">Create your account</h1>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Name" id="name" placeholder="Your Name" error={errors.name?.message} {...register('name', { required: 'Name is required' })} />
          <Input label="Email" id="email" placeholder="you@example.com" error={errors.email?.message} {...register('email', { required: 'Email is required' })} />
          <Input label="Password" id="password" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })} />
          <Input label="Confirm Password" id="confirmPassword" type="password" placeholder="••••••••" error={errors.confirmPassword?.message} {...register('confirmPassword', { required: 'Confirm Password is required', validate: (value) => value === watch('password') || 'Passwords do not match' })} />
          <Button type="submit" className="w-full" loading={isSubmitting}>Sign Up</Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Already have an account? <Link to="/login" className="font-medium text-purple-700 hover:underline dark:text-purple-400">Sign in</Link>
        </p>
      </Card>
    </div>
  )
}
