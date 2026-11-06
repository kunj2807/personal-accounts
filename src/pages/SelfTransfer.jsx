import { useState } from 'react'
import { ArrowRight, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import EntryLines from '../components/EntryLines'
import { BadgeButton, Button, Card, Input, Modal, NativeSelect, Pagination, StatusWrapper, Table } from '../components/ui'
import { banksApi, transfersApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatAmount, formatDate, todayISO } from '../lib/utils'
import { useResource } from '../lib/useResource'

const blank = () => ({ date: todayISO(), from_bank_id: '', to_bank_id: '', amount: '', description: '' })

export default function SelfTransfer() {
  const [rows, setRows] = useState([blank()])
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [edit, setEdit] = useState(null)
  const [saving, setSaving] = useState(false)
  const banks = useResource(() => banksApi.list({ includeCash: false }), [])
  const list = useResource(() => transfersApi.listPage({ page, limit }), [page, limit])
  const bankOptions = [{ id: '', name: 'Select Bank' }, ...(banks.data || []).filter((item) => !item.is_cash && !/^cash$/i.test(item.name)).map((item) => ({ id: item.id, name: item.name }))]

  const invalid = (row) => !row.date || !row.from_bank_id || !row.to_bank_id || Number(row.amount) <= 0 || row.from_bank_id === row.to_bank_id

  const submit = async () => {
    if (rows.some(invalid)) {
      toast.error(rows.some((row) => row.from_bank_id && row.from_bank_id === row.to_bank_id) ? 'From bank and to bank must be different.' : 'Date, both banks, and an amount are required.')
      return
    }
    setSubmitting(true)
    try {
      await transfersApi.createMany(rows)
      toast.success('Transfer saved')
      setRows([blank()])
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSubmitting(false)
    }
  }

  const save = async () => {
    if (invalid(edit)) {
      toast.error(edit.from_bank_id === edit.to_bank_id ? 'From bank and to bank must be different.' : 'Date, both banks, and an amount are required.')
      return
    }
    setSaving(true)
    try {
      await transfersApi.update(edit.id, edit)
      toast.success('Transfer updated')
      setEdit(null)
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this transfer?')) return
    try {
      await transfersApi.remove(id)
      toast.success('Transfer deleted')
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Card title="Self Transfer">
        <EntryLines
          rows={rows}
          onChange={setRows}
          onSubmit={submit}
          submitting={submitting}
          columns={[
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'from_bank_id', label: 'From Bank', type: 'select', options: bankOptions },
            { key: 'to_bank_id', label: 'To Bank', type: 'select', options: bankOptions },
            { key: 'amount', label: 'Amount', type: 'number' },
            { key: 'description', label: 'Description', placeholder: 'Self transfer' },
          ]}
        />
      </Card>
      <Card>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={list.data?.rows || []}
            emptyText="No transfers found"
            columns={[
              { key: 'date', label: 'Date', render: (row) => formatDate(row.date) },
              { key: 'from_bank', label: 'From Bank', render: (row) => row.from_bank?.name || '-' },
              { key: 'to_bank', label: 'To Bank', render: (row) => row.to_bank?.name || '-' },
              { key: 'amount', label: 'Amount', render: (row) => formatAmount(row.amount) },
              { key: 'description', label: 'Description', render: (row) => row.description || '-' },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton variant="edit" onClick={() => setEdit({ ...row, date: String(row.date).slice(0, 10) })}><Pencil size={15} /></BadgeButton>
                  <BadgeButton variant="delete" onClick={() => remove(row.id)}><Trash2 size={15} /></BadgeButton>
                </div>
              ) },
            ]}
          />
          <Pagination totalItems={list.data?.total || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>
      <Modal open={!!edit} onClose={() => !saving && setEdit(null)} title="Edit transfer" className="max-w-3xl">
        {edit && (
          <div className="space-y-4 p-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Date" type="date" value={edit.date} onChange={(event) => setEdit({ ...edit, date: event.target.value })} />
              <Input label="Amount" type="number" min="0" step="0.01" value={edit.amount} onChange={(event) => setEdit({ ...edit, amount: event.target.value })} />
            </div>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
              <NativeSelect label="From Bank" value={edit.from_bank_id || ''} onChange={(event) => setEdit({ ...edit, from_bank_id: event.target.value })} options={bankOptions} />
              <div className="flex items-center justify-center text-indigo-500 mb-3 dark:text-indigo-300" aria-hidden="true">
                <ArrowRight size={18} className="rotate-90 sm:rotate-0" />
              </div>
              <NativeSelect label="To Bank" value={edit.to_bank_id || ''} onChange={(event) => setEdit({ ...edit, to_bank_id: event.target.value })} options={bankOptions} />
            </div>
            {edit.from_bank_id && edit.from_bank_id === edit.to_bank_id && (
              <p className="text-xs text-red-500">From bank and to bank must be different.</p>
            )}
            <Input label="Description" value={edit.description || ''} onChange={(event) => setEdit({ ...edit, description: event.target.value })} />
            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end dark:border-zinc-700">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={saving} onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="button" className="w-full sm:w-auto" loading={saving} disabled={saving} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
