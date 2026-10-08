/**
 * 待办 —— 徒手动作库（离线排课的原料）
 *
 * - 本库不陈列于主页（保持页面简洁）；仅在训练规划与记录流程中作可选项提供。
 * - 进阶阶梯：同 family 按 tier 1→2→3 进阶；排课器优先安排未过恢复门的其他 family，
 *   已过门且历史命中 → 升 tier（库内无更高阶则 +1 组，上限 4 组）。
 * - estMinutes 为工程估算（含组间歇，非实测）；一切排课参数皆 engineering_heuristic，
 *   见 domain/trainingPlan.ts 与 scientificRules f_workout 的 DecisionTrace。
 * - 部位与动作取材：中国健身人群常见自重动作常识 + ACSM 渐进抗阻原则（acsm-2026）、
 *   WHO 2020 每周两日全身抗阻（who-2020）；拉力因无单杠受限（pull (limited)）。
 * - 营养/恢复同肌群 48h 间隔为工程近似（HEURISTIC_PROGRESSION_01），非临床处方。
 */

import type { BodyweightExercise } from '../types/health';

export type MovementPattern = NonNullable<BodyweightExercise['movementPattern']>;

export interface ExerciseTemplate {
  /** 动作族：进阶梯共享 family，定位「同一动作的难度阶梯」。 */
  family: string;
  /** 阶梯层级：1 基础 → 3 进阶。 */
  tier: 1 | 2 | 3;
  name: string;
  movementPattern: MovementPattern;
  /** 训练部位（展示口径）。 */
  muscleGroups: string[];
  sets: number;
  repsOrDuration: string;
  progressionNote: string;
  /** 预估用时（分钟，含组间歇；工程估算，非实测）。 */
  estMinutes: number;
  /** 复合多关节动作：预算内优先安排。 */
  compound: boolean;
  /** 心肺收尾候选（减脂课在预算余量 ≥6 分钟时追加一条）。 */
  finisher?: boolean;
}

export const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  // ---- 推（胸 / 肩前束 / 肱三） ----
  { family: 'push-up', tier: 1, name: '跪姿俯卧撑', movementPattern: 'push', muscleGroups: ['胸', '肩前束', '肱三'], sets: 2, repsOrDuration: '8 次', progressionNote: '肩胛平稳下沉', estMinutes: 4, compound: true },
  { family: 'push-up', tier: 2, name: '标准俯卧撑', movementPattern: 'push', muscleGroups: ['胸', '肩前束', '肱三'], sets: 3, repsOrDuration: '8–10 次', progressionNote: '核心收紧，慢下快推', estMinutes: 5, compound: true },
  { family: 'push-up', tier: 3, name: '下斜俯卧撑', movementPattern: 'push', muscleGroups: ['上胸', '肩前束', '肱三'], sets: 3, repsOrDuration: '8 次', progressionNote: '脚垫高，躯干成一直线', estMinutes: 5, compound: true },
  { family: 'incline-push', tier: 1, name: '上斜俯卧撑', movementPattern: 'push', muscleGroups: ['胸', '肩前束'], sets: 2, repsOrDuration: '10 次', progressionNote: '手撑台面，身体不塌腰', estMinutes: 4, compound: true },
  { family: 'pike', tier: 2, name: '派克俯卧撑', movementPattern: 'push', muscleGroups: ['肩前束', '肱三'], sets: 3, repsOrDuration: '8 次', progressionNote: '臀部高抬，头顶向地面下落', estMinutes: 5, compound: true },
  { family: 'dip', tier: 2, name: '椅子臂屈伸', movementPattern: 'push', muscleGroups: ['肱三', '胸下缘'], sets: 3, repsOrDuration: '10 次', progressionNote: '屈肘 90° 即止，肩不耸', estMinutes: 5, compound: true },
  { family: 'dip', tier: 3, name: '直腿臂屈伸', movementPattern: 'push', muscleGroups: ['肱三', '胸下缘'], sets: 3, repsOrDuration: '12 次', progressionNote: '腿部伸直加阻，下降放慢', estMinutes: 6, compound: true },

  // ---- 下肢（股四 / 臀） ----
  { family: 'squat', tier: 1, name: '徒手深蹲', movementPattern: 'lower body', muscleGroups: ['股四', '臀'], sets: 2, repsOrDuration: '10 次', progressionNote: '节奏平稳，下蹲 2 秒', estMinutes: 4, compound: true },
  { family: 'squat', tier: 2, name: '窄距深蹲', movementPattern: 'lower body', muscleGroups: ['股四', '臀'], sets: 3, repsOrDuration: '12 次', progressionNote: '全脚掌踩实，臀部向后下沉', estMinutes: 5, compound: true },
  { family: 'lunge', tier: 1, name: '交替后箭步蹲', movementPattern: 'lower body', muscleGroups: ['股四', '臀'], sets: 2, repsOrDuration: '每侧 10 次', progressionNote: '前膝不越脚尖太多', estMinutes: 5, compound: true },
  { family: 'lunge', tier: 2, name: '保加利亚分腿蹲', movementPattern: 'lower body', muscleGroups: ['股四', '臀'], sets: 3, repsOrDuration: '每侧 8 次', progressionNote: '后脚垫凳，躯干微前倾', estMinutes: 6, compound: true },
  { family: 'lateral-lunge', tier: 1, name: '侧箭步蹲', movementPattern: 'lower body', muscleGroups: ['内收肌', '臀'], sets: 2, repsOrDuration: '每侧 8 次', progressionNote: '重心侧移，膝盖对准脚尖', estMinutes: 5, compound: true },
  { family: 'step-up', tier: 1, name: '登台阶', movementPattern: 'lower body', muscleGroups: ['股四', '臀'], sets: 3, repsOrDuration: '每侧 10 次', progressionNote: '凳高及膝，全脚掌踏上', estMinutes: 5, compound: true },
  { family: 'wall-sit', tier: 1, name: '靠墙静蹲', movementPattern: 'lower body', muscleGroups: ['股四'], sets: 2, repsOrDuration: '40 秒', progressionNote: '膝 90°，腰背贴墙', estMinutes: 3, compound: false },
  { family: 'calf', tier: 1, name: '提踵', movementPattern: 'lower body', muscleGroups: ['小腿'], sets: 3, repsOrDuration: '15 次', progressionNote: '顶峰停顿 1 秒', estMinutes: 3, compound: false },
  { family: 'calf', tier: 2, name: '单腿提踵', movementPattern: 'lower body', muscleGroups: ['小腿'], sets: 2, repsOrDuration: '每侧 12 次', progressionNote: '扶墙保持平衡，全程控制', estMinutes: 4, compound: false },

  // ---- 后链（臀 / 腘绳 / 下背） ----
  { family: 'bridge', tier: 1, name: '双腿臀桥', movementPattern: 'posterior chain', muscleGroups: ['臀', '腘绳'], sets: 2, repsOrDuration: '10 次', progressionNote: '顶峰停顿 1 秒', estMinutes: 4, compound: true },
  { family: 'bridge', tier: 2, name: '单腿臀桥', movementPattern: 'posterior chain', muscleGroups: ['臀', '腘绳'], sets: 3, repsOrDuration: '每侧 8 次', progressionNote: '骨盆保持水平不侧倾', estMinutes: 5, compound: true },
  { family: 'rdl', tier: 2, name: '单腿硬拉（扶墙）', movementPattern: 'posterior chain', muscleGroups: ['臀', '腘绳'], sets: 2, repsOrDuration: '每侧 8 次', progressionNote: '髋铰链，背部平直', estMinutes: 5, compound: true },
  { family: 'back-ext', tier: 1, name: '俯卧背伸', movementPattern: 'posterior chain', muscleGroups: ['下背', '臀'], sets: 2, repsOrDuration: '10 次', progressionNote: '起身不过伸，停留 1 秒', estMinutes: 3, compound: false },

  // ---- 核心 ----
  { family: 'plank', tier: 1, name: '平板支撑', movementPattern: 'core', muscleGroups: ['核心'], sets: 2, repsOrDuration: '30 秒', progressionNote: '保持脊柱中立', estMinutes: 3, compound: false },
  { family: 'plank', tier: 2, name: '侧平板支撑', movementPattern: 'core', muscleGroups: ['核心（侧）'], sets: 2, repsOrDuration: '每侧 25 秒', progressionNote: '髋部不塌，肩髋一线', estMinutes: 4, compound: false },
  { family: 'plank', tier: 3, name: '动态平板（交替触肩）', movementPattern: 'core', muscleGroups: ['核心'], sets: 3, repsOrDuration: '每侧 8 次', progressionNote: '髋不晃，交替抬手', estMinutes: 5, compound: false },
  { family: 'dead-bug', tier: 1, name: '死虫式', movementPattern: 'core', muscleGroups: ['核心'], sets: 2, repsOrDuration: '每侧 6 次', progressionNote: '腰背贴紧地面，动作放慢', estMinutes: 4, compound: false },
  { family: 'bird-dog', tier: 1, name: '鸟狗式', movementPattern: 'core', muscleGroups: ['核心', '下背'], sets: 2, repsOrDuration: '每侧 8 次', progressionNote: '对侧手脚同伸，骨盆稳定', estMinutes: 4, compound: false },
  { family: 'leg-raise', tier: 1, name: '仰卧屈膝抬腿', movementPattern: 'core', muscleGroups: ['核心下段'], sets: 2, repsOrDuration: '12 次', progressionNote: '腰贴地面，慢放', estMinutes: 4, compound: false },
  { family: 'leg-raise', tier: 2, name: '仰卧直腿抬腿', movementPattern: 'core', muscleGroups: ['核心下段'], sets: 3, repsOrDuration: '12 次', progressionNote: '腿伸直，离地即控', estMinutes: 5, compound: false },
  { family: 'crunch', tier: 1, name: '卷腹', movementPattern: 'core', muscleGroups: ['核心上段'], sets: 3, repsOrDuration: '12 次', progressionNote: '下背贴地，肩离地即停', estMinutes: 4, compound: false },

  // ---- 拉（无单杠，受限） ----
  { family: 'prone-row', tier: 1, name: '俯卧 YTW', movementPattern: 'pull (limited)', muscleGroups: ['上背', '后肩'], sets: 2, repsOrDuration: '每姿势 6 次', progressionNote: '拇指朝上，肩胛收紧', estMinutes: 4, compound: false },
  { family: 'towel-row', tier: 1, name: '毛巾等长划船', movementPattern: 'pull (limited)', muscleGroups: ['背', '肱二'], sets: 3, repsOrDuration: '15 秒 ×3', progressionNote: '脚踩毛巾对拉，持续张力', estMinutes: 4, compound: false },

  // ---- 心肺收尾（减脂课候选） ----
  { family: 'jumping-jack', tier: 1, name: '开合跳', movementPattern: 'cardio', muscleGroups: ['全身', '心肺'], sets: 3, repsOrDuration: '40 秒', progressionNote: '落地轻，呼吸均匀', estMinutes: 3, compound: false, finisher: true },
  { family: 'high-knees', tier: 1, name: '高抬腿', movementPattern: 'cardio', muscleGroups: ['全身', '心肺'], sets: 3, repsOrDuration: '30 秒', progressionNote: '摆臂提膝，节奏快', estMinutes: 3, compound: false, finisher: true },
  { family: 'mountain-climber', tier: 2, name: '登山跑', movementPattern: 'cardio', muscleGroups: ['核心', '心肺'], sets: 3, repsOrDuration: '30 秒', progressionNote: '躯干稳定，交替提膝', estMinutes: 3, compound: false, finisher: true },
  { family: 'boxer-step', tier: 1, name: '原地拳击步', movementPattern: 'cardio', muscleGroups: ['全身', '心肺'], sets: 2, repsOrDuration: '60 秒', progressionNote: '轻快移动，肩放松', estMinutes: 3, compound: false, finisher: true },
  { family: 'burpee', tier: 3, name: '波比跳（简化）', movementPattern: 'cardio', muscleGroups: ['全身', '心肺'], sets: 3, repsOrDuration: '8 次', progressionNote: '不俯卧撑亦可，起身即跳', estMinutes: 4, compound: true, finisher: true },
  { family: 'squat-jump', tier: 3, name: '深蹲跳', movementPattern: 'cardio', muscleGroups: ['股四', '臀', '心肺'], sets: 3, repsOrDuration: '10 次', progressionNote: '落地缓冲，屈膝即接', estMinutes: 4, compound: true, finisher: true },

  // ---- 整理 / 活动度（恢复课与收尾用） ----
  { family: 'cat-cow', tier: 1, name: '猫牛式', movementPattern: 'core', muscleGroups: ['脊柱'], sets: 2, repsOrDuration: '60 秒', progressionNote: '随呼吸节律拱背塌腰', estMinutes: 3, compound: false },
  { family: 'hip-flexor', tier: 1, name: '髂腰肌拉伸', movementPattern: 'lower body', muscleGroups: ['髋前侧'], sets: 2, repsOrDuration: '每侧 45 秒', progressionNote: '骨盆后倾，无痛范围', estMinutes: 3, compound: false },
  { family: 'world-stretch', tier: 1, name: '世界最伟大拉伸', movementPattern: 'posterior chain', muscleGroups: ['全身后链'], sets: 2, repsOrDuration: '每侧 5 次', progressionNote: '胸椎旋转，呼吸深长', estMinutes: 4, compound: false },
];

/** 名字 → 动作（台账回查旧记录用：老动作无 movementPattern 字段时按名补位）。 */
const BY_NAME = new Map<string, ExerciseTemplate>(EXERCISE_LIBRARY.map((e) => [e.name, e]));

export function exerciseByName(name: string): ExerciseTemplate | undefined {
  return BY_NAME.get(name);
}

/** 动作 → 进阶梯（同 family 全部 tier，按 tier 升序）。 */
export function exerciseFamily(family: string): ExerciseTemplate[] {
  return EXERCISE_LIBRARY.filter((e) => e.family === family).sort((a, b) => a.tier - b.tier);
}
