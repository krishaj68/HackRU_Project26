import React, { useState, useEffect, useRef } from 'react';
import {
  Folder as FolderIcon,
  Plus,
  ChevronLeft,
  BookOpen,
  Send,
  Sparkles,
  Upload,
  Flame,
  Bot,
  User,
  Pencil,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Folder, ClassItem, UnitItem, ChatMessage, NoteImport } from '../types';

interface NotesViewProps {
  folders: Folder[];
  onUpdateFolders: (folders: Folder[]) => void;
  onLaunchStudySession: (courseName: string, unitName: string, notesText: string) => void;
}

const MAX_FILE_MB = 15;
const LEGACY_PLACEHOLDER = 'Add your introductory lecture notes, textbook summaries, or formulas here.';

type EditingTarget = { type: 'folder' | 'class' | 'unit' | 'note'; id: string; name: string; code: string };
type PendingImport = {
  fileName: string;
  text?: string;
  fileBase64?: string;
  mimeType?: string;
};
type OrganizedUnit = { name: string; notes: string };

const joinNotes = (existing: string, incoming: string) => {
  const cleanExisting = existing.trim();
  if (!cleanExisting || cleanExisting === LEGACY_PLACEHOLDER) return incoming;
  return `${existing.trimEnd()}\n\n${incoming}`;
};

const createNoteImport = (name: string, notes: string): NoteImport => ({
  id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  notes,
});

const compileUnitNotes = (unit: UnitItem) => [
  unit.notes.trim() && unit.notes !== LEGACY_PLACEHOLDER ? `Unit notes\n\n${unit.notes.trim()}` : '',
  ...(unit.noteImports || []).map((noteImport) => `${noteImport.name}\n\n${noteImport.notes.trim()}`),
].filter(Boolean).join('\n\n--------------------\n\n');

const IMPORTANT_NOTE_PATTERN = /\b(important|key takeaways?|key concepts?|definitions?|theorems?|formulas?|exams?|exam tip|remember|must know|critical|in summary|learning objectives?)\b|(?:\b[A-Za-z][A-Za-z0-9_]*\s*=\s*[^=]+)/i;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const nowStamp = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const NotesView: React.FC<NotesViewProps> = ({
  folders,
  onUpdateFolders,
  onLaunchStudySession,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folders[0]?.id || null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassCode, setNewClassCode] = useState('');
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [backup, setBackup] = useState<{ unitId: string; notes: string; importId?: string } | null>(null);
  const [selectedNoteTab, setSelectedNoteTab] = useState('unit');
  const [isPreview, setIsPreview] = useState(false);
  const [isFullScreenNotes, setIsFullScreenNotes] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'tutor',
      text: 'Hello! I am your Gemini Study Tutor. Ask me anything about this unit, request practice questions, or get tricky concepts explained step-by-step.',
      timestamp: nowStamp(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);

  const foldersRef = useRef(folders);
  foldersRef.current = folders;

  const currentFolder = folders.find((f) => f.id === selectedFolderId);
  const currentClass = currentFolder?.classes.find((c) => c.id === selectedClassId);
  const currentUnit = currentClass?.units.find((u) => u.id === selectedUnitId) || currentClass?.units[0];
  const currentImports = currentUnit?.noteImports || [];
  const selectedImport = currentImports.find((noteImport) => noteImport.id === selectedNoteTab);
  const resolvedNoteTab = selectedNoteTab === 'all' ? 'all' : selectedImport ? selectedNoteTab : 'unit';
  const visibleNotes = resolvedNoteTab === 'all'
    ? currentUnit ? compileUnitNotes(currentUnit) : ''
    : selectedImport?.notes ?? currentUnit?.notes ?? '';

  useEffect(() => {
    if (!folders.length) {
      if (selectedFolderId) setSelectedFolderId(null);
      return;
    }
    if (!selectedFolderId || !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id);
      setSelectedClassId(null);
    }
  }, [folders, selectedFolderId]);

  useEffect(() => {
    if (selectedClassId && !currentClass) {
      setSelectedClassId(null);
      setSelectedUnitId(null);
    }
  }, [selectedClassId, currentClass]);

  useEffect(() => {
    if (!isFullScreenNotes) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullScreenNotes(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreenNotes]);

  const mapFolder = (folderId: string, fn: (f: Folder) => Folder) =>
    onUpdateFolders(foldersRef.current.map((f) => (f.id === folderId ? fn(f) : f)));

  const mapClass = (folderId: string, classId: string, fn: (c: ClassItem) => ClassItem) =>
    mapFolder(folderId, (f) => ({
      ...f,
      classes: f.classes.map((c) => (c.id === classId ? fn(c) : c)),
    }));

  const mapUnit = (folderId: string, classId: string, unitId: string, fn: (u: UnitItem) => UnitItem) =>
    mapClass(folderId, classId, (c) => ({
      ...c,
      units: c.units.map((u) => (u.id === unitId ? fn(u) : u)),
    }));

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newF: Folder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      classes: [],
    };

    onUpdateFolders([...foldersRef.current, newF]);
    setSelectedFolderId(newF.id);
    setNewFolderName('');
    setShowCreateFolder(false);
  };

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
          notes: '',
        },
      ],
    };

    mapFolder(selectedFolderId, (f) => ({ ...f, classes: [...f.classes, newCls] }));
    setSelectedClassId(newCls.id);
    setSelectedUnitId(newCls.units[0].id);
    setNewClassName('');
    setNewClassCode('');
    setShowCreateClass(false);
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !selectedClassId || !selectedFolderId) return;

    const newU: UnitItem = {
      id: `unit-${Date.now()}`,
      name: newUnitName.trim(),
      notes: '',
    };

    mapClass(selectedFolderId, selectedClassId, (c) => ({ ...c, units: [...c.units, newU] }));
    setSelectedUnitId(newU.id);
    setNewUnitName('');
    setShowCreateUnit(false);
  };

  const openEditFolder = (f: Folder) => setEditing({ type: 'folder', id: f.id, name: f.name, code: '' });
  const openEditClass = (c: ClassItem) => setEditing({ type: 'class', id: c.id, name: c.name, code: c.code });
  const openEditUnit = (u: UnitItem) => setEditing({ type: 'unit', id: u.id, name: u.name, code: '' });
  const openEditNote = (note: NoteImport) => setEditing({ type: 'note', id: note.id, name: note.name, code: '' });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;

    if (editing.type === 'folder') {
      mapFolder(editing.id, (f) => ({ ...f, name }));
    } else if (editing.type === 'class' && selectedFolderId) {
      const code = editing.code.trim();
      mapClass(selectedFolderId, editing.id, (c) => ({ ...c, name, code: code || c.code }));
    } else if (editing.type === 'unit' && selectedFolderId && selectedClassId) {
      mapUnit(selectedFolderId, selectedClassId, editing.id, (u) => ({ ...u, name }));
    } else if (editing.type === 'note' && selectedFolderId && selectedClassId && currentUnit) {
      mapUnit(selectedFolderId, selectedClassId, currentUnit.id, (u) => ({
        ...u,
        noteImports: (u.noteImports || []).map((noteImport) =>
          noteImport.id === editing.id ? { ...noteImport, name } : noteImport
        ),
      }));
    }
    setEditing(null);
  };

  const handleDeleteNote = () => {
    if (!selectedFolderId || !selectedClassId || !currentUnit || !selectedImport) return;
    if (!window.confirm(`Delete "${selectedImport.name}"? This cannot be undone.`)) return;
    const deletedId = selectedImport.id;
    mapUnit(selectedFolderId, selectedClassId, currentUnit.id, (unit) => ({
      ...unit,
      noteImports: (unit.noteImports || []).filter((noteImport) => noteImport.id !== deletedId),
    }));
    if (backup?.importId === deletedId) setBackup(null);
    setSelectedNoteTab('unit');
    setIsPreview(false);
  };

  const toggleFullScreenNotes = () => {
    if (isFullScreenNotes) {
      setIsFullScreenNotes(false);
      return;
    }
    setIsPreview(true);
    setIsFullScreenNotes(true);
  };

  const handleUpdateNotes = (notesText: string) => {
    if (!selectedFolderId || !selectedClassId || !currentUnit) return;
    if (resolvedNoteTab === 'all') return;
    if (selectedImport) {
      mapUnit(selectedFolderId, selectedClassId, currentUnit.id, (u) => ({
        ...u,
        noteImports: (u.noteImports || []).map((noteImport) =>
          noteImport.id === selectedImport.id ? { ...noteImport, notes: notesText } : noteImport
        ),
      }));
    } else {
      mapUnit(selectedFolderId, selectedClassId, currentUnit.id, (u) => ({ ...u, notes: notesText }));
    }
  };

  const handleAddNote = () => {
    if (!selectedFolderId || !selectedClassId || !currentUnit) return;
    const noteNumber = currentImports.filter((noteImport) => noteImport.kind === 'note').length + 1;
    const note: NoteImport = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Note ${noteNumber}`,
      notes: '',
      kind: 'note',
    };
    mapUnit(selectedFolderId, selectedClassId, currentUnit.id, (unit) => ({
      ...unit,
      noteImports: [...(unit.noteImports || []), note],
    }));
    setSelectedNoteTab(note.id);
    setIsPreview(false);
  };

  const organizeNotes = async (payload: {
    mode: 'single' | 'split';
    text?: string;
    fileBase64?: string;
    mimeType?: string;
    unitTitle: string;
  }): Promise<OrganizedUnit[]> => {
    const res = await fetch('/api/gemini/organize-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        courseName: currentClass?.name || 'College Course',
        existingUnitNames: currentClass?.units.map((u) => u.name) || [],
      }),
    });
    if (!res.ok) throw new Error('Organize request failed');
    const data = await res.json();
    const units: OrganizedUnit[] = (Array.isArray(data.units) ? data.units : [])
      .map((u: any) => ({
        name: typeof u?.name === 'string' ? u.name : '',
        notes: typeof u?.notes === 'string' ? u.notes.trim() : '',
      }))
      .filter((u: OrganizedUnit) => u.notes);
    if (!units.length) throw new Error('No notes returned');
    return units;
  };

  const handleOrganizeNotes = async () => {
    if (!currentUnit || !visibleNotes.trim() || resolvedNoteTab === 'all' || !selectedFolderId || !selectedClassId) return;
    const folderId = selectedFolderId;
    const classId = selectedClassId;
    const unit = currentUnit;
    const importId = selectedImport?.id;

    setIsOrganizing(true);
    setOrganizeError(null);
    try {
      const units = await organizeNotes({ mode: 'single', text: visibleNotes, unitTitle: selectedImport?.name || unit.name });
      const organized = units.map((u) => u.notes).join('\n\n');
      setBackup({ unitId: unit.id, notes: visibleNotes, importId });
      mapUnit(folderId, classId, unit.id, (u) => importId
        ? {
            ...u,
            noteImports: (u.noteImports || []).map((noteImport) =>
              noteImport.id === importId ? { ...noteImport, notes: organized } : noteImport
            ),
          }
        : { ...u, notes: organized });
    } catch (err) {
      console.error(err);
      setOrganizeError('Could not organize these notes right now. Your notes were not changed.');
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleUndoOrganize = () => {
    if (!backup || !selectedFolderId || !selectedClassId) return;
    mapUnit(selectedFolderId, selectedClassId, backup.unitId, (u) => backup.importId
      ? {
          ...u,
          noteImports: (u.noteImports || []).map((noteImport) =>
            noteImport.id === backup.importId ? { ...noteImport, notes: backup.notes } : noteImport
          ),
        }
      : { ...u, notes: backup.notes });
    setBackup(null);
  };

  const closeImport = () => {
    setPendingImport(null);
    setImportError(null);
    setImportLoading(false);
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    setPendingImport({ fileName: file.name });

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setImportError(`That file is over ${MAX_FILE_MB} MB. Try a smaller file or split it up.`);
      return;
    }

    try {
      if (ext === 'txt' || ext === 'md') {
        const text = await file.text();
        if (!text.trim()) throw new Error('empty');
        setPendingImport({ fileName: file.name, text });
      } else if (ext === 'docx') {
        const mammoth: any = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await (mammoth.default ?? mammoth).extractRawText({ arrayBuffer });
        if (!result.value?.trim()) throw new Error('empty');
        setPendingImport({ fileName: file.name, text: result.value });
      } else if (ext === 'pdf') {
        const fileBase64 = await fileToBase64(file);
        if (!fileBase64) throw new Error('empty');
        setPendingImport({ fileName: file.name, fileBase64, mimeType: 'application/pdf' });
      } else {
        setImportError('Unsupported file type. Import a .txt, .md, .docx, or .pdf file.');
      }
    } catch (err) {
      console.error(err);
      setImportError('Could not read any text from that file. If it is a scan, try a text-based PDF.');
    }
  };

  const runImport = async (mode: 'single' | 'split' | 'raw') => {
    if (!pendingImport || !selectedFolderId || !selectedClassId || !currentUnit) return;
    const folderId = selectedFolderId;
    const classId = selectedClassId;
    const unit = currentUnit;

    if (mode === 'raw') {
      if (!pendingImport.text) return;
      const incoming = pendingImport.text.trim();
      const noteImport = createNoteImport(pendingImport.fileName, incoming);
      mapUnit(folderId, classId, unit.id, (u) => ({
        ...u,
        noteImports: [...(u.noteImports || []), noteImport],
      }));
      setSelectedNoteTab(noteImport.id);
      closeImport();
      return;
    }

    setImportLoading(true);
    setImportError(null);
    try {
      const units = await organizeNotes({
        mode,
        text: pendingImport.text,
        fileBase64: pendingImport.fileBase64,
        mimeType: pendingImport.mimeType,
        unitTitle: unit.name,
      });

      if (mode === 'single') {
        const organized = units.map((u) => u.notes).join('\n\n');
        const noteImport = createNoteImport(pendingImport.fileName, organized);
        mapUnit(folderId, classId, unit.id, (u) => ({
          ...u,
          noteImports: [...(u.noteImports || []), noteImport],
        }));
        setSelectedNoteTab(noteImport.id);
      } else {
        let firstUnitId: string | null = null;
        let firstImportId: string | null = null;
        mapClass(folderId, classId, (c) => {
          const nextUnits = [...c.units];
          units.forEach((inc, i) => {
            const incName = inc.name.trim();
            const noteImport = createNoteImport(incName || pendingImport.fileName, inc.notes);
            const idx = nextUnits.findIndex(
              (u) => incName && u.name.trim().toLowerCase() === incName.toLowerCase()
            );
            if (idx >= 0) {
              nextUnits[idx] = {
                ...nextUnits[idx],
                noteImports: [...(nextUnits[idx].noteImports || []), noteImport],
              };
              firstUnitId = firstUnitId ?? nextUnits[idx].id;
            } else {
              const created: UnitItem = {
                id: `unit-${Date.now()}-${i}`,
                name: incName || `Unit ${nextUnits.length + 1}`,
                notes: '',
                noteImports: [noteImport],
              };
              nextUnits.push(created);
              firstUnitId = firstUnitId ?? created.id;
            }
            firstImportId = firstImportId ?? noteImport.id;
          });
          return { ...c, units: nextUnits };
        });
        if (firstUnitId) setSelectedUnitId(firstUnitId);
        if (firstImportId) setSelectedNoteTab(firstImportId);
      }
      closeImport();
    } catch (err) {
      console.error(err);
      setImportError(
        pendingImport.text
          ? 'The AI organizer could not process this file right now. You can try again, or add the raw text instead.'
          : 'The AI organizer could not process this PDF right now. Please try again.'
      );
    } finally {
      setImportLoading(false);
    }
  };

  const handleExportNotes = () => {
    if (!visibleNotes.trim() || !currentClass || !currentUnit) return;
    const safeName = `${currentClass.code}-${currentUnit.name}`.replace(/[^a-z0-9-_]+/gi, '-');
    const blob = new Blob([visibleNotes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}${resolvedNoteTab === 'all' ? '-all-notes' : '-notes'}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleGenerateStudyGuide = async () => {
    if (!currentUnit || !visibleNotes.trim() || !selectedFolderId || !selectedClassId) return;
    const folderId = selectedFolderId;
    const classId = selectedClassId;
    const unit = currentUnit;

    setIsGeneratingGuide(true);
    try {
      const res = await fetch('/api/gemini/study-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: currentClass?.name || 'College Course',
          unitTitle: unit.name,
          notesContent: visibleNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate study guide');
      const data = await res.json();
      mapUnit(folderId, classId, unit.id, (u) => ({ ...u, studyGuide: data }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isBotThinking) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: nowStamp(),
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
          notesContext: visibleNotes,
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
          timestamp: nowStamp(),
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
          timestamp: nowStamp(),
        },
      ]);
    } finally {
      setIsBotThinking(false);
    }
  };

  const editModal = editing && (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] mb-3">
          {editing.type === 'folder' && 'Rename Semester Folder'}
          {editing.type === 'class' && 'Edit Class'}
          {editing.type === 'unit' && 'Rename Unit'}
          {editing.type === 'note' && 'Rename Note'}
        </h3>
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
              {editing.type === 'class' ? 'Class Title' : 'Name'}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
            />
          </div>
          {editing.type === 'class' && (
            <div>
              <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
                Course Code
              </label>
              <input
                type="text"
                value={editing.code}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-sm text-[#17262b] focus:ring-2 focus:ring-[#1f5c4d] outline-none"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3 py-2 text-xs font-bold text-[#5d6d70]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editing.name.trim()}
              className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!selectedClassId) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
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
                  <div
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedFolderId(f.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedFolderId(f.id);
                      }
                    }}
                    className={`p-4 rounded-xl border text-left font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-[#1f5c4d] bg-[#f0f7f4] text-[#1f5c4d] ring-1 ring-[#1f5c4d]'
                        : 'border-[#dde3de] bg-[#f9faf8] text-[#17262b] hover:border-[#1f5c4d]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderIcon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-[#1f5c4d]' : 'text-[#5d6d70]'}`} />
                      <span className="font-['Bricolage_Grotesque',sans-serif] text-base truncate">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white border border-[#dde3de]">
                        {f.classes.length} classes
                      </span>
                      <button
                        type="button"
                        aria-label={`Rename ${f.name}`}
                        title="Rename folder"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditFolder(f);
                        }}
                        className="p-1.5 rounded-lg text-[#5d6d70] hover:text-[#1f5c4d] hover:bg-white"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {currentFolder && (
          <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#dde3de]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#1f5c4d]/10 text-[#1f5c4d]">
                  <FolderIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                      {currentFolder.name}
                    </h3>
                    <button
                      type="button"
                      aria-label="Rename folder"
                      title="Rename folder"
                      onClick={() => openEditFolder(currentFolder)}
                      className="p-1.5 rounded-lg text-[#5d6d70] hover:text-[#1f5c4d] hover:bg-[#f2f4f0]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-[#dde3de] text-[#1f5c4d] truncate">
                        {cls.code}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-[#5d6d70] font-semibold">
                          {cls.units.length} unit{cls.units.length === 1 ? '' : 's'}
                        </span>
                        <button
                          type="button"
                          aria-label={`Edit ${cls.name}`}
                          title="Edit class name and code"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditClass(cls);
                          }}
                          className="p-1.5 rounded-lg text-[#5d6d70] hover:text-[#1f5c4d] hover:bg-[#f2f4f0]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-base font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] group-hover:text-[#1f5c4d] transition-colors">
                      {cls.name}
                    </h4>

                    {cls.instructor && <p className="text-xs text-[#5d6d70] mt-1">{cls.instructor}</p>}
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
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl">
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                    placeholder="e.g. STAT 200: Probability"
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
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl">
                    Create Class
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editModal}
      </div>
    );
  }

  const unitHasBackup = backup && currentUnit && backup.unitId === currentUnit.id;

  return (
    <div className="space-y-4">
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
              {currentClass && (
                <button
                  type="button"
                  aria-label="Edit class"
                  title="Edit class name and code"
                  onClick={() => openEditClass(currentClass)}
                  className="p-1.5 rounded-lg text-[#5d6d70] hover:text-[#1f5c4d] hover:bg-[#f2f4f0]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-[#5d6d70]">
              {currentFolder?.name} • {currentClass?.units.length} Units • {currentUnit?.name}
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            onLaunchStudySession(
              currentClass?.name || 'Class Study',
              currentUnit?.name || 'Unit Study',
              currentUnit ? compileUnitNotes(currentUnit) : ''
            )
          }
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#1f5c4d] to-[#143e33] text-white shadow-md hover:shadow-lg transition-all active:scale-98"
        >
          <Flame className="w-4 h-4 text-[#f4d958]" />
          <span>Study This Class</span>
          <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded">Lockdown</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#dde3de] p-4 shadow-xs space-y-3">
          <label className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#1f5c4d] hover:bg-[#f0f7f4] text-[#1f5c4d] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Notes File</span>
            <input
              type="file"
              accept=".txt,.md,.docx,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </label>
          <p className="text-[10px] text-[#5d6d70] px-1 -mt-1">.txt, .md, .docx or .pdf. AI can organize it for you.</p>

          <div className="space-y-1 pt-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d6d70] px-2 mb-1">Course Units</p>
            {currentClass?.units.map((unit) => {
              const isSelected = unit.id === (currentUnit?.id || '');
              return (
                <div
                  key={unit.id}
                  className={`w-full rounded-xl font-bold text-xs transition-all flex items-center ${
                    isSelected ? 'bg-[#1f5c4d] text-white shadow-xs' : 'bg-[#f9faf8] text-[#17262b] hover:bg-[#f2f4f0]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedUnitId(unit.id)}
                    className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{unit.name}</span>
                    {unit.notes && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-[#f4d958]' : 'bg-[#1f5c4d]'}`}
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${unit.name}`}
                    title="Rename unit"
                    onClick={() => openEditUnit(unit)}
                    className={`p-2 mr-1 rounded-lg shrink-0 ${
                      isSelected ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-[#5d6d70] hover:text-[#1f5c4d] hover:bg-white'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
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

        <div
          role={isFullScreenNotes ? 'dialog' : undefined}
          aria-modal={isFullScreenNotes || undefined}
          aria-label={isFullScreenNotes ? `${currentUnit?.name || 'Unit'} notes` : undefined}
          className={`${isFullScreenNotes ? 'fixed inset-0 z-[60] h-screen w-screen overflow-y-auto rounded-none border-0 bg-white p-4 sm:p-8' : 'lg:col-span-5 rounded-2xl border border-[#dde3de] bg-white p-4 sm:p-5 shadow-xs'} space-y-3`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#dde3de]">
            <div>
              <h3 className="text-base font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                {currentUnit?.name || 'Unit Notes'}
              </h3>
              <p className="text-[11px] text-[#5d6d70]">Live notes editor • Auto-saves</p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center rounded-lg border border-[#dde3de] p-0.5">
                <button
                  type="button"
                  onClick={() => setIsPreview(false)}
                  aria-pressed={!isPreview}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold ${!isPreview ? 'bg-[#1f5c4d] text-white' : 'text-[#5d6d70]'}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreview(true)}
                  aria-pressed={isPreview}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold ${isPreview ? 'bg-[#1f5c4d] text-white' : 'text-[#5d6d70]'}`}
                >
                  Read
                </button>
              </div>
              <button
                type="button"
                onClick={handleExportNotes}
                disabled={!visibleNotes.trim()}
                title="Export this tab as a text file"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[#dde3de] text-[#17262b] hover:bg-[#f2f4f0] disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={toggleFullScreenNotes}
                title={isFullScreenNotes ? 'Exit full screen' : 'View notes full screen'}
                aria-label={isFullScreenNotes ? 'Exit full screen notes' : 'View notes full screen'}
                className="shrink-0 p-2 rounded-lg border border-[#dde3de] text-[#17262b] hover:bg-[#f2f4f0]"
              >
                {isFullScreenNotes ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleOrganizeNotes}
                disabled={isOrganizing || !visibleNotes.trim() || resolvedNoteTab === 'all'}
                title="Clean up and structure these notes (you can undo)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#1f5c4d] text-[#1f5c4d] hover:bg-[#f0f7f4] disabled:opacity-50 transition-all"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isOrganizing ? 'animate-spin' : ''}`} />
                <span>{isOrganizing ? 'Organizing...' : 'Organize'}</span>
              </button>
              <button
                onClick={handleGenerateStudyGuide}
                disabled={isGeneratingGuide || !visibleNotes.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#f4d958] text-[#3a2f00] hover:bg-[#ebd252] disabled:opacity-50 transition-all shadow-xs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingGuide ? 'animate-spin' : ''}`} />
                <span>{isGeneratingGuide ? 'Generating...' : 'AI Study Guide'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <div role="tablist" aria-label="Unit note sources" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                role="tab"
                aria-selected={resolvedNoteTab === 'unit'}
                onClick={() => setSelectedNoteTab('unit')}
                className={`max-w-40 shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold truncate ${resolvedNoteTab === 'unit' ? 'bg-[#1f5c4d] text-white' : 'bg-[#f2f4f0] text-[#5d6d70] hover:text-[#17262b]'}`}
              >
                Unit notes
              </button>
              {currentImports.map((noteImport) => (
                <button
                  key={noteImport.id}
                  type="button"
                  role="tab"
                  aria-selected={resolvedNoteTab === noteImport.id}
                  title={noteImport.name}
                  onClick={() => setSelectedNoteTab(noteImport.id)}
                  className={`max-w-44 shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold truncate ${resolvedNoteTab === noteImport.id ? 'bg-[#1f5c4d] text-white' : 'bg-[#f2f4f0] text-[#5d6d70] hover:text-[#17262b]'}`}
                >
                  {noteImport.name}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={resolvedNoteTab === 'all'}
                onClick={() => setSelectedNoteTab('all')}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold ${resolvedNoteTab === 'all' ? 'bg-[#f4d958] text-[#3a2f00]' : 'bg-[#f2f4f0] text-[#5d6d70] hover:text-[#17262b]'}`}
              >
                All notes
              </button>
            </div>
            <button
              type="button"
              onClick={() => selectedImport && openEditNote(selectedImport)}
              disabled={!selectedImport}
              title="Rename selected note"
              aria-label="Rename selected note"
              className="shrink-0 p-2 rounded-lg border border-[#dde3de] text-[#5d6d70] hover:text-[#1f5c4d] hover:bg-[#f0f7f4] disabled:opacity-40"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDeleteNote}
              disabled={!selectedImport}
              title="Delete selected note"
              aria-label="Delete selected note"
              className="shrink-0 p-2 rounded-lg border border-[#dde3de] text-[#d9482b] hover:bg-[#d9482b]/10 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleAddNote}
              disabled={!currentUnit}
              title="Create a separate note in this unit"
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#1f5c4d] text-[#1f5c4d] text-xs font-bold hover:bg-[#f0f7f4] disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add note</span>
            </button>
          </div>

          {organizeError && (
            <p className="text-xs text-[#d9482b] bg-[#d9482b]/10 border border-[#d9482b]/20 rounded-lg px-3 py-2">
              {organizeError}
            </p>
          )}
          {unitHasBackup && (
            <p className="text-xs text-[#5d6d70] bg-[#f0f7f4] border border-[#1f5c4d]/20 rounded-lg px-3 py-2 flex items-center justify-between">
              <span>Notes organized.</span>
              <button onClick={handleUndoOrganize} className="font-bold text-[#1f5c4d] hover:underline">
                Undo
              </button>
            </p>
          )}

          <div>
            {resolvedNoteTab === 'all' || isPreview ? (
              <div
                role="tabpanel"
                aria-label={resolvedNoteTab === 'all' ? 'All unit notes' : 'Highlighted note preview'}
                className={`${isFullScreenNotes ? 'min-h-[65vh] max-h-[calc(100vh-18rem)] text-base sm:text-lg' : 'min-h-[21rem] max-h-[36rem] text-xs'} overflow-y-auto p-3.5 font-mono leading-relaxed rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] whitespace-pre-wrap break-words`}
              >
                {visibleNotes.split('\n').map((line, index) => {
                  const important = IMPORTANT_NOTE_PATTERN.test(line);
                  return (
                    <p
                      key={`${index}-${line}`}
                      className={important ? 'my-1 rounded-sm border-l-2 border-[#d9aa16] bg-[#fff2b8] px-2 py-1 font-bold text-[#3a2f00]' : 'min-h-[1em]'}
                    >
                      {line || <>&nbsp;</>}
                    </p>
                  );
                })}
              </div>
            ) : (
              <textarea
                role="tabpanel"
                aria-label={selectedImport?.name || 'Unit notes editor'}
                rows={14}
                value={visibleNotes === LEGACY_PLACEHOLDER ? '' : visibleNotes}
                onChange={(e) => handleUpdateNotes(e.target.value)}
                placeholder="Paste or type lecture notes, key formulas, textbook definitions, or syllabus expectations here..."
                className="w-full p-3.5 text-xs font-mono leading-relaxed rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] focus:outline-none focus:ring-2 focus:ring-[#1f5c4d] resize-y"
              />
            )}
          </div>

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

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
            {chatMessages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                      isUser ? 'bg-[#1f5c4d] text-white' : 'bg-[#f4d958] text-[#3a2f00] font-bold'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl leading-relaxed ${
                      isUser ? 'bg-[#1f5c4d] text-white rounded-tr-xs' : 'bg-[#f2f4f0] text-[#17262b] rounded-tl-xs'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className={`text-[9px] block text-right mt-1 ${isUser ? 'text-white/70' : 'text-[#5d6d70]'}`}>
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
                <button type="submit" className="px-4 py-2 text-xs font-bold bg-[#1f5c4d] text-white rounded-xl">
                  Add Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingImport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-[#dde3de] p-6 max-w-md w-full shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
                Import Notes
              </h3>
              <p className="text-xs text-[#5d6d70] mt-0.5 truncate">{pendingImport.fileName}</p>
            </div>

            {importError && (
              <p className="text-xs text-[#d9482b] bg-[#d9482b]/10 border border-[#d9482b]/20 rounded-lg px-3 py-2">
                {importError}
              </p>
            )}

            {importLoading ? (
              <div className="py-6 text-center text-xs text-[#5d6d70] space-y-2">
                <Sparkles className="w-8 h-8 text-[#1f5c4d] animate-spin mx-auto" />
                <p className="font-bold text-[#17262b]">Organizing your notes...</p>
                <p>This can take a few seconds for long files.</p>
              </div>
            ) : (
              (pendingImport.text || pendingImport.fileBase64) && (
                <div className="space-y-2">
                  <button
                    onClick={() => runImport('single')}
                    className="w-full text-left p-3.5 rounded-xl border border-[#dde3de] hover:border-[#1f5c4d] hover:bg-[#f0f7f4] transition-colors"
                  >
                    <p className="text-sm font-bold text-[#17262b]">
                      Organize into "{currentUnit?.name}"
                    </p>
                    <p className="text-xs text-[#5d6d70] mt-0.5">
                      AI cleans up the structure and adds it to this unit.
                    </p>
                  </button>
                  <button
                    onClick={() => runImport('split')}
                    className="w-full text-left p-3.5 rounded-xl border border-[#dde3de] hover:border-[#1f5c4d] hover:bg-[#f0f7f4] transition-colors"
                  >
                    <p className="text-sm font-bold text-[#17262b]">Split into units by topic</p>
                    <p className="text-xs text-[#5d6d70] mt-0.5">
                      AI groups the notes into separate units, reusing any units that already match.
                    </p>
                  </button>
                  {pendingImport.text && (
                    <button
                      onClick={() => runImport('raw')}
                      className="w-full text-left p-3.5 rounded-xl border border-[#dde3de] hover:bg-[#f2f4f0] transition-colors"
                    >
                      <p className="text-sm font-bold text-[#17262b]">Add as-is</p>
                      <p className="text-xs text-[#5d6d70] mt-0.5">Append the raw text with no AI changes.</p>
                    </button>
                  )}
                </div>
              )
            )}

            <div className="flex justify-end">
              <button
                onClick={closeImport}
                disabled={importLoading}
                className="px-3 py-2 text-xs font-bold text-[#5d6d70] disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal}
    </div>
  );
};
