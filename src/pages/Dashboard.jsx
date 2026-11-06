import { useMemo, useState } from 'react'
import Chart from 'react-apexcharts'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { banksApi, categoriesApi, dashboardApi, lendingApi } from '../lib/api'
import { formatAmount, formatDate, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'
import { useTheme } from '../context/ThemeContext'
import { Card, Input, Modal, NativeSelect, Spinner, Table } from '../components/ui'
import MultiSelect from '../components/MultiSelect'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const gradients = [
  'from-purple-50 to-purple-100 dark:from-zinc-800 dark:to-zinc-900',
  'from-orange-50 to-orange-100 dark:from-zinc-800 dark:to-zinc-900',
  'from-blue-50 to-blue-100 dark:from-zinc-800 dark:to-zinc-900',
  'from-green-50 to-green-100 dark:from-zinc-800 dark:to-zinc-900',
  'from-pink-50 to-pink-100 dark:from-zinc-800 dark:to-zinc-900',
  'from-yellow-50 to-yellow-100 dark:from-zinc-800 dark:to-zinc-900',
]
const accents = ['bg-purple-400', 'bg-orange-400', 'bg-blue-400', 'bg-green-500', 'bg-pink-400', 'bg-yellow-400']

function bucket(row) {
  const remaining = Number(row.remaining_amount) || 0
  if (remaining === 0) return 'done'
  const due = row.due_date
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (!due || due > todayIso) return 'upcoming'
  if (due < todayIso) return 'overdue'
  return 'today'
}

export default function Dashboard() {
  const [summaryType, setSummaryType] = useState('Total')
  const [tab, setTab] = useState('credit')
  const [modalSection, setModalSection] = useState(null)
  const yearNow = new Date().getFullYear()
  const [year, setYear] = useState(String(yearNow))
  const [chartType, setChartType] = useState('Total')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedBanks, setSelectedBanks] = useState([])
  const { theme } = useTheme()
  const dark = theme === 'dark' || document.documentElement.classList.contains('dark')

  const widgets = useResource(() => dashboardApi.widgets(summaryType), [summaryType])
  const reminders = useResource(() => lendingApi.listAll(), [])
  const balances = useResource(() => dashboardApi.balances(), [])
  const categories = useResource(() => categoriesApi.list(), [])
  const banks = useResource(() => banksApi.list(), [])
  const major = useResource(async () => {
    const bounds = { from: daysAgoISO(30), to: todayISO() }
    const [debits, credits] = await Promise.all([
      dashboardApi.majorTransactions({ type: 'Debit', ...bounds, limit: 10 }),
      dashboardApi.majorTransactions({ type: 'Credit', ...bounds, limit: 5 }),
    ])
    return { debits, credits }
  }, [])
  const monthly = useResource(
    () => dashboardApi.monthly({ year, type: chartType, categories: selectedCategories.map((item) => item.id), banks: selectedBanks.map((item) => item.id) }),
    [year, chartType, selectedCategories, selectedBanks],
  )

  const grouped = useMemo(() => {
    const empty = () => ({ today: [], upcoming: [], overdue: [], done: [] })
    const result = { credit: empty(), debit: empty() }
    for (const row of reminders.data || []) {
      const key = row.type === 'Credit' ? 'credit' : 'debit'
      result[key][bucket(row)].push(row)
    }
    return result
  }, [reminders.data])

  const section = tab === 'total'
    ? {
        today: [...grouped.credit.today, ...grouped.debit.today],
        upcoming: [...grouped.credit.upcoming, ...grouped.debit.upcoming],
        overdue: [...grouped.credit.overdue, ...grouped.debit.overdue],
        done: [...grouped.credit.done, ...grouped.debit.done],
      }
    : grouped[tab]

  const amountOf = (rows, signed) => rows.reduce((sum, row) => sum + (signed && row.type === 'Credit' ? -Number(row.remaining_amount) : Number(row.remaining_amount)), 0)
  const tabAmounts = {
    credit: amountOf([...grouped.credit.today, ...grouped.credit.upcoming, ...grouped.credit.overdue, ...grouped.credit.done]),
    debit: amountOf([...grouped.debit.today, ...grouped.debit.upcoming, ...grouped.debit.overdue, ...grouped.debit.done]),
    total: amountOf([...grouped.credit.today, ...grouped.credit.upcoming, ...grouped.credit.overdue, ...grouped.credit.done, ...grouped.debit.today, ...grouped.debit.upcoming, ...grouped.debit.overdue, ...grouped.debit.done], true),
  }

  return (
    <div className="flex flex-wrap font-sans">
      <div className="flex-grow p-2 lg:w-1/2">
        <Card title="Reminders">
          <div className="mb-4 flex border-b border-purple-100 dark:border-zinc-700">
            {['credit', 'debit', 'total'].map((key) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={`flex flex-1 cursor-pointer flex-col items-center py-2 text-lg font-semibold ${tab === key ? 'border-b-2 border-purple-700 text-purple-700 dark:text-purple-300' : 'text-gray-500'}`}>
                <span className="capitalize">{key}</span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{reminders.loading ? '…' : formatAmount(tabAmounts[key])}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['today', 'Today', 'bg-purple-50 text-purple-700'],
              ['upcoming', 'Upcoming', 'bg-orange-50 text-orange-500'],
              ['overdue', 'Overdue', 'bg-red-50 text-red-500'],
              ['done', 'Done', 'bg-green-50 text-green-600'],
            ].map(([key, label, color]) => (
              <button key={key} type="button" onClick={() => setModalSection(key)} className={`rounded-lg p-4 text-center dark:bg-zinc-800 ${color.split(' ')[0]}`}>
                <div className="mb-1 text-xs text-gray-500 dark:text-zinc-400">{label}</div>
                <div className={`text-2xl font-bold ${color.split(' ')[1]}`}>{section[key].length}</div>
              </button>
            ))}
          </div>
          <Modal open={!!modalSection} onClose={() => setModalSection(null)} title="Transactions" className="max-w-5xl">
            <Table
              page={1}
              limit={10}
              data={modalSection ? section[modalSection] : []}
              columns={[
                { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                { key: 'type', label: 'Type' },
                { key: 'amount', label: 'Amount', render: (row) => formatAmount(row.amount) },
                { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
                { key: 'due_date', label: 'Due Date', render: (row) => formatDate(row.due_date) },
                { key: 'category', label: 'From/To', render: (row) => row.category?.name || '-' },
                { key: 'remaining_amount', label: 'Pending', render: (row) => formatAmount(row.remaining_amount) },
                { key: 'description', label: 'Description', render: (row) => row.description || '-' },
              ]}
            />
          </Modal>
        </Card>
      </div>
      <div className="flex-grow p-2 lg:w-1/2">
        <Card title="Summery" titleSlot={<NativeSelect className="min-w-[150px]" value={summaryType} onChange={(event) => setSummaryType(event.target.value)} options={[{ id: 'Credit', name: 'Credit' }, { id: 'Debit', name: 'Debit' }, { id: 'Total', name: 'Total' }]} />}>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['today', 'Today', 'from-purple-50 to-purple-100', 'bg-purple-400', 'text-purple-700'],
              ['week', 'This Week', 'from-orange-50 to-orange-100', 'bg-orange-400', 'text-orange-500'],
              ['month', 'This Month', 'from-blue-50 to-blue-100', 'bg-blue-400', 'text-blue-600'],
              ['year', 'This Year', 'from-green-50 to-green-100', 'bg-green-500', 'text-green-600'],
            ].map(([key, label, gradient, bar, text]) => (
              <div key={key} className={`flex items-center gap-4 rounded-lg bg-gradient-to-r p-4 shadow dark:from-zinc-800 dark:to-zinc-900 ${gradient}`}>
                <div className={`h-10 w-2 rounded ${bar}`} />
                <div>
                  <div className="mb-1 text-xs text-gray-500">{label}</div>
                  {widgets.loading ? <Spinner /> : <div className={`text-xl font-bold ${text}`}>{formatAmount(widgets.data?.[key] ?? 0)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="w-full flex-grow p-2">
        <Card title="Major Transactions">
          {major.loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : major.error ? (
            <div className="p-4 text-center text-red-500">{major.error}</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <MajorList title="Top 10 Debits" tone="debit" rows={major.data?.debits || []} icon={ArrowDown} />
              <MajorList title="Top 5 Credits" tone="credit" rows={major.data?.credits || []} icon={ArrowUp} />
            </div>
          )}
        </Card>
      </div>
      <div className="w-full flex-grow p-2">
        <BalanceGrid title="Bank Accounts" accounts={balances.data?.banks || []} loading={balances.loading} showTotal />
        <div className="h-4" />
        <BalanceGrid title="Ledger Accounts" accounts={balances.data?.ledgers || []} loading={balances.loading} />
      </div>
      <div className="w-full flex-grow p-2">
        <Card
          title="Income Expense"
          titleSlot={
            <div className="flex flex-wrap gap-2">
              <NativeSelect value={year} onChange={(event) => setYear(event.target.value)} options={Array.from({ length: 10 }, (_, index) => ({ id: String(yearNow - index), name: String(yearNow - index) }))} className="w-28" />
              <NativeSelect value={chartType} onChange={(event) => setChartType(event.target.value)} options={[{ id: 'Total', name: 'Total' }, { id: 'Credit', name: 'Credit' }, { id: 'Debit', name: 'Debit' }]} className="w-32" />
            </div>
          }
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <MultiSelect label="Category" options={(categories.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={selectedCategories} onChange={setSelectedCategories} />
            <MultiSelect label="Bank" options={(banks.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={selectedBanks} onChange={setSelectedBanks} />
          </div>
          {monthly.loading ? (
            <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
          ) : (
            <Chart
              type="bar"
              height={320}
              series={[{ name: 'Amount', data: (monthly.data || []).map((value) => Number(value.toFixed(2))) }]}
              options={{
                chart: { toolbar: { show: false }, background: dark ? '#18181b' : '#fff', fontFamily: 'inherit' },
                theme: { mode: dark ? 'dark' : 'light' },
                plotOptions: { bar: { borderRadius: 8, columnWidth: '55%' } },
                dataLabels: { enabled: false },
                xaxis: { categories: months },
                colors: ['#818cf8'],
                grid: { borderColor: dark ? '#3f3f46' : '#e5e7eb' },
              }}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

function daysAgoISO(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function prettyDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return '-'
  return `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}`
}

function MajorList({ title, tone, rows, icon: Icon }) {
  const debit = tone === 'debit'
  return (
    <div className={`rounded-xl border p-4 ${debit ? 'border-red-100 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20' : 'border-green-100 bg-green-50/40 dark:border-green-900/40 dark:bg-green-950/20'}`}>
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${debit ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
          <Icon size={16} />
        </span>
        <div>
          <div className="font-semibold text-gray-800 dark:text-gray-100">{title}</div>
          <div className="text-xs text-gray-400">Last 30 days</div>
        </div>
      </div>
      <div className="max-h-[420px] divide-y divide-gray-100 p-2 overflow-y-auto dark:divide-zinc-800">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No transactions</div>
        ) : rows.map((row, index) => {
          const meta = [row.category?.name, row.bank?.name].filter(Boolean).join(' · ')
          return (
            <div key={row.id} className="flex items-center gap-3 py-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${debit ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-800 dark:text-gray-100">{row.description?.trim() || '—'}</div>
                {meta && <div className="truncate text-xs text-gray-400">{meta}</div>}
                <div className="text-xs text-gray-400">{prettyDate(row.date)}</div>
              </div>
              <div className={`shrink-0 font-semibold ${debit ? 'text-red-500' : 'text-green-600'}`}>{formatAmount(row.amount)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BalanceGrid({ title, accounts, loading, showTotal }) {
  const [name, setName] = useState('')
  const filtered = accounts.filter((account) => account.name?.toLowerCase().includes(name.toLowerCase()))
  const total = accounts.reduce((sum, account) => sum + Number(account.totalAmount || 0), 0)
  return (
    <Card
      title={title}
      titleSlot={
        <div className="flex items-center gap-2">
          {showTotal && <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${total >= 0 ? 'border-green-200 bg-green-50 text-green-600' : 'border-red-200 bg-red-50 text-red-600'}`}>{formatAmount(total)}</div>}
          <Input placeholder="Filter by name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center">No data found.</div>
      ) : (
        <div className="grid max-h-[300px] grid-cols-2 gap-4 overflow-y-auto md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((account, index) => (
            <div key={account.id} className={`flex items-center gap-3 rounded-lg bg-gradient-to-r p-4 shadow ${gradients[index % gradients.length]}`}>
              <div className={`h-10 w-2 rounded ${accents[index % accents.length]}`} />
              <div>
                <div className="truncate text-sm font-medium">{account.name}</div>
                <div className={`text-lg font-semibold ${account.totalAmount > 0 ? 'text-green-600' : account.totalAmount < 0 ? 'text-red-600' : 'text-gray-500'}`}>{formatAmount(account.totalAmount)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
