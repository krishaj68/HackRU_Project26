import React, { useState } from 'react';
import { Sparkles, Calendar, Clock, Check, Send, Bot, User, X, Flame, ArrowRight, RefreshCw, AlertCircle, BookOpen, Plus } from 'lucide-react';
import { Assignment, Exam, ScheduleBlock } from '../types';
import { getCourseColor } from '../utils/sampleData';

interface GeminiSchedulePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: Assignment[];
  exams: Exam[];
  onApplyScheduleToCalendar: (blocks: ScheduleBlock[]) => void;
}

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
  time?: string;
}

export const GeminiSchedulePlannerModal: React.FC<GeminiSchedulePlannerModalProps> = ({
  isOpen,
  onClose,
  assignments,
  exams,
  onApplyScheduleToCalendar,
}) => {
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [productivityTip, setProductivityTip] = useState('');
  const [applied, setApplied] = useState(false);

  if (!isOpen) return null;

  // Initial Schedule Generation
  const handleGenerateInitialSchedule = async () => {
    setIsLoading(true);
    setApplied(false);
    try {
      const res = await fetch('/api/gemini/schedule-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignments.filter((a) => !a.completed),
          exams,
          message: '',
          chatHistory: [],
          currentSchedule: [],
        }),
      });

      if (!res.ok) throw new Error('Failed to generate schedule');
      const data = await res.json();

      setScheduleBlocks(data.scheduleBlocks || []);
      setProductivityTip(data.productivityTip || '');
      setChatHistory([
        {
          role: 'model',
          text:
            data.reply ||
            `I've built a streamlined study schedule based on your coursework and upcoming exams! Review the plan on the left. Feel free to tell me about your personal routines (work hours, sports, study preferences) and I'll adjust it for you.`,
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setChatHistory([
        {
          role: 'model',
          text: 'Unable to reach the Gemini scheduling engine right now. Please ensure your assignments are loaded.',
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Conversational Adjustment with Gemini
  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = (customMessage || userInput).trim();
    if (!textToSend || isLoading) return;

    setUserInput('');
    setIsLoading(true);
    setApplied(false);

    const updatedHistory: ChatHistoryItem[] = [
      ...chatHistory,
      {
        role: 'user',
        text: textToSend,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      },
    ];
    setChatHistory(updatedHistory);

    try {
      const res = await fetch('/api/gemini/schedule-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignments.filter((a) => !a.completed),
          exams,
          message: textToSend,
          chatHistory: updatedHistory,
          currentSchedule: scheduleBlocks,
        }),
      });

      if (!res.ok) throw new Error('Failed to update schedule');
      const data = await res.json();

      if (data.scheduleBlocks && data.scheduleBlocks.length > 0) {
        setScheduleBlocks(data.scheduleBlocks);
      }
      if (data.productivityTip) {
        setProductivityTip(data.productivityTip);
      }

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'model',
          text: data.reply || "I've re-balanced your schedule based on your preference!",
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'model',
          text: 'Sorry, I ran into an error updating the schedule. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    onApplyScheduleToCalendar(scheduleBlocks);
    setApplied(true);
  };

  const promptSuggestions = [
    '🏃‍♂️ I have sports practice Tuesday evenings',
    '☕ Keep Friday nights completely free',
    '🌅 I study best in the mornings before 12pm',
    '⏱️ Break study sessions into 45-minute blocks',
    '🎯 Allocate more review for my nearest exam',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#f2f4f0] text-[#17262b] rounded-3xl border border-[#dde3de] shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="bg-white border-b border-[#dde3de] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1f5c4d] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-[#f4d958]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] tracking-tight">
                  Gemini Study Schedule Assistant
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f4d958] text-[#3a2f00]">
                  AI Powered
                </span>
              </div>
              <p className="text-xs text-[#5d6d70]">
                Streamline your workload, balance upcoming exams, and converse with Gemini to build your ideal schedule.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#5d6d70] hover:text-[#17262b] hover:bg-[#f2f4f0] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* If no schedule generated yet, prompt user */}
          {scheduleBlocks.length === 0 && !isLoading && (
            <div className="max-w-xl mx-auto my-12 bg-white rounded-3xl border border-[#dde3de] p-8 text-center space-y-5 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-[#1f5c4d]/10 text-[#1f5c4d] flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-[#1f5c4d]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                  Build Your Streamlined Study Plan
                </h3>
                <p className="text-xs sm:text-sm text-[#5d6d70] leading-relaxed">
                  Gemini will analyze your {assignments.filter((a) => !a.completed).length} active assignments, due dates, grade weights, and {exams.length} upcoming exams to craft a realistic, balanced day-by-day study calendar.
                </p>
              </div>

              {assignments.length === 0 && (
                <div className="p-3 bg-[#fff9db] border border-[#f4d958] rounded-xl text-xs text-[#735a00] flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No assignments imported yet. You can generate a general study framework or import your Canvas feed first.</span>
                </div>
              )}

              <button
                onClick={handleGenerateInitialSchedule}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#1f5c4d] to-[#143e33] text-white hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4 text-[#f4d958]" />
                <span>Generate Streamlined Study Schedule</span>
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && scheduleBlocks.length === 0 && (
            <div className="max-w-md mx-auto my-20 text-center space-y-4">
              <Sparkles className="w-12 h-12 text-[#1f5c4d] animate-spin mx-auto" />
              <h4 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif]">
                Gemini is Architecting Your Schedule...
              </h4>
              <p className="text-xs text-[#5d6d70]">
                Calculating task grade weights, balancing deadlines, and reserving optimal exam review blocks.
              </p>
            </div>
          )}

          {/* When schedule is generated: 2-Column Interface (Schedule on Left, Chat on Right) */}
          {scheduleBlocks.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: The Streamlined Schedule (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white rounded-2xl border border-[#dde3de] p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] flex items-center gap-2">
                      <span>Streamlined Study Schedule</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#1f5c4d] text-white">
                        {scheduleBlocks.length} Sessions
                      </span>
                    </h3>
                    <p className="text-xs text-[#5d6d70] mt-0.5">
                      Tailored to assignments & exam dates • Talk with Gemini on the right to modify
                    </p>
                  </div>

                  <button
                    onClick={handleApply}
                    disabled={applied}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                      applied
                        ? 'bg-[#e4eae4] text-[#1f5c4d] border border-[#1f5c4d]'
                        : 'bg-[#1f5c4d] hover:bg-[#18493d] text-white'
                    }`}
                  >
                    {applied ? (
                      <>
                        <Check className="w-4 h-4 text-[#1f5c4d]" />
                        <span>Added to Calendar</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Apply to Calendar</span>
                      </>
                    )}
                  </button>
                </div>

                {productivityTip && (
                  <div className="p-3.5 rounded-xl bg-[#f4d958]/20 border border-[#e9cf4a] text-xs text-[#3a2f00] flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#a86f00] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Coach Strategy: </span>
                      {productivityTip}
                    </div>
                  </div>
                )}

                {/* List of Scheduled Blocks */}
                <div className="space-y-3">
                  {scheduleBlocks.map((block) => {
                    const color = getCourseColor(block.course);
                    return (
                      <div
                        key={block.id}
                        className="bg-white rounded-2xl border border-[#dde3de] p-4 hover:border-[#1f5c4d] transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-extrabold text-[#1f5c4d] bg-[#f0f7f4] px-2.5 py-0.5 rounded-md">
                              {block.day}
                            </span>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded-md"
                              style={{
                                backgroundColor: `${color}15`,
                                color: color,
                              }}
                            >
                              {block.course}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              block.focusType === 'exam_prep'
                                ? 'bg-[#d9482b] text-white'
                                : 'bg-[#dde3de] text-[#17262b]'
                            }`}>
                              {block.focusType === 'exam_prep' ? 'Exam Prep' : 'Assignment Work'}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-[#17262b] truncate">
                            {block.taskTitle}
                          </h4>

                          {block.notes && (
                            <p className="text-xs text-[#5d6d70] line-clamp-1 italic">
                              💡 {block.notes}
                            </p>
                          )}
                        </div>

                        <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#dde3de]">
                          <div className="flex items-center sm:justify-end gap-1.5 text-xs font-bold text-[#17262b]">
                            <Clock className="w-3.5 h-3.5 text-[#5d6d70]" />
                            <span>{block.time}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-[#5d6d70] mt-0.5 block">
                            Duration: {block.duration}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT COLUMN: Talk Back and Forth with Gemini (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-[#dde3de] p-4 sm:p-5 shadow-xs flex flex-col h-[580px]">
                <div className="flex items-center justify-between pb-3 border-b border-[#dde3de] mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#1f5c4d] text-[#f4d958]">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                        Converse & Organize Schedule
                      </h4>
                      <p className="text-[10px] text-[#5d6d70]">Talk with Gemini to fine-tune your times</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-[#f0f7f4] text-[#1f5c4d] font-bold px-2 py-0.5 rounded-full">
                    Live
                  </span>
                </div>

                {/* Suggestions carousel / pills */}
                <div className="mb-3 space-y-1">
                  <p className="text-[10px] font-bold text-[#5d6d70] uppercase">Quick adjustments:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {promptSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(sug)}
                        disabled={isLoading}
                        className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-[#f2f4f0] hover:bg-[#e4eae4] text-[#17262b] transition-colors border border-[#dde3de] disabled:opacity-50"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs border-t border-[#dde3de] pt-3">
                  {chatHistory.map((item, idx) => {
                    const isUser = item.role === 'user';
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                            isUser
                              ? 'bg-[#1f5c4d] text-white'
                              : 'bg-[#f4d958] text-[#3a2f00] font-bold'
                          }`}
                        >
                          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div
                          className={`max-w-[85%] p-3 rounded-2xl leading-relaxed ${
                            isUser
                              ? 'bg-[#1f5c4d] text-white rounded-tr-xs'
                              : 'bg-[#f2f4f0] text-[#17262b] rounded-tl-xs'
                          }`}
                        >
                          <p>{item.text}</p>
                          {item.time && (
                            <span
                              className={`text-[9px] block text-right mt-1 ${
                                isUser ? 'text-white/70' : 'text-[#5d6d70]'
                              }`}
                            >
                              {item.time}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-[#5d6d70] italic pl-2">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-[#1f5c4d]" />
                      <span>Gemini is adjusting your schedule...</span>
                    </div>
                  )}
                </div>

                {/* Input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="mt-3 pt-2 border-t border-[#dde3de] flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Tell Gemini how to adjust (e.g. 'I work Mon 2-5pm')..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] focus:outline-none focus:ring-2 focus:ring-[#1f5c4d]"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !userInput.trim()}
                    className="p-2.5 rounded-xl bg-[#1f5c4d] text-white hover:bg-[#18493d] disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
