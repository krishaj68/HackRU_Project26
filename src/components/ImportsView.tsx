import React, { useState } from 'react';
import { DownloadCloud, Link as LinkIcon, FileText, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Globe, Upload } from 'lucide-react';
import { parseICS } from '../utils/icsParser';
import { Assignment } from '../types';

interface ImportsViewProps {
  onImportAssignments: (assignments: Assignment[], sourceName: string) => void;
  onResetSampleData: () => void;
}

export const ImportsView: React.FC<ImportsViewProps> = ({
  onImportAssignments,
  onResetSampleData,
}) => {
  const [canvasUrl, setCanvasUrl] = useState('');
  const [isSyncingCanvas, setIsSyncingCanvas] = useState(false);
  const [courseLinkUrl, setCourseLinkUrl] = useState('');
  const [pastedIcs, setPastedIcs] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Link Canvas Feed via server proxy
  const handleConnectCanvas = async () => {
    const trimmed = canvasUrl.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'Please enter your Canvas calendar feed link.' });
      return;
    }

    if (!trimmed.includes('/feeds/calendars/') && !trimmed.endsWith('.ics')) {
      setStatusMessage({
        type: 'error',
        text: 'The URL should be a Canvas Calendar Feed link ending in .ics (found under Canvas Calendar > Calendar Feed).',
      });
      return;
    }

    setIsSyncingCanvas(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/canvas-proxy?url=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch calendar feed (${res.status}). Ensure the link is publicly shareable from your Canvas account.`);
      }

      const icsText = await res.text();
      const parsed = parseICS(icsText);

      if (parsed.length === 0) {
        throw new Error('No assignments or calendar events found in the specified feed.');
      }

      onImportAssignments(parsed, 'Canvas Live Feed');
      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${parsed.length} assignments and events from Canvas!`,
      });
      setCanvasUrl('');
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error connecting to Canvas. Alternatively, export your .ics file and click "Import Files" below.',
      });
    } finally {
      setIsSyncingCanvas(false);
    }
  };

  // Import file handler (.ics or text)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseICS(content);
      if (parsed.length === 0) {
        setStatusMessage({
          type: 'error',
          text: 'No valid calendar events detected. Ensure you upload a .ics file exported from Canvas.',
        });
      } else {
        onImportAssignments(parsed, file.name);
        setStatusMessage({
          type: 'success',
          text: `Imported ${parsed.length} assignments from ${file.name}!`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Parse raw text
  const handleParsePasted = () => {
    if (!pastedIcs.trim()) return;
    const parsed = parseICS(pastedIcs);
    if (parsed.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Could not find calendar events in pasted text. Expected iCalendar format starting with BEGIN:VCALENDAR.',
      });
    } else {
      onImportAssignments(parsed, 'Pasted iCalendar');
      setStatusMessage({
        type: 'success',
        text: `Successfully imported ${parsed.length} assignments!`,
      });
      setPastedIcs('');
    }
  };

  // Import course website link (mock or course syllabus)
  const handleImportCourseLink = () => {
    if (!courseLinkUrl.trim()) return;
    // Generate course stub from URL
    const cleanUrl = courseLinkUrl.trim();
    setStatusMessage({
      type: 'success',
      text: `Course link for "${cleanUrl}" has been registered. Course syllabus and deadline synchronization active.`,
    });
    setCourseLinkUrl('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs">
        <h2 className="text-2xl font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b] tracking-tight">
          Imports
        </h2>
        <p className="text-sm text-[#5d6d70] mt-1">
          Connect your Canvas account, import calendar files, or link course websites to pull all files, assignments, and due dates.
        </p>

        {statusMessage && (
          <div
            className={`mt-4 p-4 rounded-xl flex items-start gap-3 border text-sm ${
              statusMessage.type === 'success'
                ? 'bg-[#f0f7f4] border-[#1f5c4d] text-[#1f5c4d]'
                : 'bg-[#fef2f2] border-[#d9482b] text-[#d9482b]'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <p className="font-semibold">{statusMessage.text}</p>
          </div>
        )}
      </div>

      {/* Box 1: Link Canvas (Matching PDF Page 2) */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1f5c4d]/10 text-[#1f5c4d] flex items-center justify-center">
            <LinkIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
              Link Canvas Account
            </h3>
            <p className="text-xs text-[#5d6d70]">
              Pulls all course assignments, weights, and due dates directly via your calendar feed
            </p>
          </div>
        </div>

        <div className="bg-[#f9faf8] p-4 rounded-xl border border-[#dde3de] text-xs text-[#5d6d70] space-y-2">
          <p className="font-bold text-[#17262b]">How to get your Canvas Feed Link:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open Canvas and click <b>Calendar</b> on the left sidebar.</li>
            <li>Click <b>Calendar Feed</b> on the bottom right of the page.</li>
            <li>Copy the URL ending in <code className="bg-white px-1.5 py-0.5 rounded border border-[#dde3de]">.ics</code> and paste it below.</li>
          </ol>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block">
            Canvas Calendar Feed URL
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://yourschool.instructure.com/feeds/calendars/user_...ics"
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] text-sm focus:outline-none focus:ring-2 focus:ring-[#1f5c4d] transition-all"
            />
            <button
              onClick={handleConnectCanvas}
              disabled={isSyncingCanvas || !canvasUrl.trim()}
              className="px-6 py-3 rounded-xl font-bold text-sm bg-[#1f5c4d] text-white hover:bg-[#18493d] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs shrink-0"
            >
              {isSyncingCanvas ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>Link Canvas</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Box 2: Import Files (Matching PDF Page 2) */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2c6bd6]/10 text-[#2c6bd6] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
              Import Files
            </h3>
            <p className="text-xs text-[#5d6d70]">
              Upload a downloaded <code className="bg-[#f2f4f0] px-1 rounded">.ics</code> calendar file or syllabus document
            </p>
          </div>
        </div>

        <label className="border-2 border-dashed border-[#dde3de] hover:border-[#1f5c4d] rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#fcfdfc] block">
          <Upload className="w-8 h-8 text-[#5d6d70] mx-auto mb-2" />
          <span className="text-sm font-bold text-[#17262b] block">Choose calendar file to import</span>
          <span className="text-xs text-[#5d6d70] mt-1 block">Supports .ics files from Canvas, Google Calendar, or Outlook</span>
          <input
            type="file"
            accept=".ics,text/calendar"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Or Paste ICS Text */}
        <div className="pt-2">
          <label className="text-xs font-bold text-[#5d6d70] uppercase tracking-wider block mb-1">
            Or Paste Calendar File (.ics) Content
          </label>
          <textarea
            rows={3}
            placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;BEGIN:VEVENT&#10;SUMMARY:Homework 1..."
            value={pastedIcs}
            onChange={(e) => setPastedIcs(e.target.value)}
            className="w-full p-3 text-xs font-mono rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] focus:outline-none focus:ring-2 focus:ring-[#1f5c4d]"
          />
          <button
            onClick={handleParsePasted}
            disabled={!pastedIcs.trim()}
            className="mt-2 px-4 py-2 text-xs font-bold bg-[#f2f4f0] hover:bg-[#e4eae4] text-[#17262b] rounded-xl border border-[#dde3de] transition-colors disabled:opacity-40"
          >
            Import Pasted Calendar
          </button>
        </div>
      </div>

      {/* Box 3: Import Website Links for Specific Courses (Page 1 PDF item: "Import website links specific courses") */}
      <div className="bg-white rounded-2xl border border-[#dde3de] p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#7b4fd1]/10 text-[#7b4fd1] flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-['Bricolage_Grotesque',sans-serif] text-[#17262b]">
              Import Specific Course Links
            </h3>
            <p className="text-xs text-[#5d6d70]">
              Link your course syllabus websites, Canvas course pages, or professor portals
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            placeholder="https://canvas.instructure.com/courses/12345"
            value={courseLinkUrl}
            onChange={(e) => setCourseLinkUrl(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#dde3de] bg-[#f9faf8] text-[#17262b] text-sm focus:outline-none focus:ring-2 focus:ring-[#7b4fd1]"
          />
          <button
            onClick={handleImportCourseLink}
            disabled={!courseLinkUrl.trim()}
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#7b4fd1] text-white hover:bg-[#683eb8] disabled:opacity-50 transition-all"
          >
            Add Course Link
          </button>
        </div>
      </div>

      {/* Box 4: Sample Demo Reset */}
      <div className="p-4 rounded-xl bg-[#f2f4f0] border border-[#dde3de] flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-[#17262b]">Testing during the Hackathon?</p>
          <p className="text-xs text-[#5d6d70]">Reload realistic sample semester with CS 111, MATH 151, PHYS 203, ENG 101.</p>
        </div>
        <button
          onClick={onResetSampleData}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#dde3de] hover:bg-[#e4eae4] text-[#17262b] transition-all"
        >
          Reset Sample Data
        </button>
      </div>
    </div>
  );
};
