interface Env {
  DB: D1Database
  ASSETS: Fetcher
  JWT_SECRET: string
  ALLOWED_ORIGIN: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_TYPES = new Set(['deposit', 'expense'])
const VALID_RECURRENCE_TYPES = new Set(['monthly_fixed', 'weekly', 'biweekly', 'yearly', 'monthly_nth_weekday'])
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  return ISO_DATE_RE.test(s)
}

function validateLengths(fields: Record<string, { value: string | undefined | null; max: number }>): string | null {
  for (const [field, { value, max }] of Object.entries(fields)) {
    if (value && value.length > max) return `${field} must be ${max} characters or fewer`
  }
  return null
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
    // Reject tokens that are missing exp or have expired (issue 2)
    if (!payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function getTokenFromRequest(req: Request): string | null {
  // Prefer Authorization: Bearer <jwt> (native clients), fall back to cookie (web).
  const auth = req.headers.get('Authorization') ?? ''
  if (auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
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
  const token = getTokenFromRequest(req)
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
  const lenErr = validateLengths({
    email:    { value: body.email,    max: 254 },
    password: { value: body.password, max: 128 },
  })
  if (lenErr) return badRequest(lenErr)
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
  return new Response(JSON.stringify({ ok: true, email: body.email.toLowerCase(), token }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeAuthCookie(token, secure),
    },
  })
}

async function postLogin(env: Env, req: Request): Promise<Response> {
  const body = await req.json<{ email?: string; password?: string }>()
  if (!body.email || !body.password) return badRequest('email and password are required')
  const lenErr = validateLengths({
    email:    { value: body.email,    max: 254 },
    password: { value: body.password, max: 128 },
  })
  if (lenErr) return badRequest(lenErr)
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
  return new Response(JSON.stringify({ ok: true, email: user.email, token }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
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
      'Set-Cookie': clearAuthCookie(secure),
    },
  })
}

async function getMe(env: Env, req: Request): Promise<Response> {
  const token = getTokenFromRequest(req)
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
  if (typeof body.amount !== 'number' || !isFinite(body.amount))
    return badRequest('amount must be a finite number')
  const date = body.balance_date ?? new Date().toISOString().slice(0, 10)
  if (!isValidDate(date)) return badRequest('balance_date must be YYYY-MM-DD')
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
    notes?: string | null
  }>()

  if (!body.type || !body.name || typeof body.amount !== 'number' || !body.recurrence_type) {
    return badRequest('type, name, amount, recurrence_type are required')
  }
  if (!isFinite(body.amount)) return badRequest('amount must be a finite number')
  if (!VALID_TYPES.has(body.type)) return badRequest('type must be "deposit" or "expense"')
  if (!VALID_RECURRENCE_TYPES.has(body.recurrence_type)) return badRequest('invalid recurrence_type')
  const lenErr = validateLengths({
    name:  { value: body.name,  max: 100 },
    notes: { value: body.notes, max: 500 },
  })
  if (lenErr) return badRequest(lenErr)

  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO recurring_transactions
       (id, user_id, type, name, amount, recurrence_type, day_of_month, month, day_of_week, nth_week, biweekly_anchor, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, userId,
      body.type, body.name, body.amount, body.recurrence_type,
      body.day_of_month ?? null, body.month ?? null,
      body.day_of_week ?? null, body.nth_week ?? null,
      body.biweekly_anchor ?? null, body.notes ?? null
    )
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
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
    notes?: string | null
  }>()

  if (body.amount !== undefined && body.amount !== null && !isFinite(body.amount))
    return badRequest('amount must be a finite number')
  if (body.type != null && !VALID_TYPES.has(body.type))
    return badRequest('type must be "deposit" or "expense"')
  if (body.recurrence_type != null && !VALID_RECURRENCE_TYPES.has(body.recurrence_type))
    return badRequest('invalid recurrence_type')
  const lenErr = validateLengths({
    name:  { value: body.name,  max: 100 },
    notes: { value: body.notes, max: 500 },
  })
  if (lenErr) return badRequest(lenErr)

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
         biweekly_anchor = ?,
         notes = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(
      body.type ?? null, body.name ?? null,
      body.amount ?? null, body.recurrence_type ?? null,
      body.day_of_month ?? null, body.month ?? null,
      body.day_of_week ?? null, body.nth_week ?? null,
      body.biweekly_anchor ?? null, body.notes ?? null,
      id, userId
    )
    .run()

  const row = await env.DB.prepare(
    'SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
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
    notes?: string | null
  }>()

  if (!body.type || !body.name || typeof body.amount !== 'number' || !body.date) {
    return badRequest('type, name, amount, date are required')
  }
  if (!isFinite(body.amount)) return badRequest('amount must be a finite number')
  if (!VALID_TYPES.has(body.type)) return badRequest('type must be "deposit" or "expense"')
  if (!isValidDate(body.date)) return badRequest('date must be YYYY-MM-DD')
  const lenErr = validateLengths({
    name:  { value: body.name,  max: 100 },
    notes: { value: body.notes, max: 500 },
  })
  if (lenErr) return badRequest(lenErr)

  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO adhoc_transactions (id, user_id, type, name, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, body.type, body.name, body.amount, body.date, body.notes ?? null).run()

  const row = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
  return json(row, 201)
}

async function putAdhoc(env: Env, req: Request, id: string, userId: string): Promise<Response> {
  const existing = await env.DB.prepare(
    'SELECT id FROM adhoc_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
  if (!existing) return notFound()
  const body = await req.json<{ type?: string; name?: string; amount?: number; date?: string; notes?: string | null }>()
  if (body.amount !== undefined && body.amount !== null && !isFinite(body.amount))
    return badRequest('amount must be a finite number')
  if (body.type != null && !VALID_TYPES.has(body.type))
    return badRequest('type must be "deposit" or "expense"')
  if (body.date != null && !isValidDate(body.date))
    return badRequest('date must be YYYY-MM-DD')
  const lenErr = validateLengths({
    name:  { value: body.name,  max: 100 },
    notes: { value: body.notes, max: 500 },
  })
  if (lenErr) return badRequest(lenErr)
  await env.DB.prepare(
    `UPDATE adhoc_transactions
     SET type = COALESCE(?, type), name = COALESCE(?, name),
         amount = COALESCE(?, amount), date = COALESCE(?, date),
         notes = ?
     WHERE id = ? AND user_id = ?`
  ).bind(body.type ?? null, body.name ?? null, body.amount ?? null, body.date ?? null, body.notes ?? null, id, userId).run()
  const row = await env.DB.prepare(
    'SELECT * FROM adhoc_transactions WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first()
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
  if (body.transaction_type !== 'recurring' && body.transaction_type !== 'adhoc')
    return badRequest('transaction_type must be "recurring" or "adhoc"')
  if (!isValidDate(body.date)) return badRequest('date must be YYYY-MM-DD')

  // Verify the transaction belongs to the authenticated user (issue 3)
  const table = body.transaction_type === 'recurring' ? 'recurring_transactions' : 'adhoc_transactions'
  const owned = await env.DB.prepare(
    `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`
  ).bind(body.transaction_id, userId).first()
  if (!owned) return notFound()

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

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const { method, pathname } = { method: request.method, pathname: url.pathname }

  // CORS preflight — origin check handled by the outer fetch wrapper
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const res = await handleRequest(request, env)

    // Restrict CORS to the configured allowed origin (issue 1)
    const requestOrigin = request.headers.get('Origin') ?? ''
    const allowedOrigin = env.ALLOWED_ORIGIN ?? ''
    if (allowedOrigin && requestOrigin === allowedOrigin) {
      const r = new Response(res.body, res)
      r.headers.set('Access-Control-Allow-Origin', allowedOrigin)
      return r
    }
    return res
  },
} satisfies ExportedHandler<Env>
