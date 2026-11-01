import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { BadgeButton, Button, Card, Input, Modal, Pagination, Spinner, StatusWrapper, Switch, Table } from '../components/ui'
import { banksApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatAmount } from '../lib/utils'
import { useResource } from '../lib/useResource'

export default function BankMaster() {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [edit, setEdit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [togglingId, setTogglingId] = useState('')
  const list = useResource(() => banksApi.listPage({ page, limit, search: query }), [page, limit, query])

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      await banksApi.create({ name, enable: true })
      toast.success('Bank saved')
      setName('')
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    if (updating) return
    if (!edit.name?.trim()) return toast.error('Name is required')
    setUpdating(true)
    try {
      await banksApi.update(edit.id, { name: edit.name, enable: edit.enable })
      toast.success('Bank updated')
      setEdit(null)
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setUpdating(false)
    }
  }

  const toggle = async (row) => {
    if (togglingId || row.is_cash) return
    setTogglingId(row.id)
    try {
      await banksApi.update(row.id, { enable: !row.enable })
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setTogglingId('')
    }
  }

  const remove = async (row) => {
    if (deletingId) return
    if (row.is_cash) return toast.error('The Cash account stays in the books.')
    if (!window.confirm('Are you sure you want to delete this bank?')) return
    setDeletingId(row.id)
    try {
      await banksApi.remove(row.id)
      toast.success('Bank deleted')
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Bank">
        <form onSubmit={create} className="flex items-center gap-2">
          <Input parentClassName="flex-grow" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" loading={saving}>Save</Button>
        </form>
      </Card>
      <Card>
        <div className="mb-3 flex justify-end">
          <Input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setQuery(search); setPage(1) } }} />
        </div>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={list.data?.rows || []}
            emptyText="No banks found"
            columns={[
              { key: 'name', label: 'Bank Name' },
              { key: 'enable', label: 'Status', render: (row) => <Switch checked={row.enable} disabled={row.is_cash || Boolean(togglingId)} onChange={() => toggle(row)} /> },
              { key: 'balance', label: 'Balance', render: (row) => formatAmount((row.credit || 0) - (row.debit || 0)) },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton type="button" variant="edit" disabled={Boolean(deletingId) || updating} onClick={() => setEdit(row)}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="delete" disabled={Boolean(deletingId) || updating || row.is_cash} onClick={() => remove(row)}>
                    {deletingId === row.id ? <Spinner /> : <Trash2 size={15} />}
                  </BadgeButton>
                </div>
              ) },
            ]}
          />
          <Pagination totalItems={list.data?.total || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>
      <Modal open={!!edit} onClose={() => !updating && setEdit(null)} title="Edit Bank">
        {edit && (
          <div className="grid gap-4">
            <Input label="Name" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} disabled={edit.is_cash} />
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-zinc-700">
              <span className="text-sm font-medium">Enabled</span>
              <Switch checked={edit.enable} disabled={edit.is_cash || updating} onChange={(value) => setEdit({ ...edit, enable: value })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-zinc-700">
              <Button type="button" variant="secondary" disabled={updating} onClick={() => setEdit(null)}>Cancel</Button>
              <Button type="button" loading={updating} disabled={updating} onClick={save}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
