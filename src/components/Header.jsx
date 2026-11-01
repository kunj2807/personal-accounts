import { LogOut, Moon, Sun, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Header() {
  const { theme, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const dark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))
  const name = user?.user_metadata?.name || user?.email || 'Account'

  const handleLogout = async () => {
    await signOut()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-[101] px-2 pt-2 backdrop-blur-sm">
      <div className="flex h-16 w-full items-center justify-end rounded-xl border-b border-zinc-200 bg-card px-6 shadow-sm dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={toggle} aria-label="Toggle dark mode">
            {dark ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-zinc-600" />}
          </button>
          <div className="flex items-center gap-2 rounded px-2 py-1 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <User size={20} className="text-zinc-600 dark:text-zinc-300" />
            <span>{name}</span>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Logout">
            <LogOut size={20} className="text-zinc-600 dark:text-zinc-300" />
          </button>
        </div>
      </div>
    </header>
  )
}
