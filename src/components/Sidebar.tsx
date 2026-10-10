import React from 'react';
import { CalendarDays, DownloadCloud, CheckSquare, BookOpen, Clock, Sparkles } from 'lucide-react';
import { ViewTab } from '../types';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  assignmentCount: number;
  examCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  assignmentCount,
  examCount,
}) => {
  const navItems = [
    {
      id: 'schedule' as ViewTab,
      label: 'Schedule',
      icon: CalendarDays,
      description: 'Calendar & workload per day',
    },
    {
      id: 'imports' as ViewTab,
      label: 'Imports',
      icon: DownloadCloud,
      description: 'Canvas link, files & links',
    },
    {
      id: 'todo' as ViewTab,
      label: 'To Do',
      icon: CheckSquare,
      badge: assignmentCount > 0 ? assignmentCount : undefined,
      description: 'Assignments & Gemini AI priority',
    },
    {
      id: 'notes' as ViewTab,
      label: 'Notes',
      icon: BookOpen,
      description: 'Semesters, classes & AI tutor',
    },
    {
      id: 'exams' as ViewTab,
      label: 'Exams',
      icon: Clock,
      badge: examCount > 0 ? examCount : undefined,
      description: 'Chronological list & countdown',
    },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#1e2a2e] text-white p-4 flex flex-col justify-between rounded-2xl shadow-sm shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9bb0ad]">Navigation</p>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full text-left px-3.5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-between group ${
                isActive
                  ? 'bg-[#1f5c4d] text-white shadow-md font-bold'
                  : 'text-[#dde3de] hover:bg-[#28383e] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-[#f4d958]' : 'text-[#9bb0ad]'
                  }`}
                />
                <span className="font-['Bricolage_Grotesque',sans-serif] tracking-tight text-[15px]">
                  {item.label}
                </span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-[#f4d958] text-[#3a2f00]'
                      : 'bg-[#2f4249] text-[#dde3de]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Gemini AI assistant badge */}
      <div className="mt-6 pt-4 border-t border-[#2d3e44] p-3 rounded-xl bg-[#172225]/60">
        <div className="flex items-center gap-2 text-[#f4d958] text-xs font-bold mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini 3.8 Flash Active</span>
        </div>
        <p className="text-[11px] text-[#9bb0ad] leading-relaxed">
          Automated task weight prioritization, note study guides, interactive tutor & post-session quizzes.
        </p>
      </div>
    </aside>
  );
};
