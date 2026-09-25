/**
 * 展示格式化（Presentation 的纯格式化部分）
 *
 * 只做「数字 → 字符串」，不做业务判定；组件不再自行 *60、/60 或四舍五入业务量。
 */

export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 分钟 → 小时（一位小数），用于「本周 10.8 时」。 */
export const minutesToHours = (minutes: number): number => round1(minutes / 60);

/** 分钟 → 「7h20m」式睡眠时长。 */
export function formatNightDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${h}h`;
}

/** 带符号数值（如端点变化 −12.3）。 */
export function formatSigned(value: number, digits = 1): string {
  const rounded = digits === 1 ? round1(value) : round2(value);
  const text = `${rounded > 0 ? '+' : ''}${rounded}`;
  // 统一使用排版减号 U+2212，与斜率/区间的写法一致
  return text.replace('-', '\u2212');
}

/** 取绝对值的数值表述（用于「相差 9.8 公斤」这类句式）。 */
export function formatAbs(value: number, digits = 1): number {
  const rounded = digits === 1 ? round1(value) : round2(value);
  return Math.abs(rounded);
}

/** 比例 → 整数百分比（如 0.573 → 57）。 */
export const toPercent = (ratio: number): number => Math.round(ratio * 100);
