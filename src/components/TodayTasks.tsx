import React, { useState } from 'react';
import { Check, Plus, Trash2, Clock, Feather } from 'lucide-react';
import { DailyNote, TodoItem } from '../types/health';

interface TodayTasksProps {
  todos: TodoItem[];
  notes: DailyNote[];
  onToggleTodo: (id: string) => void;
  onAddTodo: (title: string, estimatedMinutes?: number) => void;
  onDeleteTodo: (id: string) => void;
  onOpenRecord: () => void;
}

export const TodayTasks: React.FC<TodayTasksProps> = ({
  todos,
  notes,
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

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <section className="py-5 border-b border-[#e9e4dc] space-y-3.5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-serif font-normal text-[#1c1917] tracking-tight">
            TODAY
          </h2>
          <span className="text-xs font-mono text-[#78716c]">
            {completedCount}/{todos.length}
          </span>
        </div>

        <button
          onClick={onOpenRecord}
          className="text-xs text-[#78716c] hover:text-[#1c1917] font-sans transition-colors cursor-pointer flex items-center gap-1"
        >
          <span className="text-[#15803d] font-bold">+</span>
          <span>手记速记</span>
        </button>
      </div>

      {/* Todo Checklist */}
      <div className="space-y-1.5">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={`group flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-150 border ${
              todo.completed
                ? 'bg-[#f8f6f1]/60 border-transparent text-[#a8a29e]'
                : 'bg-[#fbfaf8] border-[#ece7de] hover:border-[#dfd8cc] text-[#24272c]'
            }`}
          >
            <div
              onClick={() => onToggleTodo(todo.id)}
              className="flex items-center gap-3 cursor-pointer flex-1 select-none"
            >
              <div
                className={`w-4 h-4 rounded-sm flex items-center justify-center border transition-colors ${
                  todo.completed
                    ? 'bg-[#15803d] border-[#15803d] text-white'
                    : 'border-[#b8b0a2] group-hover:border-[#78716c] bg-white'
                }`}
              >
                {todo.completed && <Check className="w-3 h-3 stroke-[3]" />}
              </div>

              <span
                className={`text-sm font-sans ${
                  todo.completed ? 'line-through text-[#a8a29e]' : 'text-[#24272c]'
                }`}
              >
                {todo.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {todo.estimatedMinutes && !todo.completed && (
                <span className="text-[11px] font-mono text-[#a8a29e] flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {todo.estimatedMinutes}m
                </span>
              )}

              <button
                onClick={() => onDeleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-[#a8a29e] hover:text-[#b91c1c] transition-all cursor-pointer"
                title="删除事项"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Add Todo Inline */}
        {isAdding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入今日要做的事情..."
              className="flex-1 text-sm bg-white border border-[#d6cfc4] rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-[#15803d] text-[#1c1917]"
            />
            <button
              type="submit"
              className="text-xs bg-[#1c1917] text-white px-3 py-1.5 rounded-xl hover:bg-[#2d2824] cursor-pointer"
            >
              添加
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-[#78716c] hover:text-[#1c1917] px-2 py-1.5 cursor-pointer"
            >
              取消
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 text-xs text-[#78716c] hover:text-[#1c1917] py-1.5 px-2 font-sans cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#15803d]" />
            <span>添加待办事项</span>
          </button>
        )}
      </div>

      {/* Daily Notes (Living Journal entry) */}
      {notes && notes.length > 0 && (
        <div className="pt-2">
          {notes.slice(-1).map((note) => (
            <div
              key={note.id}
              className="p-3.5 rounded-xl bg-[#f5f2eb]/70 border border-[#e8e2d8] space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px] text-[#78716c]">
                <span className="flex items-center gap-1">
                  <Feather className="w-3 h-3 text-[#a8a29e]" />
                  <span>生活记事</span>
                </span>
                <span className="font-mono text-[#a8a29e]">{note.timestamp}</span>
              </div>
              <p className="text-sm font-serif italic text-[#292524] leading-relaxed">
                "{note.content}"
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
