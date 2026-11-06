import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, BarChart2, Boxes, ChevronLeft, ChevronRight, CreditCard, DollarSign, File, FileText, LayoutDashboard } from 'lucide-react'
import { formsApi } from '../lib/api'
import { cn } from '../lib/utils'
import { Separator, Title } from './ui'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: DollarSign, label: 'Income Expense', path: '/income-expense' },
  { icon: CreditCard, label: 'Lending Borrowing', path: '/lending-borrowing' },
  { icon: FileText, label: 'Deposite Withdraw', path: '/deposite-withdraw' },
  { icon: ArrowLeftRight, label: 'Self Transfer', path: '/self-transfer' },
  { icon: File, label: 'Custom Form', path: '/custom-form' },
  {
    icon: Boxes,
    label: 'Masters',
    children: [
      { label: 'Category', path: '/masters/category' },
      { label: 'Bank', path: '/masters/bank' },
    ],
  },
  {
    icon: BarChart2,
    label: 'Reports',
    children: [
      { label: 'General Ledger', path: '/reports/general-ledger' },
      { label: 'Ledger Statement', path: '/reports/ledger-statement' },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [customSidebar, setCustomSidebar] = useState([])
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    let active = true
    formsApi
      .sidebar()
      .then((rows) => {
        if (active) setCustomSidebar(rows)
      })
      .catch(() => {
        if (active) setCustomSidebar([])
      })
    const refresh = () => formsApi.sidebar().then(setCustomSidebar).catch(() => {})
    window.addEventListener('forms-changed', refresh)
    return () => {
      active = false
      window.removeEventListener('forms-changed', refresh)
    }
  }, [pathname])

  const go = (path) => {
    navigate(path)
    setMobileOpen(false)
  }

  return (
    <>
      <button type="button" className="fixed left-4 top-5 z-[102] rounded-full border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open sidebar">
        <ChevronRight size={24} className="text-indigo-600 dark:text-indigo-400" />
      </button>
      <aside
        className={cn(
          'fixed left-0 top-0 z-[103] flex h-screen min-h-screen flex-col overflow-auto border-r border-zinc-200 bg-card shadow-lg transition-all duration-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 md:static',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <button type="button" className="absolute right-4 top-4 rounded-full border border-zinc-200 bg-zinc-100 p-2 dark:border-zinc-700 dark:bg-zinc-800 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close sidebar">
          <ChevronLeft size={22} />
        </button>
        <div className="flex min-h-[60px] items-center justify-between border-b border-zinc-200 px-4 py-5 dark:border-zinc-700">
          <Title className={cn(collapsed ? 'hidden' : 'block', 'text-xl font-semibold')}>
            P<small>ersonal</small> A<small>ccount</small>
          </Title>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="absolute right-3 hidden rounded-full border border-zinc-200 bg-zinc-100 p-1.5 dark:border-zinc-700 dark:bg-zinc-800 md:flex" aria-label="Toggle sidebar">
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <nav className="mt-4 flex-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = item.path && pathname.startsWith(item.path)
            return (
              <div key={item.label}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => (item.children ? setOpenMenu((value) => (value === item.label ? null : item.label)) : go(item.path))}
                  className={cn('group mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-zinc-800', item.children && 'justify-between', !collapsed && active && 'bg-indigo-100 font-medium dark:bg-zinc-800')}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-indigo-600 dark:text-indigo-400">
                      <Icon size={22} />
                    </span>
                    <span className={cn('whitespace-nowrap text-zinc-900 dark:text-zinc-200', collapsed ? 'hidden' : 'block')}>{item.label}</span>
                  </div>
                  {item.children && !collapsed && <ChevronRight size={18} className={cn('text-zinc-500 transition', openMenu === item.label && 'rotate-90')} />}
                </div>
                {item.children && openMenu === item.label && !collapsed && (
                  <div className="mb-1 ml-8 flex flex-col gap-1">
                    {item.children.map((child) => (
                      <div key={child.path} role="button" tabIndex={0} onClick={() => go(child.path)} className={cn('flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-indigo-100 dark:text-zinc-200 dark:hover:bg-zinc-800', pathname.startsWith(child.path) && 'bg-indigo-50 font-medium dark:bg-zinc-800')}>
                        <FileText size={18} className="text-indigo-500" />
                        <span>{child.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {customSidebar.length > 0 && <Separator />}
          {customSidebar.map((item) => (
            <div key={item.id} role="button" tabIndex={0} onClick={() => go(`/custom-form/${item.id}`)} className="group mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-zinc-800">
              <FileText size={18} className="text-indigo-600" />
              <span className={cn('w-[150px] truncate whitespace-nowrap text-zinc-900 dark:text-zinc-200', collapsed && 'hidden')}>{item.title}</span>
            </div>
          ))}
        </nav>
        <div className={cn('border-t border-zinc-200 px-4 py-3 text-center text-xs dark:border-zinc-700', collapsed && 'hidden')}>
          <span className="inline-block rounded bg-zinc-200 px-2 py-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">© {new Date().getFullYear()} Personal Accounts</span>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-[101] bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}
    </>
  )
}
