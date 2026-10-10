import React, { useState, useEffect, useRef } from 'react';
import { Flame, Play, Pause, RotateCcw, X, ShieldAlert, Sparkles, CheckCircle2, Award, BookOpen, Volume2, Maximize2, Minimize2 } from 'lucide-react';
import { QuizData } from '../types';

interface StudyLockdownModalProps {
  courseName: string;
  unitName: string;
  notesContent: string;
  onClose: () => void;
}

export const StudyLockdownModal: React.FC<StudyLockdownModalProps> = ({
  courseName,
  unitName,
  notesContent,
  onClose,
}) => {
  // Pomodoro timer: 25 minutes default (1500 seconds)
  const WORK_TIME = 25 * 60;
  const BREAK_TIME = 5 * 60;

  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK_TIME);
  const [isActive, setIsActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [distractionCount, setDistractionCount] = useState(0);

  // End of Session Quiz State
  const [quizState, setQuizState] = useState<'study' | 'generating' | 'quiz' | 'result'>('study');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Pomodoro countdown effect
  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      // Completed timer!
      setIsActive(false);
      if (mode === 'work') {
        // Trigger end-of-session quiz automatically
        handleTriggerQuiz();
      } else {
        setMode('work');
        setSecondsLeft(WORK_TIME);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, mode]);

  // Tab switch warning deterrent (browser distraction blocker simulation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        setDistractionCount((c) => c + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isActive]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(mode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  const switchMode = (newMode: 'work' | 'break') => {
    setMode(newMode);
    setIsActive(false);
    setSecondsLeft(newMode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Trigger Gemini End Quiz
  const handleTriggerQuiz = async () => {
    setQuizState('generating');
    try {
      const res = await fetch('/api/gemini/end-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName,
          unitTitle: unitName,
          notesContent,
        }),
      });

      if (!res.ok) throw new Error('Quiz generation failed');
      const data = await res.json();
      setQuizData(data);
      setSelectedAnswers(new Array(data.questions?.length || 3).fill(-1));
      setQuizState('quiz');
    } catch (err) {
      console.error(err);
      // Fallback quiz
      setQuizData({
        title: `Retention Quiz: ${courseName}`,
        questions: [
          {
            question: `In ${unitName}, what principle is most essential for maintaining correctness?`,
            options: ['Loop invariants', 'Unchecked recursion', 'Ignoring base cases', 'Random hashing'],
            correctIndex: 0,
            explanation: 'Loop invariants ensure correctness at initialization, maintenance, and termination.',
          },
          {
            question: 'How does high assignment grade weight impact study scheduling?',
            options: ['Do it last', 'Allocate frontloaded deep-focus blocks', 'Skip review', 'Rely solely on luck'],
            correctIndex: 1,
            explanation: 'Frontloading deep focus prevents last-minute cramming and improves long-term recall.',
          },
        ],
      });
      setSelectedAnswers([-1, -1]);
      setQuizState('quiz');
    }
  };

  // Quiz Answer Select
  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (quizSubmitted) return;
    const updated = [...selectedAnswers];
    updated[qIdx] = optIdx;
    setSelectedAnswers(updated);
  };

  // Submit Quiz
  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    setQuizState('result');
  };

  // Calculate score
  const correctCount =
    quizData?.questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correctIndex ? 1 : 0);
    }, 0) || 0;

  // Format time (MM:SS)
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progress =
    mode === 'work'
      ? ((WORK_TIME - secondsLeft) / WORK_TIME) * 100
      : ((BREAK_TIME - secondsLeft) / BREAK_TIME) * 100;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#0f1719] text-[#e8efec] flex flex-col justify-between overflow-y-auto p-4 sm:p-8"
    >
      {/* Top Bar */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4 border-b border-[#27383b]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5fc3a6]/20 text-[#5fc3a6] flex items-center justify-center font-bold">
            <Flame className="w-5 h-5 text-[#f4d958]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#5fc3a6] text-[#0b1f19]">
                LOCKDOWN ACTIVE
              </span>
              <h2 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] tracking-tight">
                {courseName || 'Deep Focus'}
              </h2>
            </div>
            <p className="text-xs text-[#9bb0ad]">{unitName || 'Intensive Study Session'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-[#172326] border border-[#27383b] text-[#9bb0ad] hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#27383b] hover:bg-[#344b4f] text-xs font-bold text-white transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Exit Lockdown</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: STUDY MODE */}
      {quizState === 'study' && (
        <div className="max-w-xl w-full mx-auto my-auto py-8 text-center space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="inline-flex bg-[#172326] p-1.5 rounded-2xl border border-[#27383b]">
            <button
              onClick={() => switchMode('work')}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'work' ? 'bg-[#5fc3a6] text-[#0b1f19] shadow-md' : 'text-[#9bb0ad] hover:text-white'
              }`}
            >
              Focus Sprint (25m)
            </button>
            <button
              onClick={() => switchMode('break')}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'break' ? 'bg-[#5fc3a6] text-[#0b1f19] shadow-md' : 'text-[#9bb0ad] hover:text-white'
              }`}
            >
              Rest Break (5m)
            </button>
          </div>

          {/* Pomodoro Circular Ring / Clock */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="44%"
                className="stroke-[#172326]"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50%"
                cy="50%"
                r="44%"
                className="stroke-[#5fc3a6] transition-all duration-1000 ease-linear"
                strokeWidth="8"
                strokeDasharray="276"
                strokeDashoffset={276 - (276 * progress) / 100}
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* Time Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl sm:text-6xl font-black font-['Bricolage_Grotesque',sans-serif] tracking-tight">
                {formatTime(secondsLeft)}
              </span>
              <span className="text-xs uppercase font-bold tracking-widest text-[#9bb0ad] mt-2">
                {mode === 'work' ? (isActive ? 'Deep Work Mode' : 'Paused') : 'Rest & Refresh'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={toggleTimer}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-base bg-[#5fc3a6] text-[#0b1f19] hover:bg-[#4eb396] shadow-lg hover:scale-102 active:scale-98 transition-all"
            >
              {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isActive ? 'Pause' : 'Start Focus'}</span>
            </button>
            <button
              onClick={resetTimer}
              className="p-3.5 rounded-2xl bg-[#172326] border border-[#27383b] hover:bg-[#27383b] text-[#9bb0ad] hover:text-white transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Distraction Alert Counter */}
          {distractionCount > 0 && (
            <div className="inline-flex items-center gap-2 text-xs text-[#ff8a80] bg-[#ff8a80]/10 border border-[#ff8a80]/30 px-3.5 py-1.5 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
              <span>{distractionCount} tab switch{distractionCount === 1 ? '' : 'es'} logged. Stay locked in!</span>
            </div>
          )}

          {/* "At End Quiz" Trigger Button */}
          <div className="pt-4 border-t border-[#27383b]">
            <button
              onClick={handleTriggerQuiz}
              className="flex items-center gap-2 mx-auto text-xs font-bold text-[#e9cf4a] bg-[#e9cf4a]/10 hover:bg-[#e9cf4a]/20 border border-[#e9cf4a]/30 px-4 py-2 rounded-xl transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Finish Early & Take Gemini Retention Quiz</span>
            </button>
          </div>
        </div>
      )}

      {/* QUIZ GENERATING STATE */}
      {quizState === 'generating' && (
        <div className="max-w-md w-full mx-auto my-auto text-center space-y-4 py-16">
          <Sparkles className="w-12 h-12 text-[#e9cf4a] animate-spin mx-auto" />
          <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif]">
            Generating Your Retention Quiz
          </h3>
          <p className="text-xs text-[#9bb0ad]">
            Gemini is analyzing {courseName} notes to craft 3 personalized retention questions...
          </p>
        </div>
      )}

      {/* QUIZ STATE: Interactive retention quiz */}
      {quizState === 'quiz' && quizData && (
        <div className="max-w-2xl w-full mx-auto my-auto py-6 space-y-6">
          <div className="bg-[#172326] border border-[#27383b] p-6 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-[#e9cf4a] text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>At-End Study Session Quiz</span>
            </div>
            <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif]">
              {quizData.title}
            </h3>
            <p className="text-xs text-[#9bb0ad]">
              Test what you just reviewed during your study session to lock in memory retention!
            </p>
          </div>

          <div className="space-y-4">
            {quizData.questions.map((q, qIdx) => (
              <div key={qIdx} className="bg-[#172326] border border-[#27383b] p-5 rounded-2xl space-y-3">
                <p className="text-sm font-bold text-white">
                  {qIdx + 1}. {q.question}
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedAnswers[qIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectOption(qIdx, optIdx)}
                        className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#5fc3a6] text-[#0b1f19] border-[#5fc3a6] font-bold'
                            : 'bg-[#0f1719] border-[#27383b] text-[#e8efec] hover:border-[#5fc3a6]'
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setQuizState('study')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#9bb0ad] hover:text-white"
            >
              Back to Timer
            </button>
            <button
              onClick={handleSubmitQuiz}
              disabled={selectedAnswers.includes(-1)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#5fc3a6] text-[#0b1f19] hover:bg-[#4eb396] disabled:opacity-40 shadow-md"
            >
              Submit Quiz & View Results
            </button>
          </div>
        </div>
      )}

      {/* QUIZ RESULT STATE */}
      {quizState === 'result' && quizData && (
        <div className="max-w-2xl w-full mx-auto my-auto py-6 space-y-6">
          <div className="bg-[#172326] border border-[#27383b] p-6 rounded-2xl text-center space-y-3">
            <Award className="w-12 h-12 text-[#e9cf4a] mx-auto" />
            <h3 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif]">
              Study Session Score: {correctCount} / {quizData.questions.length}
            </h3>
            <p className="text-xs text-[#9bb0ad]">
              {correctCount === quizData.questions.length
                ? 'Outstanding mastery! Your retention is solid for this unit.'
                : 'Great effort! Review the explanations below to reinforce tricky spots.'}
            </p>
          </div>

          {/* Explanations */}
          <div className="space-y-4">
            {quizData.questions.map((q, qIdx) => {
              const userOpt = selectedAnswers[qIdx];
              const isCorrect = userOpt === q.correctIndex;

              return (
                <div
                  key={qIdx}
                  className={`p-5 rounded-2xl border ${
                    isCorrect
                      ? 'bg-[#172326] border-[#5fc3a6]'
                      : 'bg-[#172326] border-[#ff8a80]'
                  }`}
                >
                  <p className="text-sm font-bold text-white mb-2">
                    {qIdx + 1}. {q.question}
                  </p>
                  <p className="text-xs font-semibold text-[#9bb0ad]">
                    Your Answer: <span className={isCorrect ? 'text-[#5fc3a6]' : 'text-[#ff8a80]'}>{q.options[userOpt]}</span>
                  </p>
                  {!isCorrect && (
                    <p className="text-xs font-semibold text-[#5fc3a6] mt-1">
                      Correct Answer: {q.options[q.correctIndex]}
                    </p>
                  )}
                  <p className="text-xs text-[#9bb0ad] mt-2 pt-2 border-t border-[#27383b] italic">
                    Why: {q.explanation}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-xl font-bold text-sm bg-[#5fc3a6] text-[#0b1f19] hover:bg-[#4eb396] shadow-md"
            >
              Complete Session & Return to Cadence
            </button>
          </div>
        </div>
      )}

      {/* Bottom Info Bar */}
      <div className="max-w-4xl w-full mx-auto pt-4 border-t border-[#27383b] flex flex-wrap items-center justify-between text-xs text-[#9bb0ad] gap-2">
        <span>🛡️ Study Sesh Lockdown Mode — Pomodoro Technique & Gemini AI Powered</span>
        <span>Goal: High-yield recall before exam deadlines</span>
      </div>
    </div>
  );
};
