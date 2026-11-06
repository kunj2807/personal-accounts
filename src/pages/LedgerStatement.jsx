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
      const opening = roundMoney(result.opening)
      let balance = opening
      let totalDebit = opening < 0 ? roundMoney(-opening) : 0
      let totalCredit = opening > 0 ? opening : 0
      const body = (result.data || []).map((item) => {
        const debit = roundMoney(item.debit)
        const credit = roundMoney(item.credit)
        balance = roundMoney(balance + credit - debit)
        totalCredit = roundMoney(totalCredit + credit)
        totalDebit = roundMoney(totalDebit + debit)
        return { ...item, debit, credit, balance }
      })
      setRows([
        { id: 'opening', description: 'Opening Balance', debit: opening < 0 ? roundMoney(-opening) : 0, credit: opening > 0 ? opening : 0, balance: opening },
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
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59)
    doc.text('Ledger Statement', 14, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    const details = [`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`]
    if (banks.length) details.push(`Banks: ${banks.map((item) => item.name).join(', ')}`)
    if (ledgers.length) details.push(`Ledgers: ${ledgers.map((item) => item.name).join(', ')}`)
    const detailLines = doc.splitTextToSize(details.join('    '), pageWidth - 28)
    doc.text(detailLines, 14, 21)

    autoTable(doc, {
      startY: 21 + detailLines.length * 5 + 3,
      margin: { top: 14, right: 14, bottom: 16, left: 14 },
      head: [['Date', 'Ledger', 'Bank', 'Description', 'Debit', 'Credit', 'Balance']],
      body: rows.map((row) => {
        const summary = row.id === 'opening' || row.id === 'total'
        return [
          row.date ? formatDate(row.date) : '',
          row.category?.name || '',
          row.bank?.name || (summary ? '' : '-'),
          row.description || '',
          pdfMoney(row.debit, true),
          pdfMoney(row.credit, true),
          pdfMoney(row.balance),
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.2, overflow: 'linebreak', valign: 'middle', textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.1 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 40 },
        2: { cellWidth: 32 },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 34, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index >= 4) data.cell.styles.halign = 'right'
        if (data.section !== 'body') return
        const row = rows[data.row.index]
        if (!row) return
        if (row.id === 'opening' || row.id === 'total') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [226, 232, 240]
        }
        if (data.column.index === 6 && roundMoney(row.balance) < 0) data.cell.styles.textColor = [185, 28, 28]
      },
    })

    const totalPages = doc.getNumberOfPages()
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text('Ledger Statement', 14, pageHeight - 8)
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
    }
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

function roundMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round((number + Number.EPSILON) * 100) / 100
}

function pdfMoney(value, dashZero = false) {
  const number = roundMoney(value)
  if (dashZero && number === 0) return '-'
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)
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
