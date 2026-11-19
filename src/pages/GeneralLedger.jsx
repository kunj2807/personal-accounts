import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'react-toastify'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, Input, MultiSelect, StatusWrapper, Table } from '../components/ui'
import { banksApi, categoriesApi, reportsApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { askFilename, downloadWorkbook, formatAmount, formatDate, monthStartISO, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'

export default function GeneralLedger() {
  const [startDate, setStartDate] = useState(monthStartISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [ledgers, setLedgers] = useState([])
  const [banks, setBanks] = useState([])
  const [rows, setRows] = useState([])
  const [applied, setApplied] = useState({ startDate: monthStartISO(), endDate: todayISO(), banks: [] })
  const [expanded, setExpanded] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const categories = useResource(() => categoriesApi.list({ enabledOnly: false }), [])
  const bankList = useResource(() => banksApi.list(), [])

  const generate = async (payload = { startDate, endDate, ledgers: ledgers.map((item) => item.id), banks: banks.map((item) => item.id) }) => {
    setLoading(true)
    setError('')
    setExpanded(null)
    try {
      const result = await reportsApi.generalLedger(payload)
      setApplied({ startDate: payload.startDate, endDate: payload.endDate, banks: payload.banks })
      setRows(result)
    } catch (err) {
      setError(friendlyError(err))
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generate({ startDate: monthStartISO(), endDate: todayISO(), ledgers: [], banks: [] })
  }, [])

  const openRow = async (row) => {
    if (!row.debit && !row.credit) return
    if (expanded === row.id) {
      setExpanded(null)
      return
    }
    setExpanded(row.id)
    if (row.data) return
    setDetailId(row.id)
    try {
      const data = await reportsApi.generalLedgerEntries({
        categoryId: row.id,
        startDate: applied.startDate,
        endDate: applied.endDate,
        banks: applied.banks,
      })
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, data } : item)))
    } catch (err) {
      setExpanded(null)
      toast.error(friendlyError(err))
    } finally {
      setDetailId((current) => (current === row.id ? null : current))
    }
  }

  const exportPdf = () => {
    const name = askFilename('general-ledger.pdf')
    if (!name) return
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('General Ledger Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)
    autoTable(doc, { startY: 30, head: [['Ledger', 'Debit', 'Credit', 'Balance']], body: rows.map((row) => [row.name, row.debit, row.credit, row.balance]), styles: { fontSize: 8 }, headStyles: { fillColor: [41, 128, 185] } })
    doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
  }

  const exportExcel = () => {
    const name = askFilename('general-ledger.xlsx')
    if (!name) return
    return downloadWorkbook(name, [['General Ledger Report'], [`Period: ${startDate} to ${endDate}`], [], ['Ledger', 'Debit', 'Credit', 'Balance'], ...rows.map((row) => [row.name, row.debit, row.credit, row.balance])], 'General Ledger')
  }

  return (
    <Card title="General Ledger Report">
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); generate() }}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input label="Start Date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <MultiSelect label="Banks" options={(bankList.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={banks} onChange={setBanks} />
          <MultiSelect label="Ledgers" options={(categories.data || []).map((item) => ({ id: item.id, name: item.name }))} selectedValues={ledgers} onChange={setLedgers} />
        </div>
        <div className="flex flex-wrap justify-end gap-4">
          <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting === 'excel'} disabled={loading || Boolean(exporting)} onClick={() => runExport(setExporting, 'excel', exportExcel)}><FileSpreadsheet size={16} /> Excel</Button>
          <Button type="button" variant="secondary" className="flex items-center gap-2" loading={exporting === 'pdf'} disabled={loading || Boolean(exporting)} onClick={() => runExport(setExporting, 'pdf', exportPdf)}><FileText size={16} /> PDF</Button>
          <Button type="submit" loading={loading} disabled={loading || Boolean(exporting)}>Generate Report</Button>
        </div>
      </form>
      <div className="mt-6">
        <StatusWrapper loading={loading} error={error} onRetry={generate}>
          <Table
            className="max-h-[100vh]"
            page={1}
            limit={10}
            data={rows}
            expandedRowId={expanded}
            onRowClick={openRow}
            columns={[
              { key: 'name', label: 'Ledger', render: (row) => <div className="flex items-center gap-2">{expanded === row.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span>{row.name}</span></div> },
              { key: 'debit', label: 'Debit', render: (row) => formatAmount(row.debit) },
              { key: 'credit', label: 'Credit', render: (row) => formatAmount(row.credit) },
              { key: 'balance', label: 'Balance', render: (row) => <span className={row.balance >= 0 ? 'text-green-600' : 'text-red-600'}>{formatAmount(row.balance)}</span> },
            ]}
            renderExpandedRow={(row) => (
              <div className="bg-card p-4">
                {detailId === row.id || !row.data ? (
                  <div className="py-6 text-center text-gray-500">Loading...</div>
                ) : (
                  <Table
                    page={1}
                    limit={10}
                    data={row.data}
                    columns={[
                      { key: 'date', label: 'Date', render: (entry) => formatDate(entry.date) },
                      { key: 'description', label: 'Description' },
                      { key: 'debit', label: 'Debit', render: (entry) => (entry.debit ? formatAmount(entry.debit) : '-') },
                      { key: 'credit', label: 'Credit', render: (entry) => (entry.credit ? formatAmount(entry.credit) : '-') },
                      { key: 'bank', label: 'Bank', render: (entry) => entry.bank?.name || '-' },
                      { key: 'amount', label: 'Balance', render: (_entry, index) => {
                        const running = row.data.slice(0, index + 1).reduce((sum, item) => sum + Number(item.credit || 0) - Number(item.debit || 0), 0)
                        return <div className={running >= 0 ? 'text-green-600' : 'text-red-600'}>{formatAmount(running)}</div>
                      } },
                    ]}
                  />
                )}
              </div>
            )}
          />
        </StatusWrapper>
      </div>
    </Card>
  )
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
