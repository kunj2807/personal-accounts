import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Eye, FileSpreadsheet, FileText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import EntryLines from '../components/EntryLines'
import { BadgeButton, Button, Card, Input, Modal, MultiSelect, NativeSelect, Pagination, SearchSelect, Spinner, StatusWrapper, Table, Title } from '../components/ui'
import { banksApi, categoriesApi, entriesApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { askFilename, formatDate, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'

const blank = () => ({ date: todayISO(), type: 'Debit', bank_id: '', category_id: '', amount: '', description: '' })
const emptyFilters = { dateFrom: '', dateTo: '', type: 'all', description: '', minAmount: '', maxAmount: '', categories: [], banks: [] }

export default function IncomeExpense() {
  const [rows, setRows] = useState([blank()])
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [exporting, setExporting] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [filters, setFilters] = useState(emptyFilters)
  const [draft, setDraft] = useState(emptyFilters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [parentOpen, setParentOpen] = useState(false)
  const [parentId, setParentId] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [view, setView] = useState(null)
  const [edit, setEdit] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const categories = useResource(() => categoriesApi.list(), [])
  const banks = useResource(() => banksApi.list(), [])
  const list = useResource(() => entriesApi.listPage({ ...filters, page, limit }), [filters, page, limit])

  const bankOptions = [{ id: '', name: 'Select' }, ...(banks.data || []).map((item) => ({ id: item.id, name: item.name }))]
  const categoryOptions = [{ id: '', name: 'Select' }, ...(categories.data || []).map((item) => ({ id: item.id, name: item.name }))]

  const submitRows = async () => {
    if (rows.some((row) => !row.date || !row.category_id || !row.bank_id || Number(row.amount) <= 0)) {
      toast.error('Please fix the errors before submitting')
      return
    }
    setParentOpen(true)
  }

  const confirmSubmit = async () => {
    setSubmitting(true)
    try {
      await entriesApi.createMany(rows, parentId || null)
      toast.success('Successfully submitted')
      setRows([blank()])
      setParentId('')
      setParentOpen(false)
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const saveEdit = async () => {
    const next = {
      date: edit.date ? undefined : 'Date is required',
      bank_id: edit.bank_id ? undefined : 'Bank is required',
      category_id: edit.category_id ? undefined : 'Category is required',
      amount: Number(edit.amount) > 0 ? undefined : 'Amount must be greater than 0',
    }
    setEditErrors(next)
    if (Object.values(next).some(Boolean)) {
      toast.error('Please fix the errors before submitting')
      return
    }
    setSaving(true)
    try {
      await entriesApi.update(edit.id, edit)
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
    if (deletingId) return
    if (!window.confirm('Are you sure you want to delete this entry?')) return
    setDeletingId(id)
    try {
      await entriesApi.remove(id)
      toast.success('Successfully deleted')
      if (expanded === id) setExpanded(null)
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  const exportRows = (list.data?.rows || []).map((row) => [formatDate(row.date), row.bank?.name || '-', row.type, row.category?.name || '-', row.amount, row.description || '-'])

  return (
    <div className="flex flex-col gap-2">
      <Card title="Income Expense">
        <EntryLines
          rows={rows}
          onChange={setRows}
          onSubmit={submitRows}
          submitting={submitting}
          columns={[
            { key: 'date', label: 'Date', type: 'date', required: true },
            { key: 'type', label: 'Type', type: 'select', options: [{ id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }] },
            { key: 'bank_id', label: 'Bank', type: 'select', search: true, required: true, options: bankOptions },
            { key: 'category_id', label: 'Category', type: 'select', search: true, required: true, options: categoryOptions },
            { key: 'amount', label: 'Amount', type: 'number', required: true },
            { key: 'description', label: 'Description', placeholder: 'Enter description' },
          ]}
        />
      </Card>
      <Card>
        <div className="mb-4 rounded-xl border border-gray-200 dark:border-zinc-700">
          <div
            role="button"
            tabIndex={0}
            className="flex w-full cursor-pointer items-center justify-between px-4 py-3 outline-none"
            onClick={() => setFiltersOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setFiltersOpen((open) => !open)
              }
            }}
          >
            <Title>Filters</Title>
            {filtersOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {filtersOpen && (
            <form
              className="flex flex-wrap items-end gap-4 px-4 pb-4 pt-2"
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setFilters(draft)
              }}
            >
              <Input label="From" type="date" value={draft.dateFrom} onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })} />
              <Input label="To" type="date" value={draft.dateTo} onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })} />
              <NativeSelect label="Type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} options={[{ id: 'all', name: 'All' }, { id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }]} />
              <div className="min-w-[220px] flex-grow"><MultiSelect label="Banks" options={(banks.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={(banks.data || []).filter((item) => draft.banks.includes(item.id)).map((item) => ({ id: item.id, name: item.name }))} onChange={(value) => setDraft({ ...draft, banks: value.map((item) => item.id) })} /></div>
              <div className="min-w-[220px] flex-grow"><MultiSelect label="Categories" options={(categories.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={(categories.data || []).filter((item) => draft.categories.includes(item.id)).map((item) => ({ id: item.id, name: item.name }))} onChange={(value) => setDraft({ ...draft, categories: value.map((item) => item.id) })} /></div>
              <Input label="Min amount" type="number" value={draft.minAmount} onChange={(event) => setDraft({ ...draft, minAmount: event.target.value })} />
              <Input label="Max amount" type="number" value={draft.maxAmount} onChange={(event) => setDraft({ ...draft, maxAmount: event.target.value })} />
              <Input label="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              <div className="flex w-full justify-end gap-2">
                <Button type="button" variant="secondary" disabled={list.loading} onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1) }}>Reset</Button>
                <Button type="submit" loading={list.loading} disabled={list.loading}>Apply</Button>
              </div>
            </form>
          )}
        </div>
        <div className="mb-3 flex justify-end gap-2">
          <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting === 'excel'} disabled={Boolean(exporting)} onClick={() => runExport(setExporting, 'excel', () => exportExcel(exportRows))}><FileSpreadsheet size={16} /> Excel</Button>
          <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting === 'pdf'} disabled={Boolean(exporting)} onClick={() => runExport(setExporting, 'pdf', () => exportPdf(exportRows))}><FileText size={16} /> PDF</Button>
        </div>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={list.data?.rows || []}
            expandedRowId={expanded}
            onRowClick={(row) => row.children?.length && setExpanded(expanded === row.id ? null : row.id)}
            columns={[
              { key: 'date', label: 'Date', render: (row) => (
                <div className="flex items-center gap-2">
                  {row.children?.length ? (expanded === row.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="inline-block w-4" />}
                  <span>{formatDate(row.date)}</span>
                </div>
              ) },
              { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
              { key: 'type', label: 'Type' },
              { key: 'category', label: 'Category', render: (row) => row.category?.name || '-' },
              { key: 'amount', label: 'Amount', render: (row) => signedAmount(row) },
              { key: 'description', label: 'Description', render: (row) => {
                const parent = linkedParent(row)
                return (
                  <div className="min-w-[150px]">
                    <p>{row.description || '-'}</p>
                    {parent && <p className="text-xs text-gray-500">Parent: {formatDate(parent.date)} · {parent.category?.name || parent.description || '-'}</p>}
                  </div>
                )
              } },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2" onClick={(event) => event.stopPropagation()}>
                  <BadgeButton type="button" variant="outline" disabled={Boolean(deletingId)} onClick={() => setView(row)}><Eye size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="edit" disabled={Boolean(deletingId)} onClick={() => { setEditErrors({}); setEdit({ ...row, date: String(row.date).slice(0, 10), parent_id: row.parent_id || '' }) }}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="delete" disabled={Boolean(deletingId)} onClick={() => remove(row.id)}>
                    {deletingId === row.id ? <Spinner /> : <Trash2 size={15} />}
                  </BadgeButton>
                </div>
              ) },
            ]}
            renderExpandedRow={(row) => (
              <div className="bg-purple-50/40 p-4 dark:bg-zinc-950">
                <h3 className="mb-2 text-sm font-semibold">Child entries</h3>
                <Table
                  data={row.children || []}
                  columns={[
                    { key: 'date', label: 'Date', render: (child) => formatDate(child.date) },
                    { key: 'type', label: 'Type' },
                    { key: 'bank', label: 'Bank', render: (child) => child.bank?.name || '-' },
                    { key: 'category', label: 'Category', render: (child) => child.category?.name || '-' },
                    { key: 'amount', label: 'Amount', render: (child) => signedAmount(child) },
                    { key: 'description', label: 'Description', render: (child) => child.description || '-' },
                  ]}
                />
              </div>
            )}
          />
          <Pagination totalItems={list.data?.total || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>

      <Modal open={parentOpen} onClose={() => !submitting && setParentOpen(false)} title="Select Entry Option" className="max-w-5xl">
        <ParentEntryPicker selectedId={parentId} onSelect={(row) => setParentId(row?.id || '')} />
        <div className="mt-4 flex justify-end gap-3 border-t border-purple-100 pt-4 dark:border-zinc-700">
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => setParentOpen(false)}>Cancel</Button>
          <Button type="button" loading={submitting} disabled={submitting} onClick={confirmSubmit}>Confirm Submit</Button>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title="View Entry Details" className="max-w-5xl">
        {view && <EntryDetails entry={view} onClose={() => setView(null)} />}
      </Modal>

      <Modal open={!!edit} onClose={() => { if (!saving) { setEdit(null); setEditErrors({}) } }} title="Edit Entry" className="max-w-5xl">
        {edit && (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Date" type="date" error={editErrors.date} value={edit.date} onChange={(event) => { setEdit({ ...edit, date: event.target.value }); setEditErrors((current) => ({ ...current, date: undefined })) }} />
              <NativeSelect label="Type" value={edit.type} onChange={(event) => setEdit({ ...edit, type: event.target.value })} options={[{ id: 'Debit', name: 'Debit' }, { id: 'Credit', name: 'Credit' }]} />
              <SearchSelect label="Bank" error={editErrors.bank_id} value={edit.bank_id || ''} onChange={(value) => { setEdit({ ...edit, bank_id: value }); setEditErrors((current) => ({ ...current, bank_id: undefined })) }} options={bankOptions} />
              <SearchSelect label="Category" error={editErrors.category_id} value={edit.category_id || ''} onChange={(value) => { setEdit({ ...edit, category_id: value }); setEditErrors((current) => ({ ...current, category_id: undefined })) }} options={categoryOptions} />
              <Input label="Amount" type="number" error={editErrors.amount} value={edit.amount} onChange={(event) => { setEdit({ ...edit, amount: event.target.value }); setEditErrors((current) => ({ ...current, amount: undefined })) }} />
              <Input label="Description" value={edit.description || ''} onChange={(event) => setEdit({ ...edit, description: event.target.value })} />
            </div>
            {linkedParent(edit) && <ParentSummary parent={linkedParent(edit)} />}
            <div className="border-t border-gray-200 pt-4 dark:border-zinc-700">
              <p className="mb-2 text-sm font-medium">Link to Parent Entry</p>
              <ParentEntryPicker
                key={edit.id}
                selectedId={edit.parent_id || ''}
                excludeId={edit.id}
                onSelect={(row) => {
                  if (row?.parent_id && row.parent_id === edit.id) {
                    toast.error('Choose an entry that is not already a child of this one')
                    return
                  }
                  setEdit({ ...edit, parent_id: row?.id || '', parent: row || null })
                }}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="button" loading={saving} disabled={saving} onClick={saveEdit}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ParentEntryPicker({ selectedId, onSelect, excludeId }) {
  const [mode, setMode] = useState(selectedId ? 'parent' : 'individual')

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
        <input type="radio" name={`parent-mode-${excludeId || 'new'}`} checked={mode === 'parent'} onChange={() => setMode('parent')} />
        Select Parent Entry
      </label>
      <label className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
        <input
          type="radio"
          name={`parent-mode-${excludeId || 'new'}`}
          checked={mode === 'individual'}
          onChange={() => {
            setMode('individual')
            onSelect(null)
          }}
        />
        Select Individual Entry
      </label>
      {mode === 'parent' && <ParentEntryTable selectedId={selectedId} excludeId={excludeId} onSelect={onSelect} />}
    </div>
  )
}

function ParentEntryTable({ selectedId, onSelect, excludeId }) {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const skipSearchReset = useRef(true)
  const list = useResource(() => entriesApi.listPage({ page, limit, search: debounced, excludeId }), [page, limit, debounced, excludeId])

  useEffect(() => {
    if (skipSearchReset.current) {
      skipSearchReset.current = false
      return
    }
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="space-y-3">
      <Input placeholder="Search by description or amount" value={search} onChange={(event) => setSearch(event.target.value)} />
      <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
        <Table
          className="max-h-[50vh]"
          page={page}
          limit={limit}
          data={list.data?.rows || []}
          columns={[
            { key: 'select', label: '', render: (row) => (
              <input type="radio" name={`parent-entry-${excludeId || 'new'}`} checked={selectedId === row.id} onChange={() => onSelect(row)} />
            ) },
            { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
            { key: 'type', label: 'Type' },
            { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
            { key: 'category', label: 'Category', render: (row) => row.category?.name || '-' },
            { key: 'amount', label: 'Amount', render: (row) => signedAmount(row) },
            { key: 'description', label: 'Description', render: (row) => row.description || '-' },
          ]}
        />
      </StatusWrapper>
      <Pagination totalItems={list.data?.total || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
    </div>
  )
}

function EntryDetails({ entry, onClose }) {
  const [exporting, setExporting] = useState(false)
  const children = entry.children || []
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Date">{formatDate(entry.date)}</Field>
        <Field label="Type">{entry.type}</Field>
        <Field label="Bank">{entry.bank?.name || '-'}</Field>
        <Field label="Category">{entry.category?.name || '-'}</Field>
        <Field label="Amount">{signedAmount(entry)}</Field>
        <Field label="Remaining Amount">₹{Number(remainingAmount(entry)).toLocaleString('en-IN')}</Field>
        <Field label="Description" className="md:col-span-2">{entry.description || '-'}</Field>
      </div>
      {linkedParent(entry) && <ParentSummary parent={linkedParent(entry)} />}
      {children.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Child Entries</h3>
          <Table
            data={children}
            columns={[
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
              { key: 'type', label: 'Type' },
              { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
              { key: 'category', label: 'Category', render: (row) => row.category?.name || '-' },
              { key: 'amount', label: 'Amount', render: (row) => signedAmount(row) },
              { key: 'description', label: 'Description', render: (row) => <p className="min-w-[150px]">{row.description || '-'}</p> },
            ]}
          />
        </div>
      )}
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700">
        <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting} disabled={exporting} onClick={() => runExport(setExporting, true, () => exportViewPdf(entry))}><FileText size={16} /> Export PDF</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

function ParentSummary({ parent }) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">Parent Entry Details</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Description">{parent.description || '-'}</Field>
        <Field label="Amount">₹{Number(parent.amount).toLocaleString('en-IN')}</Field>
        <Field label="Date">{formatDate(parent.date)}</Field>
        <Field label="Bank">{parent.bank?.name || '-'}</Field>
        <Field label="Type">{parent.type}</Field>
        <Field label="Category" className="col-span-2">{parent.category?.name || '-'}</Field>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">{children}</div>
    </div>
  )
}

function linkedParent(entry) {
  const parent = Array.isArray(entry?.parent) ? entry.parent.find((item) => item?.id) : entry?.parent
  return parent?.id ? parent : null
}

function signedAmount(row) {
  return (
    <span className={`font-medium ${row.type === 'Debit' ? 'text-red-600' : 'text-green-600'}`}>
      {row.type === 'Debit' ? '-' : '+'}₹{Number(row.amount).toLocaleString('en-IN')}
    </span>
  )
}

function remainingAmount(entry) {
  const adjustment = (entry.children || []).reduce((sum, child) => {
    const value = Number(child.amount) || 0
    return sum + (child.type === entry.type ? -value : value)
  }, 0)
  return Number(entry.amount) - adjustment
}

async function runExport(setExporting, kind, work) {
  setExporting(kind)
  try {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await work()
  } finally {
    setExporting('')
  }
}

function exportPdf(rows) {
  const name = askFilename('income-expense.pdf')
  if (!name) return
  const doc = new jsPDF()
  doc.text('Income Expense', 14, 15)
  autoTable(doc, { startY: 24, head: [['Date', 'Bank', 'Type', 'Category', 'Amount', 'Description']], body: rows, styles: { fontSize: 8 } })
  doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
}

function exportViewPdf(entry) {
  const name = askFilename(`${entry.description || 'entry'}.pdf`)
  if (!name) return
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Entry Details', 14, 15)
  doc.setFontSize(12)
  doc.text('Main Entry', 14, 30)
  const children = entry.children || []
  autoTable(doc, {
    startY: 35,
    head: [['Field', 'Value']],
    body: [
      ['Date', formatDate(entry.date)],
      ['Bank', entry.bank?.name || '-'],
      ['Type', entry.type],
      ['Category', entry.category?.name || '-'],
      ['Amount', String(Number(entry.amount))],
      ['Description', entry.description || '-'],
      ...(children.length ? [['Remaining Amount', String(Number(remainingAmount(entry)))]] : []),
    ],
    styles: { fontSize: 10 },
  })
  let cursor = doc.lastAutoTable.finalY
  const parent = linkedParent(entry)
  if (parent) {
    doc.text('Parent Entry', 14, cursor + 15)
    autoTable(doc, {
      startY: cursor + 20,
      head: [['Field', 'Value']],
      body: [
        ['Date', formatDate(parent.date)],
        ['Bank', parent.bank?.name || '-'],
        ['Type', parent.type],
        ['Category', parent.category?.name || '-'],
        ['Amount', String(Number(parent.amount))],
        ['Description', parent.description || '-'],
      ],
      styles: { fontSize: 10 },
    })
    cursor = doc.lastAutoTable.finalY
  }
  if (children.length) {
    doc.text('Child Entries', 14, cursor + 15)
    autoTable(doc, {
      startY: cursor + 20,
      head: [['S.No', 'Date', 'Bank', 'Type', 'Category', 'Amount', 'Description']],
      body: children.map((child, index) => [index + 1, formatDate(child.date), child.bank?.name || '-', child.type, child.category?.name || '-', Number(child.amount), child.description || '-']),
      styles: { fontSize: 8 },
    })
  }
  doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
}

async function exportExcel(rows) {
  const name = askFilename('income-expense.xlsx')
  if (!name) return
  const { downloadWorkbook } = await import('../lib/utils')
  await downloadWorkbook(name, [['Date', 'Bank', 'Type', 'Category', 'Amount', 'Description'], ...rows], 'Income Expense')
}
