import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Eye,
  Gamepad2,
  Lock,
  Maximize2,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trophy,
  Users,
} from 'lucide-react';
import { GAMES_CATALOG, SLA_SECTIONS } from '../../data/defaultDecks';
import {
  AntiCheatAlert,
  ClassroomSession,
  GameId,
  PublicProfile,
  QuizDeck,
  QuizQuestion,
  ScoreRecord,
} from '../../types';
import {
  BrainzoneGame,
  CatchTheDuckGame,
  GameRoundProgress,
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
import { FourPicsOneWordGame } from './FourPicsOneWordGame';
import { PetAvatar } from '../PetAvatar';
import { soundFx } from '../../lib/sound';
import { calculateQuizRewards } from '../../lib/progression';
import { getStudentPresence, timestampToMillis } from '../../lib/presence';

export interface ForcedClassroomLaunch {
  sessionKey: string;
  sessionId: string;
  gameId: GameId;
  deckId: string;
  deckTitle: string;
  subject: string;
  gameTitle: string;
  teacherName: string;
  section: string;
}

interface MiniGamesHubProps {
  profile: PublicProfile;
  allProfiles: PublicProfile[];
  decks: QuizDeck[];
  alerts: AntiCheatAlert[];
  records?: ScoreRecord[];
  initialGameId?: GameId | null;
  initialDeckId?: string | null;
  classroomSessions?: ClassroomSession[];
  forcedLaunchSession?: ForcedClassroomLaunch | null;
  onCompleteClassroomSession?: (sessionKey: string) => void;
  onExitLaunchReset?: () => void;
  onStartClassroomSession?: (section: string, gameId: GameId, deck: QuizDeck) => Promise<void>;
  onEndClassroomSession?: (sessionId: string) => Promise<void>;
  onTriggerCheatLock: (gameId: string, gameTitle: string, subject: string, reason: string) => Promise<void>;
  onAllowStudent?: (alert: AntiCheatAlert) => Promise<void>;
  onRecordGameResult: (
    gameId: GameId,
    gameTitle: string,
    deck: QuizDeck,
    result: GameSessionResult
  ) => Promise<void>;
  onAwardStudent: (studentUid: string, points: number) => Promise<void>;
  onSetActiveGame: (activeGame: string) => Promise<void>;
}

interface StoredRoundState {
  questionIds: string[];
  progress: GameRoundProgress | null;
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
  records = [],
  initialGameId = null,
  initialDeckId = null,
  classroomSessions = [],
  forcedLaunchSession = null,
  onCompleteClassroomSession,
  onExitLaunchReset,
  onStartClassroomSession,
  onEndClassroomSession,
  onTriggerCheatLock,
  onAllowStudent,
  onRecordGameResult,
  onAwardStudent,
  onSetActiveGame,
}) => {
  const isFaculty = profile.role === 'teacher' || profile.role === 'admin';
  const defaultSection = profile.section?.trim() || SLA_SECTIONS[6];

  const [selectedDeckId, setSelectedDeckId] = useState<string>(() => {
    if (forcedLaunchSession?.deckId && decks.some((d) => d.id === forcedLaunchSession.deckId)) {
      return forcedLaunchSession.deckId;
    }
    if (initialDeckId && decks.some((d) => d.id === initialDeckId)) {
      return initialDeckId;
    }
    return decks[0]?.id || '';
  });
  const [activeGameId, setActiveGameId] = useState<GameId | null>(
    forcedLaunchSession?.gameId || initialGameId
  );
  const [gameResult, setGameResult] = useState<GameSessionResult | null>(null);
  const [completedFromLiveSession, setCompletedFromLiveSession] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);

  const [broadcastToClass, setBroadcastToClass] = useState<boolean>(profile.role === 'teacher');
  const [broadcastSection, setBroadcastSection] = useState<string>(defaultSection);

  const enteredFullscreenRef = useRef(false);
  const startWidthRef = useRef<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const blurTimeoutRef = useRef<number | null>(null);
  const lockTriggeredRef = useRef(false);
  const appliedForcedKeyRef = useRef<string | null>(null);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
  const activeGameMeta = GAMES_CATALOG.find((g) => g.id === activeGameId) || null;
  const myStrikes = alerts.filter((a) => a.studentId === profile.uid).length;

  const isLockedInForcedClassQuiz = Boolean(
    profile.role === 'student' &&
      forcedLaunchSession &&
      forcedLaunchSession.gameId === activeGameId &&
      forcedLaunchSession.deckId === selectedDeck?.id
  );

  // Keep selectedDeckId valid if custom decks are edited or deleted
  useEffect(() => {
    if (decks.length > 0 && !decks.some((d) => d.id === selectedDeckId)) {
      setSelectedDeckId(decks[0].id);
    }
  }, [decks, selectedDeckId]);

  useEffect(() => {
    if (initialDeckId && decks.some((d) => d.id === initialDeckId)) {
      setSelectedDeckId(initialDeckId);
    }
  }, [initialDeckId, decks]);

  useEffect(() => {
    if (profile.section?.trim()) {
      setBroadcastSection(profile.section.trim());
    }
  }, [profile.section]);

  const availableSections = useMemo(
    () =>
      Array.from(
        new Set([
          ...SLA_SECTIONS,
          ...allProfiles.map((p) => (p.section || '').trim()).filter(Boolean),
        ])
      ),
    [allProfiles]
  );

  const activeTeacherBroadcast = useMemo(() => {
    if (!isFaculty) return null;
    return (
      classroomSessions.find(
        (s) => s.status === 'active' && s.section.trim() === broadcastSection.trim()
      ) || null
    );
  }, [classroomSessions, isFaculty, broadcastSection]);

  // Storage key for forward-only question order & progress persistence (survives lockouts & page reloads)
  const roundStorageKey = useMemo(() => {
    if (!activeGameId || !selectedDeck) return null;
    if (
      forcedLaunchSession &&
      profile.role === 'student' &&
      forcedLaunchSession.gameId === activeGameId &&
      forcedLaunchSession.deckId === selectedDeck.id
    ) {
      return `lorenzone_round_${profile.uid}_${forcedLaunchSession.sessionKey}`;
    }
    return `lorenzone_round_${profile.uid}_solo_${activeGameId}_${selectedDeck.id}_${roundKey}`;
  }, [activeGameId, selectedDeck, forcedLaunchSession, profile.role, profile.uid, roundKey]);

  const { shuffledQuestions, initialSavedProgress } = useMemo<{
    shuffledQuestions: QuizQuestion[];
    initialSavedProgress: GameRoundProgress | null;
  }>(() => {
    if (!selectedDeck) {
      return { shuffledQuestions: [], initialSavedProgress: null };
    }
    const baseQuestions = selectedDeck.questions;
    if (!roundStorageKey || typeof window === 'undefined') {
      return {
        shuffledQuestions: shuffleArray(baseQuestions).map((q) => ({
          ...q,
          options: q.options.length > 1 ? shuffleArray(q.options) : q.options,
        })),
        initialSavedProgress: null,
      };
    }

    try {
      const raw = sessionStorage.getItem(roundStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredRoundState;
        if (Array.isArray(parsed.questionIds) && parsed.questionIds.length > 0) {
          const byId = new Map(baseQuestions.map((q) => [q.id, q]));
          const restored = parsed.questionIds
            .map((qid) => byId.get(qid))
            .filter((item): item is QuizQuestion => Boolean(item));
          if (restored.length === baseQuestions.length) {
            return {
              shuffledQuestions: restored,
              initialSavedProgress: parsed.progress || null,
            };
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }

    const freshOrder = shuffleArray(baseQuestions).map((q) => ({
      ...q,
      options: q.options.length > 1 ? shuffleArray(q.options) : q.options,
    }));
    try {
      const initialState: StoredRoundState = {
        questionIds: freshOrder.map((q) => q.id),
        progress: null,
      };
      sessionStorage.setItem(roundStorageKey, JSON.stringify(initialState));
    } catch {
      // Ignore storage write errors
    }
    return { shuffledQuestions: freshOrder, initialSavedProgress: null };
  }, [selectedDeck, roundStorageKey]);

  const handleSaveProgress = useCallback(
    (progress: GameRoundProgress) => {
      if (!roundStorageKey || typeof window === 'undefined') return;
      try {
        const raw = sessionStorage.getItem(roundStorageKey);
        const existing = raw ? (JSON.parse(raw) as StoredRoundState) : null;
        const payload: StoredRoundState = {
          questionIds:
            existing?.questionIds || shuffledQuestions.map((q) => q.id),
          progress,
        };
        sessionStorage.setItem(roundStorageKey, JSON.stringify(payload));
      } catch {
        // Ignore storage errors
      }
    },
    [roundStorageKey, shuffledQuestions]
  );

  useEffect(() => {
    if (!forcedLaunchSession || profile.role !== 'student') return;
    if (appliedForcedKeyRef.current === forcedLaunchSession.sessionKey) return;
    if (!decks.some((d) => d.id === forcedLaunchSession.deckId)) return;

    appliedForcedKeyRef.current = forcedLaunchSession.sessionKey;
    setSelectedDeckId(forcedLaunchSession.deckId);
    setGameResult(null);
    setCompletedFromLiveSession(false);
    setActiveGameId(forcedLaunchSession.gameId);
    const meta = GAMES_CATALOG.find((g) => g.id === forcedLaunchSession.gameId);
    void onSetActiveGame(`Playing: ${meta?.title || forcedLaunchSession.gameId}`);
  }, [forcedLaunchSession, profile.role, decks, onSetActiveGame]);

  useEffect(() => {
    if (initialGameId && !forcedLaunchSession) {
      setGameResult(null);
      setCompletedFromLiveSession(false);
      setActiveGameId(initialGameId);
      const meta = GAMES_CATALOG.find((g) => g.id === initialGameId);
      const verb = profile.role === 'student' ? 'Playing' : 'Hosting';
      void onSetActiveGame(`${verb}: ${meta?.title || initialGameId}`);
    }
  }, [initialGameId, forcedLaunchSession, onSetActiveGame, profile.role]);

  // Exit fullscreen cleanly on anti-cheat lock WITHOUT resetting roundKey so answered questions stay locked
  useEffect(() => {
    if (profile.lockedOut && profile.role === 'student') {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [profile.lockedOut, profile.role]);

  // Real-time Anti-AI Cheating Detector (Students only)
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
        .catch(() => {});
    }
  };

  const startGame = (gameId: GameId) => {
    if (!selectedDeck || selectedDeck.questions.length === 0) {
      soundFx.playWrong();
      return;
    }
    soundFx.playClick();
    const meta = GAMES_CATALOG.find((g) => g.id === gameId);
    const verb = profile.role === 'student' ? 'Playing' : 'Monitoring';
    setGameResult(null);
    setCompletedFromLiveSession(false);
    setRoundKey((k) => k + 1);
    setActiveGameId(gameId);
    enterExamFullscreen();
    void onSetActiveGame(`${verb}: ${meta?.title || gameId}`);

    if (isFaculty && broadcastToClass && broadcastSection.trim() && onStartClassroomSession) {
      void onStartClassroomSession(broadcastSection.trim(), gameId, selectedDeck);
    }
  };

  const exitGame = () => {
    if (isLockedInForcedClassQuiz && !gameResult) return;
    soundFx.playClick();
    enteredFullscreenRef.current = false;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen(false);
    setActiveGameId(null);
    setGameResult(null);
    setCompletedFromLiveSession(false);
    onExitLaunchReset?.();
    void onSetActiveGame(isFaculty ? `Monitoring: ${broadcastSection}` : 'Browsing Quiz Games');
  };

  const handleCompleteGame = async (result: GameSessionResult) => {
    if (!activeGameMeta || !selectedDeck) return;
    enteredFullscreenRef.current = false;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
    setIsFullscreen(false);
    soundFx.playLevelUp();

    if (roundStorageKey && typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(roundStorageKey);
      } catch {
        // Ignore storage errors
      }
    }

    const wasForcedLive = Boolean(
      forcedLaunchSession &&
        forcedLaunchSession.gameId === activeGameMeta.id &&
        forcedLaunchSession.deckId === selectedDeck.id
    );
    setCompletedFromLiveSession(wasForcedLive);
    setGameResult(result);

    if (wasForcedLive && forcedLaunchSession) {
      onCompleteClassroomSession?.(forcedLaunchSession.sessionKey);
    }
    await onRecordGameResult(activeGameMeta.id, activeGameMeta.title, selectedDeck, result);
    void onSetActiveGame('Browsing Quiz Games');
  };

  // Teacher Monitor Data for active quiz room
  const roomStudents = useMemo(() => {
    if (!isFaculty) return [];
    const targetSec = (activeTeacherBroadcast?.section || broadcastSection).trim();
    return allProfiles
      .filter((p) => p.role === 'student' && (p.section || '').trim() === targetSec)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [isFaculty, allProfiles, activeTeacherBroadcast?.section, broadcastSection]);

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
            An alarm and notification were sent to your Teacher Monitor. Answered questions remain permanently locked so you cannot re-answer earlier items, and repeat offenses deduct 15 LorenCoins. You cannot continue until your teacher clicks <strong>Allow Student</strong>.
          </p>
        </div>
        {!isLockedInForcedClassQuiz && (
          <button
            type="button"
            onClick={exitGame}
            className="mt-6 px-5 py-2.5 rounded-xl border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] hover:bg-[#FAF8F2] cursor-pointer"
          >
            Return to Lobby (Lock stays active)
          </button>
        )}
      </div>
    );
  }

  // Active Game Arena (Students Play; Teachers Monitor-Only except Catch the Duck Recitation Host)
  if (activeGameId && activeGameMeta && selectedDeck) {
    const showTeacherMonitorOnly = isFaculty && activeGameId !== 'catch_the_duck';

    return (
      <div className="space-y-5">
        {/* Game Arena Top Utility Bar */}
        <div className="bg-white rounded-2xl border border-[#E5DEC9] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isLockedInForcedClassQuiz && !gameResult ? (
              <span
                className="p-2 rounded-xl border border-[#EA7A26]/40 bg-[#FFF8F1] text-[#C65B10]"
                title="Locked inside live classroom quiz until you finish or your teacher ends it"
              >
                <Lock className="w-4 h-4" />
              </span>
            ) : (
              <button
                type="button"
                onClick={exitGame}
                className="p-2 rounded-xl border border-[#E5DEC9] hover:bg-[#FAF8F2] text-[#172A1E] cursor-pointer"
                aria-label="Back to Mini Games"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-[#172A1E] flex items-center gap-2 flex-wrap">
                {activeGameMeta.title}
                {showTeacherMonitorOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[#1E5B3A] text-[11px] font-bold">
                    <Eye className="w-3 h-3" />
                    Teacher Monitor Mode
                  </span>
                )}
                {profile.role === 'student' &&
                  forcedLaunchSession &&
                  forcedLaunchSession.gameId === activeGameMeta.id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#EA7A26]/15 text-[#C65B10] text-[11px] font-bold">
                      <Radio className="w-3 h-3" />
                      {forcedLaunchSession.section} Live Quiz (Locked)
                    </span>
                  )}
              </h2>
              <p className="text-xs text-[#4D6354]">
                {selectedDeck.subject} · {selectedDeck.title}
                {profile.role === 'student' &&
                  forcedLaunchSession &&
                  ` · Teacher: ${forcedLaunchSession.teacherName}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isFaculty && activeTeacherBroadcast && onEndClassroomSession && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  void onEndClassroomSession(activeTeacherBroadcast.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Square className="w-3 h-3 fill-current" />
                End Live Quiz ({activeTeacherBroadcast.section})
              </button>
            )}
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

        {/* Teacher Monitor-Only Console (Teacher never has to answer quiz questions) */}
        {showTeacherMonitorOnly ? (
          <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#ECE7D8]">
              <div>
                <p className="text-xs font-bold text-[#EA7A26] flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Live Classroom Monitor · {activeTeacherBroadcast?.section || broadcastSection}
                </p>
                <h3 className="text-xl font-extrabold text-[#172A1E] mt-0.5">
                  Students Taking {activeGameMeta.title}
                </h3>
                <p className="text-xs text-[#4D6354] mt-0.5">
                  Teachers monitor real-time student progress and anti-cheat focus here without answering questions. Enrolled students remain locked inside this quiz until they finish or you click End Live Quiz.
                </p>
              </div>
              {!activeTeacherBroadcast && onStartClassroomSession && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playLevelUp();
                    void onStartClassroomSession(broadcastSection.trim(), activeGameMeta.id, selectedDeck);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Radio className="w-4 h-4" />
                  Start Live Quiz for {broadcastSection}
                </button>
              )}
            </div>

            {roomStudents.length === 0 ? (
              <p className="text-sm text-[#4D6354] py-8 text-center bg-[#FAF8F2] rounded-2xl">
                No students enrolled in {activeTeacherBroadcast?.section || broadcastSection} yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#ECE7D8] text-xs text-[#4D6354]">
                      <th className="py-2.5 pr-4 font-semibold">Student</th>
                      <th className="py-2.5 pr-4 font-semibold">Quiz Status</th>
                      <th className="py-2.5 pr-4 font-semibold">Latest Attempt</th>
                      <th className="py-2.5 font-semibold text-right">Integrity / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EFE6]">
                    {roomStudents.map((st) => {
                      const presence = getStudentPresence(st);
                      const sessionStartMs = activeTeacherBroadcast
                        ? timestampToMillis(activeTeacherBroadcast.startedAt)
                        : 0;
                      const latestMatch = records.find(
                        (r) =>
                          r.studentId === st.uid &&
                          r.gameId === activeGameId &&
                          r.deckId === selectedDeck.id &&
                          (!sessionStartMs || timestampToMillis(r.createdAt) >= sessionStartMs - 5000)
                      );
                      const matchingAlert = alerts.find(
                        (a) => a.studentId === st.uid && a.status === 'locked'
                      );
                      const isInsideGame =
                        presence.isOnline && st.activeGame === `Playing: ${activeGameMeta.title}`;

                      return (
                        <tr key={st.uid}>
                          <td className="py-3 pr-4 font-semibold text-[#172A1E]">
                            {st.displayName}
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            {st.lockedOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 font-bold">
                                Locked (Integrity)
                              </span>
                            ) : latestMatch ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#1E5B3A] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Completed
                              </span>
                            ) : isInsideGame ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EA7A26]/15 border border-[#EA7A26]/30 text-[#C65B10] font-bold">
                                <Radio className="w-3 h-3 animate-pulse" />
                                Taking Quiz
                              </span>
                            ) : presence.isOnline ? (
                              <span className="text-[#4D6354] font-medium">Entering Quiz...</span>
                            ) : (
                              <span className="text-[#94A398]">Offline</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs tabular-nums">
                            {latestMatch ? (
                              <span className="font-bold text-[#1E5B3A]">
                                {latestMatch.score} pts ({latestMatch.correctCount}/{latestMatch.totalCount})
                              </span>
                            ) : (
                              <span className="text-[#4D6354]">—</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {st.lockedOut && matchingAlert && onAllowStudent ? (
                              <button
                                type="button"
                                onClick={() => {
                                  soundFx.playCorrect();
                                  void onAllowStudent(matchingAlert);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                              >
                                Allow Student
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-[#1E5B3A]">
                                {st.lockedOut ? 'Locked' : 'Focused'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expandable Read-Only Answer Key Reference */}
            <div className="pt-4 border-t border-[#ECE7D8] space-y-3">
              <button
                type="button"
                onClick={() => setShowAnswerKey((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold text-[#1E5B3A] hover:underline cursor-pointer"
              >
                {showAnswerKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showAnswerKey ? 'Hide' : 'View'} Deck Answer Key Reference ({selectedDeck.questions.length} Questions)
              </button>
              {showAnswerKey && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedDeck.questions.map((qItem, qIdx) => (
                    <div
                      key={qItem.id || qIdx}
                      className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-xs space-y-1"
                    >
                      <p className="font-bold text-[#172A1E]">
                        Q{qIdx + 1}. {qItem.prompt}
                      </p>
                      <p className="font-semibold text-[#1E5B3A]">Answer: {qItem.answer}</p>
                      {qItem.hint && <p className="text-[#4D6354]">Hint: {qItem.hint}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Student Quiz Arena OR Teacher Catch-the-Duck Recitation Host */
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F2] p-4 rounded-2xl border border-[#E5DEC9] tabular-nums">
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
                    <p className="text-xs text-[#4D6354]">Coins Earned</p>
                    <p className="text-xl font-extrabold text-[#EA7A26] flex items-center justify-center gap-1">
                      <Coins className="w-4 h-4" />+
                      {
                        calculateQuizRewards({
                          score: gameResult.score,
                          correctCount: gameResult.correctCount,
                          totalCount: gameResult.totalCount,
                        }).earnedCoins
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#4D6354]">Pet XP</p>
                    <p className="text-xl font-extrabold text-[#1E5B3A]">
                      +
                      {
                        calculateQuizRewards({
                          score: gameResult.score,
                          correctCount: gameResult.correctCount,
                          totalCount: gameResult.totalCount,
                        }).earnedXp
                      }{' '}
                      XP
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  {!completedFromLiveSession && (
                    <button
                      type="button"
                      onClick={() => startGame(activeGameMeta.id)}
                      className="px-5 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Play Again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={exitGame}
                    className="px-5 py-2.5 rounded-xl border border-[#D8D0BC] text-xs font-bold text-[#172A1E] hover:bg-[#FAF8F2] cursor-pointer"
                  >
                    {completedFromLiveSession ? 'Return to Quiz Lobby' : 'Choose Another Game'}
                  </button>
                </div>
              </div>
            ) : (
              <div key={`${roundStorageKey || roundKey}`}>
                {activeGameId === 'lorenscape' && (
                  <LorenscapeGame
                    questions={shuffledQuestions}
                    profile={profile}
                    allProfiles={allProfiles}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'on_the_run' && (
                  <OnTheRunGame
                    questions={shuffledQuestions}
                    profile={profile}
                    allProfiles={allProfiles}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'brainzone' && (
                  <BrainzoneGame
                    questions={shuffledQuestions}
                    profile={profile}
                    allProfiles={allProfiles}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'grab_it' && (
                  <GrabItGame
                    questions={shuffledQuestions}
                    profile={profile}
                    allProfiles={allProfiles}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'catch_the_duck' && (
                  <CatchTheDuckGame
                    questions={shuffledQuestions}
                    profile={profile}
                    allProfiles={allProfiles}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                    onAwardStudent={onAwardStudent}
                  />
                )}
                {activeGameId === 'word_quest' && (
                  <WordQuestGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'math_dash' && (
                  <MathDashGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'quiz_master' && (
                  <QuizMasterGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'memory_match' && (
                  <MemoryMatchGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'sorting_squad' && (
                  <SortingSquadGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'quick_recall' && (
                  <QuickRecallGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
                {activeGameId === 'four_pics_one_word' && (
                  <FourPicsOneWordGame
                    questions={shuffledQuestions}
                    profile={profile}
                    savedProgress={initialSavedProgress}
                    onSaveProgress={handleSaveProgress}
                    onComplete={(res) => void handleCompleteGame(res)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Mini-Games Catalog + Subject Selector
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-xs font-semibold text-[#EA7A26]">Customizable Quiz Arena</p>
            <h2 className="text-2xl font-bold text-[#172A1E] flex items-center gap-2 mt-0.5">
              <Gamepad2 className="w-6 h-6 text-[#1E5B3A]" />
              12 Interactive Mini-Games
            </h2>
            <p className="text-xs text-[#4D6354] mt-1">
              {isFaculty
                ? 'Select any subject deck below and launch a live classroom session to monitor your students in real time.'
                : 'Select any subject deck below — including custom & PowerPoint-imported teacher quizzes — then launch a game.'}
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

        {isFaculty && onStartClassroomSession && (
          <div className="pt-4 border-t border-[#ECE7D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-[#172A1E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastToClass}
                  onChange={(e) => setBroadcastToClass(e.target.checked)}
                  className="rounded border-[#D8D0BC]"
                />
                <Radio className="w-3.5 h-3.5 text-[#EA7A26]" />
                Send &amp; lock enrolled students into the quiz I launch for classroom:
              </label>

              {profile.role === 'admin' ? (
                <select
                  value={broadcastSection}
                  onChange={(e) => setBroadcastSection(e.target.value)}
                  aria-label="Target classroom section"
                  className="px-3 py-1.5 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] text-xs font-semibold text-[#172A1E]"
                >
                  {availableSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#1E5B3A]">
                  {broadcastSection}
                </span>
              )}
            </div>

            {activeTeacherBroadcast && onEndClassroomSession && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1E5B3A]">
                  Live: {activeTeacherBroadcast.gameTitle} ({activeTeacherBroadcast.subject})
                </span>
                <button
                  type="button"
                  onClick={() => void onEndClassroomSession(activeTeacherBroadcast.id)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" />
                  End Live Quiz
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {(!selectedDeck || selectedDeck.questions.length === 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
          This deck has 0 questions right now. Select another subject deck or add questions in Teacher Monitor.
        </div>
      )}

      {/* 12 Games Grid */}
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
                  {game.isSignature && <span className="font-bold text-[#EA7A26]">Signature</span>}
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
                  {isFaculty && game.id !== 'catch_the_duck' ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      Monitor
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      {isFaculty ? 'Host' : 'Play'}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
