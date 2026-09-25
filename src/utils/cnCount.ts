// 中文小数计数(零…十),刊头「凡四事,已成其一」与朱批旁注共用。
const CN_SMALL = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export const cnCount = (n: number): string => (n >= 0 && n <= 10 ? CN_SMALL[n] : String(n));
