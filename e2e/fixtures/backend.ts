import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test as base, expect, type BrowserContext, type Route, type WebSocketRoute } from '@playwright/test';

export const SPACE_ID = '11111111-1111-4111-8111-111111111111';
export const USER_ID = '22222222-2222-4222-8222-222222222222';
export const MEMORY_IDS = ['33333333-3333-4333-8333-333333333331', '33333333-3333-4333-8333-333333333332', '33333333-3333-4333-8333-333333333333'];
const origin = 'https://ustogether-test.invalid';
const appOrigin = 'http://127.0.0.1:4173';
export const photoPath = resolve('e2e/fixtures/photo.png');
const png = readFileSync(photoPath);
const jpg = readFileSync(resolve('e2e/fixtures/photo.jpg'));
type RecordValue = Record<string, unknown>;
type MemoryRow = {
  id: string; space_id: string; created_by: string; title: string; memory_date: string;
  caption: string | null; milestone_tag: string | null; image_path: string;
  image_mime_type: string; created_at: string;
};
type LoggedRequest = { method: string; path: string; body: RecordValue | null; bytes: Buffer | null };
type CapturedUpload = { path: string; name: string; type: string; size: number; sha256: string };
type Failure = { status: number; message: string; code?: string };
type Binding = { id: number; event: string; schema: string; table: string; filter?: string };
type Socket = { socket: WebSocketRoute; topic: string; joinRef: string | null; bindings: Binding[] };

const user = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: 'Fixture Friend' },
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z'
};
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: USER_ID, role: 'authenticated', exp: 4102444800 })}.synthetic-signature`;
const session = { access_token: token, refresh_token: 'synthetic-refresh-token', expires_in: 3600,
  expires_at: 4102444800, token_type: 'bearer', user };

export class FixtureBackend {
  space = { id: SPACE_ID, name: 'Our fixture adventures', kind: 'couple', theme_key: 'rose', created_at: '2026-01-01T00:00:00Z' };
  memories: MemoryRow[] = MEMORY_IDS.map((id, index) => ({
    id, space_id: SPACE_ID, created_by: USER_ID, title: ['Sunrise together', 'Blue hour walk', 'Sunday picnic'][index],
    memory_date: ['2026-01-02', '2026-01-02', '2026-02-14'][index],
    caption: ['A quiet beginning by the sea.', 'We stayed until the lights came on.', 'The little things matter.'][index],
    milestone_tag: index === 0 ? 'First adventure' : null, image_path: `${SPACE_ID}/${id}.${index === 1 ? 'png' : 'jpg'}`,
    image_mime_type: index === 1 ? 'image/png' : 'image/jpeg', created_at: `2026-01-02T0${index + 1}:00:00Z`
  }));
  requests: LoggedRequest[] = [];
  uploads: CapturedUpload[] = [];
  unhandled: string[] = [];
  memberCount = 2;
  hasMembership = true;
  authRejected = false;
  signupRequiresConfirmation = true;
  themeResponseOverride: string | null = null;
  private failures = new Map<string, Failure[]>();
  private persistentFailures = new Map<string, Failure>();
  private holds = new Map<string, Promise<void>[]>();
  private sockets: Socket[] = [];
  private objects = new Map<string, Buffer>();

  constructor() { for (const memory of this.memories) this.objects.set(memory.image_path, memory.image_mime_type === 'image/png' ? png : jpg); }

  count(method: string, path: string) { return this.requests.filter((request) => request.method === method && request.path === path).length; }
  failNext(method: string, path: string, failure: Failure) {
    const key = `${method} ${path}`;
    this.failures.set(key, [...(this.failures.get(key) ?? []), failure]);
  }
  failWhile(method: string, path: string, failure: Failure) {
    const key = `${method} ${path}`;
    this.persistentFailures.set(key, failure);
    return () => { this.persistentFailures.delete(key); };
  }
  holdNext(method: string, path: string) {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => { release = resolve; });
    const key = `${method} ${path}`;
    this.holds.set(key, [...(this.holds.get(key) ?? []), promise]);
    return release;
  }
  get subscribed() { return this.sockets.length; }
  emit(table: string, type = 'UPDATE', record: RecordValue = this.space) {
    for (const item of this.sockets) {
      const ids = item.bindings.filter((binding) => binding.table === table).map((binding) => binding.id);
      if (!ids.length) continue;
      item.socket.send(JSON.stringify([item.joinRef, null, item.topic, 'postgres_changes', {
        ids, data: { schema: 'public', table, type, commit_timestamp: '2026-10-09T12:00:00Z',
          columns: [], record, old_record: type === 'DELETE' ? record : {}, errors: null }
      }]));
    }
  }

  async install(context: BrowserContext, signedIn: boolean) {
    if (signedIn) await context.addInitScript(({ key, value, appOrigin }) => {
      if (location.origin === appOrigin && !localStorage.getItem(key)) localStorage.setItem(key, value);
    }, { key: 'sb-ustogether-test-auth-token', value: JSON.stringify(session), appOrigin });

    // Chromium's interception API omits file-backed multipart bytes. Observe
    // the unchanged browser fetch input instead; requests still go through the
    // isolated HTTP fixture, and production contains no testing hooks.
    await context.exposeBinding('__fixtureCaptureUpload', (_source, value: CapturedUpload) => { this.uploads.push(value); });
    await context.addInitScript(({ backendOrigin }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
        if (url.origin === backendOrigin && url.pathname.startsWith('/storage/v1/object/memory-images/') && init?.body instanceof FormData) {
          for (const value of init.body.values()) {
            if (!(value instanceof File)) continue;
            const bytes = await value.arrayBuffer();
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            await (window as unknown as { __fixtureCaptureUpload: (value: CapturedUpload) => Promise<void> }).__fixtureCaptureUpload({
              path: url.pathname, name: value.name, type: value.type, size: value.size,
              sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
            });
          }
        }
        return originalFetch(input, init);
      };
    }, { backendOrigin: origin });

    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === appOrigin) { await route.continue(); return; }
      if (url.origin !== origin) {
        this.unhandled.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      await this.handle(route, url);
    });
    await context.routeWebSocket('**/*', (socket) => {
      const url = new URL(socket.url());
      if (url.origin !== 'wss://ustogether-test.invalid' || url.pathname !== '/realtime/v1/websocket') {
        this.unhandled.push(`WS ${url.origin}${url.pathname}`);
        void socket.close({ code: 1008, reason: 'Outside isolated fixture' });
        return;
      }
      socket.onMessage((message) => {
        const [joinRef, ref, topic, event, payload] = JSON.parse(String(message)) as [string | null, string, string, string, { config?: { postgres_changes?: Omit<Binding, 'id'>[] } }];
        if (event === 'phx_join') {
          const bindings = (payload.config?.postgres_changes ?? []).map((binding, index) => ({ ...binding, id: index + 1 }));
          this.sockets.push({ socket, topic, joinRef, bindings });
          socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: bindings } }]));
        } else if (event === 'heartbeat' || event === 'phx_leave') {
          if (event === 'phx_leave') this.sockets = this.sockets.filter((item) => item.topic !== topic);
          socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
        }
      });
      socket.onClose(() => { this.sockets = this.sockets.filter((item) => item.socket !== socket); });
    });
  }

  private async handle(route: Route, url: URL) {
    const request = route.request();
    const method = request.method();
    let body: RecordValue | null = null;
    if (request.postData() !== null && request.headers()['content-type']?.includes('application/json')) {
      body = request.postDataJSON() as RecordValue;
    }
    this.requests.push({ method, path: url.pathname, body, bytes: request.postDataBuffer() });
    const key = `${method} ${url.pathname}`;
    const holdKey = this.holds.has(key) ? key : [...this.holds.keys()].find((candidate) => candidate.endsWith('/') && key.startsWith(candidate));
    const hold = holdKey ? this.holds.get(holdKey)?.shift() : undefined;
    if (hold) await hold;
    const failureKey = this.failures.has(key) ? key : [...this.failures.keys()].find((candidate) => candidate.endsWith('/') && key.startsWith(candidate));
    const persistentKey = this.persistentFailures.has(key) ? key : [...this.persistentFailures.keys()].find((candidate) => candidate.endsWith('/') && key.startsWith(candidate));
    const failure = (failureKey ? this.failures.get(failureKey)?.shift() : undefined)
      ?? (persistentKey ? this.persistentFailures.get(persistentKey) : undefined);
    if (failure) {
      // PostgREST retries transient GET failures. A sustained fixture outage
      // survives those retries; zero Retry-After keeps verification deterministic.
      await route.fulfill({ status: failure.status, headers: failure.status === 503
        ? { 'retry-after': '0', 'access-control-expose-headers': 'retry-after' } : undefined,
        json: { message: failure.message, code: failure.code ?? 'fixture_failure', error: failure.message } });
      return;
    }
    if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); return; }
    const json = async (value: unknown, status = 200, headers: Record<string, string> = {}) => route.fulfill({ status, json: value, headers });
    const denied = () => json({ message: 'This fixture row is unavailable', code: 'PGRST116' }, 406);

    if (url.pathname === '/auth/v1/token' && method === 'POST') {
      await json(this.authRejected ? { msg: 'Invalid login credentials', error_description: 'Invalid login credentials', code: 'invalid_credentials' } : session, this.authRejected ? 400 : 200); return;
    }
    if (url.pathname === '/auth/v1/signup' && method === 'POST') { await json(this.signupRequiresConfirmation ? { user } : session); return; }
    if (url.pathname === '/auth/v1/user') { await json(user); return; }
    if (url.pathname === '/auth/v1/logout') { await route.fulfill({ status: 204 }); return; }
    if (url.pathname === '/rest/v1/space_members') {
      if (method === 'HEAD') { await route.fulfill({ status: 200, headers: { 'content-range': `0-${this.memberCount - 1}/${this.memberCount}`, 'access-control-expose-headers': 'content-range' } }); return; }
      await json(this.hasMembership ? Array.from({ length: this.memberCount }, (_, index) => ({ space_id: SPACE_ID, user_id: index ? '44444444-4444-4444-8444-444444444444' : USER_ID })) : []); return;
    }
    if (url.pathname === '/rest/v1/spaces') {
      if (method === 'PATCH') {
        const selected = String(body?.theme_key);
        this.space.theme_key = this.themeResponseOverride ?? selected;
        await json(this.space); return;
      }
      if (!this.hasMembership || (url.searchParams.get('id') && url.searchParams.get('id') !== `eq.${SPACE_ID}`)) { await denied(); return; }
      await json(request.headers().accept?.includes('vnd.pgrst.object') ? this.space : [this.space]); return;
    }
    if (url.pathname === '/rest/v1/memories') {
      if (method === 'POST') {
        const row = { ...body, created_at: '2026-10-09T12:00:00Z' } as MemoryRow;
        this.memories.push(row);
        await json(row, 201); return;
      }
      if (method === 'PATCH') {
        const row = this.memories.find((memory) => `eq.${memory.id}` === url.searchParams.get('id'));
        if (!row) { await denied(); return; }
        Object.assign(row, body);
        await json(null); return;
      }
      const single = request.headers().accept?.includes('vnd.pgrst.object');
      const rows = this.memories.filter((memory) => !url.searchParams.get('id') || `eq.${memory.id}` === url.searchParams.get('id'));
      if (single && !rows.length) { await denied(); return; }
      await json(single ? rows[0] : [...rows].sort((a, b) => a.memory_date.localeCompare(b.memory_date) || a.created_at.localeCompare(b.created_at))); return;
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').at(-1);
      if (rpc === 'accept_space_invite' || rpc === 'create_space') { await json(SPACE_ID); return; }
      if (rpc === 'create_space_invite') { await json([{ invite_token: 'synthetic-invite-token', expires_at: '2026-10-16T12:00:00Z' }]); return; }
      if (rpc === 'leave_space') { this.hasMembership = false; await json(null); return; }
    }
    if (url.pathname === '/rest/v1/comments' || url.pathname === '/rest/v1/reactions' || url.pathname === '/rest/v1/profiles') { await json([]); return; }
    if (url.pathname.startsWith('/storage/v1/object/sign/memory-images')) {
      if (method === 'POST') {
        const prefix = '/storage/v1/object/sign/memory-images/';
        const paths = Array.isArray(body?.paths) ? body.paths.map(String) : [decodeURIComponent(url.pathname.slice(prefix.length))];
        if (Array.isArray(body?.paths)) await json(paths.map((path) => ({ path, error: null, signedURL: `/object/sign/memory-images/${path}?token=synthetic` })));
        else await json({ signedURL: `/object/sign/memory-images/${paths[0]}?token=synthetic` });
        return;
      }
      const path = decodeURIComponent(url.pathname.slice('/storage/v1/object/sign/memory-images/'.length));
      await route.fulfill({ status: 200, body: this.objects.get(path) ?? png, contentType: path.endsWith('.png') ? 'image/png' : 'image/jpeg' }); return;
    }
    if (url.pathname.startsWith('/storage/v1/object/memory-images')) {
      const path = decodeURIComponent(url.pathname.slice('/storage/v1/object/memory-images/'.length));
      if (method === 'POST' || method === 'PUT') {
        const bytes = request.postDataBuffer() ?? png;
        // Chromium omits multipart file bytes from interception. The separate
        // fetch observation proves the selected File's bytes; store a real image
        // so a successful return/reload also exercises preview rendering.
        this.objects.set(path, this.uploads.some((upload) => upload.path === url.pathname) ? png : bytes.includes(png) ? png : bytes.includes(jpg) ? jpg : bytes);
        await json({ Key: `memory-images/${path}` }); return;
      }
      if (method === 'DELETE') { for (const name of body?.prefixes as string[] ?? []) this.objects.delete(name); await json([]); return; }
    }
    this.unhandled.push(key);
    await json({ message: `Unhandled isolated fixture request: ${key}` }, 501);
  }
}

export const test = base.extend<{ backend: FixtureBackend; signedIn: boolean }>({
  signedIn: [true, { option: true }],
  backend: [async ({ context, signedIn }, use) => {
    const backend = new FixtureBackend();
    await backend.install(context, signedIn);
    await use(backend);
    expect(backend.unhandled, 'All traffic must stay inside the isolated fixture').toEqual([]);
  }, { auto: true }]
});
export { expect };
