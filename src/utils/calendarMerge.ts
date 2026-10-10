import type { Assignment, Exam } from '../types';

/** merge   = add new items, update changed ones, keep check marks and everything else
 *  replace = swap calendar data for the file's contents (notes are never touched) */
export type ImportMode = 'merge' | 'replace';

export interface MergeStats {
  added: number;
  updated: number;
  unchanged: number;
}

export interface MergeResult<T> {
  items: T[];
  stats: MergeStats;
}

export interface ImportSummary {
  assignments: MergeStats;
  exams: MergeStats;
  newCourses: string[]; // classes created in Notes for courses we had not seen
}

/** "CS 111" and "cs111" are the same course. */
export const courseKey = (code: string) => code.toLowerCase().replace(/\s+/g, '');

// Matches the START of a word so "Midterm1" and "Finals" count, but "Latest" does not.
const EXAM_TITLE_RE = /\b(exam|midterm|final|test|quiz)/i;

/** Turn assignments whose title looks like an exam into Exam entries (stable ids => no duplicates). */
export function detectExams(assignments: Assignment[]): Exam[] {
  return assignments
    .filter((a) => !a.uid.startsWith('study-block-') && EXAM_TITLE_RE.test(a.title))
    .map((a) => ({
      id: `exam-${a.uid}`,
      title: a.title,
      course: a.course,
      date: new Date(a.start).toISOString(),
      weight: a.weight || 25,
      location: 'See course syllabus',
      topics: ['Course Exam Topics'],
    }));
}

const sameTime = (a: Date | string, b: Date | string) => new Date(a).getTime() === new Date(b).getTime();

export function mergeAssignments(existing: Assignment[], imported: Assignment[], mode: ImportMode): MergeResult<Assignment> {
  if (mode === 'replace') {
    return { items: imported, stats: { added: imported.length, updated: 0, unchanged: 0 } };
  }
  const items = existing.slice();
  const index = new Map<string, number>();
  items.forEach((a, i) => index.set(a.uid, i));
  const stats: MergeStats = { added: 0, updated: 0, unchanged: 0 };

  for (const imp of imported) {
    const i = index.get(imp.uid);
    if (i === undefined) {
      index.set(imp.uid, items.length);
      items.push(imp);
      stats.added++;
      continue;
    }
    const cur = items[i];
    const changed =
      cur.title !== imp.title ||
      cur.course !== imp.course ||
      cur.all !== imp.all ||
      cur.desc !== imp.desc ||
      cur.url !== imp.url ||
      !sameTime(cur.start, imp.start);
    const newlyDone = imp.completed && !cur.completed;
    if (changed || newlyDone) {
      // Take the calendar's version of the details; keep local weight, AI fields and check mark.
      items[i] = changed
        ? { ...cur, title: imp.title, course: imp.course, start: imp.start, all: imp.all, desc: imp.desc, url: imp.url, completed: cur.completed || imp.completed }
        : { ...cur, completed: true };
      stats.updated++;
    } else {
      stats.unchanged++;
    }
  }
  return { items, stats };
}

export function mergeExams(existing: Exam[], imported: Exam[], mode: ImportMode): MergeResult<Exam> {
  if (mode === 'replace') {
    return { items: imported, stats: { added: imported.length, updated: 0, unchanged: 0 } };
  }
  const items = existing.slice();
  const index = new Map<string, number>();
  items.forEach((e, i) => index.set(e.id, i));
  const stats: MergeStats = { added: 0, updated: 0, unchanged: 0 };

  for (const imp of imported) {
    const i = index.get(imp.id);
    if (i === undefined) {
      index.set(imp.id, items.length);
      items.push(imp);
      stats.added++;
      continue;
    }
    const cur = items[i];
    if (cur.title !== imp.title || cur.course !== imp.course || !sameTime(cur.date, imp.date)) {
      // Only the calendar facts change; location, topics and weight you edited are kept.
      items[i] = { ...cur, title: imp.title, course: imp.course, date: imp.date };
      stats.updated++;
    } else {
      stats.unchanged++;
    }
  }
  return { items, stats };
}