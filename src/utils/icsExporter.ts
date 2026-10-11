import type { Assignment, Exam } from '../types';

export interface ExportOptions {
  includeCompleted: boolean;      // also export assignments that are ticked off
  includeExams: boolean;          // export the Exams list as 2-hour events
  includeStudySessions: boolean;  // export AI-planned "Study Session" blocks
  reminder: 'none' | '1d' | '1h'; // popup alarm for open assignments and exams
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeCompleted: false,
  includeExams: true,
  includeStudySessions: true,
  reminder: '1d',
};

export interface ExportResult {
  text: string;          // the full .ics file
  assignments: number;   // assignments + plain calendar events
  exams: number;
  studySessions: number;
  skipped: number;       // items dropped because their date was invalid
}

const EXAM_MINUTES = 120;          // exams have no length in Cadence, so show 2 hours
const DEFAULT_STUDY_MINUTES = 60;
const STUDY_PREFIX = 'study-block-'; // uid prefix App.tsx gives to planned study sessions

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 20261012T235900Z  (UTC, so no VTIMEZONE block is needed and every app agrees on the time) */
const toUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}` +
  `T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

/** 20261012  (calendar date as the student sees it, for all-day events) */
const toDateOnly = (d: Date) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

/** iCalendar TEXT escaping: backslash, semicolon, comma, newline. */
const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines must be at most 75 octets (bytes). Fold by bytes without splitting a character. */
function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) { // iterates whole characters, never half an emoji
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // continuation lines start with one space
    }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

interface EventSpec {
  uid: string;
  summary: string;
  start: Date;
  allDay: boolean;
  minutes: number;              // length of a timed event (0 = a point in time, like a due date)
  description?: string;
  location?: string;
  url?: string;
  category: string;
  busy: boolean;                // false => shows as "free" so deadlines don't block your day
  alarm?: 'none' | '1d' | '1h';
  x: Record<string, string>;    // X-CADENCE-* fields so re-importing restores everything
}

function eventLines(e: EventSpec, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(e.uid)}`, `DTSTAMP:${stamp}`];

  if (e.allDay) {
    const next = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${toDateOnly(e.start)}`, `DTEND;VALUE=DATE:${toDateOnly(next)}`); // DTEND is exclusive
  } else {
    lines.push(`DTSTART:${toUtc(e.start)}`, `DTEND:${toUtc(new Date(e.start.getTime() + e.minutes * 60000))}`);
  }

  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.url && /^https?:\/\//i.test(e.url)) lines.push(`URL:${e.url}`);
  lines.push(`CATEGORIES:${escapeText(e.category)}`, 'STATUS:CONFIRMED', `TRANSP:${e.busy ? 'OPAQUE' : 'TRANSPARENT'}`);
  for (const [k, v] of Object.entries(e.x)) lines.push(`X-CADENCE-${k}:${escapeText(v)}`);

  if (e.alarm && e.alarm !== 'none') {
    // All-day events have no clock time, so remind at 9 AM the day before.
    const trigger = e.allDay ? '-PT15H' : e.alarm === '1d' ? '-P1D' : '-PT1H';
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

const isStudySession = (a: Assignment) => a.uid.startsWith(STUDY_PREFIX);
const withCourse = (title: string, course: string) =>
  course && course !== 'General' ? `${title} [${course}]` : title;

/** Build the .ics text for the chosen assignments, exams and study sessions. */
export function buildICS(assignments: Assignment[], exams: Exam[], opts: ExportOptions): ExportResult {
  const stamp = toUtc(new Date());
  const body: string[] = [];
  const count = { assignments: 0, exams: 0, studySessions: 0, skipped: 0 };

  // Exams first, so assignments that are the source of an exam are not exported twice.
  const exportedExamIds = new Set<string>();
  if (opts.includeExams) {
    for (const ex of exams) {
      const start = new Date(ex.date);
      if (Number.isNaN(start.getTime())) {
        count.skipped++;
        continue;
      }
      exportedExamIds.add(ex.id);
      count.exams++;
      body.push(...eventLines({
        uid: ex.id,
        summary: withCourse(ex.title, ex.course),
        start,
        allDay: false,
        minutes: EXAM_MINUTES,
        description: `Topics: ${(ex.topics || []).join(', ')}\nWeight: ${ex.weight}% of course grade`,
        location: ex.location,
        category: 'Exam',
        busy: true,
        alarm: opts.reminder,
        x: {
          KIND: 'EXAM',
          TYPE: 'e',
          COURSE: ex.course,
          WEIGHT: String(ex.weight),
          TOPICS: (ex.topics || []).join(' | '),
        },
      }, stamp));
    }
  }

  for (const a of assignments) {
    const study = isStudySession(a);
    if (study && !opts.includeStudySessions) continue;
    if (!study && a.completed && !opts.includeCompleted) continue;
    if (exportedExamIds.has(`exam-${a.uid}`)) continue; // already exported as an exam

    const start = new Date(a.start);
    if (Number.isNaN(start.getTime())) {
      count.skipped++;
      continue;
    }

    const minutes = study ? parseInt(a.desc.match(/Duration:\s*(\d+)\s*m/i)?.[1] ?? '', 10) || DEFAULT_STUDY_MINUTES : 0;
    if (study) count.studySessions++;
    else count.assignments++;

    body.push(...eventLines({
      uid: a.uid,
      summary: withCourse(a.title, a.course),
      start,
      allDay: a.all,
      minutes,
      description: a.desc,
      url: a.url,
      category: study ? 'Study Session' : a.type === 'a' ? 'Assignment' : 'Event',
      busy: study,
      alarm: !study && a.type === 'a' && !a.completed ? opts.reminder : 'none',
      x: {
        TYPE: a.type,
        COURSE: a.course,
        WEIGHT: String(a.weight),
        COMPLETED: a.completed ? 'TRUE' : 'FALSE',
      },
    }, stamp));
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cadence Study//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Cadence Study',
    ...body,
    'END:VCALENDAR',
  ];
  // The spec requires CRLF line endings, including after the last line.
  return { text: lines.map(foldLine).join('\r\n') + '\r\n', ...count };
}

export function exportFilename(): string {
  const d = new Date();
  return `cadence-calendar-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.ics`;
}

/** Trigger a browser download of the .ics text. */
export function downloadICS(text: string, filename: string = exportFilename()): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}