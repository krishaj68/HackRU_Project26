import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Play,
  Pause,
  RotateCcw,
  X,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Award,
  BookOpen,
  Maximize2,
  Minimize2,
} from 'lucide-react';
 import type { QuizData } from '../src/types';

interface StudyLockdownModalProps {
  courseName: string;
  unitName: string;
  notesContent: string;
  onClose: () => void;
}

/**
 * Set to false for strict mode: during a focus sprint the Pause, Reset and
 * mode-switch controls are disabled, so the only way out is "Exit Lockdown"
 * (which asks for confirmation) or the timer finishing.
 */
const ALLOW_PAUSE = true;

const MIN_WORK = 1;
const MAX_WORK = 180;
const MIN_BREAK = 1;
const MAX_BREAK = 60;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? Math.round(v) : min));

const readMins = (key: string, fallback: number) => {
  try {
    const n = Number(localStorage.getItem(key));
    return n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
};

const saveMins = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable, ignore */
  }
};

// Talks to the Cadence Study Lockdown Chrome extension (via its content script).
const sendToExtension = (type: 'START' | 'STOP' | 'PING', payload: Record<string, unknown> = {}) => {
  window.postMessage({ source: 'cadence-lockdown', type, ...payload }, window.location.origin);
};

export const StudyLockdownModal: React.FC<StudyLockdownModalProps> = ({
  courseName,
  unitName,
  notesContent,
  onClose,
}) => {
  // Adjustable durations (persisted)
  const [workMins, setWorkMins] = useState(() => readMins('lockdown_work_mins', 25));
  const [breakMins, setBreakMins] = useState(() => readMins('lockdown_break_mins', 5));
  const WORK_TIME = workMins * 60;
  const BREAK_TIME = breakMins * 60;

  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [secondsLeft, setSecondsLeft] = useState(() => readMins('lockdown_work_mins', 25) * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [distractionCount, setDistractionCount] = useState(0);
  const [extensionReady, setExtensionReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // End of Session Quiz State
  const [quizState, setQuizState] = useState<'study' | 'generating' | 'quiz' | 'result'>('study');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const endAtRef = useRef<number>(0);
  const secondsLeftRef = useRef(secondsLeft);
  const lastLogRef = useRef(0);
  const prevLockRef = useRef(false);

  // A "lock" is only in force during a running focus sprint (breaks are free time)
  const lockActive = isActive && mode === 'work';
  const lockRef = useRef(lockActive);
  lockRef.current = lockActive;
  secondsLeftRef.current = secondsLeft;

  const canInterrupt = ALLOW_PAUSE || !lockActive;

  /* ---------------------------------- helpers --------------------------------- */

  const logDistraction = () => {
    const now = Date.now();
    if (now - lastLogRef.current < 1000) return; // blur + visibilitychange often fire together
    lastLogRef.current = now;
    setDistractionCount((c) => c + 1);
  };

  const releaseLock = (opts: { exitFs: boolean }) => {
    lockRef.current = false;
    setIsActive(false);
    (navigator as any).keyboard?.unlock?.();
    if (opts.exitFs && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  /* ------------------------------ duration settings ----------------------------- */

  const updateDuration = (type: 'work' | 'break', raw: number) => {
    if (isActive) return;
    if (type === 'work') {
      const mins = clamp(raw, MIN_WORK, MAX_WORK);
      setWorkMins(mins);
      saveMins('lockdown_work_mins', mins);
      if (mode === 'work') setSecondsLeft(mins * 60);
    } else {
      const mins = clamp(raw, MIN_BREAK, MAX_BREAK);
      setBreakMins(mins);
      saveMins('lockdown_break_mins', mins);
      if (mode === 'break') setSecondsLeft(mins * 60);
    }
  };

  /* ---------------------------------- quiz ------------------------------------ */

  const handleTriggerQuiz = async () => {
    releaseLock({ exitFs: false });
    setSecondsLeft(WORK_TIME);
    setMode('work');
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

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (quizSubmitted) return;
    const updated = [...selectedAnswers];
    updated[qIdx] = optIdx;
    setSelectedAnswers(updated);
  };

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    setQuizState('result');
  };

  const correctCount =
    quizData?.questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correctIndex ? 1 : 0);
    }, 0) || 0;

  /* ----------------------------------- timer ---------------------------------- */

  // Timestamp-based countdown so it stays accurate even if the tab is throttled
  useEffect(() => {
    if (!isActive) return;
    endAtRef.current = Date.now() + secondsLeftRef.current * 1000;

    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(id);
        if (mode === 'work') {
          handleTriggerQuiz();
        } else {
          setIsActive(false);
          setMode('work');
          setSecondsLeft(WORK_TIME);
        }
      }
    }, 250);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, mode]);

  const toggleTimer = async () => {
    if (isActive) {
      if (!canInterrupt) return;
      releaseLock({ exitFs: false });
      return;
    }
    setNotice(null);
    setIsActive(true);
    if (mode === 'work') {
      try {
        if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
        // Chromium only: makes Esc require a press-and-hold to leave fullscreen
        await (navigator as any).keyboard?.lock?.(['Escape']);
      } catch {
        /* fullscreen denied, the rest of the lock still applies */
      }
    }
  };

  const resetTimer = () => {
    if (!canInterrupt) return;
    releaseLock({ exitFs: false });
    setSecondsLeft(mode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  const switchMode = (newMode: 'work' | 'break') => {
    if (!canInterrupt) return;
    releaseLock({ exitFs: false });
    setMode(newMode);
    setSecondsLeft(newMode === 'work' ? WORK_TIME : BREAK_TIME);
  };

  const toggleFullscreen = () => {
    if (lockActive) return;
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleExit = () => {
    if (lockActive && !window.confirm('Leave lockdown? Your current focus sprint will end.')) return;
    releaseLock({ exitFs: true });
    onClose();
  };

  /* ------------------------------ lockdown effects ---------------------------- */

  // Keep isFullscreen in sync, and pause the sprint if fullscreen is left mid-sprint
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && lockRef.current) {
        lockRef.current = false;
        setIsActive(false);
        (navigator as any).keyboard?.unlock?.();
        logDistraction();
        setNotice('Timer paused because you left fullscreen. Press Start Focus to resume.');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In-page deterrents while a sprint is running
  useEffect(() => {
    if (!lockActive) return;

    const onVisibility = () => {
      if (document.hidden) logDistraction();
    };
    const onBlur = () => logDistraction();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('contextmenu', onContextMenu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockActive]);

  // Tell the Chrome extension when the lock starts and stops
  useEffect(() => {
    if (lockActive) {
      // +5s buffer; the extension also auto-releases at this time as a failsafe
      sendToExtension('START', { endsAt: Date.now() + secondsLeftRef.current * 1000 + 5000 });
    } else if (prevLockRef.current) {
      sendToExtension('STOP');
    }
    prevLockRef.current = lockActive;
  }, [lockActive]);

  // Detect whether the extension is installed
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      if (e.data?.source === 'cadence-extension' && e.data.type === 'PONG') setExtensionReady(true);
    };
    window.addEventListener('message', onMessage);
    sendToExtension('PING');
    const retry = setTimeout(() => sendToExtension('PING'), 800);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(retry);
    };
  }, []);

  // Always release everything if the modal unmounts
  useEffect(() => {
    return () => {
      lockRef.current = false;
      sendToExtension('STOP');
      (navigator as any).keyboard?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  /* --------------------------------- formatting -------------------------------- */

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const total = mode === 'work' ? WORK_TIME : BREAK_TIME;
  const progress = Math.min(100, Math.max(0, ((total - secondsLeft) / total) * 100));

  /* ----------------------------------- render ---------------------------------- */

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#0f1719] text-[#e8efec] flex flex-col justify-between overflow-y-auto p-4 sm:p-8"
    >
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between pb-4 border-b border-[#27383b]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5fc3a6]/20 text-[#5fc3a6] flex items-center justify-center font-bold">
            <Flame className="w-5 h-5 text-[#f4d958]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#5fc3a6] text-[#0b1f19]">
                {lockActive ? 'LOCKDOWN ACTIVE' : 'LOCKDOWN READY'}
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
            disabled={lockActive}
            className="p-2 rounded-xl bg-[#172326] border border-[#27383b] text-[#9bb0ad] hover:text-white disabled:opacity-40"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#27383b] hover:bg-[#344b4f] text-xs font-bold text-white transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Exit Lockdown</span>
          </button>
        </div>
      </div>

      {/* STUDY MODE: timer on the left, notes on the right */}
      {quizState === 'study' && (
        <div className="max-w-6xl w-full mx-auto my-auto py-6 grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
          {/* Timer column */}
          <div className="text-center space-y-6">
            {/* Mode Switcher Tabs */}
            <div className="inline-flex bg-[#172326] p-1.5 rounded-2xl border border-[#27383b]">
              <button
                onClick={() => switchMode('work')}
                disabled={!canInterrupt}
                className={`px-5 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-60 ${
                  mode === 'work' ? 'bg-[#5fc3a6] text-[#0b1f19] shadow-md' : 'text-[#9bb0ad] hover:text-white'
                }`}
              >
                Focus Sprint ({workMins}m)
              </button>
              <button
                onClick={() => switchMode('break')}
                disabled={!canInterrupt}
                className={`px-5 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-60 ${
                  mode === 'break' ? 'bg-[#5fc3a6] text-[#0b1f19] shadow-md' : 'text-[#9bb0ad] hover:text-white'
                }`}
              >
                Rest Break ({breakMins}m)
              </button>
            </div>

            {/* Duration settings */}
            <div className="flex items-center justify-center gap-4 text-xs text-[#9bb0ad]">
              <label className="flex items-center gap-2">
                Focus
                <input
                  type="number"
                  min={MIN_WORK}
                  max={MAX_WORK}
                  value={workMins}
                  disabled={isActive}
                  onChange={(e) => updateDuration('work', parseInt(e.target.value, 10))}
                  className="w-16 px-2 py-1 rounded-lg bg-[#172326] border border-[#27383b] text-white text-center disabled:opacity-40"
                />
                min
              </label>
              <label className="flex items-center gap-2">
                Break
                <input
                  type="number"
                  min={MIN_BREAK}
                  max={MAX_BREAK}
                  value={breakMins}
                  disabled={isActive}
                  onChange={(e) => updateDuration('break', parseInt(e.target.value, 10))}
                  className="w-16 px-2 py-1 rounded-lg bg-[#172326] border border-[#27383b] text-white text-center disabled:opacity-40"
                />
                min
              </label>
            </div>

            {/* Pomodoro Circular Ring / Clock */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="50%" cy="50%" r="44%" className="stroke-[#172326]" strokeWidth="8" fill="none" />
                <circle
                  cx="50%"
                  cy="50%"
                  r="44%"
                  pathLength={100}
                  className="stroke-[#5fc3a6] transition-[stroke-dashoffset] duration-300 ease-linear"
                  strokeWidth="8"
                  strokeDasharray={100}
                  strokeDashoffset={100 - progress}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl sm:text-6xl font-black font-['Bricolage_Grotesque',sans-serif] tracking-tight">
                  {formatTime(secondsLeft)}
                </span>
                <span className="text-xs uppercase font-bold tracking-widest text-[#9bb0ad] mt-2">
                  {mode === 'work' ? (isActive ? 'Deep Work Mode' : 'Paused') : isActive ? 'Rest & Refresh' : 'Break Ready'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={toggleTimer}
                disabled={isActive && !canInterrupt}
                className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-base bg-[#5fc3a6] text-[#0b1f19] hover:bg-[#4eb396] shadow-lg transition-all disabled:opacity-50"
              >
                {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                <span>{isActive ? 'Pause' : 'Start Focus'}</span>
              </button>
              <button
                onClick={resetTimer}
                disabled={!canInterrupt}
                className="p-3.5 rounded-2xl bg-[#172326] border border-[#27383b] hover:bg-[#27383b] text-[#9bb0ad] hover:text-white transition-colors disabled:opacity-40"
                title="Reset Timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Notice (e.g. paused because fullscreen was left) */}
            {notice && (
              <div className="text-xs text-[#f4d958] bg-[#f4d958]/10 border border-[#f4d958]/30 px-3.5 py-2 rounded-xl">
                {notice}
              </div>
            )}

            {/* Distraction counter */}
            {distractionCount > 0 && (
              <div className="inline-flex items-center gap-2 text-xs text-[#ff8a80] bg-[#ff8a80]/10 border border-[#ff8a80]/30 px-3.5 py-1.5 rounded-xl">
                <ShieldAlert className="w-4 h-4" />
                <span>
                  {distractionCount} distraction{distractionCount === 1 ? '' : 's'} logged. Stay locked in!
                </span>
              </div>
            )}

            {/* Lock status */}
            <div
              className={`inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-xl border ${
                extensionReady
                  ? 'text-[#5fc3a6] bg-[#5fc3a6]/10 border-[#5fc3a6]/30'
                  : 'text-[#9bb0ad] bg-[#172326] border-[#27383b]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {extensionReady
                  ? 'Chrome lock on: other tabs and windows are blocked during a sprint'
                  : 'Extension not detected: only fullscreen and tab-switch tracking are active'}
              </span>
            </div>

            {/* Finish early */}
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

          {/* Notes column: the only study material available during a sprint */}
          <section className="bg-[#172326] border border-[#27383b] rounded-2xl p-6 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-[#5fc3a6] text-xs font-bold mb-3">
              <BookOpen className="w-4 h-4" />
              <span>{unitName ? `${unitName} Notes` : 'Study Notes'}</span>
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-[#e8efec]">
              {notesContent?.trim() ? notesContent : 'No notes for this unit yet. Add notes to this unit before your next session.'}
            </div>
          </section>
        </div>
      )}

      {/* QUIZ GENERATING STATE */}
      {quizState === 'generating' && (
        <div className="max-w-md w-full mx-auto my-auto text-center space-y-4 py-16">
          <Sparkles className="w-12 h-12 text-[#e9cf4a] animate-spin mx-auto" />
          <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif]">Generating Your Retention Quiz</h3>
          <p className="text-xs text-[#9bb0ad]">
            Gemini is analyzing {courseName} notes to craft 3 personalized retention questions...
          </p>
        </div>
      )}

      {/* QUIZ STATE */}
      {quizState === 'quiz' && quizData && (
        <div className="max-w-2xl w-full mx-auto my-auto py-6 space-y-6">
          <div className="bg-[#172326] border border-[#27383b] p-6 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-[#e9cf4a] text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>At-End Study Session Quiz</span>
            </div>
            <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif]">{quizData.title}</h3>
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

          <div className="space-y-4">
            {quizData.questions.map((q, qIdx) => {
              const userOpt = selectedAnswers[qIdx];
              const isCorrect = userOpt === q.correctIndex;

              return (
                <div
                  key={qIdx}
                  className={`p-5 rounded-2xl border bg-[#172326] ${isCorrect ? 'border-[#5fc3a6]' : 'border-[#ff8a80]'}`}
                >
                  <p className="text-sm font-bold text-white mb-2">
                    {qIdx + 1}. {q.question}
                  </p>
                  <p className="text-xs font-semibold text-[#9bb0ad]">
                    Your Answer:{' '}
                    <span className={isCorrect ? 'text-[#5fc3a6]' : 'text-[#ff8a80]'}>{q.options[userOpt]}</span>
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
              onClick={handleExit}
              className="px-8 py-3 rounded-xl font-bold text-sm bg-[#5fc3a6] text-[#0b1f19] hover:bg-[#4eb396] shadow-md"
            >
              Complete Session & Return to Cadence
            </button>
          </div>
        </div>
      )}

      {/* Bottom Info Bar */}
      <div className="max-w-6xl w-full mx-auto pt-4 border-t border-[#27383b] flex flex-wrap items-center justify-between text-xs text-[#9bb0ad] gap-2">
        <span>🛡️ Study Sesh Lockdown Mode — Pomodoro Technique & Gemini AI Powered</span>
        <span>Goal: High-yield recall before exam deadlines</span>
      </div>
    </div>
  );
};
