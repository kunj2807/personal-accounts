import { Fragment, forwardRef, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Select from 'react-select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'
import { useTheme } from '../context/ThemeContext'

export function Title({ children, className }) {
  return (
    <div className={cn('bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-xl font-semibold tracking-wide text-transparent', className)}>
      {children}
    </div>
  )
}

export function Card({ children, title, titleSlot, className }) {
  return (
    <div className={twMerge('flex flex-col gap-4 rounded-xl bg-card p-3 shadow md:p-6', className)}>
      {(title || titleSlot) && (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b-2 border-gray-200 pb-2 dark:border-zinc-600">
          {title && <Title>{title}</Title>}
          {titleSlot}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

export const Input = forwardRef(function Input({ label, id, type, error, parentClassName, className, ...props }, ref) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className={parentClassName || ''}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium dark:text-white">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && show ? 'text' : type}
          {...props}
          className={twMerge(
            'mb-1 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-base text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-200 disabled:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200 dark:focus:border-purple-400 dark:focus:ring-purple-900 dark:disabled:bg-zinc-700',
            className,
            error && 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500',
          )}
        />
        {isPassword && (
          <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-700" onClick={() => setShow((value) => !value)}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})

const buttonVariants = {
  primary: 'bg-gradient-to-r from-indigo-400 to-indigo-600 text-white dark:from-indigo-600 dark:to-indigo-800',
  secondary: 'border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-zinc-800 dark:text-indigo-200',
  danger: 'bg-red-500 text-white dark:bg-red-700',
}

export function Button({ variant = 'primary', children, className = '', loading = false, disabled, ...props }) {
  return (
    <button
      className={twMerge('cursor-pointer rounded px-5 py-1 text-base font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60', buttonVariants[variant], className)}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}

export function NativeSelect({ options, id, label, error, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium dark:text-white">
          {label}
        </label>
      )}
      <select
        id={id}
        className={twMerge('mb-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-700 outline-none transition focus:ring-2 focus:ring-purple-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200', className, error && 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:border-red-500')}
        {...props}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const badgeVariants = {
  edit: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
  delete: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  outline: 'border-gray-200 bg-transparent text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
}

export function BadgeButton({ variant = 'outline', className, ...props }) {
  return (
    <button
      className={cn('inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-50', badgeVariants[variant], className)}
      {...props}
    />
  )
}

export function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-[22px] w-10 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-indigo-600' : 'bg-gray-300')}
    >
      <span className={cn('inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  )
}

export function Modal({ open, onClose, children, title, className }) {
  const [show, setShow] = useState(open)
  useEffect(() => {
    if (open) {
      setShow(true)
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
    const timeout = setTimeout(() => setShow(false), 200)
    document.body.style.overflow = ''
    return () => clearTimeout(timeout)
  }, [open])
  if (!show) return null
  return (
    <div className={cn('fixed inset-0 z-[9999] flex items-center justify-center overflow-auto bg-black/40 p-3 backdrop-blur-[2px]', open ? 'opacity-100' : 'opacity-0')} onClick={onClose}>
      <div className={twMerge('relative m-auto w-[95%] max-w-3xl rounded-2xl border border-purple-100/50 bg-white p-4 shadow-xl dark:border-zinc-700/50 dark:bg-zinc-900 md:p-6', className)} onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-xl text-gray-500 dark:bg-zinc-800" aria-label="Close">
          ×
        </button>
        {title && (
          <>
            <Title className="mb-4 mt-0 text-center text-2xl">{title}</Title>
            <div className="mb-4 border-b border-gray-200 dark:border-zinc-700" />
          </>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

const moneyColumnKeys = new Set(['amount', 'remaining_amount', 'debit', 'credit', 'balance'])

export function Table({ columns, data, emptyText = 'No data found', onRowClick, renderExpandedRow, expandedRowId, page, limit, className }) {
  return (
    <div className={twMerge('max-h-[80vh] overflow-auto rounded-lg border border-purple-200/50 bg-gradient-to-br from-white to-purple-50/30 dark:border-purple-500/20 dark:from-zinc-900 dark:to-purple-900/10', className)}>
      <table className="w-full divide-y divide-purple-200/50 dark:divide-purple-500/20">
        <thead className="sticky top-0 z-10 bg-gray-100 backdrop-blur-sm dark:bg-zinc-800">
          <tr>
            {page && limit && <th className="px-3 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Sr.No.</th>}
            {columns.map((column, columnIndex) => (
              <th key={column.key || columnIndex} className={cn('px-3 py-4 text-left text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300', moneyColumnKeys.has(column.key) && 'min-w-[8rem] whitespace-nowrap')}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-200/50 dark:divide-purple-500/20">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="py-12 text-center text-purple-500/70">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <Fragment key={row.id || index}>
                <tr onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer' : ''}>
                  {page && limit && <td className="px-3 py-2 text-lg text-gray-700 dark:text-gray-300">{index + 1 + (page - 1) * limit}</td>}
                  {columns.map((column, columnIndex) => (
                    <td key={column.key || columnIndex} className={cn('px-3 py-2 align-middle text-lg text-gray-700 group-hover:bg-purple-50/50 dark:text-gray-300', columnIndex === columns.length - 1 && 'text-center', moneyColumnKeys.has(column.key) && 'min-w-[8rem] whitespace-nowrap', column.className)}>
                      {column.render ? column.render(row, index) : row[column.key]}
                    </td>
                  ))}
                </tr>
                {expandedRowId === row.id && renderExpandedRow && (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-0">
                      {renderExpandedRow(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ totalItems, itemsPerPage, currentPage, onPageChange, onPerPageChange, className }) {
  const totalPages = Math.max(1, Math.ceil((totalItems || 0) / (itemsPerPage || 1)))
  const start = totalItems ? (currentPage - 1) * itemsPerPage + 1 : 0
  const end = Math.min(currentPage * itemsPerPage, totalItems || 0)
  const pages = []
  let last = 0
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
      if (last && page - last > 1) pages.push('…')
      pages.push(page)
      last = page
    }
  }
  return (
    <div className={cn('mt-4', className)}>
      <div className="mb-4 mt-4 flex items-center justify-between gap-2 px-1">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {start}-{end} of {totalItems || 0}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          Results per page
          <NativeSelect
            value={String(itemsPerPage)}
            onChange={(event) => onPerPageChange(event.target.value)}
            options={['10', '25', '50', '100'].map((value) => ({ id: value, name: value }))}
            className="w-20 px-2 py-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className="dark:text-white" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
          <ChevronLeft />
        </button>
        {pages.map((page, index) =>
          page === '…' ? (
            <span key={`gap-${index}`} className="px-2 dark:text-white">…</span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn('mx-1 h-9 min-w-9 rounded-full border border-purple-200 shadow dark:border-zinc-700', page === currentPage ? 'bg-purple-600 text-white' : 'bg-gray-100 text-purple-700 dark:bg-zinc-800 dark:text-purple-200')}
            >
              {page}
            </button>
          ),
        )}
        <button type="button" className="dark:text-white" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}

export function SearchSelect({ label, options = [], value, onChange, placeholder = 'Select', className = '', error }) {
  const { theme } = useTheme()
  const dark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))
  const choices = options.filter((option) => option.id !== '' && option.id != null)
  const selected = choices.find((option) => String(option.id) === String(value ?? '')) || null
  return (
    <div className={className}>
      {label && <label className="mb-1 block text-sm font-medium dark:text-white">{label}</label>}
      <Select
        isSearchable
        options={choices}
        value={selected}
        onChange={(option) => onChange(option?.id || '')}
        placeholder={placeholder}
        noOptionsMessage={() => 'No matches'}
        getOptionLabel={(option) => option.name}
        getOptionValue={(option) => String(option.id)}
        menuPortalTarget={typeof document === 'undefined' ? null : document.body}
        menuPosition="fixed"
        styles={selectStyles(dark, Boolean(error))}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function selectStyles(dark, invalid = false) {
  return {
    control: (base, state) => ({
      ...base,
      background: dark ? '#27272a' : '#fff',
      borderColor: invalid ? '#ef4444' : state.isFocused ? '#c084fc' : dark ? '#3f3f46' : '#d1d5db',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(216, 180, 254, 0.8)' : 'none',
      minHeight: 42,
      borderRadius: 8,
    }),
    menu: (base) => ({ ...base, background: dark ? '#18181b' : '#fff', zIndex: 30 }),
    menuPortal: (base) => ({ ...base, zIndex: 10050 }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? (dark ? '#3f3f46' : '#f3f4f6') : 'transparent',
      color: dark ? '#f4f4f5' : '#111827',
    }),
    input: (base) => ({ ...base, color: dark ? '#fff' : '#111' }),
    singleValue: (base) => ({ ...base, color: dark ? '#fff' : '#111' }),
    placeholder: (base) => ({ ...base, color: '#9ca3af' }),
  }
}

export function MultiSelect({ label, options, selectedValues = [], onChange, placeholder = 'Select' }) {
  const { theme } = useTheme()
  const dark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>}
      <Select
        isMulti
        closeMenuOnSelect={false}
        options={options}
        value={selectedValues}
        onChange={(value) => onChange(value || [])}
        placeholder={placeholder}
        getOptionLabel={(option) => option.name}
        getOptionValue={(option) => option.id}
        styles={{
          control: (base) => ({
            ...base,
            background: dark ? '#27272a' : '#fff',
            borderColor: dark ? '#3f3f46' : '#d1d5db',
            minHeight: 42,
          }),
          menu: (base) => ({ ...base, background: dark ? '#18181b' : '#fff', zIndex: 30 }),
          option: (base, state) => ({
            ...base,
            background: state.isFocused ? (dark ? '#3f3f46' : '#f3f4f6') : 'transparent',
            color: dark ? '#f4f4f5' : '#111827',
          }),
          multiValue: (base) => ({ ...base, background: '#4f46e5' }),
          multiValueLabel: (base) => ({ ...base, color: '#fff' }),
          input: (base) => ({ ...base, color: dark ? '#fff' : '#111' }),
          singleValue: (base) => ({ ...base, color: dark ? '#fff' : '#111' }),
        }}
      />
    </div>
  )
}

export function StatusWrapper({ loading, error, onRetry, children }) {
  return (
    <div className="relative">
      {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-gray-500 dark:bg-zinc-900/80">Loading...</div>}
      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          <div className="font-semibold">Error</div>
          <div className="text-sm">{error}</div>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 rounded bg-red-600 px-3 py-1 text-white">
              Try Again
            </button>
          )}
        </div>
      )}
      <div className={loading ? 'pointer-events-none opacity-50' : ''}>{children}</div>
    </div>
  )
}

export function Separator() {
  return <div className="my-2 h-px w-full bg-gray-200 dark:bg-zinc-700" />
}

export function Spinner({ className }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-300 border-t-purple-700', className)} />
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-200 dark:bg-black">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
