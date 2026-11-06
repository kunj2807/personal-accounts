import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, FileText, Pencil, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import EntryLines from '../components/EntryLines'
import { BadgeButton, Button, Card, Input, Modal, MultiSelect, NativeSelect, Pagination, SearchSelect, Spinner, StatusWrapper, Table, Title } from '../components/ui'
import { banksApi, categoriesApi, lendingApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { askFilename, formatAmount, formatDate, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'

const blank = () => ({ date: todayISO(), type: 'Debit', bank_id: '', category_id: '', amount: '', due_date: '', description: '' })
const emptyFilters = { dateFrom: '', dateTo: '', type: 'all', description: '', categories: [], banks: [] }

export default function LendingBorrowing() {
  const [rows, setRows] = useState([blank()])
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [exportingView, setExportingView] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [filters, setFilters] = useState(emptyFilters)
  const [draft, setDraft] = useState(emptyFilters)
  const [view, setView] = useState(null)
  const [edit, setEdit] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [itemErrors, setItemErrors] = useState([])
  const [convert, setConvert] = useState(null)
  const [converting, setConverting] = useState(false)
  const categories = useResource(() => categoriesApi.list(), [])
  const banks = useResource(() => banksApi.list(), [])
  const list = useResource(() => lendingApi.listPage({ ...filters, ledgers: filters.categories, page, limit }), [filters, page, limit])
  const bankOptions = [{ id: '', name: 'Select' }, ...(banks.data || []).map((item) => ({ id: item.id, name: item.name }))]
  const ledgerOptions = [{ id: '', name: 'Select' }, ...(categories.data || []).map((item) => ({ id: item.id, name: item.name }))]

  const submit = async () => {
    if (rows.some((row) => !row.date || !row.category_id || !row.due_date || Number(row.amount) <= 0)) {
      toast.error('Please fix the errors before submitting')
      return
    }
    setSubmitting(true)
    try {
      await lendingApi.createMany(rows)
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
      category_id: edit.category_id ? undefined : 'From/To is required',
      due_date: edit.due_date ? undefined : 'Due Date is required',
      amount: Number(edit.amount) > 0 ? undefined : 'Amount must be greater than 0',
    }
    const items = (edit.items || []).map((item) => ({
      date: item.date ? undefined : 'Date is required',
      amount: Number(item.amount) > 0 ? undefined : 'Amount must be greater than 0',
    }))
    setEditErrors(next)
    setItemErrors(items)
    if (Object.values(next).some(Boolean) || items.some((item) => Object.values(item).some(Boolean))) {
      toast.error('Please fix the errors before submitting')
      return
    }
    setSaving(true)
    try {
      await lendingApi.update(edit.id, edit, edit.items || [])
      toast.success('Successfully updated')
      setEdit(null)
      setEditErrors({})
      setItemErrors([])
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
      await lendingApi.remove(id)
      toast.success('Successfully deleted')
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  const openConvert = (row) => {
    setConvert({ entry: row, category_id: row.category_id || '' })
  }

  const convertExpense = async () => {
    if (converting || !convert) return
    setConverting(true)
    try {
      await lendingApi.convertToExpense(convert.entry, convert)
      toast.success('Converted as expense')
      if (view?.id === convert.entry.id) setView(null)
      setConvert(null)
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setConverting(false)
    }
  }

  const busy = submitting || saving || converting || Boolean(deletingId)

  return (
    <div className="flex flex-col gap-2">
      <Card title="Landing Borrowing">
        <EntryLines
          rows={rows}
          onChange={setRows}
          onSubmit={submit}
          submitting={submitting}
          columns={[
            { key: 'date', label: 'Date', type: 'date', required: true },
            { key: 'type', label: 'Type', type: 'select', options: [{ id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }] },
            { key: 'bank_id', label: 'Bank', type: 'select', search: true, options: bankOptions },
            { key: 'category_id', label: 'From/To', type: 'select', search: true, required: true, options: ledgerOptions },
            { key: 'amount', label: 'Amount', type: 'number', required: true },
            { key: 'due_date', label: 'Due Date', type: 'date', required: true },
            { key: 'description', label: 'Description', placeholder: 'Enter description' },
          ]}
        />
      </Card>
      <Card>
        <div className="mb-4 rounded-xl border border-gray-200 dark:border-zinc-700">
          <div role="button" tabIndex={0} className="flex w-full cursor-pointer items-center justify-between px-4 py-3" onClick={() => setFiltersOpen((open) => !open)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFiltersOpen((open) => !open) } }}>
            <Title>Filters</Title>
            {filtersOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {filtersOpen && (
            <form className="flex flex-wrap items-end gap-4 px-4 pb-4 pt-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilters(draft) }}>
              <Input label="From" type="date" value={draft.dateFrom} onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })} />
              <Input label="To" type="date" value={draft.dateTo} onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })} />
              <NativeSelect label="Type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} options={[{ id: 'all', name: 'All' }, { id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }]} />
              <div className="min-w-[220px] flex-grow"><MultiSelect label="Banks" options={(banks.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={(banks.data || []).filter((item) => draft.banks.includes(item.id)).map((item) => ({ id: item.id, name: item.name }))} onChange={(value) => setDraft({ ...draft, banks: value.map((item) => item.id) })} /></div>
              <div className="min-w-[220px] flex-grow"><MultiSelect label="From/To" options={(categories.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={(categories.data || []).filter((item) => draft.categories.includes(item.id)).map((item) => ({ id: item.id, name: item.name }))} onChange={(value) => setDraft({ ...draft, categories: value.map((item) => item.id) })} /></div>
              <Input label="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              <div className="flex w-full justify-end gap-2">
                <Button type="button" variant="secondary" disabled={list.loading} onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1) }}>Reset</Button>
                <Button type="submit" loading={list.loading} disabled={list.loading}>Apply</Button>
              </div>
            </form>
          )}
        </div>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={list.data?.rows || []}
            columns={[
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
              { key: 'type', label: 'Type' },
              { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
              { key: 'category', label: 'From/To', render: (row) => row.category?.name || '-' },
              { key: 'amount', label: 'Amount', render: (row) => formatAmount(row.amount) },
              { key: 'remaining_amount', label: 'Pending', render: (row) => <span className={Number(row.remaining_amount) > 0 && row.due_date < todayISO() ? 'font-semibold text-red-600' : ''}>{formatAmount(row.remaining_amount)}</span> },
              { key: 'due_date', label: 'Due Date', render: (row) => formatDate(row.due_date) },
              { key: 'description', label: 'Description', render: (row) => row.description || '-' },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton type="button" variant="outline" disabled={busy} onClick={() => setView(row)}><Eye size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="edit" disabled={busy} onClick={() => { setEditErrors({}); setItemErrors([]); setEdit(toEdit(row)) }}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="outline" disabled={busy} title="Convert as expense" aria-label="Convert as expense" onClick={() => openConvert(row)}><Receipt size={15} /></BadgeButton>
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

      <Modal open={!!view} onClose={() => setView(null)} title="Entry Details" className="max-w-5xl">
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Date">{formatDate(view.date)}</Field>
              <Field label="Type">{view.type}</Field>
              <Field label="Bank">{view.bank?.name || '-'}</Field>
              <Field label="From/To">{view.category?.name || '-'}</Field>
              <Field label="Amount">{formatAmount(view.amount)}</Field>
              <Field label="Due Date" className={isOverdue(view) ? 'text-red-500' : ''}>{formatDate(view.due_date)}</Field>
              <Field label="Description">{view.description || '-'}</Field>
              <Field label="Due Amount" className={isOverdue(view) ? 'text-red-500' : ''}>{formatAmount(view.remaining_amount)}</Field>
            </div>
            {(view.lending_items || []).length > 0 && (
              <div>
                <h3 className="mb-2 text-lg font-medium">Child Entries</h3>
                <Table
                  data={view.lending_items}
                  columns={[
                    { key: 'sno', label: 'S.No', render: (_row, index) => index + 1 },
                    { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
                    { key: 'type', label: 'Type' },
                    { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
                    { key: 'amount', label: 'Amount', render: (row) => formatAmount(row.amount) },
                    { key: 'description', label: 'Description', render: (row) => <p className="min-w-[150px]">{row.description || '-'}</p> },
                  ]}
                />
              </div>
            )}
            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end dark:border-zinc-700">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setView(null)}>Close</Button>
              <Button type="button" variant="secondary" className="flex w-full items-center justify-center gap-2 sm:w-auto" loading={exportingView} disabled={exportingView} onClick={async () => { setExportingView(true); try { await new Promise((resolve) => setTimeout(resolve, 0)); exportViewPdf(view) } finally { setExportingView(false) } }}><FileText size={16} /> PDF</Button>
              <Button type="button" className="flex w-full items-center justify-center gap-2 sm:w-auto" disabled={busy} onClick={() => openConvert(view)}><Receipt size={16} /> Convert as expense</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!convert} onClose={() => !converting && setConvert(null)} title="Convert as expense" className="max-w-lg">
        {convert && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              The parent and each child are copied with their own type. A debit stays a debit and a credit stays a credit. One statement is created for each, and this lending entry is removed.
            </p>
            <SearchSelect label="Category" value={convert.category_id} onChange={(value) => setConvert({ ...convert, category_id: value })} options={ledgerOptions} />
            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end dark:border-zinc-700">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={converting} onClick={() => setConvert(null)}>Cancel</Button>
              <Button type="button" className="w-full sm:w-auto" loading={converting} disabled={converting} onClick={convertExpense}>Convert</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => { if (!saving) { setEdit(null); setEditErrors({}); setItemErrors([]) } }} title="Edit Entry" className="max-w-5xl">
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Date" type="date" error={editErrors.date} value={edit.date} onChange={(event) => { setEdit({ ...edit, date: event.target.value }); setEditErrors((current) => ({ ...current, date: undefined })) }} />
              <NativeSelect label="Type" value={edit.type} onChange={(event) => setEdit({ ...edit, type: event.target.value })} options={[{ id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }]} />
              <SearchSelect label="Bank" value={edit.bank_id || ''} onChange={(value) => setEdit({ ...edit, bank_id: value })} options={bankOptions} />
              <SearchSelect label="From/To" error={editErrors.category_id} value={edit.category_id || ''} onChange={(value) => { setEdit({ ...edit, category_id: value }); setEditErrors((current) => ({ ...current, category_id: undefined })) }} options={ledgerOptions} />
              <Input label="Amount" type="number" error={editErrors.amount} value={edit.amount} onChange={(event) => { setEdit({ ...edit, amount: event.target.value }); setEditErrors((current) => ({ ...current, amount: undefined })) }} />
              <Input label="Due Date" type="date" error={editErrors.due_date} value={edit.due_date || ''} onChange={(event) => { setEdit({ ...edit, due_date: event.target.value }); setEditErrors((current) => ({ ...current, due_date: undefined })) }} />
              <Input label="Description" value={edit.description || ''} onChange={(event) => setEdit({ ...edit, description: event.target.value })} />
              <Input label="Due Amount" value={formatAmount(pendingAmount(edit))} disabled />
            </div>
            <div className="mt-3 max-h-[50vh] overflow-auto rounded-xl border border-purple-100 dark:border-zinc-700">
              <table className="min-w-full divide-y divide-purple-100 dark:divide-zinc-700">
                <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-zinc-700">
                  <tr>
                    {['S.No', 'Date', 'Type', 'Bank', 'Amount', 'Description', 'Action'].map((label) => (
                      <th key={label} className="px-3 py-3 text-left text-xs font-bold uppercase text-gray-500 dark:text-gray-300">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(edit.items || []).map((item, index) => (
                    <tr key={item.id || index} className="even:bg-purple-50 even:dark:bg-zinc-800">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2"><Input type="date" className="min-w-[100px]" error={itemErrors[index]?.date} value={item.date} onChange={(event) => { updateItem(setEdit, edit, index, { date: event.target.value }); setItemErrors((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, date: undefined } : row))) }} /></td>
                      <td className="px-3 py-2"><NativeSelect className="min-w-[100px]" value={item.type} onChange={(event) => updateItem(setEdit, edit, index, { type: event.target.value })} options={[{ id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }]} /></td>
                      <td className="px-3 py-2"><SearchSelect className="min-w-[160px]" value={item.bank_id || ''} onChange={(value) => updateItem(setEdit, edit, index, { bank_id: value })} options={bankOptions} /></td>
                      <td className="px-3 py-2"><Input type="number" className="min-w-[100px]" error={itemErrors[index]?.amount} value={item.amount} onChange={(event) => { updateItem(setEdit, edit, index, { amount: event.target.value }); setItemErrors((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, amount: undefined } : row))) }} /></td>
                      <td className="px-3 py-2"><Input className="min-w-[200px]" value={item.description || ''} onChange={(event) => updateItem(setEdit, edit, index, { description: event.target.value })} /></td>
                      <td className="px-2 py-2">
                        <BadgeButton type="button" variant="delete" disabled={saving} aria-label="Remove payment" onClick={() => { setEdit({ ...edit, items: edit.items.filter((_, itemIndex) => itemIndex !== index) }); setItemErrors((current) => current.filter((_, itemIndex) => itemIndex !== index)) }}>
                          <Trash2 size={15} />
                        </BadgeButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setEdit({ ...edit, items: [...(edit.items || []), { date: todayISO(), type: edit.type === 'Debit' ? 'Credit' : 'Debit', amount: '', bank_id: '', description: '' }] })}>Add More</Button>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="button" loading={saving} disabled={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function updateItem(setEdit, edit, index, patch) {
  setEdit({ ...edit, items: edit.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)) })
}

function toEdit(row) {
  return {
    ...row,
    date: String(row.date).slice(0, 10),
    due_date: row.due_date ? String(row.due_date).slice(0, 10) : '',
    items: (row.lending_items || []).map((item) => ({ ...item, date: String(item.date).slice(0, 10), bank_id: item.bank_id || '', description: item.description || '' })),
  }
}

function pendingAmount(entry) {
  const extra = (entry.items || []).reduce((sum, item) => {
    const value = Number(item.amount) || 0
    return sum + (item.type === entry.type ? value : -value)
  }, 0)
  return Number(entry.amount || 0) + extra
}

function isOverdue(entry) {
  const due = entry.due_date ? String(entry.due_date).slice(0, 10) : ''
  return Boolean(due && due < todayISO() && Number(entry.remaining_amount) !== 0)
}

function Field({ label, children, className = '' }) {
  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <div className={className || 'text-gray-900 dark:text-gray-100'}>{children}</div>
    </div>
  )
}

function pdfAmount(value) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function exportViewPdf(entry) {
  const name = askFilename(`${entry.description || 'entry'}.pdf`)
  if (!name) return
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Entry Details', 14, 15)
  autoTable(doc, {
    startY: 24,
    head: [['Field', 'Value']],
    body: [
      ['Date', formatDate(entry.date)],
      ['Type', entry.type],
      ['Bank', entry.bank?.name || '-'],
      ['From/To', entry.category?.name || '-'],
      ['Amount', pdfAmount(entry.amount)],
      ['Due Date', formatDate(entry.due_date)],
      ['Due Amount', pdfAmount(entry.remaining_amount)],
      ['Description', entry.description || '-'],
    ],
    styles: { fontSize: 10 },
  })
  const items = entry.lending_items || []
  if (items.length) {
    doc.text('Child Entries', 14, doc.lastAutoTable.finalY + 12)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 16,
      head: [['S.No', 'Date', 'Type', 'Bank', 'Amount', 'Description']],
      body: items.map((item, index) => [index + 1, formatDate(item.date), item.type, item.bank?.name || '-', pdfAmount(item.amount), item.description || '-']),
      styles: { fontSize: 8 },
    })
  }
  doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
}
