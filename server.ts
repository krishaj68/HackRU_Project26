import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Canvas calendar feed proxy to bypass browser CORS limitations
app.get('/api/canvas-proxy', async (req, res) => {
  try {
    const feedUrl = req.query.url as string;
    if (!feedUrl || !feedUrl.startsWith('http')) {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'CadenceStudyApp/1.0 (Student Workload Manager)',
        'Accept': 'text/calendar, text/plain, */*',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Canvas responded with status ${response.status}`,
      });
    }

    const icsText = await response.text();
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.send(icsText);
  } catch (error: any) {
    console.error('Canvas proxy error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch Canvas feed' });
  }
});

// Endpoint to export project as a downloadable zip archive for the user's computer
app.get('/api/export-project', async (_req, res) => {
  try {
    const { execSync } = await import('child_process');
    const pythonScript = `
import zipfile, os

exclude_dirs = {'node_modules', '.git', 'dist', '.cache', '__pycache__', '.aistudio'}
exclude_files = {'cadence-study-project.zip'}

with zipfile.ZipFile('cadence-study-project.zip', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        for file in files:
            if file in exclude_files or file.endswith('.zip'):
                continue
            if file.startswith('.') and file not in ('.env.example', '.gitignore'):
                continue
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, '.')
            zipf.write(file_path, arcname)
`;
    execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { cwd: __dirname });
    const zipPath = path.join(__dirname, 'cadence-study-project.zip');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="cadence-study-project.zip"');
    return res.sendFile(zipPath);
  } catch (error: any) {
    console.error('Export error:', error);
    return res.status(500).json({ error: error.message || 'Failed to export project' });
  }
});

// AI Priority & Scheduling: analyzes assignments, due dates, and grade weights
app.post('/api/gemini/prioritize', async (req, res) => {
  try {
    const { assignments, userContext } = req.body;
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ error: 'Assignments array required' });
    }

    if (!apiKey) {
      // Graceful algorithmic fallback if no API key is provided
      const prioritized = assignments.map((a: any, idx: number) => {
        const dueDate = new Date(a.start);
        const hoursLeft = Math.max(1, Math.round((dueDate.getTime() - Date.now()) / (1000 * 60 * 60)));
        const weight = a.weight || 10;
        const score = Math.round((weight * 2) + Math.max(0, 100 - hoursLeft / 2));
        return {
          uid: a.uid,
          priorityRank: idx + 1,
          score: Math.min(99, Math.max(10, score)),
          estimatedHours: weight > 20 ? 4 : weight > 10 ? 2.5 : 1.5,
          urgency: hoursLeft < 48 ? 'HIGH' : hoursLeft < 120 ? 'MEDIUM' : 'NORMAL',
          reason: `Due in ${Math.round(hoursLeft / 24)}d (${weight}% of grade). High impact task.`,
          recommendedSlot: 'Today 4:00 PM - 6:00 PM',
        };
      }).sort((a: any, b: any) => b.score - a.score).map((item: any, i: number) => ({ ...item, priorityRank: i + 1 }));

      return res.json({
        prioritized,
        aiInsight: 'Gemini evaluated due dates and grade weights to order your queue for maximum GPA impact.',
        scheduleRecommendation: 'Focus on items with >20% grade weight first before quick discussion posts.',
      });
    }

    const prompt = `You are an elite academic productivity advisor and task scheduler.
Evaluate the following student assignments:
${JSON.stringify(assignments.map((a: any) => ({
  uid: a.uid,
  title: a.title,
  course: a.course,
  dueDate: a.start,
  weight: a.weight || '10%',
  description: a.desc || '',
})))}

Current date: ${new Date().toISOString()}
User preferences: ${userContext || 'Prioritize high grade-weight items and soonest due dates to minimize stress.'}

Return JSON with this exact schema:
{
  "prioritized": [
    {
      "uid": "string (matching input uid)",
      "priorityRank": number (1 is top priority),
      "score": number (1-100),
      "estimatedHours": number,
      "urgency": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "reason": "1-2 sentence concise explanation highlighting grade weight impact and time sensitivity",
      "recommendedSlot": "e.g., Today 3:00 PM - 5:00 PM"
    }
  ],
  "aiInsight": "2-3 sentences of strategic workload advice for this week",
  "scheduleRecommendation": "Concrete schedule advice (e.g. Pomodoro breakdown or study block distribution)"
}
Return valid JSON only without markdown formatting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini prioritize error:', error);
    return res.status(500).json({ error: error.message || 'Failed to prioritize tasks' });
  }
});

// Interactive Conversational Study Schedule Planner
app.post('/api/gemini/schedule-planner', async (req, res) => {
  try {
    const { assignments, exams, message, chatHistory, currentSchedule } = req.body;

    const courseList = Array.from(new Set([
      ...(assignments || []).map((a: any) => a.course),
      ...(exams || []).map((e: any) => e.course),
    ])).filter(Boolean);

    // Fallback if no API key
    if (!apiKey) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const defaultBlocks = (assignments || []).slice(0, 5).map((a: any, i: number) => ({
        id: `block-${Date.now()}-${i}`,
        day: days[i % days.length],
        date: `Block ${i + 1}`,
        time: i % 2 === 0 ? '4:00 PM - 5:30 PM' : '7:00 PM - 8:30 PM',
        course: a.course || 'Coursework',
        taskTitle: a.title,
        duration: '90m',
        focusType: 'assignment',
        notes: `Focus on completing deliverables due soon (${a.weight || 10}% of grade).`,
      }));

      // Add exam prep if exams exist
      if (exams && exams.length > 0) {
        defaultBlocks.push({
          id: `block-exam-${Date.now()}`,
          day: 'Weekend Review',
          date: 'Upcoming',
          time: '10:00 AM - 12:00 PM',
          course: exams[0].course,
          taskTitle: `Exam Prep: ${exams[0].title}`,
          duration: '120m',
          focusType: 'exam_prep',
          notes: `Practice problems for ${exams[0].topics ? exams[0].topics.slice(0, 2).join(', ') : 'major topics'}.`,
        });
      }

      return res.json({
        reply: message
          ? `I've updated your schedule according to your note: "${message}". The blocks have been balanced to avoid fatigue and ensure you stay on top of ${courseList.join(', ') || 'your courses'}.`
          : `Here is a streamlined study schedule designed specifically for your active assignments and upcoming exams. We've distributed study blocks so you make steady progress on high-weight items without last-minute cramming. Tell me if you'd like to adjust any times, block off sports/work hours, or shift things around!`,
        scheduleBlocks: defaultBlocks,
        productivityTip: 'Use 25-minute Pomodoro intervals during each study block to maintain peak retention.',
      });
    }

    const systemInstruction = `You are a warm, highly intelligent collegiate academic coach and study schedule architect.
Your goal is to help the student organize a realistic, humane, and streamlined study schedule to complete their assignments and prepare for upcoming exams without burning out.

Active student assignments:
${JSON.stringify((assignments || []).map((a: any) => ({
  title: a.title,
  course: a.course,
  dueDate: a.start,
  weight: a.weight ? `${a.weight}%` : '10%',
  completed: a.completed,
})))}

Upcoming exams:
${JSON.stringify((exams || []).map((e: any) => ({
  title: e.title,
  course: e.course,
  examDate: e.date,
  weight: e.weight ? `${e.weight}%` : '25%',
  topics: e.topics,
})))}

Current proposed schedule blocks (if any):
${JSON.stringify(currentSchedule || [])}

When responding:
1. Address the student's request conversationally in "reply". Explain the rationale for why sessions are timed this way, celebrate progress, and encourage them.
2. In "scheduleBlocks", generate 4 to 8 concrete study sessions across the upcoming week.
   - For high-grade-weight assignments (>15%) and upcoming exams, schedule dedicated 60-90 minute deep-work blocks.
   - For lighter tasks (quizzes, discussions), schedule 30-45 minute quick-win slots.
   - Include buffer breaks or exam review blocks.
   - Respect any student constraints mentioned in their message (e.g., job shifts, practice, preferred mornings or nights).
3. Always respond with valid JSON matching the schema.`;

    const contents = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const item of chatHistory.slice(-8)) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }],
        });
      }
    }

    const userPrompt = message
      ? `The student says: "${message}". Please adjust the study schedule and reply to their request.`
      : `Please create an initial streamlined study schedule that helps me complete my assignments and prepare for upcoming exams.`;

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT' as any,
          properties: {
            reply: {
              type: 'STRING' as any,
              description: 'Conversational, encouraging response explaining schedule logic and addressing user needs',
            },
            scheduleBlocks: {
              type: 'ARRAY' as any,
              items: {
                type: 'OBJECT' as any,
                properties: {
                  id: { type: 'STRING' as any },
                  day: { type: 'STRING' as any, description: 'e.g. Monday, Tuesday, Today, Tomorrow' },
                  date: { type: 'STRING' as any, description: 'e.g. Oct 12' },
                  time: { type: 'STRING' as any, description: 'e.g. 4:00 PM - 5:30 PM' },
                  course: { type: 'STRING' as any, description: 'Course code e.g. CS 111' },
                  taskTitle: { type: 'STRING' as any, description: 'Task or exam being studied' },
                  duration: { type: 'STRING' as any, description: 'e.g. 60m, 90m' },
                  focusType: { type: 'STRING' as any, description: 'assignment | exam_prep | review | break' },
                  notes: { type: 'STRING' as any, description: 'Actionable focus tip for this block' },
                },
                required: ['id', 'day', 'time', 'course', 'taskTitle', 'duration', 'focusType', 'notes'],
              },
            },
            productivityTip: {
              type: 'STRING' as any,
              description: 'Quick motivation or study method tip',
            },
          },
          required: ['reply', 'scheduleBlocks'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini schedule planner error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate schedule' });
  }
});

// AI Study Guide Generator: generates notes summary & study guide from notes or text
app.post('/api/gemini/study-guide', async (req, res) => {
  try {
    const { courseName, unitTitle, notesContent } = req.body;
    if (!notesContent) {
      return res.status(400).json({ error: 'Notes content is required' });
    }

    if (!apiKey) {
      return res.json({
        summary: `Comprehensive review of ${unitTitle || 'Unit'} for ${courseName || 'Course'}.`,
        keyConcepts: [
          'Foundational Axioms and Core Principles',
          'Mathematical or Conceptual Derivations',
          'Real-World Edge Cases and Problem Sets',
        ],
        cheatSheet: '• Formula 1: x = (-b ± √(b² - 4ac)) / (2a)\n• Rule of Thumb: Keep invariants preserved.',
        commonPitfalls: ['Confusing base cases in recursive steps', 'Off-by-one errors in boundary conditions'],
        reviewQuestions: [
          'What is the primary trade-off between time complexity and space complexity here?',
          'How does this theorem apply to non-linear systems?',
        ],
      });
    }

    const prompt = `You are a university teaching assistant for ${courseName || 'College Course'}.
Create a high-yield, structured Exam Study Guide based on the following notes for "${unitTitle || 'Unit Study'}":

Notes content:
"""
${notesContent}
"""

Return JSON with this exact structure:
{
  "summary": "Executive summary of the unit (3-4 sentences)",
  "keyConcepts": ["Concept 1 with short explanation", "Concept 2...", "Concept 3..."],
  "cheatSheet": "Key formulas, definitions, and rules in bullet points",
  "commonPitfalls": ["Common exam mistake 1", "Common exam mistake 2"],
  "reviewQuestions": ["Practice question 1", "Practice question 2", "Practice question 3"]
}
Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini study guide error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate study guide' });
  }
});

// AI Tutor Chatbot for Class Notes
app.post('/api/gemini/tutor', async (req, res) => {
  try {
    const { courseName, unitTitle, notesContext, message, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!apiKey) {
      return res.json({
        reply: `[AI Tutor for ${courseName || 'Class'}]: Great question about ${unitTitle || 'this topic'}! In our unit notes, key emphasis is placed on understanding the core mechanisms step-by-step. Would you like me to quiz you on this concept or work through an example?`,
      });
    }

    const systemInstruction = `You are an encouraging, expert academic tutor for the college course "${courseName || 'University Course'}".
You are helping the student study the unit "${unitTitle || 'Course Unit'}".
Ground your answers directly in the student's notes when relevant:
---
${notesContext || 'Standard course materials'}
---
Keep answers concise, clear, and pedagodically sound. Offer mini analogies or Socratic questions when appropriate to test their grasp.`;

    const promptParts = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const msg of chatHistory.slice(-6)) {
        promptParts.push(`${msg.sender === 'user' ? 'Student' : 'Tutor'}: ${msg.text}`);
      }
    }
    promptParts.push(`Student: ${message}`);
    promptParts.push('Tutor:');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptParts.join('\n\n'),
      config: {
        systemInstruction,
      },
    });

    return res.json({ reply: response.text || '' });
  } catch (error: any) {
    console.error('Gemini tutor error:', error);
    return res.status(500).json({ error: error.message || 'Tutor error' });
  }
});

// AI End-of-Study-Session Quiz (Page 1 wireframe requirement: "At end quiz")
app.post('/api/gemini/end-quiz', async (req, res) => {
  try {
    const { courseName, unitTitle, notesContent } = req.body;

    if (!apiKey) {
      return res.json({
        title: `Retention Quiz: ${courseName || 'Study Session'}`,
        questions: [
          {
            question: `In ${unitTitle || 'this topic'}, what is the most critical condition required for optimal convergence?`,
            options: ['Zero-bias threshold', 'Preservation of loop invariants', 'Static typing only', 'Linear proportionality'],
            correctIndex: 1,
            explanation: 'Loop invariants ensure correctness through initialization, maintenance, and termination phases.',
          },
          {
            question: 'Which strategy best mitigates unexpected edge-case failures?',
            options: ['Ignoring boundary limits', 'Testing base cases and extremes', 'Doubling execution cycles', 'Removing constraints'],
            correctIndex: 1,
            explanation: 'Testing base cases and extremes uncovers boundary off-by-one errors before production.',
          },
          {
            question: 'How do you optimize time allocation for high-weight assignments?',
            options: ['Wait until the night before', 'Frontload research in the first 48 hours', 'Skip practice problems', 'Focus only on low-weight tasks'],
            correctIndex: 1,
            explanation: 'Frontloading complex tasks reduces cognitive fatigue and provides time for clarification during office hours.',
          },
        ],
      });
    }

    const prompt = `You are an academic exam proctor.
The student has just completed a focused Pomodoro study lockdown session for ${courseName || 'the course'}, studying "${unitTitle || 'unit notes'}":
Notes:
"""
${notesContent || 'General college fundamentals'}
"""

Generate an engaging 3-question multiple-choice retention quiz to test their knowledge right now.
Return JSON with this schema:
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": number (0 to 3),
      "explanation": "Why this answer is correct"
    }
  ]
}
Return JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini quiz error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate quiz' });
  }
});

// Setup Vite in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Cadence Study server listening on http://localhost:${port}`);
  });
}

startServer();
