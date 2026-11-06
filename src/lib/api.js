import { requireAuth, supabase } from './supabase'

const entrySelect =
  'id, date, type, amount, description, bank_id, category_id, parent_id, created_at, bank:banks!bank_id(id, name), category:categories!category_id(id, name)'
const entryChildSelect =
  'id, date, type, amount, description, bank_id, category_id, parent_id, bank:banks!bank_id(id, name), category:categories!category_id(id, name)'
const lendingSelect =
  'id, date, due_date, type, amount, remaining_amount, description, bank_id, category_id, created_at, bank:banks!bank_id(id, name), category:categories!category_id(id, name), lending_items(id, date, type, amount, description, bank_id, bank:banks!bank_id(id, name))'
const depositSelect = 'id, date, type, amount, description, bank_id, created_at, bank:banks!bank_id(id, name)'
const statementSelect =
  'id, date, description, debit, credit, amount, bank_id, category_id, ref_id, item_ref_id, entry_kind, created_at, bank:banks!bank_id(id, name), category:categories!category_id(id, name)'

function isAuthFailure(error) {
  const message = `${error?.message || ''} ${error?.code || ''}`
  return /jwt|PGRST301|invalid claim|not authenticated/i.test(message)
}

async function assertResult(result) {
  if (result?.error) {
    if (isAuthFailure(result.error)) {
      await supabase.auth.signOut({ scope: 'local' })
      const err = new Error('Your session has expired. Please sign in again.')
      err.code = 'UNAUTHENTICATED'
      throw err
    }
    throw result.error
  }
  return result
}

async function withAuth(run) {
  await requireAuth()
  return assertResult(await run())
}

async function currentUserId() {
  const session = await requireAuth()
  return session.user.id
}

function num(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function pageRange(page, limit) {
  const size = Math.max(1, Number(limit) || 25)
  const current = Math.max(1, Number(page) || 1)
  const from = (current - 1) * size
  return { from, to: from + size - 1 }
}

function cleanIds(values) {
  return (values || []).map((value) => String(value || '').trim()).filter(Boolean)
}

function applyCommonFilters(request, filters = {}, columns = {}) {
  const dateColumn = columns.date || 'date'
  const typeColumn = columns.type || 'type'
  const textColumn = columns.text || 'description'
  const amountColumn = columns.amount || 'amount'
  const bankColumn = columns.bank || 'bank_id'
  const categoryColumn = columns.category || 'category_id'

  if (filters.dateFrom) request = request.gte(dateColumn, filters.dateFrom)
  if (filters.dateTo) request = request.lte(dateColumn, filters.dateTo)
  if (filters.type && !['all', 'All', 'Both'].includes(filters.type)) request = request.eq(typeColumn, filters.type)
  if (filters.description) request = request.ilike(textColumn, `%${filters.description}%`)
  if (filters.minAmount) request = request.gte(amountColumn, num(filters.minAmount))
  if (filters.maxAmount) request = request.lte(amountColumn, num(filters.maxAmount))
  const banks = cleanIds(filters.banks)
  const categories = cleanIds(filters.categories || filters.ledgers)
  if (banks.length) request = request.in(bankColumn, banks)
  if (categories.length) request = request.in(categoryColumn, categories)
  return request
}

function money(type, amount) {
  const value = num(amount)
  const negative = type === 'Debit' || type === 'Withdrawal'
  return {
    debit: negative ? value : 0,
    credit: negative ? 0 : value,
    amount: negative ? -value : value,
  }
}

function entryKind(type, domain) {
  if (domain === 'entry') return type === 'Debit' ? 'Expense' : 'Income'
  if (domain === 'lending') return type === 'Debit' ? 'Lending' : 'Borrowing'
  return type
}

function statementFrom({ userId, date, description, type, domain, amount, bankId, categoryId, refId, itemRefId }) {
  return {
    user_id: userId,
    date,
    description: description || '',
    ...money(type, amount),
    bank_id: bankId || null,
    category_id: categoryId || null,
    ref_id: refId || null,
    item_ref_id: itemRefId || null,
    entry_kind: entryKind(type, domain),
  }
}

async function fetchAll(build) {
  const size = 1000
  let from = 0
  const rows = []
  while (true) {
    const result = await withAuth(() => build().range(from, from + size - 1))
    const chunk = result.data ?? []
    rows.push(...chunk)
    if (chunk.length < size) break
    from += size
  }
  return rows
}

export const banksApi = {
  async list({ includeCash = true } = {}) {
    const result = await withAuth(() => {
      let request = supabase.from('banks').select('id, name, enable, is_cash, created_at').order('name')
      if (!includeCash) request = request.eq('is_cash', false)
      return request.eq('enable', true)
    })
    return result.data ?? []
  },

  async listPage({ page = 1, limit = 25, search = '' } = {}) {
    const { from, to } = pageRange(page, limit)
    const result = await withAuth(() => {
      let request = supabase.from('banks').select('id, name, enable, is_cash, created_at', { count: 'exact' })
      if (search) request = request.ilike('name', `%${search}%`)
      return request.order('created_at', { ascending: false }).range(from, to)
    })
    const rows = result.data ?? []
    const totals = await sumBy(rows.map((row) => row.id), 'bank_id')
    return {
      rows: rows.map((row) => ({ ...row, ...totals.get(row.id) })),
      total: result.count ?? 0,
    }
  },

  async create(payload) {
    const user_id = await currentUserId()
    const result = await withAuth(() =>
      supabase
        .from('banks')
        .insert({ user_id, name: payload.name.trim(), enable: payload.enable ?? true, is_cash: false })
        .select('id, name, enable, is_cash')
        .single(),
    )
    return result.data
  },

  async update(id, payload) {
    const result = await withAuth(() =>
      supabase.from('banks').update(payload).eq('id', id).select('id, name, enable, is_cash').single(),
    )
    return result.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('banks').delete().eq('id', id))
  },

  async ensureCash() {
    const user_id = await currentUserId()
    const existing = await withAuth(() =>
      supabase.from('banks').select('id').eq('user_id', user_id).eq('is_cash', true).maybeSingle(),
    )
    if (existing.data) return existing.data
    const created = await withAuth(() =>
      supabase.from('banks').insert({ user_id, name: 'Cash', enable: true, is_cash: true }).select('id').single(),
    )
    return created.data
  },
}

export const categoriesApi = {
  async list({ enabledOnly = true } = {}) {
    const result = await withAuth(() => {
      let request = supabase.from('categories').select('id, name, enable').order('name')
      if (enabledOnly) request = request.eq('enable', true)
      return request
    })
    return result.data ?? []
  },

  async listPage({ page = 1, limit = 25, search = '' } = {}) {
    const { from, to } = pageRange(page, limit)
    const result = await withAuth(() => {
      let request = supabase
        .from('categories')
        .select('id, name, enable, created_at', { count: 'exact' })
      if (search) request = request.ilike('name', `%${search}%`)
      return request.order('created_at', { ascending: false }).range(from, to)
    })
    const rows = result.data ?? []
    const totals = await sumBy(rows.map((row) => row.id), 'category_id')
    return {
      rows: rows.map((row) => ({ ...row, ...totals.get(row.id) })),
      total: result.count ?? 0,
    }
  },

  async create(payload) {
    const user_id = await currentUserId()
    const result = await withAuth(() =>
      supabase
        .from('categories')
        .insert({
          user_id,
          name: payload.name.trim(),
          enable: payload.enable ?? true,
        })
        .select('id, name, enable')
        .single(),
    )
    return result.data
  },

  async update(id, payload) {
    const result = await withAuth(() =>
      supabase.from('categories').update(payload).eq('id', id).select('id, name, enable').single(),
    )
    return result.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('categories').delete().eq('id', id))
  },

  async merge(targetId, sourceIds) {
    await withAuth(() => supabase.rpc('merge_categories', { p_target: targetId, p_sources: sourceIds }))
  },
}

async function sumBy(ids, column) {
  const map = new Map(ids.map((id) => [id, { debit: 0, credit: 0, balance: 0 }]))
  if (!ids.length) return map
  const rows = await fetchAll(() => supabase.from('statements').select(`${column}, debit, credit`).in(column, ids))
  for (const row of rows) {
    const bucket = map.get(row[column])
    if (!bucket) continue
    bucket.debit += num(row.debit)
    bucket.credit += num(row.credit)
    bucket.balance = bucket.credit - bucket.debit
  }
  return map
}

function applyEntrySearch(request, filters = {}) {
  const term = String(filters.search || '').trim().replace(/[%_,()]/g, '')
  if (term) {
    const numeric = /^-?\d+(\.\d+)?$/.test(term)
    request = numeric ? request.or(`description.ilike.%${term}%,amount.eq.${term}`) : request.ilike('description', `%${term}%`)
  }
  if (filters.excludeId) request = request.neq('id', filters.excludeId)
  return request
}

async function attachRelations(rows) {
  if (!rows.length) return rows
  const parentIds = [...new Set(rows.map((row) => row.parent_id).filter(Boolean))]
  const [childrenResult, parentsResult] = await Promise.all([
    withAuth(() => supabase.from('entries').select(entryChildSelect).in('parent_id', rows.map((row) => row.id)).order('date', { ascending: false })),
    parentIds.length ? withAuth(() => supabase.from('entries').select(entryChildSelect).in('id', parentIds)) : Promise.resolve({ data: [] }),
  ])
  const parents = new Map((parentsResult.data ?? []).map((row) => [row.id, row]))
  const grouped = new Map()
  for (const child of childrenResult.data ?? []) {
    const bucket = grouped.get(child.parent_id) || []
    bucket.push(child)
    grouped.set(child.parent_id, bucket)
  }
  return rows.map((row) => ({
    ...row,
    parent: parents.get(row.parent_id) || null,
    children: grouped.get(row.id) || [],
  }))
}

export const entriesApi = {
  async listPage(filters = {}) {
    const { from, to } = pageRange(filters.page, filters.limit)
    const result = await withAuth(() => {
      let request = supabase.from('entries').select(entrySelect, { count: 'exact' })
      request = applyCommonFilters(request, filters)
      request = applyEntrySearch(request, filters)
      return request.order('date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
    })
    return { rows: await attachRelations(result.data ?? []), total: result.count ?? 0 }
  },

  async recent(limit = 40) {
    const result = await withAuth(() =>
      supabase.from('entries').select(entrySelect).order('date', { ascending: false }).limit(limit),
    )
    return result.data ?? []
  },

  async createMany(rows, parentId) {
    const user_id = await currentUserId()
    const payload = rows.map((row) => ({
      user_id,
      date: row.date,
      type: row.type,
      amount: num(row.amount),
      description: row.description || '',
      bank_id: row.bank_id || null,
      category_id: row.category_id || null,
      parent_id: parentId || null,
    }))
    const created = await withAuth(() => supabase.from('entries').insert(payload).select('id, date, type, amount, description, bank_id, category_id'))
    const statements = (created.data ?? []).map((row) =>
      statementFrom({
        userId: user_id,
        date: row.date,
        description: row.description,
        type: row.type,
        domain: 'entry',
        amount: row.amount,
        bankId: row.bank_id,
        categoryId: row.category_id,
        refId: row.id,
      }),
    )
    if (statements.length) await withAuth(() => supabase.from('statements').insert(statements))
    return created.data ?? []
  },

  async update(id, row) {
    const user_id = await currentUserId()
    const payload = {
      date: row.date,
      type: row.type,
      amount: num(row.amount),
      description: row.description || '',
      bank_id: row.bank_id || null,
      category_id: row.category_id || null,
      parent_id: row.parent_id && row.parent_id !== id ? row.parent_id : null,
    }
    const updated = await withAuth(() => supabase.from('entries').update(payload).eq('id', id).select('id, date, type, amount, description, bank_id, category_id').single())
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id).is('item_ref_id', null))
    await withAuth(() =>
      supabase.from('statements').insert(
        statementFrom({
          userId: user_id,
          date: updated.data.date,
          description: updated.data.description,
          type: updated.data.type,
          domain: 'entry',
          amount: updated.data.amount,
          bankId: updated.data.bank_id,
          categoryId: updated.data.category_id,
          refId: updated.data.id,
        }),
      ),
    )
    return updated.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id))
    await withAuth(() => supabase.from('entries').delete().eq('id', id))
  },
}

function lendingRemaining(amount, type, items) {
  const extra = (items || []).reduce((sum, item) => {
    const value = num(item.amount)
    return sum + (item.type === type ? value : -value)
  }, 0)
  return num(amount) + extra
}

function withLendingRemaining(rows) {
  return (rows || []).map((row) => ({
    ...row,
    remaining_amount: lendingRemaining(row.amount, row.type, row.lending_items),
  }))
}

async function replaceLendingStatements(userId, parent, items) {
  await withAuth(() => supabase.from('statements').delete().eq('ref_id', parent.id))
  const rows = [
    statementFrom({
      userId,
      date: parent.date,
      description: parent.description,
      type: parent.type,
      domain: 'lending',
      amount: parent.amount,
      bankId: parent.bank_id,
      categoryId: parent.category_id,
      refId: parent.id,
    }),
    ...(items || []).map((item) =>
      statementFrom({
        userId,
        date: item.date,
        description: `${item.description || ''}${parent.description ? ` (${parent.description})` : ''}`,
        type: item.type,
        domain: 'lending',
        amount: item.amount,
        bankId: item.bank_id,
        categoryId: parent.category_id,
        refId: parent.id,
        itemRefId: item.id,
      }),
    ),
  ]
  await withAuth(() => supabase.from('statements').insert(rows))
}

export const lendingApi = {
  async listPage(filters = {}) {
    const { from, to } = pageRange(filters.page, filters.limit)
    const result = await withAuth(() => {
      let request = supabase.from('lending_entries').select(lendingSelect, { count: 'exact' })
      request = applyCommonFilters(request, filters)
      return request.order('date', { ascending: false }).range(from, to)
    })
    return { rows: withLendingRemaining(result.data), total: result.count ?? 0 }
  },

  async listAll() {
    const rows = await fetchAll(() => supabase.from('lending_entries').select(lendingSelect).order('due_date', { ascending: true }))
    return withLendingRemaining(rows)
  },

  async createMany(rows) {
    const user_id = await currentUserId()
    const payload = rows.map((row) => ({
      user_id,
      date: row.date,
      due_date: row.due_date || null,
      type: row.type,
      amount: num(row.amount),
      remaining_amount: num(row.amount),
      description: row.description || '',
      bank_id: row.bank_id || null,
      category_id: row.category_id || null,
    }))
    const created = await withAuth(() =>
      supabase.from('lending_entries').insert(payload).select('id, date, type, amount, description, bank_id, category_id'),
    )
    const statements = (created.data ?? []).map((row) =>
      statementFrom({
        userId: user_id,
        date: row.date,
        description: row.description,
        type: row.type,
        domain: 'lending',
        amount: row.amount,
        bankId: row.bank_id,
        categoryId: row.category_id,
        refId: row.id,
      }),
    )
    if (statements.length) await withAuth(() => supabase.from('statements').insert(statements))
    return created.data ?? []
  },

  async update(id, row, items = []) {
    const user_id = await currentUserId()
    const parent = {
      date: row.date,
      due_date: row.due_date || null,
      type: row.type,
      amount: num(row.amount),
      description: row.description || '',
      bank_id: row.bank_id || null,
      category_id: row.category_id || null,
      remaining_amount: lendingRemaining(row.amount, row.type, items),
    }
    const updated = await withAuth(() => supabase.from('lending_entries').update(parent).eq('id', id).select('id, date, type, amount, description, bank_id, category_id').single())
    await withAuth(() => supabase.from('lending_items').delete().eq('parent_id', id))
    let savedItems = []
    if (items.length) {
      const inserted = await withAuth(() =>
        supabase
          .from('lending_items')
          .insert(
            items.map((item) => ({
              user_id,
              parent_id: id,
              date: item.date,
              type: item.type,
              amount: num(item.amount),
              description: item.description || '',
              bank_id: item.bank_id || null,
            })),
          )
          .select('id, date, type, amount, description, bank_id'),
      )
      savedItems = inserted.data ?? []
    }
    await replaceLendingStatements(user_id, updated.data, savedItems)
    return updated.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id))
    await withAuth(() => supabase.from('lending_entries').delete().eq('id', id))
  },
}

export const depositsApi = {
  async listPage(filters = {}) {
    const { from, to } = pageRange(filters.page, filters.limit)
    const result = await withAuth(() => {
      let request = supabase.from('deposits').select(depositSelect, { count: 'exact' })
      request = applyCommonFilters(request, filters)
      return request.order('date', { ascending: false }).range(from, to)
    })
    return { rows: result.data ?? [], total: result.count ?? 0 }
  },

  async createMany(rows) {
    const user_id = await currentUserId()
    const cash = await banksApi.ensureCash()
    const payload = rows.map((row) => ({
      user_id,
      date: row.date,
      type: row.type,
      amount: num(row.amount),
      description: row.description || '',
      bank_id: row.bank_id || null,
    }))
    const created = await withAuth(() => supabase.from('deposits').insert(payload).select('id, date, type, amount, description, bank_id'))
    const statements = (created.data ?? []).flatMap((row) => depositStatements(user_id, row, cash.id))
    if (statements.length) await withAuth(() => supabase.from('statements').insert(statements))
    return created.data ?? []
  },

  async update(id, row) {
    const user_id = await currentUserId()
    const cash = await banksApi.ensureCash()
    const payload = {
      date: row.date,
      type: row.type,
      amount: num(row.amount),
      description: row.description || '',
      bank_id: row.bank_id || null,
    }
    const updated = await withAuth(() => supabase.from('deposits').update(payload).eq('id', id).select('id, date, type, amount, description, bank_id').single())
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id))
    await withAuth(() => supabase.from('statements').insert(depositStatements(user_id, updated.data, cash.id)))
    return updated.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id))
    await withAuth(() => supabase.from('deposits').delete().eq('id', id))
  },
}

function depositStatements(userId, row, cashBankId) {
  const value = num(row.amount)
  const description = `${row.description || ''} (${row.type})`.trim()
  const base = {
    user_id: userId,
    date: row.date,
    description,
    category_id: null,
    ref_id: row.id,
    item_ref_id: null,
    entry_kind: row.type,
  }
  if (row.type === 'Withdrawal') {
    return [
      { ...base, bank_id: row.bank_id, debit: value, credit: 0, amount: -value },
      { ...base, bank_id: cashBankId, debit: 0, credit: value, amount: value },
    ]
  }
  return [
    { ...base, bank_id: row.bank_id, debit: 0, credit: value, amount: value },
    { ...base, bank_id: cashBankId, debit: value, credit: 0, amount: -value },
  ]
}

const majorSelect = 'id, date, type, amount, description, bank:banks!bank_id(id, name), category:categories!category_id(id, name)'
const transferSelect =
  'id, date, amount, description, from_bank_id, to_bank_id, created_at, from_bank:banks!from_bank_id(id, name), to_bank:banks!to_bank_id(id, name)'

function transferStatements(userId, row) {
  const value = num(row.amount)
  const description = row.description?.trim() || 'Self transfer'
  const base = {
    user_id: userId,
    date: row.date,
    description,
    category_id: null,
    ref_id: row.id,
    item_ref_id: null,
    entry_kind: 'Transfer',
  }
  return [
    { ...base, bank_id: row.from_bank_id, debit: value, credit: 0, amount: -value },
    { ...base, bank_id: row.to_bank_id, debit: 0, credit: value, amount: value },
  ]
}

export const transfersApi = {
  async listPage({ page = 1, limit = 25 } = {}) {
    const { from, to } = pageRange(page, limit)
    const result = await withAuth(() =>
      supabase.from('transfers').select(transferSelect, { count: 'exact' }).order('date', { ascending: false }).range(from, to),
    )
    return { rows: result.data ?? [], total: result.count ?? 0 }
  },

  async createMany(rows) {
    const user_id = await currentUserId()
    const payload = rows.map((row) => {
      if (row.from_bank_id === row.to_bank_id) {
        const error = new Error('From bank and to bank must be different.')
        error.code = 'SAME_BANK'
        throw error
      }
      return {
        user_id,
        date: row.date,
        amount: num(row.amount),
        description: row.description || '',
        from_bank_id: row.from_bank_id,
        to_bank_id: row.to_bank_id,
      }
    })
    const created = await withAuth(() =>
      supabase.from('transfers').insert(payload).select('id, date, amount, description, from_bank_id, to_bank_id'),
    )
    const statements = (created.data ?? []).flatMap((row) => transferStatements(user_id, row))
    if (statements.length) await withAuth(() => supabase.from('statements').insert(statements))
    return created.data ?? []
  },

  async update(id, row) {
    if (row.from_bank_id === row.to_bank_id) {
      const error = new Error('From bank and to bank must be different.')
      error.code = 'SAME_BANK'
      throw error
    }
    const user_id = await currentUserId()
    const payload = {
      date: row.date,
      amount: num(row.amount),
      description: row.description || '',
      from_bank_id: row.from_bank_id,
      to_bank_id: row.to_bank_id,
    }
    const updated = await withAuth(() =>
      supabase.from('transfers').update(payload).eq('id', id).select('id, date, amount, description, from_bank_id, to_bank_id').single(),
    )
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id).eq('entry_kind', 'Transfer'))
    await withAuth(() => supabase.from('statements').insert(transferStatements(user_id, updated.data)))
    return updated.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('statements').delete().eq('ref_id', id).eq('entry_kind', 'Transfer'))
    await withAuth(() => supabase.from('transfers').delete().eq('id', id))
  },
}

export const dashboardApi = {
  async majorTransactions({ type = 'all', from = null, to = null, limit = 10 } = {}) {
    const result = await withAuth(() => {
      let request = supabase.from('entries').select(majorSelect).order('amount', { ascending: false }).limit(limit)
      if (type && type !== 'all' && type !== 'Total') request = request.eq('type', type)
      if (from) request = request.gte('date', from)
      if (to) request = request.lte('date', to)
      return request
    })
    return result.data ?? []
  },

  async widgets(type = 'Total') {
    const rows = await fetchAll(() => {
      let request = supabase.from('entries').select('date, type, amount')
      if (type && type !== 'Total') request = request.eq('type', type)
      return request
    })
    const now = new Date()
    const today = toISO(now)
    const weekStart = startOfIsoWeek(now)
    const weekEnd = addDays(weekStart, 6)
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
    const yearStart = `${now.getFullYear()}-01-01`
    const yearEnd = `${now.getFullYear()}-12-31`
    const sumRange = (from, to) =>
      rows
        .filter((row) => row.date >= from && row.date <= to)
        .reduce((sum, row) => sum + (row.type === 'Debit' ? -num(row.amount) : num(row.amount)), 0)
    return {
      today: sumRange(today, today),
      week: sumRange(weekStart, weekEnd),
      month: sumRange(monthStart, monthEnd),
      year: sumRange(yearStart, yearEnd),
    }
  },

  async balances() {
    const [banks, categories, statements] = await Promise.all([
      fetchAll(() => supabase.from('banks').select('id, name').eq('enable', true).order('name')),
      fetchAll(() => supabase.from('categories').select('id, name').eq('enable', true).order('name')),
      fetchAll(() => supabase.from('statements').select('bank_id, category_id, amount')),
    ])
    const bankMap = new Map(banks.map((row) => [row.id, { ...row, totalAmount: 0 }]))
    const ledgerMap = new Map(categories.map((row) => [row.id, { ...row, totalAmount: 0 }]))
    for (const row of statements) {
      if (row.bank_id && bankMap.has(row.bank_id)) bankMap.get(row.bank_id).totalAmount += num(row.amount)
      if (row.category_id && ledgerMap.has(row.category_id)) ledgerMap.get(row.category_id).totalAmount += num(row.amount)
    }
    return {
      banks: [...bankMap.values()].filter((row) => row.totalAmount !== 0 || true),
      ledgers: [...ledgerMap.values()],
    }
  },

  async monthly({ year, type = 'Total', categories = [], banks = [] }) {
    const rows = await fetchAll(() => {
      let request = supabase
        .from('entries')
        .select('date, type, amount, category_id, bank_id')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
      if (type && type !== 'Total') request = request.eq('type', type)
      const categoryIds = cleanIds(categories)
      const bankIds = cleanIds(banks)
      if (categoryIds.length) request = request.in('category_id', categoryIds)
      if (bankIds.length) request = request.in('bank_id', bankIds)
      return request
    })
    const months = Array.from({ length: 12 }, () => 0)
    for (const row of rows) {
      const month = Number(String(row.date).slice(5, 7)) - 1
      if (month < 0 || month > 11) continue
      months[month] += row.type === 'Debit' ? -num(row.amount) : num(row.amount)
    }
    return months
  },
}

export const reportsApi = {
  async generalLedger({ startDate, endDate, ledgers = [], banks = [] }) {
    const categories = await categoriesApi.list({ enabledOnly: false })
    const selected = cleanIds(ledgers)
    const visible = selected.length ? categories.filter((row) => selected.includes(row.id)) : categories
    const statements = await fetchAll(() => {
      let request = supabase.from('statements').select(statementSelect).order('date', { ascending: true })
      if (startDate) request = request.gte('date', startDate)
      if (endDate) request = request.lte('date', endDate)
      const bankIds = cleanIds(banks)
      if (bankIds.length) request = request.in('bank_id', bankIds)
      if (selected.length) request = request.in('category_id', selected)
      return request
    })
    return visible.map((category) => ({
      id: category.id,
      name: category.name,
      data: statements.filter((row) => row.category_id === category.id),
    }))
  },

  async statement({ startDate, endDate, ledgers = [], banks = [] }) {
    const bankIds = cleanIds(banks)
    const ledgerIds = cleanIds(ledgers)
    const apply = (request) => {
      if (bankIds.length) request = request.in('bank_id', bankIds)
      if (ledgerIds.length) request = request.in('category_id', ledgerIds)
      return request
    }
    const openingRows = startDate
      ? await fetchAll(() => apply(supabase.from('statements').select('amount').lt('date', startDate)))
      : []
    const rows = await fetchAll(() => {
      let request = apply(supabase.from('statements').select(statementSelect).order('date', { ascending: true }).order('created_at', { ascending: true }))
      if (startDate) request = request.gte('date', startDate)
      if (endDate) request = request.lte('date', endDate)
      return request
    })
    const opening = openingRows.reduce((sum, row) => sum + num(row.amount), 0)
    return { opening, data: rows }
  },
}

export const formsApi = {
  async list() {
    const result = await withAuth(() =>
      supabase.from('custom_forms').select('id, title, sidebar, fields, created_at').order('created_at', { ascending: false }),
    )
    return result.data ?? []
  },

  async sidebar() {
    const result = await withAuth(() =>
      supabase.from('custom_forms').select('id, title').eq('sidebar', true).order('title'),
    )
    return result.data ?? []
  },

  async get(id) {
    const result = await withAuth(() =>
      supabase.from('custom_forms').select('id, title, sidebar, fields').eq('id', id).single(),
    )
    return result.data
  },

  async create(payload) {
    const user_id = await currentUserId()
    const result = await withAuth(() =>
      supabase
        .from('custom_forms')
        .insert({ user_id, title: payload.title.trim(), sidebar: Boolean(payload.sidebar), fields: payload.fields || [] })
        .select('id, title, sidebar, fields')
        .single(),
    )
    return result.data
  },

  async update(id, payload) {
    const result = await withAuth(() =>
      supabase
        .from('custom_forms')
        .update({ title: payload.title.trim(), sidebar: Boolean(payload.sidebar), fields: payload.fields || [] })
        .eq('id', id)
        .select('id, title, sidebar, fields')
        .single(),
    )
    return result.data
  },

  async remove(id) {
    await withAuth(() => supabase.from('custom_forms').delete().eq('id', id))
  },

  async entries(formId, sort = {}) {
    const key = String(sort.key || 'created_at')
    const result = await withAuth(() =>
      supabase.rpc('list_form_entries', {
        p_form_id: formId,
        p_sort: /^[A-Za-z0-9_]+$/.test(key) ? key : 'created_at',
        p_dir: sort.direction === 'asc' ? 'asc' : 'desc',
        p_type: sort.type === 'number' ? 'number' : 'text',
      }),
    )
    return result.data ?? []
  },

  async addEntry(formId, data) {
    const user_id = await currentUserId()
    const result = await withAuth(() =>
      supabase.from('custom_form_entries').insert({ user_id, form_id: formId, data }).select('id, form_id, data, created_at').single(),
    )
    return result.data
  },

  async updateEntry(id, data) {
    const result = await withAuth(() =>
      supabase.from('custom_form_entries').update({ data }).eq('id', id).select('id, form_id, data, created_at').single(),
    )
    return result.data
  },

  async removeEntry(id) {
    await withAuth(() => supabase.from('custom_form_entries').delete().eq('id', id))
  },
}

function startOfIsoWeek(date) {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  copy.setDate(copy.getDate() - day + 1)
  return toISO(copy)
}

function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

function toISO(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
