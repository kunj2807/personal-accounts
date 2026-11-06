import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import EntryLines from '../components/EntryLines'
import { BadgeButton, Button, Card, Input, Modal, NativeSelect, Pagination, Spinner, StatusWrapper, Table, Title } from '../components/ui'
import { banksApi, depositsApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatAmount, formatDate, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'

const blank = () => ({ date: todayISO(), type: 'Deposit', bank_id: '', amount: '', description: '' })
const emptyFilters = { dateFrom: '', dateTo: '', type: 'all', description: '' }

export default function DepositWithdraw() {
  const [rows, setRows] = useState([blank()])
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [filters, setFilters] = useState(emptyFilters)
  const [draft, setDraft] = useState(emptyFilters)
  const [edit, setEdit] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [view, setView] = useState(null)
  const banks = useResource(() => banksApi.list({ includeCash: false }), [])
  const list = useResource(() => depositsApi.listPage({ ...filters, page, limit }), [filters, page, limit])
  const bankOptions = [{ id: '', name: 'Select Bank' }, ...(banks.data || []).map((item) => ({ id: item.id, name: item.name }))]

  const submit = async () => {
    if (rows.some((row) => !row.date || !row.bank_id || Number(row.amount) <= 0)) {
      toast.error('Please fix the errors before submitting')
      return
    }
    setSubmitting(true)
    try {
      await depositsApi.createMany(rows)
      toast.success('Successfully submitted')
      setRows([blank()])
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const save = async () => {
    if (saving) return
    const next = {
      date: edit.date ? undefined : 'Date is required',
      bank_id: edit.bank_id ? undefined : 'Bank is required',
      amount: Number(edit.amount) > 0 ? undefined : 'Amount must be greater than 0',
    }
    setEditErrors(next)
    if (Object.values(next).some(Boolean)) {
      toast.error('Please fix the errors before submitting')
      return
    }
    setSaving(true)
    try {
      await depositsApi.update(edit.id, edit)
      toast.success('Successfully updated')
      setEdit(null)
      setEditErrors({})
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (deletingId || saving) return
    if (!window.confirm('Are you sure you want to delete this entry?')) return
    setDeletingId(id)
    try {
      await depositsApi.remove(id)
      toast.success('Successfully deleted')
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  const busy = submitting || saving || Boolean(deletingId)

  return (
    <div className="flex flex-col gap-2">
      <Card title="Deposite Withdraw">
        <EntryLines
          rows={rows}
          onChange={setRows}
          onSubmit={submit}
          submitting={submitting}
          columns={[
            { key: 'date', label: 'Date', type: 'date', required: true },
            { key: 'type', label: 'Type', type: 'select', options: [{ id: 'Deposit', name: 'Deposit' }, { id: 'Withdrawal', name: 'Withdrawal' }] },
            { key: 'bank_id', label: 'Bank', type: 'select', required: true, options: bankOptions },
            { key: 'amount', label: 'Amount', type: 'number', required: true },
            { key: 'description', label: 'Description', placeholder: 'Enter description' },
          ]}
        />
      </Card>
      <Card>
        <FilterAccordion open={filtersOpen} onToggle={() => setFiltersOpen((open) => !open)}>
          <form className="flex flex-wrap items-end gap-4" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters(draft) }}>
            <Input label="From" type="date" value={draft.dateFrom} onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })} />
            <Input label="To" type="date" value={draft.dateTo} onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })} />
            <NativeSelect label="Type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} options={[{ id: 'all', name: 'All' }, { id: 'Deposit', name: 'Deposit' }, { id: 'Withdrawal', name: 'Withdrawal' }]} />
            <Input label="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="secondary" disabled={list.loading} onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1) }}>Reset</Button>
              <Button type="submit" loading={list.loading} disabled={list.loading}>Apply</Button>
            </div>
          </form>
        </FilterAccordion>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={list.data?.rows || []}
            columns={[
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
              { key: 'type', label: 'Type' },
              { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
              { key: 'amount', label: 'Amount', render: (row) => <span className={row.type === 'Withdrawal' ? 'text-red-600' : 'text-green-600'}>{formatAmount(row.amount)}</span> },
              { key: 'description', label: 'Description', render: (row) => row.description || '-' },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton type="button" variant="outline" disabled={busy} onClick={() => setView(row)}><Eye size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="edit" disabled={busy} onClick={() => { setEditErrors({}); setEdit({ ...row, date: String(row.date).slice(0, 10) }) }}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="delete" disabled={busy} onClick={() => remove(row.id)}>
                    {deletingId === row.id ? <Spinner /> : <Trash2 size={15} />}
                  </BadgeButton>
                </div>
              ) },
            ]}
          />
          <Pagination totalItems={list.data?.total || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title="Entry Details" className="max-w-3xl">
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Detail label="Date">{formatDate(view.date)}</Detail>
              <Detail label="Type">{view.type}</Detail>
              <Detail label="Bank">{view.bank?.name || '-'}</Detail>
              <Detail label="Amount"><span className={view.type === 'Withdrawal' ? 'font-medium text-red-600' : 'font-medium text-green-600'}>{formatAmount(view.amount)}</span></Detail>
              <Detail label="Description" className="md:col-span-2">{view.description || '-'}</Detail>
            </div>
            <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-zinc-700">
              <Button type="button" variant="secondary" onClick={() => setView(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => { if (!saving) { setEdit(null); setEditErrors({}) } }} title="Edit Entry" className="max-w-3xl">
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Date" type="date" error={editErrors.date} value={edit.date} onChange={(event) => { setEdit({ ...edit, date: event.target.value }); setEditErrors((current) => ({ ...current, date: undefined })) }} />
              <NativeSelect label="Type" value={edit.type} onChange={(event) => setEdit({ ...edit, type: event.target.value })} options={[{ id: 'Deposit', name: 'Deposit' }, { id: 'Withdrawal', name: 'Withdrawal' }]} />
              <NativeSelect label="Bank" error={editErrors.bank_id} value={edit.bank_id || ''} onChange={(event) => { setEdit({ ...edit, bank_id: event.target.value }); setEditErrors((current) => ({ ...current, bank_id: undefined })) }} options={bankOptions} />
              <Input label="Amount" type="number" error={editErrors.amount} value={edit.amount} onChange={(event) => { setEdit({ ...edit, amount: event.target.value }); setEditErrors((current) => ({ ...current, amount: undefined })) }} />
              <div className="md:col-span-2"><Input label="Description" value={edit.description || ''} onChange={(event) => setEdit({ ...edit, description: event.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="button" loading={saving} disabled={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function FilterAccordion({ open, onToggle, children }) {
  return (
    <div className="mb-4 rounded-xl border border-gray-200 dark:border-zinc-700">
      <div role="button" tabIndex={0} className="flex w-full cursor-pointer items-center justify-between px-4 py-3" onClick={onToggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } }}>
        <Title>Filters</Title>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  )
}

function Detail({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="text-sm text-gray-900 dark:text-gray-100">{children}</div>
    </div>
  )
}
