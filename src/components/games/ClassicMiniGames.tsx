import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { PublicProfile, QuizQuestion } from '../../types';
import { GameSessionResult } from './SignatureGames';
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
export const WordQuestGame: React.FC<ClassicGameProps> = ({ questions, profile, onComplete }) => {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
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

  const q = questions[idx];
  const word = useMemo(
    () => (q?.answer || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    [q?.answer]
  );
  const tiles = useMemo(
    () => shuffle(word.split('').map((ch, i) => ({ id: i, ch }))),
    [word, idx]
  );

  if (!q || !word) {
    return <EmptyDeckNotice />;
  }

  const built = picked.map((i) => tiles[i]?.ch || '').join('');

  const handleSubmit = () => {
    if (locked || built.length === 0 || completedRef.current) return;
    setLocked(true);
    const isRight = built === word;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + 25 : score;

    if (isRight) {
      soundFx.playCorrect();
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      setStatus('Great spelling! +25 pts');
    } else {
      soundFx.playWrong();
      setStatus(`Word was ${word}`);
    }

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
        setPicked([]);
        setStatus('');
        setLocked(false);
      }
    }, 850);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>Word Quest · {idx + 1}/{questions.length}</span>
        <span className="text-[#1E5B3A]">Score: {score}</span>
      </div>
      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 text-center">
        <p className="text-base font-bold text-[#172A1E]">{q.prompt}</p>
        <p className="text-xs text-[#4D6354] mt-1">Hint: {q.hint}</p>
      </div>
      <div className="min-h-14 rounded-2xl border-2 border-dashed border-[#D4CCB5] flex flex-wrap items-center justify-center gap-1.5 p-3">
        {picked.length === 0 ? (
          <span className="text-sm font-extrabold tracking-widest text-[#94A398]">TAP LETTERS BELOW</span>
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
              className="w-10 h-11 rounded-xl border-2 border-[#1E5B3A] bg-white text-lg font-extrabold text-[#1E5B3A] cursor-pointer hover:bg-red-50 hover:border-red-300"
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
            className={`w-11 h-11 rounded-xl border-2 font-extrabold text-base cursor-pointer ${
              picked.includes(i)
                ? 'opacity-25 border-[#E5DEC9] cursor-default'
                : 'border-[#1E5B3A] bg-white text-[#172A1E] hover:bg-[#1E5B3A]/5'
            }`}
          >
            {t.ch}
          </button>
        ))}
      </div>
      {status && <p className="text-center text-xs font-bold text-[#EA7A26]">{status}</p>}
      <div className="flex items-center justify-between pt-3 border-t border-[#ECE7D8]">
        <PetAvatar species={profile.petSpecies} color={profile.petColor} outfit={profile.outfit} accessory={profile.accessory} size={50} />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={locked || picked.length === 0}
            onClick={() => {
              soundFx.playClick();
              setPicked([]);
            }}
            className="px-4 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50"
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
export const MathDashGame: React.FC<ClassicGameProps> = ({ questions, profile, onComplete }) => {
  const mathItems = useMemo(() => {
    // Only pull deck questions that are genuine numerical / math questions
    const deckMath = questions
      .filter((q) => /^\d+(\.\d+)?$/.test(q.answer.trim()) || /[+\-×÷*/=]/.test(q.prompt))
      .map((q) => ({
        prompt: q.prompt,
        answer: q.answer.trim(),
        options: normalizeOptions(q),
      }));

    const ops: Array<{ label: string; calc: (a: number, b: number) => number }> = [
      { label: '+', calc: (a, b) => a + b },
      { label: '-', calc: (a, b) => a - b },
      { label: '×', calc: (a, b) => a * b },
    ];

    const generated: Array<{ prompt: string; answer: string; options: string[] }> = [];
    for (let i = 0; i < 8; i++) {
      const op = ops[i % ops.length];
      const a = op.label === '×' ? 4 + (i % 6) : 12 + i * 4;
      const b = op.label === '×' ? 3 + ((i + 1) % 7) : 5 + (i % 5) * 3;
      const ans = op.calc(a, b);
      const distractors = new Set<string>([String(ans)]);
      const offsets = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 8];
      for (const off of shuffle(offsets)) {
        if (distractors.size >= 4) break;
        const cand = ans + off;
        if (cand >= 0 && cand !== ans) distractors.add(String(cand));
      }
      generated.push({
        prompt: `${a} ${op.label} ${b} = ?`,
        answer: String(ans),
        options: shuffle(Array.from(distractors)),
      });
    }

    if (deckMath.length >= 6) return deckMath;
    return [...deckMath, ...generated.slice(0, Math.max(6 - deckMath.length, 0))];
  }, [questions]);

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [pickedOpt, setPickedOpt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(40);
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

  // Single stable 1-second timer
  useEffect(() => {
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
  }, []);

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

  const handleChoose = (opt: string) => {
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
    }, 380);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
        <span className="text-[#4D6354]">Math Dash · {idx + 1}/{mathItems.length}</span>
        <span className={`flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600 font-bold' : 'text-[#EA7A26]'}`}>
          <Clock className="w-3.5 h-3.5" /> {timeLeft}s
        </span>
        <span className="text-[#1E5B3A]">
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
              className={`p-4 rounded-xl border text-base font-bold tabular-nums cursor-pointer transition-colors ${
                pickedOpt
                  ? isRight
                    ? 'bg-[#1E5B3A] text-white border-[#1E5B3A]'
                    : isMine
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : 'bg-white text-[#94A398] border-[#E5DEC9]'
                  : 'border-[#E5DEC9] bg-white hover:border-[#EA7A26] hover:bg-[#FFF8F1] text-[#172A1E]'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar species={profile.petSpecies} color={profile.petColor} outfit={profile.outfit} accessory={profile.accessory} size={48} />
        <span>
          {pickedOpt
            ? pickedOpt.trim().toUpperCase() === current.answer.trim().toUpperCase()
              ? 'Fast & accurate!'
              : `Answer was ${current.answer}`
            : 'Think fast and build a combo streak!'}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   8. QUIZ MASTER (4-Choice Mastery Challenge)
   ========================================================= */
export const QuizMasterGame: React.FC<ClassicGameProps> = ({ questions, profile, onComplete }) => {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [enumGuesses, setEnumGuesses] = useState<string[]>([]);
  const [enumSubmitted, setEnumSubmitted] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

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

  if (!q) {
    return <EmptyDeckNotice />;
  }

  const promptParts = splitPromptBlank(q.prompt);

  const advanceAfterAnswer = (nextScore: number, nextCorrect: number) => {
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
    }, 900);
  };

  const handleSelect = (opt: string) => {
    if (picked || completedRef.current) return;
    setPicked(opt);
    const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();
    const nextScore = isRight ? score + 30 : score;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;

    if (isRight) {
      soundFx.playCorrect();
      setScore(nextScore);
      setCorrectCount(nextCorrect);
    } else {
      soundFx.playWrong();
    }

    advanceAfterAnswer(nextScore, nextCorrect);
  };

  const handleEnumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enumSubmitted !== 'idle' || completedRef.current) return;
    if (enumGuesses.some((g) => !g.trim())) return;
    const isRight = checkEnumerationMatch(enumGuesses, expectedEnumItems);
    const nextScore = isRight ? score + 40 : score;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    setEnumSubmitted(isRight ? 'correct' : 'wrong');

    if (isRight) {
      soundFx.playCorrect();
      setScore(nextScore);
      setCorrectCount(nextCorrect);
    } else {
      soundFx.playWrong();
    }

    advanceAfterAnswer(nextScore, nextCorrect);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>
          Quiz Master · {getQuestionTypeLabel(q)} · {idx + 1}/{questions.length}
        </span>
        <span className="text-[#1E5B3A]">Score: {score}</span>
      </div>
      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6">
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
        {q.hint && (
          <p className="text-xs text-[#4D6354] mt-2">Hint: {q.hint}</p>
        )}
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
                className={`w-full p-4 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer flex items-center gap-3 ${
                  picked
                    ? isRight
                      ? 'bg-[#1E5B3A] text-white border-[#1E5B3A]'
                      : isMine
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-[#94A398] border-[#E5DEC9]'
                    : 'bg-white border-[#E5DEC9] hover:border-[#1E5B3A] text-[#172A1E]'
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
        <PetAvatar species={profile.petSpecies} color={profile.petColor} outfit={profile.outfit} accessory={profile.accessory} size={48} />
        <span>
          {isEnumeration
            ? enumSubmitted === 'correct'
              ? 'All items matched!'
              : enumSubmitted === 'wrong'
                ? `Expected items: ${expectedEnumItems.join(', ')}`
                : `Enter all ${expectedEnumItems.length} answers in any order.`
            : picked
              ? picked.trim().toUpperCase() === q.answer.trim().toUpperCase()
                ? 'Great choice!'
                : `Correct answer: ${q.answer}`
              : 'Pick the best answer.'}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   9. MEMORY MATCH (Pair Prompts with Answers)
   ========================================================= */
export const MemoryMatchGame: React.FC<ClassicGameProps> = ({ questions, profile, onComplete }) => {
  const pairs = useMemo(() => questions.slice(0, 4), [questions]);
  const cards = useMemo(() => {
    const raw = pairs.flatMap((q, i) => [
      { uid: `q_${i}`, pairId: i, text: q.prompt.length > 52 ? `${q.prompt.slice(0, 49)}...` : q.prompt, kind: 'Clue' },
      { uid: `a_${i}`, pairId: i, text: q.answer, kind: 'Answer' },
    ]);
    return shuffle(raw);
  }, [pairs]);

  const [flipped, setFlipped] = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startTime] = useState(() => Date.now());
  const flipTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current);
      if (completeTimerRef.current !== null) window.clearTimeout(completeTimerRef.current);
    };
  }, []);

  if (pairs.length === 0) {
    return <EmptyDeckNotice />;
  }

  const handleFlip = (index: number) => {
    if (flipped.length >= 2 || flipped.includes(index) || matchedIds.includes(cards[index].pairId) || completedRef.current) return;
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
        if (nextMatched.length === pairs.length) {
          completeTimerRef.current = window.setTimeout(() => {
            if (completedRef.current) return;
            completedRef.current = true;
            const finalScore = Math.max(40, 140 - nextMoves * 5);
            onComplete({
              score: finalScore,
              correctCount: pairs.length,
              totalCount: pairs.length,
              durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
              summaryNote: `Matched all pairs in ${nextMoves} moves!`,
            });
          }, 500);
        }
      } else {
        soundFx.playWrong();
        flipTimerRef.current = window.setTimeout(() => setFlipped([]), 850);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>Memory Match · Pairs {matchedIds.length}/{pairs.length}</span>
        <span>Moves: {moves}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card, i) => {
          const isOpen = flipped.includes(i) || matchedIds.includes(card.pairId);
          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => handleFlip(i)}
              className={`min-h-[108px] p-3 rounded-2xl border-2 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                matchedIds.includes(card.pairId)
                  ? 'border-[#2E7D32] bg-emerald-50 text-[#1E5B3A]'
                  : isOpen
                  ? 'border-[#EA7A26] bg-white text-[#172A1E]'
                  : 'border-[#1E5B3A] bg-[#1E5B3A] text-white hover:bg-[#17462C]'
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
        <PetAvatar species={profile.petSpecies} color={profile.petColor} outfit={profile.outfit} accessory={profile.accessory} size={44} />
        <span>Flip two cards to match each clue with its correct answer!</span>
      </div>
    </div>
  );
};

/* =========================================================
   10. SORTING SQUAD (Group items into accurate category bins)
   ========================================================= */
export const SortingSquadGame: React.FC<ClassicGameProps> = ({ questions, profile, onComplete }) => {
  const { bins, items } = useMemo(() => {
    const counts = new Map<string, number>();
    questions.forEach((q) => {
      const cat = (q.category || '').trim() || 'Core Topic';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const uniqueCats = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    // Case 1: Only 1 category in deck -> sort by answer length deterministically
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

    // Case 2: 2 to 4 categories -> 1 exact bin per category
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

    // Case 3: More than 4 categories -> top 3 + "Other Topics" bin 4
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

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [pickedBin, setPickedBin] = useState<number | null>(null);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const current = items[idx];
  if (!current) {
    return <EmptyDeckNotice />;
  }

  const handleSort = (binIdx: number) => {
    if (pickedBin !== null || completedRef.current) return;
    setPickedBin(binIdx);
    const isRight = binIdx === current.targetBin;
    const nextScore = isRight ? score + 25 : score;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
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
    }, 650);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>Sorting Squad · {idx + 1}/{items.length}</span>
        <span className="text-[#1E5B3A]">Score: {score}</span>
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
              className={`p-5 rounded-2xl border-2 text-center cursor-pointer transition-colors ${
                pickedBin !== null
                  ? isTarget
                    ? 'border-[#1E5B3A] bg-[#1E5B3A] text-white'
                    : isMine
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-[#E5DEC9] bg-white text-[#94A398]'
                  : 'border-[#1E5B3A]/40 hover:border-[#1E5B3A] bg-white hover:bg-[#1E5B3A]/5'
              }`}
            >
              <p className={`text-xs mb-1 ${pickedBin !== null && isTarget ? 'text-emerald-100' : 'text-[#4D6354]'}`}>
                Category Bin {bIdx + 1}
              </p>
              <p className={`text-base font-bold ${pickedBin !== null && isTarget ? 'text-white' : isMine ? 'text-red-700' : 'text-[#1E5B3A]'}`}>
                {cat}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar species={profile.petSpecies} color={profile.petColor} outfit={profile.outfit} accessory={profile.accessory} size={44} />
        <span>
          {pickedBin !== null
            ? pickedBin === current.targetBin
              ? 'Cleanly sorted! +25 pts'
              : `Belongs in: ${bins[current.targetBin]}`
            : 'Match the term above to the right category bin.'}
        </span>
      </div>
    </div>
  );
};

/* =========================================================
   11. QUICK RECALL (True / False Rapid Blitz)
   ========================================================= */
export const QuickRecallGame: React.FC<ClassicGameProps> = ({ questions, profile, onComplete }) => {
  const statements = useMemo(() => {
    if (questions.length === 0) return [];
    // Randomize true/false assignment while guaranteeing mixed values when >= 2 questions
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

  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [voted, setVoted] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(35);
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

  // Single stable 1-second timer
  useEffect(() => {
    if (statements.length === 0) return;
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
  }, [statements.length]);

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
  if (!current) {
    return <EmptyDeckNotice />;
  }

  const handleVote = (voteTrue: boolean) => {
    if (voted !== null || completedRef.current) return;
    setVoted(voteTrue);
    const isRight = voteTrue === current.isTrue;
    const nextScore = isRight ? score + 25 : score;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    setAnsweredCount((c) => c + 1);

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
    }, 450);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold tabular-nums">
        <span className="text-[#4D6354]">Quick Recall · {idx + 1}/{statements.length}</span>
        <span className={`flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-600 font-bold' : 'text-[#EA7A26]'}`}>
          <Clock className="w-3.5 h-3.5" /> {timeLeft}s
        </span>
        <span className="text-[#1E5B3A]">Score: {score}</span>
      </div>

      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 text-center space-y-2">
        <p className="text-sm text-[#4D6354]">{current.prompt}</p>
        <p className="text-xs font-bold text-[#EA7A26]">Proposed Answer:</p>
        <h3 className="text-2xl font-extrabold text-[#172A1E]">{current.proposed}</h3>
        {voted !== null && (
          <p className={`text-xs font-bold pt-1 ${voted === current.isTrue ? 'text-[#1E5B3A]' : 'text-red-600'}`}>
            {voted === current.isTrue
              ? 'Correct! +25 pts'
              : `Incorrect — True answer: ${current.correctAnswer}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          disabled={voted !== null}
          onClick={() => handleVote(true)}
          className={`py-4 rounded-2xl font-bold text-base cursor-pointer transition-opacity ${
            voted !== null && !current.isTrue ? 'opacity-40' : ''
          } bg-[#1E5B3A] hover:bg-[#17462C] text-white`}
        >
          TRUE
        </button>
        <button
          type="button"
          disabled={voted !== null}
          onClick={() => handleVote(false)}
          className={`py-4 rounded-2xl font-bold text-base cursor-pointer transition-opacity ${
            voted !== null && current.isTrue ? 'opacity-40' : ''
          } bg-[#EA7A26] hover:bg-[#D46818] text-white`}
        >
          FALSE
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-[#4D6354]">
        <PetAvatar species={profile.petSpecies} color={profile.petColor} outfit={profile.outfit} accessory={profile.accessory} size={44} />
        <span>Decide quickly whether the proposed answer matches the clue!</span>
      </div>
    </div>
  );
};
