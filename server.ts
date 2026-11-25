import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ALLOWED_QUESTION_TYPES = new Set([
  'multiple_choice',
  'identification',
  'fill_in_blank',
  'enumeration',
  'four_pics',
]);

function loadFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    return parsed.projectId || '';
  } catch {
    return '';
  }
}

const firebaseProjectId = loadFirebaseProjectId();
if (firebaseProjectId && getApps().length === 0) {
  initializeAdminApp({ projectId: firebaseProjectId });
}

interface GeneratePptxBody {
  topic?: unknown;
  subject?: unknown;
  gradeLevel?: unknown;
  slideCount?: unknown;
  questionCount?: unknown;
  questionMix?: unknown;
  notes?: unknown;
}

interface RawAiQuestion {
  prompt?: string;
  questionType?: string;
  answer?: string;
  distractors?: string[];
  hint?: string;
  category?: string;
  enumerationItems?: string[];
  cluePanels?: Array<{ label?: string; emoji?: string }>;
}

interface RawAiSlide {
  title?: string;
  subtitle?: string;
  bullets?: string[];
  keyTerm?: string;
  speakerNote?: string;
}

async function verifyFirebaseBearerToken(req: Request): Promise<{ uid: string; email?: string }> {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new Error('Authentication required. Please sign in again.');
  }
  const token = match[1].trim();
  const decoded = await getAdminAuth().verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email };
}

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function normalizeFourPicsWord(rawWord: string): string {
  const lettersOnly = rawWord
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (lettersOnly.length >= 3 && lettersOnly.length <= 12) {
    return lettersOnly;
  }
  return rawWord.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().slice(0, 14) || 'CONCEPT';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'lorenzone-server' });
  });

  app.post('/api/generate-pptx', async (req: Request, res: Response) => {
    try {
      await verifyFirebaseBearerToken(req);
    } catch (authErr) {
      res.status(401).json({
        error: authErr instanceof Error ? authErr.message : 'Unauthorized request.',
      });
      return;
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured yet. Please add GEMINI_API_KEY in AI Studio Settings > Secrets to enable AI PowerPoint generation.',
      });
      return;
    }

    const body = (req.body || {}) as GeneratePptxBody;
    const topic = cleanStr(body.topic, 120);
    const subject = cleanStr(body.subject, 50) || 'General Education';
    const gradeLevel = cleanStr(body.gradeLevel, 40) || 'Grade 8';
    const notes = cleanStr(body.notes, 1200);

    if (topic.length < 3) {
      res.status(400).json({ error: 'Please enter a lesson topic of at least 3 characters.' });
      return;
    }

    const rawSlideCount = Number(body.slideCount);
    const slideCount = Number.isFinite(rawSlideCount)
      ? Math.max(4, Math.min(12, Math.round(rawSlideCount)))
      : 6;

    const rawQCount = Number(body.questionCount);
    const questionCount = Number.isFinite(rawQCount)
      ? Math.max(3, Math.min(15, Math.round(rawQCount)))
      : 6;

    const requestedMix = Array.isArray(body.questionMix)
      ? body.questionMix
          .filter((item): item is string => typeof item === 'string' && ALLOWED_QUESTION_TYPES.has(item))
      : [];
    const questionMix =
      requestedMix.length > 0
        ? requestedMix
        : ['identification', 'fill_in_blank', 'enumeration', 'four_pics', 'multiple_choice'];

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = [
        `You are an expert K-12 curriculum designer for San Lorenzo Academy.`,
        `Generate a complete, classroom-ready PowerPoint lesson deck AND aligned quiz questions.`,
        ``,
        `Lesson Topic: ${topic}`,
        `Subject: ${subject}`,
        `Grade Level: ${gradeLevel}`,
        `Target Content Slide Count: ${slideCount} slides`,
        `Target Quiz Question Count: ${questionCount} questions`,
        `Allowed Question Types (distribute evenly across these): ${questionMix.join(', ')}`,
        notes ? `Teacher Notes / Objectives: ${notes}` : '',
        ``,
        `Rules for Slides:`,
        `- Produce exactly ${slideCount} informative slides.`,
        `- Each slide has a clear title, short subtitle, 3-4 concise student-friendly bullet points, 1 memorable keyTerm (short "Term: Explanation" format), and helpful teacher speakerNote.`,
        ``,
        `Rules for Quiz Questions:`,
        `- Produce exactly ${questionCount} questions strictly grounded in the generated slides.`,
        `- For 'identification': clear "What is..." / "Identify the..." prompt, exact concise uppercase answer, 3 distinct plausible distractors.`,
        `- For 'fill_in_blank': sentence containing "_____" where the missing word goes, exact missing word/phrase as answer, 3 distinct plausible distractors.`,
        `- For 'enumeration': prompt asking students to list 2 to 4 items, set enumerationItems to those 2-4 concise distinct items, set answer to their comma-separated uppercase string, and include 3 plausible non-matching distractor strings.`,
        `- For 'four_pics': answer MUST be a single uppercase concept word (4 to 10 letters, letters only, no spaces). Include cluePanels with 4 distinct visual scene ideas that all point to that 1 word, each having a short 2-4 word label and 1 single emoji.`,
        `- For 'multiple_choice': classic question prompt, exact answer, and 3 distinct distractors.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              deckTitle: { type: Type.STRING },
              description: { type: Type.STRING },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                    keyTerm: { type: Type.STRING },
                    speakerNote: { type: Type.STRING },
                  },
                  required: ['title', 'subtitle', 'bullets', 'keyTerm', 'speakerNote'],
                },
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    prompt: { type: Type.STRING },
                    questionType: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    hint: { type: Type.STRING },
                    category: { type: Type.STRING },
                    enumerationItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                    cluePanels: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          emoji: { type: Type.STRING },
                        },
                        required: ['label', 'emoji'],
                      },
                    },
                  },
                  required: ['prompt', 'questionType', 'answer', 'distractors', 'hint', 'category'],
                },
              },
            },
            required: ['deckTitle', 'description', 'slides', 'questions'],
          },
        },
      });

      const rawText = (response.text || '').trim();
      if (!rawText) {
        throw new Error('AI model returned an empty response. Please try again.');
      }

      const parsed = JSON.parse(rawText) as {
        deckTitle?: string;
        description?: string;
        slides?: RawAiSlide[];
        questions?: RawAiQuestion[];
      };

      const cleanSlides = (parsed.slides || []).slice(0, 12).map((s, idx) => ({
        slideNumber: idx + 1,
        title: cleanStr(s.title, 100) || `Slide ${idx + 1}: ${topic}`,
        subtitle: cleanStr(s.subtitle, 120) || `${subject} · ${gradeLevel}`,
        bullets: (Array.isArray(s.bullets) ? s.bullets : [])
          .map((b) => cleanStr(b, 180))
          .filter(Boolean)
          .slice(0, 5),
        keyTerm: cleanStr(s.keyTerm, 160) || `${topic}: Core Classroom Concept`,
        speakerNote: cleanStr(s.speakerNote, 260) || 'Review this concept with your students.',
      }));

      const cleanQuestions = (parsed.questions || []).slice(0, 20).map((q, idx) => {
        const rawType = typeof q.questionType === 'string' && ALLOWED_QUESTION_TYPES.has(q.questionType)
          ? q.questionType
          : questionMix[idx % questionMix.length];

        let enumItems: string[] | undefined;
        let answer = cleanStr(q.answer, 120).toUpperCase() || 'CONCEPT';

        if (rawType === 'enumeration') {
          const items = (Array.isArray(q.enumerationItems) ? q.enumerationItems : answer.split(','))
            .map((item) => cleanStr(item, 50).toUpperCase())
            .filter(Boolean)
            .slice(0, 6);
          if (items.length >= 2) {
            enumItems = items;
            answer = items.join(', ');
          }
        } else if (rawType === 'four_pics') {
          answer = normalizeFourPicsWord(answer);
        }

        const seenOpts = new Set<string>([answer.toLowerCase()]);
        const options = [answer];
        for (const dist of Array.isArray(q.distractors) ? q.distractors : []) {
          const cleanDist = cleanStr(dist, 80).toUpperCase();
          if (cleanDist && !seenOpts.has(cleanDist.toLowerCase())) {
            seenOpts.add(cleanDist.toLowerCase());
            options.push(cleanDist);
          }
          if (options.length >= 4) break;
        }
        let fillerIdx = 1;
        while (options.length < 4) {
          const fb = `Choice ${fillerIdx++}`;
          if (!seenOpts.has(fb.toLowerCase())) {
            seenOpts.add(fb.toLowerCase());
            options.push(fb);
          }
        }

        const rawPanels = Array.isArray(q.cluePanels) ? q.cluePanels : [];
        const panelTargetCount = rawPanels.length >= 6 ? 6 : 4;
        const cluePanels =
          rawType === 'four_pics' || rawPanels.length >= 4
            ? Array.from({ length: panelTargetCount }, (_, pIdx) => ({
                label: cleanStr(rawPanels[pIdx]?.label, 36) || `Visual Clue ${pIdx + 1}`,
                emoji: cleanStr(rawPanels[pIdx]?.emoji, 8) || ['🔍', '📚', '💡', '🧩', '🧭', '⚡'][pIdx],
              }))
            : undefined;

        const baseQuestion: Record<string, unknown> = {
          id: `ai_q_${Date.now()}_${idx + 1}`,
          prompt:
            cleanStr(q.prompt, 220) ||
            (rawType === 'four_pics'
              ? `4 Pics 1 Word (${subject}): Guess the ${answer.length}-letter concept!`
              : `Question ${idx + 1} on ${topic}`),
          questionType: rawType,
          answer,
          options,
          hint: cleanStr(q.hint, 120) || `Review ${topic} key concepts`,
          category: cleanStr(q.category, 40) || subject,
        };
        if (enumItems) {
          baseQuestion.enumerationItems = enumItems;
        }
        if (cluePanels) {
          baseQuestion.cluePanels = cluePanels;
        }
        return baseQuestion;
      });

      res.json({
        deckTitle: cleanStr(parsed.deckTitle, 100) || topic,
        subject,
        gradeLevel,
        description:
          cleanStr(parsed.description, 240) ||
          `${gradeLevel} ${subject} lesson & quiz generated for ${topic}`,
        slides: cleanSlides,
        questions: cleanQuestions,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate lesson & quiz.';
      const isKeyError = /api key|403|401|permission|unauthenticated/i.test(msg);
      res.status(isKeyError ? 403 : 500).json({
        error: isKeyError
          ? 'Gemini API rejected the key or lacks access. Check GEMINI_API_KEY in AI Studio Settings > Secrets.'
          : msg,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`LORENZONE server listening on http://${HOST}:${PORT}`);
  });
}

void startServer();
