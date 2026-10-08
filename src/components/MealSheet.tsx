// 进食表：录一膳。录事三表之一（另有 WorkoutSheet / BodySheet），壳与组题由 SheetShell 共出。
// 餐别不再问用户——category 由保存时刻的时钟判定（App 传入 mealSlot，与建议之膳一键入账同源）。
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { CreateMealInput, MealCategory, MealItem } from '../types/health';
import { foodItemNutrition, sumMealItems } from '../domain/nutrition';
import { COMMON_FOOD_DATABASE, foodById } from '../data/foods';
import { Group, INPUT, SheetShell } from './SheetShell';

/** 膳别中文（与 App 的 SLOT_CN 同词；此处随表而生，免得组件反引 App）。 */
const MEAL_SLOT_CN: Record<MealCategory, string> = {
  breakfast: '早膳',
  lunch: '午膳',
  dinner: '晚膳',
  snack: '加餐',
};

interface MealSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Save handler resolves false when the write failed; App already toasted the reason. */
  onSave: (input: CreateMealInput) => Promise<boolean>;
  /** 今日已入账之食；未传则不显示累计。 */
  todayIntake?: { mealCount: number; caloriesKcal: number; proteinG: number };
  /** 保存时刻的膳别（时钟 f_meal_slot 推得；用户不再自选）。 */
  mealSlot: MealCategory;
}

export const MealSheet: React.FC<MealSheetProps> = ({ isOpen, onClose, onSave, todayIntake, mealSlot }) => {  const [foodText, setFoodText] = useState('');
  const [mealCalories, setMealCalories] = useState<number | ''>('');
  const [mealProtein, setMealProtein] = useState<number | ''>('');
  /** 库选行（食物库 → 折算之账）；空即手录模式。 */
  const [pickedRows, setPickedRows] = useState<{ foodId: string; gramsText: string }[]>([]);
  /** 库中择品下滑栏：不打字也能从档案库点选（三列只列名称，可连点多选）。 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  /** 手录提示：所选之物折算不出时给一句，不发空账。 */
  const [hint, setHint] = useState<string | null>(null);

  // 库选折算：每行按克数换算，合计回填约计（全走 domain，组件内无业务算术）
  const pickedLines = useMemo(
    () =>
      pickedRows.map((r) => {
        const food = foodById(r.foodId);
        const raw = Number(r.gramsText.trim());
        const grams = Number.isFinite(raw) && raw > 0 ? raw : 0;
        return { ...r, food, item: food ? foodItemNutrition(food, grams) : null };
      }),
    [pickedRows]
  );
  const pickedItems = useMemo(
    () => pickedLines.map((l) => l.item).filter((x): x is MealItem => x !== null),
    [pickedLines]
  );
  const pickedTotals = pickedItems.length > 0 ? sumMealItems(pickedItems) : null;
  // 搜索建议：仅作可选项陈列，不自动入账（查无此物时手录照旧可用）
  const foodMatches = useMemo(() => {
    const q = foodText.trim();
    if (!q) return [];
    const tokens = q.split(/[,，、\s]+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return COMMON_FOOD_DATABASE.filter((f) => tokens.some((t) => f.name.includes(t))).slice(0, 6);
  }, [foodText]);

  // 开时回默认空稿（残稿由 SheetShell 在本 effect 之后覆以回填，速记默认不留旧账）
  const resetToDefaults = () => {
    setFoodText('');
    setMealCalories('');
    setMealProtein('');
    setPickedRows([]);
    setPickerOpen(false);
    setHint(null);
  };
  useEffect(() => {
    if (!isOpen) return;
    resetToDefaults();
  }, [isOpen]);

  // 择品栏开时：点栏外即阖、Esc 先阖栏再阖弹层（capture 抢在 useSheetBehavior 之前）
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [pickerOpen]);

  const submit = async (): Promise<boolean> => {
    setHint(null);
    // 空录之戒（novalidate 后自校验走 hint 通道，不吐原生英文气泡）
    if (pickedRows.length === 0 && foodText.trim() === '') {
      setHint('未填所食之物——搜库点选，或逗号分隔自行键入，再照准。');
      return false;
    }
    if (pickedRows.length === 0) {
      const kcal = mealCalories === '' ? 0 : Number(mealCalories);
      const protein = mealProtein === '' ? 0 : Number(mealProtein);
      if (!Number.isFinite(kcal) || kcal < 0) {
        setHint('约计热量须为零以上之数——核对后再照准。');
        return false;
      }
      if (!Number.isFinite(protein) || protein < 0) {
        setHint('约计蛋白质须为零以上之数——核对后再照准。');
        return false;
      }
    }
    if (pickedRows.length > 0 && pickedItems.length > 0) {
      // 库选之账：行值即所见（先各自取整再加），脂肪随之入账
      const totals = sumMealItems(pickedItems);
      const names = pickedItems.map((i) => i.name);
      return onSave({
        category: mealSlot,
        name: names.length <= 2 ? names.join('、') : `${names[0]}等 ${names.length} 品`,
        foods: names,
        estimatedCalories: totals.kcal,
        estimatedProtein: totals.proteinG,
        estimatedFatG: totals.fatG,
        items: pickedItems,
        source: 'database',
      });
    }
    if (pickedRows.length > 0) {
      // 所选行折不出（id 失效）却也无手录文字：不拿空账糊弄
      setHint('所选之物折算不出——删掉该行改手录，或先清空所选。');
      return false;
    }
    const foodsArray = foodText
      .split(/[,，、\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    return onSave({
      category: mealSlot,
      name: foodText,
      foods: foodsArray.length > 0 ? foodsArray : [foodText],
      estimatedCalories: Number(mealCalories) || 0,
      estimatedProtein: Number(mealProtein) || 0,
      source: 'manual',
    });
  };

  return (
    <SheetShell
      isOpen={isOpen}
      title="录一膳"
      titleId="meal-sheet-title"
      widthClass="sm:max-w-lg"
      onClose={onClose}
      onSubmit={submit}
      hint={hint}
      draftKey="phc_draft_meal"
      getDraft={() => ({ foodText, mealCalories, mealProtein, pickedRows })}
      applyDraft={(d) => {
        if (typeof d.foodText === 'string') setFoodText(d.foodText);
        setMealCalories(typeof d.mealCalories === 'number' ? d.mealCalories : '');
        setMealProtein(typeof d.mealProtein === 'number' ? d.mealProtein : '');
        setPickedRows(
          Array.isArray(d.pickedRows)
            ? d.pickedRows
                .filter((r): r is { foodId: string; gramsText: string } => !!r && typeof r === 'object' && typeof (r as { foodId?: unknown }).foodId === 'string')
                .map((r) => ({ foodId: r.foodId, gramsText: String((r as { gramsText?: unknown }).gramsText ?? '') }))
            : []
        );
        setHint(null);
      }}
      onDiscardDraft={resetToDefaults}
    >
      <div className="space-y-3.5">
        {/* 归膳明示：餐别既由时钟判定，就在表头把去处亮出来（只明示，不给改判） */}
        <p className="text-[12px] text-ink2">
          此录将归入 · {MEAL_SLOT_CN[mealSlot]}（依保存时刻定）
        </p>
        {todayIntake && (
          <p className="text-[12px] text-ink3 tabular-nums">
            今日已录 {todayIntake.mealCount} 膳 · {todayIntake.caloriesKcal} 千卡 ·{' '}
            {todayIntake.proteinG} g 蛋白质
          </p>
        )}

        <Group title="所食" first={!todayIntake}>
          <div ref={pickerRef}>
            <label htmlFor="rs-food" className="sr-only">搜库或手录所食之物</label>
            <input
              id="rs-food"
              type="text"
              required={pickedRows.length === 0}
              value={foodText}
              onChange={(e) => setFoodText(e.target.value)}
              className={INPUT}
              placeholder="搜库（如：鸡胸、糙米）；查无此物可逗号分隔手录"
            />
            {/* 加号：不打字也能择——开下滑栏三列只列名称，点名即入已选（默认克数） */}
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              aria-expanded={pickerOpen}
              aria-controls="rs-food-picker"
              className="btn-link mt-2 inline-flex items-center gap-1"
            >
              <Plus size={14} aria-hidden="true" />
              库中择品
            </button>
            {pickerOpen && (
              <div
                id="rs-food-picker"
                role="group"
                aria-label="食物档案库点选"
                className="mt-2 border border-control rounded-lg p-2 grid grid-cols-3 gap-x-3 gap-y-1 max-h-44 overflow-y-auto"
              >
                {COMMON_FOOD_DATABASE.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setPickedRows((rows) =>
                        rows.some((r) => r.foodId === f.id)
                          ? rows
                          : [...rows, { foodId: f.id, gramsText: String(f.defaultGrams) }]
                      )
                    }
                    className="min-w-0 truncate text-left text-[12px] py-0.5 text-ink hover:text-accent transition-colors"
                    title={f.name}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            {/* 打字建议与择品栏二选一，免得双列表重复陈列 */}
            {foodMatches.length > 0 && !pickerOpen && (
              <div className="mt-2 border border-control rounded-lg overflow-hidden divide-y divide-linesoft">
                {foodMatches.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setPickedRows((rows) =>
                        rows.some((r) => r.foodId === f.id)
                          ? rows
                          : [...rows, { foodId: f.id, gramsText: String(f.defaultGrams) }]
                      );
                      setFoodText('');
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-surface transition-colors"
                  >
                    <span className="text-[13px] text-ink">{f.name}</span>
                    <span className="text-[12px] text-ink3 tabular-nums">
                      {' '}
                      每 100g：{f.per100.kcal} 千卡 · 蛋 {f.per100.proteinG} · 脂 {f.per100.fatG}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Group>

        {pickedRows.length > 0 && (
          <Group title="已选之物（克数可改）">
            <div className="space-y-2">
              {pickedLines.map((line, idx) => (
                <div key={`${line.foodId}-${idx}`} className="grid grid-cols-[1fr_66px_26px_30px] gap-2 items-center">
                  <span className="text-[13px] text-ink leading-tight">
                    {line.item ? line.item.name : line.foodId}
                    {line.item ? (
                      <span className="text-ink3 tabular-nums">
                        {' '}
                        {line.item.kcal} 千卡 · 蛋 {line.item.proteinG} · 脂 {line.item.fatG}
                      </span>
                    ) : (
                      <span className="text-danger"> 库中无此 id</span>
                    )}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={line.item ? `${line.item.name} 克数` : '克数'}
                    value={line.gramsText}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPickedRows((rows) => rows.map((r, i) => (i === idx ? { ...r, gramsText: v } : r)));
                    }}
                    className={`${INPUT} tabular-nums`}
                  />
                  <span className="text-ink3 text-[12px]">g</span>
                  <button
                    type="button"
                    aria-label={line.item ? `删${line.item.name}` : '删此行'}
                    onClick={() => setPickedRows((rows) => rows.filter((_, i) => i !== idx))}
                    className="text-ink3 hover:text-ink text-[14px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {pickedTotals && (
              <p className="mt-2 text-[12px] text-ink3 tabular-nums">
                合计 {pickedTotals.kcal} 千卡 · 蛋白 {pickedTotals.proteinG} · 脂肪{' '}
                {pickedTotals.fatG} g——已回填约计。
              </p>
            )}
            {foodText.trim() !== '' && (
              <p className="mt-1 text-[12px] text-danger">
                所选已入账；库外文字不计——想手录请先清空所选。
              </p>
            )}
          </Group>
        )}

        <Group title={pickedTotals ? '约计（由所选之物折算）' : '约计（可无，留空即 0）'}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rs-kcal" className="block text-ink3 mb-1">约计热量 (kcal)</label>
              <input
                id="rs-kcal"
                type="number"
                min="0"
                readOnly={!!pickedTotals}
                value={pickedTotals ? pickedTotals.kcal : mealCalories}
                onChange={(e) => setMealCalories(e.target.value === '' ? '' : Number(e.target.value))}
                className={`${INPUT} tabular-nums${pickedTotals ? ' bg-linesoft' : ''}`}
                placeholder="留空即 0"
              />
            </div>
            <div>
              <label htmlFor="rs-protein" className="block text-ink3 mb-1">约计蛋白质 (g)</label>
              <input
                id="rs-protein"
                type="number"
                min="0"
                readOnly={!!pickedTotals}
                value={pickedTotals ? pickedTotals.proteinG : mealProtein}
                onChange={(e) => setMealProtein(e.target.value === '' ? '' : Number(e.target.value))}
                className={`${INPUT} tabular-nums${pickedTotals ? ' bg-linesoft' : ''}`}
                placeholder="留空即 0"
              />
            </div>
          </div>
        </Group>
      </div>
    </SheetShell>
  );
};
