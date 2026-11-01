import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { BadgeButton, Button, Card, Input, NativeSelect, Pagination, Spinner, StatusWrapper, Switch, Table } from '../components/ui'
import { formsApi } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { slugify } from '../lib/utils'
import { useResource } from '../lib/useResource'

const blankField = () => ({ name: '', type: 'text', total: false, options: [], key: '' })

export default function CustomForms() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [sidebar, setSidebar] = useState(false)
  const [fields, setFields] = useState([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const list = useResource(() => formsApi.list(), [])
  const start = (page - 1) * limit
  const visible = (list.data || []).slice(start, start + limit)

  const updateField = (index, patch) => {
    setFields(fields.map((field, fieldIndex) => {
      if (fieldIndex !== index) return field
      const next = { ...field, ...patch }
      if (patch.name !== undefined) next.key = slugify(patch.name)
      return next
    }))
  }

  const create = async (event) => {
    event.preventDefault()
    if (!title.trim()) return toast.error('Form name is required')
    if (!fields.length) return toast.error('Must add one field')
    setSaving(true)
    try {
      await formsApi.create({ title, sidebar, fields })
      toast.success('Form created')
      setTitle('')
      setSidebar(false)
      setFields([])
      window.dispatchEvent(new Event('forms-changed'))
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (deletingId) return
    if (!window.confirm('Delete this form and its entries?')) return
    setDeletingId(id)
    try {
      await formsApi.remove(id)
      toast.success('Form deleted')
      window.dispatchEvent(new Event('forms-changed'))
      list.reload()
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Card title="Custom Form">
        <form className="space-y-6" onSubmit={create}>
          <div>
            <label className="mb-1 block text-sm font-medium">Form Name</label>
            <Input value={title} required placeholder="Enter form name" onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={sidebar} onChange={setSidebar} />
            <span className="text-sm font-medium">Add in sidebar</span>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Form Fields</h3>
          </div>
          {fields.map((field, index) => (
            <div key={index} className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-zinc-700">
              <div className="flex items-start justify-between">
                <h4 className="text-sm font-medium">Field {index + 1}</h4>
                <BadgeButton type="button" variant="delete" aria-label="Remove field" onClick={() => setFields(fields.filter((_, fieldIndex) => fieldIndex !== index))}><Trash2 size={16} /></BadgeButton>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input value={field.name} required placeholder="Enter field name" onChange={(event) => updateField(index, { name: event.target.value })} />
                <NativeSelect value={field.type} onChange={(event) => updateField(index, { type: event.target.value })} options={[{ id: 'text', name: 'Text' }, { id: 'number', name: 'Number' }, { id: 'date', name: 'Date' }, { id: 'select', name: 'Select' }]} />
                {field.type === 'number' && (
                  <label className="flex items-center gap-2"><Switch checked={field.total} onChange={(checked) => updateField(index, { total: checked })} /> Need total for this field</label>
                )}
                {field.type === 'select' && (
                  <div className="col-span-2 space-y-2">
                    {(field.options || []).map((option, optionIndex) => (
                      <div key={optionIndex} className="flex gap-2">
                        <Input value={option} placeholder={`Option ${optionIndex + 1}`} onChange={(event) => updateField(index, { options: field.options.map((item, itemIndex) => (itemIndex === optionIndex ? event.target.value : item)) })} />
                        <BadgeButton type="button" variant="delete" aria-label="Remove option" onClick={() => updateField(index, { options: field.options.filter((_, itemIndex) => itemIndex !== optionIndex) })}><Trash2 size={16} /></BadgeButton>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" className="flex items-center gap-2" onClick={() => updateField(index, { options: [...(field.options || []), ''] })}><Plus size={16} /> Add More Option</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" className="flex items-center gap-2" disabled={saving} onClick={() => setFields([...fields, blankField()])}><Plus size={16} /> Add Field</Button>
            <Button type="submit" loading={saving} disabled={saving}>Create Form</Button>
          </div>
        </form>
      </Card>
      <Card>
        <StatusWrapper loading={list.loading} error={list.error} onRetry={list.reload}>
          <Table
            page={page}
            limit={limit}
            data={visible}
            columns={[
              { key: 'title', label: 'Form' },
              { key: 'sidebar', label: 'Sidebar', render: (row) => (row.sidebar ? 'Yes' : 'No') },
              { key: 'fields', label: 'Fields', render: (row) => row.fields?.length || 0 },
              { key: 'actions', label: 'Actions', render: (row) => (
                <div className="flex justify-center gap-2">
                  <BadgeButton type="button" variant="edit" disabled={Boolean(deletingId)} onClick={() => navigate(`/custom-form/${row.id}`)}><Pencil size={15} /></BadgeButton>
                  <BadgeButton type="button" variant="delete" disabled={Boolean(deletingId)} onClick={() => remove(row.id)}>
                    {deletingId === row.id ? <Spinner /> : <Trash2 size={15} />}
                  </BadgeButton>
                </div>
              ) },
            ]}
          />
          <Pagination totalItems={list.data?.length || 0} itemsPerPage={limit} currentPage={page} onPageChange={setPage} onPerPageChange={(value) => { setLimit(Number(value)); setPage(1) }} />
        </StatusWrapper>
      </Card>
    </div>
  )
}
