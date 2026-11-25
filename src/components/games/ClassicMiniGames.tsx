import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Lock, RotateCcw } from 'lucide-react';
import { PublicProfile, QuizQuestion } from '../../types';
import { GameRoundProgress, GameSessionResult } from './SignatureGames';
import { ClueSceneArtwork } from './ClueSceneArtwork';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';
import {
  checkEnumerationMatch,
  getQuestionTypeLabel,
  splitPromptBlank,
} from '../../lib/questionUtils';

interface ClassicGameProps {
  questions: QuizQuestion[];
  profile: PublicProfile;
  savedProgress?: GameRoundProgress | null;
  onSaveProgress?: (progress: GameRoundProgress) => void;
  onComplete: (result: GameSessionResult) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeOptions(q: QuizQuestion): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const addUnique = (val: string) => {
    const clean = val.trim();
    if (!clean) return;
    const key = clean.toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  };
  addUnique(q.answer);
  (q.options || []).forEach(addUnique);
  const fallbacks = ['Choice A', 'Choice B', 'Choice C', 'Choice D'];
  for (const fb of fallbacks) {
    if (result.length >= 4) break;
    addUnique(fb);
  }
  return shuffle(result);
}

const EmptyDeckNotice: React.FC = () => (
  <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm text-[#4D6354]">
    This quiz deck does not have any playable questions yet. Please choose another deck.
  </div>
);

/* =========================================================
   6. WORD QUEST (Spell Builder)
   ========================================================= */
export const WordQuestGame: React.FC<ClassicGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const playableQuestions = useMemo(
    () =>
      questions.filter((q) => {
        const raw =
          q.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length > 0
            ? q.enumerationItems[0]
            : q.answer;
        return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').length >= 2;
      }),
    [questions]
  );

  const isAlreadyFinished = Boolean(
    savedProgress && playableQuestions.length > 0 && savedProgress.idx >= playableQuestions.length
  );

  const initialIdx = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, playableQuestions.length - 1))
    : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [status, setStatus] = useState<string>('');
  const [locked, setLocked] = useState(false);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAlreadyFinished || completedRef.current || !savedProgress) return;
    completedRef.current = true;
    onComplete({
      score: savedProgress.score || 0,
      correctCount: savedProgress.correctCount || 0,
      totalCount: playableQuestions.length,
      durationSeconds: 1,
    });
  }, [isAlreadyFinished, savedProgress, playableQuestions.length, onComplete]);

  const q = playableQuestions[idx];
  const word = useMemo(() => {
    if (!q) return '';
    const raw =
      q.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length > 0
        ? q.enumerationItems[0]
        : q.answer;
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.length <= 16 ? cleaned : cleaned.slice(0, 16);
  }, [q]);

  const tiles = useMemo(
    () => shuffle(word.split('').map((ch, i) => ({ id: i, ch }))),
    [word, idx]
  );

  const built = picked.map((i) => tiles[i]?.ch || '').join('');

  const handleSubmit = useCallback(() => {
    if (locked || built.length === 0 || completedRef.current || !q) return;
    setLocked(true);
    const isRight = built === word;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + 25 : score;

    onSaveProgress?.({
      idx: idx + 1,
      score: nextScore,
      correctCount: nextCorrect,
    });

    if (isRight) {
      soundFx.playCorrect();
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      setStatus('Answer Locked · Great spelling! +25 pts');
    } else {
      soundFx.playWrong();
      setStatus(`Answer Locked · Word was ${word}`);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (idx + 1 >= playableQuestions.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete({
          score: nextScore,
          correctCount: nextCorrect,
          totalCount: playableQuestions.length,
          durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
        });
      } else {
        setIdx((i) => i + 1);
        setPicked([]);
        setStatus('');
        setLocked(false);
      }
    }, 950);
  }, [locked, built, q, word, correctCount, score, onSaveProgress, idx, playableQuestions.length, onComplete, startTime]);

  useEffect(() => {
    if (!q || locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        soundFx.playClick();
        setPicked((p) => p.slice(0, -1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      const ch = e.key.toUpperCase();
      if (/^[A-Z0-9]$/.test(ch)) {
        const availableIdx = tiles.findIndex((t, i) => t.ch === ch && !picked.includes(i));
        if (availableIdx !== -1) {
          soundFx.playClick();
          setPicked((p) => [...p, availableIdx]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, locked, tiles, picked, handleSubmit]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  if (!q || !word) {
    return <EmptyDeckNotice />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
          <span>
            Word Quest · {idx + 1}/{playableQuestions.length}
          </span>
          <span className="text-[#1E5B3A] font-bold">Score: {score}</span>
        </div>
        <div className="h-2 rounded-full bg-[#ECE7D8] overflow-hidden">
          <div
            className="h-full bg-[#1E5B3A] transition-all duration-300"
            style={{ width: `${Math.round(((idx + (locked ? 1 : 0)) / playableQuestions.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 text-center">
        <p className="text-base font-bold text-[#172A1E]">{q.prompt}</p>
        <p className="text-xs text-[#4D6354] mt-1">Hint: {q.hint}</p>
      </div>
      <div className="min-h-14 rounded-2xl border-2 border-dashed border-[#D4CCB5] flex flex-wrap items-center justify-center gap-1.5 p-3">
        {picked.length === 0 ? (
          <span className="text-sm font-extrabold tracking-widest text-[#94A398]">
            TAP OR TYPE LETTERS BELOW
          </span>
        ) : (
          picked.map((tileIdx, slotIdx) => (
            <button
              key={`${tileIdx}_${slotIdx}`}
              type="button"
              disabled={locked}
              onClick={() => {
                if (locked) return;
                soundFx.playClick();
                setPicked((prev) => prev.filter((_, i) => i !== slotIdx));
              }}
              title="Tap to remove letter"
              className="w-10 h-11 rounded-xl border-2 border-[#1E5B3A] bg-white text-lg font-extrabold text-[#1E5B3A] cursor-pointer hover:bg-red-50 hover:border-red-300 disabled:cursor-default"
            >
              {tiles[tileIdx]?.ch}
            </button>
          ))
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map((t, i) => (
          <button
            key={t.id}
            type="button"
            disabled={locked || picked.includes(i)}
            onClick={() => {
              if (locked || picked.includes(i)) return;
              soundFx.playClick();
              setPicked((p) => [...p, i]);
            }}
            className={`w-11 h-11 rounded-xl border-2 font-extrabold text-base ${
              picked.includes(i) || locked
                ? 'opacity-25 border-[#E5DEC9] cursor-default'
                : 'border-[#1E5B3A] bg-white text-[#172A1E] hover:bg-[#1E5B3A]/5 cursor-pointer'
            }`}
          >
            {t.ch}
          </button>
        ))}
      </div>
      {status && (
        <p className="text-center text-xs font-bold text-[#EA7A26] flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          {status}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#ECE7D8]">
        <PetAvatar
          species={profile.petSpecies}
          color={profile.petColor}
          outfit={profile.outfit}
          accessory={profile.accessory}
          size={50}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={locked || picked.length === 0}
            onClick={() => {
              soundFx.playClick();
              setPicked((p) => p.slice(0, -1));
            }}
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={locked || picked.length === 0}
            onClick={() => {
              soundFx.playClick();
              setPicked([]);
            }}
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            type="button"
            disabled={locked || built.length === 0}
            onClick={handleSubmit}
            className="px-5 py-2 rounded-xl bg-[#1E5B3A] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Check Word
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   7. MATH DASH (Rapid Problem Solving)
   ========================================================= */
export const MathDashGame: React.FC<ClassicGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const mathItems = useMemo(() => {
    const deckMath = questions
      .filter((q) => /^\d+(\.\d+)?$/.test(q.answer.trim()) || /[+\-×÷*/=]/.test(q.prompt))
      .map((q) => ({
        prompt: q.prompt,
        answer: q.answer.trim(),
        options: normalizeOptions(q),
      }));

    const generated: Array<{ prompt: string; answer: string; options: string[] }> = [];
    const opTypes: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];

    for (let i = 0; i < 10; i++) {
      const op = opTypes[i % opTypes.length];
      let a = 0;
      let b = 0;
      let ans = 0;

      if (op === '+') {
        a = 12 + Math.floor(Math.random() * 45);
        b = 7 + Math.floor(Math.random() * 32);
        ans = a + b;
      } else if (op === '-') {
        b = 6 + Math.floor(Math.random() * 28);
        a = b + 5 + Math.floor(Math.random() * 35);
        ans = a - b;
      } else if (op === '×') {
        a = 3 + Math.floor(Math.random() * 10);
        b = 3 + Math.floor(Math.random() * 10);
        ans = a * b;
      } else {
        b = 2 + Math.floor(Math.random() * 10);
        ans = 2 + Math.floor(Math.random() * 12);
        a = b * ans;
      }

      const distractors = new Set<string>([String(ans)]);
      const offsets = [-6, -4, -3, -2, -1, 1, 2, 3, 4, 6, 8, 10];
      for (const off of shuffle(offsets)) {
        if (distractors.size >= 4) break;
        const cand = ans + off;
        if (cand >= 0 && cand !== ans) distractors.add(String(cand));
      }
      generated.push({
        prompt: `${a} ${op} ${b} = ?`,
        answer: String(ans),
        options: shuffle(Array.from(distractors)),
      });
    }

    if (deckMath.length >= 6) return deckMath;
    return [...deckMath, ...shuffle(generated).slice(0, Math.max(8 - deckMath.length, 0))];
  }, [questions]);

  const isAlreadyFinished = Boolean(
    savedProgress && mathItems.length > 0 && savedProgress.idx >= mathItems.length
  );

  const initialIdx = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, mathItems.length - 1))
    : 0;
  const savedStreak =
    savedProgress?.extra && typeof savedProgress.extra.streak === 'number'
      ? savedProgress.extra.streak
      : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [answeredCount, setAnsweredCount] = useState(savedProgress?.answeredCount || 0);
  const [streak, setStreak] = useState(savedStreak);
  const [pickedOpt, setPickedOpt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(Math.max(45, mathItems.length * 6));
  const [startTime] = useState(() => Date.now());

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const correctRef = useRef(correctCount);
  correctRef.current = correctCount;
  const answeredRef = useRef(answeredCount);
  answeredRef.current = answeredCount;
  const completedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAlreadyFinished || completedRef.current || !savedProgress) return;
    completedRef.current = true;
    onComplete({
      score: savedProgress.score || 0,
      correctCount: savedProgress.correctCount || 0,
      totalCount: mathItems.length,
      durationSeconds: 1,
      summaryNote: savedStreak >= 3 ? `Awesome ${savedStreak}x combo streak!` : undefined,
    });
  }, [isAlreadyFinished, savedProgress, mathItems.length, onComplete, savedStreak]);

  // Single stable 1-second timer
  useEffect(() => {
    if (isAlreadyFinished) return;
    const timer = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAlreadyFinished]);

  useEffect(() => {
    if (timeLeft === 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete({
        score: scoreRef.current,
        correctCount: correctRef.current,
        totalCount: Math.max(1, answeredRef.current),
        durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
      });
    }
  }, [timeLeft, onComplete, startTime]);

  const current = mathItems[idx % mathItems.length];

  const handleChoose = useCallback(
    (opt: string) => {
      if (pickedOpt || completedRef.current) return;
      setPickedOpt(opt);
      const isRight = opt.trim().toUpperCase() === current.answer.trim().toUpperCase();
      const nextStreak = isRight ? streak + 1 : 0;
      const streakBonus = isRight && nextStreak >= 2 ? Math.min(15, nextStreak * 5) : 0;
      const nextScore = isRight ? score + 25 + streakBonus : score;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;
      const nextAnswered = answeredCount + 1;

      setStreak(nextStreak);
      setAnsweredCount(nextAnswered);

      onSaveProgress?.({
        idx: idx + 1,
        score: nextScore,
        correctCount: nextCorrect,
        answeredCount: nextAnswered,
        extra: { streak: nextStreak },
      });

      if (isRight) {
        soundFx.playCorrect();
        setScore(nextScore);
        setCorrectCount(nextCorrect);
      } else {
        soundFx.playWrong();
      }

      timeoutRef.current = window.setTimeout(() => {
        if (idx + 1 >= mathItems.length) {
          if (completedRef.current) return;
          completedRef.current = true;
          onComplete({
            score: nextScore,
            correctCount: nextCorrect,
            totalCount: mathItems.length,
            durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
            summaryNote: nextStreak >= 3 ? `Awesome ${nextStreak}x combo streak!` : undefined,
          });
        } else {
          setIdx((i) => i + 1);
          setPickedOpt(null);
        }
      }, 650);
    },
    [pickedOpt, current.answer, streak, score, correctCount, answeredCount, onSaveProgress, idx, mathItems.length, onComplete, startTime]
  );

  useEffect(() => {
    if (pickedOpt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const num = Number(e.key);
      if (num >= 1 && num <= current.options.length) {
        e.preventDefault();
        handleChoose(current.options[num - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickedOpt, current.options, handleChoose]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
        <span className="text-[#4D6354]">
          Math Dash · {idx + 1}/{mathItems.length}
        </span>
        <span className={`flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600 font-bold' : 'text-[#EA7A26]'}`}>
          <Clock className="w-3.5 h-3.5" /> {timeLeft}s
        </span>
        <span className="text-[#1E5B3A] font-bold">
          Score: {score} {streak >= 2 ? `· ${streak}x Streak!` : ''}
        </span>
      </div>
      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-8 text-center">
        <h3 className="text-2xl font-extrabold text-[#172A1E] tabular-nums">{current.prompt}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {current.options.map((opt, optIdx) => {
          const isRight = opt.trim().toUpperCase() === current.answer.trim().toUpperCase();
          const isMine = pickedOpt === opt;
          return (
            <button
              key={`${opt}_${optIdx}`}
              type="button"
              disabled={Boolean(pickedOpt)}
              onClick={() => handleChoose(opt)}
              className={`p-4 rounded-xl border text-base font-bold tabular-nums transition-colors flex items-center justify-center gap-2 ${
                pickedOpt
                  ? isRight
                    ? 'bg-[#1E5B3A] text-white border-[#1E5B3A] cursor-default'
                    : isMine
                    ? 'bg-red-50 text-red-700 border-red-300 cursor-default'
                    : 'bg-white text-[#94A398] border-[#E5DEC9] cursor-default'
                  : 'border-[#E5DEC9] bg-white hover:border-[#EA7A26] hover:bg-[#FFF8F1] text-[#172A1E] cursor-pointer'
              }`}
            >
              <span className="text-xs opacity-60">[{optIdx + 1}]</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar
          species={profile.petSpecies}
          color={profile.petColor}
          outfit={profile.outfit}
          accessory={profile.accessory}
          size={48}
        />
        <span>
          {pickedOpt
            ? pickedOpt.trim().toUpperCase() === current.answer.trim().toUpperCase()
              ? 'Answer Locked · Fast & accurate!'
              : `Answer Locked · Correct answer was ${current.answer}`
            : 'Think fast or press keys 1–4 to build a combo streak!'}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   8. QUIZ MASTER (4-Choice Mastery Challenge)
   ========================================================= */
export const QuizMasterGame: React.FC<ClassicGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const isAlreadyFinished = Boolean(
    savedProgress && questions.length > 0 && savedProgress.idx >= questions.length
  );

  const initialIdx = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, questions.length - 1))
    : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [picked, setPicked] = useState<string | null>(null);
  const [enumGuesses, setEnumGuesses] = useState<string[]>([]);
  const [enumSubmitted, setEnumSubmitted] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAlreadyFinished || completedRef.current || !savedProgress) return;
    completedRef.current = true;
    onComplete({
      score: savedProgress.score || 0,
      correctCount: savedProgress.correctCount || 0,
      totalCount: questions.length,
      durationSeconds: 1,
    });
  }, [isAlreadyFinished, savedProgress, questions.length, onComplete]);

  const q = questions[idx];
  const isEnumeration = Boolean(
    q?.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length >= 2
  );
  const expectedEnumItems = useMemo(
    () => (isEnumeration && q?.enumerationItems ? q.enumerationItems : []),
    [isEnumeration, q?.enumerationItems]
  );
  const displayOptions = useMemo(() => (q ? normalizeOptions(q) : []), [q]);

  useEffect(() => {
    setEnumGuesses(Array(expectedEnumItems.length).fill(''));
    setEnumSubmitted('idle');
  }, [idx, expectedEnumItems.length]);

  const advanceAfterAnswer = useCallback(
    (nextScore: number, nextCorrect: number, delayMs: number) => {
      timeoutRef.current = window.setTimeout(() => {
        if (idx + 1 >= questions.length) {
          if (completedRef.current) return;
          completedRef.current = true;
          onComplete({
            score: nextScore,
            correctCount: nextCorrect,
            totalCount: questions.length,
            durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
          });
        } else {
          setIdx((i) => i + 1);
          setPicked(null);
          setEnumSubmitted('idle');
        }
      }, delayMs);
    },
    [idx, questions.length, onComplete, startTime]
  );

  const handleSelect = useCallback(
    (opt: string) => {
      if (!q || picked || completedRef.current) return;
      setPicked(opt);
      const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();
      const nextScore = isRight ? score + 30 : score;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;

      onSaveProgress?.({
        idx: idx + 1,
        score: nextScore,
        correctCount: nextCorrect,
      });

      if (isRight) {
        soundFx.playCorrect();
        setScore(nextScore);
        setCorrectCount(nextCorrect);
      } else {
        soundFx.playWrong();
      }

      advanceAfterAnswer(nextScore, nextCorrect, isRight ? 850 : 1100);
    },
    [q, picked, score, correctCount, onSaveProgress, idx, advanceAfterAnswer]
  );

  useEffect(() => {
    if (!q || isEnumeration || picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const num = Number(e.key);
      if (num >= 1 && num <= displayOptions.length) {
        e.preventDefault();
        handleSelect(displayOptions[num - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, isEnumeration, picked, displayOptions, handleSelect]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  if (!q) {
    return <EmptyDeckNotice />;
  }

  const promptParts = splitPromptBlank(q.prompt);

  const handleEnumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enumSubmitted !== 'idle' || completedRef.current) return;
    if (enumGuesses.some((g) => !g.trim())) return;
    const isRight = checkEnumerationMatch(enumGuesses, expectedEnumItems);
    const nextScore = isRight ? score + 40 : score;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    setEnumSubmitted(isRight ? 'correct' : 'wrong');

    onSaveProgress?.({
      idx: idx + 1,
      score: nextScore,
      correctCount: nextCorrect,
    });

    if (isRight) {
      soundFx.playCorrect();
      setScore(nextScore);
      setCorrectCount(nextCorrect);
    } else {
      soundFx.playWrong();
    }

    advanceAfterAnswer(nextScore, nextCorrect, isRight ? 900 : 1200);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
          <span>
            Quiz Master · {getQuestionTypeLabel(q)} · {idx + 1}/{questions.length}
          </span>
          <span className="text-[#1E5B3A] font-bold">Score: {score}</span>
        </div>
        <div className="h-2 rounded-full bg-[#ECE7D8] overflow-hidden">
          <div
            className="h-full bg-[#1E5B3A] transition-all duration-300"
            style={{
              width: `${Math.round(((idx + (picked || enumSubmitted !== 'idle' ? 1 : 0)) / questions.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 space-y-3">
        <h3 className="text-lg font-bold text-[#172A1E] leading-snug">
          {promptParts.hasBlank ? (
            <>
              {promptParts.before}
              <span className="inline-block min-w-[76px] mx-1 px-2 py-0.5 rounded-lg bg-white border-b-2 border-[#EA7A26] text-[#C65B10] font-extrabold text-center">
                {picked || '_____'}
              </span>
              {promptParts.after}
            </>
          ) : (
            q.prompt
          )}
        </h3>
        {q.cluePanels && q.cluePanels.length >= 4 && (
          <div className="grid grid-cols-4 gap-2 pt-1 max-w-md">
            {q.cluePanels.slice(0, 4).map((panel, pIdx) => (
              <div key={pIdx} className="aspect-square rounded-xl overflow-hidden border border-[#D8D0BC]">
                <ClueSceneArtwork panel={panel} panelIndex={pIdx} showLabel={false} />
              </div>
            ))}
          </div>
        )}
        {q.hint && <p className="text-xs text-[#4D6354]">Hint: {q.hint}</p>}
      </div>

      {isEnumeration ? (
        <form onSubmit={handleEnumSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {expectedEnumItems.map((_, i) => (
              <input
                key={i}
                type="text"
                disabled={enumSubmitted !== 'idle'}
                value={enumGuesses[i] || ''}
                onChange={(e) => {
                  const next = [...enumGuesses];
                  next[i] = e.target.value;
                  setEnumGuesses(next);
                }}
                placeholder={`Answer Item #${i + 1}`}
                className="px-3.5 py-2.5 rounded-xl border-2 border-[#D8D0BC] bg-white text-sm font-semibold focus:border-[#1E5B3A] focus:outline-none disabled:opacity-60"
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={enumSubmitted !== 'idle' || enumGuesses.some((g) => !g.trim())}
            className="px-5 py-2.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Submit Enumeration
          </button>
        </form>
      ) : (
        <div className="space-y-2.5">
          {displayOptions.map((opt, i) => {
            const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();
            const isMine = picked === opt;
            return (
              <button
                key={`${opt}_${i}`}
                type="button"
                disabled={Boolean(picked)}
                onClick={() => handleSelect(opt)}
                className={`w-full p-4 rounded-xl border text-left text-sm font-semibold transition-colors flex items-center gap-3 ${
                  picked
                    ? isRight
                      ? 'bg-[#1E5B3A] text-white border-[#1E5B3A] cursor-default'
                      : isMine
                      ? 'bg-red-50 text-red-700 border-red-300 cursor-default'
                      : 'bg-white text-[#94A398] border-[#E5DEC9] cursor-default'
                    : 'bg-white border-[#E5DEC9] hover:border-[#1E5B3A] text-[#172A1E] cursor-pointer'
                }`}
              >
                <span className="w-7 h-7 rounded-lg bg-[#FAF8F2] text-[#172A1E] text-xs font-bold flex items-center justify-center shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar
          species={profile.petSpecies}
          color={profile.petColor}
          outfit={profile.outfit}
          accessory={profile.accessory}
          size={48}
        />
        <span>
          {isEnumeration
            ? enumSubmitted === 'correct'
              ? 'Answer Locked · All items matched!'
              : enumSubmitted === 'wrong'
                ? `Answer Locked · Expected items: ${expectedEnumItems.join(', ')}`
                : `Enter all ${expectedEnumItems.length} answers in any order.`
            : picked
              ? picked.trim().toUpperCase() === q.answer.trim().toUpperCase()
                ? 'Answer Locked · Great choice!'
                : `Answer Locked · Correct answer: ${q.answer}`
              : 'Pick the best answer (or press keys 1–4).'}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   9. MEMORY MATCH (Pair Prompts with Answers)
   ========================================================= */
export const MemoryMatchGame: React.FC<ClassicGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const pairs = useMemo(() => questions.slice(0, 6), [questions]);
  const cards = useMemo(() => {
    const raw = pairs.flatMap((q, i) => [
      {
        uid: `q_${i}`,
        pairId: i,
        text: q.prompt.length > 96 ? `${q.prompt.slice(0, 93)}...` : q.prompt,
        kind: 'Clue',
      },
      { uid: `a_${i}`, pairId: i, text: q.answer, kind: 'Answer' },
    ]);
    return shuffle(raw);
  }, [pairs]);

  const initialMatched =
    savedProgress?.extra && Array.isArray(savedProgress.extra.matchedIds)
      ? (savedProgress.extra.matchedIds as number[])
      : [];
  const initialMoves =
    savedProgress?.extra && typeof savedProgress.extra.moves === 'number'
      ? savedProgress.extra.moves
      : 0;

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>(initialMatched);
  const [moves, setMoves] = useState(initialMoves);
  const [startTime] = useState(() => Date.now());
  const flipTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const isAlreadyFinished = Boolean(
    pairs.length > 0 && initialMatched.length >= pairs.length
  );

  useEffect(() => {
    return () => {
      if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current);
      if (completeTimerRef.current !== null) window.clearTimeout(completeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAlreadyFinished || completedRef.current) return;
    completedRef.current = true;
    const finalScore = Math.max(40, 160 - initialMoves * 5);
    onComplete({
      score: savedProgress?.score || finalScore,
      correctCount: pairs.length,
      totalCount: pairs.length,
      durationSeconds: 1,
      summaryNote: `Matched all ${pairs.length} pairs in ${initialMoves} moves!`,
    });
  }, [isAlreadyFinished, pairs.length, initialMoves, savedProgress, onComplete]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your matched pairs...
      </div>
    );
  }

  if (pairs.length === 0) {
    return <EmptyDeckNotice />;
  }

  const handleFlip = (index: number) => {
    if (
      flipped.length >= 2 ||
      flipped.includes(index) ||
      matchedIds.includes(cards[index].pairId) ||
      completedRef.current
    ) {
      return;
    }
    soundFx.playClick();
    const next = [...flipped, index];
    setFlipped(next);

    if (next.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [first, second] = next;
      if (cards[first].pairId === cards[second].pairId) {
        soundFx.playCorrect();
        const nextMatched = [...matchedIds, cards[first].pairId];
        setMatchedIds(nextMatched);
        setFlipped([]);

        onSaveProgress?.({
          idx: nextMatched.length,
          score: Math.max(40, 160 - nextMoves * 5),
          correctCount: nextMatched.length,
          extra: { matchedIds: nextMatched, moves: nextMoves },
        });

        if (nextMatched.length === pairs.length) {
          completeTimerRef.current = window.setTimeout(() => {
            if (completedRef.current) return;
            completedRef.current = true;
            const finalScore = Math.max(40, 160 - nextMoves * 5);
            onComplete({
              score: finalScore,
              correctCount: pairs.length,
              totalCount: pairs.length,
              durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
              summaryNote: `Matched all ${pairs.length} pairs in ${nextMoves} moves!`,
            });
          }, 550);
        }
      } else {
        soundFx.playWrong();
        onSaveProgress?.({
          idx: matchedIds.length,
          score: Math.max(40, 160 - nextMoves * 5),
          correctCount: matchedIds.length,
          extra: { matchedIds, moves: nextMoves },
        });
        flipTimerRef.current = window.setTimeout(() => setFlipped([]), 900);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>
          Memory Match · Pairs {matchedIds.length}/{pairs.length}
        </span>
        <span>Moves: {moves}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((card, i) => {
          const isOpen = flipped.includes(i) || matchedIds.includes(card.pairId);
          return (
            <button
              key={card.uid}
              type="button"
              disabled={isOpen || flipped.length >= 2}
              onClick={() => handleFlip(i)}
              className={`min-h-[116px] p-3 rounded-2xl border-2 text-center flex flex-col items-center justify-center transition-all ${
                matchedIds.includes(card.pairId)
                  ? 'border-[#2E7D32] bg-emerald-50 text-[#1E5B3A] cursor-default'
                  : isOpen
                  ? 'border-[#EA7A26] bg-white text-[#172A1E] cursor-default'
                  : 'border-[#1E5B3A] bg-[#1E5B3A] text-white hover:bg-[#17462C] cursor-pointer'
              }`}
            >
              {isOpen ? (
                <>
                  <span className="text-[10px] font-bold text-[#EA7A26] mb-1">{card.kind}</span>
                  <span className="text-xs font-semibold leading-snug">{card.text}</span>
                </>
              ) : (
                <span className="text-lg font-extrabold">?</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar
          species={profile.petSpecies}
          color={profile.petColor}
          outfit={profile.outfit}
          accessory={profile.accessory}
          size={44}
        />
        <span>Flip two cards to match each clue with its correct answer!</span>
      </div>
    </div>
  );
};

/* =========================================================
   10. SORTING SQUAD (Group items into accurate category bins)
   ========================================================= */
export const SortingSquadGame: React.FC<ClassicGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const { bins, items } = useMemo(() => {
    const counts = new Map<string, number>();
    questions.forEach((q) => {
      const cat = (q.category || '').trim() || 'Core Topic';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const uniqueCats = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    if (uniqueCats.length <= 1) {
      const lengthBins = ['Short Answer (1–6 chars)', 'Longer Term (7+ chars)'];
      const mapped = questions.map((q) => {
        const cleanLen = q.answer.replace(/\s+/g, '').length;
        return {
          text: q.answer,
          hint: q.prompt,
          targetBin: cleanLen <= 6 ? 0 : 1,
        };
      });
      return { bins: lengthBins, items: mapped };
    }

    if (uniqueCats.length <= 4) {
      const mapped = questions.map((q) => {
        const cat = (q.category || '').trim() || 'Core Topic';
        return {
          text: q.answer,
          hint: q.prompt,
          targetBin: uniqueCats.indexOf(cat),
        };
      });
      return { bins: uniqueCats, items: mapped };
    }

    const topThree = uniqueCats.slice(0, 3);
    const fourBins = [...topThree, 'Other Topics'];
    const mapped = questions.map((q) => {
      const cat = (q.category || '').trim() || 'Core Topic';
      const found = topThree.indexOf(cat);
      return {
        text: q.answer,
        hint: q.prompt,
        targetBin: found !== -1 ? found : 3,
      };
    });
    return { bins: fourBins, items: mapped };
  }, [questions]);

  const isAlreadyFinished = Boolean(
    savedProgress && items.length > 0 && savedProgress.idx >= items.length
  );

  const initialIdx = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, items.length - 1))
    : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [pickedBin, setPickedBin] = useState<number | null>(null);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAlreadyFinished || completedRef.current || !savedProgress) return;
    completedRef.current = true;
    onComplete({
      score: savedProgress.score || 0,
      correctCount: savedProgress.correctCount || 0,
      totalCount: items.length,
      durationSeconds: 1,
    });
  }, [isAlreadyFinished, savedProgress, items.length, onComplete]);

  const current = items[idx];

  const handleSort = useCallback(
    (binIdx: number) => {
      if (!current || pickedBin !== null || completedRef.current) return;
      setPickedBin(binIdx);
      const isRight = binIdx === current.targetBin;
      const nextScore = isRight ? score + 25 : score;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;

      onSaveProgress?.({
        idx: idx + 1,
        score: nextScore,
        correctCount: nextCorrect,
      });

      if (isRight) {
        soundFx.playCorrect();
        setScore(nextScore);
        setCorrectCount(nextCorrect);
      } else {
        soundFx.playWrong();
      }

      timeoutRef.current = window.setTimeout(() => {
        if (idx + 1 >= items.length) {
          if (completedRef.current) return;
          completedRef.current = true;
          onComplete({
            score: nextScore,
            correctCount: nextCorrect,
            totalCount: items.length,
            durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
          });
        } else {
          setIdx((i) => i + 1);
          setPickedBin(null);
        }
      }, 800);
    },
    [current, pickedBin, score, correctCount, onSaveProgress, idx, items.length, onComplete, startTime]
  );

  useEffect(() => {
    if (!current || pickedBin !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const num = Number(e.key);
      if (num >= 1 && num <= bins.length) {
        e.preventDefault();
        handleSort(num - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, pickedBin, bins.length, handleSort]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  if (!current) {
    return <EmptyDeckNotice />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
          <span>
            Sorting Squad · {idx + 1}/{items.length}
          </span>
          <span className="text-[#1E5B3A] font-bold">Score: {score}</span>
        </div>
        <div className="h-2 rounded-full bg-[#ECE7D8] overflow-hidden">
          <div
            className="h-full bg-[#1E5B3A] transition-all duration-300"
            style={{ width: `${Math.round(((idx + (pickedBin !== null ? 1 : 0)) / items.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 text-center">
        <p className="text-xs font-semibold text-[#EA7A26] mb-1">Sort This Item</p>
        <h3 className="text-2xl font-extrabold text-[#172A1E]">{current.text}</h3>
        <p className="text-xs text-[#4D6354] mt-2">{current.hint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bins.map((cat, bIdx) => {
          const isTarget = bIdx === current.targetBin;
          const isMine = pickedBin === bIdx;
          return (
            <button
              key={cat}
              type="button"
              disabled={pickedBin !== null}
              onClick={() => handleSort(bIdx)}
              className={`p-5 rounded-2xl border-2 text-center transition-colors ${
                pickedBin !== null
                  ? isTarget
                    ? 'border-[#1E5B3A] bg-[#1E5B3A] text-white cursor-default'
                    : isMine
                    ? 'border-red-300 bg-red-50 text-red-700 cursor-default'
                    : 'border-[#E5DEC9] bg-white text-[#94A398] cursor-default'
                  : 'border-[#1E5B3A]/40 hover:border-[#1E5B3A] bg-white hover:bg-[#1E5B3A]/5 cursor-pointer'
              }`}
            >
              <p className={`text-xs mb-1 ${pickedBin !== null && isTarget ? 'text-emerald-100' : 'text-[#4D6354]'}`}>
                [{bIdx + 1}] Category Bin {bIdx + 1}
              </p>
              <p className={`text-base font-bold ${pickedBin !== null && isTarget ? 'text-white' : isMine ? 'text-red-700' : 'text-[#1E5B3A]'}`}>
                {cat}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar
          species={profile.petSpecies}
          color={profile.petColor}
          outfit={profile.outfit}
          accessory={profile.accessory}
          size={44}
        />
        <span>
          {pickedBin !== null
            ? pickedBin === current.targetBin
              ? 'Answer Locked · Cleanly sorted! +25 pts'
              : `Answer Locked · Belongs in: ${bins[current.targetBin]}`
            : 'Match the term above to the right category bin (or press keys 1–4).'}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   11. QUICK RECALL (True / False Rapid Blitz)
   ========================================================= */
export const QuickRecallGame: React.FC<ClassicGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const statements = useMemo(() => {
    if (questions.length === 0) return [];
    const flags =
      questions.length >= 2
        ? shuffle(questions.map((_, i) => i % 2 === 0))
        : [Math.random() < 0.5];

    const fallbackAnswers = questions.map((item) => item.answer);

    return questions.map((q, i) => {
      const makeTrue = flags[i];
      const answerUpper = q.answer.trim().toUpperCase();
      const distractorFromOptions = (q.options || []).find(
        (o) => o.trim() && o.trim().toUpperCase() !== answerUpper
      );
      const distractorFromPool = fallbackAnswers.find(
        (a) => a.trim() && a.trim().toUpperCase() !== answerUpper
      );
      const shownAnswer = makeTrue
        ? q.answer
        : distractorFromOptions || distractorFromPool || 'Unrelated Concept';
      return {
        prompt: q.prompt,
        proposed: shownAnswer,
        correctAnswer: q.answer,
        isTrue: makeTrue,
      };
    });
  }, [questions]);

  const isAlreadyFinished = Boolean(
    savedProgress && statements.length > 0 && savedProgress.idx >= statements.length
  );

  const initialIdx = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, statements.length - 1))
    : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [answeredCount, setAnsweredCount] = useState(savedProgress?.answeredCount || 0);
  const [voted, setVoted] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(Math.max(45, statements.length * 6));
  const [startTime] = useState(() => Date.now());

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const correctRef = useRef(correctCount);
  correctRef.current = correctCount;
  const answeredRef = useRef(answeredCount);
  answeredRef.current = answeredCount;
  const completedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAlreadyFinished || completedRef.current || !savedProgress) return;
    completedRef.current = true;
    onComplete({
      score: savedProgress.score || 0,
      correctCount: savedProgress.correctCount || 0,
      totalCount: statements.length,
      durationSeconds: 1,
    });
  }, [isAlreadyFinished, savedProgress, statements.length, onComplete]);

  // Single stable 1-second timer
  useEffect(() => {
    if (statements.length === 0 || isAlreadyFinished) return;
    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [statements.length, isAlreadyFinished]);

  useEffect(() => {
    if (timeLeft === 0 && statements.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete({
        score: scoreRef.current,
        correctCount: correctRef.current,
        totalCount: Math.max(1, answeredRef.current),
        durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
      });
    }
  }, [timeLeft, statements.length, onComplete, startTime]);

  const current = statements[idx];

  const handleVote = useCallback(
    (voteTrue: boolean) => {
      if (!current || voted !== null || completedRef.current) return;
      setVoted(voteTrue);
      const isRight = voteTrue === current.isTrue;
      const nextScore = isRight ? score + 25 : score;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;
      const nextAnswered = answeredCount + 1;
      setAnsweredCount(nextAnswered);

      onSaveProgress?.({
        idx: idx + 1,
        score: nextScore,
        correctCount: nextCorrect,
        answeredCount: nextAnswered,
      });

      if (isRight) {
        soundFx.playCorrect();
        setScore(nextScore);
        setCorrectCount(nextCorrect);
      } else {
        soundFx.playWrong();
      }

      timeoutRef.current = window.setTimeout(() => {
        if (idx + 1 >= statements.length) {
          if (completedRef.current) return;
          completedRef.current = true;
          onComplete({
            score: nextScore,
            correctCount: nextCorrect,
            totalCount: statements.length,
            durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
          });
        } else {
          setIdx((i) => i + 1);
          setVoted(null);
        }
      }, 900);
    },
    [current, voted, score, correctCount, answeredCount, onSaveProgress, idx, statements.length, onComplete, startTime]
  );

  useEffect(() => {
    if (!current || voted !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 't' || k === '1') {
        e.preventDefault();
        handleVote(true);
      } else if (k === 'f' || k === '2') {
        e.preventDefault();
        handleVote(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, voted, handleVote]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  if (!current) {
    return <EmptyDeckNotice />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
        <span className="text-[#4D6354]">
          Quick Recall · {idx + 1}/{statements.length}
        </span>
        <span className={`flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600 font-bold' : 'text-[#EA7A26]'}`}>
          <Clock className="w-3.5 h-3.5" /> {timeLeft}s
        </span>
        <span className="text-[#1E5B3A] font-bold">Score: {score}</span>
      </div>

      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 text-center space-y-2">
        <p className="text-sm text-[#4D6354]">{current.prompt}</p>
        <p className="text-xs font-bold text-[#EA7A26]">Proposed Answer:</p>
        <h3 className="text-2xl font-extrabold text-[#172A1E]">{current.proposed}</h3>
        {voted !== null && (
          <p className={`text-xs font-bold pt-1 inline-flex items-center gap-1 ${voted === current.isTrue ? 'text-[#1E5B3A]' : 'text-red-600'}`}>
            <Lock className="w-3.5 h-3.5" />
            {voted === current.isTrue
              ? 'Answer Locked · Correct! +25 pts'
              : `Answer Locked · True answer: ${current.correctAnswer}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          disabled={voted !== null}
          onClick={() => handleVote(true)}
          className={`py-4 rounded-2xl font-bold text-base transition-opacity ${
            voted !== null && !current.isTrue ? 'opacity-40' : ''
          } bg-[#1E5B3A] hover:bg-[#17462C] text-white ${voted !== null ? 'cursor-default' : 'cursor-pointer'}`}
        >
          TRUE [T]
        </button>
        <button
          type="button"
          disabled={voted !== null}
          onClick={() => handleVote(false)}
          className={`py-4 rounded-2xl font-bold text-base transition-opacity ${
            voted !== null && current.isTrue ? 'opacity-40' : ''
          } bg-[#EA7A26] hover:bg-[#D46818] text-white ${voted !== null ? 'cursor-default' : 'cursor-pointer'}`}
        >
          FALSE [F]
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar
          species={profile.petSpecies}
          color={profile.petColor}
          outfit={profile.outfit}
          accessory={profile.accessory}
          size={44}
        />
        <span>Decide quickly whether the proposed answer matches the clue (T/F or 1/2).</span>
      </div>
    </div>
  );
};
