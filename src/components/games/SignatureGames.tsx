import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  CheckCircle2,
  Clock,
  Flag,
  Flame,
  HelpCircle,
  Lock,
  Package,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PublicProfile, QuizQuestion } from '../../types';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';
import {
  checkEnumerationMatch,
  getQuestionTypeLabel,
  normalizeAnswerText,
  splitPromptBlank,
} from '../../lib/questionUtils';

export interface GameSessionResult {
  score: number;
  correctCount: number;
  totalCount: number;
  durationSeconds: number;
  summaryNote?: string;
}

export interface GameRoundProgress {
  idx: number;
  score: number;
  correctCount: number;
  answeredCount?: number;
  extra?: Record<string, unknown>;
}

interface CommonGameProps {
  questions: QuizQuestion[];
  profile: PublicProfile;
  allProfiles: PublicProfile[];
  savedProgress?: GameRoundProgress | null;
  onSaveProgress?: (progress: GameRoundProgress) => void;
  onComplete: (result: GameSessionResult) => void;
  onAwardStudent?: (studentUid: string, points: number) => Promise<void>;
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
  const fallbacks = ['Option A', 'Option B', 'Option C', 'Option D'];
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
   1. LORENSCAPE (Guess answer from given letter tray)
   ========================================================= */
export const LorenscapeGame: React.FC<CommonGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const playableQuestions = useMemo(
    () =>
      questions.filter((q) => {
        const candidate =
          q.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length > 0
            ? q.enumerationItems[0]
            : q.answer;
        return candidate.toUpperCase().replace(/[^A-Z0-9]/g, '').length >= 2;
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
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [startTime] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
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
  const targetClean = useMemo(() => {
    if (!q) return '';
    const raw =
      q.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length > 0
        ? q.enumerationItems[0]
        : q.answer;
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.length <= 16 ? cleaned : cleaned.slice(0, 16);
  }, [q]);

  const letterTiles = useMemo(() => {
    if (!targetClean) return [];
    const chars = targetClean.split('');
    const isNumericOnly = /^\d+$/.test(targetClean);
    const pool = isNumericOnly ? '0123456789' : 'AEIOURSTLNMDPC';
    const decoys = shuffle(pool.split('').filter((c) => !chars.includes(c))).slice(0, 4);
    return shuffle([...chars, ...decoys].map((char, i) => ({ id: i, char })));
  }, [targetClean, idx]);

  const currentGuess = selectedIndices.map((tileIdx) => letterTiles[tileIdx]?.char || '').join('');

  const handlePickTile = useCallback(
    (tileIndex: number) => {
      if (feedback !== 'idle') return;
      setSelectedIndices((prev) => {
        if (prev.includes(tileIndex) || prev.length >= targetClean.length) return prev;
        soundFx.playClick();
        return [...prev, tileIndex];
      });
    },
    [feedback, targetClean.length]
  );

  const handleRemoveLast = useCallback(() => {
    if (feedback !== 'idle') return;
    soundFx.playClick();
    setSelectedIndices((prev) => prev.slice(0, -1));
  }, [feedback]);

  const handleClear = useCallback(() => {
    if (feedback !== 'idle') return;
    soundFx.playClick();
    setSelectedIndices([]);
  }, [feedback]);

  const handleSubmit = useCallback(() => {
    if (feedback !== 'idle' || currentGuess.length === 0 || !q || completedRef.current) return;
    const isRight = currentGuess === targetClean;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + (showHint ? 20 : 30) : score;

    // Persist forward-only step immediately so the student cannot re-answer this question
    onSaveProgress?.({
      idx: idx + 1,
      score: nextScore,
      correctCount: nextCorrect,
    });

    if (isRight) {
      soundFx.playCorrect();
      setFeedback('correct');
      setCorrectCount(nextCorrect);
      setScore(nextScore);
    } else {
      soundFx.playWrong();
      setFeedback('wrong');
    }

    timerRef.current = window.setTimeout(() => {
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
        setSelectedIndices([]);
        setShowHint(false);
        setFeedback('idle');
      }
    }, 950);
  }, [
    feedback,
    currentGuess,
    q,
    targetClean,
    correctCount,
    score,
    showHint,
    onSaveProgress,
    idx,
    playableQuestions.length,
    onComplete,
    startTime,
  ]);

  // Keyboard support for typing letters/numbers, Backspace, and Enter
  useEffect(() => {
    if (!q || feedback !== 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleRemoveLast();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      const ch = e.key.toUpperCase();
      if (/^[A-Z0-9]$/.test(ch)) {
        const availableIdx = letterTiles.findIndex(
          (t, i) => t.char === ch && !selectedIndices.includes(i)
        );
        if (availableIdx !== -1) {
          handlePickTile(availableIdx);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, feedback, letterTiles, selectedIndices, handlePickTile, handleRemoveLast, handleSubmit]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  if (!q || !targetClean) {
    return <EmptyDeckNotice />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
          <span>
            Lorenscape · Question {idx + 1} of {playableQuestions.length}
          </span>
          <span className="text-[#1E5B3A] font-bold">Score: {score} pts</span>
        </div>
        <div className="h-2 rounded-full bg-[#ECE7D8] overflow-hidden">
          <div
            className="h-full bg-[#1E5B3A] transition-all duration-300"
            style={{ width: `${Math.round(((idx + (feedback !== 'idle' ? 1 : 0)) / playableQuestions.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Question Prompt */}
      <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 text-center">
        <p className="text-xs font-semibold text-[#EA7A26] mb-2">Lorenscape Word Mystery</p>
        <h3 className="text-xl font-bold text-[#172A1E] text-balance">{q.prompt}</h3>
        {showHint && (
          <p className="text-xs text-[#1E5B3A] mt-3 font-medium">Hint: {q.hint}</p>
        )}
      </div>

      {/* Letter Answer Slots */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {targetClean.split('').map((_, slotIdx) => {
          const tileIdx = selectedIndices[slotIdx];
          const ch = tileIdx !== undefined ? letterTiles[tileIdx]?.char : '';
          return (
            <button
              key={slotIdx}
              type="button"
              disabled={feedback !== 'idle'}
              onClick={() => {
                if (tileIdx !== undefined && feedback === 'idle') {
                  soundFx.playClick();
                  setSelectedIndices((prev) => prev.filter((_, i) => i !== slotIdx));
                }
              }}
              className={`w-10 h-11 sm:w-11 sm:h-12 rounded-xl border-2 text-lg font-extrabold flex items-center justify-center transition-colors ${
                feedback === 'correct'
                  ? 'border-[#2E7D32] bg-emerald-50 text-[#1E5B3A] cursor-default'
                  : feedback === 'wrong'
                  ? 'border-red-400 bg-red-50 text-red-700 cursor-default'
                  : ch
                  ? 'border-[#1E5B3A] bg-white text-[#172A1E] cursor-pointer'
                  : 'border-dashed border-[#D4CCB5] bg-[#FAF8F2] text-[#94A398] cursor-default'
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {/* Given Letter Tray */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-lg mx-auto">
        {letterTiles.map((tile, tIdx) => {
          const used = selectedIndices.includes(tIdx);
          return (
            <button
              key={tile.id}
              type="button"
              disabled={used || feedback !== 'idle'}
              onClick={() => handlePickTile(tIdx)}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full font-extrabold text-base border-2 transition-transform ${
                used || feedback !== 'idle'
                  ? 'opacity-25 border-[#E5DEC9] bg-[#FAF8F2] scale-95 cursor-default'
                  : 'border-[#EA7A26] bg-[#FFF8F1] text-[#C65B10] hover:scale-105 active:scale-95 cursor-pointer'
              }`}
            >
              {tile.char}
            </button>
          );
        })}
      </div>

      {/* Action Buttons & Pet Encouragement */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#ECE7D8]">
        <div className="flex items-center gap-3">
          <PetAvatar
            species={profile.petSpecies}
            color={profile.petColor}
            outfit={profile.outfit}
            accessory={profile.accessory}
            role={profile.role}
            size={56}
          />
          <span className="text-xs font-medium text-[#4D6354]">
            {feedback === 'correct' ? (
              <span className="text-[#1E5B3A] font-bold inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Answer Locked · Spot on!
              </span>
            ) : feedback === 'wrong' ? (
              <span className="text-red-700 font-bold inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Answer Locked · Correct term was {targetClean}
              </span>
            ) : (
              'Tap or type the letters to build the answer (answers lock once submitted).'
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={feedback !== 'idle' || showHint}
            onClick={() => {
              soundFx.playClick();
              setShowHint(true);
            }}
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Hint
          </button>
          <button
            type="button"
            disabled={feedback !== 'idle' || selectedIndices.length === 0}
            onClick={handleClear}
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
          <button
            type="button"
            disabled={feedback !== 'idle' || selectedIndices.length === 0}
            onClick={handleRemoveLast}
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            type="button"
            disabled={feedback !== 'idle' || currentGuess.length === 0}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   2. ON THE RUN (Solo Speed Track & Checkpoint Sprint — NPC-free)
   ========================================================= */
export const OnTheRunGame: React.FC<CommonGameProps> = ({
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
  const savedStreak =
    savedProgress?.extra && typeof savedProgress.extra.streak === 'number'
      ? savedProgress.extra.streak
      : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [streak, setStreak] = useState(savedStreak);
  const [lockedChoice, setLockedChoice] = useState<string | null>(null);
  const [startTime] = useState(() => Date.now());

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
    const savedCorrect = savedProgress.correctCount || 0;
    const finishBonus = savedCorrect === questions.length ? 40 : savedCorrect > 0 ? 15 : 0;
    onComplete({
      score: (savedProgress.score || 0) + finishBonus,
      correctCount: savedCorrect,
      totalCount: questions.length,
      durationSeconds: 1,
      summaryNote:
        savedCorrect === questions.length
          ? 'Perfect Solo Sprint to the Finish Line!'
          : `Cleared ${savedCorrect} of ${questions.length} track gates!`,
    });
  }, [isAlreadyFinished, savedProgress, questions.length, onComplete]);

  const q = questions[idx];
  const displayOptions = useMemo(() => (q ? normalizeOptions(q) : []), [q]);
  const playerPos =
    questions.length > 0
      ? Math.min(100, Math.round((correctCount / questions.length) * 100))
      : 0;

  const handleAnswer = useCallback(
    (opt: string) => {
      if (lockedChoice || completedRef.current || !q) return;
      setLockedChoice(opt);
      const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();

      const nextStreak = isRight ? streak + 1 : 0;
      const streakBonus = isRight && nextStreak >= 2 ? Math.min(20, nextStreak * 5) : 0;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;
      const nextScore = isRight ? score + 35 + streakBonus : score;

      setStreak(nextStreak);
      if (isRight) {
        soundFx.playCorrect();
        setCorrectCount(nextCorrect);
        setScore(nextScore);
      } else {
        soundFx.playWrong();
      }

      onSaveProgress?.({
        idx: idx + 1,
        score: nextScore,
        correctCount: nextCorrect,
        extra: { streak: nextStreak },
      });

      timeoutRef.current = window.setTimeout(() => {
        if (idx + 1 >= questions.length) {
          if (completedRef.current) return;
          completedRef.current = true;
          const finishBonus = nextCorrect === questions.length ? 40 : nextCorrect > 0 ? 15 : 0;
          onComplete({
            score: nextScore + finishBonus,
            correctCount: nextCorrect,
            totalCount: questions.length,
            durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
            summaryNote:
              nextCorrect === questions.length
                ? 'Perfect Solo Sprint to the Finish Line!'
                : `Cleared ${nextCorrect} of ${questions.length} track gates!`,
          });
        } else {
          setIdx((i) => i + 1);
          setLockedChoice(null);
        }
      }, 850);
    },
    [lockedChoice, q, streak, correctCount, score, onSaveProgress, idx, questions.length, onComplete, startTime]
  );

  useEffect(() => {
    if (!q || lockedChoice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const num = Number(e.key);
      if (num >= 1 && num <= displayOptions.length) {
        e.preventDefault();
        handleAnswer(displayOptions[num - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, lockedChoice, displayOptions, handleAnswer]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>
          On the Run · Solo Checkpoint {idx + 1}/{questions.length}
        </span>
        <div className="flex items-center gap-3">
          {streak >= 2 && (
            <span className="text-[#EA7A26] font-bold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> {streak}x Streak
            </span>
          )}
          <span className="text-[#1E5B3A] font-bold">Sprint Score: {score} pts</span>
        </div>
      </div>

      {/* Solo Checkpoint Speed Track */}
      <div className="bg-[#EAF4EA] rounded-2xl border border-[#CFE4CF] p-5 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-[#1E5B3A]">
          <span>START</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span className="flex items-center gap-1 text-[#EA7A26]">
            <Flag className="w-3.5 h-3.5" /> FINISH
          </span>
        </div>

        <div className="relative h-14 bg-white/95 rounded-xl border border-[#1E5B3A]/30 flex items-center px-3">
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-2 rounded-full bg-[#ECE7D8] overflow-hidden">
            <div
              className="h-full bg-[#1E5B3A] transition-all duration-500"
              style={{ width: `${playerPos}%` }}
            />
          </div>
          <div
            className="relative z-10 transition-all duration-500 animate-runner-hop flex items-center gap-1.5 bg-white/90 pr-2 py-0.5 rounded-full border border-[#1E5B3A]/20"
            style={{ marginLeft: `calc(${Math.min(82, Math.max(0, playerPos - 6))}%)` }}
          >
            <PetAvatar
              species={profile.petSpecies}
              color={profile.petColor}
              outfit={profile.outfit}
              accessory={profile.accessory}
              role={profile.role}
              size={38}
            />
            <span className="text-xs font-extrabold text-[#1E5B3A] whitespace-nowrap">
              {profile.displayName.split(' ')[0]} · {playerPos}%
            </span>
          </div>
        </div>
      </div>

      {/* Question & Fast Answer Choices */}
      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-5 space-y-4">
        <h3 className="text-lg font-bold text-[#172A1E]">{q.prompt}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayOptions.map((opt, optIdx) => {
            const isPicked = lockedChoice === opt;
            const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();
            return (
              <button
                key={`${opt}_${optIdx}`}
                type="button"
                disabled={Boolean(lockedChoice)}
                onClick={() => handleAnswer(opt)}
                className={`p-3.5 rounded-xl border text-left text-sm font-semibold transition-colors flex items-center gap-2.5 ${
                  lockedChoice
                    ? isRight
                      ? 'bg-[#1E5B3A] text-white border-[#1E5B3A] cursor-default'
                      : isPicked
                      ? 'bg-red-50 text-red-700 border-red-300 cursor-default'
                      : 'bg-[#FAF8F2] text-[#94A398] border-[#E5DEC9] cursor-default'
                    : 'bg-[#FAF8F2] hover:bg-[#EA7A26]/10 hover:border-[#EA7A26] border-[#E5DEC9] text-[#172A1E] cursor-pointer'
                }`}
              >
                <span className="w-6 h-6 rounded-md bg-white/80 text-[#172A1E] text-xs font-bold flex items-center justify-center shrink-0">
                  {optIdx + 1}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {lockedChoice && (
          <p className="text-xs font-bold text-[#1E5B3A] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#EA7A26]" />
            {lockedChoice.trim().toUpperCase() === q.answer.trim().toUpperCase()
              ? 'Answer Locked · Sprint forward!'
              : `Answer Locked · Correct answer: ${q.answer}`}
          </p>
        )}
      </div>
    </div>
  );
};

/* =========================================================
   3. BRAINZONE (Identification + Rising Platform + Timer)
   ========================================================= */
export const BrainzoneGame: React.FC<CommonGameProps> = ({
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
  const initialLevel =
    savedProgress?.extra && typeof savedProgress.extra.platformLevel === 'number'
      ? savedProgress.extra.platformLevel
      : 1;
  const initialTimeLeft = Math.max(75, Math.min(180, questions.length * 14));

  const [idx, setIdx] = useState(initialIdx);
  const [typed, setTyped] = useState('');
  const [platformLevel, setPlatformLevel] = useState(initialLevel);
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const [score, setScore] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [answeredCount, setAnsweredCount] = useState(savedProgress?.answeredCount || 0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(() => Date.now());

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const correctRef = useRef(correctCount);
  correctRef.current = correctCount;
  const answeredRef = useRef(answeredCount);
  answeredRef.current = answeredCount;
  const levelRef = useRef(platformLevel);
  levelRef.current = platformLevel;
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
      totalCount: questions.length,
      durationSeconds: 1,
      summaryNote: `Climbed to Platform Level ${initialLevel}!`,
    });
  }, [isAlreadyFinished, savedProgress, questions.length, onComplete, initialLevel]);

  // Single stable 1-second countdown interval (never resets on question advance)
  useEffect(() => {
    if (questions.length === 0 || isAlreadyFinished) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [questions.length, isAlreadyFinished]);

  useEffect(() => {
    if (timeLeft === 0 && questions.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete({
        score: scoreRef.current,
        correctCount: correctRef.current,
        totalCount: Math.max(1, answeredRef.current),
        durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
        summaryNote: `Reached Platform Level ${levelRef.current}!`,
      });
    }
  }, [timeLeft, questions.length, onComplete, startTime]);

  const q = questions[idx];
  const isEnumeration = Boolean(
    q?.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length >= 2
  );
  const expectedEnumItems = useMemo(
    () => (isEnumeration && q?.enumerationItems ? q.enumerationItems : []),
    [isEnumeration, q?.enumerationItems]
  );
  const [enumGuesses, setEnumGuesses] = useState<string[]>([]);

  useEffect(() => {
    if (expectedEnumItems.length > 0) {
      setEnumGuesses(Array(expectedEnumItems.length).fill(''));
    } else {
      setEnumGuesses([]);
    }
  }, [idx, expectedEnumItems.length]);

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
  const canSubmit = isEnumeration
    ? enumGuesses.length === expectedEnumItems.length && enumGuesses.every((g) => g.trim().length > 0)
    : typed.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || completedRef.current || !canSubmit) return;
    setSubmitting(true);

    const isRight = isEnumeration
      ? checkEnumerationMatch(enumGuesses, expectedEnumItems)
      : normalizeAnswerText(typed) === normalizeAnswerText(q.answer);

    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + (isEnumeration ? 50 : 40) : score;
    const nextLevel = isRight ? platformLevel + 1 : platformLevel;
    const nextAnswered = answeredCount + 1;
    setAnsweredCount(nextAnswered);

    // Save forward-only progress before feedback pause
    onSaveProgress?.({
      idx: idx + 1,
      score: nextScore,
      correctCount: nextCorrect,
      answeredCount: nextAnswered,
      extra: { platformLevel: nextLevel },
    });

    if (isRight) {
      soundFx.playCorrect();
      setPlatformLevel(nextLevel);
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      setFeedback(`Answer Locked · Platform elevated! +${isEnumeration ? 50 : 40} pts`);
    } else {
      soundFx.playWrong();
      setFeedback(`Answer Locked · Correct answer: ${q.answer}`);
    }

    timeoutRef.current = window.setTimeout(() => {
      setTyped('');
      setFeedback(null);
      setSubmitting(false);
      if (idx + 1 >= questions.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete({
          score: nextScore,
          correctCount: nextCorrect,
          totalCount: questions.length,
          durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
          summaryNote: `Climbed to Platform Level ${nextLevel}!`,
        });
      } else {
        setIdx((i) => i + 1);
      }
    }, 950);
  };

  const elevationPercent = Math.min(84, (platformLevel - 1) * 14);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Rising Platform Visual */}
      <div className="lg:col-span-4 bg-gradient-to-b from-sky-100 to-[#EAF4EA] rounded-2xl border border-[#CFE4CF] p-5 relative min-h-[290px] flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-[#1E5B3A] z-10">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-4 h-4 text-[#EA7A26]" />
            Platform Lv. {platformLevel}
          </span>
          <span className={`flex items-center gap-1 tabular-nums ${timeLeft <= 15 ? 'text-red-600' : 'text-[#C65B10]'}`}>
            <Clock className="w-3.5 h-3.5" /> {timeLeft}s
          </span>
        </div>

        <div
          className="absolute left-6 right-6 transition-all duration-500 flex flex-col items-center"
          style={{ bottom: `${16 + elevationPercent}%` }}
        >
          <PetAvatar
            species={profile.petSpecies}
            color={profile.petColor}
            outfit={profile.outfit}
            accessory={profile.accessory}
            role={profile.role}
            size={76}
          />
          <div className="w-full h-4 rounded-full bg-[#1E5B3A] border-b-4 border-[#133D26] shadow-sm" />
        </div>
      </div>

      {/* Identification / Fill in the Blank / Enumeration Input */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E5DEC9] p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-[#4D6354] mb-3 tabular-nums">
            <span>
              {getQuestionTypeLabel(q)} · {idx + 1} of {questions.length}
            </span>
            <span className="font-bold text-[#1E5B3A]">Score: {score}</span>
          </div>
          <h3 className="text-xl font-bold text-[#172A1E] mb-2 leading-snug">
            {promptParts.hasBlank ? (
              <>
                {promptParts.before}
                <span className="inline-block min-w-[90px] mx-1 px-2 py-0.5 rounded-lg bg-[#FFF8F1] border-b-2 border-[#EA7A26] text-[#C65B10] font-extrabold text-center">
                  {typed.trim() || '_____'}
                </span>
                {promptParts.after}
              </>
            ) : (
              q.prompt
            )}
          </h3>
          <p className="text-xs text-[#4D6354]">Hint: {q.hint}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {isEnumeration ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {expectedEnumItems.map((_, itemIdx) => (
                <input
                  key={itemIdx}
                  type="text"
                  autoFocus={itemIdx === 0}
                  disabled={submitting}
                  value={enumGuesses[itemIdx] || ''}
                  onChange={(e) => {
                    const next = [...enumGuesses];
                    next[itemIdx] = e.target.value;
                    setEnumGuesses(next);
                  }}
                  placeholder={`Item ${itemIdx + 1} of ${expectedEnumItems.length}...`}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#D8D0BC] focus:border-[#1E5B3A] focus:outline-none text-sm font-semibold disabled:opacity-60"
                />
              ))}
            </div>
          ) : (
            <input
              type="text"
              autoFocus
              disabled={submitting}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={
                q.questionType === 'fill_in_blank'
                  ? 'Type the missing word or phrase...'
                  : 'Type your identification answer...'
              }
              className="w-full px-4 py-3 rounded-xl border-2 border-[#D8D0BC] focus:border-[#1E5B3A] focus:outline-none text-base font-semibold disabled:opacity-60"
            />
          )}
          {feedback && (
            <p className="text-xs font-bold text-[#EA7A26] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {feedback}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full py-3 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Answer Locked...' : 'Elevate Platform'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* =========================================================
   4. GRAB IT (Quiz + Mystery Bonus Vaults — NPC-free)
   ========================================================= */
export const GrabItGame: React.FC<CommonGameProps> = ({
  questions,
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
  const [score, setScore] = useState(savedProgress?.score ?? 20);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [canOpenChest, setCanOpenChest] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [openedChestIdx, setOpenedChestIdx] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState('Answer correctly to unlock a Mystery Bonus Vault!');
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
      score: savedProgress.score ?? 20,
      correctCount: savedProgress.correctCount || 0,
      totalCount: questions.length,
      durationSeconds: 1,
    });
  }, [isAlreadyFinished, savedProgress, questions.length, onComplete]);

  const q = questions[idx];
  const displayOptions = useMemo(() => (q ? normalizeOptions(q) : []), [q]);
  const chestRewards = useMemo(() => shuffle([15, 25, 40]), [idx]);

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

  const advance = (finalScore: number, finalCorrect: number) => {
    if (idx + 1 >= questions.length) {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete({
        score: finalScore,
        correctCount: finalCorrect,
        totalCount: questions.length,
        durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
      });
    } else {
      setIdx((i) => i + 1);
      setCanOpenChest(false);
      setOpenedChestIdx(null);
      setResolving(false);
      setStatusMsg('Answer correctly to unlock a Mystery Bonus Vault!');
    }
  };

  const handlePick = (opt: string) => {
    if (canOpenChest || resolving || completedRef.current) return;
    const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();
    if (isRight) {
      soundFx.playCorrect();
      const nextCorrect = correctCount + 1;
      const nextScore = score + 25;
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      setCanOpenChest(true);
      setStatusMsg('Correct (+25 pts)! Pick a Mystery Bonus Vault below or Bank Safe!');
      // Forward-only lock at Q answered (with safe +15 minimum if reloaded before chest pick)
      onSaveProgress?.({
        idx: idx + 1,
        score: nextScore + 15,
        correctCount: nextCorrect,
      });
    } else {
      setResolving(true);
      soundFx.playWrong();
      setStatusMsg(`Answer Locked · Missed! Correct answer was ${q.answer}.`);
      onSaveProgress?.({
        idx: idx + 1,
        score,
        correctCount,
      });
      timeoutRef.current = window.setTimeout(() => advance(score, correctCount), 950);
    }
  };

  const handleOpenChest = (chestIndex: number) => {
    if (!canOpenChest || resolving || completedRef.current) return;
    setResolving(true);
    setOpenedChestIdx(chestIndex);
    soundFx.playLevelUp();
    const bonus = chestRewards[chestIndex] || 20;
    const nextScore = score + bonus;
    setScore(nextScore);
    setStatusMsg(`Vault opened! Grabbed +${bonus} bonus points!`);
    onSaveProgress?.({
      idx: idx + 1,
      score: nextScore,
      correctCount,
    });
    timeoutRef.current = window.setTimeout(() => advance(nextScore, correctCount), 750);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>
          Grab It · Question {idx + 1}/{questions.length}
        </span>
        <span className="text-[#1E5B3A] font-bold">Vault Points: {score}</span>
      </div>

      {/* 3 Mystery Bonus Vaults */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {chestRewards.map((rewardVal, cIdx) => {
          const isOpened = openedChestIdx === cIdx;
          return (
            <button
              key={cIdx}
              type="button"
              disabled={!canOpenChest || resolving}
              onClick={() => handleOpenChest(cIdx)}
              className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                isOpened
                  ? 'border-[#1E5B3A] bg-emerald-50'
                  : canOpenChest && !resolving
                    ? 'border-[#EA7A26] bg-[#FFF8F1] hover:scale-[1.02] cursor-pointer'
                    : 'border-[#E5DEC9] bg-[#FAF8F2] cursor-default'
              }`}
            >
              <div>
                <p className="text-sm font-bold text-[#172A1E]">
                  Bonus Vault #{cIdx + 1}
                </p>
                <p className="text-xs text-[#4D6354] tabular-nums">
                  {isOpened ? `Opened: +${rewardVal} pts` : 'Mystery Reward (+15 to +40)'}
                </p>
              </div>
              <span className="text-xs font-bold text-[#EA7A26] flex items-center gap-1">
                <Package className="w-4 h-4" />
                {canOpenChest && !resolving ? 'Grab!' : isOpened ? `+${rewardVal}` : 'Locked'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-6">
        <p className="text-xs font-semibold text-[#EA7A26] mb-2">{statusMsg}</p>
        <h3 className="text-lg font-bold text-[#172A1E] mb-4">{q.prompt}</h3>

        {!canOpenChest ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayOptions.map((opt, optIdx) => (
              <button
                key={`${opt}_${optIdx}`}
                type="button"
                disabled={resolving}
                onClick={() => handlePick(opt)}
                className="p-3.5 rounded-xl border border-[#E5DEC9] bg-[#FAF8F2] hover:border-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-left text-sm font-semibold text-[#172A1E] cursor-pointer transition-colors disabled:opacity-60"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            disabled={resolving}
            onClick={() => {
              setResolving(true);
              const safeScore = score + 15;
              setScore(safeScore);
              onSaveProgress?.({ idx: idx + 1, score: safeScore, correctCount });
              advance(safeScore, correctCount);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#1E5B3A] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Bank Safe (+15 pts) &amp; Next Question
          </button>
        )}
      </div>
    </div>
  );
};

/* =========================================================
   5. CATCH THE DUCK (Teacher Recitation Pond + Solo Mystery Pond — NPC-free)
   ========================================================= */
export const CatchTheDuckGame: React.FC<CommonGameProps> = ({
  questions,
  profile,
  allProfiles,
  savedProgress,
  onSaveProgress,
  onComplete,
  onAwardStudent,
}) => {
  const isTeacher = profile.role === 'teacher' || profile.role === 'admin';

  const studentsPool = useMemo(() => {
    if (!isTeacher) return [];
    const allStudents = allProfiles.filter((p) => p.role === 'student');
    const teacherSection = profile.section?.trim() || '';
    const sectionStudents = teacherSection
      ? allStudents.filter((p) => (p.section || '').trim() === teacherSection)
      : [];
    return sectionStudents.length > 0 ? sectionStudents : allStudents;
  }, [allProfiles, isTeacher, profile.section]);

  const initialCaughtCount = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, questions.length))
    : 0;

  const [ducks, setDucks] = useState(() => {
    if (isTeacher) {
      return shuffle(studentsPool)
        .slice(0, 6)
        .map((s, idx) => ({
          duckNumber: idx + 1,
          student: s as PublicProfile | null,
          label: s.displayName,
          caught: idx < initialCaughtCount,
        }));
    }
    const soloCount = Math.min(6, Math.max(1, questions.length));
    return Array.from({ length: soloCount }, (_, idx) => ({
      duckNumber: idx + 1,
      student: profile as PublicProfile | null,
      label: `Mystery Duck #${idx + 1}`,
      caught: idx < initialCaughtCount,
    }));
  });

  const [caughtDuckIdx, setCaughtDuckIdx] = useState<number | null>(null);
  const [questionIdx, setQuestionIdx] = useState(initialCaughtCount);
  const [roundPoints, setRoundPoints] = useState(savedProgress?.score || 0);
  const [correctCount, setCorrectCount] = useState(savedProgress?.correctCount || 0);
  const [teacherStatus, setTeacherStatus] = useState<string>('');
  const [soloPicked, setSoloPicked] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const isAlreadyFinished = Boolean(
    !isTeacher && savedProgress && ducks.length > 0 && initialCaughtCount >= ducks.length
  );

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
      totalCount: ducks.length,
      durationSeconds: 1,
      summaryNote: 'Caught all mystery ducks!',
    });
  }, [isAlreadyFinished, savedProgress, ducks.length, onComplete]);

  const activeQuestion = questions.length > 0 ? questions[questionIdx % questions.length] : null;
  const activeOptions = useMemo(
    () => (activeQuestion ? normalizeOptions(activeQuestion) : []),
    [activeQuestion]
  );

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked pond round...
      </div>
    );
  }

  if (!activeQuestion) {
    return <EmptyDeckNotice />;
  }

  if (isTeacher && ducks.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-2">
        <p className="text-sm font-bold text-[#172A1E]">
          No Real Students Enrolled in This Section Yet
        </p>
        <p className="text-xs text-[#4D6354]">
          Catch the Duck Recitation Host only picks from real enrolled SLA students in your classroom (no NPC bots). Once students join your section, click back to launch the pond.
        </p>
      </div>
    );
  }

  const handleCatchDuck = (idx: number) => {
    if (ducks[idx].caught || caughtDuckIdx !== null || resolving) return;
    soundFx.playQuack();
    setCaughtDuckIdx(idx);
    setSoloPicked(null);
    setTeacherStatus('');
  };

  const finalizeDuckResolution = async (isCorrect: boolean) => {
    if (caughtDuckIdx === null || completedRef.current) return;
    const picked = ducks[caughtDuckIdx];
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextPoints = isCorrect ? roundPoints + 50 : roundPoints;

    if (isCorrect) {
      soundFx.playCorrect();
      setCorrectCount(nextCorrect);
      setRoundPoints(nextPoints);
      if (isTeacher && onAwardStudent && picked.student) {
        await onAwardStudent(picked.student.uid, 50);
        setTeacherStatus(`Awarded +50 pts to ${picked.student.displayName}!`);
      } else if (!isTeacher) {
        setTeacherStatus('Nice catch! +50 pts');
      }
    } else {
      soundFx.playWrong();
      if (!isTeacher) {
        setTeacherStatus(`Answer Locked · Correct answer: ${activeQuestion.answer}`);
      }
    }

    const updated = ducks.map((d, i) => (i === caughtDuckIdx ? { ...d, caught: true } : d));
    const nextQuestionIdx = questionIdx + 1;
    setDucks(updated);
    setCaughtDuckIdx(null);
    setSoloPicked(null);
    setQuestionIdx(nextQuestionIdx);
    setResolving(false);

    onSaveProgress?.({
      idx: updated.filter((d) => d.caught).length,
      score: nextPoints,
      correctCount: nextCorrect,
    });

    if (updated.every((d) => d.caught)) {
      completedRef.current = true;
      onComplete({
        score: nextPoints,
        correctCount: nextCorrect,
        totalCount: updated.length,
        durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
        summaryNote: isTeacher ? 'Classroom Duck Recitation Finished!' : 'Caught all mystery ducks!',
      });
    }
  };

  const handleTeacherResolve = async (isCorrect: boolean) => {
    if (resolving || caughtDuckIdx === null) return;
    setResolving(true);
    try {
      await finalizeDuckResolution(isCorrect);
    } catch {
      setResolving(false);
    }
  };

  const handleSoloPick = (opt: string) => {
    if (resolving || caughtDuckIdx === null || soloPicked) return;
    setResolving(true);
    setSoloPicked(opt);
    const isCorrect = opt.trim().toUpperCase() === activeQuestion.answer.trim().toUpperCase();
    if (isCorrect) {
      soundFx.playCorrect();
    } else {
      soundFx.playWrong();
    }
    timeoutRef.current = window.setTimeout(() => {
      void finalizeDuckResolution(isCorrect);
    }, 850);
  };

  const caughtDuck = caughtDuckIdx !== null ? ducks[caughtDuckIdx] : null;
  const caughtStudent = caughtDuck?.student || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354]">
        <span>
          {isTeacher
            ? 'Teacher Recitation Host · Click a duck to pick a real student!'
            : 'Catch the Duck · Tap a swimming mystery duck to reveal your question!'}
        </span>
        <span className="text-[#1E5B3A] font-bold tabular-nums">Round Points: {roundPoints}</span>
      </div>

      {/* Pond */}
      <div className="bg-gradient-to-b from-sky-100 via-teal-100 to-emerald-100 rounded-3xl border border-teal-200 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {ducks.map((d, i) => (
            <button
              key={d.duckNumber}
              type="button"
              disabled={d.caught || caughtDuckIdx !== null}
              onClick={() => handleCatchDuck(i)}
              className={`p-4 rounded-2xl border-2 text-center transition-all ${
                d.caught
                  ? 'bg-white/40 border-teal-200 opacity-50 cursor-default'
                  : caughtDuckIdx === i
                  ? 'bg-[#FFF8F1] border-[#EA7A26] scale-105 cursor-pointer'
                  : 'bg-white/85 border-white hover:border-[#EA7A26] animate-duck-swim cursor-pointer'
              }`}
            >
              <svg width="56" height="56" viewBox="0 0 64 64" className="mx-auto" aria-hidden="true">
                <ellipse cx="32" cy="42" rx="18" ry="13" fill={d.caught ? '#CBD5E1' : '#FBBF24'} stroke="#2C2A24" strokeWidth="2.5" />
                <circle cx="38" cy="24" r="10" fill={d.caught ? '#CBD5E1' : '#FCD34D'} stroke="#2C2A24" strokeWidth="2.5" />
                <path d="M47 23 L56 26 L47 29 Z" fill="#EA7A26" stroke="#2C2A24" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="40" cy="22" r="2" fill="#2C2A24" />
              </svg>
              <p className="text-xs font-bold text-[#172A1E] mt-1">
                {d.caught ? (isTeacher ? d.label : `Caught #${d.duckNumber}`) : `Mystery Duck #${d.duckNumber}`}
              </p>
            </button>
          ))}
        </div>
      </div>

      {teacherStatus && (
        <p className="text-xs font-bold text-[#1E5B3A] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#EA7A26]" />
          {teacherStatus}
        </p>
      )}

      {/* Active Recitation Card */}
      {caughtDuck && caughtStudent && (
        <div className="bg-white rounded-2xl border-2 border-[#EA7A26] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#EA7A26]">
                {isTeacher ? 'Caught Student for Recitation' : `Mystery Duck #${caughtDuck.duckNumber}`}
              </p>
              <h4 className="text-xl font-extrabold text-[#172A1E]">
                {isTeacher ? caughtStudent.displayName : `${profile.displayName} (Solo Pond)`}
              </h4>
            </div>
            <PetAvatar
              species={caughtStudent.petSpecies}
              color={caughtStudent.petColor}
              outfit={caughtStudent.outfit}
              accessory={caughtStudent.accessory}
              size={60}
            />
          </div>

          <div className="p-4 rounded-xl bg-[#FAF8F2] border border-[#E5DEC9]">
            <p className="text-sm font-bold text-[#172A1E]">{activeQuestion.prompt}</p>
            {isTeacher && (
              <p className="text-xs text-[#1E5B3A] font-semibold mt-2">
                Answer Key: {activeQuestion.answer}
              </p>
            )}
          </div>

          {isTeacher ? (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={resolving}
                onClick={() => void handleTeacherResolve(true)}
                className="px-5 py-2.5 rounded-xl bg-[#1E5B3A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {resolving ? 'Recording...' : 'Correct Recitation (+50 pts)'}
              </button>
              <button
                type="button"
                disabled={resolving}
                onClick={() => void handleTeacherResolve(false)}
                className="px-5 py-2.5 rounded-xl border border-[#D8D0BC] text-[#4D6354] text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                Mark Pass / Next Duck
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeOptions.map((opt, optIdx) => {
                const isRight = opt.trim().toUpperCase() === activeQuestion.answer.trim().toUpperCase();
                const isMine = soloPicked === opt;
                return (
                  <button
                    key={`${opt}_${optIdx}`}
                    type="button"
                    disabled={resolving || Boolean(soloPicked)}
                    onClick={() => handleSoloPick(opt)}
                    className={`p-3 rounded-xl border text-left text-sm font-semibold transition-colors ${
                      soloPicked
                        ? isRight
                          ? 'bg-[#1E5B3A] text-white border-[#1E5B3A] cursor-default'
                          : isMine
                          ? 'bg-red-50 text-red-700 border-red-300 cursor-default'
                          : 'bg-[#FAF8F2] text-[#94A398] border-[#E5DEC9] cursor-default'
                        : 'border-[#E5DEC9] bg-[#FAF8F2] hover:border-[#1E5B3A] text-[#172A1E] cursor-pointer'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
