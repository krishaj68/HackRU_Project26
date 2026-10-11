import React, { useState, useEffect } from 'react';
import { Clock, Plus, Calendar, MapPin, Flame, Archive } from 'lucide-react';
import { Exam } from '../types';
import { getCourseColor } from '../utils/sampleData';

interface ExamsViewProps {
  exams: Exam[];
  onAddExam: (exam: Exam) => void;
  onLaunchStudySession: (courseName: string, unitName: string, notesText: string) => void;
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  exams,
  onAddExam,
  onLaunchStudySession,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [, setTicker] = useState(0);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState('CS 111');
  const [newDate, setNewDate] = useState('');
  const [newWeight, setNewWeight] = useState(30);
  const [newLocation, setNewLocation] = useState('');
  const [newTopics, setNewTopics] = useState('');

  // Live timer tick every 1000ms
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sort exams chronologically
  const sortedExams = [...exams].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const upcomingExams = sortedExams.filter((exam) => new Date(exam.date).getTime() >= Date.now());
  const archivedExams = sortedExams.filter((exam) => new Date(exam.date).getTime() < Date.now());
  const visibleExams = showArchived ? archivedExams : upcomingExams;

  // Time remaining calculator
  const getTimeRemaining = (dateStr: string) => {
    const total = new Date(dateStr).getTime() - Date.now();
    if (total <= 0) {
      return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true };
    }
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    return { total, days, hours, minutes, seconds, isPassed: false };
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const examDate = newDate ? new Date(newDate).toISOString() : new Date(Date.now() + 86400000 * 14).toISOString();
    const topicsArr = newTopics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const created: Exam = {
      id: `exam-${Date.now()}`,
      title: newTitle.trim(),
      course: newCourse,
      date: examDate,
      weight: Number(newWeight) || 25,
      location: newLocation.trim() || 'TBD',
      topics: topicsArr.length > 0 ? topicsArr : ['Comprehensive Exam Topics'],
    };

    onAddExam(created);
    setNewTitle('');
    setNewLocation('');
    setNewTopics('');
    setShowAddModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header bar matching PDF Page 4 */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] tracking-tight">
            Exams
          </h2>
          <p className="text-xs text-[#5d6d70] mt-1">
            Chronological exam schedules, major grade weights, and live countdown timers
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-[#1f5c4d] text-white hover:bg-[#18493d] transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Exam</span>
        </button>
      </div>

      {/* 2-Column Layout Matching PDF Page 4: Left List of Exams Chronologically, Right Countdown of Upcoming Exams */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: List of Exams Chronologically (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#dde3de] p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-[#dde3de] flex items-center justify-between">
            <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
              {showArchived ? 'Archived Exams' : 'Upcoming Exams'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchived(false)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  !showArchived
                    ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                    : 'bg-white text-[#5d6d70] border-[#dde3de] hover:text-[#17262b]'
                }`}
              >
                Upcoming ({upcomingExams.length})
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  showArchived
                    ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                    : 'bg-white text-[#5d6d70] border-[#dde3de] hover:text-[#17262b]'
                }`}
              >
                <Archive className="w-3 h-3" />
                Archive ({archivedExams.length})
              </button>
            </div>
          </div>

          {visibleExams.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5d6d70] bg-[#f9faf8] rounded-xl border border-dashed border-[#dde3de]">
              <Clock className="w-8 h-8 text-[#9bb0ad] mx-auto mb-2" />
              <p className="font-bold text-sm text-[#17262b]">
                {showArchived ? 'No Archived Exams' : 'No Upcoming Exams'}
              </p>
              <p className="mt-1">
                {showArchived
                  ? 'Past exams will appear here.'
                  : 'Import your Canvas feed or click "Add Exam" above to start live exam countdowns.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleExams.map((exam, idx) => {
                const examDate = new Date(exam.date);
                const color = getCourseColor(exam.course);
                const rem = getTimeRemaining(exam.date);

                return (
                  <div
                    key={exam.id}
                  className="p-4 rounded-xl border border-[#dde3de] bg-[#f9faf8] hover:bg-white hover:border-[#1f5c4d] transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-bold" style={{ color }}>
                        {exam.course}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#d9482b]/15 text-[#d9482b]">
                        Weight: {exam.weight}% of Final Grade
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-[#5d6d70]">
                      #{idx + 1} in semester
                    </span>
                  </div>

                  <h4 className="text-base font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mt-1.5">
                    {exam.title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#5d6d70] mt-1.5">
                    <span className="flex items-center gap-1 font-semibold text-[#17262b]">
                      <Calendar className="w-3.5 h-3.5" />
                      {examDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>at {examDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    {exam.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#5d6d70]" />
                        {exam.location}
                      </span>
                    )}
                  </div>

                  {/* Topics Covered */}
                  {exam.topics?.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#dde3de]">
                      <p className="text-[11px] font-bold text-[#5d6d70] uppercase mb-1">Topics on Exam:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {exam.topics.map((topic, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-[#dde3de] text-[#17262b]"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Study launch for this exam */}
                  <div className="mt-3 pt-2 border-t border-[#dde3de] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1f5c4d]">
                      {rem.isPassed ? 'Exam completed' : `${rem.days} days and ${rem.hours}h left`}
                    </span>
                    <button
                      onClick={() =>
                        onLaunchStudySession(
                          exam.course,
                          exam.title,
                          `Exam Preparation for ${exam.title}. Topics: ${exam.topics.join(', ')}.`
                        )
                      }
                      className="flex items-center gap-1.5 text-xs font-bold text-[#1f5c4d] hover:underline"
                    >
                      <Flame className="w-3.5 h-3.5 text-[#f4d958]" />
                      <span>Start Exam Study Lockdown</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* RIGHT COLUMN: Countdown of Upcoming Exams (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-[#dde3de] p-5 shadow-xs">
            <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-1">
              Countdown of Upcoming Exams
            </h3>
            <p className="text-xs text-[#5d6d70] mb-4">
              Real-time countdown clocks ticking down to test day
            </p>

            {upcomingExams.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#5d6d70] bg-[#f9faf8] rounded-xl border border-dashed border-[#dde3de]">
                <Clock className="w-8 h-8 text-[#9bb0ad] mx-auto mb-2" />
                <p className="font-bold text-sm text-[#17262b]">Countdown Idle</p>
                <p className="mt-1">Add your midterms or finals to see real-time digital clocks.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingExams.slice(0, 3).map((exam) => {
                const color = getCourseColor(exam.course);
                const rem = getTimeRemaining(exam.date);

                return (
                  <div
                    key={exam.id}
                    className="p-4 rounded-xl border border-[#dde3de] bg-[#1a2629] text-white shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-extrabold px-2 py-0.5 rounded-md text-white"
                        style={{ backgroundColor: color }}
                      >
                        {exam.course}
                      </span>
                      <span className="text-xs font-bold text-[#f4d958]">
                        {exam.weight}% Grade Weight
                      </span>
                    </div>

                    <h4 className="text-sm font-bold font-['Bricolage_Grotesque',sans-serif] truncate">
                      {exam.title}
                    </h4>

                    {/* Digital Countdown Grid */}
                    <div className="grid grid-cols-4 gap-2 text-center pt-1">
                      <div className="bg-[#24353a] p-2 rounded-xl border border-[#30454b]">
                        <span className="block text-xl font-black font-['Bricolage_Grotesque',sans-serif] text-white">
                          {rem.days}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-[#9bb0ad]">Days</span>
                      </div>
                      <div className="bg-[#24353a] p-2 rounded-xl border border-[#30454b]">
                        <span className="block text-xl font-black font-['Bricolage_Grotesque',sans-serif] text-white">
                          {rem.hours}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-[#9bb0ad]">Hours</span>
                      </div>
                      <div className="bg-[#24353a] p-2 rounded-xl border border-[#30454b]">
                        <span className="block text-xl font-black font-['Bricolage_Grotesque',sans-serif] text-white">
                          {rem.minutes}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-[#9bb0ad]">Mins</span>
                      </div>
                      <div className="bg-[#24353a] p-2 rounded-xl border border-[#30454b]">
                        <span className="block text-xl font-black font-['Bricolage_Grotesque',sans-serif] text-[#f4d958]">
                          {rem.seconds}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-[#9bb0ad]">Secs</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Exam Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-1">
              Add Scheduled Exam
            </h3>
            <p className="text-xs text-[#5d6d70] mb-4">
              Enter test date, course weight, and syllabus topics to activate the live countdown.
            </p>

            <form onSubmit={handleCreateExam} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm 2: Vector Calculus"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                    Course Code
                  </label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                  >
                    <option value="CS 111">CS 111</option>
                    <option value="MATH 151">MATH 151</option>
                    <option value="PHYS 203">PHYS 203</option>
                    <option value="ENG 101">ENG 101</option>
                    <option value="BIO 110">BIO 110</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                    Grade Weight (%)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    required
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Exam Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Location (Building & Room)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Complex Lecture 104"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Topics Covered (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Green's Theorem, Divergence, Stokes' Theorem"
                  value={newTopics}
                  onChange={(e) => setNewTopics(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#5d6d70]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1f5c4d] text-white hover:bg-[#18493d]"
                >
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
