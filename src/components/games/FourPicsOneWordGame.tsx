import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Lightbulb, Lock, RotateCcw, Trash2, X, ZoomIn } from 'lucide-react';
import { CluePanel, PublicProfile, QuizQuestion } from '../../types';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';
import { getCluePanelsForQuestion } from '../../lib/questionUtils';
import { ClueSceneArtwork } from './ClueSceneArtwork';
import { GameRoundProgress, GameSessionResult } from './SignatureGames';

interface FourPicsOneWordGameProps {
  questions: QuizQuestion[];
  profile: PublicProfile;
  savedProgress?: GameRoundProgress | null;
  onSaveProgress?: (progress: GameRoundProgress) => void;
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
  if (cleaned.length <= 16) return cleaned;
  const firstToken = candidate.trim().split(/[\s,]+/)[0] || '';
  return firstToken.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export const FourPicsOneWordGame: React.FC<FourPicsOneWordGameProps> = ({
  questions,
  profile,
  savedProgress,
  onSaveProgress,
  onComplete,
}) => {
  const playableQuestions = useMemo(() => {
    const ordered = [
      ...questions.filter(
        (q) => q.questionType === 'four_pics' || (q.cluePanels && q.cluePanels.length >= 4)
      ),
      ...questions.filter(
        (q) => q.questionType !== 'four_pics' && (!q.cluePanels || q.cluePanels.length < 4)
      ),
    ];
    return ordered.filter((q) => resolveTargetWord(q).length >= 2);
  }, [questions]);

  const isAlreadyFinished = Boolean(
    savedProgress && playableQuestions.length > 0 && savedProgress.idx >= playableQuestions.length
  );

  const initialIdx = savedProgress
    ? Math.min(Math.max(0, savedProgress.idx), Math.max(0, playableQuestions.length - 1))
    : 0;

  const [idx, setIdx] = useState(initialIdx);
  const [selectedTileIndices, setSelectedTileIndices] = useState<(number | null)[]>([]);
  const [revealedSlotIndices, setRevealedSlotIndices] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [zoomedPanel, setZoomedPanel] = useState<{ panel: CluePanel; index: number } | null>(null);
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
      summaryNote: `Solved ${savedProgress.correctCount || 0} of ${playableQuestions.length} Hard Visual Clue puzzles!`,
    });
  }, [isAlreadyFinished, savedProgress, playableQuestions.length, onComplete]);

  const q = playableQuestions[idx];
  const targetWord = useMemo(() => resolveTargetWord(q), [q]);
  const cluePanels = useMemo(() => (q ? getCluePanelsForQuestion(q) : []), [q]);
  const maxReveals = Math.min(2, Math.max(1, targetWord.length - 2));

  // Hard Mode: 16–18 tile keyboard tray with tricky high-frequency decoys
  const letterTiles = useMemo(() => {
    if (!targetWord) return [];
    const chars = targetWord.split('');
    const isNumeric = /^\d+$/.test(targetWord);
    const pool = isNumeric ? '0123456789' : 'AEIOURSTLNMDPCBGHYK';
    const traySize = Math.min(18, Math.max(16, chars.length + 5));
    const decoyCount = Math.max(4, traySize - chars.length);
    const decoys: string[] = [];
    const shuffledPool = shuffleArr(pool.split(''));
    for (let i = 0; i < decoyCount; i++) {
      decoys.push(shuffledPool[i % shuffledPool.length]);
    }
    return shuffleArr([...chars, ...decoys].map((char, i) => ({ id: i, char })));
  }, [targetWord, idx]);

  useEffect(() => {
    if (!targetWord) return;
    setSelectedTileIndices(Array(targetWord.length).fill(null));
    setRevealedSlotIndices([]);
    setShowHint(false);
    setZoomedPanel(null);
  }, [targetWord, idx]);

  const activeSlots =
    selectedTileIndices.length === targetWord.length
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
    if (revealedSlotIndices.length >= maxReveals) return;
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
  }, [feedback, targetWord, revealedSlotIndices, maxReveals]);

  const handleSubmit = useCallback(() => {
    if (feedback !== 'idle' || !q || !isAllFilled || completedRef.current) return;
    const isRight = builtWord === targetWord;
    const penalty = (showHint ? 8 : 0) + revealedSlotIndices.length * 7;
    const earned = Math.max(12, 45 - penalty);
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextScore = isRight ? score + earned : score;

    // Persist forward-only progress synchronously before the feedback timeout
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
          summaryNote: `Solved ${nextCorrect} of ${playableQuestions.length} Hard Visual Clue puzzles!`,
        });
      } else {
        setIdx((i) => i + 1);
        setFeedback('idle');
      }
    }, 1050);
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
    onSaveProgress,
    idx,
    playableQuestions.length,
    onComplete,
    startTime,
  ]);

  useEffect(() => {
    if (!q || feedback !== 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && zoomedPanel) {
        setZoomedPanel(null);
        return;
      }
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
  }, [q, feedback, zoomedPanel, letterTiles, usedTileSet, handlePickTile, handleRemoveLast, handleSubmit]);

  if (isAlreadyFinished) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm font-semibold text-[#1E5B3A]">
        Finalizing your locked answers...
      </div>
    );
  }

  if (!q || !targetWord) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-sm text-[#4D6354]">
        This deck does not have single-word concepts ready for 4 Pics 1 Word yet. Choose another deck or add 4 Pics 1 Word questions!
      </div>
    );
  }

  const isSixPic = cluePanels.length >= 6;

  return (
    <div className="space-y-6">
      {/* Unboxed Top HUD + Progress */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#4D6354] tabular-nums">
          <span>
            {isSixPic ? '6 Pics' : '4 Pics'} 1 Word (Hard Mode) · Puzzle {idx + 1} of{' '}
            {playableQuestions.length}
            {q.category ? ` · ${q.category}` : ''}
          </span>
          <span className="text-[#1E5B3A] font-bold">Score: {score} pts</span>
        </div>
        <div className="h-2 rounded-full bg-[#ECE7D8] overflow-hidden">
          <div
            className="h-full bg-[#EA7A26] transition-all duration-300"
            style={{
              width: `${Math.round(((idx + (feedback !== 'idle' ? 1 : 0)) / playableQuestions.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Two-Zone Puzzle Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Zone: 4 or 6 Illustrated Visual Clue Panels (Captions hidden unless Hint is unlocked) */}
        <div className="lg:col-span-6 bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-4 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#4D6354]">
            <span>Tap any picture to zoom in</span>
            <span>{showHint ? 'Captions Revealed' : 'Hard Mode: Captions Hidden'}</span>
          </div>
          <div
            className={`grid gap-3 ${
              isSixPic ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {cluePanels.map((panel, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => setZoomedPanel({ panel, index: pIdx })}
                className="group relative aspect-square rounded-2xl border-2 border-[#D8D0BC] hover:border-[#EA7A26] bg-white overflow-hidden shadow-xs cursor-pointer transition-all"
              >
                <ClueSceneArtwork panel={panel} panelIndex={pIdx} showLabel={showHint} />
                <span className="absolute top-2 left-2 bg-[#172A1E]/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums">
                  #{pIdx + 1}
                </span>
                <span className="absolute top-2 right-2 bg-white/85 text-[#172A1E] p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Zone: Prompt Clue, Answer Slots & 16-18 Tile Tray */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-5">
            <p className="text-xs font-bold text-[#EA7A26] mb-1">
              Find the 1 Connecting Word ({targetWord.length} chars)
            </p>
            <h3 className="text-base font-bold text-[#172A1E] leading-snug">{q.prompt}</h3>
            {showHint && (
              <p className="text-xs font-semibold text-[#1E5B3A] mt-2.5">
                Clue Hint: {q.hint}
              </p>
            )}
          </div>

          {/* Target Word Answer Slots */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
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
                  className={`w-9 h-11 sm:w-10 sm:h-11 rounded-xl border-2 text-base sm:text-lg font-extrabold flex items-center justify-center transition-colors ${
                    feedback === 'correct'
                      ? 'border-[#2E7D32] bg-emerald-50 text-[#1E5B3A] cursor-default'
                      : feedback === 'wrong'
                        ? 'border-red-400 bg-red-50 text-red-700 cursor-default'
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
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl font-extrabold text-sm sm:text-base border-2 transition-transform ${
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
                Hint (-8 pts)
              </button>
              <button
                type="button"
                disabled={feedback !== 'idle' || revealedSlotIndices.length >= maxReveals}
                onClick={handleRevealOneLetter}
                className="px-3 py-2 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Lightbulb className="w-3.5 h-3.5 text-[#EA7A26]" />
                Reveal ({maxReveals - revealedSlotIndices.length}/{maxReveals})
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
              {feedback === 'correct' ? (
                <span className="text-[#1E5B3A] font-bold inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Answer Locked · Spot on! All {cluePanels.length} clues matched!
                </span>
              ) : feedback === 'wrong' ? (
                <span className="text-red-700 font-bold inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Answer Locked · Hidden word was {targetWord}.
                </span>
              ) : (
                `Examine all ${cluePanels.length} visual scenes and solve the ${targetWord.length}-character term.`
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Picture Inspection Zoom Modal */}
      {zoomedPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
          onClick={() => setZoomedPanel(null)}
        >
          <div
            className="bg-white rounded-3xl border border-[#E5DEC9] max-w-md w-full p-5 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-[#EA7A26]">
                Visual Clue #{zoomedPanel.index + 1} of {cluePanels.length}
              </p>
              <button
                type="button"
                onClick={() => setZoomedPanel(null)}
                className="p-1.5 rounded-lg hover:bg-[#FAF8F2] text-[#4D6354] cursor-pointer"
                aria-label="Close picture zoom"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="aspect-square rounded-2xl overflow-hidden border border-[#E5DEC9]">
              <ClueSceneArtwork
                panel={zoomedPanel.panel}
                panelIndex={zoomedPanel.index}
                showLabel={showHint}
              />
            </div>
            {!showHint && (
              <p className="text-[11px] text-[#4D6354] text-center">
                Scene captions stay hidden in Hard Mode unless you use Hint (-8 pts).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
