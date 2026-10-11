// Add this next to your other /api/gemini/* routes.
//
// ASSUMPTIONS (adjust to match your existing study-guide / tutor routes):
//  - Express app named `app`
//  - the official @google/genai SDK
//  - GEMINI_API_KEY in your environment
//  - copy the model name your other Gemini routes already use into MODEL
//
// IMPORTANT: PDFs are sent as base64, so raise the JSON body limit where you
// create the app, otherwise Express rejects anything over ~100 KB:
//   app.use(express.json({ limit: '30mb' }));

import { GoogleGenAI, Type } from '@google/genai';
import type { Express, Request, Response } from 'express';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // use the same model as your other routes

export const registerOrganizeNotesRoute = (app: Express) => app.post('/api/gemini/organize-notes', async (req: Request, res: Response) => {
  try {
    const {
      courseName = 'College Course',
      unitTitle = 'Unit',
      mode = 'single', // 'single' | 'split'
      text,
      fileBase64,
      mimeType,
      existingUnitNames = [],
    } = req.body || {};

    if (!text && !fileBase64) {
      return res.status(400).json({ error: 'No notes provided' });
    }

    const rules = `
You are organizing a college student's study notes for the course "${courseName}".

Rules:
- Keep EVERY fact, definition, formula, example and date from the source. Never invent or add content that is not in the source.
- Fix structure only: group related ideas, order them logically, remove duplicated lines and obvious scanning/formatting junk (page numbers, headers, footers).
- Output plain text, not markdown. The editor does not render markdown. Use short section headings on their own line, "- " bullets, and put each formula on its own line.
- Keep the student's own wording where it is clear; lightly fix typos.
`;

    const modeRules =
      mode === 'split'
        ? `
Split the notes into separate units by topic (between 2 and 8 units).
- Name each unit in the form "Unit N: Topic", continuing after any existing units.
- Existing unit names in this class: ${JSON.stringify(existingUnitNames)}. If a topic clearly belongs to an existing unit, reuse that unit's exact name so the notes get merged into it.
- Every part of the source must land in exactly one unit.`
        : `
Return exactly ONE unit named "${unitTitle}" containing all of the organized notes.`;

    const parts: any[] = [{ text: rules + modeRules }];
    if (fileBase64) parts.push({ inlineData: { data: fileBase64, mimeType: mimeType || 'application/pdf' } });
    if (text) parts.push({ text: `NOTES TO ORGANIZE:\n\n${text}` });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            units: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  notes: { type: Type.STRING },
                },
                required: ['name', 'notes'],
              },
            },
          },
          required: ['units'],
        },
      },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    res.json({ units: Array.isArray(parsed.units) ? parsed.units : [] });
  } catch (err) {
    console.error('organize-notes failed', err);
    res.status(500).json({ error: 'Failed to organize notes' });
  }
});
