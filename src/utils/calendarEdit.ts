import type { Assignment, Exam } from '../types';

/**
 * Pure helpers behind the manual calendar editor (no React in here, so they are easy to test).
 *
 * The editor shows ONE list of items. An exam that was created from an assignment
 * (Exam id = "exam-" + assignment uid) is shown once, as an exam, and edits/deletes
 * are applied to both halves so the calendar, To Do and Exams pages never disagree.
 */

export type ItemKind = 'assignment' | 'event' | 'exam';
export type RowKind = ItemKind | 'study';

export interface CalendarState {
  assignments: Assignment[];
  exams: Exam[];
}

/** What the form fields hold (everything is a string, like real inputs). */
export interface EditorForm {
  kind: ItemKind;
  title: string;
  course: string;
  date: string;     // YYYY-MM-DD
  time: string;     // HH:MM (24h)
  allDay: boolean;
  weight: string;   // % of grade, "0".."100"
  desc: string;
  url: string;
  location: string; // exams
  topics: string;   // exams, comma or line separated
}

/** Points at the thing being edited or deleted. */
export interface Target {
  source: 'assignment' | 'exam';
  id: string; // Assignment.uid or Exam.id
}

export interface EditorRow {
  key: string;
  target: Target;
  kind: RowKind;
  title: string;
  course: string;
  when: Date;
  allDay: boolean;
  completed: boolean;
}

/** Items taken out by a delete, kept so the delete can be undone. */
export interface Removed {
  assignments: Assignment[];
  exams: Exam[];
}

export const KIND_LABEL: Record<RowKind, string> = {
  assignment: 'Assignment',
  event: 'Event',
  exam: 'Exam',
  study: 'Study',
};

const STUDY_PREFIX = 'study-block-';
const DEFAULT_TIME = '23:59'; // Canvas-style "due at end of day"
const DEFAULT_LOCATION = 'See course syllabus';
const DEFAULT_TOPICS = ['Course Exam Topics'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const isStudy = (a: Assignment) => a.uid.startsWith(STUDY_PREFIX);
const examIdFor = (uid: string) => `exam-${uid}`;
const linkedUidFor = (examId: string) => (examId.startsWith('exam-') ? examId.slice(5) : null);

export const newUid = () => `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const toInputDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const toInputTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export function emptyForm(kind: ItemKind = 'assignment', day: Date = new Date()): EditorForm {
  return {
    kind,
    title: '',
    course: '',
    date: toInputDate(day),
    time: kind === 'exam' ? '10:00' : DEFAULT_TIME,
    allDay: false,
    weight: kind === 'exam' ? '25' : kind === 'assignment' ? '10' : '0',
    desc: '',
    url: '',
    location: '',
    topics: '',
  };
}

export function formFromAssignment(a: Assignment): EditorForm {
  const start = new Date(a.start);
  const kind: ItemKind = a.type === 'a' ? 'assignment' : 'event';
  return {
    ...emptyForm(kind, start),
    title: a.title,
    course: a.course === 'General' ? '' : a.course,
    time: toInputTime(start),
    allDay: a.all,
    weight: String(a.weight ?? 0),
    desc: a.desc || '',
    url: a.url && a.url !== '#' ? a.url : '',
  };
}

export function formFromExam(e: Exam): EditorForm {
  const when = new Date(e.date);
  return {
    ...emptyForm('exam', when),
    title: e.title,
    course: e.course === 'General' ? '' : e.course,
    time: toInputTime(when),
    weight: String(e.weight ?? 25),
    location: e.location === DEFAULT_LOCATION ? '' : e.location || '',
    topics: (e.topics || []).filter((t) => !DEFAULT_TOPICS.includes(t)).join(', '),
  };
}

/** Returns { fieldName: message } for every problem; an empty object means the form is valid. */
export function validateForm(f: EditorForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.title.trim()) errors.title = 'Give it a title.';
  else if (f.title.trim().length > 120) errors.title = 'Keep the title under 120 characters.';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date) || Number.isNaN(new Date(`${f.date}T00:00`).getTime())) {
    errors.date = 'Pick a valid date.';
  }
  if ((f.kind === 'exam' || !f.allDay) && !/^\d{2}:\d{2}$/.test(f.time)) {
    errors.time = 'Pick a time.';
  }
  if (f.kind !== 'event') {
    const w = Number(f.weight);
    if (f.weight.trim() === '' || !Number.isInteger(w) || w < 0 || w > 100) {
      errors.weight = 'Enter a whole number from 0 to 100.';
    }
  }
  if (f.kind !== 'exam' && f.url.trim() && !/^https?:\/\//i.test(f.url.trim())) {
    errors.url = 'Links should start with http:// or https://';
  }
  return errors;
}

/** The moment the item starts, as a local Date. All-day items sit at midnight. */
export function formToStart(f: EditorForm): Date {
  const [y, m, d] = f.date.split('-').map(Number);
  if (f.kind !== 'exam' && f.allDay) return new Date(y, m - 1, d);
  const [hh, mm] = (f.time || DEFAULT_TIME).split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

const courseOf = (f: EditorForm) => f.course.trim() || 'General';
const topicsOf = (f: EditorForm) => {
  const list = f.topics.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_TOPICS;
};

/** Add a brand-new item. The caller must validate the form first. */
export function addItem(state: CalendarState, f: EditorForm): CalendarState {
  const start = formToStart(f);
  if (f.kind === 'exam') {
    const exam: Exam = {
      id: examIdFor(newUid()),
      title: f.title.trim(),
      course: courseOf(f),
      date: start.toISOString(),
      weight: Number(f.weight),
      location: f.location.trim() || DEFAULT_LOCATION,
      topics: topicsOf(f),
    };
    return { ...state, exams: [...state.exams, exam] };
  }
  const item: Assignment = {
    uid: newUid(),
    title: f.title.trim(),
    course: courseOf(f),
    start,
    all: f.allDay,
    desc: f.desc.trim(),
    url: f.url.trim() || '#',
    type: f.kind === 'assignment' ? 'a' : 'e',
    weight: f.kind === 'assignment' ? Number(f.weight) : 0,
    completed: false,
  };
  return { ...state, assignments: [item, ...state.assignments] };
}

/** Save edits to an existing item (and to its linked twin, if it has one). */
export function updateItem(state: CalendarState, target: Target, f: EditorForm): CalendarState {
  const start = formToStart(f);
  const title = f.title.trim();
  const course = courseOf(f);

  if (target.source === 'assignment') {
    const exams = state.exams.map((e) =>
      e.id === examIdFor(target.id) ? { ...e, title, course, date: start.toISOString() } : e
    );
    const assignments = state.assignments.map((a) =>
      a.uid !== target.id
        ? a
        : {
            ...a, // keeps completed state and any AI priority fields
            title,
            course,
            start,
            all: f.allDay,
            desc: f.desc.trim(),
            url: f.url.trim() || '#',
            weight: a.type === 'a' ? Number(f.weight) : a.weight,
          }
    );
    return { assignments, exams };
  }

  const linkedUid = linkedUidFor(target.id);
  const exams = state.exams.map((e) =>
    e.id !== target.id
      ? e
      : {
          ...e,
          title,
          course,
          date: start.toISOString(),
          weight: Number(f.weight),
          location: f.location.trim() || DEFAULT_LOCATION,
          topics: topicsOf(f),
        }
  );
  const assignments = state.assignments.map((a) =>
    linkedUid && a.uid === linkedUid ? { ...a, title, course, start, all: false } : a
  );
  return { assignments, exams };
}

/** Remove an item (and its linked twin). `removed` is what undo needs to put back. */
export function deleteItem(state: CalendarState, target: Target): { next: CalendarState; removed: Removed } {
  const linkedUid = target.source === 'exam' ? linkedUidFor(target.id) : null;
  const assignmentUid = target.source === 'assignment' ? target.id : linkedUid;
  const examId = target.source === 'exam' ? target.id : examIdFor(target.id);

  const removed: Removed = {
    assignments: state.assignments.filter((a) => a.uid === assignmentUid),
    exams: state.exams.filter((e) => e.id === examId),
  };
  return {
    next: {
      assignments: state.assignments.filter((a) => a.uid !== assignmentUid),
      exams: state.exams.filter((e) => e.id !== examId),
    },
    removed,
  };
}

/** Put deleted items back (skips anything that already exists). */
export function restoreRemoved(state: CalendarState, removed: Removed): CalendarState {
  const haveA = new Set(state.assignments.map((a) => a.uid));
  const haveE = new Set(state.exams.map((e) => e.id));
  return {
    assignments: [...removed.assignments.filter((a) => !haveA.has(a.uid)), ...state.assignments],
    exams: [...state.exams, ...removed.exams.filter((e) => !haveE.has(e.id))],
  };
}

export type RowFilter = 'all' | RowKind;

/** Rows for the editor list: one row per item, soonest first. */
export function buildRows(
  state: CalendarState,
  opts: { query: string; filter: RowFilter; showPast: boolean; now?: Date }
): { rows: EditorRow[]; total: number } {
  const now = opts.now ?? new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const examIds = new Set(state.exams.map((e) => e.id));

  const all: EditorRow[] = [];
  for (const a of state.assignments) {
    if (examIds.has(examIdFor(a.uid))) continue; // shown through its exam row instead
    all.push({
      key: `a-${a.uid}`,
      target: { source: 'assignment', id: a.uid },
      kind: isStudy(a) ? 'study' : a.type === 'a' ? 'assignment' : 'event',
      title: a.title,
      course: a.course,
      when: new Date(a.start),
      allDay: a.all,
      completed: a.completed,
    });
  }
  for (const e of state.exams) {
    all.push({
      key: `e-${e.id}`,
      target: { source: 'exam', id: e.id },
      kind: 'exam',
      title: e.title,
      course: e.course,
      when: new Date(e.date),
      allDay: false,
      completed: false,
    });
  }

  const q = opts.query.trim().toLowerCase();
  const rows = all
    .filter((r) => !Number.isNaN(r.when.getTime()))
    .filter((r) => opts.filter === 'all' || r.kind === opts.filter)
    .filter((r) => opts.showPast || r.when.getTime() >= startOfToday)
    .filter((r) => !q || `${r.title} ${r.course}`.toLowerCase().includes(q))
    .sort((x, y) => x.when.getTime() - y.when.getTime());

  return { rows, total: all.length };
}

/** "Mon, Oct 12 · 11:59 PM" or "Mon, Oct 12 · All day" */
export function formatWhen(r: { when: Date; allDay: boolean }): string {
  const day = r.when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = r.allDay ? 'All day' : r.when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}