import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Assignment, Exam } from '../types';
import { getCourseColor } from '../utils/sampleData';
import {
  KIND_LABEL,
  addItem,
  buildRows,
  deleteItem,
  emptyForm,
  formFromAssignment,
  formFromExam,
  formToStart,
  formatWhen,
  restoreRemoved,
  updateItem,
  validateForm,
} from '../utils/calendarEdit';
import type { EditorForm, EditorRow, ItemKind, Removed, RowFilter, Target } from '../utils/calendarEdit';

interface CalendarEditorProps {
  assignments: Assignment[];
  exams: Exam[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  /** Hide the floating button on pages where it does not belong (default: always shown). */
  visible?: boolean;
}

interface Notice {
  text: string;
  undo?: Removed;
}

const FILTERS: { id: RowFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'event', label: 'Events' },
  { id: 'exam', label: 'Exams' },
  { id: 'study', label: 'Study' },
];

const KIND_CHOICES: { id: ItemKind; label: string }[] = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'event', label: 'Event' },
  { id: 'exam', label: 'Exam' },
];

const inputClass =
  'w-full px-3 py-2 rounded-xl border bg-[#f9faf8] text-[#17262b] text-sm focus:outline-none focus:ring-2 focus:ring-[#1f5c4d]';
const labelClass = 'text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1';

export const CalendarEditor: React.FC<CalendarEditorProps> = ({
  assignments,
  exams,
  setAssignments,
  setExams,
  visible = true,
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Target | null>(null); // null while adding
  const [form, setForm] = useState<EditorForm>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [showPast, setShowPast] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const titleRef = useRef<HTMLInputElement>(null);

  const state = useMemo(() => ({ assignments, exams }), [assignments, exams]);
  const { rows, total } = useMemo(
    () => buildRows(state, { query, filter, showPast }),
    [state, query, filter, showPast]
  );
  const courseSuggestions = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => a.course && a.course !== 'General' && set.add(a.course));
    exams.forEach((e) => e.course && e.course !== 'General' && set.add(e.course));
    return Array.from(set).sort();
  }, [assignments, exams]);

  const apply = (next: { assignments: Assignment[]; exams: Exam[] }) => {
    setAssignments(next.assignments);
    setExams(next.exams);
  };

  const showNotice = useCallback((n: Notice, ms: number) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(n);
    noticeTimer.current = window.setTimeout(() => setNotice(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  // Escape: leave the form first, then close the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view === 'form') setView('list');
      else setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, view]);

  // Put the cursor in the title box when the form opens
  useEffect(() => {
    if (open && view === 'form') titleRef.current?.focus();
  }, [open, view]);

  const startAdd = (kind: ItemKind = 'assignment') => {
    setEditing(null);
    setForm(emptyForm(kind));
    setErrors({});
    setView('form');
  };

  const startEdit = (row: EditorRow) => {
    if (row.target.source === 'exam') {
      const exam = exams.find((e) => e.id === row.target.id);
      if (!exam) return;
      setForm(formFromExam(exam));
    } else {
      const item = assignments.find((a) => a.uid === row.target.id);
      if (!item) return;
      setForm(formFromAssignment(item));
    }
    setEditing(row.target);
    setErrors({});
    setView('form');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    apply(editing ? updateItem(state, editing, form) : addItem(state, form));
    // A past-dated item would vanish from the default list, so reveal past items
    if (formToStart(form).getTime() < new Date().setHours(0, 0, 0, 0)) setShowPast(true);
    showNotice({ text: editing ? 'Changes saved.' : `Added "${form.title.trim()}".` }, 3000);
    setView('list');
  };

  const handleDelete = (row: EditorRow) => {
    const { next, removed } = deleteItem(state, row.target);
    apply(next);
    showNotice({ text: `Deleted "${row.title}".`, undo: removed }, 8000);
  };

  const handleUndo = () => {
    if (!notice?.undo) return;
    apply(restoreRemoved(state, notice.undo));
    showNotice({ text: 'Restored.' }, 2500);
  };

  // While adding, switching type resets the type-specific defaults but keeps what was typed
  const switchKind = (kind: ItemKind) =>
    setForm((prev) => ({ ...emptyForm(kind), title: prev.title, course: prev.course, date: prev.date }));

  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isExam = form.kind === 'exam';
  const fieldClass = (name: string) => `${inputClass} ${errors[name] ? 'border-[#d9482b]' : 'border-[#dde3de]'}`;
  const errorText = (name: string) =>
    errors[name] ? (
      <p id={`ce-${name}-error`} className="text-xs text-[#d9482b] mt-1">
        {errors[name]}
      </p>
    ) : null;

  return (
    <>
      {/* Floating entry point (no change to the existing pages is needed) */}
      {visible && !open && (
        <button
          onClick={() => {
            setView('list');
            setOpen(true);
          }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-[#1f5c4d] text-white font-bold text-sm shadow-lg hover:bg-[#18493d] transition-colors"
        >
          <Pencil className="w-4 h-4 text-[#f4d958]" />
          <span>Edit calendar</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false); // click on the backdrop
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit calendar"
            className="bg-white w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[#dde3de] shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#dde3de]">
              <div className="flex items-center gap-2 min-w-0">
                {view === 'form' && (
                  <button
                    onClick={() => setView('list')}
                    aria-label="Back to list"
                    className="p-1.5 rounded-lg hover:bg-[#f2f4f0] text-[#17262b]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h2 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] truncate">
                  {view === 'list' ? 'Edit calendar' : editing ? 'Edit item' : 'Add item'}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-[#f2f4f0] text-[#17262b]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* LIST VIEW */}
            {view === 'list' && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="px-5 pt-4 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#5d6d70] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        aria-label="Search items"
                        placeholder="Search title or course"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className={`${inputClass} border-[#dde3de] pl-9`}
                      />
                    </div>
                    <button
                      onClick={() => startAdd()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-[#1f5c4d] text-white hover:bg-[#18493d] shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        aria-pressed={filter === f.id}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          filter === f.id
                            ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                            : 'bg-white text-[#5d6d70] border-[#dde3de] hover:bg-[#f2f4f0]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-[#5d6d70] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPast}
                        onChange={(e) => setShowPast(e.target.checked)}
                        className="accent-[#1f5c4d]"
                      />
                      Show past
                    </label>
                  </div>
                </div>

                <div className="px-5 py-3 overflow-y-auto flex-1">
                  {rows.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <p className="text-sm text-[#5d6d70]">
                        {total === 0
                          ? 'Nothing on your calendar yet.'
                          : 'No items match. Try another filter, or turn on "Show past".'}
                      </p>
                      {total === 0 && (
                        <button onClick={() => startAdd()} className="text-sm font-bold text-[#1f5c4d] underline">
                          Add your first item
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul>
                      {rows.map((r) => (
                        <li key={r.key} className="flex items-center gap-3 py-3 border-b border-[#eef1ed] last:border-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: getCourseColor(r.course) }}
                            aria-hidden="true"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${r.completed ? 'line-through text-[#5d6d70]' : 'text-[#17262b]'}`}>
                              {r.title}
                            </p>
                            <p className="text-xs text-[#5d6d70] truncate">
                              {formatWhen(r)}
                              {r.course && r.course !== 'General' ? ` · ${r.course}` : ''}
                            </p>
                          </div>
                          <span className="hidden sm:inline text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f2f4f0] text-[#5d6d70] shrink-0">
                            {KIND_LABEL[r.kind]}
                          </span>
                          <button
                            onClick={() => startEdit(r)}
                            aria-label={`Edit ${r.title}`}
                            className="p-2 rounded-lg hover:bg-[#f2f4f0] text-[#17262b]"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(r)}
                            aria-label={`Delete ${r.title}`}
                            className="p-2 rounded-lg hover:bg-[#fef2f2] text-[#d9482b]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="px-5 py-3 border-t border-[#dde3de] text-xs text-[#5d6d70]">
                  {rows.length} of {total} items shown. Changes save automatically.
                </p>
              </div>
            )}

            {/* FORM VIEW */}
            {view === 'form' && (
              <form onSubmit={handleSave} noValidate className="flex flex-col min-h-0 flex-1">
                <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
                  {/* Type (fixed while editing) */}
                  <div>
                    <span className={labelClass} id="ce-kind-label">Type</span>
                    <div role="radiogroup" aria-labelledby="ce-kind-label" className="flex gap-2">
                      {KIND_CHOICES.filter((k) => !editing || k.id === form.kind).map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          role="radio"
                          aria-checked={form.kind === k.id}
                          disabled={!!editing}
                          onClick={() => switchKind(k.id)}
                          className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                            form.kind === k.id
                              ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                              : 'bg-white text-[#5d6d70] border-[#dde3de] hover:bg-[#f2f4f0]'
                          }`}
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ce-title" className={labelClass}>Title</label>
                    <input
                      id="ce-title"
                      ref={titleRef}
                      value={form.title}
                      onChange={(e) => set('title', e.target.value)}
                      aria-invalid={!!errors.title}
                      aria-describedby={errors.title ? 'ce-title-error' : undefined}
                      placeholder={isExam ? 'Midterm Exam' : 'Problem Set 4'}
                      className={fieldClass('title')}
                    />
                    {errorText('title')}
                  </div>

                  <div>
                    <label htmlFor="ce-course" className={labelClass}>Course</label>
                    <input
                      id="ce-course"
                      list="ce-courses"
                      value={form.course}
                      onChange={(e) => set('course', e.target.value)}
                      placeholder="CS 111 (optional)"
                      className={fieldClass('course')}
                    />
                    <datalist id="ce-courses">
                      {courseSuggestions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="ce-date" className={labelClass}>Date</label>
                      <input
                        id="ce-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => set('date', e.target.value)}
                        aria-invalid={!!errors.date}
                        aria-describedby={errors.date ? 'ce-date-error' : undefined}
                        className={fieldClass('date')}
                      />
                      {errorText('date')}
                    </div>
                    {(isExam || !form.allDay) && (
                      <div>
                        <label htmlFor="ce-time" className={labelClass}>Time</label>
                        <input
                          id="ce-time"
                          type="time"
                          value={form.time}
                          onChange={(e) => set('time', e.target.value)}
                          aria-invalid={!!errors.time}
                          aria-describedby={errors.time ? 'ce-time-error' : undefined}
                          className={fieldClass('time')}
                        />
                        {errorText('time')}
                      </div>
                    )}
                  </div>

                  {!isExam && (
                    <label className="flex items-center gap-2 text-sm text-[#17262b] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.allDay}
                        onChange={(e) => set('allDay', e.target.checked)}
                        className="accent-[#1f5c4d]"
                      />
                      All-day
                    </label>
                  )}

                  {form.kind !== 'event' && (
                    <div>
                      <label htmlFor="ce-weight" className={labelClass}>Grade weight (%)</label>
                      <input
                        id="ce-weight"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={form.weight}
                        onChange={(e) => set('weight', e.target.value)}
                        aria-invalid={!!errors.weight}
                        aria-describedby={errors.weight ? 'ce-weight-error' : undefined}
                        className={fieldClass('weight')}
                      />
                      {errorText('weight')}
                    </div>
                  )}

                  {isExam ? (
                    <>
                      <div>
                        <label htmlFor="ce-location" className={labelClass}>Location</label>
                        <input
                          id="ce-location"
                          value={form.location}
                          onChange={(e) => set('location', e.target.value)}
                          placeholder="Hill 114 (optional)"
                          className={fieldClass('location')}
                        />
                      </div>
                      <div>
                        <label htmlFor="ce-topics" className={labelClass}>Topics</label>
                        <input
                          id="ce-topics"
                          value={form.topics}
                          onChange={(e) => set('topics', e.target.value)}
                          placeholder="Trees, Big-O, Recursion (separate with commas)"
                          className={fieldClass('topics')}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="ce-url" className={labelClass}>Link</label>
                        <input
                          id="ce-url"
                          type="url"
                          value={form.url}
                          onChange={(e) => set('url', e.target.value)}
                          aria-invalid={!!errors.url}
                          aria-describedby={errors.url ? 'ce-url-error' : undefined}
                          placeholder="https:// (optional)"
                          className={fieldClass('url')}
                        />
                        {errorText('url')}
                      </div>
                      <div>
                        <label htmlFor="ce-desc" className={labelClass}>Notes</label>
                        <textarea
                          id="ce-desc"
                          rows={3}
                          value={form.desc}
                          onChange={(e) => set('desc', e.target.value)}
                          placeholder="Anything you want to remember (optional)"
                          className={fieldClass('desc')}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#dde3de]">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-white border border-[#dde3de] text-[#17262b] hover:bg-[#f2f4f0]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-sm font-bold bg-[#1f5c4d] text-white hover:bg-[#18493d]"
                  >
                    {editing ? 'Save changes' : 'Add to calendar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation / undo toast (stays visible after the dialog closes) */}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-4 px-4 py-3 rounded-xl bg-[#1e2a2e] text-white text-sm shadow-lg"
        >
          <span>{notice.text}</span>
          {notice.undo && (
            <button onClick={handleUndo} className="font-bold text-[#f4d958] underline">
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
};