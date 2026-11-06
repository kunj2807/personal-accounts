import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { BadgeButton, Button, Card, Input, Modal, MultiSelect, Pagination, SearchSelect, Spinner, StatusWrapper, Switch, Table } from '../components/ui'
import { categoriesApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { formatAmount } from '../lib/utils'
import { useResource } from '../lib/useResource'

export default function CategoryMaster() {
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
  const [sources, setSources] = useState([])
  const [targetId, setTargetId] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [merging, setMerging] = useState(false)
  const list = useResource(() => categoriesApi.listPage({ page, limit, search: query }), [page, limit, query])
  const allCategories = useResource(() => categoriesApi.list({ enabledOnly: false }), [])
  const categoryOptions = (allCategories.data || []).map((item) => ({ id: item.id, name: item.enable ? item.name : `${item.name} (disabled)` }))
  const sourceIds = sources.map((item) => item.id)
  const target = categoryOptions.find((item) => item.id === targetId)

  const create = async (event) => {
    event.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      await categoriesApi.create({ name, enable: true })
      toast.success('Category saved')
      setName('')
      list.reload()
      allCategories.reload()
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
      await categoriesApi.update(edit.id, { name: edit.name, enable: edit.enable })
      toast.success('Category updated')
      setEdit(null)
      list.reload()
      allCategories.reload()
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
      allCategories.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setTogglingId('')
    }
  }

  const askMerge = () => {
    if (merging) return
    if (!sources.length) return toast.error('Select at least one category to merge')
    if (!targetId) return toast.error('Select the category to keep')
    if (sourceIds.includes(targetId)) return toast.error('The category you keep cannot also be merged away')
    setConfirmOpen(true)
  }

  const merge = async () => {
    if (merging) return
    setMerging(true)
    try {
      await categoriesApi.merge(targetId, sourceIds)
      toast.success('Categories merged')
      setSources([])
      setTargetId('')
      setConfirmOpen(false)
      list.reload()
      allCategories.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setMerging(false)
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
      allCategories.reload()
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
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Card>
      <Card title="Merge categories">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MultiSelect
            label="Categories to merge"
            placeholder="Select categories"
            options={categoryOptions.filter((item) => item.id !== targetId)}
            selectedValues={sources}
            onChange={(value) => {
              setSources(value)
              if (value.some((item) => item.id === targetId)) setTargetId('')
            }}
          />
          <SearchSelect
            label="Keep as"
            placeholder="Select category"
            options={categoryOptions.filter((item) => !sourceIds.includes(item.id))}
            value={targetId}
            onChange={setTargetId}
          />
        </div>
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Income, expense, lending, and statement records move into the category you keep. The other categories are deleted.</p>
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="danger" disabled={merging || allCategories.loading} onClick={askMerge}>Merge</Button>
        </div>
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
      <Modal open={confirmOpen} onClose={() => !merging && setConfirmOpen(false)} title="Merge categories">
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            All income, expense, lending, and statement records from <span className="font-semibold">{sources.map((item) => item.name).join(', ')}</span> will move into <span className="font-semibold">{target?.name}</span>.
          </p>
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            Those categories will be deleted. All of that data will be merged, and you cannot undo this.
          </p>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end dark:border-zinc-700">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={merging} onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button type="button" variant="danger" className="w-full sm:w-auto" loading={merging} disabled={merging} onClick={merge}>Merge</Button>
          </div>
        </div>
      </Modal>
      <Modal open={!!edit} onClose={() => !updating && setEdit(null)} title="Edit Category">
        {edit && (
          <div className="grid gap-4">
            <Input label="Name" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} />
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
