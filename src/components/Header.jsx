import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileText, LogOut, Mail, Moon, Settings, Shield, Sun, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Header() {
  const { theme, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const dark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))
  const name = user?.user_metadata?.name || user?.email || 'Account'

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleLogout = async () => {
    await signOut()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-[101] px-2 pt-2 backdrop-blur-sm">
      <div className="flex h-16 w-full items-center justify-end rounded-xl border-b border-zinc-200 bg-card px-6 shadow-sm dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={toggle} aria-label="Toggle dark mode">
            {dark ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-zinc-600" />}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex items-center gap-2 rounded px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-expanded={open}
              aria-haspopup="menu"
              onClick={() => setOpen((value) => !value)}
            >
              <User size={20} className="text-zinc-600 dark:text-zinc-300" />
              <span>{name}</span>
              <ChevronDown size={16} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <Link role="menuitem" to="/account" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <Settings size={16} /> Manage account
                </Link>
                <Link role="menuitem" to="/privacy-policy" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <Shield size={16} /> Privacy Policy
                </Link>
                <Link role="menuitem" to="/terms" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <FileText size={16} /> Terms & Conditions
                </Link>
                <Link role="menuitem" to="/contact" onClick={close} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                  <Mail size={16} /> Contact Us
                </Link>
              </div>
            )}
          </div>
          <button type="button" onClick={handleLogout} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Logout">
            <LogOut size={20} className="text-zinc-600 dark:text-zinc-300" />
          </button>
        </div>
      </div>
    </header>
  )
}
