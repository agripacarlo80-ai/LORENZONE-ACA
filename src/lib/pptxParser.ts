import JSZip from 'jszip';
import { PublicProfile, QuizQuestion, ScoreRecord } from '../types';

export interface ParsedSlide {
  slideNumber: number;
  title: string;
  lines: string[];
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export async function parsePptxFile(file: File): Promise<{
  slides: ParsedSlide[];
  questions: QuizQuestion[];
}> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slidePaths.length === 0) {
    throw new Error('No slides were found inside this PowerPoint (.pptx) file.');
  }

  const parser = new DOMParser();
  const slides: ParsedSlide[] = [];

  for (let i = 0; i < slidePaths.length; i++) {
    const xmlStr = await zip.files[slidePaths[i]].async('string');
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    const paragraphNodes = Array.from(doc.getElementsByTagName('a:p'));

    const lines: string[] = [];
    for (const pNode of paragraphNodes) {
      const tNodes = Array.from(pNode.getElementsByTagName('a:t'));
      const line = cleanText(tNodes.map((n) => n.textContent || '').join(''));
      if (line.length > 0) {
        lines.push(line);
      }
    }

    if (lines.length > 0) {
      slides.push({
        slideNumber: i + 1,
        title: lines[0],
        lines: lines.slice(1),
      });
    }
  }

  const questions = generateQuestionsFromSlides(slides);
  return { slides, questions };
}

function buildFourOptions(answer: string, pool: string[]): string[] {
  const seen = new Set<string>([answer.toLowerCase()]);
  const distractors: string[] = [];
  for (const candidate of shuffleArray(pool)) {
    const clean = cleanText(candidate);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      distractors.push(clean);
    }
    if (distractors.length >= 3) break;
  }
  const extraFallbacks = ['Concept A', 'Concept B', 'Concept C', 'Concept D'];
  for (const fb of extraFallbacks) {
    if (distractors.length >= 3) break;
    if (!seen.has(fb.toLowerCase())) {
      seen.add(fb.toLowerCase());
      distractors.push(fb);
    }
  }
  return shuffleArray([answer, ...distractors]);
}

export function generateQuestionsFromSlides(slides: ParsedSlide[]): QuizQuestion[] {
  const generated: QuizQuestion[] = [];
  const answerPool: string[] = [];

  // First pass: collect candidate terms/answers across slides for realistic distractors
  for (const slide of slides) {
    if (slide.title.length >= 2 && slide.title.length <= 40) {
      answerPool.push(slide.title);
    }
    for (const line of slide.lines) {
      const explicitAns = line.match(/^(?:answer|ans|a)[:.\s]+(.+)$/i);
      if (explicitAns) {
        const val = cleanText(explicitAns[1]);
        if (val.length >= 1 && val.length <= 40) {
          answerPool.push(val);
        }
        continue;
      }
      const colonSplit = line.split(/[:\-–—]/);
      if (colonSplit.length >= 2) {
        const term = cleanText(colonSplit[0]);
        if (term.length >= 2 && term.length <= 36) {
          answerPool.push(term);
        }
      }
    }
  }

  const fallbackPool = ['Photosynthesis', 'Gravity', 'Democracy', 'Ecosystem', 'Algorithm', 'Fraction', 'Metaphor'];
  const allDistractors = Array.from(new Set([...answerPool, ...fallbackPool]));

  let qIdx = 1;
  for (const slide of slides) {
    if (generated.length >= 50) break;

    const category = slide.title.slice(0, 28) || 'Slide Concept';

    // Extract ALL explicit Q / Answer pairs on this slide
    let pendingPrompt: string | null = null;
    let foundExplicitPair = false;
    for (const line of slide.lines) {
      if (generated.length >= 50) break;
      if (/^(?:q\d*[:.\s]|question[:.\s])/i.test(line) || (line.endsWith('?') && !pendingPrompt)) {
        pendingPrompt = cleanText(line.replace(/^(?:q\d*[:.\s]+|question[:.\s]+)/i, ''));
        continue;
      }
      if (/^(?:answer|ans|a)[:.\s]/i.test(line) && pendingPrompt) {
        const answer = cleanText(line.replace(/^(?:answer|ans|a)[:.\s]+/i, '')).slice(0, 80);
        if (answer) {
          generated.push({
            id: `pptx_q_${qIdx++}`,
            prompt: pendingPrompt.slice(0, 220),
            answer,
            options: buildFourOptions(answer, allDistractors),
            hint: `From Slide ${slide.slideNumber}: ${slide.title}`.slice(0, 100),
            category,
          });
          foundExplicitPair = true;
        }
        pendingPrompt = null;
      }
    }

    if (foundExplicitPair) continue;

    // Look for Term: Definition or Term - Description bullets
    let foundTermBullet = false;
    for (const line of slide.lines) {
      if (generated.length >= 50) break;
      const match = line.match(/^([^:\-–—]{2,34})\s*[:\-–—]\s*(.{8,180})$/);
      if (match) {
        const term = cleanText(match[1]);
        const definition = cleanText(match[2]);
        generated.push({
          id: `pptx_q_${qIdx++}`,
          prompt: `Which term from "${slide.title}" refers to: ${definition}?`.slice(0, 220),
          answer: term,
          options: buildFourOptions(term, allDistractors),
          hint: `Starts with "${term.slice(0, 2).toUpperCase()}" (${term.length} chars)`,
          category,
        });
        foundTermBullet = true;
      }
    }

    // Fallback: Slide Title + First Bullet summary
    if (!foundTermBullet && slide.lines.length > 0 && generated.length < 50) {
      const fact = slide.lines[0];
      const answer = slide.title.length <= 36 ? slide.title : slide.title.split(' ').slice(0, 3).join(' ');
      generated.push({
        id: `pptx_q_${qIdx++}`,
        prompt: `Which lesson topic explains: "${fact}"?`.slice(0, 220),
        answer,
        options: buildFourOptions(answer, allDistractors),
        hint: `Slide ${slide.slideNumber} core concept`,
        category: 'Slide Concept',
      });
    }
  }

  return generated;
}

export function parsePlainTextSlides(rawText: string): QuizQuestion[] {
  const blocks = rawText
    .split(/\n{2,}|---+/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const slides: ParsedSlide[] = blocks.map((block, idx) => {
    const lines = block
      .split('\n')
      .map((l) => cleanText(l.replace(/^[-•*]\s*/, '')))
      .filter(Boolean);
    const rawFirst = lines[0] || `Slide ${idx + 1}`;
    const looksLikeQuestionFirst = /^(?:q\d*[:.\s]|question[:.\s])/i.test(rawFirst) || rawFirst.endsWith('?');
    if (looksLikeQuestionFirst) {
      return {
        slideNumber: idx + 1,
        title: `Slide ${idx + 1}`,
        lines,
      };
    }
    const cleanTitle = cleanText(rawFirst.replace(/^slide\s*\d*\s*(?:title)?\s*[:\-]\s*/i, '')) || `Slide ${idx + 1}`;
    return {
      slideNumber: idx + 1,
      title: cleanTitle,
      lines: lines.slice(1),
    };
  });

  return generateQuestionsFromSlides(slides);
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function downloadLeaderboardCsv(profiles: PublicProfile[], records: ScoreRecord[]): void {
  const rows: string[][] = [
    [
      'Rank',
      'Student Name',
      'Section',
      'Role',
      'Pet Name',
      'Pet Species',
      'Pet Level',
      'Total Score',
      'Games Played',
      'Accuracy (%)',
      'Integrity Status',
      'Recent Game Records',
    ],
  ];

  const sorted = [...profiles]
    .filter((p) => p.role === 'student')
    .sort((a, b) => b.totalScore - a.totalScore);

  sorted.forEach((p, idx) => {
    const acc = p.totalAnswers > 0 ? Math.round((p.correctAnswers / p.totalAnswers) * 100) : 0;
    const recentCount = records.filter((r) => r.studentId === p.uid).length;
    rows.push([
      String(idx + 1),
      p.displayName,
      p.section || 'Unassigned',
      p.role,
      p.petName,
      p.petSpecies,
      String(p.petLevel),
      String(p.totalScore),
      String(p.gamesPlayed),
      `${acc}%`,
      p.lockedOut ? 'Locked Out (Left App)' : 'Verified Active',
      String(recentCount),
    ]);
  });

  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `lorenzone-sla-leaderboard-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
