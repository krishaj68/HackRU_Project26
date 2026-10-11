import assert from 'node:assert/strict';
import { parseCalendar } from '../src/utils/icsParser.ts';
import { buildICS, DEFAULT_EXPORT_OPTIONS } from '../src/utils/icsExporter.ts';
import { mergeAssignments, mergeExams, detectExams } from '../src/utils/calendarMerge.ts';

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };
const A = (o: any) => ({ uid: 'u', title: 'T', course: 'General', start: new Date(), all: false, desc: '', url: '#', type: 'a', weight: 10, completed: false, ...o });

const longDesc = 'Résumé, café; naïve — 日本語のテスト 🎓 emoji line\nsecond line with \\ backslash and, commas; semicolons. ' + 'x'.repeat(200);
const assignments: any[] = [
  A({ uid: 'a1', title: 'Lab 4: Recursion, Trees; more', course: 'CS 111', start: new Date('2026-10-12T03:59:00Z'), desc: longDesc, url: 'https://canvas.example.edu/a1', weight: 15 }),
  A({ uid: 'a2', title: 'Reading', course: 'ENG 101', start: new Date(2026, 9, 14), all: true, weight: 5 }),
  A({ uid: 'a3', title: 'Done HW', course: 'MATH 151', start: new Date('2026-10-01T20:00:00Z'), completed: true, weight: 20 }),
  A({ uid: 'a4', title: 'Midterm Exam', course: 'CS 111', start: new Date('2026-10-20T14:00:00Z'), weight: 25 }),
  A({ uid: 'study-block-1-0', title: 'Study Session: Lab 4', course: 'CS 111', start: new Date('2026-10-11T20:00:00Z'), type: 'e', weight: 0, desc: 'AI-organized study session. Duration: 90m. Focus tip: go' }),
  A({ uid: 'e1', title: 'Office hours', start: new Date('2026-10-13T15:00:00Z'), type: 'e', weight: 0 }),
];
const exams: any[] = [
  { id: 'exam-a4', title: 'Midterm Exam', course: 'CS 111', date: '2026-10-20T14:00:00.000Z', weight: 25, location: 'Hill 114', topics: ['Trees', 'Big-O, analysis'] },
  { id: 'exam-custom', title: 'Chem Practical', course: 'CHEM 101', date: '2026-11-02T18:30:00.000Z', weight: 20, location: 'See course syllabus', topics: ['Titration'] },
];
const opts = { ...DEFAULT_EXPORT_OPTIONS, includeCompleted: true };

ok('export is valid iCalendar framing, CRLF, folded <=75 bytes', () => {
  const r = buildICS(assignments, exams, opts);
  assert.ok(r.text.startsWith('BEGIN:VCALENDAR\r\n') && r.text.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(r.text), 'bare LF found');
  for (const line of r.text.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, 'too long: ' + line);
  assert.equal(r.exams, 2); assert.equal(r.studySessions, 1);
  assert.equal(r.assignments, 4); // a1 a2 a3 + e1; a4 deduped into its exam
});

ok('round trip restores every field', () => {
  const p = parseCalendar(buildICS(assignments, exams, opts).text);
  assert.equal(p.skipped, 0);
  const by = (u: string) => p.assignments.find((a) => a.uid === u)!;
  const a1 = by('a1');
  assert.equal(a1.title, 'Lab 4: Recursion, Trees; more'); assert.equal(a1.course, 'CS 111');
  assert.equal(a1.desc, longDesc); assert.equal(a1.url, 'https://canvas.example.edu/a1');
  assert.equal(a1.weight, 15); assert.equal(a1.start.toISOString(), '2026-10-12T03:59:00.000Z'); assert.equal(a1.all, false);
  const a2 = by('a2'); assert.equal(a2.all, true); assert.equal(a2.start.getDate(), 14); assert.equal(a2.start.getMonth(), 9);
  assert.equal(by('a3').completed, true); assert.equal(by('a1').completed, false);
  assert.equal(by('e1').type, 'e'); assert.equal(by('study-block-1-0').type, 'e');
  assert.equal(by('a4'), undefined); // came back as an exam instead
  assert.equal(p.exams.length, 2);
  const m = p.exams.find((e) => e.id === 'exam-a4')!;
  assert.deepEqual(m.topics, ['Trees', 'Big-O, analysis']); assert.equal(m.location, 'Hill 114'); assert.equal(m.weight, 25);
  assert.equal(m.date, '2026-10-20T14:00:00.000Z'); assert.equal(m.course, 'CS 111');
});

ok('options: completed / exams / study sessions / reminders', () => {
  const none = buildICS(assignments, exams, { includeCompleted: false, includeExams: false, includeStudySessions: false, reminder: 'none' });
  assert.equal(none.exams, 0); assert.equal(none.studySessions, 0); assert.equal(none.assignments, 4); // a4 now exported as assignment, a3 hidden
  assert.ok(!none.text.includes('VALARM'));
  const day = buildICS(assignments, exams, { ...opts, reminder: '1d' }).text;
  assert.ok(day.includes('TRIGGER:-P1D') && day.includes('TRIGGER:-PT15H')); // timed + all-day
  assert.ok(buildICS(assignments, exams, { ...opts, reminder: '1h' }).text.includes('TRIGGER:-PT1H'));
});

ok('invalid dates are skipped, not fatal', () => {
  const r = buildICS([A({ uid: 'bad', start: new Date('nope') }), assignments[0]], [], opts);
  assert.equal(r.skipped, 1); assert.equal(r.assignments, 1);
});

const canvas = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Instructure//Canvas//EN',
  'BEGIN:VEVENT', 'UID:event-assignment-1', 'DTSTART:20261015T035900Z', 'DTEND:20261015T035900Z',
  'SUMMARY:Problem Set 6 [MATH151-FALL26]', 'DESCRIPTION:<p>Solve <b>all</b> integrals</p>', ' ', 'URL:https://canvas.example.edu/p6', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:event-assignment-2', 'DTSTART;VALUE=DATE:20261016', 'SUMMARY:Reading Response', 'END:VEVENT',            // all-day, no DTEND
  'BEGIN:VEVENT', 'UID:no-start', 'SUMMARY:Broken', 'END:VEVENT',                                                       // no DTSTART
  'BEGIN:VEVENT', 'UID:bad-date', 'DTSTART:20261399T000000Z', 'SUMMARY:Bad date', 'END:VEVENT',                         // impossible date
  'BEGIN:VEVENT', 'UID:event-assignment-1', 'DTSTART:20261015T035900Z', 'SUMMARY:Problem Set 6 [MATH151-FALL26]', 'END:VEVENT', // duplicate
  'BEGIN:VEVENT', 'UID:tz', 'DTSTART;TZID=America/Los_Angeles:20261015T090000', 'SUMMARY:Lecture', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:outlook-tz', 'DTSTART;TZID=Eastern Standard Time:20261015T090000', 'SUMMARY:Outlook one', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:alarm-first', 'DTSTART:20261017T100000Z', 'SUMMARY:Has alarm', 'BEGIN:VALARM', 'DESCRIPTION:ALARM TEXT', 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:weekly', 'DTSTART:20261018T100000Z', 'RRULE:FREQ=WEEKLY;COUNT=5', 'SUMMARY:Weekly quiz', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

ok('Canvas-style feed: edge cases', () => {
  const p = parseCalendar(canvas);
  assert.equal(p.skipped, 2); assert.equal(p.recurring, 1);
  assert.equal(p.assignments.length, 6);
  const get = (u: string) => p.assignments.find((a) => a.uid === u)!;
  assert.equal(get('event-assignment-1').title, 'Problem Set 6'); assert.equal(get('event-assignment-1').course, 'MATH151');
  assert.equal(get('event-assignment-1').desc, 'Solve all integrals');
  assert.equal(get('event-assignment-2').all, true);
  assert.equal(get('tz').start.toISOString(), '2026-10-15T16:00:00.000Z'); // PDT = UTC-7
  assert.equal(get('outlook-tz').start.getHours(), 9);                      // unknown zone name -> local time
  assert.equal(get('alarm-first').desc, '');                                // VALARM text ignored
});

ok('DST: TZID winter vs summer offset', () => {
  const mk = (d: string) => parseCalendar(`BEGIN:VEVENT\r\nUID:x\r\nDTSTART;TZID=America/New_York:${d}\r\nSUMMARY:s\r\nEND:VEVENT`).assignments[0].start.toISOString();
  assert.equal(mk('20261215T090000'), '2026-12-15T14:00:00.000Z'); // EST UTC-5
  assert.equal(mk('20260715T090000'), '2026-07-15T13:00:00.000Z'); // EDT UTC-4
});

ok('merge keeps check marks, reports stats', () => {
  const existing = [A({ uid: 'a1', title: 'Old', start: new Date('2026-10-12T03:59:00Z'), completed: true, weight: 99 }), A({ uid: 'keep', title: 'Local only' })];
  const incoming = [A({ uid: 'a1', title: 'New title', start: new Date('2026-10-13T03:59:00Z') }), A({ uid: 'n1', title: 'Fresh' })];
  const r = mergeAssignments(existing as any, incoming as any, 'merge');
  assert.deepEqual(r.stats, { added: 1, updated: 1, unchanged: 0 });
  const a1 = r.items.find((a) => a.uid === 'a1')!; assert.equal(a1.title, 'New title'); assert.equal(a1.completed, true); assert.equal(a1.weight, 99);
  assert.ok(r.items.some((a) => a.uid === 'keep'));
  const again = mergeAssignments(r.items, incoming as any, 'merge'); assert.deepEqual(again.stats, { added: 0, updated: 0, unchanged: 2 }); // idempotent
  assert.equal(mergeAssignments(existing as any, incoming as any, 'replace').items.length, 2);
});

ok('exam detection + merge keeps edited location', () => {
  const ex = detectExams([A({ uid: 'q', title: 'Quiz 3' }), A({ uid: 'm', title: 'Midterm1' }), A({ uid: 'l', title: 'Latest reading' }), A({ uid: 'study-block-9', title: 'Study Session: Midterm' })] as any);
  assert.deepEqual(ex.map((e) => e.id), ['exam-q', 'exam-m']);
  const cur = [{ ...ex[0], location: 'Room 5', topics: ['x'] }];
  const r = mergeExams(cur as any, [{ ...ex[0], title: 'Quiz 3 (moved)' }] as any, 'merge');
  assert.equal(r.items[0].location, 'Room 5'); assert.equal(r.items[0].title, 'Quiz 3 (moved)'); assert.deepEqual(r.stats, { added: 0, updated: 1, unchanged: 0 });
});

console.log(`\n${n} test groups passed`);