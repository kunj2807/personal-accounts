import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, StatusWrapper } from '../components/ui'
import { activityLogsApi, banksApi, categoriesApi, entriesApi } from '../lib/api'
import { formatAmount, formatDate } from '../lib/utils'
import { useResource } from '../lib/useResource'

const actionStyles = {
  add: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  edit: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

const hiddenKeys = new Set(['id', 'entry_id', 'user_id', 'password'])

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

function labelize(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function FieldValue({ value }) {
  if (value == null || value === '') return <span className="text-gray-400">—</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-gray-400">—</span>
    return (
      <div className="mt-2 flex flex-col gap-3">
        {value.map((item, index) => (
          <div key={index} className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700">
            <FieldValue value={item} />
          </div>
        ))}
      </div>
    )
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([key]) => !hiddenKeys.has(key))
    if (!entries.length) return <span className="text-gray-400">—</span>
    return (
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(([key, item]) => {
          const nested = item && typeof item === 'object'
          return (
            <div key={key} className={(nested ? 'sm:col-span-2' : '' ) + (key === 'form_id' ? ' hidden' : '')}>
              <dt className={(key == 'data' ? ' hidden ' : '') + "text-xs font-semibold uppercase tracking-wide text-gray-500"}>{labelize(key)}</dt>
              <dd className="mt-0.5 break-words text-sm text-gray-800 dark:text-gray-200">
                <FieldValue value={item} />
              </dd>
            </div>
          )
        })}
      </dl>
    )
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function incomeSnapshot(value, lookup) {
  if (!value) return null
  const parent = value.parent_id ? lookup.parents.get(value.parent_id) : null
  return {
    date: value.date ? formatDate(value.date) : '—',
    type: value.type || '—',
    amount: value.amount == null || value.amount === '' ? '—' : formatAmount(value.amount),
    bank: value.bank_id ? lookup.banks.get(value.bank_id) || '—' : '—',
    category: value.category_id ? lookup.categories.get(value.category_id) || '—' : '—',
    description: value.description || '—',
    parent: value.parent_id
      ? {
          date: parent?.date ? formatDate(parent.date) : '—',
          description: parent?.description || '—',
          amount: parent ? formatAmount(parent.amount) : '—',
          category: parent?.category?.name || lookup.categories.get(parent?.category_id) || '—',
        }
      : null,
  }
}

function SnapshotField({ label, children, changed, className = '' }) {
  return (
    <div className={`${changed ? 'rounded-lg bg-amber-50 px-2 py-1.5 dark:bg-amber-950/40' : ''} ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

function lendingSnapshot(value, lookup) {
  if (!value) return null
  const money = (amount) => (amount == null || amount === '' ? '—' : formatAmount(amount))
  return {
    date: value.date ? formatDate(value.date) : '—',
    dueDate: value.due_date ? formatDate(value.due_date) : '—',
    type: value.type || '—',
    amount: money(value.amount),
    remaining: value.remaining_amount == null || value.remaining_amount === '' ? '—' : money(value.remaining_amount),
    bank: value.bank_id ? lookup.banks.get(value.bank_id) || '—' : '—',
    category: value.category_id ? lookup.categories.get(value.category_id) || '—' : '—',
    description: value.description || '—',
    items: (value.lending_items || []).map((item) => ({
      date: item.date ? formatDate(item.date) : '—',
      type: item.type || '—',
      amount: money(item.amount),
      bank: item.bank_id ? lookup.banks.get(item.bank_id) || '—' : '—',
      description: item.description || '—',
    })),
  }
}

function sameItem(item, other) {
  if (!other) return false
  return item.date === other.date && item.type === other.type && item.amount === other.amount && item.bank === other.bank && item.description === other.description
}

function LendingSnapshot({ title, snapshot, other }) {
  const changed = (key) => Boolean(other) && (snapshot?.[key] || '—') !== (other?.[key] || '—')
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-card shadow-sm dark:border-zinc-700">
      <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:border-zinc-800">{title}</h3>
      {!snapshot ? (
        <p className="p-4 text-sm text-gray-400">No values recorded.</p>
      ) : (
        <div className="flex flex-1 flex-col p-4">
          <dl className="grid grid-cols-2 gap-3">
            <SnapshotField label="Date" changed={changed('date')}>{snapshot.date}</SnapshotField>
            <SnapshotField label="Due date" changed={changed('dueDate')}>{snapshot.dueDate}</SnapshotField>
            <SnapshotField label="Type" changed={changed('type')}>
              <span className={snapshot.type === 'Debit' ? 'font-medium text-red-600' : snapshot.type === 'Credit' ? 'font-medium text-green-600' : ''}>{snapshot.type}</span>
            </SnapshotField>
            <SnapshotField label="Amount" changed={changed('amount')}>{snapshot.amount}</SnapshotField>
            <SnapshotField label="Remaining" changed={changed('remaining')}>{snapshot.remaining}</SnapshotField>
            <SnapshotField label="Bank" changed={changed('bank')}>{snapshot.bank}</SnapshotField>
            <SnapshotField label="Category" changed={changed('category')} className="col-span-2">{snapshot.category}</SnapshotField>
            <SnapshotField label="Description" changed={changed('description')} className="col-span-2">{snapshot.description}</SnapshotField>
          </dl>
          {snapshot.items.length > 0 && (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/80 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/40">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Items</p>
              <div className="flex flex-col gap-3">
                {snapshot.items.map((item, index) => {
                  const itemChanged = Boolean(other) && !sameItem(item, other.items?.[index])
                  return (
                    <dl key={index} className="grid grid-cols-2 gap-3 rounded-lg bg-white/80 p-3 dark:bg-zinc-900/50">
                      <SnapshotField label="Date" changed={itemChanged}>{item.date}</SnapshotField>
                      <SnapshotField label="Type" changed={itemChanged}>{item.type}</SnapshotField>
                      <SnapshotField label="Amount" changed={itemChanged}>{item.amount}</SnapshotField>
                      <SnapshotField label="Bank" changed={itemChanged}>{item.bank}</SnapshotField>
                      <SnapshotField label="Description" changed={itemChanged} className="col-span-2">{item.description}</SnapshotField>
                    </dl>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function moneyText(amount) {
  return amount == null || amount === '' ? '—' : formatAmount(amount)
}

function bankName(id, lookup) {
  return id ? lookup.banks.get(id) || '—' : '—'
}

function depositSnapshot(value, lookup) {
  if (!value) return null
  return {
    date: value.date ? formatDate(value.date) : '—',
    type: value.type || '—',
    amount: moneyText(value.amount),
    bank: bankName(value.bank_id, lookup),
    description: value.description || '—',
  }
}

function transferSnapshot(value, lookup) {
  if (!value) return null
  return {
    date: value.date ? formatDate(value.date) : '—',
    amount: moneyText(value.amount),
    fromBank: bankName(value.from_bank_id, lookup),
    toBank: bankName(value.to_bank_id, lookup),
    description: value.description || '—',
  }
}

function RecordSnapshot({ title, snapshot, other, fields }) {
  const changed = (key) => Boolean(other) && (snapshot?.[key] || '—') !== (other?.[key] || '—')
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-card shadow-sm dark:border-zinc-700">
      <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:border-zinc-800">{title}</h3>
      {!snapshot ? (
        <p className="p-4 text-sm text-gray-400">No values recorded.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 p-4">
          {fields.map((field) => (
            <SnapshotField key={field.key} label={field.label} changed={changed(field.key)} className={field.className || ''}>
              {field.render ? field.render(snapshot[field.key]) : snapshot[field.key]}
            </SnapshotField>
          ))}
        </dl>
      )}
    </section>
  )
}

const depositFields = [
  { key: 'date', label: 'Date' },
  {
    key: 'type',
    label: 'Type',
    render: (value) => <span className={value === 'Withdrawal' ? 'font-medium text-red-600' : value === 'Deposit' ? 'font-medium text-green-600' : ''}>{value}</span>,
  },
  { key: 'amount', label: 'Amount' },
  { key: 'bank', label: 'Bank' },
  { key: 'description', label: 'Description', className: 'col-span-2' },
]

const transferFields = [
  { key: 'date', label: 'Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'fromBank', label: 'From bank' },
  { key: 'toBank', label: 'To bank' },
  { key: 'description', label: 'Description', className: 'col-span-2' },
]

function masterSnapshot(value) {
  if (!value) return null
  return {
    name: value.name || '—',
    status: value.enable == null ? '—' : value.enable ? 'Enabled' : 'Disabled',
    cash: value.is_cash ? 'Yes' : 'No',
    mergedFrom: Array.isArray(value.merged_from) && value.merged_from.length ? value.merged_from.join(', ') : '—',
  }
}

const bankFields = [
  { key: 'name', label: 'Name', className: 'col-span-2' },
  { key: 'status', label: 'Status' },
  { key: 'cash', label: 'Cash account' },
]

const categoryFields = [
  { key: 'name', label: 'Name', className: 'col-span-2' },
  { key: 'status', label: 'Status' },
]

function userSnapshot(value) {
  if (!value) return null
  return {
    name: value.name || '—',
    email: value.email || '—',
    consent: value.consent_accepted ? 'Yes' : 'No',
    consentAt: value.consent_accepted_at ? formatDateTime(value.consent_accepted_at) : '—',
  }
}

const userFields = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'consent', label: 'Consent accepted' },
  { key: 'consentAt', label: 'Consent accepted at', className: 'col-span-2' },
]

function IncomeSnapshot({ title, snapshot, other }) {
  const changed = (key) => Boolean(other) && (snapshot?.[key] || '—') !== (other?.[key] || '—')
  const parentChanged = (key) => Boolean(other) && (snapshot?.parent?.[key] || '—') !== (other?.parent?.[key] || '—')
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-card shadow-sm dark:border-zinc-700">
      <h3 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:border-zinc-800">{title}</h3>
      {!snapshot ? (
        <p className="p-4 text-sm text-gray-400">No values recorded.</p>
      ) : (
        <div className="flex flex-1 flex-col p-4">
          <dl className="grid grid-cols-2 gap-3">
            <SnapshotField label="Date" changed={changed('date')}>{snapshot.date}</SnapshotField>
            <SnapshotField label="Type" changed={changed('type')}>
              <span className={snapshot.type === 'Debit' ? 'font-medium text-red-600' : snapshot.type === 'Credit' ? 'font-medium text-green-600' : ''}>{snapshot.type}</span>
            </SnapshotField>
            <SnapshotField label="Amount" changed={changed('amount')}>{snapshot.amount}</SnapshotField>
            <SnapshotField label="Bank" changed={changed('bank')}>{snapshot.bank}</SnapshotField>
            <SnapshotField label="Category" changed={changed('category')} className="col-span-2">{snapshot.category}</SnapshotField>
            <SnapshotField label="Description" changed={changed('description')} className="col-span-2">{snapshot.description}</SnapshotField>
          </dl>
          {snapshot.parent && (
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/80 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/40">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Parent</p>
              <dl className="grid grid-cols-2 gap-3">
                <SnapshotField label="Date" changed={parentChanged('date')}>{snapshot.parent.date}</SnapshotField>
                <SnapshotField label="Amount" changed={parentChanged('amount')}>{snapshot.parent.amount}</SnapshotField>
                <SnapshotField label="Category" changed={parentChanged('category')}>{snapshot.parent.category}</SnapshotField>
                <SnapshotField label="Description" changed={parentChanged('description')}>{snapshot.parent.description}</SnapshotField>
              </dl>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function ActivityLogDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const log = useResource(() => activityLogsApi.get(id), [id])
  const names = useResource(async () => {
    const [banks, categories] = await Promise.all([
      banksApi.list({ enabledOnly: false }),
      categoriesApi.list({ enabledOnly: false }),
    ])
    return {
      banks: new Map(banks.map((item) => [item.id, item.name])),
      categories: new Map(categories.map((item) => [item.id, item.name])),
    }
  }, [])
  const row = log.data
  const isIncome = row?.module_name === 'Income Expense'
  const isLending = row?.module_name === 'Lending Borrowing'
  const isDeposit = row?.module_name === 'Deposit Withdrawal'
  const isTransfer = row?.module_name === 'Self Transfer'
  const isBank = row?.module_name === 'Bank'
  const isCategory = row?.module_name === 'Category'
  const isUser = row?.module_name === 'User'
  const needsNames = isIncome || isLending || isDeposit || isTransfer
  const parentIds = [...new Set([row?.old_value?.parent_id, row?.new_value?.parent_id].filter(Boolean))]
  const parents = useResource(async () => {
    if (!isIncome || !parentIds.length) return []
    return entriesApi.byIds(parentIds)
  }, [isIncome, parentIds.join(',')])
  const lookup = {
    banks: names.data?.banks || new Map(),
    categories: names.data?.categories || new Map(),
    parents: new Map((parents.data || []).map((item) => [item.id, item])),
  }

  const back = (
    <Button type="button" variant="secondary" className="inline-flex items-center gap-2" onClick={() => navigate('/activity-logs')}>
      <ArrowLeft size={16} /> Back
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <StatusWrapper
        loading={log.loading || (needsNames && names.loading) || (isIncome && parentIds.length > 0 && parents.loading)}
        error={log.error || (needsNames ? names.error : '') || (isIncome ? parents.error : '')}
        onRetry={() => { log.reload(); names.reload(); parents.reload() }}
      >
        {!log.loading && !row ? (
          <Card title="Activity" titleSlot={back}>
            <p className="text-gray-500">This activity could not be found.</p>
          </Card>
        ) : row ? (
          <>
            <Card title="Activity" titleSlot={back}>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date</dt>
                  <dd className="mt-1 text-gray-800 dark:text-gray-200">{formatDateTime(row.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Module</dt>
                  <dd className="mt-1 text-gray-800 dark:text-gray-200">{row.module_name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Action</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium capitalize ${actionStyles[row.action] || 'bg-gray-100 text-gray-700'}`}>
                      {row.action || '—'}
                    </span>
                  </dd>
                </div>
              </dl>
            </Card>
            {isIncome ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <IncomeSnapshot title="Previous" snapshot={incomeSnapshot(row.old_value, lookup)} other={incomeSnapshot(row.new_value, lookup)} />
                <IncomeSnapshot title="Updated" snapshot={incomeSnapshot(row.new_value, lookup)} other={incomeSnapshot(row.old_value, lookup)} />
              </div>
            ) : isLending ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <LendingSnapshot title="Previous" snapshot={lendingSnapshot(row.old_value, lookup)} other={lendingSnapshot(row.new_value, lookup)} />
                <LendingSnapshot title="Updated" snapshot={lendingSnapshot(row.new_value, lookup)} other={lendingSnapshot(row.old_value, lookup)} />
              </div>
            ) : isDeposit ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <RecordSnapshot title="Previous" snapshot={depositSnapshot(row.old_value, lookup)} other={depositSnapshot(row.new_value, lookup)} fields={depositFields} />
                <RecordSnapshot title="Updated" snapshot={depositSnapshot(row.new_value, lookup)} other={depositSnapshot(row.old_value, lookup)} fields={depositFields} />
              </div>
            ) : isTransfer ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <RecordSnapshot title="Previous" snapshot={transferSnapshot(row.old_value, lookup)} other={transferSnapshot(row.new_value, lookup)} fields={transferFields} />
                <RecordSnapshot title="Updated" snapshot={transferSnapshot(row.new_value, lookup)} other={transferSnapshot(row.old_value, lookup)} fields={transferFields} />
              </div>
            ) : isBank ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <RecordSnapshot title="Previous" snapshot={masterSnapshot(row.old_value)} other={masterSnapshot(row.new_value)} fields={bankFields} />
                <RecordSnapshot title="Updated" snapshot={masterSnapshot(row.new_value)} other={masterSnapshot(row.old_value)} fields={bankFields} />
              </div>
            ) : isCategory ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <RecordSnapshot title="Previous" snapshot={masterSnapshot(row.old_value)} other={masterSnapshot(row.new_value)} fields={row.old_value?.merged_from || row.new_value?.merged_from ? [...categoryFields, { key: 'mergedFrom', label: 'Merged from', className: 'col-span-2' }] : categoryFields} />
                <RecordSnapshot title="Updated" snapshot={masterSnapshot(row.new_value)} other={masterSnapshot(row.old_value)} fields={row.old_value?.merged_from || row.new_value?.merged_from ? [...categoryFields, { key: 'mergedFrom', label: 'Merged from', className: 'col-span-2' }] : categoryFields} />
              </div>
            ) : isUser ? (
              <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start">
                <RecordSnapshot title="Previous" snapshot={userSnapshot(row.old_value)} other={userSnapshot(row.new_value)} fields={userFields} />
                <RecordSnapshot title="Updated" snapshot={userSnapshot(row.new_value)} other={userSnapshot(row.old_value)} fields={userFields} />
              </div>
            ) : (
              <div className="flex flex-col gap-4 lg:flex-row mt-2">
                <section className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-card p-4 shadow-sm dark:border-zinc-700">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Previous </h3>
                  {row.old_value ? <FieldValue value={row.old_value} /> : <p className="text-sm text-gray-400">No values recorded.</p>}
                </section>
                <section className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-card p-4 shadow-sm dark:border-zinc-700">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Updated</h3>
                  {row.new_value ? <FieldValue value={row.new_value} /> : <p className="text-sm text-gray-400">No values recorded.</p>}
                </section>
              </div>
            )}
          </>
        ) : (
          <Card title="Activity" titleSlot={back} />
        )}
      </StatusWrapper>
    </div>
  )
}
