import React, { useState } from 'react';
import { Folder as FolderIcon, Plus, ChevronLeft, BookOpen, Send, Sparkles, FileText, Upload, GraduationCap, Flame, Bot, User, CheckCircle2 } from 'lucide-react';
import { Folder, ClassItem, UnitItem, ChatMessage } from '../types';

interface NotesViewProps {
  folders: Folder[];
  onUpdateFolders: (folders: Folder[]) => void;
  onLaunchStudySession: (courseName: string, unitName: string, notesText: string) => void;
}

export const NotesView: React.FC<NotesViewProps> = ({
  folders,
  onUpdateFolders,
  onLaunchStudySession,
}) => {
  // Navigation level: 'folders' -> 'classes' -> 'class-detail'
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folders[0]?.id || null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // New Folder Modal
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // New Class Modal
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');

  // New Unit Modal
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'tutor',
      text: 'Hello! I am your Gemini Study Tutor. Ask me anything about this unit, request practice questions, or get tricky concepts explained step-by-step.',
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);

  // Study Guide Generation State
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);

  // Find currently selected objects
  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const currentClass = currentFolder?.classes.find((c) => c.id === selectedClassId);
  const currentUnit = currentClass?.units.find((u) => u.id === selectedUnitId) || currentClass?.units[0];

  // Handler: Create Folder
  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newF: Folder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      classes: [],
    };

    onUpdateFolders([...folders, newF]);
    setSelectedFolderId(newF.id);
    setNewFolderName('');
    setShowCreateFolder(false);
  };

  // Handler: Create Class
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !selectedFolderId) return;

    const newCls: ClassItem = {
      id: `class-${Date.now()}`,
      name: newClassName.trim(),
      code: newClassCode.trim() || newClassName.trim().slice(0, 8),
      color: '#1f5c4d',
      folderId: selectedFolderId,
      units: [
        {
          id: `unit-${Date.now()}-1`,
          name: 'Unit 1: Fundamentals',
          notes: 'Add your introductory lecture notes, textbook summaries, or formulas here.',
        },
      ],
    };

    const updated = folders.map((f) => {
      if (f.id === selectedFolderId) {
        return { ...f, classes: [...f.classes, newCls] };
      }
      return f;
    });

    onUpdateFolders(updated);
    setSelectedClassId(newCls.id);
    setSelectedUnitId(newCls.units[0].id);
    setNewClassName('');
    setNewClassCode('');
    setShowCreateClass(false);
  };

  // Handler: Create Unit
  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !selectedClassId || !selectedFolderId) return;

    const newU: UnitItem = {
      id: `unit-${Date.now()}`,
      name: newUnitName.trim(),
      notes: '',
    };

    const updated = folders.map((f) => {
      if (f.id === selectedFolderId) {
        const updatedClasses = f.classes.map((c) => {
          if (c.id === selectedClassId) {
            return { ...c, units: [...c.units, newU] };
          }
          return c;
        });
        return { ...f, classes: updatedClasses };
      }
      return f;
    });

    onUpdateFolders(updated);
    setSelectedUnitId(newU.id);
    setNewUnitName('');
    setShowCreateUnit(false);
  };

  // Handler: Update Unit Notes
  const handleUpdateNotes = (notesText: string) => {
    if (!selectedFolderId || !selectedClassId || !currentUnit) return;

    const updated = folders.map((f) => {
      if (f.id === selectedFolderId) {
        const updatedClasses = f.classes.map((c) => {
          if (c.id === selectedClassId) {
            const updatedUnits = c.units.map((u) => {
              if (u.id === currentUnit.id) {
                return { ...u, notes: notesText };
              }
              return u;
            });
            return { ...c, units: updatedUnits };
          }
          return c;
        });
        return { ...f, classes: updatedClasses };
      }
      return f;
    });

    onUpdateFolders(updated);
  };

  // Handler: Generate Study Guide with Gemini
  const handleGenerateStudyGuide = async () => {
    if (!currentUnit || !currentUnit.notes.trim()) return;

    setIsGeneratingGuide(true);
    try {
      const res = await fetch('/api/gemini/study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: currentClass?.name || 'College Course',
          unitTitle: currentUnit.name,
          notesContent: currentUnit.notes,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate study guide');
      const data = await res.json();

      // Update unit with studyGuide
      const updated = folders.map((f) => {
        if (f.id === selectedFolderId) {
          const updatedClasses = f.classes.map((c) => {
            if (c.id === selectedClassId) {
              const updatedUnits = c.units.map((u) => {
                if (u.id === currentUnit.id) {
                  return { ...u, studyGuide: data };
                }
                return u;
              });
              return { ...c, units: updatedUnits };
            }
            return c;
          });
          return { ...f, classes: updatedClasses };
        }
        return f;
      });

      onUpdateFolders(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  // Handler: Send Message to ChatBot
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isBotThinking) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setIsBotThinking(true);

    try {
      const res = await fetch('/api/gemini/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: currentClass?.name || 'Class',
          unitTitle: currentUnit?.name || 'Unit',
          notesContext: currentUnit?.notes || '',
          message: text,
          chatHistory: nextHistory.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (!res.ok) throw new Error('Tutor response failed');
      const data = await res.json();

      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'tutor',
          text: data.reply || 'Let me help you with that concept.',
          timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'tutor',
          text: 'I could not connect right now, but feel free to review your unit notes and formulas.',
          timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsBotThinking(false);
    }
  };

  // SCREEN 1: Notes Folders List (Matching PDF Page 3 top)
  if (!selectedClassId) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] tracking-tight">
              Notes
            </h2>
            <p className="text-xs text-[#5d6d70] mt-1">
              Organize your semester folders, course units, lecture notes, and AI-generated study guides.
            </p>
          </div>

          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-[#1f5c4d] text-white hover:bg-[#18493d] transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Folder</span>
          </button>
        </div>

        {/* Folder selection buttons matching PDF Page 3 wireframe: "Fall Sem 25", "Spring Sem 26", "Fall Sem 26" */}
        <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs">
          <p className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider mb-3">
            Select Semester Folder:
          </p>
          {folders.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5d6d70] bg-[#f9faf8] rounded-xl border border-dashed border-[#dde3de]">
              <BookOpen className="w-8 h-8 text-[#9bb0ad] mx-auto mb-2" />
              <p className="font-bold text-sm text-[#17262b]">No Semester Classes Yet</p>
              <p className="mt-1">Import your Canvas calendar or click "Create Folder" above to set up your semester classes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {folders.map((f) => {
                const isSelected = f.id === selectedFolderId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`p-4 rounded-xl border text-left font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-[#1f5c4d] bg-[#f0f7f4] text-[#1f5c4d] ring-1 ring-[#1f5c4d]'
                        : 'border-[#dde3de] bg-[#f9faf8] text-[#17262b] hover:border-[#1f5c4d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderIcon className={`w-5 h-5 ${isSelected ? 'text-[#1f5c4d]' : 'text-[#5d6d70]'}`} />
                      <span className="font-['Bricolage_Grotesque',sans-serif] text-base">{f.name}</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-[#dde3de]">
                      {f.classes.length} classes
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SCREEN 2 (Inside selected folder): Matching "First screen then click on folder then next to show up is this ↓" */}
        {currentFolder && (
          <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#dde3de]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#1f5c4d]/10 text-[#1f5c4d]">
                  <FolderIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                    {currentFolder.name}
                  </h3>
                  <p className="text-xs text-[#5d6d70]">Click on any class to view unit notes and chat with the AI tutor</p>
                </div>
              </div>

              <button
                onClick={() => setShowCreateClass(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-[#1f5c4d] text-white hover:bg-[#18493d] transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Class</span>
              </button>
            </div>

            {/* Class Cards Grid matching PDF Page 3 wireframe: "Class 1", "Class 2", "Class 3", "Class 4", "Class 5" */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {currentFolder.classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setSelectedUnitId(cls.units[0]?.id || null);
                  }}
                  className="p-5 rounded-2xl border border-[#dde3de] bg-[#f9faf8] hover:bg-white hover:border-[#1f5c4d] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-[#dde3de] text-[#1f5c4d]">
                        {cls.code}
                      </span>
                      <span className="text-xs text-[#5d6d70] font-semibold">
                        {cls.units.length} unit{cls.units.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] group-hover:text-[#1f5c4d] transition-colors">
                      {cls.name}
                    </h4>

                    {cls.instructor && (
                      <p className="text-xs text-[#5d6d70] mt-1">{cls.instructor}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#dde3de] mt-3 flex items-center justify-between text-xs font-bold text-[#1f5c4d]">
                    <span>Open Class & Notes</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Create Folder */}
        {showCreateFolder && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-2">
                Create Semester Folder
              </h3>
              <form onSubmit={handleAddFolder} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="e.g. Spring Sem 27"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateFolder(false)}
                    className="px-3 py-2 text-xs font-bold text-[#5d6d70]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Class */}
        {showCreateClass && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-1">
                Create New Class
              </h3>
              <p className="text-xs text-[#5d6d70] mb-4">Add a course to {currentFolder?.name}</p>
              <form onSubmit={handleAddClass} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">Class Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 6 - STAT 200: Probability"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">Course Code</label>
                  <input
                    type="text"
                    placeholder="e.g. STAT 200"
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateClass(false)}
                    className="px-3 py-2 text-xs font-bold text-[#5d6d70]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl"
                  >
                    Create Class
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // SCREEN 3: 3-Column Class View (Matching PDF Page 3 wireframe: Top Class 1 & Study button, Left Units + Import, Middle Note 1, Right Chat Bot)
  return (
    <div className="space-y-4">
      {/* Top Header Bar matching wireframe: [Class 1] on left, [Study] button on right */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedClassId(null)}
            className="p-2 rounded-xl border border-[#dde3de] hover:bg-[#f2f4f0] text-[#17262b] transition-colors"
            title="Back to Semester Classes"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#1f5c4d] text-white">
                {currentClass?.code}
              </span>
              <h2 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                {currentClass?.name}
              </h2>
            </div>
            <p className="text-xs text-[#5d6d70]">
              {currentFolder?.name} • {currentClass?.units.length} Units • {currentUnit?.name}
            </p>
          </div>
        </div>

        {/* Top Right "Study" Button matching PDF Page 3 */}
        <button
          onClick={() =>
            onLaunchStudySession(
              currentClass?.name || 'Class Study',
              currentUnit?.name || 'Unit Study',
              currentUnit?.notes || ''
            )
          }
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#1f5c4d] to-[#143e33] text-white shadow-md hover:shadow-lg transition-all active:scale-98"
        >
          <Flame className="w-4 h-4 text-[#f4d958]" />
          <span>Study This Class</span>
          <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded">Lockdown</span>
        </button>
      </div>

      {/* 3-Column Layout Matching PDF Page 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* COLUMN 1 (Left, 3 cols): Import button + Unit 1, Unit 2, Unit 3, Unit 4, Unit 5 */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#dde3de] p-4 shadow-xs space-y-3">
          {/* Import Button */}
          <label className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#1f5c4d] hover:bg-[#f0f7f4] text-[#1f5c4d] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Notes File</span>
            <input
              type="file"
              accept=".txt,.md,.pdf,.doc"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const content = evt.target?.result as string;
                  if (content) {
                    handleUpdateNotes((currentUnit?.notes || '') + '\n\n' + content);
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>

          {/* Units Navigation List */}
          <div className="space-y-1 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d6d70] px-2 mb-1">
              Course Units
            </p>
            {currentClass?.units.map((unit) => {
              const isSelected = unit.id === (currentUnit?.id || '');
              return (
                <button
                  key={unit.id}
                  onClick={() => setSelectedUnitId(unit.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#1f5c4d] text-white shadow-xs'
                      : 'bg-[#f9faf8] text-[#17262b] hover:bg-[#f2f4f0]'
                  }`}
                >
                  <span className="truncate">{unit.name}</span>
                  {unit.notes && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-[#f4d958]' : 'bg-[#1f5c4d]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowCreateUnit(true)}
            className="w-full py-2 px-3 rounded-xl border border-[#dde3de] text-xs font-bold text-[#5d6d70] hover:text-[#17262b] hover:bg-[#f2f4f0] transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Unit</span>
          </button>
        </div>

        {/* COLUMN 2 (Middle, 5 cols): Note 1 content editor & study guide */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#dde3de] p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#dde3de]">
            <div>
              <h3 className="text-base font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                {currentUnit?.name || 'Unit Notes'}
              </h3>
              <p className="text-[11px] text-[#5d6d70]">Live notes editor • Auto-saves</p>
            </div>

            <button
              onClick={handleGenerateStudyGuide}
              disabled={isGeneratingGuide || !currentUnit?.notes?.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#f4d958] text-[#3a2f00] hover:bg-[#ebd252] disabled:opacity-50 transition-all shadow-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingGuide ? 'animate-spin' : ''}`} />
              <span>{isGeneratingGuide ? 'Generating...' : 'AI Study Guide'}</span>
            </button>
          </div>

          {/* Notes Textarea */}
          <div>
            <textarea
              rows={14}
              value={currentUnit?.notes || ''}
              onChange={(e) => handleUpdateNotes(e.target.value)}
              placeholder="Paste or type lecture notes, key formulas, textbook definitions, or syllabus expectations here..."
              className="w-full p-3.5 text-xs font-mono leading-relaxed rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] focus:outline-none focus:ring-2 focus:ring-[#1f5c4d] resize-y"
            />
          </div>

          {/* AI Generated Study Guide Display */}
          {currentUnit?.studyGuide && (
            <div className="mt-4 p-4 rounded-xl bg-[#f0f7f4] border border-[#1f5c4d]/30 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-[#1f5c4d] font-bold">
                <Sparkles className="w-4 h-4 text-[#f4d958]" />
                <span className="font-['Bricolage_Grotesque',sans-serif] text-sm">
                  Gemini Study Guide & High-Yield Summary
                </span>
              </div>

              <div>
                <p className="font-bold text-[#17262b]">Summary:</p>
                <p className="text-[#5d6d70] mt-0.5">{currentUnit.studyGuide.summary}</p>
              </div>

              {currentUnit.studyGuide.cheatSheet && (
                <div>
                  <p className="font-bold text-[#17262b]">Formula / Cheat Sheet:</p>
                  <pre className="font-mono text-[11px] bg-white p-2.5 rounded-lg border border-[#dde3de] mt-1 whitespace-pre-wrap">
                    {currentUnit.studyGuide.cheatSheet}
                  </pre>
                </div>
              )}

              {currentUnit.studyGuide.commonPitfalls?.length > 0 && (
                <div>
                  <p className="font-bold text-[#d9482b]">Common Exam Pitfalls:</p>
                  <ul className="list-disc list-inside text-[#5d6d70] mt-0.5 space-y-0.5">
                    {currentUnit.studyGuide.commonPitfalls.map((pitfall, i) => (
                      <li key={i}>{pitfall}</li>
                    ))}
                  </ul>
                </div>
              )}

              {currentUnit.studyGuide.reviewQuestions?.length > 0 && (
                <div>
                  <p className="font-bold text-[#1f5c4d]">Practice Review Questions:</p>
                  <ul className="list-decimal list-inside text-[#17262b] mt-0.5 space-y-0.5 font-medium">
                    {currentUnit.studyGuide.reviewQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMN 3 (Right, 4 cols): Chat Bot grounded in notes */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#dde3de] p-4 shadow-xs flex flex-col h-[560px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#dde3de] mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-[#1f5c4d] text-[#f4d958]">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                  Chat Bot (AI Tutor)
                </h4>
                <p className="text-[10px] text-[#5d6d70]">Grounded in {currentClass?.code} notes</p>
              </div>
            </div>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {chatMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
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
                    <p>{msg.text}</p>
                    <span
                      className={`text-[9px] block text-right mt-1 ${
                        isUser ? 'text-white/70' : 'text-[#5d6d70]'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {isBotThinking && (
              <div className="flex items-center gap-2 text-xs text-[#5d6d70] italic pl-2">
                <Sparkles className="w-3.5 h-3.5 animate-spin text-[#1f5c4d]" />
                <span>Tutor is thinking...</span>
              </div>
            )}
          </div>

          {/* Chat input box */}
          <form onSubmit={handleSendMessage} className="mt-3 pt-2 border-t border-[#dde3de] flex gap-2">
            <input
              type="text"
              placeholder={`Ask a question on ${currentUnit?.name || 'this unit'}...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] focus:outline-none focus:ring-2 focus:ring-[#1f5c4d]"
            />
            <button
              type="submit"
              disabled={isBotThinking || !chatInput.trim()}
              className="p-2 rounded-xl bg-[#1f5c4d] text-white hover:bg-[#18493d] disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Modal: Create Unit */}
      {showCreateUnit && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-2">
              Add New Unit
            </h3>
            <form onSubmit={handleAddUnit} className="space-y-4">
              <input
                type="text"
                required
                placeholder="e.g. Unit 6: Dynamic Programming"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUnit(false)}
                  className="px-3 py-2 text-xs font-bold text-[#5d6d70]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl"
                >
                  Add Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
