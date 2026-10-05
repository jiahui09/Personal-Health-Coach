// 中文小数计数(零…十),朱批旁注「已成其一」等计数句共用。
const CN_SMALL = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const cnCount = (n: number): string => (n >= 0 && n <= 10 ? CN_SMALL[n] : String(n));
