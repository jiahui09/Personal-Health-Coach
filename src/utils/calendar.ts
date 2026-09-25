/**
 * 日期表述层（Presentation）
 *
 * 干支、农历月日、星期都是「公历时刻 → 文本」的展示换算；
 * 业务逻辑一律只认 domain/time.ts 的本地日键，绝不依赖这里的文字。
 */

const CN_NUMERALS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const WEEKDAYS_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** Day of month, classical notation: 初一 / 十五 / 廿五 / 三十 */
export function cnDayLabel(day: number): string {
  if (day < 10) return `初${CN_NUMERALS[day]}`;
  if (day === 10) return '初十';
  if (day < 20) return `十${CN_NUMERALS[day - 10]}`;
  if (day === 20) return '二十';
  if (day < 30) return `廿${CN_NUMERALS[day - 20]}`;
  if (day === 30) return '三十';
  return '三十一';
}

/** Month number, classical notation: 一月 … 十二月 */
export function cnMonthLabel(month: number): string {
  if (month < 10) return `${CN_NUMERALS[month]}月`;
  if (month === 10) return '十月';
  return `十${CN_NUMERALS[month - 10]}月`;
}

/** Sexagenary year stem-branch (1984 = 甲子, 2026 = 丙午). */
export function ganzhiYear(year: number): string {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  return `${stems[(year - 4) % 10]}${branches[(year - 4) % 12]}`;
}

/** "丙午年 · 九月廿五 · 星期五" */
export function formatDisplayDate(d: Date): string {
  return `${ganzhiYear(d.getFullYear())}年 · ${cnMonthLabel(d.getMonth() + 1)}${cnDayLabel(
    d.getDate()
  )} · ${WEEKDAYS_CN[d.getDay()]}`;
}

/** 时段问候：朝安 / 昼安 / 夜安。 */
export function timeGreetingOf(hour: number): string {
  if (hour >= 11 && hour < 18) return '昼安。';
  if (hour >= 18 || hour < 5) return '夜安。';
  return '朝安。';
}

/** 当前时刻 "HH:MM"（注入时钟，不在各处各自 new Date()）。 */
export function clockTimeOf(now: Date): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
