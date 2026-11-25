import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertOctagon, Lock } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import { BUILTIN_DECKS, GAMES_CATALOG } from './data/defaultDecks';
import {
  applyXpGain,
  calculateQuizRewards,
  STARTING_COINS,
  STARTER_FOOD_INVENTORY,
} from './lib/progression';
import {
  AccessCodesConfig,
  AntiCheatAlert,
  AppTab,
  AuthorizedFaculty,
  ClassroomSession,
  GameId,
  PetSpecies,
  PublicProfile,
  QuizDeck,
  SchoolIdVerification,
  ScoreRecord,
  SectionChangeRequest,
  ThemeColor,
  UserRole,
} from './types';
import {
  AuthScreen,
  OnboardingStudio,
  PendingApprovalScreen,
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

function sectionToSessionId(section: string): string {
  const clean = section.trim().toLowerCase();
  const slug = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'class';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0;
  }
  const hashHex = (hash >>> 0).toString(36);
  return `room_${slug}_${hashHex}`;
}

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
  const [classroomSessions, setClassroomSessions] = useState<ClassroomSession[]>([]);
  const [myIdVerification, setMyIdVerification] = useState<SchoolIdVerification | null>(null);
  const [myIdVerificationLoaded, setMyIdVerificationLoaded] = useState(false);
  const [schoolIdVerifications, setSchoolIdVerifications] = useState<SchoolIdVerification[]>([]);
  const [mySectionRequest, setMySectionRequest] = useState<SectionChangeRequest | null>(null);
  const [sectionChangeRequests, setSectionChangeRequests] = useState<SectionChangeRequest[]>([]);
  const [completedClassSessionKeys, setCompletedClassSessionKeys] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('lorenzone_completed_class_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  });
  const lastAutoLaunchedSessionKeyRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [launchGameId, setLaunchGameId] = useState<GameId | null>(null);
  const [launchDeckId, setLaunchDeckId] = useState<string | null>(null);

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
        setMyIdVerification(null);
        setMyIdVerificationLoaded(false);
        setSchoolIdVerifications([]);
        setMySectionRequest(null);
        setSectionChangeRequests([]);
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
    if (!authReady || !user) {
      setMyProfile(null);
      setProfileLoaded(false);
      setAuthorizedRole(null);
      setAuthzChecked(false);
      return;
    }

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

  const isUnapprovedStudent = Boolean(
    myProfile && myProfile.role === 'student' && myProfile.approvalStatus !== 'approved'
  );

  // Admin lands directly in Admin Control Center (no Pet Home or Quiz Games)
  useEffect(() => {
    if (myProfile?.role === 'admin' && (activeTab === 'home' || activeTab === 'games')) {
      setActiveTab('monitor');
    }
  }, [myProfile?.role, activeTab]);

  // Listen to current student's own School ID verification doc when pending/rejected
  useEffect(() => {
    if (!authReady || !user || !myProfile || myProfile.role !== 'student') {
      setMyIdVerification(null);
      setMyIdVerificationLoaded(false);
      return;
    }

    const verifRef = doc(db, 'schoolIdVerifications', user.uid);
    const unsubVerif = onSnapshot(
      verifRef,
      (snap) => {
        setMyIdVerification(snap.exists() ? (snap.data() as SchoolIdVerification) : null);
        setMyIdVerificationLoaded(true);
      },
      () => {
        setMyIdVerificationLoaded(true);
      }
    );

    return () => unsubVerif();
  }, [authReady, user, myProfile?.uid, myProfile?.role]);

  // Listen to student's own Grade & Section spelling change request (works both before and after ID approval)
  useEffect(() => {
    if (!authReady || !user || !myProfile || myProfile.role !== 'student') {
      setMySectionRequest(null);
      return;
    }

    const reqRef = doc(db, 'sectionChangeRequests', user.uid);
    const unsubReq = onSnapshot(
      reqRef,
      (snap) => {
        setMySectionRequest(snap.exists() ? (snap.data() as SectionChangeRequest) : null);
      },
      () => {}
    );

    return () => unsubReq();
  }, [authReady, user, myProfile?.uid, myProfile?.role]);

  // Attach classroom listeners once user profile is established and student is approved
  useEffect(() => {
    if (!authReady || !user || !myProfile || isUnapprovedStudent) return;

    const isTeacherUser = myProfile.role === 'teacher';
    const isAdminUser = myProfile.role === 'admin';

    const unsubAllProfiles = onSnapshot(
      query(collection(db, 'publicProfiles'), where('role', 'in', ['student', 'teacher', 'admin'])),
      (snap) => {
        setAllProfiles(snap.docs.map((d) => d.data() as PublicProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'publicProfiles')
    );

    const unsubDecks = isTeacherUser
      ? onSnapshot(
          query(collection(db, 'quizDecks'), where('teacherId', '==', user.uid)),
          (snap) => {
            setOwnDecks(snap.docs.map((d) => d.data() as QuizDeck));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'quizDecks')
        )
      : () => {};

    const unsubPublishedDecks = !isAdminUser
      ? onSnapshot(
          query(collection(db, 'quizDecks'), where('isPublished', '==', true)),
          (snap) => {
            setPublishedDecks(snap.docs.map((d) => d.data() as QuizDeck));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'quizDecks')
        )
      : () => {};

    const unsubScores = onSnapshot(
      query(collection(db, 'scoreRecords'), where('score', '>=', 0)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ScoreRecord);
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setScoreRecords(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'scoreRecords')
    );

    // Admins do not use Anti-Cheat Detect
    const unsubAlerts = isAdminUser
      ? () => {
          setAlerts([]);
        }
      : onSnapshot(
          isTeacherUser
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

    const unsubVerifications = isAdminUser
      ? onSnapshot(
          query(
            collection(db, 'schoolIdVerifications'),
            where('status', 'in', ['pending', 'approved', 'rejected'])
          ),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as SchoolIdVerification);
            list.sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));
            setSchoolIdVerifications(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'schoolIdVerifications')
        )
      : () => {};

    const unsubSectionRequests = isAdminUser
      ? onSnapshot(
          query(
            collection(db, 'sectionChangeRequests'),
            where('status', 'in', ['pending', 'approved', 'rejected'])
          ),
          (snap) => {
            const list = snap.docs.map((d) => d.data() as SectionChangeRequest);
            list.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));
            setSectionChangeRequests(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'sectionChangeRequests')
        )
      : () => {};

    const unsubClassSessions = !isAdminUser
      ? onSnapshot(
          query(collection(db, 'classroomSessions'), where('status', 'in', ['active', 'ended'])),
          (snap) => {
            setClassroomSessions(snap.docs.map((d) => d.data() as ClassroomSession));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'classroomSessions')
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
      unsubVerifications();
      unsubSectionRequests();
      unsubClassSessions();
    };
  }, [authReady, user, myProfile?.uid, myProfile?.role, isUnapprovedStudent]);

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

  // Passive pet care decay: only for approved non-admin users who actually use pets
  const initialDecayDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!authReady || !user || !myProfile?.uid || myProfile.role === 'admin' || isUnapprovedStudent) return;
    if (initialDecayDoneRef.current === myProfile.uid) return;
    initialDecayDoneRef.current = myProfile.uid;

    const toMs = (val: unknown): number => {
      if (!val || typeof val !== 'object') return 0;
      const maybeTs = val as { toMillis?: () => number; seconds?: number };
      if (typeof maybeTs.toMillis === 'function') return maybeTs.toMillis();
      if (typeof maybeTs.seconds === 'number') return maybeTs.seconds * 1000;
      return 0;
    };

    const lastMs = toMs(myProfile.lastSeenAt) || toMs(myProfile.updatedAt);
    if (lastMs > 0) {
      const elapsedMins = Math.floor((Date.now() - lastMs) / 60_000);
      if (elapsedMins >= 25) {
        const steps = Math.min(45, Math.floor(elapsedMins / 20));
        if (steps > 0) {
          const nextHunger = Math.max(10, myProfile.hunger - steps * 2);
          const nextClean = Math.max(10, myProfile.cleanliness - Math.floor(steps * 1.5));
          const nextJoy = Math.max(12, myProfile.happiness - steps);
          const nextEnergy = myProfile.isSleeping
            ? Math.min(100, myProfile.energy + steps * 4)
            : Math.max(14, myProfile.energy - steps);
          void updateDoc(doc(db, 'publicProfiles', user.uid), {
            hunger: nextHunger,
            cleanliness: nextClean,
            happiness: nextJoy,
            energy: nextEnergy,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    }
  }, [authReady, user, myProfile, isUnapprovedStudent]);

  useEffect(() => {
    if (!authReady || !user || !myProfile?.uid || myProfile.role === 'admin' || isUnapprovedStudent) return;
    const decayTimer = window.setInterval(() => {
      const curr = myProfileRef.current;
      if (!curr || curr.role === 'admin' || document.visibilityState === 'hidden') return;
      const nextHunger = Math.max(8, curr.hunger - 2);
      const nextClean = Math.max(8, curr.cleanliness - 2);
      const nextJoy = Math.max(10, curr.happiness - 1);
      const nextEnergy = curr.isSleeping
        ? Math.min(100, curr.energy + 5)
        : Math.max(10, curr.energy - 1);

      if (
        nextHunger === curr.hunger &&
        nextClean === curr.cleanliness &&
        nextJoy === curr.happiness &&
        nextEnergy === curr.energy
      ) {
        return;
      }

      void updateDoc(doc(db, 'publicProfiles', user.uid), {
        hunger: nextHunger,
        cleanliness: nextClean,
        happiness: nextJoy,
        energy: nextEnergy,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }, 75_000);

    return () => window.clearInterval(decayTimer);
  }, [authReady, user, myProfile?.uid, myProfile?.role, isUnapprovedStudent]);

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
          activeGame: 'Idle',
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
    schoolIdNumber?: string;
    schoolIdPhotoUrl?: string;
  }) => {
    if (!user) return;
    const profilePayload: PublicProfile = {
      uid: user.uid,
      displayName: data.displayName,
      role: data.role,
      approvalStatus: data.role === 'student' ? 'pending' : 'approved',
      approvalNote: '',
      petSpecies: data.petSpecies,
      petName: data.petName,
      petLevel: 1,
      petXp: 0,
      coins: STARTING_COINS,
      outfit: data.outfit,
      accessory: data.accessory,
      petColor: data.petColor,
      uniformStyle: data.role === 'teacher' || data.role === 'admin' ? 'faculty_blazer' : 'sla_polo',
      unlockedItems: [data.outfit, data.accessory],
      foodInventory: STARTER_FOOD_INVENTORY,
      hunger: 75,
      happiness: 85,
      energy: 85,
      cleanliness: 90,
      totalScore: 0,
      gamesPlayed: 0,
      correctAnswers: 0,
      totalAnswers: 0,
      isSleeping: false,
      lockedOut: false,
      lockReason: '',
      activeGame:
        data.role === 'admin'
          ? 'Admin Control Center'
          : data.role === 'teacher'
            ? 'Teacher Room'
            : 'Pet Home Room',
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
      if (data.role === 'student' && data.schoolIdNumber && data.schoolIdPhotoUrl) {
        await setDoc(doc(db, 'schoolIdVerifications', user.uid), {
          uid: user.uid,
          studentName: data.displayName,
          email: user.email || 'student@sanlorenzo.edu',
          section: data.section,
          schoolIdNumber: data.schoolIdNumber,
          idPhotoUrl: data.schoolIdPhotoUrl,
          status: 'pending',
          reviewedBy: '',
          reviewNote: '',
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      if (data.role === 'admin') {
        setActiveTab('monitor');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `publicProfiles/${user.uid}`);
    }
  };

  const handleSubmitSchoolId = useCallback(
    async (data: { section: string; schoolIdNumber: string; idPhotoUrl: string }) => {
      if (!user || !myProfile) return;
      const verifRef = doc(db, 'schoolIdVerifications', user.uid);
      const existingSnap = await getDoc(verifRef);
      const existingProfileSec = (myProfile.section || '').trim().slice(0, 40);
      const existingVerifSec = existingSnap.exists()
        ? String((existingSnap.data() as SchoolIdVerification).section || '').trim().slice(0, 40)
        : '';
      const lockedSec = existingVerifSec || existingProfileSec || data.section.trim().slice(0, 40);

      const payload = {
        studentName: myProfile.displayName.slice(0, 60),
        email: (user.email || 'student@sanlorenzo.edu').slice(0, 120),
        section: lockedSec,
        schoolIdNumber: data.schoolIdNumber.slice(0, 40),
        idPhotoUrl: data.idPhotoUrl,
        status: 'pending' as const,
        reviewedBy: '',
        reviewNote: '',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        if (existingSnap.exists()) {
          await updateDoc(verifRef, payload);
        } else {
          await setDoc(verifRef, {
            uid: user.uid,
            ...payload,
          });
        }
        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          ...(!existingProfileSec && lockedSec ? { section: lockedSec } : {}),
          approvalStatus: 'pending',
          approvalNote: '',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `schoolIdVerifications/${user.uid}`);
      }
    },
    [myProfile, user]
  );

  const handleReviewStudentApproval = useCallback(
    async (studentUid: string, decision: 'approved' | 'rejected', note: string) => {
      if (!myProfile || myProfile.role !== 'admin') return;
      const cleanNote = note.trim().slice(0, 140);
      try {
        await updateDoc(doc(db, 'publicProfiles', studentUid), {
          approvalStatus: decision,
          approvalNote: cleanNote,
          updatedAt: serverTimestamp(),
        });
        const verifRef = doc(db, 'schoolIdVerifications', studentUid);
        const verifSnap = await getDoc(verifRef);
        if (verifSnap.exists()) {
          await updateDoc(verifRef, {
            status: decision,
            reviewedBy: (myProfile.displayName || 'SLA Admin').slice(0, 60),
            reviewNote: cleanNote,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${studentUid}`);
      }
    },
    [myProfile]
  );

  const handleRequestSectionChange = useCallback(
    async (requestedSection: string, reason: string) => {
      if (!user || !myProfile) return;
      const currentSection = (myProfile.section || '').trim().slice(0, 40) || 'Unassigned';
      const cleanRequested = requestedSection.trim().slice(0, 40);
      const cleanReason = (reason.trim() || 'Fix wrong spelling in Grade & Section').slice(0, 140);
      if (!cleanRequested || cleanRequested === currentSection) {
        throw new Error(
          'Please enter a corrected Grade & Section spelling different from your current section.'
        );
      }
      const reqRef = doc(db, 'sectionChangeRequests', user.uid);
      try {
        const existingSnap = await getDoc(reqRef);
        if (existingSnap.exists()) {
          await updateDoc(reqRef, {
            studentName: (myProfile.displayName || 'SLA Student').slice(0, 60),
            currentSection,
            requestedSection: cleanRequested,
            reason: cleanReason,
            status: 'pending',
            reviewedBy: '',
            reviewNote: '',
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(reqRef, {
            uid: user.uid,
            studentName: (myProfile.displayName || 'SLA Student').slice(0, 60),
            currentSection,
            requestedSection: cleanRequested,
            reason: cleanReason,
            status: 'pending',
            reviewedBy: '',
            reviewNote: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `sectionChangeRequests/${user.uid}`);
      }
    },
    [myProfile, user]
  );

  const handleReviewSectionChange = useCallback(
    async (
      studentUid: string,
      decision: 'approved' | 'rejected',
      finalSection: string,
      note: string
    ) => {
      if (!myProfile || myProfile.role !== 'admin') return;
      const cleanFinalSection = finalSection.trim().slice(0, 40);
      const cleanNote = note.trim().slice(0, 140);
      const reqRef = doc(db, 'sectionChangeRequests', studentUid);
      try {
        const reqSnap = await getDoc(reqRef);
        const resolvedSection =
          cleanFinalSection ||
          (reqSnap.exists()
            ? String((reqSnap.data() as SectionChangeRequest).requestedSection || '').trim().slice(0, 40)
            : '');

        if (reqSnap.exists()) {
          await updateDoc(reqRef, {
            ...(resolvedSection ? { requestedSection: resolvedSection } : {}),
            status: decision,
            reviewedBy: (myProfile.displayName || 'SLA Admin').slice(0, 60),
            reviewNote: cleanNote,
            updatedAt: serverTimestamp(),
          });
        }

        if (decision === 'approved' && resolvedSection) {
          await updateDoc(doc(db, 'publicProfiles', studentUid), {
            section: resolvedSection,
            updatedAt: serverTimestamp(),
          });
          const privRef = doc(db, 'users', studentUid, 'private', 'info');
          const privSnap = await getDoc(privRef);
          if (privSnap.exists()) {
            await updateDoc(privRef, {
              section: resolvedSection,
              updatedAt: serverTimestamp(),
            });
          }
          const verifRef = doc(db, 'schoolIdVerifications', studentUid);
          const verifSnap = await getDoc(verifRef);
          if (verifSnap.exists()) {
            await updateDoc(verifRef, {
              section: resolvedSection,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `sectionChangeRequests/${studentUid}`);
      }
    },
    [myProfile]
  );

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

  const myProfileRef = useRef<PublicProfile | null>(null);
  myProfileRef.current = myProfile;

  const reportActivity = useCallback(
    async (activity: string) => {
      const current = myProfileRef.current;
      if (!user || !current || current.lockedOut) return;
      if (current.role === 'student' && current.approvalStatus !== 'approved') return;
      const clean = activity.trim().slice(0, 60) || 'Lobby';
      if (current.activeGame === clean) return;
      try {
        await updateDoc(doc(db, 'publicProfiles', user.uid), {
          activeGame: clean,
          isOnline: true,
          lastSeenAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking activity indicator update
      }
    },
    [user]
  );

  useEffect(() => {
    if (!myProfile?.uid || myProfile.lockedOut || isUnapprovedStudent) return;
    if (activeTab === 'home') {
      void reportActivity('Pet Home Room');
    } else if (activeTab === 'games') {
      if (!launchGameId) {
        void reportActivity('Browsing Quiz Games');
      }
    } else if (activeTab === 'leaderboard') {
      void reportActivity('Viewing Leaderboard');
    } else if (activeTab === 'monitor') {
      if (myProfile.role === 'admin') {
        void reportActivity('Admin Control Center');
      } else {
        void reportActivity(`Monitoring: ${myProfile.section || 'Classroom'}`);
      }
    }
  }, [
    activeTab,
    launchGameId,
    myProfile?.uid,
    myProfile?.role,
    myProfile?.section,
    myProfile?.lockedOut,
    isUnapprovedStudent,
    reportActivity,
  ]);

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
      const { earnedCoins, earnedXp } = calculateQuizRewards({
        score: safeScore,
        correctCount: safeCorrect,
        totalCount: safeTotal,
      });
      const { petLevel: nextLevel, petXp: nextXp } = applyXpGain(
        myProfile.petLevel,
        myProfile.petXp,
        earnedXp
      );

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
          happiness: Math.min(100, myProfile.happiness + (safeCorrect > 0 ? 6 : 2)),
          energy: Math.max(10, myProfile.energy - 7),
          hunger: Math.max(10, myProfile.hunger - 6),
          cleanliness: Math.max(10, myProfile.cleanliness - 5),
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
    const { petLevel: nextLevel, petXp: nextXp } = applyXpGain(
      target.petLevel,
      target.petXp,
      Math.max(10, Math.round(safePoints / 2))
    );
    try {
      await updateDoc(doc(db, 'publicProfiles', studentUid), {
        totalScore: Math.min(10000000, target.totalScore + safePoints),
        coins: Math.min(1000000, target.coins + Math.max(4, Math.round(safePoints / 5))),
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

  const handleAdminResetApp = useCallback(
    async (options: {
      mode: 'scores_only' | 'full_wipe';
      includeCustomDecks: boolean;
      includeFacultyAllowlist: boolean;
      resetSelfProfile: boolean;
    }): Promise<{
      deletedScores: number;
      deletedAlerts: number;
      deletedDecks: number;
      affectedProfiles: number;
    }> => {
      if (!user || myProfile?.role !== 'admin') {
        throw new Error('Only an Administrator can reset web app data.');
      }

      const commitBatchOps = async (ops: Array<(batch: ReturnType<typeof writeBatch>) => void>) => {
        for (let i = 0; i < ops.length; i += 400) {
          const batch = writeBatch(db);
          ops.slice(i, i + 400).forEach((fn) => fn(batch));
          await batch.commit();
        }
      };

      const [scoresSnap, alertsSnap, profilesSnap, classSessionsSnap, verificationsSnap, sectionReqsSnap] = await Promise.all([
        getDocs(query(collection(db, 'scoreRecords'), where('score', '>=', 0))),
        getDocs(query(collection(db, 'antiCheatAlerts'), where('status', 'in', ['locked', 'allowed']))),
        getDocs(query(collection(db, 'publicProfiles'), where('role', 'in', ['student', 'teacher', 'admin']))),
        getDocs(query(collection(db, 'classroomSessions'), where('status', 'in', ['active', 'ended']))),
        getDocs(
          query(
            collection(db, 'schoolIdVerifications'),
            where('status', 'in', ['pending', 'approved', 'rejected'])
          )
        ),
        getDocs(
          query(
            collection(db, 'sectionChangeRequests'),
            where('status', 'in', ['pending', 'approved', 'rejected'])
          )
        ),
      ]);

      const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

      scoresSnap.docs.forEach((d) => {
        ops.push((batch) => batch.delete(d.ref));
      });
      alertsSnap.docs.forEach((d) => {
        ops.push((batch) => batch.delete(d.ref));
      });
      classSessionsSnap.docs.forEach((d) => {
        ops.push((batch) => batch.delete(d.ref));
      });

      let deletedDecks = 0;
      if (options.includeCustomDecks) {
        deletedDecks = customDecks.length;
        customDecks.forEach((deck) => {
          ops.push((batch) => batch.delete(doc(db, 'quizDecks', deck.id)));
        });
      }

      let affectedProfiles = 0;
      if (options.mode === 'scores_only') {
        profilesSnap.docs.forEach((pDoc) => {
          affectedProfiles += 1;
          ops.push((batch) =>
            batch.update(pDoc.ref, {
              petLevel: 1,
              petXp: 0,
              coins: STARTING_COINS,
              foodInventory: STARTER_FOOD_INVENTORY,
              hunger: 75,
              happiness: 85,
              energy: 85,
              cleanliness: 90,
              totalScore: 0,
              gamesPlayed: 0,
              correctAnswers: 0,
              totalAnswers: 0,
              isSleeping: false,
              lockedOut: false,
              lockReason: '',
              activeGame: pDoc.id === user.uid ? 'Admin Control Center' : 'Pet Home Room',
              updatedAt: serverTimestamp(),
            })
          );
        });
        await commitBatchOps(ops);
      } else {
        if (options.includeFacultyAllowlist) {
          const facultySnap = await getDocs(
            query(collection(db, 'authorizedFaculty'), where('role', 'in', ['teacher', 'admin']))
          );
          facultySnap.docs.forEach((fDoc) => {
            ops.push((batch) => batch.delete(fDoc.ref));
          });
        }

        verificationsSnap.docs.forEach((vDoc) => {
          ops.push((batch) => batch.delete(vDoc.ref));
        });

        sectionReqsSnap.docs.forEach((sDoc) => {
          ops.push((batch) => batch.delete(sDoc.ref));
        });

        profilesSnap.docs.forEach((pDoc) => {
          if (pDoc.id === user.uid) return;
          affectedProfiles += 1;
          ops.push((batch) => batch.delete(pDoc.ref));
          ops.push((batch) => batch.delete(doc(db, 'users', pDoc.id, 'private', 'info')));
          ops.push((batch) => batch.delete(doc(db, 'roleClaims', pDoc.id)));
        });

        if (options.resetSelfProfile) {
          affectedProfiles += 1;
          ops.push((batch) => batch.delete(doc(db, 'publicProfiles', user.uid)));
          ops.push((batch) => batch.delete(doc(db, 'users', user.uid, 'private', 'info')));
        } else {
          ops.push((batch) =>
            batch.update(doc(db, 'publicProfiles', user.uid), {
              petLevel: 1,
              petXp: 0,
              coins: STARTING_COINS,
              foodInventory: STARTER_FOOD_INVENTORY,
              hunger: 75,
              happiness: 85,
              energy: 85,
              cleanliness: 90,
              totalScore: 0,
              gamesPlayed: 0,
              correctAnswers: 0,
              totalAnswers: 0,
              isSleeping: false,
              lockedOut: false,
              lockReason: '',
              activeGame: 'Admin & Secret Codes',
              updatedAt: serverTimestamp(),
            })
          );
        }

        await commitBatchOps(ops);

        if (options.resetSelfProfile) {
          try {
            await deleteDoc(doc(db, 'roleClaims', user.uid));
          } catch {
            // Optional if admin used primary/allowlist auth
          }
          try {
            localStorage.removeItem('lorenzone_theme');
          } catch {
            // Ignore storage errors
          }
          setActiveTab('home');
        }
      }

      return {
        deletedScores: scoresSnap.size,
        deletedAlerts: alertsSnap.size,
        deletedDecks,
        affectedProfiles,
      };
    },
    [user, myProfile?.role, customDecks]
  );

  const allDecks = useMemo(
    () => [...customDecks.filter((d) => d.isPublished), ...BUILTIN_DECKS],
    [customDecks]
  );

  const handleStartClassroomSession = useCallback(
    async (section: string, gameId: GameId, deck: QuizDeck) => {
      if (!user || !myProfile || (myProfile.role !== 'teacher' && myProfile.role !== 'admin')) return;
      const cleanSection = section.trim().slice(0, 40);
      if (!cleanSection) return;
      const sessionId = sectionToSessionId(cleanSection);
      const gameMeta = GAMES_CATALOG.find((g) => g.id === gameId);
      const payload = {
        id: sessionId,
        section: cleanSection,
        teacherId: user.uid,
        teacherName: (myProfile.displayName || 'SLA Teacher').slice(0, 60),
        gameId,
        gameTitle: (gameMeta?.title || gameId).slice(0, 60),
        deckId: deck.id.slice(0, 80),
        deckTitle: deck.title.slice(0, 100),
        subject: deck.subject.slice(0, 50),
        status: 'active' as const,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, 'classroomSessions', sessionId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `classroomSessions/${sessionId}`);
      }
    },
    [myProfile, user]
  );

  const handleEndClassroomSession = useCallback(
    async (sessionId: string) => {
      if (!user || !myProfile || (myProfile.role !== 'teacher' && myProfile.role !== 'admin')) return;
      try {
        await updateDoc(doc(db, 'classroomSessions', sessionId), {
          status: 'ended',
          teacherId: user.uid,
          teacherName: (myProfile.displayName || 'SLA Teacher').slice(0, 60),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `classroomSessions/${sessionId}`);
      }
    },
    [myProfile, user]
  );

  const handleCompleteClassroomSession = useCallback((sessionKey: string) => {
    setLaunchGameId(null);
    setLaunchDeckId(null);
    setCompletedClassSessionKeys((prev) => {
      if (prev.includes(sessionKey)) return prev;
      const next = [...prev.slice(-24), sessionKey];
      try {
        sessionStorage.setItem('lorenzone_completed_class_sessions', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const myClassroomSession = useMemo(() => {
    if (!myProfile || myProfile.role !== 'student') return null;
    const mySection = (myProfile.section || '').trim();
    if (!mySection) return null;
    const matches = classroomSessions.filter(
      (s) => s.status === 'active' && s.section.trim() === mySection
    );
    if (matches.length === 0) return null;
    matches.sort((a, b) => toMillis(b.startedAt) - toMillis(a.startedAt));
    return matches[0];
  }, [classroomSessions, myProfile]);

  const forcedLaunchSession = useMemo(() => {
    if (!myClassroomSession) return null;
    const startedMs = toMillis(myClassroomSession.startedAt);
    if (!startedMs) return null;
    const sessionKey = `${myClassroomSession.id}_${startedMs}`;
    if (completedClassSessionKeys.includes(sessionKey)) return null;
    const deckReady = allDecks.some((d) => d.id === myClassroomSession.deckId);
    if (!deckReady) return null;
    return {
      sessionKey,
      sessionId: myClassroomSession.id,
      gameId: myClassroomSession.gameId,
      deckId: myClassroomSession.deckId,
      deckTitle: myClassroomSession.deckTitle,
      subject: myClassroomSession.subject,
      gameTitle: myClassroomSession.gameTitle,
      teacherName: myClassroomSession.teacherName,
      section: myClassroomSession.section,
    };
  }, [myClassroomSession, completedClassSessionKeys, allDecks]);

  const isStudentLockedInClassQuiz = Boolean(
    myProfile?.role === 'student' && forcedLaunchSession
  );

  useEffect(() => {
    if (!forcedLaunchSession || myProfile?.role !== 'student') return;
    if (lastAutoLaunchedSessionKeyRef.current !== forcedLaunchSession.sessionKey) {
      lastAutoLaunchedSessionKeyRef.current = forcedLaunchSession.sessionKey;
      setShowSettings(false);
      setShowInstructions(false);
      setShowGameRules(false);
      soundFx.playLevelUp();
    }
    if (launchGameId !== forcedLaunchSession.gameId) {
      setLaunchGameId(forcedLaunchSession.gameId);
    }
    if (launchDeckId !== forcedLaunchSession.deckId) {
      setLaunchDeckId(forcedLaunchSession.deckId);
    }
    if (activeTab !== 'games') {
      setActiveTab('games');
    }
  }, [forcedLaunchSession, myProfile?.role, activeTab, launchGameId, launchDeckId]);

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

  // Global audible Teacher siren across all tabs when a student in their classroom triggers the Cheating Detector (disabled for Admin)
  useEffect(() => {
    const isTeacherOnly = myProfile?.role === 'teacher';
    if (isTeacherOnly && lockedAlertCount > prevLockedCountRef.current) {
      soundFx.playAlertSiren();
    }
    prevLockedCountRef.current = isTeacherOnly ? lockedAlertCount : 0;
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

  if (isUnapprovedStudent && myProfile) {
    return (
      <PendingApprovalScreen
        profile={myProfile}
        email={user.email || ''}
        verification={myIdVerification}
        verificationLoaded={myIdVerificationLoaded}
        sectionRequest={mySectionRequest}
        onRequestSectionChange={handleRequestSectionChange}
        onSubmitId={handleSubmitSchoolId}
        onSignOut={handleFullSignOut}
      />
    );
  }

  const isAdminUser = myProfile.role === 'admin';
  const pendingApprovalCount = isAdminUser
    ? allProfiles.filter((p) => p.role === 'student' && p.approvalStatus !== 'approved').length
    : 0;
  const pendingSectionReqCount = isAdminUser
    ? sectionChangeRequests.filter((r) => r.status === 'pending').length
    : 0;
  const totalAdminQueueCount = pendingApprovalCount + pendingSectionReqCount;

  return (
    <div className="min-h-screen bg-[var(--lz-bg)] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="bg-[var(--lz-header-bg)] border-b border-[var(--lz-header-border)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href={isAdminUser ? '#monitor' : '#home'}
            onClick={(e) => {
              e.preventDefault();
              if (isStudentLockedInClassQuiz) return;
              setActiveTab(isAdminUser ? 'monitor' : 'home');
            }}
            aria-disabled={isStudentLockedInClassQuiz}
            className={`text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0 ${
              isStudentLockedInClassQuiz ? 'opacity-80 cursor-not-allowed' : ''
            }`}
            style={{ color: 'var(--lz-header-brand-left)' }}
          >
            LOREN<span style={{ color: 'var(--lz-header-brand-right)' }}>ZONE</span>
          </a>

          <nav className="flex items-center gap-6 text-sm font-semibold overflow-x-auto">
            {!isAdminUser && (
              <>
                <button
                  type="button"
                  disabled={isStudentLockedInClassQuiz}
                  onClick={() => {
                    if (isStudentLockedInClassQuiz) return;
                    soundFx.playClick();
                    setActiveTab('home');
                  }}
                  title={isStudentLockedInClassQuiz ? 'Locked until live classroom quiz ends' : undefined}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isStudentLockedInClassQuiz
                      ? 'border-transparent text-[var(--lz-header-nav)] opacity-45 cursor-not-allowed'
                      : activeTab === 'home'
                        ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)] cursor-pointer'
                        : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)] cursor-pointer'
                  }`}
                >
                  Pet Home
                </button>
                <button
                  type="button"
                  disabled={isStudentLockedInClassQuiz}
                  onClick={() => {
                    if (isStudentLockedInClassQuiz) return;
                    soundFx.playClick();
                    setLaunchGameId(null);
                    setLaunchDeckId(null);
                    setActiveTab('games');
                  }}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isStudentLockedInClassQuiz
                      ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)] cursor-default'
                      : activeTab === 'games'
                        ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)] cursor-pointer'
                        : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)] cursor-pointer'
                  }`}
                >
                  {isStudentLockedInClassQuiz ? 'Live Class Quiz (Locked)' : 'Quiz Games'}
                </button>
              </>
            )}
            {(myProfile.role === 'teacher' || isAdminUser) && (
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
                {isAdminUser ? 'Admin Monitor' : 'Teacher Monitor'}
              </button>
            )}
            <button
              type="button"
              disabled={isStudentLockedInClassQuiz}
              onClick={() => {
                if (isStudentLockedInClassQuiz) return;
                soundFx.playClick();
                setActiveTab('leaderboard');
              }}
              title={isStudentLockedInClassQuiz ? 'Locked until live classroom quiz ends' : undefined}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                isStudentLockedInClassQuiz
                  ? 'border-transparent text-[var(--lz-header-nav)] opacity-45 cursor-not-allowed'
                  : activeTab === 'leaderboard'
                    ? 'border-[var(--lz-header-brand-right)] text-[var(--lz-header-nav-active)] cursor-pointer'
                    : 'border-transparent text-[var(--lz-header-nav)] hover:text-[var(--lz-header-nav-active)] cursor-pointer'
              }`}
            >
              Leaderboard
            </button>
          </nav>

          <div className="shrink-0">
            {isAdminUser ? (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setActiveTab('monitor');
                }}
                className="px-4 py-2 rounded-xl bg-[var(--lz-header-cta-bg)] hover:bg-[var(--lz-header-cta-hover)] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
              >
                {totalAdminQueueCount > 0 ? `Approvals (${totalAdminQueueCount})` : 'Admin Monitor'}
              </button>
            ) : isStudentLockedInClassQuiz ? (
              <span className="px-3.5 py-2 rounded-xl bg-[#EA7A26]/20 border border-[#EA7A26]/40 text-xs font-bold text-[#EA7A26] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Lock className="w-3.5 h-3.5" />
                Quiz Locked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setLaunchGameId(null);
                  setLaunchDeckId(null);
                  setActiveTab('games');
                }}
                className="px-4 py-2 rounded-xl bg-[var(--lz-header-cta-bg)] hover:bg-[var(--lz-header-cta-hover)] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Start Quiz
              </button>
            )}
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
          lockedAlertCount={isAdminUser ? 0 : lockedAlertCount}
          quizLocked={isStudentLockedInClassQuiz}
        />

        {myProfile.role === 'teacher' &&
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

        {myProfile.role === 'student' && forcedLaunchSession && activeTab !== 'games' && (
          <div className="rounded-2xl border-2 border-[#EA7A26] bg-[#FFF5ED] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-extrabold text-[#172A1E]">
                Live Classroom Quiz in {forcedLaunchSession.section}: {forcedLaunchSession.gameTitle}
              </p>
              <p className="text-[#4D6354]">
                {forcedLaunchSession.subject} · {forcedLaunchSession.deckTitle} · Started by{' '}
                {forcedLaunchSession.teacherName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setLaunchGameId(forcedLaunchSession.gameId);
                setLaunchDeckId(forcedLaunchSession.deckId);
                setActiveTab('games');
              }}
              className="px-4 py-2 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Go to Classroom Quiz
            </button>
          </div>
        )}

        {activeTab === 'home' && !isAdminUser && (
          <PetHomeAndCare
            profile={myProfile}
            records={scoreRecords}
            onUpdateProfile={handleUpdateProfile}
            onOpenGames={() => setActiveTab('games')}
            onSetActivity={(act) => void reportActivity(act)}
          />
        )}

        {activeTab === 'games' && !isAdminUser && (
          <MiniGamesHub
            profile={myProfile}
            allProfiles={allProfiles}
            decks={allDecks}
            alerts={alerts}
            records={scoreRecords}
            initialGameId={launchGameId}
            initialDeckId={launchDeckId}
            classroomSessions={classroomSessions}
            forcedLaunchSession={forcedLaunchSession}
            onCompleteClassroomSession={handleCompleteClassroomSession}
            onExitLaunchReset={() => {
              setLaunchGameId(null);
              setLaunchDeckId(null);
            }}
            onStartClassroomSession={handleStartClassroomSession}
            onEndClassroomSession={handleEndClassroomSession}
            onTriggerCheatLock={handleTriggerCheatLock}
            onAllowStudent={handleAllowStudent}
            onRecordGameResult={handleRecordGameResult}
            onAwardStudent={handleAwardStudent}
            onSetActiveGame={(activeGame) => reportActivity(activeGame)}
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

        {activeTab === 'monitor' && (myProfile.role === 'teacher' || isAdminUser) && (
          <TeacherMonitor
            teacherProfile={myProfile}
            allProfiles={allProfiles}
            alerts={alerts}
            records={scoreRecords}
            customDecks={customDecks}
            publishedDecks={allDecks}
            classroomSessions={classroomSessions}
            authorizedFaculty={authorizedFaculty}
            schoolIdVerifications={schoolIdVerifications}
            onReviewStudentApproval={handleReviewStudentApproval}
            sectionChangeRequests={sectionChangeRequests}
            onReviewSectionChange={handleReviewSectionChange}
            onAllowStudent={handleAllowStudent}
            onSaveDeck={handleSaveDeck}
            onUpdateDeck={handleUpdateDeck}
            onDeleteDeck={handleDeleteDeck}
            onLaunchTeacherGame={(gId, dId) => {
              setLaunchGameId(gId);
              setLaunchDeckId(dId || null);
              setActiveTab('games');
            }}
            onStartClassroomSession={handleStartClassroomSession}
            onEndClassroomSession={handleEndClassroomSession}
            onAddAuthorizedFaculty={handleAddAuthorizedFaculty}
            onRemoveAuthorizedFaculty={handleRemoveAuthorizedFaculty}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateOwnSection={handleUpdateOwnSection}
            onAssignStudentSection={handleAssignStudentSection}
            accessCodes={accessCodes}
            onUpdateAccessCodes={handleUpdateAccessCodes}
            onSetActivity={(act) => void reportActivity(act)}
            onAdminResetApp={handleAdminResetApp}
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
          sectionRequest={mySectionRequest}
          onRequestSectionChange={handleRequestSectionChange}
          onClaimRoleWithCode={handleClaimRoleWithCode}
          quizLocked={isStudentLockedInClassQuiz}
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
