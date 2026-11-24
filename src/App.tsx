import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import { BUILTIN_DECKS } from './data/defaultDecks';
import {
  AccessCodesConfig,
  AntiCheatAlert,
  AppTab,
  AuthorizedFaculty,
  GameId,
  PetSpecies,
  PublicProfile,
  QuizDeck,
  ScoreRecord,
  ThemeColor,
  UserRole,
} from './types';
import {
  AuthScreen,
  OnboardingStudio,
  SplashScreen,
} from './components/SplashAndAuth';
import { PetHomeAndCare } from './components/PetHomeAndCare';
import { MiniGamesHub } from './components/games/MiniGamesHub';
import { LeaderboardView } from './components/LeaderboardView';
import { TeacherMonitor } from './components/TeacherMonitor';
import {
  GameRulesModal,
  InstructionsModal,
  SettingsModal,
  UtilityToolbar,
} from './components/UtilityModals';
import { GameSessionResult } from './components/games/SignatureGames';
import { ErrorBoundary } from './components/ErrorBoundary';
import { soundFx } from './lib/sound';

const DEFAULT_ACCESS_CODES = {
  teacherCode: 'SLA-TEACH-2026',
  adminCode: 'SLA-ADMIN-2026',
};

function LorenzoneApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [portalMode, setPortalMode] = useState<'student' | 'faculty'>('student');

  const [myProfile, setMyProfile] = useState<PublicProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [authorizedRole, setAuthorizedRole] = useState<'admin' | 'teacher' | null>(null);
  const [authzChecked, setAuthzChecked] = useState(false);
  const [authorizedFaculty, setAuthorizedFaculty] = useState<AuthorizedFaculty[]>([]);
  const [accessCodes, setAccessCodes] = useState(DEFAULT_ACCESS_CODES);
  const [allProfiles, setAllProfiles] = useState<PublicProfile[]>([]);
  const [ownDecks, setOwnDecks] = useState<QuizDeck[]>([]);
  const [publishedDecks, setPublishedDecks] = useState<QuizDeck[]>([]);
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [alerts, setAlerts] = useState<AntiCheatAlert[]>([]);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [launchGameId, setLaunchGameId] = useState<GameId | null>(null);

  const [muted, setMuted] = useState(() => soundFx.isMuted());
  const [theme, setTheme] = useState<ThemeColor>(() => {
    try {
      const saved = localStorage.getItem('lorenzone_theme');
      if (saved === 'white' || saved === 'green' || saved === 'orange') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'white';
  });
  const [showInstructions, setShowInstructions] = useState(false);
  const [showGameRules, setShowGameRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('lorenzone_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setMyProfile(null);
        setProfileLoaded(false);
        setAuthorizedRole(null);
        setAuthzChecked(false);
        setAuthorizedFaculty([]);
        setOwnDecks([]);
        setPublishedDecks([]);
      }
    });
    return () => unsub();
  }, []);

  const toMillis = (ts: unknown): number => {
    if (!ts) return 0;
    if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
      return (ts as { toMillis: () => number }).toMillis();
    }
    return 0;
  };

  // Load current user's profile and faculty authorization status
  useEffect(() => {
    if (!authReady || !user) return;

    const emailLower = (user.email || '').toLowerCase();
    const checkAuthz = async () => {
      if (emailLower === 'maxsison2@gmail.com') {
        setAuthorizedRole('admin');
        setAuthzChecked(true);
        return;
      }
      if (!emailLower) {
        setAuthorizedRole(null);
        setAuthzChecked(true);
        return;
      }
      try {
        const facSnap = await getDoc(doc(db, 'authorizedFaculty', emailLower));
        if (facSnap.exists()) {
          const facData = facSnap.data() as AuthorizedFaculty;
          setAuthorizedRole(facData.role);
        } else {
          setAuthorizedRole(null);
        }
      } catch {
        setAuthorizedRole(null);
      } finally {
        setAuthzChecked(true);
      }
    };
    void checkAuthz();

    const myProfileRef = doc(db, 'publicProfiles', user.uid);
    const unsubMyProfile = onSnapshot(
      myProfileRef,
      (snap) => {
        setMyProfile(snap.exists() ? (snap.data() as PublicProfile) : null);
        setProfileLoaded(true);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `publicProfiles/${user.uid}`)
    );

    return () => {
      unsubMyProfile();
    };
  }, [authReady, user]);

  // Ensure primary admin (maxsison2@gmail.com) or newly authorized faculty syncs role automatically
  useEffect(() => {
    if (!user || !myProfile || !authzChecked || !authorizedRole) return;
    const isPrimaryAdmin = (user.email || '').toLowerCase() === 'maxsison2@gmail.com';
    if (isPrimaryAdmin && myProfile.role !== 'admin') {
      void updateDoc(doc(db, 'publicProfiles', user.uid), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      });
    } else if (authorizedRole && myProfile.role === 'student') {
      void updateDoc(doc(db, 'publicProfiles', user.uid), {
        role: authorizedRole,
        updatedAt: serverTimestamp(),
      });
    }
  }, [user, myProfile, authzChecked, authorizedRole]);

  // Backfill `section` onto PublicProfile once for legacy accounts created before section classroom rooms
  useEffect(() => {
    if (!user || !myProfile || (myProfile.section && myProfile.section.trim())) return;
    let cancelled = false;
    const backfillSection = async () => {
      try {
        const privSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'info'));
        const privSection =
          privSnap.exists() && typeof privSnap.data().section === 'string'
            ? privSnap.data().section.trim()
            : '';
        const fallback =
          myProfile.role === 'admin' ? 'SLA Administration' : 'Grade 10 - St. Lorenzo';
        const resolved = (privSection || fallback).slice(0, 40);
        if (!cancelled) {
          await updateDoc(doc(db, 'publicProfiles', user.uid), {
            section: resolved,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Ignore backfill errors
      }
    };
    void backfillSection();
    return () => {
      cancelled = true;
    };
  }, [user, myProfile]);

  // Attach classroom listeners once user profile is established
  useEffect(() => {
    if (!authReady || !user || !myProfile) return;

    const isFaculty = myProfile.role === 'teacher' || myProfile.role === 'admin';
    const isAdminUser = myProfile.role === 'admin';

    const unsubAllProfiles = onSnapshot(
      query(collection(db, 'publicProfiles'), where('role', 'in', ['student', 'teacher', 'admin'])),
      (snap) => {
        setAllProfiles(snap.docs.map((d) => d.data() as PublicProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'publicProfiles')
    );

    const unsubDecks = isFaculty
      ? onSnapshot(
          query(collection(db, 'quizDecks'), where('teacherId', '==', user.uid)),
          (snap) => {
            setOwnDecks(snap.docs.map((d) => d.data() as QuizDeck));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'quizDecks')
        )
      : () => {};

    const unsubPublishedDecks = onSnapshot(
      query(collection(db, 'quizDecks'), where('isPublished', '==', true)),
      (snap) => {
        setPublishedDecks(snap.docs.map((d) => d.data() as QuizDeck));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'quizDecks')
    );

    const unsubScores = onSnapshot(
      query(collection(db, 'scoreRecords'), where('score', '>=', 0)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ScoreRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setScoreRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'scoreRecords')
    );

    const unsubAlerts = onSnapshot(
      isFaculty
        ? query(collection(db, 'antiCheatAlerts'), where('status', 'in', ['locked', 'allowed']))
        : query(collection(db, 'antiCheatAlerts'), where('studentId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as AntiCheatAlert);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setAlerts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'antiCheatAlerts')
    );

    const unsubFaculty = isAdminUser
      ? onSnapshot(
          query(collection(db, 'authorizedFaculty'), where('role', 'in', ['teacher', 'admin'])),
          (snap) => {
            setAuthorizedFaculty(snap.docs.map((d) => d.data() as AuthorizedFaculty));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'authorizedFaculty')
        )
      : () => {};

    const unsubAccessCodes = isAdminUser
      ? onSnapshot(
          doc(db, 'config', 'accessCodes'),
          (snap) => {
            if (snap.exists()) {
              const cfg = snap.data() as AccessCodesConfig;
              setAccessCodes({
                teacherCode: cfg.teacherCode || DEFAULT_ACCESS_CODES.teacherCode,
                adminCode: cfg.adminCode || DEFAULT_ACCESS_CODES.adminCode,
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.GET, 'config/accessCodes')
        )
      : () => {};

    return () => {
      unsubAllProfiles();
      unsubDecks();
      unsubPublishedDecks();
      unsubScores();
      unsubAlerts();
      unsubFaculty();
      unsubAccessCodes();
    };
  }, [authReady, user, myProfile?.uid, myProfile?.role]);

  // Real-time online/offline presence heartbeat for Teacher & Admin monitoring
  useEffect(() => {
    if (!authReady || !user || !myProfile?.uid) return;
    const profileRef = doc(db, 'publicProfiles', user.uid);

    const markOnline = () => {
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
      void updateDoc(profileRef, {
        isOnline: true,
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    };

    const markOffline = () => {
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;
      void updateDoc(profileRef, {
        isOnline: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    };

    markOnline();

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        markOnline();
      }
    }, 40_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        markOnline();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', markOffline);
    window.addEventListener('beforeunload', markOffline);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', markOffline);
      window.removeEventListener('beforeunload', markOffline);
    };
  }, [authReady, user, myProfile?.uid]);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `This website address (${host}) is not authorized in Firebase Authentication yet. Open Firebase Console → Authentication → Settings → Authorized domains and add "${host}".`
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Your browser blocked the Google Sign-In popup. Please allow popups for this site and click Continue with Google again.'
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google Sign-In was closed before finishing. Click Continue with Google to try again.');
      } else if (code === 'auth/operation-not-allowed') {
        setAuthError(
          'Google Sign-In is disabled in Firebase Console. Enable Google under Authentication → Sign-in method.'
        );
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Network error while connecting to Google Sign-In. Check your internet connection and try again.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFullSignOut = async () => {
    if (user && myProfile) {
      try {
        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          isOnline: false,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Proceed with sign-out
      }
    }
    await signOut(auth);
  };

  const handleCompleteOnboarding = async (data: {
    displayName: string;
    section: string;
    role: UserRole;
    petSpecies: PetSpecies;
    petName: string;
    petColor: string;
    outfit: string;
    accessory: string;
    photoUrl: string;
  }) => {
    if (!user) return;
    const profilePayload: PublicProfile = {
      uid: user.uid,
      displayName: data.displayName,
      role: data.role,
      petSpecies: data.petSpecies,
      petName: data.petName,
      petLevel: 1,
      petXp: 0,
      coins: 120,
      outfit: data.outfit,
      accessory: data.accessory,
      petColor: data.petColor,
      uniformStyle: data.role === 'teacher' || data.role === 'admin' ? 'faculty_blazer' : 'sla_polo',
      unlockedItems: [data.outfit, data.accessory],
      hunger: 85,
      happiness: 90,
      energy: 90,
      cleanliness: 95,
      totalScore: 0,
      gamesPlayed: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      isSleeping: false,
      lockedOut: false,
      lockReason: '',
      activeGame: 'Lobby',
      section: data.section,
      photoUrl: data.photoUrl || '',
      isOnline: true,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'publicProfiles', user.uid), profilePayload);
      await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
        uid: user.uid,
        email: user.email || 'student@sanlorenzo.edu',
        section: data.section,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `publicProfiles/${user.uid}`);
    }
  };

  const handleUpdateProfile = useCallback(
    async (patch: Partial<PublicProfile>) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${user.uid}`);
      }
    },
    [user]
  );

  const handleTriggerCheatLock = useCallback(
    async (gameId: string, gameTitle: string, subject: string, reason: string) => {
      if (!user || !myProfile || myProfile.lockedOut) return;
      const alertId = `alert_${user.uid}_${Date.now()}`;
      const strikeNum = alerts.filter((a) => a.studentId === user.uid).length + 1;
      const coinPenalty = strikeNum >= 2 ? 15 : 0;
      const formattedReason = `[Strike #${strikeNum}] ${reason}${
        coinPenalty > 0 ? ` (-${coinPenalty} Coins)` : ''
      }`.slice(0, 140);

      try {
        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          lockedOut: true,
          lockReason: formattedReason,
          activeGame: `${gameTitle.slice(0, 48)} (Locked)`,
          coins: Math.max(0, myProfile.coins - coinPenalty),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'antiCheatAlerts', alertId), {
          id: alertId,
          studentId: user.uid,
          studentName: myProfile.displayName,
          petName: myProfile.petName,
          gameId,
          gameTitle,
          subject,
          reason: formattedReason,
          status: 'locked',
          resolvedBy: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `antiCheatAlerts/${alertId}`);
      }
    },
    [alerts, myProfile, user]
  );

  const handleAllowStudent = useCallback(
    async (alert: AntiCheatAlert) => {
      if (!myProfile) return;
      try {
        await updateDoc(doc(db, 'antiCheatAlerts', alert.id), {
          status: 'allowed',
          resolvedBy: myProfile.displayName,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'publicProfiles', alert.studentId), {
          lockedOut: false,
          lockReason: '',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `antiCheatAlerts/${alert.id}`);
      }
    },
    [myProfile]
  );

  const handleRecordGameResult = useCallback(
    async (gameId: GameId, gameTitle: string, deck: QuizDeck, result: GameSessionResult) => {
      if (!user || !myProfile) return;
      const safeScore = Math.min(100000, Math.max(0, Math.round(result.score)));
      const safeCorrect = Math.min(500, Math.max(0, Math.round(result.correctCount)));
      const safeTotal = Math.min(500, Math.max(safeCorrect, Math.round(result.totalCount)));
      const safeDuration = Math.min(7200, Math.max(1, Math.round(result.durationSeconds)));

      const recordId = `rec_${user.uid}_${Date.now()}`;
      const earnedCoins = Math.max(15, Math.round(safeScore / 3));
      let nextXp = myProfile.petXp + Math.max(20, Math.round(safeScore / 2));
      let nextLevel = myProfile.petLevel;
      while (nextXp >= nextLevel * 100) {
        nextXp -= nextLevel * 100;
        nextLevel += 1;
      }

      try {
        await setDoc(doc(db, 'scoreRecords', recordId), {
          id: recordId,
          studentId: user.uid,
          studentName: myProfile.displayName,
          petName: myProfile.petName,
          petSpecies: myProfile.petSpecies,
          gameId,
          gameTitle: gameTitle.slice(0, 60),
          subject: deck.subject.slice(0, 50),
          deckId: deck.id.slice(0, 80),
          score: safeScore,
          correctCount: safeCorrect,
          totalCount: safeTotal,
          durationSeconds: safeDuration,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          totalScore: Math.min(10000000, myProfile.totalScore + safeScore),
          coins: Math.min(1000000, myProfile.coins + earnedCoins),
          petXp: Math.min(1000000, nextXp),
          petLevel: Math.min(999, nextLevel),
          gamesPlayed: Math.min(100000, myProfile.gamesPlayed + 1),
          correctAnswers: Math.min(1000000, myProfile.correctAnswers + safeCorrect),
          totalAnswers: Math.min(1000000, myProfile.totalAnswers + safeTotal),
          happiness: Math.min(100, myProfile.happiness + 10),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `scoreRecords/${recordId}`);
      }
    },
    [myProfile, user]
  );

  const handleAwardStudent = useCallback(async (studentUid: string, points: number) => {
    const target = allProfiles.find((p) => p.uid === studentUid);
    if (!target) return;
    const safePoints = Math.max(0, Math.round(points));
    let nextXp = target.petXp + safePoints;
    let nextLevel = target.petLevel;
    while (nextXp >= nextLevel * 100) {
      nextXp -= nextLevel * 100;
      nextLevel += 1;
    }
    try {
      await updateDoc(doc(db, 'publicProfiles', studentUid), {
        totalScore: Math.min(10000000, target.totalScore + safePoints),
        coins: Math.min(1000000, target.coins + Math.round(safePoints / 2)),
        petXp: Math.min(1000000, nextXp),
        petLevel: Math.min(999, nextLevel),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${studentUid}`);
    }
  }, [allProfiles]);

  const handleSaveDeck = useCallback(async (deck: Omit<QuizDeck, 'createdAt' | 'updatedAt'>) => {
    try {
      await setDoc(doc(db, 'quizDecks', deck.id), {
        ...deck,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `quizDecks/${deck.id}`);
    }
  }, []);

  const handleUpdateDeck = useCallback(
    async (
      deckId: string,
      patch: Pick<QuizDeck, 'title' | 'subject' | 'description' | 'sourceType' | 'questions' | 'isPublished'>
    ) => {
      try {
        await updateDoc(doc(db, 'quizDecks', deckId), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `quizDecks/${deckId}`);
      }
    },
    []
  );

  const handleDeleteDeck = useCallback(async (deckId: string) => {
    try {
      await deleteDoc(doc(db, 'quizDecks', deckId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quizDecks/${deckId}`);
    }
  }, []);

  const handleAddAuthorizedFaculty = useCallback(
    async (email: string, fullName: string, role: 'teacher') => {
      if (!user) return;
      const cleanEmail = email.trim().toLowerCase();
      try {
        await setDoc(doc(db, 'authorizedFaculty', cleanEmail), {
          email: cleanEmail,
          fullName: fullName.trim().slice(0, 60),
          role,
          addedBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `authorizedFaculty/${cleanEmail}`);
      }
    },
    [user]
  );

  const handleRemoveAuthorizedFaculty = useCallback(async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await deleteDoc(doc(db, 'authorizedFaculty', cleanEmail));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `authorizedFaculty/${cleanEmail}`);
    }
  }, []);

  const handleUpdateUserRole = useCallback(async (uid: string, nextRole: 'student' | 'teacher') => {
    if (user && uid === user.uid) {
      throw new Error('You cannot change your own active Admin role here.');
    }
    try {
      await updateDoc(doc(db, 'publicProfiles', uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${uid}`);
    }
  }, [user]);

  const handleUpdateOwnSection = useCallback(
    async (nextSection: string) => {
      if (!user) return;
      const cleanSec = nextSection.trim().slice(0, 40);
      if (!cleanSec) return;
      try {
        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          section: cleanSec,
          updatedAt: serverTimestamp(),
        });
        const privRef = doc(db, 'users', user.uid, 'private', 'info');
        const privSnap = await getDoc(privRef);
        if (privSnap.exists()) {
          await updateDoc(privRef, {
            section: cleanSec,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${user.uid}`);
      }
    },
    [user]
  );

  const handleAssignStudentSection = useCallback(async (studentUid: string, nextSection: string) => {
    const cleanSec = nextSection.trim().slice(0, 40);
    if (!cleanSec) return;
    try {
      await updateDoc(doc(db, 'publicProfiles', studentUid), {
        section: cleanSec,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${studentUid}`);
    }
  }, []);

  const handleClaimRoleWithCode = useCallback(
    async (targetRole: 'teacher' | 'admin', accessCode: string) => {
      if (!user) throw new Error('Please sign in with Google first.');
      if (myProfile?.role === 'teacher' && targetRole === 'admin') {
        throw new Error('Teachers cannot upgrade to Admin. Use an Admin account with the Admin Secret Code.');
      }
      const trimmedCode = accessCode.trim();
      const claimRef = doc(db, 'roleClaims', user.uid);
      try {
        const existingClaim = await getDoc(claimRef);
        if (existingClaim.exists()) {
          await updateDoc(claimRef, {
            targetRole,
            accessCode: trimmedCode,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(claimRef, {
            uid: user.uid,
            targetRole,
            accessCode: trimmedCode,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        throw new Error(
          `Invalid ${targetRole === 'admin' ? 'Admin' : 'Teacher'} Secret Code. Please verify with your SLA Administrator.`
        );
      }

      setAuthorizedRole(targetRole);
      if (myProfile) {
        try {
          await updateDoc(doc(db, 'publicProfiles', user.uid), {
            role: targetRole,
            uniformStyle: 'faculty_blazer',
            outfit:
              myProfile.outfit === 'outfit_sla_polo' ? 'outfit_teacher_blazer' : myProfile.outfit,
            section:
              myProfile.section ||
              (targetRole === 'admin' ? 'SLA Administration' : 'Grade 10 - St. Lorenzo'),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${user.uid}`);
        }
      }
    },
    [user, myProfile]
  );

  const handleUpdateAccessCodes = useCallback(
    async (teacherCode: string, adminCode: string) => {
      if (!user) return;
      const cleanTeach = teacherCode.trim();
      const cleanAdmin = adminCode.trim();
      if (cleanTeach === cleanAdmin) {
        throw new Error('Teacher Secret Code and Admin Secret Code must be different.');
      }
      try {
        await setDoc(doc(db, 'config', 'accessCodes'), {
          teacherCode: cleanTeach,
          adminCode: cleanAdmin,
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'config/accessCodes');
      }
    },
    [user]
  );

  const customDecks = useMemo(() => {
    const byId = new Map<string, QuizDeck>();
    publishedDecks.forEach((d) => byId.set(d.id, d));
    ownDecks.forEach((d) => byId.set(d.id, d));
    return Array.from(byId.values());
  }, [ownDecks, publishedDecks]);

  const allDecks = useMemo(
    () => [...customDecks.filter((d) => d.isPublished), ...BUILTIN_DECKS],
    [customDecks]
  );
  const lockedAlerts = useMemo(() => {
    const activeLocked = alerts.filter((a) => a.status === 'locked');
    if (myProfile?.role === 'teacher' && myProfile.section?.trim()) {
      const teacherSec = myProfile.section.trim();
      const myStudentIds = new Set(
        allProfiles
          .filter((p) => p.role === 'student' && (p.section || '').trim() === teacherSec)
          .map((p) => p.uid)
      );
      return activeLocked.filter((a) => myStudentIds.has(a.studentId));
    }
    return activeLocked;
  }, [alerts, allProfiles, myProfile?.role, myProfile?.section]);
  const lockedAlertCount = lockedAlerts.length;
  const prevLockedCountRef = useRef(0);

  // Global audible Teacher/Admin siren across all tabs when a student in view triggers the Cheating Detector
  useEffect(() => {
    const isFaculty = myProfile?.role === 'teacher' || myProfile?.role === 'admin';
    if (isFaculty && lockedAlertCount > prevLockedCountRef.current) {
      soundFx.playAlertSiren();
    }
    prevLockedCountRef.current = lockedAlertCount;
  }, [lockedAlertCount, myProfile?.role]);

  const handleToggleMute = () => {
    const next = !muted;
    soundFx.setMuted(next);
    setMuted(next);
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF8F2] flex items-center justify-center text-sm font-semibold text-[#1E5B3A]">
        Connecting to San Lorenzo Academy...
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        portalMode={portalMode}
        onChangePortalMode={setPortalMode}
        onGoogleLogin={handleGoogleLogin}
        loading={authLoading}
        error={authError}
      />
    );
  }


  if (!profileLoaded || !authzChecked) {
    return (
      <div className="min-h-screen bg-[var(--lz-bg)] flex items-center justify-center text-sm font-semibold text-[#1E5B3A]">
        Loading your LORENZONE companion...
      </div>
    );
  }

  if (!myProfile) {
    const safeGooglePhoto =
      user.photoURL &&
      /^https:\/\/[a-zA-Z0-9._-]+googleusercontent\.com\/.+$/.test(user.photoURL)
        ? user.photoURL
        : '';
    return (
      <OnboardingStudio
        defaultName={user.displayName || 'SLA Learner'}
        defaultPhotoUrl={safeGooglePhoto}
        email={user.email || ''}
        authorizedRole={authorizedRole}
        defaultPortalMode={portalMode}
        onClaimRoleWithCode={handleClaimRoleWithCode}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--lz-bg)] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="bg-[var(--lz-header-bg)] border-b border-[var(--lz-header-border)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            className="text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0"
            style={{ color: 'var(--lz-header-brand-left)' }}
          >
            LOREN<span style={{ color: 'var(--lz-header-brand-right)' }}>ZONE</span>
          </a>

          <nav className="flex items-center gap-6 text-sm font-semibold overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setActiveTab('home');
              }}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)]'
                  : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)]'
              }`}
            >
              Pet Home
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setLaunchGameId(null);
                setActiveTab('games');
              }}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'games'
                  ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)]'
                  : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)]'
              }`}
            >
              Quiz Games
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setActiveTab('leaderboard');
              }}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)]'
                  : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)]'
              }`}
            >
              Leaderboard
            </button>
            {(myProfile.role === 'teacher' || myProfile.role === 'admin') && (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab('monitor');
                }}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'monitor'
                    ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)]'
                    : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)]'
                }`}
              >
                {myProfile.role === 'admin' ? 'Admin & Monitor' : 'Teacher Monitor'}
              </button>
            )}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setLaunchGameId(null);
                setActiveTab('games');
              }}
              className="px-4 py-2 rounded-xl bg-[var(--lz-header-cta-bg)] hover:bg-[var(--lz-header-cta-hover)] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <UtilityToolbar
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenInstructions={() => setShowInstructions(true)}
          onOpenQuestionsHelp={() => setShowGameRules(true)}
          onOpenSettings={() => setShowSettings(true)}
          theme={theme}
          onChangeTheme={setTheme}
          role={myProfile.role}
          section={myProfile.section}
          lockedAlertCount={lockedAlertCount}
        />

        {(myProfile.role === 'teacher' || myProfile.role === 'admin') &&
          lockedAlerts.length > 0 &&
          activeTab !== 'monitor' && (
            <div className="rounded-2xl border-2 border-red-500 bg-red-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertOctagon className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-extrabold text-red-900">
                    Cheating Detector Alert: {lockedAlerts[0].studentName}{' '}
                    {lockedAlerts.length > 1 ? `(+${lockedAlerts.length - 1} more)` : ''} locked
                  </p>
                  <p className="text-red-700">{lockedAlerts[0].reason}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playCorrect();
                    void handleAllowStudent(lockedAlerts[0]);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1E5B3A] text-white text-xs font-bold cursor-pointer"
                >
                  Allow Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setActiveTab('monitor');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-red-300 text-red-800 text-xs font-bold cursor-pointer"
                >
                  Open Monitor
                </button>
              </div>
            </div>
          )}

        {activeTab === 'home' && (
          <PetHomeAndCare
            profile={myProfile}
            records={scoreRecords}
            onUpdateProfile={handleUpdateProfile}
            onOpenGames={() => setActiveTab('games')}
          />
        )}

        {activeTab === 'games' && (
          <MiniGamesHub
            profile={myProfile}
            allProfiles={allProfiles}
            decks={allDecks}
            alerts={alerts}
            initialGameId={launchGameId}
            onTriggerCheatLock={handleTriggerCheatLock}
            onRecordGameResult={handleRecordGameResult}
            onAwardStudent={handleAwardStudent}
            onSetActiveGame={(activeGame) => handleUpdateProfile({ activeGame })}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            profiles={allProfiles}
            records={scoreRecords}
            alerts={alerts}
            currentUid={myProfile.uid}
            currentRole={myProfile.role}
            currentSection={myProfile.section}
          />
        )}

        {activeTab === 'monitor' && (myProfile.role === 'teacher' || myProfile.role === 'admin') && (
          <TeacherMonitor
            teacherProfile={myProfile}
            allProfiles={allProfiles}
            alerts={alerts}
            records={scoreRecords}
            customDecks={customDecks}
            authorizedFaculty={authorizedFaculty}
            onAllowStudent={handleAllowStudent}
            onSaveDeck={handleSaveDeck}
            onUpdateDeck={handleUpdateDeck}
            onDeleteDeck={handleDeleteDeck}
            onLaunchTeacherGame={(gId) => {
              setLaunchGameId(gId);
              setActiveTab('games');
            }}
            onAddAuthorizedFaculty={handleAddAuthorizedFaculty}
            onRemoveAuthorizedFaculty={handleRemoveAuthorizedFaculty}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateOwnSection={handleUpdateOwnSection}
            onAssignStudentSection={handleAssignStudentSection}
            accessCodes={accessCodes}
            onUpdateAccessCodes={handleUpdateAccessCodes}
          />
        )}
      </main>

      <footer className="py-5 px-6 text-center text-xs text-[#4D6354] border-t border-[var(--lz-border)] bg-[var(--lz-footer-bg)]">
        San Lorenzo Academy, Inc. · LORENZONE Capstone Learning Platform
      </footer>

      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
      {showGameRules && <GameRulesModal onClose={() => setShowGameRules(false)} />}
      {showSettings && (
        <SettingsModal
          profile={myProfile}
          email={user.email || ''}
          muted={muted}
          onToggleMute={handleToggleMute}
          theme={theme}
          onChangeTheme={setTheme}
          onUpdateSection={handleUpdateOwnSection}
          onClaimRoleWithCode={handleClaimRoleWithCode}
          onSignOut={async () => {
            await handleFullSignOut();
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LorenzoneApp />
    </ErrorBoundary>
  );
}
