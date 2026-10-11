import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ScheduleView } from './components/ScheduleView';
import type { ChatCalendarEvent } from '../files/ClassChatbot';
import { ImportsView } from './components/ImportsView';
import { ToDoView } from './components/ToDoView';
import { NotesView } from './components/NotesView';
import { ExamsView } from './components/ExamsView';
import { StudyLockdownModal } from '../studyLockdown/StudyLockdownModal';
import { Assignment, ClassItem, Exam, Folder, ScheduleBlock, ViewTab } from './types';
import type { ParsedCalendar } from './utils/icsParser';
import {
  ImportMode,
  ImportSummary,
  courseKey,
  detectExams,
  mergeAssignments,
  mergeExams,
} from './utils/calendarMerge';
import {
  generateInitialAssignments,
  generateInitialExams,
  generateInitialFolders,
  getCourseColor,
} from './utils/sampleData';

export default function App() {
  // Student Name
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('cadence_user_name') || 'Student';
  });

  // Current active navigation tab (matches PDF sidebar wireframe)
  const [currentTab, setCurrentTab] = useState<ViewTab>('schedule');

  // Core Data States - Initially clean with NO placeholder classes until the user imports their ical
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem('cadence_assignments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Clear old placeholder data if present
        if (Array.isArray(parsed) && parsed.some((a: any) => a.uid === 'assign-1')) {
          localStorage.removeItem('cadence_assignments');
          return [];
        }
        const restoredAssignments = parsed.map((a: any) => ({ ...a, start: new Date(a.start) }));
        const seenChatUids = new Set<string>();
        return restoredAssignments.filter((assignment: Assignment) => {
          if (!assignment.uid.startsWith('chat-')) return true;
          if (seenChatUids.has(assignment.uid)) return false;
          seenChatUids.add(assignment.uid);
          return true;
        });
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem('cadence_exams');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((e: any) => e.id === 'exam-1')) {
          localStorage.removeItem('cadence_exams');
          return [];
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('cadence_folders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((f: any) => f.id === 'folder-fall-26')) {
          localStorage.removeItem('cadence_folders');
          return [];
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Sync state
  const [syncedTime, setSyncedTime] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  // Gemini insights
  const [geminiInsight, setGeminiInsight] = useState<string>(
    'Gemini is ready to analyze your coursework, calculate grade weights, and streamline your study schedule.'
  );
  const [scheduleRecommendation, setScheduleRecommendation] = useState<string>(
    'Import your Canvas calendar feed (.ics) to begin personalized AI task scheduling.'
  );

  // Study Lockdown Modal
  const [studyLockdown, setStudyLockdown] = useState<{
    isOpen: boolean;
    courseName: string;
    unitName: string;
    notesContent: string;
  }>({
    isOpen: false,
    courseName: '',
    unitName: '',
    notesContent: '',
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('cadence_user_name', userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem('cadence_assignments', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem('cadence_exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('cadence_folders', JSON.stringify(folders));
  }, [folders]);

  // Handler: Toggle Assignment Complete
  const handleToggleComplete = (uid: string) => {
    setAssignments((prev) =>
      prev.map((a) => (a.uid === uid ? { ...a, completed: !a.completed } : a))
    );
  };

  // Handler: Add Custom Assignment
  const handleAddAssignment = (newA: Assignment) => {
    setAssignments((prev) => [newA, ...prev]);
  };

  const handleAddClassEvents = (events: ChatCalendarEvent[]): ChatCalendarEvent[] => {
    const knownUids = new Set(assignments.map((assignment) => assignment.uid));
    const seenUids = new Set<string>();
    const newEvents = events.filter((event) => {
      if (knownUids.has(event.uid) || seenUids.has(event.uid)) return false;
      seenUids.add(event.uid);
      return true;
    });
    if (newEvents.length === 0) return [];

    const newAssignments: Assignment[] = newEvents.map((event) => ({
      uid: event.uid,
      title: event.title,
      course: event.course,
      start: new Date(event.start),
      all: false,
      desc: event.location ? `Class meeting in ${event.location}. Ends at ${new Date(event.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : '',
      url: '#',
      type: 'e',
      weight: 0,
      completed: false,
    }));
    setAssignments((prev) => {
      const currentUids = new Set(prev.map((assignment) => assignment.uid));
      return [...newAssignments.filter((assignment) => !currentUids.has(assignment.uid)), ...prev];
    });
    return newEvents;
  };

  const handleRemoveClassEvents = (uids: string[]) => {
    const removedUids = new Set(uids);
    setAssignments((prev) => prev.filter((assignment) => !removedUids.has(assignment.uid)));
  };

  // Build a class card (with starter units) for a course code
  const buildClass = (courseCode: string, folderId: string, idx: number): ClassItem => {
    const stamp = Date.now();
    return {
      id: `class-${stamp}-${idx}`,
      name: courseCode,
      code: courseCode,
      color: getCourseColor(courseCode),
      folderId,
      units: [
        {
          id: `unit-1-${stamp}-${idx}`,
          name: 'Unit 1: Syllabus & Foundations',
          notes: `Course notes and materials for ${courseCode}. Add lecture notes, formulas, and homework briefs here.`,
        },
        {
          id: `unit-2-${stamp}-${idx}`,
          name: 'Unit 2: Core Concepts & Practice',
          notes: `Important lecture topics and practice problems for ${courseCode}.`,
        },
        {
          id: `unit-3-${stamp}-${idx}`,
          name: 'Unit 3: Midterm & Exam Preparation',
          notes: `High-yield exam takeaways and formula cheat sheets for ${courseCode}.`,
        },
      ],
    };
  };

  // Handler: Import a parsed calendar (Canvas feed, .ics file or pasted text).
  //  - 'merge'   adds new items and updates changed ones, keeping check marks and AI fields
  //  - 'replace' swaps the calendar data for the file's contents
  // Either way, existing notes and folders are never deleted.
  const handleImportCalendar = (parsed: ParsedCalendar, mode: ImportMode): ImportSummary => {
    // Exams come from two places: events this app exported as exams, and exam-like titles
    const importedExams = [...parsed.exams];
    for (const e of detectExams(parsed.assignments)) {
      if (!importedExams.some((x) => x.id === e.id)) importedExams.push(e);
    }

    const mergedAssignments = mergeAssignments(assignments, parsed.assignments, mode);
    const mergedExams = mergeExams(exams, importedExams, mode);
    setAssignments(mergedAssignments.items);
    setExams(mergedExams.items);

    // Create classes only for courses we have not seen before
    const known = new Set(folders.flatMap((f) => f.classes.map((c) => courseKey(c.code))));
    const newCourses: string[] = [];
    for (const c of [...parsed.assignments.map((a) => a.course), ...importedExams.map((e) => e.course)]) {
      if (c && c !== 'General' && !known.has(courseKey(c))) {
        known.add(courseKey(c));
        newCourses.push(c);
      }
    }
    if (newCourses.length === 0 && folders.length === 0 && parsed.assignments.length > 0) {
      newCourses.push('General Coursework');
    }

    if (newCourses.length > 0) {
      const target = folders.find((f) => f.name === 'Current Semester');
      const folderId = target ? target.id : `folder-${Date.now()}`;
      const classes = newCourses.map((code, idx) => buildClass(code, folderId, idx));
      setFolders(
        target
          ? folders.map((f) => (f.id === folderId ? { ...f, classes: [...f.classes, ...classes] } : f))
          : [...folders, { id: folderId, name: 'Current Semester', classes }]
      );
    }

    setSyncedTime(new Date());
    return { assignments: mergedAssignments.stats, exams: mergedExams.stats, newCourses };
  };

  // Handler: Apply Schedule Blocks to Calendar
  const handleApplyScheduleToCalendar = (blocks: ScheduleBlock[]) => {
    const newStudyEvents: Assignment[] = blocks.map((b, i) => {
      const d = new Date();
      d.setDate(d.getDate() + (i % 7));
      d.setHours(16, 0, 0, 0);

      return {
        uid: `study-block-${Date.now()}-${i}`,
        title: `Study Session: ${b.taskTitle}`,
        course: b.course,
        start: d,
        all: false,
        desc: `AI-organized study session. Time: ${b.time}. Duration: ${b.duration}. Focus tip: ${b.notes}`,
        url: '#',
        type: 'e',
        weight: 0,
        completed: false,
      };
    });

    setAssignments((prev) => [...newStudyEvents, ...prev]);
  };

  // Handler: Reset Sample Data (if explicitly chosen)
  const handleResetSampleData = () => {
    setAssignments(generateInitialAssignments());
    setExams(generateInitialExams());
    setFolders(generateInitialFolders());
    setSyncedTime(new Date());
    setCurrentTab('schedule');
  };

  // Handler: Refresh Canvas
  const handleRefresh = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncedTime(new Date());
    }, 800);
  };

  // Handler: Update Gemini Prioritization
  const handlePrioritizeWithGemini = (
    prioritizedList: Assignment[],
    insight: string,
    scheduleRec: string
  ) => {
    setAssignments(prioritizedList);
    setGeminiInsight(insight);
    setScheduleRecommendation(scheduleRec);
  };

  // Handler: Add Exam
  const handleAddExam = (newExam: Exam) => {
    setExams((prev) => [...prev, newExam]);
  };

  // Handler: Launch Study Session
  const handleLaunchStudySession = (
    courseName = '',
    unitName = '',
    notesText = ''
  ) => {
    const course = courseName || (folders[0]?.classes[0]?.code) || 'General Study';
    const unit = unitName || 'Focus Sprint';
    let notes = notesText;
    if (!notes) {
      const cls = folders[0]?.classes.find(
        (c) => c.name.includes(course) || c.code.includes(course)
      );
      notes = cls?.units[0]?.notes || 'Focus session on core textbook concepts, practice problems, and formulas.';
    }

    setStudyLockdown({
      isOpen: true,
      courseName: course,
      unitName: unit,
      notesContent: notes,
    });
  };

  const activeTasksCount = assignments.filter((a) => a.type === 'a' && !a.completed).length;

  return (
    <div className="min-h-screen bg-[#f2f4f0] text-[#17262b] flex flex-col font-['DM_Sans',sans-serif]">
      {/* Top Header matching PDF wireframe: "Welcome Name!" on left, "Study Time!" on right */}
      <Header
        userName={userName}
        onUpdateName={setUserName}
        onOpenStudyTime={() => handleLaunchStudySession()}
        syncedTime={syncedTime}
        isSyncing={isSyncing}
        onRefresh={handleRefresh}
        activeTasksCount={activeTasksCount}
      />

      {/* Main Layout: Left Sidebar Navigation + Main Content Area */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Sidebar matching PDF wireframe (Imports, To Do, Notes, Exams) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          assignmentCount={activeTasksCount}
          examCount={exams.length}
        />

        {/* Dynamic Content Views */}
        <main className="flex-1 min-w-0">
          {currentTab === 'schedule' && (
            <ScheduleView
              assignments={assignments}
              exams={exams}
              onToggleComplete={handleToggleComplete}
              onNavigateToExams={() => setCurrentTab('exams')}
              onNavigateToNotes={() => setCurrentTab('notes')}
              onNavigateToImports={() => setCurrentTab('imports')}
              onApplyScheduleToCalendar={handleApplyScheduleToCalendar}
              onAddClassEvents={handleAddClassEvents}
              onRemoveClassEvents={handleRemoveClassEvents}
            />
          )}

          {currentTab === 'imports' && (
            <ImportsView
              assignments={assignments}
              exams={exams}
              onImportCalendar={handleImportCalendar}
              onViewSchedule={() => setCurrentTab('schedule')}
              onResetSampleData={handleResetSampleData}
            />
          )}

          {currentTab === 'todo' && (
            <ToDoView
              assignments={assignments}
              onToggleComplete={handleToggleComplete}
              onAddAssignment={handleAddAssignment}
              onPrioritizeWithGemini={handlePrioritizeWithGemini}
              geminiInsight={geminiInsight}
              scheduleRecommendation={scheduleRecommendation}
            />
          )}

          {currentTab === 'notes' && (
            <NotesView
              folders={folders}
              onUpdateFolders={setFolders}
              onLaunchStudySession={(course, unit, notes) =>
                handleLaunchStudySession(course, unit, notes)
              }
            />
          )}

          {currentTab === 'exams' && (
            <ExamsView
              exams={exams}
              onAddExam={handleAddExam}
              onLaunchStudySession={(course, unit, notes) =>
                handleLaunchStudySession(course, unit, notes)
              }
            />
          )}
        </main>
      </div>

      {/* Study Sesh Lockdown Overlay Modal */}
      {studyLockdown.isOpen && (
        <StudyLockdownModal
          courseName={studyLockdown.courseName}
          unitName={studyLockdown.unitName}
          notesContent={studyLockdown.notesContent}
          onClose={() => setStudyLockdown((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}