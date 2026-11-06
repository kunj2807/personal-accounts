import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, FileSpreadsheet, FileText, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BadgeButton, Button, Card, Input, Modal, NativeSelect, Pagination, Spinner, StatusWrapper, Table } from '../components/ui'
import { formsApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { askFilename, downloadWorkbook, formatDate, slugify } from '../lib/utils'
import { useResource } from '../lib/useResource'

export default function CustomFormDetail() {
  const { id } = useParams()
  const form = useResource(() => formsApi.get(id), [id])
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [sortType, setSortType] = useState('text')
  const entries = useResource(() => formsApi.entries(id, { key: sortKey, direction: sortDir, type: sortType }), [id, sortKey, sortDir, sortType])
  const [values, setValues] = useState({})
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [exporting, setExporting] = useState('')
  const fields = form.data?.fields || []
  const rows = entries.data || []
  const visible = rows.slice((page - 1) * limit, page * limit)
  const totals = useMemo(() => {
    const result = {}
    for (const field of fields.filter((item) => item.type === 'number' && item.total)) {
      result[field.key] = rows.reduce((sum, row) => sum + Number(row.data?.[field.key] || 0), 0)
    }
    return result
  }, [fields, rows])

  const saveNew = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await formsApi.addEntry(id, values)
      toast.success('Entry added')
      setValues({})
      entries.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await formsApi.updateEntry(edit.id, edit.data)
      toast.success('Entry updated')
      setEdit(null)
      entries.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setUpdating(false)
    }
  }

  const toggleSort = (key, type) => {
    setPage(1)
    if (sortKey === key) {
      setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortType(type === 'number' ? 'number' : 'text')
    setSortDir(type === 'number' ? 'desc' : 'asc')
  }

  const fileBase = slugify(form.data?.title) || 'custom-form'

  const exportExcel = () => {
    const name = askFilename(`${fileBase}.xlsx`)
    if (!name) return
    const header = fields.map((field) => field.name)
    const body = rows.map((row) => fields.map((field) => excelCell(field, row.data?.[field.key])))
    const totals = totalCells(fields, rows, false)
    return downloadWorkbook(name, [header, ...body, ...(totals ? [totals] : [])], sheetName(form.data?.title))
  }

  const exportPdf = () => {
    const name = askFilename(`${fileBase}.pdf`)
    if (!name) return
    const title = form.data?.title || 'Custom form'
    const doc = new jsPDF({ orientation: fields.length > 4 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59)
    const titleLines = doc.splitTextToSize(title, pageWidth - 28)
    doc.text(titleLines, 14, 14)
    const body = rows.map((row) => fields.map((field) => pdfCell(field, row.data?.[field.key])))
    const totals = totalCells(fields, rows, true)
    if (totals) body.push(totals)
    autoTable(doc, {
      startY: 14 + titleLines.length * 7 + 2,
      margin: { top: 14, right: 14, bottom: 16, left: 14 },
      head: [fields.map((field) => field.name)],
      body,
      theme: 'grid',
      styles: { fontSize: fields.length > 6 ? 8 : 9, cellPadding: 2.2, overflow: 'linebreak', valign: 'middle', textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        const field = fields[data.column.index]
        if (field?.type === 'number') data.cell.styles.halign = 'right'
        if (totals && data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [226, 232, 240]
        }
      },
    })
    const totalPages = doc.getNumberOfPages()
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      doc.setPage(pageNumber)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(doc.splitTextToSize(title, pageWidth - 50)[0], 14, pageHeight - 8)
      doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
    }
    doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
  }

  const remove = async (entryId) => {
    if (deletingId) return
    if (!window.confirm('Delete this entry?')) return
    setDeletingId(entryId)
    try {
      await formsApi.removeEntry(entryId)
      toast.success('Entry deleted')
      entries.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Card title={form.data?.title || 'Custom form'}>
        <StatusWrapper loading={form.loading} error={form.error} onRetry={form.reload}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveNew}>
            {fields.map((field) => (
              <Field key={field.key || field.name} field={field} value={values[field.key]} onChange={(value) => setValues({ ...values, [field.key]: value })} />
            ))}
            <div className="md:col-span-2 flex justify-end"><Button type="submit" loading={saving}>Add entry</Button></div>
          </form>
        </StatusWrapper>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {Object.keys(totals).length > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(totals).map(([key, value]) => <span key={key} className="rounded bg-indigo-50 px-3 py-1 dark:bg-zinc-800">{key}: {value}</span>)}
            </div>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting === 'excel'} disabled={entries.loading || !fields.length || Boolean(exporting)} onClick={() => runExport(setExporting, 'excel', exportExcel)}><FileSpreadsheet size={16} /> Excel</Button>
            <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting === 'pdf'} disabled={entries.loading || !fields.length || Boolean(exporting)} onClick={() => runExport(setExporting, 'pdf', exportPdf)}><FileText size={16} /> PDF</Button>
          </div>
        </div>
        <StatusWrapper loading={entries.loading} error={entries.error} onRetry={entries.reload}>
          <Table
            page={page}
            limit={limit}
            data={visible}
            columns={[
              ...fields.map((field) => ({
                key: field.key,
                label: <SortHeader label={field.name} active={sortKey === field.key} direction={sortDir} onClick={() => toggleSort(field.key, field.type)} />,
                render: (row) => displayValue(field, row.data?.[field.key]),
              })),
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton type="button" variant="outline" disabled={Boolean(deletingId) || updating} onClick={() => setView(row)}><Eye size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="edit" disabled={Boolean(deletingId) || updating} onClick={() => setEdit({ id: row.id, data: { ...row.data } })}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="delete" disabled={Boolean(deletingId) || updating} onClick={() => remove(row.id)}>
                    {deletingId === row.id ? <Spinner /> : <Trash2 size={15} />}
                  </BadgeButton>
                </div>
              ) },
            ]}
          />
          <Pagination totalItems={rows.length} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title={form.data?.title || 'Entry Details'} className="max-w-3xl">
        {view && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key}>
                  <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">{field.name}</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{displayValue(field, view.data?.[field.key])}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-zinc-700">
              <Button type="button" variant="secondary" onClick={() => setView(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!edit} onClose={() => !updating && setEdit(null)} title="Edit Entry" className="max-w-3xl">
        {edit && (
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <Field key={field.key} field={field} value={edit.data?.[field.key]} onChange={(value) => setEdit({ ...edit, data: { ...edit.data, [field.key]: value } })} />
            ))}
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700 md:col-span-2">
              <Button type="button" variant="secondary" disabled={updating} onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="button" loading={updating} disabled={updating} onClick={saveEdit}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function displayValue(field, value) {
  if (value === undefined || value === null || value === '') return '-'
  if (field.type === 'date') return formatDate(value)
  return String(value)
}

function excelCell(field, value) {
  if (value === undefined || value === null || value === '') return '-'
  if (field.type === 'date') return formatDate(value)
  if (field.type === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : '-'
  }
  return String(value)
}

function pdfCell(field, value) {
  if (value === undefined || value === null || value === '') return '-'
  if (field.type === 'date') return formatDate(value)
  if (field.type === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number)) return '-'
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(number)
  }
  return String(value)
}

function totalCells(fields, rows, forPdf) {
  if (!fields.some((field) => field.type === 'number' && field.total)) return null
  let labeled = false
  return fields.map((field) => {
    if (field.type === 'number' && field.total) {
      const sum = rows.reduce((total, row) => total + (Number(row.data?.[field.key]) || 0), 0)
      return forPdf ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(sum) : sum
    }
    if (!labeled) {
      labeled = true
      return 'Total'
    }
    return ''
  })
}

function sheetName(title) {
  const name = String(title || 'Entries').replace(/[\\/?*[\]:]/g, ' ').trim() || 'Entries'
  return name.slice(0, 31)
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

function SortHeader({ label, active, direction, onClick }) {
  return (
    <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wider" onClick={onClick}>
      {label}
      {active ? (direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronsUpDown size={14} className="opacity-40" />}
    </button>
  )
}

function Field({ field, value, onChange }) {
  if (field.type === 'select') {
    return <NativeSelect label={field.name} value={value || ''} onChange={(event) => onChange(event.target.value)} options={[{ id: '', name: 'Select' }, ...(field.options || []).filter(Boolean).map((option) => ({ id: option, name: option }))]} />
  }
  return <Input label={field.name} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={value || ''} onChange={(event) => onChange(event.target.value)} />
}
