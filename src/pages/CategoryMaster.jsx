import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { BadgeButton, Button, Card, Input, Modal, Pagination, Spinner, StatusWrapper, Switch, Table } from '../components/ui'
import { categoriesApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatAmount } from '../lib/utils'
import { useResource } from '../lib/useResource'

export default function CategoryMaster() {
  const [name, setName] = useState('')
  const [isLedger, setIsLedger] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [edit, setEdit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [togglingId, setTogglingId] = useState('')
  const list = useResource(() => categoriesApi.listPage({ page, limit, search: query }), [page, limit, query])

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      await categoriesApi.create({ name, is_ledger: isLedger, enable: true })
      toast.success('Category saved')
      setName('')
      setIsLedger(false)
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
      await categoriesApi.update(edit.id, { name: edit.name, is_ledger: edit.is_ledger, enable: edit.enable })
      toast.success('Category updated')
      setEdit(null)
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setUpdating(false)
    }
  }

  const toggle = async (row) => {
    if (togglingId) return
    setTogglingId(row.id)
    try {
      await categoriesApi.update(row.id, { enable: !row.enable })
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setTogglingId('')
    }
  }

  const remove = async (id) => {
    if (deletingId) return
    if (!window.confirm('Are you sure you want to delete this category?')) return
    setDeletingId(id)
    try {
      await categoriesApi.remove(id)
      toast.success('Category deleted')
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="md:py-2" title="Category">
        <form onSubmit={create} className="flex flex-col gap-3">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isLedger} onChange={(event) => setIsLedger(event.target.checked)} />
              <span>Is Ledger</span>
            </label>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Card>
      <Card className="p-2">
        <div className="mb-3 flex justify-end">
          <Input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} onBlur={() => { setQuery(search); setPage(1) }} onKeyDown={(event) => { if (event.key === 'Enter') { setQuery(search); setPage(1) } }} />
        </div>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={list.data?.rows || []}
            emptyText="No categories found"
            columns={[
              { key: 'name', label: 'Category Name' },
              { key: 'is_ledger', label: 'Is Ledger', render: (row) => (row.is_ledger ? 'Yes' : 'No') },
              { key: 'enable', label: 'Status', render: (row) => <Switch checked={row.enable} disabled={Boolean(togglingId)} onChange={() => toggle(row)} /> },
              { key: 'debit', label: 'Total debit', render: (row) => formatAmount(row.debit || 0) },
              { key: 'credit', label: 'Total credit', render: (row) => formatAmount(row.credit || 0) },
              { key: 'balance', label: 'Balance', render: (row) => formatAmount((row.credit || 0) - (row.debit || 0)) },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton type="button" variant="edit" disabled={Boolean(deletingId) || updating} onClick={() => setEdit(row)}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="delete" disabled={Boolean(deletingId) || updating} onClick={() => remove(row.id)}>
                    {deletingId === row.id ? <Spinner /> : <Trash2 size={15} />}
                  </BadgeButton>
                </div>
              ) },
            ]}
          />
          <Pagination totalItems={list.data?.total || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>
      <Modal open={!!edit} onClose={() => !updating && setEdit(null)} title="Edit Category">
        {edit && (
          <div className="grid gap-4">
            <Input label="Name" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} />
            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-zinc-700">
              <span className="text-sm font-medium">Is Ledger</span>
              <input type="checkbox" checked={edit.is_ledger} onChange={(event) => setEdit({ ...edit, is_ledger: event.target.checked })} />
            </label>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-zinc-700">
              <span className="text-sm font-medium">Enabled</span>
              <Switch checked={edit.enable} disabled={updating} onChange={(value) => setEdit({ ...edit, enable: value })} />
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
