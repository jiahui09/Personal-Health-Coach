/**
 * Supabase REST/Auth 客户端（零依赖,纯 fetch）
 *
 * 为什么不用 @supabase/supabase-js：
 *   - 本项目只需要「邮箱 magic link + PostgREST 增删改查」两件事，官方客户端带来的
 *     体积与依赖维护成本大于收益；
 *   - 云端构建（Cloudflare Pages）目前以 `npm ci` 安装，任何新增依赖都必须同步锁文件,
 *     零依赖可以让部署保持确定性。
 *
 * 安全边界：anon key 是公开键,真正的隔离在数据库 RLS（auth.uid() = user_id）。
 * 会话保存在 localStorage,过期前自动刷新；所有请求都带 Bearer access_token。
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  /** 毫秒时间戳 */
  expiresAt: number;
  userId: string;
  email: string | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SupabaseErrorKind = 'auth' | 'network' | 'conflict' | 'not_found' | 'unknown';

export class SupabaseError extends Error {
  readonly kind: SupabaseErrorKind;
  readonly status?: number;

  constructor(kind: SupabaseErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'SupabaseError';
    this.kind = kind;
    this.status = status;
  }
}

const SESSION_KEY = 'phc_supabase_session_v1';
const REFRESH_MARGIN_MS = 60_000;

/** PostgREST 过滤片段，值一律由调用方给出常量（不接受用户输入拼接）。 */
export type Query = string;

function mapStatus(status: number, body: string): SupabaseError {
  if (status === 401 || status === 403) return new SupabaseError('auth', `未登录或会话过期（${status}）`, status);
  if (status === 404) return new SupabaseError('not_found', `记录不存在（404）`, status);
  if (status === 409 || /duplicate key|unique constraint/i.test(body)) {
    return new SupabaseError('conflict', `冲突：记录已存在（${status}）`, status);
  }
  return new SupabaseError('unknown', `请求失败（${status}）：${body.slice(0, 200)}`, status);
}

export interface SupabaseRestOptions {
  fetchImpl?: typeof fetch;
  storage?: StorageLike;
  /** 注入时钟,便于测试会话过期逻辑。 */
  now?: () => number;
}

export class SupabaseRest {
  private readonly config: SupabaseConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: StorageLike | null;
  private readonly now: () => number;
  private session: SupabaseSession | null = null;
  private listeners = new Set<(session: SupabaseSession | null) => void>();

  constructor(config: SupabaseConfig, options: SupabaseRestOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.storage = options.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
    this.now = options.now ?? (() => Date.now());
    this.session = this.readStoredSession();
  }

  // ---------------- 会话 ----------------

  private readStoredSession(): SupabaseSession | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SupabaseSession;
      return parsed.accessToken && parsed.refreshToken ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeSession(session: SupabaseSession | null): void {
    this.session = session;
    if (this.storage) {
      try {
        if (session) this.storage.setItem(SESSION_KEY, JSON.stringify(session));
        else this.storage.removeItem(SESSION_KEY);
      } catch {
        // 存储不可用（隐私模式）时仅保留内存会话
      }
    }
    for (const listener of this.listeners) listener(session);
  }

  getSession(): SupabaseSession | null {
    return this.session;
  }

  onAuthChange(listener: (session: SupabaseSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private headers(withAuth: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.config.anonKey,
      'Content-Type': 'application/json',
    };
    if (withAuth && this.session) headers.Authorization = `Bearer ${this.session.accessToken}`;
    return headers;
  }

  private async request(
    path: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string>; auth?: boolean } = {}
  ): Promise<Response> {
    const { method = 'GET', body, headers = {}, auth = true } = init;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.url}${path}`, {
        method,
        headers: { ...this.headers(auth), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new SupabaseError('network', `网络不可达：${(err as Error).message}`);
    }
    return response;
  }

  private async expectJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!response.ok) throw mapStatus(response.status, text);
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  // ---------------- 认证（magic link） ----------------

  /** 发送登录邮件；链接会跳回 redirectTo 并在 hash 里带回令牌。 */
  async sendMagicLink(email: string, redirectTo: string): Promise<void> {
    const response = await this.request('/auth/v1/otp', {
      method: 'POST',
      auth: false,
      body: { email, create_user: true, gotrue_meta_security: {}, options: { email_redirect_to: redirectTo } },
    });
    if (!response.ok) throw mapStatus(response.status, await response.text());
  }

  /** 解析 magic link 回跳地址中的 hash（隐式流）并保存会话。 */
  async completeMagicLink(hash: string): Promise<SupabaseSession | null> {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return null;
    const expiresIn = Number(params.get('expires_in') ?? '3600');
    const user = await this.fetchUser(accessToken);
    if (!user) return null;
    const session: SupabaseSession = {
      accessToken,
      refreshToken,
      expiresAt: this.now() + expiresIn * 1000,
      userId: user.id,
      email: user.email,
    };
    this.writeSession(session);
    return session;
  }

  private async fetchUser(accessToken: string): Promise<{ id: string; email: string | null } | null> {
    const response = await this.request('/auth/v1/user', {
      auth: false,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string; email?: string | null };
    return user.id ? { id: user.id, email: user.email ?? null } : null;
  }

  /** 刷新令牌；失败即视为未登录。 */
  async refresh(): Promise<SupabaseSession | null> {
    if (!this.session) return null;
    const response = await this.request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      auth: false,
      body: { refresh_token: this.session.refreshToken },
    });
    if (!response.ok) {
      this.writeSession(null);
      return null;
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user?: { id: string; email?: string | null };
    };
    const session: SupabaseSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: this.now() + data.expires_in * 1000,
      userId: data.user?.id ?? this.session.userId,
      email: data.user?.email ?? this.session.email,
    };
    this.writeSession(session);
    return session;
  }

  /** 返回可用的会话（必要时先刷新）；未登录返回 null。 */
  async ensureSession(): Promise<SupabaseSession | null> {
    if (!this.session) return null;
    if (this.session.expiresAt - this.now() > REFRESH_MARGIN_MS) return this.session;
    return this.refresh();
  }

  async getUser(): Promise<{ id: string; email: string | null } | null> {
    const session = await this.ensureSession();
    if (!session) return null;
    return { id: session.userId, email: session.email };
  }

  async signOut(): Promise<void> {
    const session = this.session;
    this.writeSession(null);
    if (!session) return;
    await this.request('/auth/v1/logout', {
      method: 'POST',
      auth: false,
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }).catch(() => undefined);
  }

  // ---------------- 数据（PostgREST） ----------------

  private async dataRequest<T>(
    path: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const session = await this.ensureSession();
    if (!session) throw new SupabaseError('auth', '尚未登录');
    const response = await this.request(path, init);
    return this.expectJson<T>(response);
  }

  /**
   * 行集合请求：PostgREST 对 GET/POST/PATCH 都返回数组,但空响应体或异常代理可能给出
   * undefined —— 这里统一收敛成数组,调用方只需处理「空数组」这一种情况,
   * 不会因为 undefined 抛 TypeError 把整页打崩。
   */
  private async rowsRequest<T>(
    path: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T[]> {
    const rows = await this.dataRequest<T[] | undefined>(path, init);
    return Array.isArray(rows) ? rows : [];
  }

  select<T>(table: string, query = ''): Promise<T[]> {
    return this.rowsRequest<T>(`/rest/v1/${table}?${query}`);
  }

  insert<T>(table: string, row: Record<string, unknown>): Promise<T[]> {
    return this.rowsRequest<T>(`/rest/v1/${table}`, {
      method: 'POST',
      body: row,
      headers: { Prefer: 'return=representation' },
    });
  }

  update<T>(table: string, query: Query, patch: Record<string, unknown>): Promise<T[]> {
    return this.rowsRequest<T>(`/rest/v1/${table}?${query}`, {
      method: 'PATCH',
      body: patch,
      headers: { Prefer: 'return=representation' },
    });
  }

  /** 主键冲突时合并（用于 profiles / daily_states 这类有主键的表）。 */
  upsert<T>(table: string, row: Record<string, unknown>, onConflict: string): Promise<T[]> {
    return this.rowsRequest<T>(`/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      body: row,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    });
  }

  async remove(table: string, query: Query): Promise<void> {
    await this.dataRequest<unknown>(`/rest/v1/${table}?${query}`, { method: 'DELETE' });
  }
}

/** 从 window.location.hash 读取 magic link 回跳令牌；读完即清掉地址栏里的令牌。 */
export function readMagicLinkHash(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hash ?? '';
}

export function clearMagicLinkHash(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}`);
}
