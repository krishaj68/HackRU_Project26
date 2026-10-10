import { Assignment } from '../types';

export function parseICS(icsText: string): Assignment[] {
  const clean = icsText.replace(/\r?\n[ \t]/g, '');
  const events: Assignment[] = [];

  const rawEvents = clean.split('BEGIN:VEVENT').slice(1);

  rawEvents.forEach((block, index) => {
    const raw = block.split('END:VEVENT')[0];

    const getField = (fieldName: string) => {
      const match = raw.match(new RegExp(`^${fieldName}(?:;[^:\\r\\n]*)?:(.*)$`, 'mi'));
      if (!match) return '';
      return match[1]
        .trim()
        .replace(/\\n/gi, '\n')
        .replace(/\\([,;\\])/g, '$1');
    };

    const dtStartStr = getField('DTSTART');
    const m = dtStartStr.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z)?)?/);
    if (!m) return;

    const [, y, mo, da, h, mi, s, z] = m;
    const isAllDay = h === undefined;
    const start = isAllDay
      ? new Date(+y, +mo - 1, +da)
      : z
      ? new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +s))
      : new Date(+y, +mo - 1, +da, +h, +mi, +s);

    const summary = getField('SUMMARY') || 'Untitled Assignment';
    const courseMatch = summary.match(/\[([^\]]+)\]\s*$/);
    const title = courseMatch ? summary.replace(courseMatch[0], '').trim() : summary;

    let course = 'General';
    if (courseMatch) {
      const parsedCourse = courseMatch[1].match(/^[A-Za-z]{2,5}[ :-]?\d{2,4}/);
      course = parsedCourse ? parsedCourse[0] : courseMatch[1];
    } else {
      const inlineCourse = title.match(/^([A-Za-z]{2,5}[ :-]?\d{2,4})/);
      if (inlineCourse) {
        course = inlineCourse[0];
      }
    }

    const uid = getField('UID') || `assignment-${index}-${Date.now()}`;
    const desc = getField('DESCRIPTION')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const url = getField('URL') || '#';

    // Heuristics for weight percentage based on keyword
    let weight = 10;
    const lower = (title + ' ' + desc).toLowerCase();
    if (lower.includes('final') || lower.includes('capstone')) {
      weight = 30;
    } else if (lower.includes('midterm') || lower.includes('project')) {
      weight = 25;
    } else if (lower.includes('lab') || lower.includes('report') || lower.includes('essay')) {
      weight = 15;
    } else if (lower.includes('quiz') || lower.includes('homework') || lower.includes('problem set')) {
      weight = 10;
    } else if (lower.includes('discussion') || lower.includes('reading')) {
      weight = 5;
    }

    const isAssignment = /assignment|quiz|homework|lab|exam|due|problem set|project|paper|essay/i.test(uid + ' ' + title);

    events.push({
      uid,
      title,
      course,
      start,
      all: isAllDay,
      desc,
      url,
      type: isAssignment ? 'a' : 'e',
      weight,
      completed: false,
    });
  });

  return events;
}
