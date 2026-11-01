import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'react-toastify'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Card, Input, MultiSelect, StatusWrapper, Table } from '../components/ui'
import { banksApi, categoriesApi, reportsApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { askFilename, downloadWorkbook, formatAmount, formatDate, monthStartISO, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'

export default function LedgerStatement() {
  const [startDate, setStartDate] = useState(monthStartISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [ledgers, setLedgers] = useState([])
  const [banks, setBanks] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const categories = useResource(() => categoriesApi.list({ enabledOnly: false }), [])
  const bankList = useResource(() => banksApi.list(), [])

  const generate = async (payload = { startDate, endDate, ledgers: ledgers.map((item) => item.id), banks: banks.map((item) => item.id) }) => {
    setLoading(true)
    setError('')
    try {
      const result = await reportsApi.statement(payload)
      let balance = Number(result.opening) || 0
      let totalDebit = balance < 0 ? -balance : 0
      let totalCredit = balance > 0 ? balance : 0
      const body = (result.data || []).map((item) => {
        balance = balance + Number(item.credit || 0) - Number(item.debit || 0)
        totalCredit += Number(item.credit || 0)
        totalDebit += Number(item.debit || 0)
        return { ...item, balance }
      })
      setRows([
        { id: 'opening', description: 'Opening Balance', debit: Number(result.opening) < 0 ? -Number(result.opening) : 0, credit: Number(result.opening) > 0 ? Number(result.opening) : 0, balance: Number(result.opening) || 0 },
        ...body,
        { id: 'total', description: 'Total', debit: totalDebit, credit: totalCredit, balance },
      ])
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

  const exportPdf = () => {
    const name = askFilename('ledger-statement.pdf')
    if (!name) return
    const doc = new jsPDF()
    doc.text('Ledger Statement', 14, 15)
    doc.setFontSize(10)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Ledger', 'Bank', 'Description', 'Debit', 'Credit', 'Balance']],
      body: rows.map((row) => [row.date ? formatDate(row.date) : '', row.category?.name || '', row.bank?.name || '', row.description || '', row.debit || '-', row.credit || '-', row.balance || '-']),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    })
    doc.save(name.endsWith('.pdf') ? name : `${name}.pdf`)
  }

  const exportExcel = () => {
    const name = askFilename('ledger-statement.xlsx')
    if (!name) return
    return downloadWorkbook(name, [['Ledger Statement'], [`Period: ${startDate} to ${endDate}`], [], ['Date', 'Ledger', 'Bank', 'Description', 'Debit', 'Credit', 'Balance'], ...rows.map((row) => [row.date ? formatDate(row.date) : '', row.category?.name || '', row.bank?.name || '', row.description || '', row.debit || '-', row.credit || '-', row.balance || '-'])], 'Ledger Statement')
  }

  return (
    <Card title="Ledger Statement">
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
            page={1}
            limit={10}
            className="max-h-[100vh]"
            data={rows}
            columns={[
              { key: 'date', label: 'Date', render: (row) => (row.date ? formatDate(row.date) : '-') },
              { key: 'ledger', label: 'Ledger', render: (row) => row.category?.name || '' },
              { key: 'bank', label: 'Bank', render: (row) => row.bank?.name || '-' },
              { key: 'description', label: 'Description', render: (row) => <span className={row.description === 'Opening Balance' || row.description === 'Total' ? 'font-bold' : ''}>{row.description}</span> },
              { key: 'debit', label: 'Debit', render: (row) => <span className={row.description === 'Total' ? 'font-bold' : ''}>{row.debit ? formatAmount(row.debit) : '-'}</span> },
              { key: 'credit', label: 'Credit', render: (row) => <span className={row.description === 'Total' ? 'font-bold' : ''}>{row.credit ? formatAmount(row.credit) : '-'}</span> },
              { key: 'balance', label: 'Balance', render: (row) => <div className={`${row.balance >= 0 ? 'text-green-600' : 'text-red-600'} ${row.description === 'Opening Balance' || row.description === 'Total' ? 'font-bold' : ''}`}>{formatAmount(row.balance)}</div> },
            ]}
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
