/**
 * Copy the Next app's Mongo data into Supabase, including users.
 * Passwords stay as the existing bcrypt hashes so the same login still works.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.
 * The publishable anon key cannot create auth users or write past row security.
 *
 * Run: node scripts/migrate-mongo.cjs
 */

const fs = require('fs')
const path = require('path')
const { MongoClient } = require('d:/Workspace/me/personal-account-next/backend/node_modules/mongodb')

const root = path.resolve(__dirname, '..')
const env = loadEnv(path.join(root, '.env'))
const supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY
const mongoUrl = env.MONGO_URL

const kindMap = {
  Landing: 'Lending',
  Deposite: 'Deposit',
}

function loadEnv(file) {
  const values = {}
  if (!fs.existsSync(file)) return values
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const split = trimmed.indexOf('=')
    if (split < 1) continue
    let value = trimmed.slice(split + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[trimmed.slice(0, split).trim()] = value
  }
  return values
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function safe(error) {
  return String(error && error.message ? error.message : error).replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://***@')
}

function oid(value) {
  if (!value) return ''
  return String(value)
}

function isoDate(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) return match[1]
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date)
}

function stamp(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now())
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function money(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(number)) return null
  return Math.round(number * 100) / 100
}

function positive(value) {
  const number = money(value)
  return number !== null && number > 0 ? number : null
}

function text(value) {
  return value === null || value === undefined ? '' : String(value)
}

async function authRequest(pathname, method, body) {
  const response = await fetch(`${supabaseUrl}${pathname}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload.msg || payload.message || payload.error_description || payload.error || response.statusText
    throw new Error(`${response.status} ${message}`)
  }
  return payload
}

async function mapPool(items, limit, worker) {
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      await worker(item)
    }
  }
  const workers = Math.min(limit, items.length)
  if (workers > 0) await Promise.all(Array.from({ length: workers }, run))
}

async function rest(method, resource, body, prefer = 'return=minimal') {
  const response = await fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = await response.text()
    throw new Error(`${method} ${resource.split('?')[0]} ${response.status} ${payload.slice(0, 300)}`)
  }
}

async function insertRows(table, rows) {
  const stats = { inserted: 0, skipped: 0 }
  const reasons = []
  async function write(chunk) {
    if (!chunk.length) return
    try {
      await rest('POST', table, chunk)
      stats.inserted += chunk.length
    } catch (error) {
      if (chunk.length === 1) {
        stats.skipped += 1
        if (reasons.length < 12) reasons.push(`${table}: ${safe(error)}`)
        return
      }
      const mid = Math.ceil(chunk.length / 2)
      await write(chunk.slice(0, mid))
      await write(chunk.slice(mid))
    }
  }
  for (let index = 0; index < rows.length; index += 200) {
    await write(rows.slice(index, index + 200))
  }
  return { ...stats, reasons }
}

async function listAuthUsers() {
  const users = []
  for (let page = 1; page <= 20; page += 1) {
    const payload = await authRequest(`/auth/v1/admin/users?page=${page}&per_page=200`, 'GET')
    const batch = payload.users || []
    users.push(...batch)
    if (batch.length < 200) break
  }
  return users
}

async function main() {
  if (!supabaseUrl) fail('VITE_SUPABASE_URL is missing from .env')
  if (!mongoUrl) fail('MONGO_URL is missing from .env')
  if (!serviceKey) {
    fail('Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase dashboard → Project Settings → API → service_role / secret key), then run this script again. The publishable key cannot import users or their rows.')
  }

  const client = new MongoClient(mongoUrl)
  await client.connect()
  const db = client.db()
  const [users, banks, categories, entries, lending, items, deposits, statements, forms, formEntries] = await Promise.all([
    db.collection('users').find().toArray(),
    db.collection('banks').find().toArray(),
    db.collection('categories').find().toArray(),
    db.collection('entries').find().toArray(),
    db.collection('dcentries').find().toArray(),
    db.collection('dcitems').find().toArray(),
    db.collection('dwentries').find().toArray(),
    db.collection('statements').find().toArray(),
    db.collection('specialstructures').find().toArray(),
    db.collection('dynamicentries').find().toArray(),
  ])
  await client.close()

  const existing = await listAuthUsers()
  const byEmail = new Map(existing.map((user) => [String(user.email || '').toLowerCase(), user]))
  const userIds = new Map()
  let usersCreated = 0
  let usersUpdated = 0
  const skippedUsers = []

  for (const user of users) {
    const email = text(user.email).trim().toLowerCase()
    const password = text(user.password)
    if (!email || !password.startsWith('$2')) {
      skippedUsers.push('user missing email or password hash')
      continue
    }
    const metadata = {
      name: text(user.name).trim(),
      mongo_id: oid(user._id),
    }
    try {
      const found = byEmail.get(email)
      if (found) {
        await authRequest(`/auth/v1/admin/users/${found.id}`, 'PUT', {
          password_hash: password,
          email_confirm: true,
          user_metadata: { ...(found.user_metadata || {}), ...metadata },
        })
        userIds.set(oid(user._id), found.id)
        usersUpdated += 1
      } else {
        const created = await authRequest('/auth/v1/admin/users', 'POST', {
          email,
          password_hash: password,
          email_confirm: true,
          user_metadata: metadata,
        })
        userIds.set(oid(user._id), created.id)
        usersCreated += 1
      }
    } catch (error) {
      skippedUsers.push(`user import failed: ${safe(error)}`)
    }
  }

  const importedUserIds = [...userIds.values()]
  const tables = [
    'custom_form_entries',
    'custom_forms',
    'lending_items',
    'statements',
    'deposits',
    'entries',
    'lending_entries',
    'categories',
    'banks',
  ]
  for (const userId of importedUserIds) {
    for (const table of tables) {
      await rest('DELETE', `${table}?user_id=eq.${userId}`)
    }
  }

  const bankIds = new Map()
  const categoryIds = new Map()
  const entryIds = new Map()
  const lendingIds = new Map()
  const itemIds = new Map()
  const depositIds = new Map()
  const formIds = new Map()
  const cashUsers = new Set()
  const skipped = []

  const bankRows = []
  for (const bank of banks) {
    const userId = userIds.get(oid(bank.userId))
    const name = text(bank.name).trim()
    if (!userId || !name) {
      skipped.push('bank')
      continue
    }
    const id = crypto.randomUUID()
    const isCash = /^cash$/i.test(name) && !cashUsers.has(userId)
    if (isCash) cashUsers.add(userId)
    bankIds.set(oid(bank._id), id)
    bankRows.push({
      id,
      user_id: userId,
      name,
      enable: bank.enable !== false,
      is_cash: isCash,
      created_at: stamp(bank.date),
    })
  }

  const categoryRows = []
  for (const category of categories) {
    const userId = userIds.get(oid(category.userId))
    const name = text(category.name).trim()
    if (!userId || !name) {
      skipped.push('category')
      continue
    }
    const id = crypto.randomUUID()
    categoryIds.set(oid(category._id), id)
    categoryRows.push({
      id,
      user_id: userId,
      name,
      enable: category.enable !== false,
      is_ledger: category.ledger === true,
      created_at: stamp(category.date),
    })
  }

  const entryRows = []
  const parentLinks = []
  for (const entry of entries) {
    const userId = userIds.get(oid(entry.userId))
    const date = isoDate(entry.date)
    const amount = positive(entry.amount)
    if (!userId || !date || !amount || !['Debit', 'Credit'].includes(entry.type)) {
      skipped.push('entry')
      continue
    }
    const id = crypto.randomUUID()
    entryIds.set(oid(entry._id), id)
    const categoryId = categoryIds.get(oid(entry.ledger)) || categoryIds.get(oid(entry.category)) || null
    entryRows.push({
      id,
      user_id: userId,
      date,
      type: entry.type,
      amount,
      description: text(entry.description),
      bank_id: bankIds.get(oid(entry.bank)) || null,
      category_id: categoryId,
      parent_id: null,
      created_at: stamp(entry.date),
    })
    if (oid(entry.parentId)) parentLinks.push({ id, userId, parent: oid(entry.parentId) })
  }

  const lendingRows = []
  for (const entry of lending) {
    const userId = userIds.get(oid(entry.userId))
    const date = isoDate(entry.date)
    const amount = positive(entry.amount)
    if (!userId || !date || !amount || !['Debit', 'Credit'].includes(entry.type)) {
      skipped.push('lending')
      continue
    }
    const id = crypto.randomUUID()
    lendingIds.set(oid(entry._id), id)
    lendingRows.push({
      id,
      user_id: userId,
      date,
      due_date: isoDate(entry.duedate),
      type: entry.type,
      amount,
      remaining_amount: amount,
      description: text(entry.description),
      bank_id: bankIds.get(oid(entry.bank)) || null,
      category_id: categoryIds.get(oid(entry.ledger)) || null,
      created_at: stamp(entry.date),
    })
  }

  const itemRows = []
  for (const item of items) {
    const parentId = lendingIds.get(oid(item.parent))
    const parent = lending.find((entry) => oid(entry._id) === oid(item.parent))
    const userId = parent ? userIds.get(oid(parent.userId)) : null
    const date = isoDate(item.date)
    const amount = positive(item.amount)
    if (!parentId || !userId || !date || !amount || !['Debit', 'Credit'].includes(item.type)) {
      skipped.push('lending item')
      continue
    }
    const id = crypto.randomUUID()
    itemIds.set(oid(item._id), id)
    itemRows.push({
      id,
      user_id: userId,
      parent_id: parentId,
      date,
      type: item.type,
      amount,
      description: text(item.description),
      bank_id: bankIds.get(oid(item.bank)) || null,
      created_at: stamp(item.date),
    })
  }

  const paymentsByParent = new Map()
  for (const item of itemRows) {
    const list = paymentsByParent.get(item.parent_id) || []
    list.push(item)
    paymentsByParent.set(item.parent_id, list)
  }
  for (const row of lendingRows) {
    const payments = paymentsByParent.get(row.id) || []
    const adjustment = payments.reduce((sum, item) => sum + (item.type === row.type ? item.amount : -item.amount), 0)
    row.remaining_amount = Math.round((row.amount + adjustment) * 100) / 100
  }

  const depositRows = []
  for (const entry of deposits) {
    const userId = userIds.get(oid(entry.userId))
    const date = isoDate(entry.date)
    const amount = positive(entry.amount)
    if (!userId || !date || !amount || !['Deposit', 'Withdrawal'].includes(entry.type)) {
      skipped.push('deposit')
      continue
    }
    const id = crypto.randomUUID()
    depositIds.set(oid(entry._id), id)
    depositRows.push({
      id,
      user_id: userId,
      date,
      type: entry.type,
      amount,
      description: text(entry.description),
      bank_id: bankIds.get(oid(entry.bankaccount)) || null,
      created_at: stamp(entry.date),
    })
  }

  const formRows = []
  const formByMongo = new Map()
  for (const form of forms) {
    const userId = userIds.get(oid(form.userId))
    const title = text(form.title).trim()
    if (!userId || !title) {
      skipped.push('form')
      continue
    }
    const id = crypto.randomUUID()
    formIds.set(oid(form._id), id)
    const fields = (Array.isArray(form.data) ? form.data : []).map((field) => ({
      name: text(field.name),
      type: field.type || (field.total ? 'number' : 'text'),
      key: field.key || text(field.name).toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w-]+/g, ''),
      total: Boolean(field.total),
      options: Array.isArray(field.options) ? field.options : [],
    }))
    formByMongo.set(oid(form._id), fields)
    formRows.push({
      id,
      user_id: userId,
      title,
      sidebar: Boolean(form.sidebar),
      fields,
      created_at: stamp(form.date),
    })
  }

  const formEntryRows = []
  for (const entry of formEntries) {
    const userId = userIds.get(oid(entry.userId))
    const formId = formIds.get(oid(entry.formId))
    if (!userId || !formId) {
      skipped.push('form entry')
      continue
    }
    const fields = formByMongo.get(oid(entry.formId)) || []
    const byName = new Map()
    const byKey = new Map()
    for (const field of fields) {
      if (field.name) byName.set(field.name, field)
      if (field.key) byKey.set(field.key, field)
    }
    const data = {}
    for (const [rawKey, value] of Object.entries(entry.data || {})) {
      const field = byKey.get(rawKey) || byName.get(rawKey) || byName.get(rawKey.trim())
      const key = field?.key || rawKey.trim()
      if (!key) continue
      if (field?.type === 'number') {
        const number = Number(value)
        data[key] = Number.isFinite(number) ? number : value
      } else if (field?.type === 'date') {
        data[key] = isoDate(value) || value
      } else {
        data[key] = value
      }
    }
    formEntryRows.push({
      id: crypto.randomUUID(),
      user_id: userId,
      form_id: formId,
      data,
      created_at: stamp(entry.date),
    })
  }

  const refIds = new Map([...entryIds, ...lendingIds, ...depositIds])
  const statementRows = []
  for (const row of statements) {
    const userId = userIds.get(oid(row.userId))
    if (!userId) {
      skipped.push('statement')
      continue
    }
    statementRows.push({
      id: crypto.randomUUID(),
      user_id: userId,
      date: isoDate(row.date),
      description: text(row.description),
      debit: money(row.debit) || 0,
      credit: money(row.credit) || 0,
      amount: money(row.amount) || 0,
      bank_id: bankIds.get(oid(row.bank)) || null,
      category_id: categoryIds.get(oid(row.ledger)) || null,
      ref_id: refIds.get(oid(row.refId)) || null,
      item_ref_id: itemIds.get(oid(row.itemRefId)) || null,
      entry_kind: kindMap[row.type] || row.type || null,
      created_at: stamp(row.createdAt || row.date),
    })
  }

  const results = {}
  results.banks = await insertRows('banks', bankRows)
  results.categories = await insertRows('categories', categoryRows)
  results.entries = await insertRows('entries', entryRows)
  results.lending_entries = await insertRows('lending_entries', lendingRows)
  results.lending_items = await insertRows('lending_items', itemRows)
  results.deposits = await insertRows('deposits', depositRows)
  results.custom_forms = await insertRows('custom_forms', formRows)
  results.custom_form_entries = await insertRows('custom_form_entries', formEntryRows)
  results.statements = await insertRows('statements', statementRows)

  const entryByMongoId = new Map(entries.map((entry) => [oid(entry._id), entry]))
  const parentRows = []
  let parentsDropped = 0
  for (const link of parentLinks) {
    const parentId = entryIds.get(link.parent)
    const parent = entryByMongoId.get(link.parent)
    if (!parentId || !parent || userIds.get(oid(parent.userId)) !== link.userId || parentId === link.id) {
      parentsDropped += 1
      continue
    }
    parentRows.push({ id: link.id, parent_id: parentId })
  }
  let parentsLinked = 0
  await mapPool(parentRows, 20, async (link) => {
    await rest('PATCH', `entries?id=eq.${link.id}`, { parent_id: link.parent_id })
    parentsLinked += 1
  })

  const tally = (list) => list.reduce((counts, name) => ({ ...counts, [name]: (counts[name] || 0) + 1 }), {})
  console.log(JSON.stringify({
    usersCreated,
    usersUpdated,
    usersSkipped: skippedUsers.length,
    parentsLinked,
    parentsDropped,
    skipped: tally(skipped),
    inserted: Object.fromEntries(Object.entries(results).map(([table, result]) => [table, result.inserted])),
    rowSkipped: Object.fromEntries(Object.entries(results).filter(([, result]) => result.skipped).map(([table, result]) => [table, result.skipped])),
    reasons: [...skippedUsers, ...Object.values(results).flatMap((result) => result.reasons)].slice(0, 20),
  }, null, 2))
}

main().catch((error) => fail(safe(error)))
