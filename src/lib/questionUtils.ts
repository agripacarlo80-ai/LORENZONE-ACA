import { CluePanel, QuestionType, QuizQuestion } from '../types';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  identification: 'Identification',
  fill_in_blank: 'Fill in the Blank',
  enumeration: 'Enumeration',
  four_pics: '4 Pics 1 Word',
};

export function getQuestionTypeLabel(q: QuizQuestion): string {
  if (q.questionType && QUESTION_TYPE_LABELS[q.questionType]) {
    return QUESTION_TYPE_LABELS[q.questionType];
  }
  if (q.cluePanels && q.cluePanels.length >= 4) return QUESTION_TYPE_LABELS.four_pics;
  if (q.enumerationItems && q.enumerationItems.length >= 2) return QUESTION_TYPE_LABELS.enumeration;
  if (/_{3,}/.test(q.prompt)) return QUESTION_TYPE_LABELS.fill_in_blank;
  return QUESTION_TYPE_LABELS.multiple_choice;
}

export function normalizeAnswerText(val: string): string {
  return val
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function checkEnumerationMatch(guesses: string[], expectedItems: string[]): boolean {
  const expected = expectedItems.map(normalizeAnswerText).filter(Boolean);
  if (expected.length === 0) return false;
  const guessSet = new Set(guesses.map(normalizeAnswerText).filter(Boolean));
  if (guessSet.size < expected.length) return false;
  return expected.every((item) => guessSet.has(item));
}

export function splitPromptBlank(prompt: string): { hasBlank: boolean; before: string; after: string } {
  const match = prompt.match(/^(.*?)(_{3,})(.*)$/);
  if (!match) {
    return { hasBlank: false, before: prompt, after: '' };
  }
  return {
    hasBlank: true,
    before: match[1],
    after: match[3],
  };
}

function pickSubjectEmoji(subjectOrCategory: string): string {
  const s = subjectOrCategory.toLowerCase();
  if (/sci|bio|plant|solar|eco|energy|earth|space|cell|phys/.test(s)) return '🔬';
  if (/math|alg|geom|num|arith|calc/.test(s)) return '📐';
  if (/eng|gram|lit|vocab|read|word/.test(s)) return '📖';
  if (/fil|ap|kasay|heo|hist|wika/.test(s)) return '🏛️';
  if (/ict|comp|web|code|tech|hard|safe/.test(s)) return '💻';
  return '🎓';
}

export function getCluePanelsForQuestion(q: QuizQuestion): CluePanel[] {
  if (q.cluePanels && q.cluePanels.length >= 4) {
    return q.cluePanels.slice(0, 4).map((p, idx) => ({
      label: p.label?.trim() || `Clue ${idx + 1}`,
      emoji: p.emoji?.trim() || ['🔍', '💡', '📚', '🧩'][idx],
      imageUrl: p.imageUrl,
    }));
  }

  const category = q.category?.trim() || 'Lesson Concept';
  const cleanWord = q.answer.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const promptSnippet =
    q.prompt.replace(/_{3,}/g, '[ ? ]').trim().slice(0, 44) +
    (q.prompt.trim().length > 44 ? '…' : '');
  const hintSnippet = q.hint?.trim() || `Think about ${category}`;
  const firstLetter = cleanWord[0] || '?';
  const lastLetter = cleanWord[cleanWord.length - 1] || '?';

  return [
    {
      label: category,
      emoji: pickSubjectEmoji(category),
    },
    {
      label: hintSnippet.slice(0, 44),
      emoji: '💡',
    },
    {
      label: promptSnippet || 'Core Topic',
      emoji: '🔎',
    },
    {
      label: `${cleanWord.length} chars · ${firstLetter}___${lastLetter}`,
      emoji: '🔤',
    },
  ];
}

export function sanitizeQuestionForFirestore(q: QuizQuestion, fallbackCategory: string): QuizQuestion {
  const ans = q.answer.trim();
  const seen = new Set<string>([ans.toLowerCase()]);
  const uniqueOpts: string[] = [ans];
  for (const raw of q.options || []) {
    const clean = raw.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueOpts.push(clean);
    }
    if (uniqueOpts.length >= 4) break;
  }
  const fallbackPool = ['Option A', 'Option B', 'Option C', 'Option D', 'Choice 1', 'Choice 2'];
  let fIdx = 0;
  while (uniqueOpts.length < 4 && fIdx < fallbackPool.length) {
    const fb = fallbackPool[fIdx++];
    if (!seen.has(fb.toLowerCase())) {
      seen.add(fb.toLowerCase());
      uniqueOpts.push(fb);
    }
  }

  const cleanQuestion: QuizQuestion = {
    id: q.id || `q_${Date.now()}`,
    prompt: q.prompt.trim(),
    answer: ans,
    options: uniqueOpts,
    hint: q.hint.trim() || 'Think about the lesson topic',
    category: (q.category || '').trim() || fallbackCategory || 'Core',
  };

  if (q.questionType) {
    cleanQuestion.questionType = q.questionType;
  }

  if (q.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length > 0) {
    const cleanItems = q.enumerationItems.map((it) => it.trim()).filter(Boolean).slice(0, 8);
    if (cleanItems.length > 0) {
      cleanQuestion.enumerationItems = cleanItems;
      cleanQuestion.answer = cleanItems.join(', ');
    }
  }

  if (q.cluePanels && q.cluePanels.length > 0) {
    cleanQuestion.cluePanels = q.cluePanels.slice(0, 4).map((panel, pIdx) => {
      const nextPanel: CluePanel = {
        label: (panel.label || '').trim().slice(0, 48) || `Clue ${pIdx + 1}`,
        emoji: (panel.emoji || '').trim().slice(0, 8) || ['🔍', '💡', '📚', '🧩'][pIdx],
      };
      if (panel.imageUrl && panel.imageUrl.trim()) {
        nextPanel.imageUrl = panel.imageUrl.trim();
      }
      return nextPanel;
    });
  }

  return cleanQuestion;
}
