import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Lightbulb, RotateCcw, Trash2 } from 'lucide-react';
import { PublicProfile, QuizQuestion } from '../../types';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';
import { getCluePanelsForQuestion } from '../../lib/questionUtils';
import { GameSessionResult } from './SignatureGames';

interface FourPicsOneWordGameProps {
  questions: QuizQuestion[];
  profile: PublicProfile;
  onComplete: (result: GameSessionResult) => void;
}

function shuffleArr<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function resolveTargetWord(q: QuizQuestion | undefined): string {
  if (!q) return '';
  const candidate =
    q.questionType === 'enumeration' && q.enumerationItems && q.enumerationItems.length > 0
      ? q.enumerationItems[0]
      : q.answer;
  const cleaned = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 14) return cleaned;
  const firstToken = candidate.trim().split(/[\s,]+/)[0] || '';
  return firstToken.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
}

export const FourPicsOneWordGame: React.FC<FourPicsOneWordGameProps> = ({
  questions,
  profile,
  onComplete,
}) => {
  const playableQuestions = useMemo(() => {
    const ordered = [
      ...questions.filter((q) => q.questionType === 'four_pics' || (q.cluePanels && q.cluePanels.length >= 4)),
      ...questions.filter((q) => q.questionType !== 'four_pics' && (!q.cluePanels || q.cluePanels.length < 4)),
    ];
    return ordered.filter((q) => resolveTargetWord(q).length >= 2);
  }, [questions]);

  const [idx, setIdx] = useState(0);
  const [selectedTileIndices, setSelectedTileIndices] = useState<(number | null)[]>([]);
  const [revealedSlotIndices, setRevealedSlotIndices] = useState<number[]>([]);
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

  const q = playableQuestions[idx];
  const targetWord = useMemo(() => resolveTargetWord(q), [q]);
  const cluePanels = useMemo(() => (q ? getCluePanelsForQuestion(q) : []), [q]);

  const letterTiles = useMemo(() => {
    if (!targetWord) return [];
    const chars = targetWord.split('');
    const isNumeric = /^\d+$/.test(targetWord);
    const pool = isNumeric ? '0123456789' : 'AEIOURSTLNMDPCBG';
    const decoyCount = Math.max(3, Math.min(6, 14 - chars.length));
    const decoys = shuffleArr(pool.split('')).slice(0, decoyCount);
    return shuffleArr([...chars, ...decoys].map((char, i) => ({ id: i, char })));
  }, [targetWord, idx]);

  useEffect(() => {
    if (!targetWord) return;
    setSelectedTileIndices(Array(targetWord.length).fill(null));
    setRevealedSlotIndices([]);
    setShowHint(false);
  }, [targetWord, idx]);

  const activeSlots = selectedTileIndices.length === targetWord.length
    ? selectedTileIndices
    : Array<number | null>(targetWord.length).fill(null);

  const builtWord = activeSlots
    .map((tileIdx, slotIdx) => {
      if (tileIdx !== null && tileIdx !== undefined) {
        return letterTiles[tileIdx]?.char || '';
      }
      if (revealedSlotIndices.includes(slotIdx)) {
        return targetWord[slotIdx] || '';
      }
      return '';
    })
    .join('');

  const isAllFilled = activeSlots.every(
    (tileIdx, slotIdx) => tileIdx !== null || revealedSlotIndices.includes(slotIdx)
  );

  const usedTileSet = useMemo(
    () => new Set(activeSlots.filter((v): v is number => v !== null)),
    [activeSlots]
  );

  const handlePickTile = useCallback(
    (tileIdx: number) => {
      if (feedback !== 'idle' || usedTileSet.has(tileIdx)) return;
      const openSlot = activeSlots.findIndex(
        (val, slotIdx) => val === null && !revealedSlotIndices.includes(slotIdx)
      );
      if (openSlot === -1) return;
      soundFx.playClick();
      setSelectedTileIndices((prev) => {
        const next = prev.length === targetWord.length ? [...prev] : Array(targetWord.length).fill(null);
        next[openSlot] = tileIdx;
        return next;
      });
    },
    [feedback, usedTileSet, activeSlots, revealedSlotIndices, targetWord.length]
  );

  const handleClearSlot = useCallback(
    (slotIdx: number) => {
      if (feedback !== 'idle' || revealedSlotIndices.includes(slotIdx)) return;
      if (activeSlots[slotIdx] === null) return;
      soundFx.playClick();
      setSelectedTileIndices((prev) => {
        const next = [...prev];
        next[slotIdx] = null;
        return next;
      });
    },
    [feedback, revealedSlotIndices, activeSlots]
  );

  const handleRemoveLast = useCallback(() => {
    if (feedback !== 'idle') return;
    for (let i = activeSlots.length - 1; i >= 0; i--) {
      if (activeSlots[i] !== null && !revealedSlotIndices.includes(i)) {
        soundFx.playClick();
        setSelectedTileIndices((prev) => {
          const next = [...prev];
          next[i] = null;
          return next;
        });
        return;
      }
    }
  }, [feedback, activeSlots, revealedSlotIndices]);

  const handleClearAll = useCallback(() => {
    if (feedback !== 'idle') return;
    soundFx.playClick();
    setSelectedTileIndices(Array(targetWord.length).fill(null));
  }, [feedback, targetWord.length]);

  const handleRevealOneLetter = useCallback(() => {
    if (feedback !== 'idle' || !targetWord) return;
    const unrevealedIdx = targetWord
      .split('')
      .findIndex((_, slotIdx) => !revealedSlotIndices.includes(slotIdx));
    if (unrevealedIdx === -1) return;
    soundFx.playClick();
    setRevealedSlotIndices((prev) => [...prev, unrevealedIdx]);
    setSelectedTileIndices((prev) => {
      const next = prev.length === targetWord.length ? [...prev] : Array(targetWord.length).fill(null);
      next[unrevealedIdx] = null;
      return next;
    });
  }, [feedback, targetWord, revealedSlotIndices]);

  const handleSubmit = useCallback(() => {
    if (feedback !== 'idle' || !q || !isAllFilled || completedRef.current) return;
    const isRight = builtWord === targetWord;
    const penalty = (showHint ? 5 : 0) + Math.min(15, revealedSlotIndices.length * 5);
    const earned = Math.max(15, 40 - penalty);
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + earned : score;

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
          summaryNote: `Solved ${nextCorrect} of ${playableQuestions.length} 4 Pics 1 Word puzzles!`,
        });
      } else {
        setIdx((i) => i + 1);
        setFeedback('idle');
      }
    }, 950);
  }, [
    feedback,
    q,
    isAllFilled,
    builtWord,
    targetWord,
    showHint,
    revealedSlotIndices.length,
    correctCount,
    score,
    idx,
    playableQuestions.length,
    onComplete,
    startTime,
  ]);

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
          (tile, i) => tile.char === ch && !usedTileSet.has(i)
        );
        if (availableIdx !== -1) {
          handlePickTile(availableIdx);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, feedback, letterTiles, usedTileSet, handlePickTile, handleRemoveLast, handleSubmit]);

  if (!q || !targetWord) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm text-[#4D6354]">
        This deck does not have single-word concepts ready for 4 Pics 1 Word yet. Choose another deck or add 4 Pics 1 Word questions!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unboxed Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#4D6354] tabular-nums">
        <span>
          4 Pics 1 Word · Puzzle {idx + 1} of {playableQuestions.length}
          {q.category ? ` · ${q.category}` : ''}
        </span>
        <span className="text-[#1E5B3A] font-bold">Score: {score} pts</span>
      </div>

      {/* Two-Zone Puzzle Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Zone: 2x2 Visual Clue Panels */}
        <div className="lg:col-span-6 bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-4">
          <div className="grid grid-cols-2 gap-3">
            {cluePanels.map((panel, pIdx) => (
              <div
                key={pIdx}
                className="relative aspect-square rounded-2xl border border-[#D8D0BC] bg-white overflow-hidden flex flex-col items-center justify-center p-3 text-center shadow-xs"
              >
                <span className="absolute top-2 left-2.5 text-[11px] font-bold text-[#4D6354] tabular-nums">
                  #{pIdx + 1}
                </span>
                {panel.imageUrl ? (
                  <>
                    <img
                      src={panel.imageUrl}
                      alt={panel.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <span className="absolute inset-x-2 bottom-2 bg-[#172A1E]/80 text-white text-[11px] font-semibold px-2 py-1 rounded-lg truncate">
                      {panel.label}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 px-1">
                    <div className="w-16 h-16 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex items-center justify-center text-4xl select-none">
                      {panel.emoji || '🔍'}
                    </div>
                    <p className="text-xs font-bold text-[#172A1E] leading-snug line-clamp-2">
                      {panel.label}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Zone: Prompt Clue, Answer Slots & Letter Tray */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-5">
            <p className="text-xs font-bold text-[#EA7A26] mb-1">Find the 1 Connecting Word</p>
            <h3 className="text-base font-bold text-[#172A1E] leading-snug">
              {q.prompt}
            </h3>
            {showHint && (
              <p className="text-xs font-semibold text-[#1E5B3A] mt-2.5">
                Clue Hint: {q.hint}
              </p>
            )}
          </div>

          {/* Target Word Answer Slots */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {targetWord.split('').map((expectedChar, slotIdx) => {
              const isRevealed = revealedSlotIndices.includes(slotIdx);
              const tileIdx = activeSlots[slotIdx];
              const ch = isRevealed
                ? expectedChar
                : tileIdx !== null && tileIdx !== undefined
                  ? letterTiles[tileIdx]?.char || ''
                  : '';
              return (
                <button
                  key={slotIdx}
                  type="button"
                  disabled={isRevealed || feedback !== 'idle'}
                  onClick={() => handleClearSlot(slotIdx)}
                  className={`w-11 h-12 rounded-xl border-2 text-lg font-extrabold flex items-center justify-center transition-colors ${
                    feedback === 'correct'
                      ? 'border-[#2E7D32] bg-emerald-50 text-[#1E5B3A]'
                      : feedback === 'wrong'
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : isRevealed
                          ? 'border-[#EA7A26] bg-[#FFF8F1] text-[#C65B10] cursor-default'
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

          {/* Interactive Letter Tile Tray */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {letterTiles.map((tile, tIdx) => {
              const used = usedTileSet.has(tIdx);
              return (
                <button
                  key={tile.id}
                  type="button"
                  disabled={used || feedback !== 'idle'}
                  onClick={() => handlePickTile(tIdx)}
                  className={`w-11 h-11 rounded-xl font-extrabold text-base border-2 transition-transform ${
                    used
                      ? 'opacity-25 border-[#E5DEC9] bg-[#FAF8F2] scale-95 cursor-default'
                      : 'border-[#EA7A26] bg-[#FFF8F1] text-[#C65B10] hover:scale-105 active:scale-95 cursor-pointer'
                  }`}
                >
                  {tile.char}
                </button>
              );
            })}
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#ECE7D8]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={feedback !== 'idle' || showHint}
                onClick={() => {
                  soundFx.playClick();
                  setShowHint(true);
                }}
                className="px-3 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Hint
              </button>
              <button
                type="button"
                disabled={feedback !== 'idle' || revealedSlotIndices.length >= Math.max(1, targetWord.length - 1)}
                onClick={handleRevealOneLetter}
                className="px-3 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Lightbulb className="w-3.5 h-3.5 text-[#EA7A26]" />
                Reveal Letter
              </button>
              <button
                type="button"
                disabled={feedback !== 'idle'}
                onClick={handleClearAll}
                className="px-3 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
              <button
                type="button"
                disabled={feedback !== 'idle'}
                onClick={handleRemoveLast}
                className="px-3 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
            </div>

            <button
              type="button"
              disabled={feedback !== 'idle' || !isAllFilled}
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Check Word
            </button>
          </div>

          {/* Pet Companion Reaction */}
          <div className="flex items-center gap-3 pt-1">
            <PetAvatar
              species={profile.petSpecies}
              color={profile.petColor}
              outfit={profile.outfit}
              accessory={profile.accessory}
              role={profile.role}
              size={52}
            />
            <span className="text-xs font-medium text-[#4D6354]">
              {feedback === 'correct'
                ? 'Spot on! Those 4 clues all pointed right to it!'
                : feedback === 'wrong'
                  ? `The hidden word was ${targetWord}.`
                  : `Look at all 4 visual clues or type the ${targetWord.length}-character word on your keyboard.`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
