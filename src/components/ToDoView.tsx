import React, { useState } from 'react';
import { Sparkles, Check, Plus, Clock, AlertTriangle, ArrowUpDown, Calendar, ExternalLink, Flame, CheckCircle2 } from 'lucide-react';
import { Assignment } from '../types';
import { getCourseColor } from '../utils/sampleData';

interface ToDoViewProps {
  assignments: Assignment[];
  onToggleComplete: (uid: string) => void;
  onAddAssignment: (assignment: Assignment) => void;
  onPrioritizeWithGemini: (prioritizedList: Assignment[], insight: string, scheduleRec: string) => void;
  geminiInsight: string;
  scheduleRecommendation: string;
}

export const ToDoView: React.FC<ToDoViewProps> = ({
  assignments,
  onToggleComplete,
  onAddAssignment,
  onPrioritizeWithGemini,
  geminiInsight,
  scheduleRecommendation,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('active');
  const [sortMode, setSortMode] = useState<'gemini' | 'chronological' | 'weight'>('gemini');
  const [isPrioritizing, setIsPrioritizing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New assignment form state
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState('CS 111');
  const [newDueDate, setNewDueDate] = useState('');
  const [newWeight, setNewWeight] = useState(15);
  const [newDesc, setNewDesc] = useState('');

  // Call Gemini to prioritize based on weight and due date
  const handleTriggerGeminiPrioritization = async () => {
    setIsPrioritizing(true);
    try {
      const activeOnly = assignments.filter((a) => !a.completed);
      const res = await fetch('/api/gemini/prioritize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: activeOnly,
          userContext: 'Prioritize by heaviest grade weight and nearest due date.',
        }),
      });

      if (!res.ok) throw new Error('Prioritization request failed');

      const data = await res.json();
      const priorityMap = new Map<string, any>();
      (data.prioritized || []).forEach((p: any) => {
        priorityMap.set(p.uid, p);
      });

      // Update assignment objects with Gemini fields
      const updated = assignments.map((a) => {
        const p = priorityMap.get(a.uid);
        if (p) {
          return {
            ...a,
            priorityScore: p.score,
            priorityRank: p.priorityRank,
            estimatedHours: p.estimatedHours,
            urgency: p.urgency,
            geminiReason: p.reason,
            recommendedSlot: p.recommendedSlot,
          };
        }
        return a;
      });

      onPrioritizeWithGemini(
        updated,
        data.aiInsight || 'Prioritized based on assignment grade weight and urgency.',
        data.scheduleRecommendation || 'Schedule high-weight assignments in uninterrupted 2-hour study blocks.'
      );
      setSortMode('gemini');
    } catch (err) {
      console.error(err);
    } finally {
      setIsPrioritizing(false);
    }
  };

  // Add custom assignment
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const due = newDueDate ? new Date(newDueDate) : new Date(Date.now() + 86400000 * 2);
    const newAssign: Assignment = {
      uid: `custom-${Date.now()}`,
      title: newTitle.trim(),
      course: newCourse,
      start: due,
      all: false,
      desc: newDesc.trim() || 'Custom student assignment',
      url: '#',
      type: 'a',
      weight: Number(newWeight) || 10,
      completed: false,
    };

    onAddAssignment(newAssign);
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  // Filtered and Sorted list
  const filtered = assignments.filter((a) => {
    if (filterMode === 'active') return !a.completed;
    if (filterMode === 'completed') return a.completed;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'gemini') {
      const scoreA = a.priorityScore ?? (a.weight * 2);
      const scoreB = b.priorityScore ?? (b.weight * 2);
      return scoreB - scoreA;
    }
    if (sortMode === 'weight') {
      return b.weight - a.weight;
    }
    // Chronological due date
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  // Urgency color helper
  const getUrgencyBadge = (urgency?: string, score?: number) => {
    if (urgency === 'CRITICAL' || (score && score >= 90)) {
      return 'bg-[#d9482b] text-white';
    }
    if (urgency === 'HIGH' || (score && score >= 75)) {
      return 'bg-[#f4d958] text-[#3a2f00]';
    }
    if (urgency === 'MEDIUM') {
      return 'bg-[#1f5c4d] text-white';
    }
    return 'bg-[#dde3de] text-[#5d6d70]';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header bar matching PDF Page 2 */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] tracking-tight">
              To Do
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1f5c4d] text-white font-bold">
              {assignments.filter((a) => !a.completed).length} Active
            </span>
          </div>
          <p className="text-xs text-[#5d6d70] mt-1">
            All assignments constantly updating • Ordered chronologically based on weight of grade and due date
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Prioritize Trigger */}
          <button
            onClick={handleTriggerGeminiPrioritization}
            disabled={isPrioritizing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#1f5c4d] to-[#143d33] text-white shadow-xs hover:shadow-md transition-all active:scale-98 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#f4d958] ${isPrioritizing ? 'animate-spin' : ''}`} />
            <span>{isPrioritizing ? 'Gemini Analyzing...' : 'Gemini Smart Prioritize'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-[#f2f4f0] hover:bg-[#e4eae4] text-[#17262b] border border-[#dde3de] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Gemini AI Strategic Productivity Insight Box */}
      {geminiInsight && (
        <div className="bg-gradient-to-r from-[#1f5c4d]/10 via-[#f4d958]/15 to-[#1f5c4d]/5 border border-[#1f5c4d]/30 rounded-2xl p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#1f5c4d] text-[#f4d958] shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                Gemini Productivity Insight & Schedule
              </h4>
              <p className="text-xs text-[#17262b] leading-relaxed">{geminiInsight}</p>
              {scheduleRecommendation && (
                <p className="text-xs text-[#1f5c4d] font-semibold mt-1">
                  💡 Recommendation: {scheduleRecommendation}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Sort Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#dde3de]">
        {/* Status filters */}
        <div className="flex items-center gap-1 bg-[#f2f4f0] p-1 rounded-xl">
          <button
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterMode === 'active' ? 'bg-[#1f5c4d] text-white shadow-xs' : 'text-[#5d6d70] hover:text-[#17262b]'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterMode === 'all' ? 'bg-[#1f5c4d] text-white shadow-xs' : 'text-[#5d6d70] hover:text-[#17262b]'
            }`}
          >
            All ({assignments.length})
          </button>
          <button
            onClick={() => setFilterMode('completed')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              filterMode === 'completed' ? 'bg-[#1f5c4d] text-white shadow-xs' : 'text-[#5d6d70] hover:text-[#17262b]'
            }`}
          >
            Completed ({assignments.filter((a) => a.completed).length})
          </button>
        </div>

        {/* Sort modes */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#5d6d70] font-semibold flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort:
          </span>
          <button
            onClick={() => setSortMode('gemini')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
              sortMode === 'gemini'
                ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                : 'bg-white text-[#5d6d70] border-[#dde3de] hover:text-[#17262b]'
            }`}
          >
            ✨ Gemini Priority
          </button>
          <button
            onClick={() => setSortMode('chronological')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
              sortMode === 'chronological'
                ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                : 'bg-white text-[#5d6d70] border-[#dde3de] hover:text-[#17262b]'
            }`}
          >
            Due Date
          </button>
          <button
            onClick={() => setSortMode('weight')}
            className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
              sortMode === 'weight'
                ? 'bg-[#1f5c4d] text-white border-[#1f5c4d]'
                : 'bg-white text-[#5d6d70] border-[#dde3de] hover:text-[#17262b]'
            }`}
          >
            Grade Weight (%)
          </button>
        </div>
      </div>

      {/* Main List of Assignments */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#dde3de] p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#1f5c4d] mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-bold text-[#17262b]">All caught up!</h3>
            <p className="text-xs text-[#5d6d70] mt-1">No pending assignments matching this filter.</p>
          </div>
        ) : (
          sorted.map((item, index) => {
            const color = getCourseColor(item.course);
            const dueDate = new Date(item.start);
            const diffHours = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
            const isOverdue = diffHours < 0 && !item.completed;

            return (
              <div
                key={item.uid}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
                  item.completed
                    ? 'border-[#e4eae4] bg-[#f9faf8] opacity-60'
                    : isOverdue
                    ? 'border-[#d9482b] bg-[#fffaf9]'
                    : 'border-[#dde3de] hover:border-[#1f5c4d]'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Left: Checkbox & Title */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <button
                      onClick={() => onToggleComplete(item.uid)}
                      className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                        item.completed
                          ? 'bg-[#1f5c4d] border-[#1f5c4d] text-white'
                          : 'border-[#9bb0ad] hover:border-[#1f5c4d] hover:bg-[#f2f4f0]'
                      }`}
                      aria-label="Toggle completed"
                    >
                      {item.completed && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Course pill */}
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `${color}15`,
                            color: color,
                          }}
                        >
                          {item.course}
                        </span>

                        {/* Grade weight badge */}
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e4eae4] text-[#17262b]">
                          Weight: {item.weight}% of grade
                        </span>

                        {/* Rank or Urgency */}
                        {item.priorityRank && !item.completed && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getUrgencyBadge(
                              item.urgency,
                              item.priorityScore
                            )}`}
                          >
                            AI Rank #{item.priorityRank}
                          </span>
                        )}
                      </div>

                      <h3
                        className={`text-base font-bold text-[#17262b] mt-1 tracking-tight ${
                          item.completed ? 'line-through text-[#5d6d70]' : ''
                        }`}
                      >
                        {item.title}
                      </h3>

                      {item.desc && (
                        <p className="text-xs text-[#5d6d70] mt-1 line-clamp-2">
                          {item.desc}
                        </p>
                      )}

                      {/* Gemini AI Rationale Note */}
                      {item.geminiReason && !item.completed && (
                        <div className="mt-2 text-xs bg-[#f4d958]/15 border-l-2 border-[#a86f00] px-2.5 py-1 rounded-r-md text-[#3a2f00]">
                          <span className="font-bold">Gemini Strategy:</span> {item.geminiReason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Due Date & Study Slot */}
                  <div className="sm:text-right shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#dde3de]">
                    <div className="flex items-center sm:justify-end gap-1.5 text-xs font-semibold text-[#17262b]">
                      <Calendar className="w-3.5 h-3.5 text-[#5d6d70]" />
                      <span>
                        {dueDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>at {dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>

                    <div className="mt-1 flex items-center sm:justify-end gap-2 text-xs">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          isOverdue
                            ? 'bg-[#d9482b] text-white'
                            : diffHours < 24
                            ? 'bg-[#f4d958] text-[#3a2f00]'
                            : 'bg-[#f2f4f0] text-[#5d6d70]'
                        }`}
                      >
                        {isOverdue
                          ? 'Overdue'
                          : diffHours < 24
                          ? `Due in ${Math.max(1, Math.round(diffHours))}h`
                          : `Due in ${Math.round(diffHours / 24)}d`}
                      </span>

                      {item.url && item.url !== '#' && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-[#5d6d70] hover:text-[#1f5c4d] rounded-lg hover:bg-[#f2f4f0]"
                          title="Open Canvas Assignment"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    {item.recommendedSlot && !item.completed && (
                      <p className="text-[11px] text-[#1f5c4d] font-semibold mt-1.5">
                        ⏱️ Study slot: {item.recommendedSlot}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Custom Assignment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-1">
              Add New Assignment
            </h3>
            <p className="text-xs text-[#5d6d70] mb-4">
              Enter assignment details and grade weight for Gemini prioritization.
            </p>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Assignment Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lab 5: Tree Rotations"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                  >
                    <option value="CS 111">CS 111</option>
                    <option value="MATH 151">MATH 151</option>
                    <option value="PHYS 203">PHYS 203</option>
                    <option value="ENG 101">ENG 101</option>
                    <option value="BIO 110">BIO 110</option>
                    <option value="Other">Other Course</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                    Grade Weight (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={newWeight}
                    onChange={(e) => setNewWeight(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Due Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Key deliverables, topics covered, or notes..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#5d6d70] hover:bg-[#f2f4f0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1f5c4d] text-white hover:bg-[#18493d] shadow-xs"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
