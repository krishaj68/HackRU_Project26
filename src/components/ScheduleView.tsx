import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, Clock, AlertTriangle, ExternalLink, Sparkles, DownloadCloud } from 'lucide-react';
import { Assignment, Exam, ScheduleBlock } from '../types';
import { getCourseColor } from '../utils/sampleData';
import { GeminiSchedulePlannerModal } from './GeminiSchedulePlannerModal';
import ClassChatbot, { ChatCalendarEvent } from '../../files/ClassChatbot';

interface ScheduleViewProps {
  assignments: Assignment[];
  exams: Exam[];
  onToggleComplete: (uid: string) => void;
  onNavigateToExams: () => void;
  onNavigateToNotes: (courseCode?: string) => void;
  onNavigateToImports: () => void;
  onApplyScheduleToCalendar: (blocks: ScheduleBlock[]) => void;
  onAddClassEvents: (events: ChatCalendarEvent[]) => ChatCalendarEvent[];
  onRemoveClassEvents: (uids: string[]) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  assignments,
  exams,
  onToggleComplete,
  onNavigateToExams,
  onNavigateToNotes,
  onNavigateToImports,
  onApplyScheduleToCalendar,
  onAddClassEvents,
  onRemoveClassEvents,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(
    `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`
  );
  const [hiddenCourses, setHiddenCourses] = useState<Set<string>>(new Set());
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

  // Course unique list
  const courses = Array.from(new Set(assignments.map((a) => a.course)));

  // Date helpers
  const keyForDate = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());

  // Toggle filter
  const toggleCourseFilter = (c: string) => {
    const updated = new Set(hiddenCourses);
    if (updated.has(c)) {
      updated.delete(c);
    } else {
      updated.add(c);
    }
    setHiddenCourses(updated);
  };

  // Filtered assignments
  const visibleAssignments = assignments.filter((a) => !hiddenCourses.has(a.course));

  // Map assignments by day key
  const assignmentsByDay: Record<string, Assignment[]> = {};
  visibleAssignments.forEach((a) => {
    const k = keyForDate(new Date(a.start));
    if (!assignmentsByDay[k]) assignmentsByDay[k] = [];
    assignmentsByDay[k].push(a);
  });

  // Selected Day info
  const [selYear, selMonth, selDay] = selectedDayKey.split('-').map(Number);
  const selectedDateObj = new Date(selYear, selMonth, selDay);
  const selectedDayAssignments = (assignmentsByDay[selectedDayKey] || []).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Month grid calculation
  const curYear = currentDate.getFullYear();
  const curMonth = currentDate.getMonth();
  const firstDayOfMonth = new Date(curYear, curMonth, 1);
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const monthStartWeek = startOfWeek(firstDayOfMonth);
  const totalWeeks = Math.ceil((firstDayOfMonth.getDay() + daysInMonth) / 7);
  const monthDays = Array.from({ length: totalWeeks * 7 }, (_, i) => addDays(monthStartWeek, i));

  // Week view calculation
  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const todayKey = keyForDate(new Date());

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(curYear, curMonth - 1, 1));
    } else {
      setCurrentDate(addDays(currentDate, -7));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(curYear, curMonth + 1, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDayKey(keyForDate(now));
  };

  return (
    <div className="space-y-6">
      {/* Empty State Banner if no classes or assignments imported yet */}
      {assignments.length === 0 && (
        <div className="bg-gradient-to-r from-[#1f5c4d]/10 via-[#f4d958]/20 to-[#1f5c4d]/5 border border-[#1f5c4d]/30 rounded-2xl p-6 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#1f5c4d] text-white flex items-center justify-center mx-auto shadow-xs">
            <DownloadCloud className="w-6 h-6 text-[#f4d958]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
              Ready to Import Your Real Classes & Schedule
            </h3>
            <p className="text-xs sm:text-sm text-[#5d6d70] max-w-lg mx-auto leading-relaxed">
              No classes are loaded yet. Link your Canvas calendar feed or import your .ics file to automatically populate your coursework, due dates, and exam countdowns.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              onClick={onNavigateToImports}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#1f5c4d] hover:bg-[#18493d] text-white shadow-xs flex items-center gap-2 transition-all"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Import Canvas Calendar (.ics)</span>
            </button>
          </div>
        </div>
      )}

      {/* Course Filter Pills */}
      {courses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-[#dde3de] shadow-xs">
          <span className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider px-2">Filter Courses:</span>
          {courses.map((course) => {
            const isVisible = !hiddenCourses.has(course);
            const color = getCourseColor(course);
            return (
              <button
                key={course}
                onClick={() => toggleCourseFilter(course)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  isVisible
                    ? 'bg-white text-[#17262b] border-[#dde3de] shadow-xs'
                    : 'bg-[#f2f4f0] text-[#5d6d70] border-transparent opacity-40 line-through'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span>{course}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* TOP CARD: Schedule (Calendar Component matching PDF Page 1) */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-5 shadow-xs">
        {/* Calendar Header Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] tracking-tight text-[#17262b]">
              {viewMode === 'month'
                ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : `Week of ${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </h2>
            <div className="bg-[#f2f4f0] p-1 rounded-xl flex items-center border border-[#dde3de]">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'month' ? 'bg-[#1f5c4d] text-white shadow-xs' : 'text-[#5d6d70] hover:text-[#17262b]'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'week' ? 'bg-[#1f5c4d] text-white shadow-xs' : 'text-[#5d6d70] hover:text-[#17262b]'
                }`}
              >
                Week
              </button>
            </div>

            {/* Prompt Gemini for Streamlined Study Schedule Button */}
            <button
              onClick={() => setIsPlannerOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#1f5c4d] to-[#143e33] text-white hover:shadow-md transition-all active:scale-98"
              title="Have Gemini organize a streamlined study schedule and chat to customize it"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#f4d958]" />
              <span>Streamlined Study Schedule</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl border border-[#dde3de] hover:bg-[#f2f4f0] text-[#17262b] transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#dde3de] hover:bg-[#f2f4f0] text-[#17262b] transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 rounded-xl border border-[#dde3de] hover:bg-[#f2f4f0] text-[#17262b] transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <div className="border border-[#dde3de] rounded-xl overflow-hidden bg-white">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-[#f9faf8] border-b border-[#dde3de] text-center text-xs font-bold text-[#5d6d70] py-2">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-[#dde3de]">
              {monthDays.map((day, idx) => {
                const k = keyForDate(day);
                const isCurMonth = day.getMonth() === curMonth;
                const isToday = k === todayKey;
                const isSelected = k === selectedDayKey;
                const dayAssignments = assignmentsByDay[k] || [];

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDayKey(k)}
                    className={`min-h-[96px] p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                      !isCurMonth ? 'bg-[#f7f9f6] text-[#9bb0ad]' : 'bg-white text-[#17262b]'
                    } ${isSelected ? 'ring-2 ring-inset ring-[#1f5c4d] bg-[#f0f7f4]' : 'hover:bg-[#fcfdfc]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isToday
                            ? 'bg-[#f4d958] text-[#3a2f00]'
                            : isSelected
                            ? 'bg-[#1f5c4d] text-white'
                            : ''
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {dayAssignments.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#e4eae4] text-[#1f5c4d]">
                          {dayAssignments.length} due
                        </span>
                      )}
                    </div>

                    {/* Chips Preview */}
                    <div className="space-y-1 mt-1">
                      {dayAssignments.slice(0, 2).map((a) => {
                        const color = getCourseColor(a.course);
                        return (
                          <div
                            key={a.uid}
                            className={`text-[11px] truncate px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium ${
                              a.completed ? 'opacity-40 line-through' : ''
                            }`}
                            style={{
                              backgroundColor: `${color}18`,
                              color: color,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="truncate">{a.title}</span>
                          </div>
                        );
                      })}
                      {dayAssignments.length > 2 && (
                        <div className="text-[10px] text-[#5d6d70] font-semibold pl-1">
                          +{dayAssignments.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day, idx) => {
              const k = keyForDate(day);
              const isToday = k === todayKey;
              const isSelected = k === selectedDayKey;
              const dayAssignments = assignmentsByDay[k] || [];

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDayKey(k)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[170px] ${
                    isSelected
                      ? 'border-[#1f5c4d] bg-[#f0f7f4] ring-1 ring-[#1f5c4d]'
                      : 'border-[#dde3de] bg-white hover:border-[#1f5c4d]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#dde3de] mb-2">
                      <span className="text-xs font-bold uppercase text-[#5d6d70]">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span
                        className={`text-sm font-extrabold px-2 py-0.5 rounded-full ${
                          isToday ? 'bg-[#f4d958] text-[#3a2f00]' : 'text-[#17262b]'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {dayAssignments.map((a) => {
                        const color = getCourseColor(a.course);
                        return (
                          <div
                            key={a.uid}
                            className={`p-1.5 rounded-lg border-l-3 bg-[#f8faf8] text-[11px] ${
                              a.completed ? 'opacity-40 line-through' : ''
                            }`}
                            style={{ borderLeftColor: color }}
                          >
                            <p className="font-semibold text-[#17262b] truncate">{a.title}</p>
                            <p className="text-[10px] text-[#5d6d70]">{a.course}</p>
                          </div>
                        );
                      })}
                      {dayAssignments.length === 0 && (
                        <p className="text-[11px] text-[#9bb0ad] italic text-center py-4">No due dates</p>
                      )}
                    </div>
                  </div>

                  {dayAssignments.length > 0 && (
                    <div className="pt-2 text-right">
                      <span className="text-[10px] font-bold text-[#1f5c4d]">
                        {dayAssignments.length} item{dayAssignments.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM ROW: Assignments Per Day (Left) & Exam Countdown (Right) matching PDF Page 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BOTTOM LEFT: Assignments Per Day */}
        <div className="bg-white rounded-2xl border border-[#dde3de] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#dde3de]">
              <div>
                <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] flex items-center gap-2">
                  <span>Assignments Per Day</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1f5c4d] text-white font-bold">
                    {selectedDayAssignments.length}
                  </span>
                </h3>
                <p className="text-xs text-[#5d6d70]">
                  Selected date: {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {selectedDayKey !== todayKey && (
                <button
                  onClick={() => setSelectedDayKey(todayKey)}
                  className="text-xs font-semibold text-[#1f5c4d] hover:underline"
                >
                  View Today
                </button>
              )}
            </div>

            {/* Assignments List for Selected Day */}
            {selectedDayAssignments.length === 0 ? (
              <div className="py-8 text-center bg-[#f9faf8] rounded-xl border border-dashed border-[#dde3de]">
                <CalendarIcon className="w-8 h-8 text-[#9bb0ad] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#17262b]">No assignments due on this date</p>
                <p className="text-xs text-[#5d6d70] mt-1">Select another day on the calendar above or add new assignments.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {selectedDayAssignments.map((a) => {
                  const color = getCourseColor(a.course);
                  return (
                    <div
                      key={a.uid}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        a.completed ? 'bg-[#f7f9f6] border-[#e4eae4] opacity-50' : 'bg-white border-[#dde3de] hover:border-[#1f5c4d]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          onClick={() => onToggleComplete(a.uid)}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            a.completed
                              ? 'bg-[#1f5c4d] border-[#1f5c4d] text-white'
                              : 'border-[#5d6d70] hover:border-[#1f5c4d]'
                          }`}
                        >
                          {a.completed && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold text-[#17262b] truncate ${a.completed ? 'line-through text-[#5d6d70]' : ''}`}>
                            {a.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[#5d6d70] mt-0.5 flex-wrap">
                            <span className="font-semibold" style={{ color }}>
                              {a.course}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {a.all ? 'All Day' : new Date(a.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-[#1f5c4d]">
                              Weight: {a.weight}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {a.priorityRank && a.priorityRank <= 3 && !a.completed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f4d958] text-[#3a2f00]">
                            Rank #{a.priorityRank}
                          </span>
                        )}
                        {a.url && a.url !== '#' && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[#5d6d70] hover:text-[#1f5c4d] rounded-lg hover:bg-[#f2f4f0]"
                            title="Open in Canvas"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#dde3de] text-xs text-[#5d6d70] flex items-center justify-between">
            <span>Click any day in the calendar to inspect that day's workload</span>
            <button
              onClick={() => onNavigateToNotes()}
              className="text-[#1f5c4d] font-bold hover:underline"
            >
              Open Course Notes →
            </button>
          </div>
        </div>

        {/* BOTTOM RIGHT: Exam Countdown */}
        <div className="bg-white rounded-2xl border border-[#dde3de] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#dde3de]">
              <div>
                <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] flex items-center gap-2">
                  <span>Exam Countdown</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#d9482b] text-white font-bold">
                    {exams.length} Upcoming
                  </span>
                </h3>
                <p className="text-xs text-[#5d6d70]">Direct track of midterms, finals & practicals</p>
              </div>

              <button
                onClick={onNavigateToExams}
                className="text-xs font-bold text-[#1f5c4d] hover:underline"
              >
                View All Exams →
              </button>
            </div>

            {/* Exam cards preview */}
            <div className="space-y-3">
              {exams.slice(0, 3).map((exam) => {
                const examDate = new Date(exam.date);
                const diffMs = examDate.getTime() - Date.now();
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                const color = getCourseColor(exam.course);

                return (
                  <div
                    key={exam.id}
                    className="p-3.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] hover:bg-white hover:border-[#1f5c4d] transition-all flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs font-bold" style={{ color }}>
                          {exam.course}
                        </span>
                        <span className="text-[11px] font-semibold text-[#d9482b] bg-[#d9482b]/10 px-2 py-0.2 rounded-full">
                          {exam.weight}% of grade
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#17262b] mt-1">{exam.title}</h4>
                      <p className="text-xs text-[#5d6d70] mt-0.5">
                        {examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })} at{' '}
                        {examDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Countdown Badge */}
                    <div className="text-right shrink-0">
                      <div className={`px-3 py-1.5 rounded-xl font-bold font-['Bricolage_Grotesque',sans-serif] ${
                        diffDays <= 3
                          ? 'bg-[#d9482b] text-white'
                          : diffDays <= 14
                          ? 'bg-[#f4d958] text-[#3a2f00]'
                          : 'bg-[#1f5c4d] text-white'
                      }`}>
                        <div className="text-base leading-tight font-extrabold">{diffDays}</div>
                        <div className="text-[10px] uppercase font-semibold">days left</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#dde3de] flex items-center justify-between">
            <span className="text-xs text-[#5d6d70]">Live countdown clocks ticking in real-time</span>
            <button
              onClick={onNavigateToExams}
              className="text-xs font-bold text-[#1f5c4d] bg-[#f2f4f0] px-3 py-1.5 rounded-xl hover:bg-[#e4eae4] transition-colors"
            >
              Countdown Dashboard →
            </button>
          </div>
        </div>
      </div>

      <ClassChatbot
        className="h-[360px]"
        onAddEvents={onAddClassEvents}
        onRemoveEvents={onRemoveClassEvents}
      />

      {/* Gemini Schedule Planner Modal */}
      <GeminiSchedulePlannerModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        assignments={assignments}
        exams={exams}
        onApplyScheduleToCalendar={onApplyScheduleToCalendar}
      />
    </div>
  );
};
