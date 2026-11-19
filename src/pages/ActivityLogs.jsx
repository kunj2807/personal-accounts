import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { BadgeButton, Button, Card, Input, MultiSelect, Pagination, StatusWrapper, Table } from '../components/ui'
import { activityLogsApi } from '../lib/api'
import { useResource } from '../lib/useResource'

const moduleOptions = activityLogsApi.modules.map((name) => ({ id: name, name }))
const actionOptions = [
  { id: 'add', name: 'Add' },
  { id: 'edit', name: 'Edit' },
  { id: 'delete', name: 'Delete' },
]

const actionStyles = {
  add: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  edit: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ActivityLogs() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [modules, setModules] = useState([])
  const [actions, setActions] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applied, setApplied] = useState({ modules: [], actions: [], dateFrom: '', dateTo: '' })

  const list = useResource(
    () =>
      activityLogsApi.listPage({
        page,
        limit,
        modules: applied.modules,
        actions: applied.actions,
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
      }),
    [page, limit, applied],
  )

  const apply = (event) => {
    event.preventDefault()
    setPage(1)
    setApplied({
      modules: modules.map((item) => item.id),
      actions: actions.map((item) => item.id),
      dateFrom,
      dateTo,
    })
  }

  const clear = () => {
    setModules([])
    setActions([])
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setApplied({ modules: [], actions: [], dateFrom: '', dateTo: '' })
  }

  return (
    <Card title="Activity Logs">
      <form className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={apply}>
        <MultiSelect label="Module" options={moduleOptions} selectedValues={modules} onChange={setModules} placeholder="All modules" />
        <MultiSelect label="Action" options={actionOptions} selectedValues={actions} onChange={setActions} placeholder="All actions" />
        <Input label="From" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input label="To" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <div className="flex items-end justify-end gap-2 md:col-span-2 xl:col-span-4">
          <Button type="button" variant="secondary" onClick={clear}>Clear</Button>
          <Button type="submit">Apply</Button>
        </div>
      </form>
      <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
        <Table
          page={page}
          limit={limit}
          data={list.data?.rows || []}
          emptyText="No activity found"
          columns={[
            { key: 'created_at', label: 'Date', className: 'whitespace-nowrap', render: (row) => formatDateTime(row.created_at) },
            { key: 'module_name', label: 'Module' },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium capitalize ${actionStyles[row.action] || 'bg-gray-100 text-gray-700'}`}>
                  {row.action || '—'}
                </span>
              ),
            },
            {
              key: 'view',
              label: 'View',
              render: (row) => (
                <BadgeButton type="button" variant="outline" aria-label="View activity" onClick={() => navigate(`/activity-logs/${row.id}`)}>
                  <Eye size={15} />
                </BadgeButton>
              ),
            },
          ]}
        />
        <Pagination
          totalItems={list.data?.total || 0}
          itemsPerPage={limit}
          currentPage={page}
          onPageChange={setPage}
          onPerPageChange={(value) => {
            setLimit(Number(value))
            setPage(1)
          }}
        />
      </StatusWrapper>
    </Card>
  )
}
