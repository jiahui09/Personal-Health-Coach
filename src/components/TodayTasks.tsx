// Serif chapter heading, sans tasks; strike = completed-task semantics.
import React, { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { TodoItem } from '../types/health';
import type { TaskProgress } from '../domain/types';
import { SectionHead } from './SectionHead';
import { cnCount } from '../utils/cnCount';
import { InkButton } from './InkButton';

interface TodayTasksProps {
  todos: TodoItem[];
  /** 完成率由 domain/calculateTaskProgress 算出，组件不自行统计。 */
  tasks: TaskProgress;
  onToggleTodo: (id: string) => void;
  /** 录入拟时长：原始字符串交 domain 规范化，留空即无时长。 */
  onAddTodo: (title: string, estimatedMinutes: string) => Promise<boolean>;
  /** 改拟时长：null 即「取消时长」。 */
  onUpdateEstimate: (id: string, minutes: string | null) => void;
  onDeleteTodo: (id: string) => void;
}

export const TodayTasks: React.FC<TodayTasksProps> = ({
  todos,
  tasks,
  onToggleTodo,
  onAddTodo,
  onUpdateEstimate,
  onDeleteTodo,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  /** 正在改哪条的拟时长（行下缘展开一行小账） */
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editMinutes, setEditMinutes] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    // 只有落册成功才收表清字——云写失败时留字在框,免得用户重打一遍
    const landed = await onAddTodo(title, newMinutes);
    if (landed) {
      setNewTitle('');
      setNewMinutes('');
      setIsAdding(false);
    }
  };

  return (
    <section className="pt-10 lg:pr-9">
      {/* 章节题：今日之事（统一章节头 + 朱批旁注） */}
      <SectionHead
        title="今日之事"
        verdict={
          tasks.total === 0
            ? '今日无事'
            : tasks.completed === 0
            ? '尚无已成'
            : tasks.completed >= tasks.total
            ? '诸事俱毕'
            : `已成其${cnCount(tasks.completed)}`
        }
        note={
          <span className="text-ink3 tabular-nums text-[12px]">
            {tasks.completed}/{tasks.total}
          </span>
        }
      />

      {/* 目录式条目：（勾选框＋标题） —— 点线 —— 用时；行间留 12px 呼吸,与右栏等高配对 */}
      <div className="mt-4 space-y-3">
        {todos.map((todo) => (
          <React.Fragment key={todo.id}>
            <div className="group inklist-row inklist-dotted">
              {/* 首列：勾选框与标题同列，行才是一行目录 */}
              <span className="flex items-center gap-3 min-w-0">
                {/* 热区 24px、可视仍 18px:外层按钮足尺寸,内层 span 才是方框 */}
                <button
                  type="button"
                  onClick={() => onToggleTodo(todo.id)}
                  aria-label={todo.status === 'done' ? '记为未成' : '记为已成'}
                  aria-pressed={todo.status === 'done'}
                  className="w-6 h-6 -m-[3px] shrink-0 grid place-items-center cursor-pointer"
                >
                  <span
                    className={`w-[18px] h-[18px] grid place-items-center rounded-lg border transition-colors duration-150 ${
                      todo.status === 'done'
                        ? 'bg-accent border-accent text-white'
                        : 'border-control hover:border-ink bg-surface'
                    }`}
                  >
                    {/* 勾与否都渲染勾图标（未勾 invisible）：基线恒定,勾选不再挪动本行与邻行（零偏移） */}
                    <Check className={`w-3 h-3 stroke-[3] ${todo.status === 'done' ? '' : 'invisible'}`} />
                  </span>
                </button>
                <span
                  className={
                    'text-[15px] truncate min-w-0 ' +
                    (todo.status === 'done' ? 'line-through text-ink4' : 'text-ink')
                  }
                >
                  {todo.title}
                </span>
              </span>

              <span className="leader" aria-hidden="true" />

              {/* 「拟」= 计划用时，绝非实际时长记录；实际用时只来自 ActivityLog */}
              <span className="flex items-center gap-2 justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditTarget(todo.id);
                    setEditMinutes(todo.estimatedMinutes ? String(todo.estimatedMinutes) : '');
                  }}
                  className="text-xs text-ink3 tabular-nums hover:text-ink transition-colors cursor-pointer py-1 -my-1"
                  title="改拟时长"
                >
                  {todo.estimatedMinutes ? `拟 ${todo.estimatedMinutes} 分` : '拟时长 —'}
                </button>
                {todo.status === 'skipped' && <span className="text-xs text-ink4">已略过</span>}
                <button
                  onClick={() => onDeleteTodo(todo.id)}
                  className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 p-1.5 -m-1 text-ink4 hover:text-danger transition-opacity duration-150 cursor-pointer"
                  title="掷还"
                  aria-label={`掷还 ${todo.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>

            {/* 行下缘：改拟时长（改完即收） */}
            {editTarget === todo.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateEstimate(todo.id, editMinutes);
                  setEditTarget(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditTarget(null);
                }}
                className="flex flex-wrap items-center gap-2 py-3 border-t border-dotted border-linehover"
              >
                <label
                  htmlFor={`todo-estimate-${todo.id}`}
                  className="text-xs text-ink3 shrink-0"
                >
                  拟时长（分）
                </label>
                <input
                  id={`todo-estimate-${todo.id}`}
                  type="number"
                  min={1}
                  max={720}
                  autoFocus
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  placeholder="留空即无"
                  className="w-24 text-[16px] bg-surface border border-control rounded-lg px-3 py-1.5 focus:border-accent text-ink tabular-nums"
                />
                <InkButton type="submit" className="btn-quiet px-3 py-1.5">
                  录之
                </InkButton>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateEstimate(todo.id, null);
                    setEditTarget(null);
                  }}
                  className="btn-link px-2 py-1.5"
                >
                  取消时长
                </button>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="btn-link px-2 py-1.5"
                >
                  罢
                </button>
              </form>
            )}
          </React.Fragment>
        ))}

        {/* 行内添加 */}
        {isAdding ? (
          <form
            onSubmit={handleAdd}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setNewTitle('');
                setNewMinutes('');
                setIsAdding(false);
              }
            }}
            className="flex items-center gap-2 py-3 inklist-dotted border-t border-dotted border-linehover"
          >
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="今日当行之事……"
              className="flex-1 min-w-0 text-[16px] bg-surface border border-control rounded-lg px-3 py-1.5 focus:border-accent text-ink"
            />
            <input
              type="number"
              min={1}
              max={720}
              value={newMinutes}
              onChange={(e) => setNewMinutes(e.target.value)}
              placeholder="拟·分"
              aria-label="拟时长（分，可无）"
              title="拟时长（分）；留空即无时长"
              className="w-20 text-[16px] bg-surface border border-control rounded-lg px-2 py-1.5 focus:border-accent text-ink tabular-nums"
            />
            <InkButton type="submit" className="btn-quiet px-3 py-1.5">
              录之
            </InkButton>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="btn-link px-2 py-1.5"
            >
              罢
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="btn-link w-full py-3.5 border-t border-dotted border-linehover"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添录一事</span>
          </button>
        )}
      </div>
    </section>
  );
};
