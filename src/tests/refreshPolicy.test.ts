/**
 * 聚焦自动重取（多端同步时效）的判定契约
 *
 * 锁定四件事：
 *   1. 页面不可见 → 绝不重取（后台标签页不打请求）；
 *   2. 有不可打断的事（弹层开着 / 写入未落定 / 首屏载入）→ 不重取；
 *   3. 15 秒节流：切来切去不打成轮询；
 *   4. 可见 + 无阻塞 + 越过节流 → 重取。
 */

import { shouldAutoRefresh, REFRESH_MIN_INTERVAL_MS } from '../services/refreshPolicy';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

let checks = 0;
const ok = (message: string): void => {
  checks += 1;
  console.log(`   ✓ ${message}`);
};

const base = { now: 100_000, lastAt: 0, visible: true, blocked: false };

assert(REFRESH_MIN_INTERVAL_MS === 15_000, '默认节流 = 15 秒');
assert(shouldAutoRefresh(base) === true, '可见 + 不忙 + 从未重取 → 重取');
assert(shouldAutoRefresh({ ...base, visible: false }) === false, '页面不可见 → 不重取');
assert(shouldAutoRefresh({ ...base, blocked: true }) === false, '弹层/写入中 → 不重取');
assert(
  shouldAutoRefresh({ ...base, lastAt: 95_000 }) === false,
  '距上次不足 15 秒 → 节流'
);
assert(
  shouldAutoRefresh({ ...base, lastAt: 85_000 }) === true,
  '越过 15 秒 → 放行'
);
assert(
  shouldAutoRefresh({ ...base, lastAt: 85_000, minIntervalMs: 0 }) === true,
  '可覆盖最小间隔（测试与将来调参用）'
);
assert(
  shouldAutoRefresh({ ...base, visible: false, blocked: false, lastAt: 0 }) === false,
  '不可见即使从未重取也不打'
);
ok('自动重取：可见、空闲、越节流三个条件缺一不可');

console.log(`ALL REFRESH POLICY TESTS PASSED. (${checks} checks)`);
