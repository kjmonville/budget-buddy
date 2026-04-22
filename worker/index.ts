interface Env {
  DB: D1Database
  ASSETS: Fetcher
  JWT_SECRET: string
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

// ─── Auth utilities ───────────────────────────────────────────────────────────

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key, 256
  )
  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

function b64url(s: string) {
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlEncode(obj: object) {
  return b64url(JSON.stringify(obj))
}

async function signJWT(payload: object, secret: string): Promise<string> {
  const data = `${b64urlEncode({ alg: 'HS256', typ: 'JWT' })}.${b64urlEncode(payload)}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${b64url(String.fromCharCode(...new Uint8Array(sig)))}`
}

async function verifyJWT(token: string, secret: string): Promise<{ sub: string; email: string } | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [h, p, s] = parts
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigBytes = Uint8Array.from(
      atob(s.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${h}.${p}`))
    if (!ok) return null
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function getTokenFromCookie(req: Request): string | null {
  const cookie = req.headers.get('Cookie') ?? ''
  const match = cookie.match(/(?:^|;\s*)bb_token=([^;]+)/)
  return match ? match[1] : null
}

function makeAuthCookie(token: string, secure: boolean): string {
  return `bb_token=${token}; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=604800`
}

function clearAuthCookie(secure: boolean): string {
  return `bb_token=; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=0`
}

async function requireAuth(req: Request, env: Env): Promise<{ sub: string; email: string } | Response> {
  const token = getTokenFromCookie(req)
  if (!token) return json({ error: 'Unauthorized' }, 401)
  const user = await verifyJWT(token, env.JWT_SECRET)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  return user
}

// ─── Auth handlers ────────────────────────────────────────────────────────────

async function postRegister(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{ email?: string; password?: string }>()
  if (!body.email || !body.password) return badRequest('email and password are required')
  if (body.password.length < 8) return badRequest('password must be at least 8 characters')
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email.toLowerCase()).first()
  if (existing) return json({ error: 'Email already registered' }, 409)
  const id = crypto.randomUUID()
  const salt = crypto.randomUUID()
  const hash = await hashPassword(body.password, salt)
  await env.DB.prepare('INSERT INTO users (id, email, password_hash, salt) VALUES (?, ?, ?, ?)')
    .bind(id, body.email.toLowerCase(), hash, salt).run()
  await env.DB.prepare('INSERT OR IGNORE INTO account_balance (user_id) VALUES (?)')
    .bind(id).run()
  const secure = new URL(req.url).protocol === 'https:'
  const token = await signJWT(
    { sub: id, email: body.email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 604800 },
    env.JWT_SECRET
  )
  return new Response(JSON.stringify({ ok: true, email: body.email.toLowerCase() }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Set-Cookie': makeAuthCookie(token, secure),
    },
  })
}

async function postLogin(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{ email?: string; password?: string }>()
  if (!body.email || !body.password) return badRequest('email and password are required')
  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, salt FROM users WHERE email = ?'
  ).bind(body.email.toLowerCase()).first<{ id: string; email: string; password_hash: string; salt: string }>()
  if (!user) return json({ error: 'Invalid email or password' }, 401)
  const hash = await hashPassword(body.password, user.salt)
  if (hash !== user.password_hash) return json({ error: 'Invalid email or password' }, 401)
  const secure = new URL(req.url).protocol === 'https:'
  const token = await signJWT(
    { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 604800 },
    env.JWT_SECRET
  )
  return new Response(JSON.stringify({ ok: true, email: user.email }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Set-Cookie': makeAuthCookie(token, secure),
    },
  })
}

async function postLogout(req: Request): Promise<Response> {
  const secure = new URL(req.url).protocol === 'https:'
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Set-Cookie': clearAuthCookie(secure),
    },
  })
}

async function getMe(env: Env, req: Request): Promise<Response> {
  const token = getTokenFromCookie(req)
  if (!token) return json({ error: 'Unauthorized' }, 401)
  const user = await verifyJWT(token, env.JWT_SECRET)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  return json({ id: user.sub, email: user.email })
}

// ─── Balance handlers ────────────────────────────────────────────────────────

async function getBalance(env: Env, userId: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT amount, balance_date, updated_at,
            strftime('%Y-%m-01', COALESCE(created_at, date('now'))) AS cutoff_date
     FROM account_balance WHERE user_id = ?`
  ).bind(userId).first()
  return json(row ?? { amount: 0, balance_date: null, updated_at: null, cutoff_date: null })
}

async function putBalance(env: Env, req: Request, userId: string): Promise<Response> {
  const body = await req.json<{ amount: unknown; balance_date?: string }>()
  if (typeof body.amount !== 'number') return badRequest('amount must be a number')
  const date = body.balance_date ?? new Date().toISOString().slice(0, 10)
  await env.DB.prepare(
    `INSERT INTO account_balance (user_id, amount, balance_date, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE
     SET amount = excluded.amount,
         balance_date = excluded.balance_date,
         updated_at = excluded.updated_at`
  ).bind(userId, body.amount, date).run()
  return json({ ok: true })
}

// ─── Recurring handlers ──────────────────────────────────────────────────────

async function getRecurring(env: Env, userId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE active = 1 AND user_id = ? ORDER BY created_at ASC'
  ).bind(userId).all()
  return json(results)
}

async function postRecurring(env: Env, req: Request, userId: string): Promise<Response> {
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
       (id, user_id, type, name, amount, recurrence_type, day_of_month, month, day_of_week, nth_week, biweekly_anchor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, userId,
      body.type, body.name, body.amount, body.recurrence_type,
      body.day_of_month ?? null, body.month ?? null,
      body.day_of_week ?? null, body.nth_week ?? null,
      body.biweekly_anchor ?? null
    )
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ?'
  ).bind(id).first()
  return json(row, 201)
}

async function putRecurring(env: Env, req: Request, id: string, userId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM recurring_transactions WHERE id = ? AND user_id = ? AND active = 1'
  ).bind(id, userId).first()
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
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.type ?? null, body.name ?? null,
      body.amount ?? null, body.recurrence_type ?? null,
      body.day_of_month ?? null, body.month ?? null,
      body.day_of_week ?? null, body.nth_week ?? null,
      body.biweekly_anchor ?? null,
      id, userId
    )
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ?'
  ).bind(id).first()
  return json(row)
}

async function deleteRecurring(env: Env, id: string, userId: string): Promise<Response> {
  const result = await env.DB.prepare(
    'UPDATE recurring_transactions SET active = 0 WHERE id = ? AND user_id = ? AND active = 1'
  ).bind(id, userId).run()
  if (!result.meta.changes) return notFound()
  return json({ ok: true })
}

// ─── Ad-hoc handlers ─────────────────────────────────────────────────────────

async function getAdhoc(env: Env, userId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE user_id = ? ORDER BY date ASC, created_at ASC'
  ).bind(userId).all()
  return json(results)
}

async function postAdhoc(env: Env, req: Request, userId: string): Promise<Response> {
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
    'INSERT INTO adhoc_transactions (id, user_id, type, name, amount, date) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, body.type, body.name, body.amount, body.date).run()

  const row = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE id = ?'
  ).bind(id).first()
  return json(row, 201)
}

async function putAdhoc(env: Env, req: Request, id: string, userId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM adhoc_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
  if (!existing) return notFound()
  const body = await req.json<{ type?: string; name?: string; amount?: number; date?: string }>()
  await env.DB.prepare(
    `UPDATE adhoc_transactions
     SET type = COALESCE(?, type), name = COALESCE(?, name),
         amount = COALESCE(?, amount), date = COALESCE(?, date)
     WHERE id = ? AND user_id = ?`
  ).bind(body.type ?? null, body.name ?? null, body.amount ?? null, body.date ?? null, id, userId).run()
  const row = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE id = ?'
  ).bind(id).first()
  return json(row)
}

async function deleteAdhoc(env: Env, id: string, userId: string): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM adhoc_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run()
  if (!result.meta.changes) return notFound()
  return json({ ok: true })
}

// ─── Skipped occurrence handlers ─────────────────────────────────────────────

async function getSkipped(env: Env, userId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM skipped_occurrences WHERE user_id = ? ORDER BY date ASC'
  ).bind(userId).all()
  return json(results)
}

async function postSkipped(env: Env, req: Request, userId: string): Promise<Response> {
  const body = await req.json<{ transaction_id?: string; transaction_type?: string; date?: string }>()
  if (!body.transaction_id || !body.transaction_type || !body.date)
    return badRequest('transaction_id, transaction_type, date are required')
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT OR IGNORE INTO skipped_occurrences (id, user_id, transaction_id, transaction_type, date) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, body.transaction_id, body.transaction_type, body.date).run()
  const row = await env.DB.prepare(
    'SELECT * FROM skipped_occurrences WHERE transaction_id = ? AND date = ? AND user_id = ?'
  ).bind(body.transaction_id, body.date, userId).first()
  return json(row, 201)
}

async function deleteSkipped(env: Env, id: string, userId: string): Promise<Response> {
  const result = await env.DB.prepare(
    'DELETE FROM skipped_occurrences WHERE id = ? AND user_id = ?'
  ).bind(id, userId).run()
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
        // Auth routes (no JWT required)
        if (pathname === '/api/auth/register' && method === 'POST') return postRegister(env, request)
        if (pathname === '/api/auth/login'    && method === 'POST') return postLogin(env, request)
        if (pathname === '/api/auth/logout'   && method === 'POST') return postLogout(request)
        if (pathname === '/api/auth/me'       && method === 'GET')  return getMe(env, request)

        // All other /api/* routes require a valid JWT
        const authResult = await requireAuth(request, env)
        if (authResult instanceof Response) return authResult
        const userId = authResult.sub

        // Balance
        if (pathname === '/api/balance') {
          if (method === 'GET') return getBalance(env, userId)
          if (method === 'PUT') return putBalance(env, request, userId)
        }

        // Recurring
        if (pathname === '/api/recurring') {
          if (method === 'GET') return getRecurring(env, userId)
          if (method === 'POST') return postRecurring(env, request, userId)
        }
        const recurringMatch = matchPath('/api/recurring/:id', pathname)
        if (recurringMatch) {
          if (method === 'PUT') return putRecurring(env, request, recurringMatch.id, userId)
          if (method === 'DELETE') return deleteRecurring(env, recurringMatch.id, userId)
        }

        // Ad-hoc
        if (pathname === '/api/adhoc') {
          if (method === 'GET') return getAdhoc(env, userId)
          if (method === 'POST') return postAdhoc(env, request, userId)
        }
        const adhocMatch = matchPath('/api/adhoc/:id', pathname)
        if (adhocMatch) {
          if (method === 'PUT') return putAdhoc(env, request, adhocMatch.id, userId)
          if (method === 'DELETE') return deleteAdhoc(env, adhocMatch.id, userId)
        }

        // Skipped occurrences
        if (pathname === '/api/skipped') {
          if (method === 'GET') return getSkipped(env, userId)
          if (method === 'POST') return postSkipped(env, request, userId)
        }
        const skippedMatch = matchPath('/api/skipped/:id', pathname)
        if (skippedMatch) {
          if (method === 'DELETE') return deleteSkipped(env, skippedMatch.id, userId)
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
