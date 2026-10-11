import React, { useState } from 'react';
import { Sparkles, Timer, Flame, CheckCircle2, Calendar, RefreshCw, DownloadCloud } from 'lucide-react';

interface HeaderProps {
  userName: string;
  onUpdateName: (name: string) => void;
  onOpenStudyTime: () => void;
  syncedTime: Date;
  isSyncing: boolean;
  onRefresh: () => void;
  activeTasksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  userName,
  onUpdateName,
  onOpenStudyTime,
  syncedTime,
  isSyncing,
  onRefresh,
  activeTasksCount,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(userName);

  const handleSave = () => {
    if (nameInput.trim()) {
      onUpdateName(nameInput.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setNameInput(userName);
      setIsEditing(false);
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <header className="bg-white border-b border-[#dde3de] px-6 py-4 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Welcome Name! matching PDF wireframe */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1f5c4d] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] tracking-tight bg-[#f2f4f0] px-2 py-0.5 rounded-lg border border-[#1f5c4d] text-[#17262b] outline-none"
                />
              ) : (
                <h1
                  onClick={() => setIsEditing(true)}
                  className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] tracking-tight text-[#17262b] cursor-pointer hover:text-[#1f5c4d] transition-colors group flex items-center gap-2"
                  title="Click to change your name"
                >
                  Welcome!
                  <span className="text-xs font-normal text-[#5d6d70] opacity-0 group-hover:opacity-100 transition-opacity bg-[#f2f4f0] px-2 py-0.5 rounded-md">
                    edit
                  </span>
                </h1>
              )}
            </div>
            <p className="text-xs text-[#5d6d70] flex items-center gap-2 mt-0.5">
              <span>{formattedDate}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1f5c4d]" />
                {activeTasksCount} active assignment{activeTasksCount === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Study Time! button matching PDF wireframe */}
        <div className="flex items-center gap-3">

          {/* Canvas Sync Status */}
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5d6d70] hover:text-[#17262b] bg-[#f2f4f0] hover:bg-[#e4eae4] px-3 py-2 rounded-xl transition-all border border-[#dde3de] disabled:opacity-50"
            title="Refresh Canvas calendar & sync changes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#1f5c4d]' : ''}`} />
            <span>Synced {syncedTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </button>

          {/* PDF Page 1 prominent button: "Study Time!" */}
          <button
            onClick={onOpenStudyTime}
            className="relative group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#1f5c4d] to-[#154136] text-white shadow-md hover:shadow-lg hover:from-[#18493d] hover:to-[#11352c] active:scale-98 transition-all"
          >
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f4d958] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f4d958]"></span>
            </span>
            <Flame className="w-4 h-4 text-[#f4d958]" />
            <span className="font-['Bricolage_Grotesque',sans-serif] tracking-wide">Study Time!</span>
            <span className="text-[11px] font-semibold bg-[#ffffff24] px-1.5 py-0.5 rounded text-white/90">
              Lockdown
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
