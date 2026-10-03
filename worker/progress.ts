/**
 * Learner progress in D1, so it survives clearing the browser and moving to a new tablet.
 *   GET    /api/profiles          → { profiles: [{ id, rev, deleted, updatedAt, data }] }
 *   PUT    /api/profiles/:id      { baseRev, data } → { rev }   409 { current } when another device saved first
 *   DELETE /api/profiles/:id      { baseRev }       → { rev }   409 { current }
 *   POST   /api/profiles/:id/conflict { data }      → keeps a copy that lost a sync conflict
 * One household per deployment: every grown-up who passes Cloudflare Access shares it (the email is recorded
 * as updated_by). Every save also keeps that day's last copy in `snapshots`.
 */
export interface D1Like {
  prepare(sql: string): { bind(...v: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }> } };
  batch(statements: unknown[]): Promise<unknown[]>;
}
export interface ProgressEnv { DB: D1Like; DEV_USER?: string }

type Row = { id: string; data: string; rev: number; deleted: number; updated_at: string };
const MAX_BYTES = 1_500_000; // D1 rows top out at 2 MB
const KEEP_DAYS = 90;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const view = (r: Row) => ({ id: r.id, rev: r.rev, deleted: !!r.deleted, updatedAt: r.updated_at, data: JSON.parse(r.data) });

/** Cloudflare Access puts the signed-in email on every request it lets through; DEV_USER stands in under `wrangler dev`. */
function user(req: Request, env: ProgressEnv) {
  return req.headers.get('Cf-Access-Authenticated-User-Email') ?? env.DEV_USER ?? null;
}

async function current(env: ProgressEnv, id: string) {
  return env.DB.prepare('SELECT id, data, rev, deleted, updated_at FROM profiles WHERE id = ?').bind(id).first<Row>();
}

export async function progressApi(req: Request, env: ProgressEnv, path: string): Promise<Response> {
  const who = user(req, env);
  if (!who) return json({ error: 'not signed in' }, 401);
  if (!env.DB) return json({ error: 'progress database not configured' }, 503);
  const now = new Date().toISOString();

  if (path === '/api/profiles' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, data, rev, deleted, updated_at FROM profiles').bind().all<Row>();
    return json({ profiles: results.map(view) });
  }

  const m = /^\/api\/profiles\/([A-Za-z0-9_-]{1,80})(\/conflict)?$/.exec(path);
  if (!m) return json({ error: 'not found' }, 404);
  const id = m[1];
  const text = await req.text();
  if (text.length > MAX_BYTES) return json({ error: 'too large' }, 413);
  let body: { baseRev?: unknown; data?: unknown };
  try { body = JSON.parse(text || '{}'); } catch { return json({ error: 'bad json' }, 400); }

  if (m[2] && req.method === 'POST') {
    if (!body.data || typeof body.data !== 'object') return json({ error: 'missing data' }, 400);
    await env.DB.prepare('INSERT OR REPLACE INTO snapshots (profile_id, day, kind, data, saved_at, saved_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, now.slice(0, 10), 'conflict', JSON.stringify(body.data), now, who).run();
    return json({ ok: true });
  }

  const baseRev = body.baseRev;
  if (typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0) return json({ error: 'missing baseRev' }, 400);

  if (req.method === 'PUT') {
    const data = body.data as { id?: unknown } | undefined;
    if (!data || typeof data !== 'object' || data.id !== id) return json({ error: 'profile id mismatch' }, 400);
    const raw = JSON.stringify(data);
    const rev = baseRev + 1;
    // Insert when new (baseRev 0), otherwise update only if nobody saved since this device last synced.
    const res = baseRev === 0
      ? await env.DB.prepare('INSERT INTO profiles (id, data, rev, deleted, updated_at, updated_by) VALUES (?, ?, 1, 0, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, raw, now, who).run()
      : await env.DB.prepare('UPDATE profiles SET data = ?, rev = ?, deleted = 0, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ?').bind(raw, rev, now, who, id, baseRev).run();
    if (!res.meta.changes) { const c = await current(env, id); return json({ current: c && view(c) }, 409); }
    await env.DB.batch([
      env.DB.prepare('INSERT OR REPLACE INTO snapshots (profile_id, day, kind, data, saved_at, saved_by) VALUES (?, ?, ?, ?, ?, ?)').bind(id, now.slice(0, 10), 'daily', raw, now, who),
      env.DB.prepare('DELETE FROM snapshots WHERE day < ?').bind(new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10)),
    ]);
    return json({ rev });
  }

  if (req.method === 'DELETE') {
    // The row stays (deleted = 1) so other devices learn about the deletion; snapshots keep the data.
    const res = await env.DB.prepare('UPDATE profiles SET deleted = 1, rev = ?, updated_at = ?, updated_by = ? WHERE id = ? AND rev = ?').bind(baseRev + 1, now, who, id, baseRev).run();
    if (!res.meta.changes) { const c = await current(env, id); if (!c) return json({ rev: 0 }); return json({ current: view(c) }, 409); }
    return json({ rev: baseRev + 1 });
  }
  return json({ error: 'method not allowed' }, 405);
}
