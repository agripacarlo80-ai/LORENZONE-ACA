import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Coins,
  Gamepad2,
  Lock,
  Maximize2,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { GAMES_CATALOG } from '../../data/defaultDecks';
import { AntiCheatAlert, GameId, PublicProfile, QuizDeck, QuizQuestion } from '../../types';
import {
  BrainzoneGame,
  CatchTheDuckGame,
  GameSessionResult,
  GrabItGame,
  LorenscapeGame,
  OnTheRunGame,
} from './SignatureGames';
import {
  MathDashGame,
  MemoryMatchGame,
  QuickRecallGame,
  QuizMasterGame,
  SortingSquadGame,
  WordQuestGame,
} from './ClassicMiniGames';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';

interface MiniGamesHubProps {
  profile: PublicProfile;
  allProfiles: PublicProfile[];
  decks: QuizDeck[];
  alerts: AntiCheatAlert[];
  initialGameId?: GameId | null;
  onTriggerCheatLock: (gameId: string, gameTitle: string, subject: string, reason: string) => Promise<void>;
  onRecordGameResult: (
    gameId: GameId,
    gameTitle: string,
    deck: QuizDeck,
    result: GameSessionResult
  ) => Promise<void>;
  onAwardStudent: (studentUid: string, points: number) => Promise<void>;
  onSetActiveGame: (activeGame: string) => Promise<void>;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const MiniGamesHub: React.FC<MiniGamesHubProps> = ({
  profile,
  allProfiles,
  decks,
  alerts,
  initialGameId = null,
  onTriggerCheatLock,
  onRecordGameResult,
  onAwardStudent,
  onSetActiveGame,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id || '');
  const [activeGameId, setActiveGameId] = useState<GameId | null>(initialGameId);
  const [gameResult, setGameResult] = useState<GameSessionResult | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enteredFullscreenRef = useRef(false);
  const startWidthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const blurTimeoutRef = useRef<number | null>(null);
  const lockTriggeredRef = useRef(false);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
  const activeGameMeta = GAMES_CATALOG.find((g) => g.id === activeGameId) || null;
  const myStrikes = alerts.filter((a) => a.studentId === profile.uid).length;

  // Keep selectedDeckId valid if custom decks are edited or deleted
  useEffect(() => {
    if (decks.length > 0 && !decks.some((d) => d.id === selectedDeckId)) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  // Randomize question order & multiple-choice options each round to deter answer sharing & AI lookup
  const shuffledQuestions: QuizQuestion[] = useMemo(() => {
    if (!selectedDeck) return [];
    return shuffleArray(selectedDeck.questions).map((q) => ({
      ...q,
      options: q.options.length > 1 ? shuffleArray(q.options) : q.options,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeck?.id, selectedDeck?.questions, roundKey]);

  useEffect(() => {
    if (initialGameId) {
      setActiveGameId(initialGameId);
    }
  }, [initialGameId]);

  // Reset current round progress whenever student gets locked out so they cannot resume after consulting AI
  useEffect(() => {
    if (profile.lockedOut && profile.role === 'student') {
      setRoundKey((k) => k + 1);
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [profile.lockedOut, profile.role]);

  // Real-time Anti-AI Cheating Detector (Focus, Visibility, Fullscreen, Split-Screen, Copy/Paste/Shortcuts)
  useEffect(() => {
    if (!activeGameId || gameResult || profile.role !== 'student' || profile.lockedOut) {
      lockTriggeredRef.current = false;
      return;
    }

    lockTriggeredRef.current = false;
    const gameTitle = activeGameMeta?.title || activeGameId;
    const subject = selectedDeck?.subject || 'General';
    startWidthRef.current = window.innerWidth;

    const triggerLock = (reason: string) => {
      if (lockTriggeredRef.current) return;
      lockTriggeredRef.current = true;
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      soundFx.playWrong();
      void onTriggerCheatLock(activeGameId, gameTitle, subject, reason);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        triggerLock('Switched browser tab or minimized LORENZONE during active quiz');
      }
    };

    const handleBlur = () => {
      if (blurTimeoutRef.current !== null) window.clearTimeout(blurTimeoutRef.current);
      // 350ms grace debounce prevents false locks during browser fullscreen transition overlays
      blurTimeoutRef.current = window.setTimeout(() => {
        if (!document.hasFocus() && !lockTriggeredRef.current) {
          triggerLock('Left application focus (possible external AI/browser lookup)');
        }
      }, 350);
    };

    const handleFocus = () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };

    const handleFullscreenChange = () => {
      const activeFs = Boolean(document.fullscreenElement);
      setIsFullscreen(activeFs);
      if (activeFs) {
        enteredFullscreenRef.current = true;
      } else if (enteredFullscreenRef.current) {
        enteredFullscreenRef.current = false;
        triggerLock('Exited Fullscreen Exam Mode during active quiz');
      }
    };

    const handleResize = () => {
      // Detect abrupt window shrink (e.g. snapping browser into split-screen beside an AI chat)
      if (startWidthRef.current - window.innerWidth > 220) {
        triggerLock('Resized window to split-screen mode during active quiz');
      }
    };

    const handleClipboardBlock = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerLock(`Attempted ${e.type} shortcut during quiz (blocked to prevent AI lookup)`);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (ctrl && ['c', 'x', 'v', 'u', 'p'].includes(key)) ||
        (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        e.preventDefault();
        triggerLock(`Blocked restricted shortcut (${e.key.toUpperCase()}) during quiz`);
      }
    };

    const focusWatchdog = window.setInterval(() => {
      if (document.hidden) {
        triggerLock('Switched browser tab during active quiz watchdog check');
      } else if (!document.hasFocus() && blurTimeoutRef.current === null) {
        blurTimeoutRef.current = window.setTimeout(() => {
          if (!document.hasFocus() && !lockTriggeredRef.current) {
            triggerLock('Window focus lost during active quiz watchdog check');
          }
        }, 350);
      }
    }, 1500);

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleClipboardBlock);
    document.addEventListener('cut', handleClipboardBlock);
    document.addEventListener('paste', handleClipboardBlock);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearInterval(focusWatchdog);
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleClipboardBlock);
      document.removeEventListener('cut', handleClipboardBlock);
      document.removeEventListener('paste', handleClipboardBlock);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    activeGameId,
    activeGameMeta,
    gameResult,
    onTriggerCheatLock,
    profile.lockedOut,
    profile.role,
    selectedDeck,
  ]);

  const enterExamFullscreen = () => {
    if (profile.role !== 'student') return;
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      void document.documentElement
        .requestFullscreen()
        .then(() => {
          enteredFullscreenRef.current = true;
          setIsFullscreen(true);
        })
        .catch(() => {
          // Gracefully ignore if browser/iframe restricts fullscreen
        });
    }
  };

  const startGame = (gameId: GameId) => {
    if (!selectedDeck || selectedDeck.questions.length === 0) {
      soundFx.playWrong();
      return;
    }
    soundFx.playClick();
    const meta = GAMES_CATALOG.find((g) => g.id === gameId);
    setGameResult(null);
    setRoundKey((k) => k + 1);
    setActiveGameId(gameId);
    enterExamFullscreen();
    void onSetActiveGame(meta?.title || gameId);
  };

  const exitGame = () => {
    soundFx.playClick();
    enteredFullscreenRef.current = false;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen(false);
    setActiveGameId(null);
    setGameResult(null);
    void onSetActiveGame('Lobby');
  };

  const handleCompleteGame = async (result: GameSessionResult) => {
    if (!activeGameMeta || !selectedDeck) return;
    enteredFullscreenRef.current = false;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen(false);
    soundFx.playLevelUp();
    setGameResult(result);
    await onRecordGameResult(activeGameMeta.id, activeGameMeta.title, selectedDeck, result);
    void onSetActiveGame('Lobby');
  };

  // Locked Out Blocker Modal for Student
  if (profile.lockedOut && profile.role === 'student') {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-3xl border-2 border-red-400 p-8 text-center shadow-sm my-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <p className="text-xs font-extrabold text-red-600 uppercase tracking-wider mb-1">
          Integrity Strike #{Math.max(1, myStrikes)} Recorded
        </p>
        <h2 className="text-2xl font-extrabold text-[#172A1E]">Quiz Locked by Integrity Guard</h2>
        <p className="text-sm text-[#4D6354] mt-2 leading-relaxed">
          {profile.lockReason || 'You left the LORENZONE quiz window during an active round.'}
        </p>
        <div className="mt-6 p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-xs text-[#4D6354] space-y-1.5">
          <p className="font-bold text-[#172A1E]">Waiting for Teacher Permission</p>
          <p>
            An alarm and notification were sent to your Teacher Monitor. Your current quiz round was reset to prevent external lookups, and repeat offenses deduct 15 LorenCoins. You cannot answer until your teacher clicks <strong>Allow Student</strong>.
          </p>
        </div>
        <button
          type="button"
          onClick={exitGame}
          className="mt-6 px-5 py-2.5 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer"
        >
          Return to Lobby (Lock stays active)
        </button>
      </div>
    );
  }

  // Active Game Arena
  if (activeGameId && activeGameMeta && selectedDeck) {
    return (
      <div className="space-y-5">
        {/* Game Arena Top Utility Bar */}
        <div className="bg-white rounded-2xl border border-[#E5DEC9] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exitGame}
              className="p-2 rounded-xl border border-[#E5DEC9] hover:bg-[#FAF8F2] text-[#172A1E] cursor-pointer"
              aria-label="Back to Mini Games"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-bold text-[#172A1E]">{activeGameMeta.title}</h2>
              <p className="text-xs text-[#4D6354]">
                {selectedDeck.subject} · {selectedDeck.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {profile.role === 'student' && !gameResult && (
              <>
                <span className="text-xs font-semibold text-[#1E5B3A] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Anti-AI Guard Active {myStrikes > 0 ? `(${myStrikes} Strike${myStrikes > 1 ? 's' : ''})` : ''}
                </span>
                {!isFullscreen && (
                  <button
                    type="button"
                    onClick={enterExamFullscreen}
                    className="px-2.5 py-1.5 rounded-lg border border-[#D8D0BC] bg-[#FAF8F2] text-[11px] font-semibold text-[#172A1E] hover:bg-[#ECE7D8] cursor-pointer flex items-center gap-1"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Fullscreen
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playWrong();
                    void onTriggerCheatLock(
                      activeGameMeta.id,
                      activeGameMeta.title,
                      selectedDeck.subject,
                      'Left app / tab switch detected during quiz'
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer flex items-center gap-1"
                  title="Demo trigger for Cheating Detector"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Test Tab-Switch Lock
                </button>
              </>
            )}
          </div>
        </div>

        {/* Game Body or Victory Summary */}
        <div
          className={`bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 ${
            profile.role === 'student' && !gameResult ? 'select-none' : ''
          }`}
        >
          {gameResult ? (
            <div className="max-w-md mx-auto text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-[#EA7A26] flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#EA7A26]">Round Completed</p>
                <h3 className="text-2xl font-extrabold text-[#172A1E] mt-1">
                  {activeGameMeta.title} Results
                </h3>
                {gameResult.summaryNote && (
                  <p className="text-sm text-[#1E5B3A] font-semibold mt-1">{gameResult.summaryNote}</p>
                )}
              </div>

              <div className="mx-auto w-fit">
                <PetAvatar
                  species={profile.petSpecies}
                  color={profile.petColor}
                  outfit={profile.outfit}
                  accessory={profile.accessory}
                  role={profile.role}
                  size={120}
                  className="animate-float-gentle"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 bg-[#FAF8F2] p-4 rounded-2xl border border-[#E5DEC9] tabular-nums">
                <div>
                  <p className="text-xs text-[#4D6354]">Score</p>
                  <p className="text-xl font-extrabold text-[#1E5B3A]">+{gameResult.score}</p>
                </div>
                <div>
                  <p className="text-xs text-[#4D6354]">Accuracy</p>
                  <p className="text-xl font-extrabold text-[#172A1E]">
                    {gameResult.correctCount}/{gameResult.totalCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#4D6354]">Coins</p>
                  <p className="text-xl font-extrabold text-[#EA7A26] flex items-center justify-center gap-1">
                    <Coins className="w-4 h-4" />+{Math.max(15, Math.round(gameResult.score / 3))}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => startGame(activeGameMeta.id)}
                  className="px-5 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={exitGame}
                  className="px-5 py-2.5 rounded-xl border border-[#D8D0BC] text-xs font-bold text-[#172A1E] hover:bg-[#FAF8F2] cursor-pointer"
                >
                  Choose Another Game
                </button>
              </div>
            </div>
          ) : (
            <div key={roundKey}>
              {activeGameId === 'lorenscape' && (
                <LorenscapeGame
                  questions={shuffledQuestions}
                  profile={profile}
                  allProfiles={allProfiles}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'on_the_run' && (
                <OnTheRunGame
                  questions={shuffledQuestions}
                  profile={profile}
                  allProfiles={allProfiles}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'brainzone' && (
                <BrainzoneGame
                  questions={shuffledQuestions}
                  profile={profile}
                  allProfiles={allProfiles}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'grab_it' && (
                <GrabItGame
                  questions={shuffledQuestions}
                  profile={profile}
                  allProfiles={allProfiles}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'catch_the_duck' && (
                <CatchTheDuckGame
                  questions={shuffledQuestions}
                  profile={profile}
                  allProfiles={allProfiles}
                  onComplete={(res) => void handleCompleteGame(res)}
                  onAwardStudent={onAwardStudent}
                />
              )}
              {activeGameId === 'word_quest' && (
                <WordQuestGame
                  questions={shuffledQuestions}
                  profile={profile}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'math_dash' && (
                <MathDashGame
                  questions={shuffledQuestions}
                  profile={profile}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'quiz_master' && (
                <QuizMasterGame
                  questions={shuffledQuestions}
                  profile={profile}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'memory_match' && (
                <MemoryMatchGame
                  questions={shuffledQuestions}
                  profile={profile}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'sorting_squad' && (
                <SortingSquadGame
                  questions={shuffledQuestions}
                  profile={profile}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
              {activeGameId === 'quick_recall' && (
                <QuickRecallGame
                  questions={shuffledQuestions}
                  profile={profile}
                  onComplete={(res) => void handleCompleteGame(res)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mini-Games Catalog + Subject Selector
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <p className="text-xs font-semibold text-[#EA7A26]">Customizable Quiz Arena</p>
          <h2 className="text-2xl font-bold text-[#172A1E] flex items-center gap-2 mt-0.5">
            <Gamepad2 className="w-6 h-6 text-[#1E5B3A]" />
            11 Interactive Mini-Games
          </h2>
          <p className="text-xs text-[#4D6354] mt-1">
            Select any subject deck below — including custom &amp; PowerPoint-imported teacher quizzes — then launch a game.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-[#FAF8F2] border border-[#D8D0BC] rounded-xl px-3.5 py-2">
            <BookOpen className="w-4 h-4 text-[#1E5B3A] shrink-0" />
            <select
              value={selectedDeck?.id || ''}
              onChange={(e) => {
                soundFx.playClick();
                setSelectedDeckId(e.target.value);
              }}
              aria-label="Select Subject Quiz Deck"
              className="text-xs font-semibold text-[#172A1E] bg-transparent focus:outline-none cursor-pointer"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.subject}: {d.title} ({d.questions.length} Qs)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {(!selectedDeck || selectedDeck.questions.length === 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
          This deck has 0 questions right now. Select another subject deck or add questions in Teacher Monitor.
        </div>
      )}

      {/* 11 Games Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES_CATALOG.map((game) => {
          const canPlay = Boolean(selectedDeck && selectedDeck.questions.length > 0);
          return (
            <div
              key={game.id}
              className={`rounded-3xl border bg-white p-6 flex flex-col justify-between transition-colors ${
                game.isSignature ? 'border-[#EA7A26]/60' : 'border-[#E5DEC9]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="font-bold text-[#4D6354] tabular-nums">
                    {String(game.number).padStart(2, '0')}. {game.modeLabel}
                  </span>
                  {game.isSignature && (
                    <span className="font-bold text-[#EA7A26]">Signature</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#172A1E]">{game.title}</h3>
                <p className="text-xs text-[#4D6354] mt-1.5 leading-relaxed">{game.tagline}</p>
              </div>

              <div className="mt-5 pt-4 border-t border-[#F2EFE6] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1E5B3A] tabular-nums">
                  Up to +{game.rewardCoins} Coins
                </span>
                <button
                  type="button"
                  disabled={!canPlay}
                  onClick={() => startGame(game.id)}
                  className="px-4 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  Play
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
