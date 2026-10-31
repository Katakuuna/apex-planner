// Apex Planner — MCP server for Claude (custom connector in claude.ai).
// Claude calls these tools; they read and write the same user_state documents the app syncs,
// so changes show up in the open app at once (Supabase Realtime).
//
// Auth: the connector URL carries a personal key (…/apex-mcp?key=XXXX) made in the app's settings.
// Only its SHA-256 is stored, in public.mcp_tokens. Deploy with "Verify JWT" turned OFF.
// No imports, so the file can be pasted as is into Supabase → Edge Functions → Via Editor.

const SB_URL = env('SUPABASE_URL');
const SB_KEY = env('SUPABASE_SERVICE_ROLE_KEY') || env('SB_SECRET_KEY');
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DATED = ['tasks', 'notes', 'habitLog', 'workouts', 'food', 'water', 'weight', 'body', 'progDay'];
const WD: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
const WD_NAME = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function env(k: string): string { try { return (globalThis as any).Deno?.env.get(k) || (globalThis as any).process?.env?.[k] || ''; } catch { return ''; } }

// ---------- database (PostgREST with the service key; every query is scoped to one user_id) ----------
async function rest(path: string, init: RequestInit = {}) {
  const h: Record<string, string> = { apikey: SB_KEY, 'Content-Type': 'application/json', ...(init.headers as any || {}) };
  if (SB_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SB_KEY; // legacy service_role JWT; sb_secret_ keys go in apikey only
  const r = await fetch(SB_URL + '/rest/v1/' + path, { ...init, headers: h });
  if (!r.ok) throw new Error('db ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function userFor(key: string): Promise<string | null> {
  if (!key || key.length < 20) return null;
  const rows = await rest('mcp_tokens?select=user_id&token_hash=eq.' + await sha256(key));
  return rows?.[0]?.user_id || null;
}

class Store {
  uid: string; cache = new Map<string, any>(); dirty = new Set<string>();
  constructor(uid: string) { this.uid = uid; }
  async get(doc: string) {
    if (!this.cache.has(doc)) {
      const r = await rest(`user_state?select=data&user_id=eq.${this.uid}&doc=eq.${encodeURIComponent(doc)}`);
      this.cache.set(doc, r?.[0]?.data ?? null);
    }
    return this.cache.get(doc);
  }
  async getMany(docs: string[]) {
    const need = docs.filter(d => !this.cache.has(d));
    if (need.length) {
      const list = need.map(d => '"' + d.replace(/"/g, '') + '"').join(',');
      const rows = await rest(`user_state?select=doc,data&user_id=eq.${this.uid}&doc=in.(${encodeURIComponent(list)})`);
      need.forEach(d => this.cache.set(d, null));
      for (const r of rows || []) this.cache.set(r.doc, r.data);
    }
    return docs.map(d => this.cache.get(d));
  }
  set(doc: string, data: any) { this.cache.set(doc, data); this.dirty.add(doc); }
  async flush() {
    if (!this.dirty.size) return;
    const now = new Date().toISOString();
    const rows = [...this.dirty].map(doc => ({ user_id: this.uid, doc, data: this.cache.get(doc), updated_at: now }));
    await rest('user_state?on_conflict=user_id,doc', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    this.dirty.clear();
  }
  // dated maps are sharded by month: tasks~2026-11 = { "2026-11-03": [...] }
  async day(key: string, date: string) { return ((await this.get(key + '~' + date.slice(0, 7))) || {})[date]; }
  async setDay(key: string, date: string, v: any) {
    const doc = key + '~' + date.slice(0, 7), m = { ...((await this.get(doc)) || {}) };
    if (v === undefined) delete m[date]; else m[date] = v;
    this.set(doc, m);
  }
  async range(key: string, from: string, to: string) {
    const months: string[] = [];
    for (let m = from.slice(0, 7); m <= to.slice(0, 7) && months.length < 36; m = nextMonth(m)) months.push(key + '~' + m);
    const out: Record<string, any> = {};
    for (const shard of await this.getMany(months)) for (const [d, v] of Object.entries(shard || {})) if (d >= from && d <= to) out[d] = v;
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a < b ? -1 : 1));
  }
}

// ---------- helpers ----------
const uid = () => [...crypto.getRandomValues(new Uint8Array(6))].map(x => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-2);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isoDate(s: any, name = 'date') {
  if (typeof s !== 'string' || !DATE_RE.test(s) || isNaN(Date.parse(s + 'T12:00:00Z'))) throw new UserError(`${name} must be YYYY-MM-DD`);
  return s;
}
function addDays(s: string, n: number) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function nextMonth(m: string) { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
function hhmm(t: any) {
  if (t == null || t === '') return '';
  const m = String(t).trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) throw new UserError('time must be HH:MM (24h)');
  return m[1].padStart(2, '0') + ':' + m[2];
}
const byTime = (a: any, b: any) => (a.time || '99').localeCompare(b.time || '99');
const str = (v: any, max: number) => String(v ?? '').trim().slice(0, max);
class UserError extends Error {}
const exs = (d: any) => (d.ex || []).map((e: any) => typeof e === 'string' ? { n: e, c: '' } : e);
const progOut = (P: any) => P && {
  name: P.name,
  days: P.days.map((d: any) => ({ id: d.id, name: d.name, weekday: d.wd == null ? null : WD_NAME[d.wd], exercises: exs(d).map((e: any) => e.c ? { name: e.n, comment: e.c } : { name: e.n }) })),
  rules: (P.rules || []).map((r: any) => ({ title: r.t, text: r.d })),
  weekly_sets: P.targets || undefined,
};
const taskOut = (t: any) => ({ id: t.id, title: t.title, ...(t.time ? { time: t.time } : {}), done: !!t.done, ...(t.goal ? { goal_id: t.goal } : {}) });

// ---------- tools ----------
const S = (p: any, req: string[] = []) => ({ type: 'object', properties: p, required: req, additionalProperties: false });
const DATE = { type: 'string', description: 'YYYY-MM-DD, in the user\'s local calendar' };
const TOOLS: any[] = [
  {
    name: 'planner_overview',
    description: 'Start here. Snapshot of the Apex planner: tasks for the coming days, habits, goals, the training program (short), recent body weight and nutrition targets. Pass the user\'s local "today".',
    inputSchema: S({ today: DATE, days: { type: 'integer', minimum: 1, maximum: 31, description: 'How many days of tasks to include (default 7)' } }, ['today']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_tasks',
    description: 'Tasks / reminders for a date range (inclusive). A task with a time is how the planner shows a reminder.',
    inputSchema: S({ from: DATE, to: DATE }, ['from', 'to']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_tasks',
    description: 'Add one or more tasks (reminders) to the planner. Use the user\'s language for titles (usually Russian). time is optional, 24h HH:MM.',
    inputSchema: S({ tasks: { type: 'array', minItems: 1, maxItems: 100, items: S({ date: DATE, title: { type: 'string' }, time: { type: 'string', description: 'HH:MM, optional' }, goal_id: { type: 'string', description: 'optional, id of a goal from planner_overview' } }, ['date', 'title']) } }, ['tasks']),
  },
  {
    name: 'update_task',
    description: 'Change a task: mark done/undone, rename, change time, or move it to another date.',
    inputSchema: S({ date: DATE, id: { type: 'string' }, done: { type: 'boolean' }, title: { type: 'string' }, time: { type: 'string', description: 'HH:MM, or empty string to clear' }, move_to: DATE }, ['date', 'id']),
  },
  {
    name: 'delete_task',
    description: 'Delete a task.',
    inputSchema: S({ date: DATE, id: { type: 'string' } }, ['date', 'id']),
    annotations: { destructiveHint: true },
  },
  {
    name: 'get_program',
    description: 'The full training program: days, the weekday each is attached to, exercises with coaching comments, program rules and weekly working-set targets per muscle group.',
    inputSchema: S({}),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'set_program',
    description: 'Create or replace the training program (the whole program is replaced; read get_program first to edit it). Exercise names in Russian as in common gym usage (e.g. "Жим лёжа", "Приседания со штангой", "Тяга верхнего блока"). Put sets×reps, tempo or cues into comment. weekday attaches a program day to a weekday so it shows up on those dates in the Gym tab.',
    inputSchema: S({
      name: { type: 'string' },
      days: { type: 'array', minItems: 1, maxItems: 14, items: S({
        name: { type: 'string', description: 'e.g. "Верх А" or "День 1 — ноги"' },
        weekday: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
        exercises: { type: 'array', minItems: 1, maxItems: 30, items: S({ name: { type: 'string' }, comment: { type: 'string', description: 'e.g. "3×6-8, RIR 1-2, пауза внизу"' } }, ['name']) },
      }, ['name', 'exercises']) },
      rules: { type: 'array', description: 'Program-wide rules such as progression or deload', items: S({ title: { type: 'string' }, text: { type: 'string' } }, ['title', 'text']) },
      weekly_sets: { type: 'object', description: 'Optional weekly working-set target per muscle group, e.g. {"Грудь":[10,16]}. Groups: Грудь, Спина, Плечи, Бицепс, Трицепс, Квадрицепс, Бицепс бедра, Ягодицы, Икры, Пресс, Предплечья', additionalProperties: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } },
    }, ['days']),
  },
  {
    name: 'get_workouts',
    description: 'Logged workouts for a date range: exercises with sets as weight×reps (warm-ups marked). Max 120 days.',
    inputSchema: S({ from: DATE, to: DATE }, ['from', 'to']),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_habit',
    description: 'Add a daily habit to track (shown as a checkbox every day).',
    inputSchema: S({ name: { type: 'string' } }, ['name']),
  },
  {
    name: 'delete_habit',
    description: 'Remove a habit (its history stays).',
    inputSchema: S({ id: { type: 'string' } }, ['id']),
    annotations: { destructiveHint: true },
  },
  {
    name: 'add_goal',
    description: 'Add a goal. level: year, month or week. parent_id nests it under a bigger goal.',
    inputSchema: S({ title: { type: 'string' }, level: { type: 'string', enum: ['year', 'month', 'week'] }, parent_id: { type: 'string' } }, ['title', 'level']),
  },
  {
    name: 'log_weight',
    description: 'Record body weight (kg) for a date.',
    inputSchema: S({ date: DATE, kg: { type: 'number', minimum: 20, maximum: 400 } }, ['date', 'kg']),
  },
];

async function callTool(name: string, a: any, st: Store): Promise<any> {
  a = a || {};
  switch (name) {
    case 'planner_overview': {
      const t = isoDate(a.today, 'today'), n = Math.min(31, Math.max(1, a.days | 0 || 7));
      const [habits, goals, program, settings] = await st.getMany(['habits', 'goals', 'program', 'settings']);
      const tasks = await st.range('tasks', t, addDays(t, n - 1));
      const w = await st.range('weight', addDays(t, -30), t), wd = Object.keys(w);
      const hl = await st.range('habitLog', addDays(t, -6), t);
      const P = progOut(program);
      return {
        today: t,
        tasks: Object.fromEntries(Object.entries(tasks).filter(([, v]: any) => v?.length).map(([d, v]: any) => [d, v.map(taskOut)])),
        habits: (habits || []).map((h: any) => ({ id: h.id, name: h.name, done_last_7_days: Object.values(hl).filter((l: any) => l?.includes?.(h.id)).length })),
        goals: (goals || []).map((g: any) => ({ id: g.id, title: g.title, level: g.level, ...(g.parent ? { parent_id: g.parent } : {}), done: !!g.done })),
        program: P ? { name: P.name, days: P.days.map((d: any) => `${d.name}${d.weekday ? ' (' + d.weekday + ')' : ''}: ${d.exercises.map((e: any) => e.name).join(', ')}`) } : null,
        weight_kg: wd.length ? { latest: { date: wd[wd.length - 1], kg: w[wd[wd.length - 1]] }, first_in_last_30_days: { date: wd[0], kg: w[wd[0]] } } : null,
        settings: settings ? { kcal: settings.kcal, protein_g: settings.p, fat_g: settings.f, carbs_g: settings.c, maintenance_kcal: settings.maint, water_ml: settings.water, goal_weight_kg: settings.goalWeight, rep_range: settings.reps } : null,
      };
    }
    case 'list_tasks': {
      const from = isoDate(a.from, 'from'), to = isoDate(a.to, 'to');
      if (to < from || to > addDays(from, 366)) throw new UserError('range must be 0–366 days');
      const r = await st.range('tasks', from, to);
      return Object.fromEntries(Object.entries(r).filter(([, v]: any) => v?.length).map(([d, v]: any) => [d, v.map(taskOut)]));
    }
    case 'add_tasks': {
      if (!Array.isArray(a.tasks) || !a.tasks.length) throw new UserError('tasks is empty');
      const added: any[] = [];
      for (const x of a.tasks.slice(0, 100)) {
        const date = isoDate(x.date), title = str(x.title, 200);
        if (!title) throw new UserError('task title is empty');
        const t = { id: uid(), title, time: hhmm(x.time), goal: str(x.goal_id, 40), done: false };
        const list = [...((await st.day('tasks', date)) || []), t].sort(byTime);
        await st.setDay('tasks', date, list);
        added.push({ date, ...taskOut(t) });
      }
      await st.flush();
      return { added };
    }
    case 'update_task': case 'delete_task': {
      const date = isoDate(a.date), list = [...((await st.day('tasks', date)) || [])], i = list.findIndex((t: any) => t.id === a.id);
      if (i < 0) throw new UserError(`no task ${a.id} on ${date}; call list_tasks`);
      if (name === 'delete_task') { list.splice(i, 1); await st.setDay('tasks', date, list); await st.flush(); return { deleted: a.id }; }
      const t = { ...list[i] };
      if (typeof a.done === 'boolean') t.done = a.done;
      if (a.title != null && str(a.title, 200)) t.title = str(a.title, 200);
      if (a.time != null) t.time = hhmm(a.time);
      let to = date;
      if (a.move_to && a.move_to !== date) {
        to = isoDate(a.move_to, 'move_to');
        list.splice(i, 1); await st.setDay('tasks', date, list);
        await st.setDay('tasks', to, [...((await st.day('tasks', to)) || []), t].sort(byTime));
      } else { list[i] = t; await st.setDay('tasks', date, list.sort(byTime)); }
      await st.flush();
      return { date: to, ...taskOut(t) };
    }
    case 'get_program': return progOut(await st.get('program')) || { program: null, note: 'No program yet; create one with set_program.' };
    case 'set_program': {
      if (!Array.isArray(a.days) || !a.days.length) throw new UserError('days is empty');
      const old = await st.get('program'), oldIds = new Map((old?.days || []).map((d: any) => [String(d.name).toLowerCase(), d.id]));
      const days = a.days.slice(0, 14).map((d: any, i: number) => {
        const nm = str(d.name, 60) || `День ${i + 1}`;
        if (d.weekday != null && !(d.weekday in WD)) throw new UserError('weekday must be mon..sun');
        const ex = (d.exercises || []).slice(0, 30).map((e: any) => ({ n: str(e.name, 80), c: str(e.comment, 1000) })).filter((e: any) => e.n);
        if (!ex.length) throw new UserError(`day "${nm}" has no exercises`);
        return { id: oldIds.get(nm.toLowerCase()) || uid(), name: nm, wd: d.weekday == null ? null : WD[d.weekday], ex };
      });
      let targets = old?.targets ?? null;
      if (a.weekly_sets && typeof a.weekly_sets === 'object') {
        targets = {};
        for (const [g, v] of Object.entries(a.weekly_sets) as any) if (Array.isArray(v) && v.length === 2 && v.every((x: any) => x >= 0 && x < 100)) targets[str(g, 40)] = [+v[0], +v[1]];
      }
      const rules = Array.isArray(a.rules) ? a.rules.slice(0, 30).map((r: any) => ({ t: str(r.title, 120), d: str(r.text, 2000) })).filter((r: any) => r.t) : (old?.rules || []);
      const P = { name: str(a.name, 80) || old?.name || 'Моя программа', days, rules, targets };
      st.set('program', P); await st.flush();
      return { saved: true, program: progOut(P) };
    }
    case 'get_workouts': {
      const from = isoDate(a.from, 'from'), to = isoDate(a.to, 'to');
      if (to < from || to > addDays(from, 120)) throw new UserError('range must be 0–120 days');
      const r = await st.range('workouts', from, to), out: Record<string, any> = {};
      for (const [d, list] of Object.entries(r) as any) {
        if (!list?.length) continue;
        out[d] = list.map((e: any) => ({
          exercise: e.name,
          sets: (e.sets || []).filter((s: any) => s.w !== '' || s.r !== '').map((s: any) => `${s.warm ? 'warm-up ' : ''}${s.w || 0}×${s.r || 0}${s.done ? '' : ' (not done)'}`).join(', '),
          ...(e.note ? { note: e.note } : {}),
        }));
      }
      return out;
    }
    case 'add_habit': {
      const n = str(a.name, 80); if (!n) throw new UserError('name is empty');
      const h = { id: uid(), name: n };
      st.set('habits', [...((await st.get('habits')) || []), h]); await st.flush();
      return h;
    }
    case 'delete_habit': {
      const list = (await st.get('habits')) || [];
      if (!list.some((h: any) => h.id === a.id)) throw new UserError('no such habit');
      st.set('habits', list.filter((h: any) => h.id !== a.id)); await st.flush();
      return { deleted: a.id };
    }
    case 'add_goal': {
      const title = str(a.title, 200); if (!title) throw new UserError('title is empty');
      if (!['year', 'month', 'week'].includes(a.level)) throw new UserError('level must be year, month or week');
      const list = (await st.get('goals')) || [];
      if (a.parent_id && !list.some((g: any) => g.id === a.parent_id)) throw new UserError('no such parent goal');
      const g = { id: uid(), title, level: a.level, parent: a.parent_id || '', done: false };
      st.set('goals', [...list, g]); await st.flush();
      return { id: g.id, title, level: g.level };
    }
    case 'log_weight': {
      const date = isoDate(a.date), kg = Math.round(+a.kg * 10) / 10;
      if (!(kg >= 20 && kg <= 400)) throw new UserError('kg must be 20–400');
      await st.setDay('weight', date, kg); await st.flush();
      return { date, kg };
    }
  }
  throw new UserError('unknown tool ' + name);
}

// ---------- MCP over streamable HTTP (stateless, JSON responses) ----------
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function rpc(m: any, uidOf: () => Promise<string | null>) {
  const id = m?.id ?? null, ok = (result: any) => ({ jsonrpc: '2.0', id, result }), err = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return err(-32600, 'invalid request');
  if (m.id === undefined || m.method.startsWith('notifications/')) return null; // notification
  switch (m.method) {
    case 'initialize': {
      const v = m.params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOLS.includes(v) ? v : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'apex-planner', version: '1.0.0' },
        instructions: 'Apex planner (tasks/reminders, training program, habits, goals, body weight). The user writes in Russian; keep titles and exercise names in Russian. Call planner_overview with the user\'s local date first. Times are 24h HH:MM.',
      });
    }
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call': {
      const user = await uidOf();
      if (!user) return ok({ isError: true, content: [{ type: 'text', text: 'The connector key is not valid. Make a new link in Apex → Settings → Claude.' }] });
      try {
        const out = await callTool(m.params?.name, m.params?.arguments, new Store(user));
        return ok({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out && !Array.isArray(out) ? out : { result: out } });
      } catch (e) {
        if (e instanceof UserError) return ok({ isError: true, content: [{ type: 'text', text: e.message }] });
        console.error(e);
        return ok({ isError: true, content: [{ type: 'text', text: 'Server error: ' + (e as Error).message }] });
      }
    }
  }
  return err(-32601, 'method not found: ' + m.method);
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Apex planner MCP server. Add this URL as a custom connector in claude.ai.', { status: req.method === 'GET' ? 405 : 405, headers: { ...CORS, Allow: 'POST' } });
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let user: Promise<string | null> | null = null;
  const uidOf = () => (user ||= userFor(key).catch(e => { console.error(e); return null; }));
  let body: any;
  try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }, 400); }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => rpc(m, uidOf)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await rpc(body, uidOf);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
}

(globalThis as any).Deno?.serve(handle);
