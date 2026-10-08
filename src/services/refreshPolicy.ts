/**
 * refreshPolicy — 何时该自动重取云端数据（多端同步的时效规则）
 *
 * 页面可见（切回标签页 / 窗口重获焦点）时重取一次，让另一台设备的改动不用手动刷新；
 * 但绝不打扰正在录入的当下：弹层开着、写入未落定、或距上次重取太近都直接作罢。
 *
 * 纯函数、显式传入 now —— 既避开展示层「不得自行读时钟」的契约，也便于单测。
 */

/** 两次自动重取之间的最小间隔：切来切去不打成轮询。 */
export const REFRESH_MIN_INTERVAL_MS = 15_000;

export interface RefreshInput {
  /** 当前毫秒时间戳（由调用方给出）。 */
  now: number;
  /** 上一次成功重取的毫秒时间戳；从未重取过传 0。 */
  lastAt: number;
  /** 页面是否可见（document.visibilityState === 'visible'）。 */
  visible: boolean;
  /** 是否有不可打断的事在进行：弹层开着、写入未落定、首屏仍在载入。 */
  blocked: boolean;
  /** 覆盖默认最小间隔（测试用）。 */
  minIntervalMs?: number;
}

export function shouldAutoRefresh(input: RefreshInput): boolean {
  if (!input.visible) return false;
  if (input.blocked) return false;
  const min = input.minIntervalMs ?? REFRESH_MIN_INTERVAL_MS;
  return input.now - input.lastAt >= min;
}
