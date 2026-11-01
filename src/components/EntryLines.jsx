import { Plus, Trash2 } from 'lucide-react'
import { BadgeButton, Button, Input, NativeSelect } from './ui'

export default function EntryLines({ columns, rows, onChange, onSubmit, submitting }) {
  const update = (index, field, value) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="overflow-x-auto rounded-xl border border-purple-100 dark:border-zinc-700">
        <table className="min-w-full divide-y divide-purple-100 dark:divide-zinc-700">
          <thead className="bg-gray-100 dark:bg-zinc-800">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  {column.label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-100 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3">
                    {column.type === 'select' ? (
                      <NativeSelect className="min-w-[140px]" value={row[column.key] || ''} onChange={(event) => update(index, column.key, event.target.value)} options={column.options} />
                    ) : (
                      <Input className="min-w-[120px]" type={column.type || 'text'} value={row[column.key] ?? ''} min={column.type === 'number' ? 0 : undefined} placeholder={column.placeholder} onChange={(event) => update(index, column.key, column.type === 'number' ? event.target.value : event.target.value)} />
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  {rows.length > 1 && (
                    <BadgeButton type="button" variant="delete" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
                      <Trash2 size={16} />
                    </BadgeButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" className="flex items-center gap-2" onClick={() => onChange([...rows, emptyFrom(rows[0])])}>
          <Plus size={16} /> Add Entry
        </Button>
        <Button type="submit" loading={submitting}>Submit</Button>
      </div>
    </form>
  )
}

function emptyFrom(row) {
  return Object.fromEntries(Object.keys(row).map((key) => [key, key === 'date' ? row.date : key === 'type' ? row.type : key === 'amount' ? '' : '']))
}
