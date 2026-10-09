/**
 * 手记名 → 数据归属标记（账号只作标记,不设防）。
 *
 * 为什么没有密码与邮件：数据本身不值钱,账号的作用只是「让不同设备认出同一份手记」。
 * 这里用手记名确定性地派生 user_id —— 同名必同 id（跨设备同库）、
 * 不联网、不用随机数、不依赖任何服务端会话；大小写与多余空白不影响同名判定。
 */

/** 显示形态：只压空白,保留用户敲的大小写。 */
export function displayName(rawName: string): string {
  return rawName.replace(/\s+/g, ' ').trim();
}

/** 归一化：压空白并小写 —— 同名判定的唯一口径。 */
export function normalizeAccountName(rawName: string): string {
  return displayName(rawName).toLowerCase();
}

/** 手记名的入场校验：null = 可以进入。 */
export function accountNameError(rawName: string): string | null {
  const name = displayName(rawName);
  if (name.length === 0) return '请先写下手记名';
  if (name.length > 32) return '手记名至多 32 字';
  return null;
}

/** FNV-1a 32 位：无安全要求,只为确定性与均匀散布（不走 crypto,免去异步与环境差异）。 */
function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 手记名 → uuid 形标记（写入各表 user_id 列）。
 * 四段 32 位混列拼成 16 字节,置上 UUIDv4 的版本位与变体位 —— 形态与真 uuid 一致,
 * 但完全可复算：换设备打开手记,算出的还是同一个标记。
 */
export function markerUserId(rawName: string): string {
  const name = normalizeAccountName(rawName);
  const hex = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => fnv1a(name, seed).toString(16).padStart(8, '0'))
    .join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}
