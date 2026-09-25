/**
 * 存储形态迁移测试
 *
 * 迁移只做「旧类型 → 新类型」的升级，绝不改任何数值；
 * 旧路径与已迁移路径都必须可读（幂等）。
 */

import {
  migrateMeals,
  migrateProfile,
  migrateSleep,
  migrateState,
  migrateTodos,
  migrateWeights,
  migrateWorkouts,
} from '../domain/migrate';
import { intervalMinutes } from '../domain/sleep';
import { INITIAL_USER_PROFILE } from '../data/mockData';
import { makeDayContext, weightSummary } from '../domain';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

// ---------------- 睡眠三字段 → 单一来源 ----------------
const legacySleep = migrateSleep({
  sleepHours: 7.33,
  sleepBedtime: '00:55',
  sleepWakeup: '08:15',
});
assert(legacySleep?.kind === 'interval', '有就寝/起身时刻 → 区间');
if (legacySleep?.kind === 'interval') {
  assert(intervalMinutes(legacySleep.sleepStart, legacySleep.wakeTime) === 440, '区间仍得 440 分');
}

const legacyHoursOnly = migrateSleep({ sleepHours: 7.33 });
assert(legacyHoursOnly?.kind === 'duration', '只有眠时 → 手录眠时');
if (legacyHoursOnly?.kind === 'duration') {
  assert(legacyHoursOnly.minutes === 440, '7.33h → 440 分（数值不丢）');
}

assert(migrateSleep({}) === undefined, '全无睡眠数据 → undefined（不编默认值）');

// ---------------- 单对象 → 数组（并保留全部数值） ----------------
const legacyState = {
  date: '2026-09-25',
  sleepHours: 7.33,
  sleepBedtime: '00:55',
  sleepWakeup: '08:15',
  energy: 4,
  soreness: 2,
  notes: '晨起神清',
};
const states = migrateState(legacyState);
assert(states.length === 1, '单对象包成一条记录');
assert(states[0].energy === 4 && states[0].soreness === 2, '精力/酸痛原样保留');
assert(states[0].notes === '晨起神清', '随笔原样保留');
assert(migrateState([legacyState, legacyState]).length === 2, '已是数组则逐条迁移（幂等）');
assert(migrateState(undefined).length === 0, '无数据 → 空数组');

// ---------------- completed → status ----------------
const todos = migrateTodos([
  { id: 't1', title: '已成之事', date: '2026-09-25', completed: true },
  { id: 't2', title: '未成之事', date: '2026-09-25', completed: false },
  { id: 't3', title: '新形态', date: '2026-09-25', status: 'skipped' },
]);
assert(todos[0].status === 'done', 'completed:true → done');
assert(todos[1].status === 'todo', 'completed:false → todo');
assert(todos[2].status === 'skipped', '新形态保持不变（幂等）');

// ---------------- 训练：类别与时长来源 ----------------
const workouts = migrateWorkouts([
  {
    id: 'wo-1',
    date: '2026-09-23',
    time: '18:15',
    title: '徒手基础循环',
    durationMinutes: 20,
    exercises: [],
    perceivedDifficulty: 'moderate',
    completed: true,
  },
]);
assert(workouts[0].category === 'resistance', '存量徒手循环归入抗阻（结构化事实，非标题猜测）');
assert(workouts[0].durationSource === 'estimated', '存量时长标为估算，不当实际计时');
assert(workouts[0].durationMinutes === 20, '时长数值不变');

// ---------------- 饮食：来源与确认 ----------------
const meals = migrateMeals([
  {
    id: 'm-1',
    date: '2026-09-25',
    time: '09:10',
    category: 'breakfast',
    name: '燕麦',
    foods: ['燕麦'],
    estimatedCalories: 430,
    estimatedProtein: 21,
  },
]);
assert(meals[0].source === 'manual' && meals[0].confirmed === true, '存量膳食视为手录且已确认');
assert(meals[0].estimatedCalories === 430 && meals[0].estimatedProtein === 21, '数值不变');

// ---------------- 体重：来源字段 ----------------
const weights = migrateWeights([
  { id: 'w-1', date: '2026-09-25', weight: 68.4 },
  { id: 'w-2', date: '2026-09-24', weight: 68.5, source: 'scale', time: '07:10' },
]);
assert(weights[0].source === 'manual' && weights[1].source === 'scale', '来源缺省 manual，已有则保留');
assert(weights[1].time === '07:10', '测量时刻保留');
assert(weights[0].weight === 68.4, '体重数值不变');

// 迁移后的记录在 domain 里得到与旧实现相同的「今之体重」
const ctx = makeDayContext(new Date(2026, 8, 25, 21, 30));
const summary = weightSummary(weights, ctx);
assert(summary.latest === 68.4 && summary.daysWithRecords === 2, '迁移后可直接派生统计');

// ---------------- 档案缺项回落 ----------------
const profile = migrateProfile({ name: '新档', waistCm: 84, heightCm: 175, sex: 'male' });
assert(profile.name === '新档' && profile.waistCm === 84 && profile.heightCm === 175, '认识的字段照录');
assert(profile.activityLevel === undefined, '未提供的字段留空（不注入默认人体数据）');
assert(Object.keys(migrateProfile({})).length === 0, '空对象 → 空档案（未建档,不是「默认人」）');
assert(INITIAL_USER_PROFILE.heightCm === undefined, '演示档案本身即未建档');

console.log('ALL MIGRATION TESTS PASSED.');
