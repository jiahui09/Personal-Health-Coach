/**
 * Supabase PostgREST 客户端（零依赖,纯 fetch）
 *
 * 为什么不用 @supabase/supabase-js：
 *   - 本项目只需要「按手记名取行 + PostgREST 增删改查」两件事，官方客户端带来的
 *     体积与依赖维护成本大于收益；
 *   - 云端构建（Cloudflare Pages）目前以 `npm ci` 安装，任何新增依赖都必须同步锁文件,
 *     零依赖可以让部署保持确定性。
 *
 * 归属方式：账号只是标记,不是防线——手记名确定性地派生 user_id,各表行按它分数据。
 * 没有 GoTrue、没有密码与邮件验证、没有会话与令牌刷新；请求头一律 apikey + Bearer
 * （均为公开 anon key）。同名即同库,隔离只到「标记」这一层,见 docs/deploy.md §2。
 */

import { displayName, markerUserId } from './accountMarker';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/** 手记身份：手记名派生的归属标记（与各表 user_id 同源），存本机 localStorage。 */
export interface SupabaseAccount {
  userId: string;
  name: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SupabaseErrorKind =
  | 'auth'
  | 'network'
  | 'conflict'
  | 'not_found'
  | 'rate_limited'
  /** 服务端能力未开启 */
  | 'not_implemented'
  /** 云库结构落后于代码：缺列 / 旧外键——重跑 supabase/schema.sql 全文 */
  | 'schema'
  | 'unknown';

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

const ACCOUNT_KEY = 'phc_account_v1';

/** PostgREST 过滤片段，值一律由调用方给出常量（不接受用户输入拼接）。 */
export type Query = string;

function mapStatus(status: number, body: string): SupabaseError {
  if (status === 401 || status === 403) return new SupabaseError('auth', `未获授权（${status}）：检查 RLS 策略与 anon key`, status);
  if (status === 404) return new SupabaseError('not_found', `记录不存在（404）`, status);
  if (status === 429 || /rate limit|too many requests/i.test(body)) {
    return new SupabaseError('rate_limited', `请求过于频繁（${status}）：稍后重试`, status);
  }
  // 云库结构落后于代码：旧外键（409+23503）或缺列（400/409+PGRST204 等）。
  // 与「记录已存在」的冲突完全两回事,对症处置是重跑 supabase/schema.sql 全文。
  if (/foreign key|23503|does not exist|PGRST204|42703/i.test(body)) {
    return new SupabaseError('schema', `云库结构未更新（${status}）：SQL Editor 全文重跑 supabase/schema.sql 后重试`, status);
  }
  if (status === 409 || /duplicate key|unique constraint/i.test(body)) {
    return new SupabaseError('conflict', `冲突：记录已存在（${status}）`, status);
  }
  return new SupabaseError('unknown', `请求失败（${status}）：${body.slice(0, 200)}`, status);
}

export interface SupabaseRestOptions {
  fetchImpl?: typeof fetch;
  storage?: StorageLike;
}

export class SupabaseRest {
  private readonly config: SupabaseConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: StorageLike | null;
  private account: SupabaseAccount | null = null;
  private listeners = new Set<(account: SupabaseAccount | null) => void>();

  constructor(config: SupabaseConfig, options: SupabaseRestOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.storage = options.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
    this.account = this.readStoredAccount();
  }

  // ---------------- 手记身份（本机标记,无服务端会话） ----------------

  private readStoredAccount(): SupabaseAccount | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(ACCOUNT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SupabaseAccount;
      return parsed.userId ? parsed : null;
    } catch {
      return null;
    }
  }

  /** 打开手记：手记名 → 归属标记,落盘本机并通知订阅者（不联网、不验证）。 */
  enterByName(rawName: string): SupabaseAccount {
    const account: SupabaseAccount = { userId: markerUserId(rawName), name: displayName(rawName) };
    this.account = account;
    if (this.storage) {
      try {
        this.storage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      } catch {
        // 存储不可用（隐私模式）时仅保留内存身份
      }
    }
    for (const listener of this.listeners) listener(account);
    return account;
  }

  /** 退出：只清本机标记,云端数据不动。 */
  signOut(): void {
    this.account = null;
    if (this.storage) {
      try {
        this.storage.removeItem(ACCOUNT_KEY);
      } catch {
        // 存储不可用时无须处理：本机已无从读到标记
      }
    }
    for (const listener of this.listeners) listener(null);
  }

  getAccount(): SupabaseAccount | null {
    return this.account;
  }

  hasAccount(): boolean {
    return this.account !== null;
  }

  onAccountChange(listener: (account: SupabaseAccount | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 请求头：apikey + Bearer（均为公开 anon key;数据不设防,归属靠行上的 user_id 标记）。 */
  private headers(): Record<string, string> {
    return {
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.anonKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async request(
    path: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<Response> {
    const { method = 'GET', body, headers = {} } = init;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.url}${path}`, {
        method,
        headers: { ...this.headers(), ...headers },
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

  // （GoTrue 认证段已随「账号只作标记」删除：无 magic link、无密码、无令牌刷新。）

  // ---------------- 数据（PostgREST） ----------------

  private async dataRequest<T>(
    path: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    if (!this.account) throw new SupabaseError('auth', '尚未打开手记（无归属标记）');
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

  /** 批量插入（数组体）：合并本机记录时一次写入,少往返；空数组不发请求。 */
  insertMany<T>(table: string, rows: Record<string, unknown>[]): Promise<T[]> {
    if (rows.length === 0) return Promise.resolve([]);
    return this.rowsRequest<T>(`/rest/v1/${table}`, {
      method: 'POST',
      body: rows,
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
