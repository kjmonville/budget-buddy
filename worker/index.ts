interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })

const badRequest = (msg: string) => json({ error: msg }, 400)
const notFound = () => json({ error: 'Not found' }, 404)

// Simple path matcher: returns named params or null if no match
function matchPath(
  pattern: string,
  pathname: string
): Record<string, string> | null {
  const patParts = pattern.split('/')
  const urlParts = pathname.split('/')
  if (patParts.length !== urlParts.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = urlParts[i]
    } else if (patParts[i] !== urlParts[i]) {
      return null
    }
  }
  return params
}

// ─── Balance handlers ────────────────────────────────────────────────────────

async function getBalance(env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT amount, balance_date, updated_at,
            strftime('%Y-%m-01', COALESCE(created_at, date('now'))) AS cutoff_date
     FROM account_balance WHERE id = 1`
  ).first()
  return json(row ?? { amount: 0, balance_date: null, updated_at: null, cutoff_date: null })
}

async function putBalance(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{ amount: unknown; balance_date?: string }>()
  if (typeof body.amount !== 'number') return badRequest('amount must be a number')
  const date = body.balance_date ?? new Date().toISOString().slice(0, 10)
  await env.DB.prepare(
    `UPDATE account_balance
     SET amount = ?, balance_date = ?, updated_at = datetime('now')
     WHERE id = 1`
  )
    .bind(body.amount, date)
    .run()
  return json({ ok: true })
}

// ─── Recurring handlers ──────────────────────────────────────────────────────

async function getRecurring(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE active = 1 ORDER BY created_at ASC'
  ).all()
  return json(results)
}

async function postRecurring(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{
    type?: string
    name?: string
    amount?: unknown
    recurrence_type?: string
    day_of_month?: number | null
    month?: number | null
    day_of_week?: number | null
    nth_week?: number | null
    biweekly_anchor?: string | null
  }>()

  if (!body.type || !body.name || typeof body.amount !== 'number' || !body.recurrence_type) {
    return badRequest('type, name, amount, recurrence_type are required')
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO recurring_transactions
       (id, type, name, amount, recurrence_type, day_of_month, month, day_of_week, nth_week, biweekly_anchor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.type,
      body.name,
      body.amount,
      body.recurrence_type,
      body.day_of_month ?? null,
      body.month ?? null,
      body.day_of_week ?? null,
      body.nth_week ?? null,
      body.biweekly_anchor ?? null
    )
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ?'
  )
    .bind(id)
    .first()
  return json(row, 201)
}

async function putRecurring(env: Env, req: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM recurring_transactions WHERE id = ? AND active = 1'
  )
    .bind(id)
    .first()
  if (!existing) return notFound()

  const body = await req.json<{
    type?: string | null
    name?: string | null
    amount?: number | null
    recurrence_type?: string | null
    day_of_month?: number | null
    month?: number | null
    day_of_week?: number | null
    nth_week?: number | null
    biweekly_anchor?: string | null
  }>()

  await env.DB.prepare(
    `UPDATE recurring_transactions
     SET type = COALESCE(?, type),
         name = COALESCE(?, name),
         amount = COALESCE(?, amount),
         recurrence_type = COALESCE(?, recurrence_type),
         day_of_month = ?,
         month = ?,
         day_of_week = ?,
         nth_week = ?,
         biweekly_anchor = ?
     WHERE id = ?`
  )
    .bind(
      body.type ?? null,
      body.name ?? null,
      body.amount ?? null,
      body.recurrence_type ?? null,
      body.day_of_month ?? null,
      body.month ?? null,
      body.day_of_week ?? null,
      body.nth_week ?? null,
      body.biweekly_anchor ?? null,
      id
    )
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ?'
  )
    .bind(id)
    .first()
  return json(row)
}

async function deleteRecurring(env: Env, id: string): Promise<Response> {
  const result = await env.DB.prepare(
    'UPDATE recurring_transactions SET active = 0 WHERE id = ? AND active = 1'
  )
    .bind(id)
    .run()
  if (!result.meta.changes) return notFound()
  return json({ ok: true })
}

// ─── Ad-hoc handlers ─────────────────────────────────────────────────────────

async function getAdhoc(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions ORDER BY date ASC, created_at ASC'
  ).all()
  return json(results)
}

async function postAdhoc(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{
    type?: string
    name?: string
    amount?: unknown
    date?: string
  }>()

  if (!body.type || !body.name || typeof body.amount !== 'number' || !body.date) {
    return badRequest('type, name, amount, date are required')
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO adhoc_transactions (id, type, name, amount, date) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, body.type, body.name, body.amount, body.date)
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE id = ?'
  )
    .bind(id)
    .first()
  return json(row, 201)
}

async function putAdhoc(env: Env, req: Request, id: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM adhoc_transactions WHERE id = ?'
  ).bind(id).first()
  if (!existing) return notFound()
  const body = await req.json<{ type?: string; name?: string; amount?: number; date?: string }>()
  await env.DB.prepare(
    `UPDATE adhoc_transactions
     SET type = COALESCE(?, type), name = COALESCE(?, name),
         amount = COALESCE(?, amount), date = COALESCE(?, date)
     WHERE id = ?`
  ).bind(body.type ?? null, body.name ?? null, body.amount ?? null, body.date ?? null, id).run()
  const row = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE id = ?'
  ).bind(id).first()
  return json(row)
}

async function deleteAdhoc(env: Env, id: string): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM adhoc_transactions WHERE id = ?'
  )
    .bind(id)
    .run()
  if (!result.meta.changes) return notFound()
  return json({ ok: true })
}

// ─── Skipped occurrence handlers ─────────────────────────────────────────────

async function getSkipped(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM skipped_occurrences ORDER BY date ASC'
  ).all()
  return json(results)
}

async function postSkipped(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{ transaction_id?: string; transaction_type?: string; date?: string }>()
  if (!body.transaction_id || !body.transaction_type || !body.date)
    return badRequest('transaction_id, transaction_type, date are required')
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT OR IGNORE INTO skipped_occurrences (id, transaction_id, transaction_type, date) VALUES (?, ?, ?, ?)'
  ).bind(id, body.transaction_id, body.transaction_type, body.date).run()
  const row = await env.DB.prepare(
    'SELECT * FROM skipped_occurrences WHERE transaction_id = ? AND date = ?'
  ).bind(body.transaction_id, body.date).first()
  return json(row, 201)
}

async function deleteSkipped(env: Env, id: string): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM skipped_occurrences WHERE id = ?'
  ).bind(id).run()
  if (!result.meta.changes) return notFound()
  return json({ ok: true })
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { method, pathname } = { method: request.method, pathname: url.pathname }

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    if (pathname.startsWith('/api/')) {
      try {
        // Balance
        if (pathname === '/api/balance') {
          if (method === 'GET') return getBalance(env)
          if (method === 'PUT') return putBalance(env, request)
        }

        // Recurring
        if (pathname === '/api/recurring') {
          if (method === 'GET') return getRecurring(env)
          if (method === 'POST') return postRecurring(env, request)
        }
        const recurringMatch = matchPath('/api/recurring/:id', pathname)
        if (recurringMatch) {
          if (method === 'PUT') return putRecurring(env, request, recurringMatch.id)
          if (method === 'DELETE') return deleteRecurring(env, recurringMatch.id)
        }

        // Ad-hoc
        if (pathname === '/api/adhoc') {
          if (method === 'GET') return getAdhoc(env)
          if (method === 'POST') return postAdhoc(env, request)
        }
        const adhocMatch = matchPath('/api/adhoc/:id', pathname)
        if (adhocMatch) {
          if (method === 'PUT') return putAdhoc(env, request, adhocMatch.id)
          if (method === 'DELETE') return deleteAdhoc(env, adhocMatch.id)
        }

        // Skipped occurrences
        if (pathname === '/api/skipped') {
          if (method === 'GET') return getSkipped(env)
          if (method === 'POST') return postSkipped(env, request)
        }
        const skippedMatch = matchPath('/api/skipped/:id', pathname)
        if (skippedMatch) {
          if (method === 'DELETE') return deleteSkipped(env, skippedMatch.id)
        }

        return notFound()
      } catch (err) {
        console.error(err)
        return json({ error: 'Internal server error' }, 500)
      }
    }

    // Serve static assets (React SPA)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
