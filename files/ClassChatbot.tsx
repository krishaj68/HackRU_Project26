import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Loader2, Send, Undo2 } from 'lucide-react';

/**
 * Shape of the events the chatbot hands back. `start` / `end` are LOCAL ISO
 * strings (e.g. "2026-10-12T10:00:00") so `new Date(start)` gives the right
 * local time. Map these onto whatever your calendar state uses.
 */
export interface ChatCalendarEvent {
  uid: string;
  title: string;
  course: string;
  location: string;
  type: 'class';
  source: 'chatbot';
  start: string;
  end: string;
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  addedUids?: string[]; // events added by this message (enables Undo)
  undone?: boolean;
  error?: boolean;
}

interface ClassChatbotProps {
  /** Returns only the events newly added to the calendar. */
  onAddEvents: (events: ChatCalendarEvent[]) => ChatCalendarEvent[];
  /** Called with uids to remove when the user hits Undo. */
  onRemoveEvents?: (uids: string[]) => void;
  className?: string;
}

const SUGGESTIONS = [
  'CS 111 MWF 10:00-11:20am in Hill 114',
  'MATH 151 Tue/Thu 2pm-3:15pm',
  'Chem lab tomorrow at 1pm',
];

const GREETING: ChatMessage = {
  id: 0,
  role: 'assistant',
  text: 'Tell me your classes and I\'ll put them on your calendar. Include the course, days, and time, like "CS 111 MWF 10-11:20am".',
};

const pad = (n: number) => String(n).padStart(2, '0');

export default function ClassChatbot({ onAddEvents, onRemoveEvents, className = '' }: ClassChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: nextId.current++, role: 'user', text };
    const history = messages
      .filter((m) => m.id !== 0 && !m.error)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const now = new Date();
      const res = await fetch('/api/gemini/parse-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          today: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
          weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
          chatHistory: history,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      const events: ChatCalendarEvent[] = data.events || [];
      const addedEvents = events.length > 0 ? onAddEvents(events) : [];
      const skippedCount = events.length - addedEvents.length;
      const reply = events.length > 0
        ? addedEvents.length === 0
          ? 'Those sessions are already on your calendar.'
          : skippedCount > 0
            ? `Added ${addedEvents.length} new session${addedEvents.length === 1 ? '' : 's'}; skipped ${skippedCount} already on your calendar.`
            : data.reply || 'Added to your calendar.'
        : data.reply || 'Okay!';

      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'assistant',
          text: reply,
          addedUids: addedEvents.length ? addedEvents.map((event) => event.uid) : undefined,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'assistant',
          text: `Sorry, something went wrong (${err.message || 'network error'}). Try again?`,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const undo = (msg: ChatMessage) => {
    if (!msg.addedUids || msg.undone) return;
    onRemoveEvents?.(msg.addedUids);
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, undone: true } : m)));
  };

  return (
    <div className={`flex flex-col min-h-0 rounded-2xl border border-[#17262b]/10 bg-white ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#17262b]/10">
        <span className="grid place-items-center h-7 w-7 rounded-lg bg-[#f4d958] text-[#3a2f00]">
          <CalendarPlus size={15} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-[#17262b]">Class Assistant</p>
          <p className="text-[11px] text-[#17262b]/55">Type your classes to add them</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#17262b] text-white rounded-br-sm'
                  : m.error
                    ? 'bg-red-50 text-red-800 rounded-bl-sm'
                    : 'bg-[#f2f4f0] text-[#17262b] rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
            {m.addedUids && (
              <button
                onClick={() => undo(m)}
                disabled={m.undone}
                className="mt-1 ml-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#17262b]/60 hover:text-[#17262b] disabled:opacity-50 disabled:cursor-default"
              >
                <Undo2 size={11} />
                {m.undone ? 'Removed from calendar' : `Undo (${m.addedUids.length} added)`}
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-[#17262b]/55">
            <Loader2 size={13} className="animate-spin" /> Adding to your calendar…
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-[#17262b]/15 px-2.5 py-1 text-[11px] text-[#17262b]/75 hover:bg-[#f4d958]/40 transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-[#17262b]/10 p-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="e.g. CS 111 MWF 10-11:20am"
          className="flex-1 resize-none rounded-xl border border-[#17262b]/15 bg-[#f2f4f0] px-3 py-2 text-[13px] outline-none focus:border-[#17262b]/40 max-h-24"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          aria-label="Send"
          className="grid place-items-center h-9 w-9 shrink-0 rounded-xl bg-[#17262b] text-white disabled:opacity-40 hover:bg-[#17262b]/90 transition-colors"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
