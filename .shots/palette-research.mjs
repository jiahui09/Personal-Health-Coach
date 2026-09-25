// 色组研究：候选色对 纸/面/白/墨 的对比度体检（WCAG 2.1）
import { writeFileSync } from 'node:fs';

const paper = '#f4f0e8';
const surface = '#fffdf8';
const ink = '#16120e';

const channel = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = (hex) => {
  const r = channel(parseInt(hex.slice(1, 3), 16) / 255);
  const g = channel(parseInt(hex.slice(3, 5), 16) / 255);
  const b = channel(parseInt(hex.slice(5, 7), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};
const hex2 = (n) => n.toString(16).padStart(2, '0');
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  return `#${hex2(Math.round(ar + (br - ar) * t))}${hex2(Math.round(ag + (bg - ag) * t))}${hex2(
    Math.round(ab + (bb - ab) * t)
  )}`;
};

const cands = {
  // accent 候选
  accent: {
    'A 松烟绿(现状) #147a3a': '#147a3a',
    'A2 深松绿 #0f6b34': '#0f6b34',
    'B 石绿 #2f7d5f': '#2f7d5f',
    'B2 青竹绿 #357a5c': '#357a5c',
    'C 艾绿(灰绿) #4a7c59': '#4a7c59',
    'C2 草木绿 #557a52': '#557a52',
    'D 花青 #1d5c8a': '#1d5c8a',
    'D2 靛蓝 #1f4e79': '#1f4e79',
    'D3 苔青蓝 #2b5f76': '#2b5f76',
    'E 赭石 #8a5a12': '#8a5a12',
    'E2 藤黄深 #96601a': '#96601a',
    'F 朱红(双色方案) #a63a2b': '#a63a2b',
  },
  tier2: {
    't 赭石(现状) #a54d08': '#a54d08',
    't 深赭 #8a5a12': '#8a5a12',
    't 藤黄 #8a6508': '#8a6508',
    't 秋香褐 #7d6212': '#7d6212',
    't 花青 #1d5c8a': '#1d5c8a',
    't 赭红 #94400e': '#94400e',
    't 褐 #7a5a2e': '#7a5a2e',
    't 靛 #26597f': '#26597f',
  },
  danger: {
    'd 危险(现状) #b91c1c': '#b91c1c',
    'd 绛 #a3231f': '#a3231f',
    'd 深绛 #991b1b': '#991b1b',
    'd 栗 #8c1d18': '#8c1d1d'.slice(0, 7),
    'd 紫檀绛 #7f1d1d': '#7f1d1d',
    'd 朱深(压印) #9b2c1c': '#9b2c1c',
  },
  bright: {
    'b #4ade80(现状)': '#4ade80',
    'b #86efac': '#86efac',
    'b #a7f3d0': '#a7f3d0',
    'b #7dd3fc': '#7dd3fc',
    'b #93c5fd': '#93c5fd',
    'b #fcd34d': '#fcd34d',
    'b #f0abfc': '#f0abfc',
    'b #fda4af': '#fda4af',
  },
  control: {
    'c #8f8574(现状)': '#8f8574',
    'c #877c69': '#877c69',
    'c #7f7565': '#7f7565',
  },
};

const rows = [];
for (const [group, map] of Object.entries(cands)) {
  rows.push(`\n### ${group}`);
  for (const [name, hex] of Object.entries(map)) {
    const onPaper = cr(hex, paper);
    const onSurface = cr(hex, surface);
    const whiteOn = cr('#ffffff', hex);
    const onInk = cr(hex, ink);
    const flags = [];
    if (onPaper >= 4.5 && onSurface >= 4.5) flags.push('AA-text✓');
    else flags.push(`AA-text✗(${onPaper.toFixed(2)})`);
    if (whiteOn >= 4.5) flags.push('白字✓');
    if (onInk >= 4.5) flags.push('压墨✓');
    else if (onInk >= 3) flags.push('压墨3:1✓');
    rows.push(
      `${name.padEnd(30)} 纸 ${onPaper.toFixed(2).padStart(5)} | 面 ${onSurface.toFixed(
        2
      ).padStart(5)} | 白压色 ${whiteOn.toFixed(2).padStart(5)} | 色压墨 ${onInk
        .toFixed(2)
        .padStart(5)}  ${flags.join(' ')}`
    );
  }
}

// 派生浅色调（在纸上按比例混入）
rows.push('\n### 浅色调派生（accent 与纸 mix t）');
for (const [name, hex] of Object.entries(cands.accent)) {
  rows.push(
    `${name.padEnd(30)} soft(6%) ${mix(paper, hex, 0.06)} | line(14%) ${mix(paper, hex, 0.14)} | 纸上正文 ${cr(
      hex,
      paper
    ).toFixed(2)}`
  );
}

const out = rows.join('\n');
writeFileSync(new URL('./palette-contrast.txt', import.meta.url), out);
console.log(out);
