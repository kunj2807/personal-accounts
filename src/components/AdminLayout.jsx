import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

export default function AdminLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <div className="relative max-h-screen min-h-screen flex-grow overflow-auto">
        <Header />
        <div className="flex justify-center overflow-auto px-2 py-3">
          <div className="container">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
