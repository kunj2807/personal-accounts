import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Header from './Header'
import Sidebar from './Sidebar'
import { FullScreenLoader } from './ui'

function PageFrame({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="relative max-h-screen min-h-screen flex-grow overflow-auto">
        <Header />
        <div className="flex justify-center overflow-auto px-2 py-3">
          <div className="container">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <PageFrame>
      <Outlet />
    </PageFrame>
  )
}

export function LegalLayout() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (session) {
    return (
      <PageFrame>
        <Outlet />
      </PageFrame>
    )
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-pink-100 to-orange-100 px-2 py-8 dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-3xl">
        <Outlet />
      </div>
    </div>
  )
}
