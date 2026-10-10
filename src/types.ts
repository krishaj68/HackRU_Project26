export interface Assignment {
  uid: string;
  title: string;
  course: string;
  start: Date;
  all: boolean;
  desc: string;
  url: string;
  type: 'a' | 'e'; // 'a' = assignment, 'e' = calendar event
  weight: number; // percentage of grade (e.g., 15 for 15%)
  completed: boolean;
  priorityScore?: number;
  priorityRank?: number;
  estimatedHours?: number;
  urgency?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  geminiReason?: string;
  recommendedSlot?: string;
}

export interface Exam {
  id: string;
  title: string;
  course: string;
  date: string; // ISO string
  weight: number; // % of course grade
  location: string;
  topics: string[];
}

export interface UnitItem {
  id: string;
  name: string;
  notes: string;
  studyGuide?: {
    summary: string;
    keyConcepts: string[];
    cheatSheet: string;
    commonPitfalls: string[];
    reviewQuestions: string[];
  };
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  instructor?: string;
  color: string;
  folderId: string;
  units: UnitItem[];
}

export interface Folder {
  id: string;
  name: string;
  classes: ClassItem[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'tutor';
  text: string;
  timestamp: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

export interface ScheduleBlock {
  id: string;
  day: string;
  date?: string;
  time: string;
  course: string;
  taskTitle: string;
  duration: string;
  focusType: 'assignment' | 'exam_prep' | 'review' | 'break';
  notes: string;
}

export type ViewTab = 'schedule' | 'imports' | 'todo' | 'notes' | 'exams';
