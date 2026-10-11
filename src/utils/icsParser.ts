import type { Assignment, Exam } from '../types';

/**
 * Result of reading an .ics file.
 *  - assignments: normal events (Canvas assignments, calendar events, study sessions)
 *  - exams:       events that Cadence itself exported as exams (X-CADENCE-KIND:EXAM)
 *  - skipped:     events ignored because they had no usable start date
 *  - recurring:   events with an RRULE (only their first occurrence is imported)
 */
export interface ParsedCalendar {
  assignments: Assignment[];
  exams: Exam[];
  skipped: number;
  recurring: number;
}

interface Prop {
  params: string; // e.g. ";TZID=America/New_York"
  value: string;
}

/** Undo iCalendar TEXT escaping in a single pass (\\ \; \, \n). */
const unescapeText = (s: string) =>
  s.replace(/\\([\\;,nN])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** Find one property line (NAME;PARAMS:VALUE) inside a VEVENT body. */
function getProp(raw: string, name: string): Prop | null {
  const m = raw.match(new RegExp(`^${name}((?:;[^:\\r\\n]*)?):(.*)$`, 'mi'));
  return m ? { params: m[1], value: m[2].trim() } : null;
}

/** Turn "wall clock time in zone tz" into the real instant. Returns null if tz is unknown. */
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    const offsetAt = (t: number) => {
      const p: Record<string, number> = {};
      for (const part of fmt.formatToParts(new Date(t))) {
        if (part.type !== 'literal') p[part.type] = Number(part.value);
      }
      return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
    };
    const wall = Date.UTC(y, mo - 1, d, h, mi, s);
    let t = wall - offsetAt(wall);
    t = wall - offsetAt(t); // second pass handles daylight-saving boundaries
    return new Date(t);
  } catch {
    return null; // e.g. Outlook's "Eastern Standard Time" is not an IANA name
  }
}

/** Read DTSTART. Handles all-day dates, UTC (Z), TZID zones and floating local times. */
function parseStart(prop: Prop): { date: Date; allDay: boolean } | null {
  const m = prop.value.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z)?)?/);
  if (!m) return null;
  const [, y, mo, da, h, mi, s, z] = m;
  const allDay = h === undefined; // plain date => all-day event

  // JavaScript silently rolls 13/99 over into a real date, so check the ranges ourselves.
  const daysInMonth = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
  if (Number(mo) < 1 || Number(mo) > 12 || Number(da) < 1 || Number(da) > daysInMonth) return null;
  if (!allDay && (Number(h) > 23 || Number(mi) > 59 || Number(s) > 60)) return null;

  let date: Date;
  if (allDay) {
    date = new Date(Number(y), Number(mo) - 1, Number(da));
  } else if (z) {
    date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(s)));
  } else {
    const tz = prop.params.match(/TZID="?([^;:"]+)"?/i)?.[1];
    date =
      (tz && zonedToDate(Number(y), Number(mo), Number(da), Number(h), Number(mi), Number(s), tz)) ||
      new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(s));
  }
  return Number.isNaN(date.getTime()) ? null : { date, allDay };
}

export function parseCalendar(icsText: string): ParsedCalendar {
  // Long lines are "folded" (CRLF + space); join them back first.
  const clean = icsText.replace(/\r?\n[ \t]/g, '');
  const assignments: Assignment[] = [];
  const exams: Exam[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let recurring = 0;

  clean.split('BEGIN:VEVENT').slice(1).forEach((block, index) => {
    // Drop reminders so their DESCRIPTION line is never mistaken for the event's.
    const raw = block.split('END:VEVENT')[0].replace(/BEGIN:VALARM[\s\S]*?END:VALARM/g, '');
    const text = (name: string) => unescapeText(getProp(raw, name)?.value ?? '').trim();

    const startProp = getProp(raw, 'DTSTART');
    const parsedStart = startProp ? parseStart(startProp) : null;
    if (!parsedStart) {
      skipped++; // never crash on a broken item
      return;
    }
    const { date: start, allDay: isAllDay } = parsedStart;

    const uid = text('UID') || `assignment-${index}-${Date.now()}`;
    if (seen.has(uid)) return; // same event listed twice
    seen.add(uid);
    if (/^RRULE/mi.test(raw)) recurring++;

    const isCadence = getProp(raw, 'X-CADENCE-TYPE') !== null; // exported by this app

    const summary = text('SUMMARY') || 'Untitled Assignment';
    const courseMatch = summary.match(/\[([^\]]+)\]\s*$/);
    const title = courseMatch ? summary.replace(courseMatch[0], '').trim() : summary;

    let course = 'General';
    if (courseMatch) {
      const parsedCourse = courseMatch[1].match(/^[A-Za-z]{2,5}[ :-]?\d{2,4}/);
      course = parsedCourse ? parsedCourse[0] : courseMatch[1];
    } else {
      const inlineCourse = title.match(/^([A-Za-z]{2,5}[ :-]?\d{2,4})/);
      if (inlineCourse) course = inlineCourse[0];
    }
    const exactCourse = text('X-CADENCE-COURSE');
    if (exactCourse) course = exactCourse;

    // Grade weight: exact value if we exported it, otherwise a keyword guess.
    const exportedWeight = parseInt(text('X-CADENCE-WEIGHT'), 10);
    let desc = text('DESCRIPTION');
    if (!isCadence) desc = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); // Canvas sends HTML

    let weight = 10;
    const lower = (title + ' ' + desc).toLowerCase();
    if (lower.includes('final') || lower.includes('capstone')) weight = 30;
    else if (lower.includes('midterm') || lower.includes('project')) weight = 25;
    else if (lower.includes('lab') || lower.includes('report') || lower.includes('essay')) weight = 15;
    else if (lower.includes('quiz') || lower.includes('homework') || lower.includes('problem set')) weight = 10;
    else if (lower.includes('discussion') || lower.includes('reading')) weight = 5;
    if (Number.isFinite(exportedWeight)) weight = exportedWeight;

    // Exams exported by Cadence come back as exams (with location and topics).
    if (text('X-CADENCE-KIND').toUpperCase() === 'EXAM') {
      const topics = text('X-CADENCE-TOPICS').split(' | ').map((t) => t.trim()).filter(Boolean);
      exams.push({
        id: uid,
        title,
        course,
        date: start.toISOString(),
        weight: Number.isFinite(exportedWeight) ? exportedWeight : 25,
        location: text('LOCATION') || 'See course syllabus',
        topics: topics.length > 0 ? topics : ['Course Exam Topics'],
      });
      return;
    }

    const url = text('URL') || '#';
    const exportedType = text('X-CADENCE-TYPE');
    const looksLikeAssignment = /assignment|quiz|homework|lab|exam|due|problem set|project|paper|essay/i.test(uid + ' ' + title);
    const type: 'a' | 'e' =
      exportedType === 'a' || exportedType === 'e' ? exportedType : looksLikeAssignment ? 'a' : 'e';

    assignments.push({
      uid,
      title,
      course,
      start,
      all: isAllDay,
      desc,
      url,
      type,
      weight,
      completed: text('X-CADENCE-COMPLETED').toUpperCase() === 'TRUE',
    });
  });

  return { assignments, exams, skipped, recurring };
}

/** Backwards-compatible helper: assignments only. */
export function parseICS(icsText: string): Assignment[] {
  return parseCalendar(icsText).assignments;
}