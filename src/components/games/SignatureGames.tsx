import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Flag,
  HelpCircle,
  RotateCcw,
  Swords,
  ArrowUp,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PublicProfile, QuizQuestion } from '../../types';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';

export interface GameSessionResult {
  score: number;
  correctCount: number;
  totalCount: number;
  durationSeconds: number;
  summaryNote?: string;
}

interface CommonGameProps {
  questions: QuizQuestion[];
  profile: PublicProfile;
  allProfiles: PublicProfile[];
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
export const LorenscapeGame: React.FC<CommonGameProps> = ({ questions, profile, onComplete }) => {
  const [idx, setIdx] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const q = questions[idx];
  const targetClean = useMemo(
    () => (q?.answer || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    [q?.answer]
  );

  const letterTiles = useMemo(() => {
    if (!targetClean) return [];
    const chars = targetClean.split('');
    const isNumericOnly = /^\d+$/.test(targetClean);
    const pool = isNumericOnly ? '0123456789' : 'AEIOURSTLNM';
    const decoys = shuffle(pool.split('').filter((c) => !chars.includes(c))).slice(0, 3);
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
    idx,
    questions.length,
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

  if (!q || !targetClean) {
    return <EmptyDeckNotice />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>Question {idx + 1} of {questions.length}</span>
        <span className="text-[#1E5B3A]">Score: {score} pts</span>
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
              onClick={() => {
                if (tileIdx !== undefined && feedback === 'idle') {
                  soundFx.playClick();
                  setSelectedIndices((prev) => prev.filter((_, i) => i !== slotIdx));
                }
              }}
              className={`w-11 h-12 rounded-xl border-2 text-lg font-extrabold flex items-center justify-center transition-colors cursor-pointer ${
                feedback === 'correct'
                  ? 'border-[#2E7D32] bg-emerald-50 text-[#1E5B3A]'
                  : feedback === 'wrong'
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : ch
                  ? 'border-[#1E5B3A] bg-white text-[#172A1E]'
                  : 'border-dashed border-[#D4CCB5] bg-[#FAF8F2] text-[#94A398]'
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>

      {/* Given Letter Tray */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md mx-auto">
        {letterTiles.map((tile, tIdx) => {
          const used = selectedIndices.includes(tIdx);
          return (
            <button
              key={tile.id}
              type="button"
              disabled={used || feedback !== 'idle'}
              onClick={() => handlePickTile(tIdx)}
              className={`w-12 h-12 rounded-full font-extrabold text-base border-2 transition-transform cursor-pointer ${
                used
                  ? 'opacity-25 border-[#E5DEC9] bg-[#FAF8F2] scale-95 cursor-default'
                  : 'border-[#EA7A26] bg-[#FFF8F1] text-[#C65B10] hover:scale-105 active:scale-95'
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
          <span className="text-xs text-[#4D6354]">
            {feedback === 'correct'
              ? 'Spot on! Keep going!'
              : feedback === 'wrong'
              ? `Answer was ${targetClean}`
              : 'Tap or type the letters to build the answer.'}
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
   2. ON THE RUN (Student / Duck Race to Finish Line)
   ========================================================= */
export const OnTheRunGame: React.FC<CommonGameProps> = ({
  questions,
  profile,
  allProfiles,
  onComplete,
}) => {
  const [idx, setIdx] = useState(0);
  const [playerPos, setPlayerPos] = useState(0);
  const [rivals, setRivals] = useState(() => {
    const peers = allProfiles
      .filter((p) => p.uid !== profile.uid)
      .slice(0, 3);
    const defaults = [
      { id: 'r1', name: 'Mika', species: 'bunny' as const, color: '#FBF7F0', pos: 8 },
      { id: 'r2', name: 'Jules', species: 'dog' as const, color: '#E5AE74', pos: 6 },
      { id: 'r3', name: 'Tala', species: 'turtle' as const, color: '#76B964', pos: 5 },
    ];
    return defaults.map((d, i) =>
      peers[i]
        ? {
            id: peers[i].uid,
            name: peers[i].displayName.split(' ')[0],
            species: peers[i].petSpecies,
            color: peers[i].petColor,
            pos: 5,
          }
        : d
    );
  });

  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lockedChoice, setLockedChoice] = useState<string | null>(null);
  const [startTime] = useState(() => Date.now());

  const rivalsRef = useRef(rivals);
  rivalsRef.current = rivals;
  const completedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const q = questions[idx];
  const displayOptions = useMemo(() => (q ? normalizeOptions(q) : []), [q]);
  const stepGain = Math.ceil(100 / Math.max(3, questions.length));

  // Gentle rival pacing every 3.5 seconds while race is active
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (completedRef.current) return;
      setRivals((prev) =>
        prev.map((r) => ({
          ...r,
          pos: Math.min(96, r.pos + Math.floor(Math.random() * 7) + 2),
        }))
      );
    }, 3500);
    return () => window.clearInterval(timer);
  }, []);

  if (!q) {
    return <EmptyDeckNotice />;
  }

  const handleAnswer = (opt: string) => {
    if (lockedChoice || completedRef.current) return;
    setLockedChoice(opt);
    const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();

    const nextPos = isRight ? Math.min(100, playerPos + stepGain) : playerPos;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + 35 : score;

    if (isRight) {
      soundFx.playCorrect();
      setPlayerPos(nextPos);
      setCorrectCount(nextCorrect);
      setScore(nextScore);
    } else {
      soundFx.playWrong();
      setRivals((prev) =>
        prev.map((r, i) => (i === 0 ? { ...r, pos: Math.min(98, r.pos + 8) } : r))
      );
    }

    timeoutRef.current = window.setTimeout(() => {
      if (nextPos >= 100 || idx + 1 >= questions.length) {
        if (completedRef.current) return;
        completedRef.current = true;
        const won = nextPos >= Math.max(...rivalsRef.current.map((r) => r.pos));
        onComplete({
          score: nextScore + (won ? 40 : 0),
          correctCount: nextCorrect,
          totalCount: idx + 1,
          durationSeconds: Math.max(1, Math.round((Date.now() - startTime) / 1000)),
          summaryNote: won ? '1st Place Finish Line Winner!' : 'Completed the SLA Race Track!',
        });
      } else {
        setIdx((i) => i + 1);
        setLockedChoice(null);
      }
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>On the Run · Question {idx + 1}/{questions.length}</span>
        <span className="text-[#1E5B3A]">Race Score: {score} pts</span>
      </div>

      {/* Race Track Arena */}
      <div className="bg-[#EAF4EA] rounded-2xl border border-[#CFE4CF] p-4 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs font-bold text-[#1E5B3A] mb-1">
          <span>START</span>
          <span className="flex items-center gap-1 text-[#EA7A26]">
            <Flag className="w-3.5 h-3.5" /> FINISH LINE
          </span>
        </div>

        {/* Player Lane */}
        <div className="relative h-12 bg-white/90 rounded-xl border border-[#1E5B3A]/30 flex items-center px-3">
          <span className="text-xs font-bold text-[#1E5B3A] z-10">{profile.displayName.split(' ')[0]} (You)</span>
          <div
            className="absolute top-1 transition-all duration-500 animate-runner-hop"
            style={{ left: `calc(${Math.min(88, playerPos)}%)` }}
          >
            <PetAvatar
              species={profile.petSpecies}
              color={profile.petColor}
              outfit={profile.outfit}
              accessory={profile.accessory}
              role={profile.role}
              size={40}
            />
          </div>
        </div>

        {/* Rival Lanes */}
        {rivals.map((rival) => (
          <div key={rival.id} className="relative h-10 bg-white/70 rounded-xl border border-[#D8E2D8] flex items-center px-3">
            <span className="text-xs font-medium text-[#4D6354] z-10">{rival.name}</span>
            <div
              className="absolute top-0.5 transition-all duration-700"
              style={{ left: `calc(${Math.min(88, rival.pos)}%)` }}
            >
              <PetAvatar
                species={rival.species}
                color={rival.color}
                outfit="outfit_sla_polo"
                accessory="none"
                size={36}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Question & Fast Answer Choices */}
      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-5">
        <h3 className="text-lg font-bold text-[#172A1E] mb-4">{q.prompt}</h3>
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
                className={`p-3.5 rounded-xl border text-left text-sm font-semibold transition-colors cursor-pointer ${
                  lockedChoice
                    ? isRight
                      ? 'bg-[#1E5B3A] text-white border-[#1E5B3A]'
                      : isPicked
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-[#FAF8F2] text-[#94A398] border-[#E5DEC9]'
                    : 'bg-[#FAF8F2] hover:bg-[#EA7A26]/10 hover:border-[#EA7A26] border-[#E5DEC9] text-[#172A1E]'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   3. BRAINZONE (Identification + Rising Platform + Timer)
   ========================================================= */
export const BrainzoneGame: React.FC<CommonGameProps> = ({ questions, profile, onComplete }) => {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [platformLevel, setPlatformLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
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

  // Single stable 1-second countdown interval (never resets on question advance)
  useEffect(() => {
    if (questions.length === 0) return;
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
  }, [questions.length]);

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
  if (!q) {
    return <EmptyDeckNotice />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || completedRef.current || !typed.trim()) return;
    setSubmitting(true);

    const normalizedGuess = typed.replace(/\s+/g, ' ').trim().toUpperCase();
    const normalizedAns = q.answer.replace(/\s+/g, ' ').trim().toUpperCase();
    const isRight = normalizedGuess === normalizedAns;

    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + 40 : score;
    const nextLevel = isRight ? platformLevel + 1 : platformLevel;
    const nextAnswered = answeredCount + 1;
    setAnsweredCount(nextAnswered);

    if (isRight) {
      soundFx.playCorrect();
      setPlatformLevel(nextLevel);
      setCorrectCount(nextCorrect);
      setScore(nextScore);
      setFeedback('Platform elevated! +40 pts');
    } else {
      soundFx.playWrong();
      setFeedback(`Correct answer: ${q.answer}`);
    }

    setTyped('');
    timeoutRef.current = window.setTimeout(() => {
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
    }, 850);
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
          <span className={`flex items-center gap-1 tabular-nums ${timeLeft <= 10 ? 'text-red-600' : 'text-[#C65B10]'}`}>
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

      {/* Identification Input */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E5DEC9] p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-[#4D6354] mb-3 tabular-nums">
            <span>Identification {idx + 1} of {questions.length}</span>
            <span className="font-bold text-[#1E5B3A]">Score: {score}</span>
          </div>
          <h3 className="text-xl font-bold text-[#172A1E] mb-2">{q.prompt}</h3>
          <p className="text-xs text-[#4D6354]">Hint: {q.hint}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="text"
            autoFocus
            disabled={submitting}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your identification answer..."
            className="w-full px-4 py-3 rounded-xl border-2 border-[#D8D0BC] focus:border-[#1E5B3A] focus:outline-none text-base font-semibold disabled:opacity-60"
          />
          {feedback && (
            <p className="text-xs font-bold text-[#EA7A26]">{feedback}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !typed.trim()}
            className="w-full py-3 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Checking Answer...' : 'Elevate Platform'}
          </button>
        </form>
      </div>
    </div>
  );
};

/* =========================================================
   4. GRAB IT (Quiz + Steal Points from Classmates)
   ========================================================= */
export const GrabItGame: React.FC<CommonGameProps> = ({
  questions,
  profile,
  allProfiles,
  onComplete,
}) => {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(40);
  const [correctCount, setCorrectCount] = useState(0);
  const [canSteal, setCanSteal] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [rivals, setRivals] = useState(() => {
    const peers = allProfiles.filter((p) => p.uid !== profile.uid).slice(0, 3);
    const fallback = [
      { id: 'g1', name: 'Carlos', points: 90 },
      { id: 'g2', name: 'Bea', points: 75 },
      { id: 'g3', name: 'Nico', points: 60 },
    ];
    return fallback.map((f, i) =>
      peers[i] ? { id: peers[i].uid, name: peers[i].displayName.split(' ')[0], points: 80 + i * 15 } : f
    );
  });
  const [statusMsg, setStatusMsg] = useState('Answer correctly to bank points or steal from a rival!');
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const q = questions[idx];
  const displayOptions = useMemo(() => (q ? normalizeOptions(q) : []), [q]);

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
      setCanSteal(false);
      setResolving(false);
      setStatusMsg('Answer correctly to bank points or steal from a rival!');
    }
  };

  const handlePick = (opt: string) => {
    if (canSteal || resolving || completedRef.current) return;
    const isRight = opt.trim().toUpperCase() === q.answer.trim().toUpperCase();
    if (isRight) {
      soundFx.playCorrect();
      setCorrectCount((c) => c + 1);
      setScore((s) => s + 25);
      setCanSteal(true);
      setStatusMsg('Correct! Choose a player below to GRAB +25 points, or skip to Bank!');
    } else {
      setResolving(true);
      soundFx.playWrong();
      setStatusMsg(`Missed! Correct answer was ${q.answer}.`);
      timeoutRef.current = window.setTimeout(() => advance(score, correctCount), 900);
    }
  };

  const handleSteal = (rivalId: string) => {
    if (!canSteal || resolving || completedRef.current) return;
    setResolving(true);
    soundFx.playLevelUp();
    setRivals((prev) =>
      prev.map((r) => (r.id === rivalId ? { ...r, points: Math.max(0, r.points - 25) } : r))
    );
    const nextScore = score + 25;
    setScore(nextScore);
    setStatusMsg('Grabbed +25 points!');
    timeoutRef.current = window.setTimeout(() => advance(nextScore, correctCount), 650);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>Grab It · Question {idx + 1}/{questions.length}</span>
        <span className="text-[#1E5B3A] font-bold">Your Round Points: {score}</span>
      </div>

      {/* Rival Scoreboard for Point Stealing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rivals.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={!canSteal || resolving}
            onClick={() => handleSteal(r.id)}
            className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
              canSteal && !resolving
                ? 'border-[#EA7A26] bg-[#FFF8F1] hover:scale-[1.02] cursor-pointer'
                : 'border-[#E5DEC9] bg-[#FAF8F2] cursor-default'
            }`}
          >
            <div>
              <p className="text-sm font-bold text-[#172A1E]">{r.name}</p>
              <p className="text-xs text-[#4D6354] tabular-nums">{r.points} pts</p>
            </div>
            {canSteal && !resolving && (
              <span className="text-xs font-bold text-[#EA7A26] flex items-center gap-1">
                <Swords className="w-4 h-4" /> Grab 25
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5DEC9] p-6">
        <p className="text-xs font-semibold text-[#EA7A26] mb-2">{statusMsg}</p>
        <h3 className="text-lg font-bold text-[#172A1E] mb-4">{q.prompt}</h3>

        {!canSteal ? (
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
            onClick={() => advance(score, correctCount)}
            className="px-5 py-2.5 rounded-xl bg-[#1E5B3A] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            Skip Steal &amp; Next Question
          </button>
        )}
      </div>
    </div>
  );
};

/* =========================================================
   5. CATCH THE DUCK (Teacher Recitation Pond + Solo Mode)
   ========================================================= */
export const CatchTheDuckGame: React.FC<CommonGameProps> = ({
  questions,
  profile,
  allProfiles,
  onComplete,
  onAwardStudent,
}) => {
  const studentsPool = useMemo(() => {
    const allStudents = allProfiles.filter((p) => p.role === 'student');
    const teacherSection = profile.role === 'teacher' ? profile.section?.trim() : '';
    const sectionStudents = teacherSection
      ? allStudents.filter((p) => (p.section || '').trim() === teacherSection)
      : [];
    const list = sectionStudents.length >= 2 ? sectionStudents : allStudents;
    if (list.length >= 2) return list;
    return [
      profile,
      ...['Andrea', 'Miguel', 'Sophia', 'Rafael'].map((n, i) => ({
        ...profile,
        uid: `demo_duck_${i}`,
        displayName: n,
        petName: `Duckling ${i + 1}`,
      })),
    ];
  }, [allProfiles, profile]);

  const [ducks, setDucks] = useState(() =>
    shuffle(studentsPool).slice(0, 6).map((s, idx) => ({
      duckNumber: idx + 1,
      student: s,
      caught: false,
    }))
  );

  const [caughtDuckIdx, setCaughtDuckIdx] = useState<number | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [roundPoints, setRoundPoints] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [teacherStatus, setTeacherStatus] = useState<string>('');
  const [soloPicked, setSoloPicked] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [startTime] = useState(() => Date.now());
  const timeoutRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const activeQuestion = questions.length > 0 ? questions[questionIdx % questions.length] : null;
  const activeOptions = useMemo(
    () => (activeQuestion ? normalizeOptions(activeQuestion) : []),
    [activeQuestion]
  );
  const isTeacher = profile.role === 'teacher' || profile.role === 'admin';

  if (!activeQuestion) {
    return <EmptyDeckNotice />;
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
      if (isTeacher && onAwardStudent && !picked.student.uid.startsWith('demo_duck_')) {
        await onAwardStudent(picked.student.uid, 50);
        setTeacherStatus(`Awarded +50 pts to ${picked.student.displayName}!`);
      }
    } else {
      soundFx.playWrong();
      if (!isTeacher) {
        setTeacherStatus(`Answer was: ${activeQuestion.answer}`);
      }
    }

    const updated = ducks.map((d, i) => (i === caughtDuckIdx ? { ...d, caught: true } : d));
    setDucks(updated);
    setCaughtDuckIdx(null);
    setSoloPicked(null);
    setQuestionIdx((q) => q + 1);
    setResolving(false);

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
    }, 700);
  };

  const caughtStudent = caughtDuckIdx !== null ? ducks[caughtDuckIdx].student : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-[#4D6354]">
        <span>
          {isTeacher
            ? 'Teacher Recitation Host · Click an unknown duck to pick a student!'
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
              className={`p-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                d.caught
                  ? 'bg-white/40 border-teal-200 opacity-50 cursor-default'
                  : caughtDuckIdx === i
                  ? 'bg-[#FFF8F1] border-[#EA7A26] scale-105'
                  : 'bg-white/85 border-white hover:border-[#EA7A26] animate-duck-swim'
              }`}
            >
              <svg width="56" height="56" viewBox="0 0 64 64" className="mx-auto" aria-hidden="true">
                <ellipse cx="32" cy="42" rx="18" ry="13" fill={d.caught ? '#CBD5E1' : '#FBBF24'} stroke="#2C2A24" strokeWidth="2.5" />
                <circle cx="38" cy="24" r="10" fill={d.caught ? '#CBD5E1' : '#FCD34D'} stroke="#2C2A24" strokeWidth="2.5" />
                <path d="M47 23 L56 26 L47 29 Z" fill="#EA7A26" stroke="#2C2A24" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="40" cy="22" r="2" fill="#2C2A24" />
              </svg>
              <p className="text-xs font-bold text-[#172A1E] mt-1">
                {d.caught ? d.student.displayName : `Mystery Duck #${d.duckNumber}`}
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
      {caughtStudent && (
        <div className="bg-white rounded-2xl border-2 border-[#EA7A26] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#EA7A26]">Caught Student for Recitation</p>
              <h4 className="text-xl font-extrabold text-[#172A1E]">{caughtStudent.displayName}</h4>
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
                    className={`p-3 rounded-xl border text-left text-sm font-semibold cursor-pointer transition-colors ${
                      soloPicked
                        ? isRight
                          ? 'bg-[#1E5B3A] text-white border-[#1E5B3A]'
                          : isMine
                          ? 'bg-red-50 text-red-700 border-red-300'
                          : 'bg-[#FAF8F2] text-[#94A398] border-[#E5DEC9]'
                        : 'border-[#E5DEC9] bg-[#FAF8F2] hover:border-[#1E5B3A] text-[#172A1E]'
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
