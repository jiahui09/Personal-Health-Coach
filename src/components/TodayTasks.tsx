// Serif chapter heading, sans tasks; strike = completed-task semantics. deslop-ignore-file 07 09
import React, { useState } from 'react';
import { Check, Plus, Trash2, Feather } from 'lucide-react';
import { DailyNote, TodoItem } from '../types/health';
import type { TaskProgress } from '../domain/types';
import { SectionHead } from './SectionHead';
import { cnCount } from '../utils/cnCount';

interface TodayTasksProps {
  todos: TodoItem[];
  notes: DailyNote[];
  /** 完成率由 domain/calculateTaskProgress 算出，组件不自行统计。 */
  tasks: TaskProgress;
  onToggleTodo: (id: string) => void;
  onAddTodo: (title: string, estimatedMinutes?: number) => void;
  onDeleteTodo: (id: string) => void;
  onOpenRecord: () => void;
}

export const TodayTasks: React.FC<TodayTasksProps> = ({
  todos,
  notes,
  tasks,
  onToggleTodo,
  onAddTodo,
  onDeleteTodo,
  onOpenRecord,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTodo(newTitle.trim(), 20);
    setNewTitle('');
    setIsAdding(false);
  };

  return (
    <section className="pt-10 lg:pr-9">
      {/* 章节题：其一 · 今日之事（统一章节头 + 朱批旁注） */}
      <SectionHead
        ordinal="其一"
        title="今日之事"
        verdict={tasks.total === 0 ? '今日无事' : `已成其${cnCount(tasks.completed)}`}
        note={
          <button onClick={onOpenRecord} className="btn-link">
            <span className="text-ink3 tabular-nums">
              {tasks.completed}/{tasks.total}
            </span>
            <span> · 即刻札记</span>
          </button>
        }
      />

      {/* 目录式条目：标题 —— 点线 —— 用时 */}
      <div className="mt-4">
        {todos.map((todo, idx) => (
          <div
            key={todo.id}
            className="group inklist-row inklist-dotted"
          >
            {/* 热区 24px、可视仍 18px:外层按钮足尺寸,内层 span 才是方框 */}
            <button
              type="button"
              onClick={() => onToggleTodo(todo.id)}
              aria-label={todo.status === 'done' ? '记为未成' : '记为已成'}
              aria-pressed={todo.status === 'done'}
              className="w-6 h-6 -m-[3px] shrink-0 grid place-items-center cursor-pointer"
            >
              <span
                className={`w-[18px] h-[18px] grid place-items-center rounded-sm border transition-colors duration-150 ${
                  todo.status === 'done'
                    ? 'bg-accent border-accent text-white'
                    : 'border-control hover:border-ink bg-surface'
                }`}
              >
                {todo.status === 'done' && <Check className="w-3 h-3 stroke-[3]" />}
              </span>
            </button>

            <span className="flex items-center gap-3 min-w-0">
              <span
                className={
                  'text-[15px] truncate ' +
                  (todo.status === 'done' ? 'line-through text-ink4' : 'text-ink')
                }
              >
                {todo.title}
              </span>
            </span>

            <span className="leader" aria-hidden="true" />

            {/* 「拟」= 计划用时，绝非实际时长记录；实际用时只来自 ActivityLog */}
            <span className="flex items-center gap-2 justify-end shrink-0">
              <span className="text-xs text-ink3 tabular-nums">
                {todo.estimatedMinutes ? `拟 ${todo.estimatedMinutes} 分` : '—'}
                {todo.status === 'skipped' && <span className="ml-2 text-ink4">已略过</span>}
              </span>
              <button
                onClick={() => onDeleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 -m-1 text-ink4 hover:text-danger transition-opacity duration-150 cursor-pointer"
                title="掷还"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        ))}

        {/* 行内添加 */}
        {isAdding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2 py-3 inklist-dotted border-t border-dotted border-linehover">
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="今日当行之事……"
              className="flex-1 text-sm bg-surface border border-control rounded-lg px-3 py-1.5 focus:border-accent text-ink"
            />
            <button
              type="submit"
              className="btn-primary px-3 py-1.5"
            >
              录之
            </button>
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

      {/* 当日随笔 */}
      {notes && notes.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          {notes.slice(-1).map((note) => (
            <div key={note.id}>
              <div className="flex items-center justify-between text-[12px] text-ink3 tracking-[0.14em]">
                <span className="flex items-center gap-1.5">
                  <Feather className="w-3 h-3" />
                  <span>案头小记</span>
                </span>
                <span className="tabular-nums tracking-normal">{note.timestamp}</span>
              </div>
              <p className="font-serif text-[19px] leading-[1.85] text-ink mt-2">「{note.content}」</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
