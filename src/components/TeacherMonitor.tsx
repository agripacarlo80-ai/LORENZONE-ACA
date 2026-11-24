import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileUp,
  GraduationCap,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  Volume2,
  Play,
  KeyRound,
  Copy,
  School,
  RotateCcw,
} from 'lucide-react';
import {
  AntiCheatAlert,
  AuthorizedFaculty,
  GameId,
  PublicProfile,
  QuizDeck,
  QuizQuestion,
  ScoreRecord,
} from '../types';
import { SLA_SECTIONS } from '../data/defaultDecks';
import { downloadLeaderboardCsv, parsePlainTextSlides, parsePptxFile } from '../lib/pptxParser';
import { formatLastSeen, getStudentPresence, timestampToMillis } from '../lib/presence';
import { soundFx } from '../lib/sound';
import { PetAvatar } from './PetAvatar';

interface TeacherMonitorProps {
  teacherProfile: PublicProfile;
  allProfiles: PublicProfile[];
  alerts: AntiCheatAlert[];
  records: ScoreRecord[];
  customDecks: QuizDeck[];
  authorizedFaculty: AuthorizedFaculty[];
  onAllowStudent: (alert: AntiCheatAlert) => Promise<void>;
  onSaveDeck: (deck: Omit<QuizDeck, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateDeck: (
    deckId: string,
    patch: Pick<QuizDeck, 'title' | 'subject' | 'description' | 'sourceType' | 'questions' | 'isPublished'>
  ) => Promise<void>;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onLaunchTeacherGame: (gameId: GameId) => void;
  onAddAuthorizedFaculty: (email: string, fullName: string, role: 'teacher') => Promise<void>;
  onRemoveAuthorizedFaculty: (email: string) => Promise<void>;
  onUpdateUserRole: (uid: string, nextRole: 'student' | 'teacher') => Promise<void>;
  onUpdateOwnSection: (section: string) => Promise<void>;
  onAssignStudentSection: (studentUid: string, section: string) => Promise<void>;
  accessCodes: { teacherCode: string; adminCode: string };
  onUpdateAccessCodes: (teacherCode: string, adminCode: string) => Promise<void>;
  onSetActivity?: (activity: string) => void;
  onAdminResetApp?: (options: {
    mode: 'scores_only' | 'full_wipe';
    includeCustomDecks: boolean;
    includeFacultyAllowlist: boolean;
    resetSelfProfile: boolean;
  }) => Promise<{
    deletedScores: number;
    deletedAlerts: number;
    deletedDecks: number;
    affectedProfiles: number;
  }>;
}

type MonitorTab = 'live' | 'builder' | 'pptx' | 'admin';

function getActivityBadge(profile: PublicProfile, isOnline: boolean) {
  if (profile.lockedOut) {
    return {
      label: `Locked: ${profile.activeGame || 'Quiz'}`,
      className: 'bg-red-50 text-red-700 border-red-200',
    };
  }
  if (!isOnline) {
    return {
      label: 'Signed Out',
      className: 'bg-stone-100 text-[#4D6354] border-[#E5DEC9]',
    };
  }
  const activity = (profile.activeGame || 'Lobby').trim();
  if (/^(Playing|Hosting):/i.test(activity)) {
    return {
      label: activity,
      className: 'bg-[#EA7A26]/15 text-[#C65B10] border-[#EA7A26]/30',
    };
  }
  if (/^(Monitoring|Building|Importing|Admin)/i.test(activity)) {
    return {
      label: activity,
      className: 'bg-emerald-50 text-[#1E5B3A] border-emerald-200',
    };
  }
  return {
    label: activity,
    className: 'bg-[#FAF8F2] text-[#172A1E] border-[#E5DEC9]',
  };
}

export const TeacherMonitor: React.FC<TeacherMonitorProps> = ({
  teacherProfile,
  allProfiles,
  alerts,
  records,
  customDecks,
  authorizedFaculty,
  onAllowStudent,
  onSaveDeck,
  onUpdateDeck,
  onDeleteDeck,
  onLaunchTeacherGame,
  onAddAuthorizedFaculty,
  onRemoveAuthorizedFaculty,
  onUpdateUserRole,
  onUpdateOwnSection,
  onAssignStudentSection,
  accessCodes,
  onUpdateAccessCodes,
  onSetActivity,
  onAdminResetApp,
}) => {
  const [tab, setTab] = useState<MonitorTab>('live');

  // Custom Quiz Builder state
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckSubject, setDeckSubject] = useState('Science');
  const [deckDesc, setDeckDesc] = useState('');
  const [deckSourceType, setDeckSourceType] = useState<'custom' | 'pptx'>('custom');
  const [deckPublished, setDeckPublished] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    {
      id: `q_${Date.now()}`,
      prompt: '',
      answer: '',
      options: ['', '', '', ''],
      hint: '',
      category: 'Core',
    },
  ]);
  const [savingDeck, setSavingDeck] = useState(false);
  const [builderFeedback, setBuilderFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // PPTX Importer state
  const [pptxStatus, setPptxStatus] = useState<string | null>(null);
  const [pptxTextFallback, setPptxTextFallback] = useState('');

  // Admin Faculty Access state (Teachers only — Teachers cannot become Admin)
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [facultyFeedback, setFacultyFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingFaculty, setSavingFaculty] = useState(false);

  // Teacher Classroom Room Selection state
  const initialTeacherSection = teacherProfile.section?.trim() || SLA_SECTIONS[6];
  const [teacherSectionInput, setTeacherSectionInput] = useState(initialTeacherSection);
  const [useCustomTeacherSection, setUseCustomTeacherSection] = useState(
    !SLA_SECTIONS.includes(initialTeacherSection)
  );
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomFeedback, setRoomFeedback] = useState<string | null>(null);
  const [assigningUid, setAssigningUid] = useState<string | null>(null);
  const [adminRoomFilter, setAdminRoomFilter] = useState<string>('ALL');

  // Admin Secret Access Codes state
  const [teacherCodeInput, setTeacherCodeInput] = useState(accessCodes.teacherCode);
  const [adminCodeInput, setAdminCodeInput] = useState(accessCodes.adminCode);
  const [savingCodes, setSavingCodes] = useState(false);
  const [codesFeedback, setCodesFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Admin App Reset state
  const [resetMode, setResetMode] = useState<'scores_only' | 'full_wipe'>('scores_only');
  const [resetDecks, setResetDecks] = useState(false);
  const [resetAllowlist, setResetAllowlist] = useState(false);
  const [resetSelf, setResetSelf] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTeacherCodeInput(accessCodes.teacherCode);
    setAdminCodeInput(accessCodes.adminCode);
  }, [accessCodes.teacherCode, accessCodes.adminCode]);

  useEffect(() => {
    const nextSec = teacherProfile.section?.trim() || SLA_SECTIONS[6];
    setTeacherSectionInput(nextSec);
    setUseCustomTeacherSection(!SLA_SECTIONS.includes(nextSec));
  }, [teacherProfile.section]);

  const isAdmin = teacherProfile.role === 'admin';
  const myTeachingSection = teacherProfile.section?.trim() || SLA_SECTIONS[6];
  const allStudents = allProfiles.filter((p) => p.role === 'student');
  const allTeachers = allProfiles.filter((p) => p.role === 'teacher');

  const availableRoomSections = Array.from(
    new Set([
      ...SLA_SECTIONS,
      ...allStudents.map((s) => (s.section || '').trim()).filter(Boolean),
    ])
  );

  // Scoped Classroom Room:
  // - Teachers see ONLY students enrolled in their chosen section (individual room).
  // - Admins can inspect ALL classrooms or filter to any individual section room.
  const activeRoomSection = isAdmin ? adminRoomFilter : myTeachingSection;
  const students = isAdmin
    ? adminRoomFilter === 'ALL'
      ? allStudents
      : adminRoomFilter === '__UNASSIGNED__'
        ? allStudents.filter((s) => !(s.section || '').trim())
        : allStudents.filter((s) => (s.section || '').trim() === adminRoomFilter)
    : allStudents.filter((s) => (s.section || '').trim() === myTeachingSection);

  const unassignedStudents = allStudents.filter((s) => !(s.section || '').trim());
  const roomStudentIds = new Set(students.map((s) => s.uid));

  const roomAlerts =
    isAdmin && adminRoomFilter === 'ALL'
      ? alerts
      : alerts.filter((a) => roomStudentIds.has(a.studentId));
  const lockedAlerts = roomAlerts.filter((a) => a.status === 'locked');

  const onlineCount = students.filter((st) => getStudentPresence(st, nowMs).isOnline).length;
  const offlineCount = students.length - onlineCount;
  const filteredStudents = students.filter((st) => {
    if (presenceFilter === 'all') return true;
    const { isOnline } = getStudentPresence(st, nowMs);
    return presenceFilter === 'online' ? isOnline : !isOnline;
  });

  // Admin Campus-wide live monitoring metrics
  const onlineTeachersCount = allTeachers.filter((t) => getStudentPresence(t, nowMs).isOnline).length;
  const allOnlineStudentsCount = allStudents.filter((s) => getStudentPresence(s, nowMs).isOnline).length;
  const inQuizStudentsCount = allStudents.filter(
    (s) => getStudentPresence(s, nowMs).isOnline && /^(Playing|Hosting):/i.test(s.activeGame || '')
  ).length;
  const allLockedCampusCount = alerts.filter((a) => a.status === 'locked').length;
  const visibleTeachers = [...allTeachers]
    .filter((t) => {
      if (presenceFilter === 'all') return true;
      const { isOnline } = getStudentPresence(t, nowMs);
      return presenceFilter === 'online' ? isOnline : !isOnline;
    })
    .sort((a, b) => {
      const aOn = getStudentPresence(a, nowMs).isOnline ? 1 : 0;
      const bOn = getStudentPresence(b, nowMs).isOnline ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return a.displayName.localeCompare(b.displayName);
    });

  const profileByUid = new Map(allProfiles.map((p) => [p.uid, p]));
  const campusActivityFeed = isAdmin
    ? [
        ...records.slice(0, 12).map((r) => ({
          id: `rec_${r.id}`,
          kind: 'score' as const,
          actorName: r.studentName,
          section: profileByUid.get(r.studentId)?.section || '',
          detail: `Completed ${r.gameTitle} (${r.subject}) · ${r.score} pts (${r.correctCount}/${r.totalCount})`,
          ts: timestampToMillis(r.createdAt),
        })),
        ...alerts.slice(0, 12).map((al) => ({
          id: `al_${al.id}`,
          kind: 'alert' as const,
          actorName: al.studentName,
          section: profileByUid.get(al.studentId)?.section || '',
          detail: `${al.status === 'locked' ? 'Locked in' : 'Allowed back in'} ${al.gameTitle} — ${al.reason}`,
          ts: timestampToMillis(al.createdAt),
        })),
      ]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 12)
    : [];

  const resetBuilder = () => {
    setEditingDeckId(null);
    setDeckTitle('');
    setDeckDesc('');
    setDeckSourceType('custom');
    setDeckPublished(true);
    setQuestions([
      {
        id: `q_${Date.now()}`,
        prompt: '',
        answer: '',
        options: ['', '', '', ''],
        hint: '',
        category: deckSubject,
      },
    ]);
  };

  const handlePptxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    setPptxStatus('Reading PowerPoint slides...');
    try {
      const { slides, questions: extracted } = await parsePptxFile(file);
      if (extracted.length === 0) {
        setPptxStatus('Could not extract Q&A lines from this PPTX. Try adding "Term: Definition" or "Q: ... / Answer: ..." on slides.');
        return;
      }
      setEditingDeckId(null);
      setDeckTitle(file.name.replace(/\.pptx$/i, ''));
      setDeckDesc(`Imported from ${file.name} (${slides.length} slides)`);
      setDeckSourceType('pptx');
      setDeckPublished(true);
      setQuestions(extracted);
      setBuilderFeedback(null);
      setPptxStatus(`Extracted ${extracted.length} questions from ${slides.length} slides! Review & publish below.`);
      setTab('builder');
      onSetActivity?.('Building Quiz Deck');
      soundFx.playLevelUp();
    } catch (err) {
      setPptxStatus(err instanceof Error ? err.message : 'Failed to parse .pptx file.');
      soundFx.playWrong();
    }
  };

  const handleConvertTextSlides = () => {
    if (!pptxTextFallback.trim()) return;
    const extracted = parsePlainTextSlides(pptxTextFallback);
    if (extracted.length === 0) {
      setPptxStatus('Please separate slides with blank lines and use "Term: Definition" or "Q: ... / Answer: ...".');
      return;
    }
    setEditingDeckId(null);
    setDeckTitle(deckTitle || 'Imported Slide Deck');
    setDeckDesc('Converted from slide notes');
    setDeckSourceType('pptx');
    setDeckPublished(true);
    setQuestions(extracted);
    setBuilderFeedback(null);
    setTab('builder');
    onSetActivity?.('Building Quiz Deck');
    soundFx.playLevelUp();
  };

  const addBlankQuestion = () => {
    if (questions.length >= 50) return;
    soundFx.playClick();
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}_${prev.length}`,
        prompt: '',
        answer: '',
        options: ['', '', '', ''],
        hint: '',
        category: deckSubject,
      },
    ]);
  };

  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const handleEditDeck = (deck: QuizDeck) => {
    soundFx.playClick();
    setEditingDeckId(deck.id);
    setDeckTitle(deck.title);
    setDeckSubject(deck.subject);
    setDeckDesc(deck.description);
    setDeckSourceType(deck.sourceType);
    setDeckPublished(deck.isPublished);
    setQuestions(
      deck.questions.map((q, i) => ({
        ...q,
        id: q.id || `q_${Date.now()}_${i}`,
        options: [q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || ''],
      }))
    );
    setBuilderFeedback(null);
    setTab('builder');
    onSetActivity?.('Building Quiz Deck');
  };

  const handlePublishDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = questions
      .filter((q) => q.prompt.trim() && q.answer.trim())
      .slice(0, 50)
      .map((q, idx) => {
        const ans = q.answer.trim();
        const seen = new Set<string>([ans.toLowerCase()]);
        const uniqueOpts: string[] = [ans];
        for (const raw of q.options) {
          const clean = raw.trim();
          if (!clean) continue;
          const key = clean.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueOpts.push(clean);
          }
          if (uniqueOpts.length >= 4) break;
        }
        let fillerIdx = 1;
        while (uniqueOpts.length < 4) {
          const fb = `Option ${fillerIdx++}`;
          if (!seen.has(fb.toLowerCase())) {
            seen.add(fb.toLowerCase());
            uniqueOpts.push(fb);
          }
        }
        return {
          ...q,
          id: q.id || `q_${idx + 1}`,
          prompt: q.prompt.trim(),
          answer: ans,
          options: uniqueOpts,
          hint: q.hint.trim() || 'Think about the lesson topic',
          category: (q.category || '').trim() || deckSubject.trim() || 'Core',
        };
      });

    if (!deckTitle.trim() || !deckSubject.trim() || cleaned.length === 0) {
      setBuilderFeedback({
        type: 'err',
        text: 'Please enter a deck title, subject, and at least one valid question & answer.',
      });
      return;
    }

    setSavingDeck(true);
    setBuilderFeedback(null);
    try {
      const cleanTitle = deckTitle.trim().slice(0, 100);
      const cleanSubject = deckSubject.trim().slice(0, 50);
      const cleanDesc = deckDesc.trim().slice(0, 240) || `${cleanSubject} custom quiz deck`;

      if (editingDeckId) {
        await onUpdateDeck(editingDeckId, {
          title: cleanTitle,
          subject: cleanSubject,
          description: cleanDesc,
          sourceType: deckSourceType,
          questions: cleaned,
          isPublished: deckPublished,
        });
        soundFx.playLevelUp();
        setBuilderFeedback({
          type: 'ok',
          text: `Updated "${cleanTitle}" (${cleaned.length} questions)!`,
        });
      } else {
        const deckId = `deck_${Date.now()}`;
        await onSaveDeck({
          id: deckId,
          title: cleanTitle,
          subject: cleanSubject,
          description: cleanDesc,
          sourceType: deckSourceType,
          teacherId: teacherProfile.uid,
          teacherName: teacherProfile.displayName,
          questions: cleaned,
          isPublished: deckPublished,
        });
        soundFx.playLevelUp();
        setBuilderFeedback({
          type: 'ok',
          text: `Published "${cleanTitle}" (${cleaned.length} questions) to all student mini-games!`,
        });
      }
      resetBuilder();
    } catch (err) {
      soundFx.playWrong();
      setBuilderFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not save quiz deck.',
      });
    } finally {
      setSavingDeck(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Cheating Detector Alert Banner */}
      {lockedAlerts.length > 0 && (
        <div className="rounded-3xl border-2 border-red-500 bg-red-50 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-red-900">
                  Cheating Detector Alert ({lockedAlerts.length} Student{lockedAlerts.length > 1 ? 's' : ''} Locked)
                </h3>
                <p className="text-xs text-red-700">
                  These students left the quiz window and are blocked from answering until you allow them.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => soundFx.playAlertSiren()}
              className="px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" /> Test Alarm Sound
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lockedAlerts.map((alert) => {
              const flaggedStudent = allProfiles.find((p) => p.uid === alert.studentId);
              return (
                <div
                  key={alert.id}
                  className="bg-white rounded-2xl border border-red-200 p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {flaggedStudent?.photoUrl && (
                      <img
                        src={flaggedStudent.photoUrl}
                        alt={alert.studentName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border-2 border-red-400 shrink-0"
                      />
                    )}
                    <div>
                      <p className="text-sm font-bold text-[#172A1E]">
                        {alert.studentName}{' '}
                        <span className="text-xs font-normal text-[#4D6354]">· Pet: {alert.petName}</span>
                      </p>
                      <p className="text-xs text-red-700 font-medium mt-0.5">
                        {alert.gameTitle} ({alert.subject}) — {alert.reason}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playCorrect();
                      void onAllowStudent(alert);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Allow Student
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher Monitor Navigation & Actions */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#EA7A26]">
              San Lorenzo Academy · {isAdmin ? 'Administrator Console' : `Classroom Room: ${myTeachingSection}`}
            </p>
            <h2 className="text-2xl font-bold text-[#172A1E]">
              {isAdmin ? 'Faculty & Admin Control Center' : `${myTeachingSection} — Teacher Room`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9]">
              {[
                { id: 'live', label: isAdmin ? 'Classrooms' : 'My Classroom' },
                { id: 'pptx', label: 'Import PPTX' },
                { id: 'builder', label: 'Quiz Builder' },
                ...(isAdmin ? [{ id: 'admin', label: 'Admin & Secret Codes' }] : []),
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    const nextTab = t.id as MonitorTab;
                    setTab(nextTab);
                    if (nextTab === 'live') {
                      onSetActivity?.(isAdmin ? 'Admin Live Monitor' : `Monitoring: ${myTeachingSection}`);
                    } else if (nextTab === 'pptx') {
                      onSetActivity?.('Importing PPTX Slides');
                    } else if (nextTab === 'builder') {
                      onSetActivity?.('Building Quiz Deck');
                    } else if (nextTab === 'admin') {
                      onSetActivity?.('Admin & Secret Codes');
                    }
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    tab === t.id ? 'bg-[#1E5B3A] text-white' : 'text-[#4D6354]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playQuack();
                onLaunchTeacherGame('catch_the_duck');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              Host Catch the Duck
            </button>
          </div>
        </div>

        {/* Section / Classroom Room Selector Bar */}
        {!isAdmin ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const cleanSec = teacherSectionInput.trim().slice(0, 40);
              if (!cleanSec) return;
              setSavingRoom(true);
              setRoomFeedback(null);
              try {
                await onUpdateOwnSection(cleanSec);
                soundFx.playCorrect();
                setRoomFeedback(`Classroom room switched to "${cleanSec}".`);
              } catch (err) {
                soundFx.playWrong();
                setRoomFeedback(err instanceof Error ? err.message : 'Unable to switch class section.');
              } finally {
                setSavingRoom(false);
              }
            }}
            className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <School className="w-5 h-5 text-[#1E5B3A] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#172A1E]">
                  Section You Are Teaching (Your Individual Classroom Room)
                </p>
                <p className="text-[11px] text-[#4D6354]">
                  Select your assigned section to view and monitor only the students in your class.
                </p>
                {roomFeedback && (
                  <p className="text-[11px] font-semibold text-[#1E5B3A] mt-1">{roomFeedback}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={
                  useCustomTeacherSection
                    ? '__custom__'
                    : SLA_SECTIONS.includes(teacherSectionInput)
                      ? teacherSectionInput
                      : '__custom__'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  setRoomFeedback(null);
                  if (val === '__custom__') {
                    setUseCustomTeacherSection(true);
                    if (SLA_SECTIONS.includes(teacherSectionInput)) setTeacherSectionInput('');
                  } else {
                    setUseCustomTeacherSection(false);
                    setTeacherSectionInput(val);
                  }
                }}
                aria-label="Choose section you teach"
                className="px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs font-semibold text-[#172A1E]"
              >
                {SLA_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
                <option value="__custom__">Other / Custom Section...</option>
              </select>

              {(useCustomTeacherSection || !SLA_SECTIONS.includes(teacherSectionInput)) && (
                <input
                  type="text"
                  maxLength={40}
                  required
                  value={teacherSectionInput}
                  onChange={(e) => setTeacherSectionInput(e.target.value)}
                  placeholder="Custom section name..."
                  className="px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs w-44"
                />
              )}

              <button
                type="submit"
                disabled={savingRoom}
                className="px-4 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {savingRoom ? 'Updating...' : 'Set My Class'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <School className="w-5 h-5 text-[#EA7A26] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#172A1E]">Inspect Classroom Room</p>
                <p className="text-[11px] text-[#4D6354]">
                  View all SLA classrooms together or choose a specific section room.
                </p>
              </div>
            </div>
            <select
              value={adminRoomFilter}
              onChange={(e) => setAdminRoomFilter(e.target.value)}
              aria-label="Inspect classroom section"
              className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs font-semibold text-[#172A1E]"
            >
              <option value="ALL">All Classrooms ({allStudents.length} Students)</option>
              {availableRoomSections.map((sec) => (
                <option key={sec} value={sec}>
                  Room: {sec} ({allStudents.filter((s) => (s.section || '').trim() === sec).length})
                </option>
              ))}
              {unassignedStudents.length > 0 && (
                <option value="__UNASSIGNED__">
                  Unassigned / Legacy ({unassignedStudents.length})
                </option>
              )}
            </select>
          </div>
        )}
      </div>

      {tab === 'live' && (
        <div className="space-y-6">
          {/* Admin Campus-Wide Overview Metrics */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border border-[#E5DEC9] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#4D6354]">Students Online</p>
                  <p className="text-2xl font-extrabold text-[#172A1E] mt-1 tabular-nums">
                    {allOnlineStudentsCount} <span className="text-sm font-semibold text-[#4D6354]">/ {allStudents.length}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-[#EA7A26] mt-0.5">
                    {inQuizStudentsCount} actively in quiz
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#1E5B3A] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#E5DEC9] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#4D6354]">Teachers Online</p>
                  <p className="text-2xl font-extrabold text-[#172A1E] mt-1 tabular-nums">
                    {onlineTeachersCount} <span className="text-sm font-semibold text-[#4D6354]">/ {allTeachers.length}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-[#1E5B3A] mt-0.5">
                    {allTeachers.filter((t) => Boolean((t.section || '').trim())).length} assigned rooms
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] text-[#1E5B3A] flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#E5DEC9] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#4D6354]">Integrity Alerts</p>
                  <p className={`text-2xl font-extrabold mt-1 tabular-nums ${allLockedCampusCount > 0 ? 'text-red-600' : 'text-[#1E5B3A]'}`}>
                    {allLockedCampusCount} Locked
                  </p>
                  <p className="text-[11px] text-[#4D6354] mt-0.5">{alerts.length} total strikes logged</p>
                </div>
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${allLockedCampusCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-[#1E5B3A]'}`}>
                  <AlertOctagon className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#E5DEC9] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#4D6354]">Classrooms &amp; Decks</p>
                  <p className="text-2xl font-extrabold text-[#172A1E] mt-1 tabular-nums">
                    {availableRoomSections.length} Rooms
                  </p>
                  <p className="text-[11px] text-[#4D6354] mt-0.5">{customDecks.length} custom quiz decks</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-[#EA7A26]/10 text-[#EA7A26] flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}

          {/* Admin Teachers Live Monitor */}
          {isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#172A1E] flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#1E5B3A]" />
                    Teachers Live Monitor — Who&apos;s Teaching &amp; What They Are Doing
                  </h3>
                  <p className="text-xs text-[#4D6354]">
                    Monitor every teacher&apos;s online status, assigned classroom section, active task, and published decks in real time.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#1E5B3A] bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl tabular-nums">
                  {onlineTeachersCount} Online · {allTeachers.length - onlineTeachersCount} Offline
                </span>
              </div>

              {visibleTeachers.length === 0 ? (
                <p className="text-sm text-[#4D6354] py-6 text-center bg-[#FAF8F2] rounded-2xl">
                  {allTeachers.length === 0
                    ? 'No teacher accounts registered yet. Teachers can sign in with the Teacher Secret Code or be authorized under Admin & Secret Codes.'
                    : `No ${presenceFilter} teachers right now.`}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#ECE7D8] text-xs text-[#4D6354]">
                        <th className="py-3 pr-4 font-semibold">Teacher</th>
                        <th className="py-3 pr-4 font-semibold">Presence</th>
                        <th className="py-3 pr-4 font-semibold">Assigned Classroom</th>
                        <th className="py-3 pr-4 font-semibold">What They Are Doing</th>
                        <th className="py-3 pr-4 font-semibold">Decks</th>
                        <th className="py-3 font-semibold text-right">Room Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2EFE6]">
                      {visibleTeachers.map((t) => {
                        const presence = getStudentPresence(t, nowMs);
                        const activity = getActivityBadge(t, presence.isOnline);
                        const teacherSec = (t.section || '').trim();
                        const roomStudentCount = teacherSec
                          ? allStudents.filter((s) => (s.section || '').trim() === teacherSec).length
                          : 0;
                        const teacherDecksCount = customDecks.filter((d) => d.teacherId === t.uid).length;
                        const isInspectingThisRoom = Boolean(teacherSec && adminRoomFilter === teacherSec);

                        return (
                          <tr key={t.uid}>
                            <td className="py-3 pr-4 font-semibold text-[#172A1E]">
                              <div className="flex items-center gap-2.5">
                                <div className="relative shrink-0">
                                  {t.photoUrl ? (
                                    <img
                                      src={t.photoUrl}
                                      alt={t.displayName}
                                      referrerPolicy="no-referrer"
                                      className="w-9 h-9 rounded-full object-cover border border-[#1E5B3A]"
                                    />
                                  ) : (
                                    <PetAvatar
                                      species={t.petSpecies}
                                      color={t.petColor}
                                      outfit={t.outfit}
                                      accessory={t.accessory}
                                      size={36}
                                    />
                                  )}
                                  <span
                                    title={presence.label}
                                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                      presence.isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                                    }`}
                                  />
                                </div>
                                <div>
                                  <span>{t.displayName}</span>
                                  <p className="text-[11px] font-normal text-[#4D6354]">Faculty Teacher</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <div className="text-xs">
                                <span
                                  className={`inline-flex items-center gap-1.5 font-bold ${
                                    presence.isOnline ? 'text-emerald-700' : 'text-[#4D6354]'
                                  }`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      presence.isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                                    }`}
                                  />
                                  {presence.label}
                                </span>
                                <p className="text-[11px] text-[#4D6354]">{presence.lastSeenText}</p>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-xs">
                              <p className="font-semibold text-[#172A1E]">
                                {teacherSec || 'Unassigned'}
                              </p>
                              <p className="text-[11px] text-[#4D6354] tabular-nums">
                                {roomStudentCount} {roomStudentCount === 1 ? 'student' : 'students'}
                              </p>
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${activity.className}`}
                              >
                                <Activity className="w-3.5 h-3.5 shrink-0" />
                                {activity.label}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-xs font-bold text-[#172A1E] tabular-nums">
                              {teacherDecksCount}
                            </td>
                            <td className="py-3 text-right">
                              {teacherSec ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    soundFx.playClick();
                                    setAdminRoomFilter(isInspectingThisRoom ? 'ALL' : teacherSec);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                    isInspectingThisRoom
                                      ? 'bg-[#EA7A26] text-white'
                                      : 'border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5'
                                  }`}
                                >
                                  {isInspectingThisRoom ? 'Viewing Room' : 'Inspect Room'}
                                </button>
                              ) : (
                                <span className="text-xs text-[#4D6354]">No room</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Student Roster & Live Activity */}
          <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#172A1E]">
                  {isAdmin && activeRoomSection === 'ALL'
                    ? 'All Students — Live Activity, Pet Progress & Integrity Status'
                    : `${activeRoomSection === '__UNASSIGNED__' ? 'Unassigned Students' : activeRoomSection} — Student Roster (${students.length})`}
                </h3>
                <p className="text-xs text-[#4D6354]">
                  Track every student in real time: online/offline presence, what they are doing right now, pet level, quiz performance, and anti-cheat focus status.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9] text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPresenceFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      presenceFilter === 'all' ? 'bg-white text-[#172A1E] shadow-sm' : 'text-[#4D6354]'
                    }`}
                  >
                    All ({students.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceFilter('online')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                      presenceFilter === 'online' ? 'bg-[#1E5B3A] text-white' : 'text-[#4D6354]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Online ({onlineCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceFilter('offline')}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                      presenceFilter === 'offline' ? 'bg-[#4D6354] text-white' : 'text-[#4D6354]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-stone-400" />
                    Offline ({offlineCount})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    downloadLeaderboardCsv(students, records);
                  }}
                  className="px-4 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export Room CSV
                </button>
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <p className="text-sm text-[#4D6354] py-8 text-center bg-[#FAF8F2] rounded-2xl">
                {students.length === 0
                  ? isAdmin
                    ? 'No student accounts in this filter yet.'
                    : `No students enrolled in "${myTeachingSection}" yet. Students who pick "${myTeachingSection}" will appear in your room automatically.`
                  : `No ${presenceFilter} students right now in this classroom.`}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#ECE7D8] text-xs text-[#4D6354]">
                      <th className="py-3 pr-4 font-semibold">Student</th>
                      <th className="py-3 pr-4 font-semibold">Presence</th>
                      <th className="py-3 pr-4 font-semibold">What They Are Doing</th>
                      <th className="py-3 pr-4 font-semibold">Pet Progress</th>
                      <th className="py-3 pr-4 font-semibold">Care Avg</th>
                      <th className="py-3 pr-4 font-semibold">Accuracy</th>
                      <th className="py-3 pr-4 font-semibold">Score</th>
                      <th className="py-3 pr-4 font-semibold">Strikes</th>
                      <th className="py-3 font-semibold text-right">Focus Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EFE6]">
                    {filteredStudents.map((st) => {
                      const careAvg = Math.round((st.hunger + st.happiness + st.energy + st.cleanliness) / 4);
                      const acc =
                        st.totalAnswers > 0
                          ? Math.round((st.correctAnswers / st.totalAnswers) * 100)
                          : 0;
                      const matchingAlert = lockedAlerts.find((a) => a.studentId === st.uid);
                      const strikeCount = roomAlerts.filter((a) => a.studentId === st.uid).length;
                      const presence = getStudentPresence(st, nowMs);
                      const activity = getActivityBadge(st, presence.isOnline);

                      return (
                        <tr key={st.uid}>
                          <td className="py-3 pr-4 font-semibold text-[#172A1E]">
                            <div className="flex items-center gap-2.5">
                              <div className="relative shrink-0">
                                {st.photoUrl ? (
                                  <img
                                    src={st.photoUrl}
                                    alt={st.displayName}
                                    referrerPolicy="no-referrer"
                                    className="w-9 h-9 rounded-full object-cover border border-[#1E5B3A]"
                                  />
                                ) : (
                                  <PetAvatar
                                    species={st.petSpecies}
                                    color={st.petColor}
                                    outfit={st.outfit}
                                    accessory={st.accessory}
                                    size={36}
                                  />
                                )}
                                <span
                                  title={presence.label}
                                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                                    presence.isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                                  }`}
                                />
                              </div>
                              <div>
                                <span>{st.displayName}</span>
                                {st.section && (
                                  <p className="text-[11px] font-normal text-[#4D6354]">{st.section}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="text-xs">
                              <span
                                className={`inline-flex items-center gap-1.5 font-bold ${
                                  presence.isOnline ? 'text-emerald-700' : 'text-[#4D6354]'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    presence.isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                                  }`}
                                />
                                {presence.label}
                              </span>
                              <p className="text-[11px] text-[#4D6354]">{presence.lastSeenText}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap ${activity.className}`}
                            >
                              <Activity className="w-3.5 h-3.5 shrink-0" />
                              {activity.label}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-[#4D6354] capitalize">
                            {st.petName} · Lv. {st.petLevel}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-[#4D6354]">{careAvg}%</td>
                          <td className="py-3 pr-4 tabular-nums text-[#4D6354]">{acc}%</td>
                          <td className="py-3 pr-4 font-bold text-[#1E5B3A] tabular-nums">
                            {st.totalScore}
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            <span
                              className={`text-xs font-bold ${
                                strikeCount >= 3
                                  ? 'text-red-700'
                                  : strikeCount > 0
                                    ? 'text-[#EA7A26]'
                                    : 'text-[#4D6354]'
                              }`}
                            >
                              {strikeCount} {strikeCount === 1 ? 'Strike' : 'Strikes'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {st.lockedOut ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (matchingAlert) {
                                    void onAllowStudent(matchingAlert);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Locked · Allow
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                  presence.isOnline ? 'text-[#1E5B3A]' : 'text-[#4D6354]'
                                }`}
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {presence.isOnline ? 'Focused' : 'Offline'}
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

            {/* Helper for legacy/unassigned students so teachers can claim them into their room */}
            {unassignedStudents.length > 0 && (!isAdmin || adminRoomFilter !== '__UNASSIGNED__') && (
              <div className="pt-5 border-t border-[#ECE7D8] space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-[#172A1E]">
                    Unassigned Students Without a Section ({unassignedStudents.length})
                  </h4>
                  <p className="text-xs text-[#4D6354]">
                    Assign students who have not picked a section yet directly into{' '}
                    <strong>{isAdmin && activeRoomSection !== 'ALL' ? activeRoomSection : myTeachingSection}</strong>.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {unassignedStudents.map((st) => {
                    const targetSec =
                      isAdmin && activeRoomSection !== 'ALL' && activeRoomSection !== '__UNASSIGNED__'
                        ? activeRoomSection
                        : myTeachingSection;
                    return (
                      <div
                        key={st.uid}
                        className="p-3 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#172A1E] truncate">{st.displayName}</p>
                          <p className="text-[11px] text-[#4D6354] truncate">Pet: {st.petName}</p>
                        </div>
                        <button
                          type="button"
                          disabled={assigningUid === st.uid}
                          onClick={async () => {
                            setAssigningUid(st.uid);
                            try {
                              await onAssignStudentSection(st.uid, targetSec);
                              soundFx.playCorrect();
                            } finally {
                              setAssigningUid(null);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#1E5B3A] hover:bg-[#17462C] text-white text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-60"
                        >
                          {assigningUid === st.uid ? 'Adding...' : '+ Add to Class'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {roomAlerts.length > 0 && (
              <div className="pt-5 border-t border-[#ECE7D8] space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-[#172A1E]">
                    Classroom Integrity Violation History ({roomAlerts.length})
                  </h4>
                  <p className="text-xs text-[#4D6354]">
                    Permanent log of every tab switch, split-screen, fullscreen exit, or copy/paste attempt — even after a student is allowed back.
                  </p>
                </div>
                <div className="divide-y divide-[#F2EFE6] max-h-64 overflow-y-auto">
                  {roomAlerts.slice(0, 25).map((al) => (
                    <div key={al.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-[#172A1E]">{al.studentName}</span>
                        <span className="text-[#4D6354]"> · {al.gameTitle} ({al.subject})</span>
                        <p className="text-red-700 mt-0.5">{al.reason}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-bold capitalize ${
                            al.status === 'locked' ? 'text-red-600' : 'text-[#1E5B3A]'
                          }`}
                        >
                          {al.status === 'locked' ? 'Currently Locked' : `Allowed by ${al.resolvedBy || 'Teacher'}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Admin Recent School Activity Feed */}
          {isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#172A1E] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#EA7A26]" />
                    Recent School Activity Feed
                  </h3>
                  <p className="text-xs text-[#4D6354]">
                    Latest quiz completions and integrity events across all San Lorenzo Academy classrooms.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#4D6354]">
                  Showing {campusActivityFeed.length} recent events
                </span>
              </div>

              {campusActivityFeed.length === 0 ? (
                <p className="text-sm text-[#4D6354] py-6 text-center bg-[#FAF8F2] rounded-2xl">
                  No quiz completions or integrity events recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-[#F2EFE6]">
                  {campusActivityFeed.map((item) => (
                    <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                            item.kind === 'alert' ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-[#172A1E]">
                            <span className="font-bold">{item.actorName}</span>
                            {item.section && (
                              <span className="text-[#4D6354]"> · {item.section}</span>
                            )}
                          </p>
                          <p className={item.kind === 'alert' ? 'text-red-700 font-medium mt-0.5' : 'text-[#4D6354] mt-0.5'}>
                            {item.detail}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-[#4D6354] whitespace-nowrap">
                        {formatLastSeen(item.ts, nowMs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'pptx' && (
        <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#172A1E]">
              Insert PowerPoint (.pptx) to Create Quiz Game
            </h3>
            <p className="text-xs text-[#4D6354] mt-1">
              Upload your lecture PowerPoint file. LORENZONE reads your slide XML locally and turns slide titles, &quot;Term: Definition&quot; bullets, and &quot;Q:/A:&quot; pairs into a playable quiz deck for all 11 games.
            </p>
          </div>

          <label className="block border-2 border-dashed border-[#1E5B3A]/40 hover:border-[#1E5B3A] rounded-2xl p-8 text-center bg-[#FAF8F2] cursor-pointer transition-colors">
            <UploadCloud className="w-10 h-10 text-[#1E5B3A] mx-auto mb-3" />
            <p className="text-sm font-bold text-[#172A1E]">Click to upload a .pptx PowerPoint file</p>
            <p className="text-xs text-[#4D6354] mt-1">
              Supports standard PowerPoint presentations (.pptx)
            </p>
            <input
              type="file"
              accept=".pptx"
              onChange={(e) => void handlePptxUpload(e)}
              className="hidden"
            />
          </label>

          {pptxStatus && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#1E5B3A]">
              {pptxStatus}
            </div>
          )}

          <div className="pt-4 border-t border-[#ECE7D8] space-y-3">
            <p className="text-xs font-bold text-[#172A1E] flex items-center gap-1.5">
              <FileUp className="w-4 h-4 text-[#EA7A26]" />
              Or Paste Slide Notes Directly
            </p>
            <textarea
              rows={5}
              value={pptxTextFallback}
              onChange={(e) => setPptxTextFallback(e.target.value)}
              placeholder={`Slide 1 Title: Cell Biology\nMitochondria: Powerhouse of the cell\nNucleus: Control center holding DNA\n\nSlide 2 Title: Photosynthesis\nQ: What gas do plants release?\nAnswer: Oxygen`}
              className="w-full p-3.5 rounded-xl border border-[#D8D0BC] text-xs font-mono focus:outline-none focus:border-[#1E5B3A]"
            />
            <button
              type="button"
              onClick={handleConvertTextSlides}
              className="px-5 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer"
            >
              Convert Slide Notes to Quiz
            </button>
          </div>
        </div>
      )}

      {tab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handlePublishDeck}
            className="lg:col-span-8 bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-[#172A1E]">
                {editingDeckId ? 'Edit Subject Quiz Deck' : 'Customize Subject Quiz Deck'}
              </h3>
              {editingDeckId && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    resetBuilder();
                    setBuilderFeedback(null);
                  }}
                  className="text-xs font-semibold text-[#4D6354] hover:text-[#172A1E] cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">Deck Title</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  placeholder="e.g., Quarter 2 Science Review"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">Subject</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={deckSubject}
                  onChange={(e) => setDeckSubject(e.target.value)}
                  placeholder="e.g., Science, Math, English"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#172A1E] cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={deckPublished}
                onChange={(e) => setDeckPublished(e.target.checked)}
                className="rounded border-[#D8D0BC]"
              />
              Publish to Student Mini-Games immediately
            </label>

            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E5B3A]">Question #{idx + 1}</span>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Question prompt..."
                    value={q.prompt}
                    onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-sm"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="Exact Answer (e.g., PHOTOSYNTHESIS)"
                      value={q.answer}
                      onChange={(e) => updateQuestion(idx, { answer: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-sm font-semibold"
                    />
                    <input
                      type="text"
                      placeholder="Hint (for Lorenscape / Brainzone)"
                      value={q.hint}
                      onChange={(e) => updateQuestion(idx, { hint: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Category (for Sorting Squad)"
                      value={q.category || ''}
                      onChange={(e) => updateQuestion(idx, { category: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((oIdx) => (
                      <input
                        key={oIdx}
                        type="text"
                        placeholder={`Choice ${oIdx + 1}`}
                        value={q.options[oIdx] || ''}
                        onChange={(e) => {
                          const nextOpts = [...q.options];
                          nextOpts[oIdx] = e.target.value;
                          updateQuestion(idx, { options: nextOpts });
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#D8D0BC] bg-white text-xs"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {builderFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  builderFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-[#1E5B3A]'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {builderFeedback.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={questions.length >= 50}
                onClick={addBlankQuestion}
                className="px-4 py-2.5 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Question ({questions.length}/50)
              </button>
              <button
                type="submit"
                disabled={savingDeck}
                className="px-6 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {savingDeck
                  ? 'Saving...'
                  : editingDeckId
                    ? 'Save Deck Changes'
                    : 'Publish Quiz to All Games'}
              </button>
            </div>
          </form>

          {/* Published Custom Decks */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
            <h4 className="text-sm font-bold text-[#172A1E]">Custom &amp; Imported Decks</h4>
            {customDecks.length === 0 ? (
              <p className="text-xs text-[#4D6354]">No custom decks created yet.</p>
            ) : (
              <div className="space-y-3">
                {customDecks.map((deck) => {
                  const canManage = deck.teacherId === teacherProfile.uid || isAdmin;
                  return (
                    <div key={deck.id} className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#EA7A26]">
                          {deck.subject} · {deck.isPublished ? 'Published' : 'Draft'}
                        </p>
                        <p className="text-sm font-bold text-[#172A1E] truncate">{deck.title}</p>
                        <p className="text-xs text-[#4D6354] mt-0.5 tabular-nums">
                          {deck.questions.length} questions · {deck.sourceType.toUpperCase()}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              void onUpdateDeck(deck.id, {
                                title: deck.title,
                                subject: deck.subject,
                                description: deck.description,
                                sourceType: deck.sourceType,
                                questions: deck.questions,
                                isPublished: !deck.isPublished,
                              })
                            }
                            className="p-1.5 text-[#4D6354] hover:bg-white rounded-lg cursor-pointer"
                            title={deck.isPublished ? 'Unpublish deck' : 'Publish deck'}
                            aria-label={deck.isPublished ? `Unpublish ${deck.title}` : `Publish ${deck.title}`}
                          >
                            {deck.isPublished ? <Eye className="w-4 h-4 text-[#1E5B3A]" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditDeck(deck)}
                            className="p-1.5 text-[#1E5B3A] hover:bg-white rounded-lg cursor-pointer"
                            aria-label={`Edit ${deck.title}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteDeck(deck.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                            aria-label={`Delete ${deck.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'admin' && isAdmin && (
        <div className="space-y-6">
          {/* Secret Access Codes Card */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const cleanTeach = teacherCodeInput.trim();
              const cleanAdmin = adminCodeInput.trim();
              if (cleanTeach.length < 4 || cleanAdmin.length < 4) {
                setCodesFeedback({ type: 'err', text: 'Codes must be at least 4 characters long.' });
                return;
              }
              if (cleanTeach === cleanAdmin) {
                setCodesFeedback({
                  type: 'err',
                  text: 'Teacher Secret Code and Admin Secret Code must be different.',
                });
                return;
              }
              setSavingCodes(true);
              setCodesFeedback(null);
              try {
                await onUpdateAccessCodes(cleanTeach, cleanAdmin);
                soundFx.playLevelUp();
                setCodesFeedback({
                  type: 'ok',
                  text: 'Secret access codes updated for all Teacher and Admin logins.',
                });
              } catch (err) {
                soundFx.playWrong();
                setCodesFeedback({
                  type: 'err',
                  text: err instanceof Error ? err.message : 'Unable to save secret codes.',
                });
              } finally {
                setSavingCodes(false);
              }
            }}
            className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#172A1E] flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#EA7A26]" />
                  Secret Access Codes (One for Admin, One for Teachers)
                </h3>
                <p className="text-xs text-[#4D6354] mt-1">
                  Teachers use the Teacher Secret Code to open their classroom monitor and cannot elevate to Admin. Admins have their own separate Admin Secret Code.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#1E5B3A]">Teacher Secret Code</label>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(teacherCodeInput);
                      setCodesFeedback({ type: 'ok', text: 'Copied Teacher Secret Code.' });
                    }}
                    className="text-xs font-semibold text-[#4D6354] hover:text-[#172A1E] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={40}
                  value={teacherCodeInput}
                  onChange={(e) => setTeacherCodeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] bg-white text-sm font-mono font-bold text-[#172A1E]"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#C65B10]">Admin Secret Code</label>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(adminCodeInput);
                      setCodesFeedback({ type: 'ok', text: 'Copied Admin Secret Code.' });
                    }}
                    className="text-xs font-semibold text-[#4D6354] hover:text-[#172A1E] flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={40}
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] bg-white text-sm font-mono font-bold text-[#172A1E]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              {codesFeedback ? (
                <p
                  className={`text-xs font-semibold ${
                    codesFeedback.type === 'ok' ? 'text-[#1E5B3A]' : 'text-red-700'
                  }`}
                >
                  {codesFeedback.text}
                </p>
              ) : (
                <p className="text-xs text-[#4D6354]">
                  Tip: Change these secret codes anytime — one code is strictly for Teachers and the other is strictly for Admins.
                </p>
              )}
              <button
                type="submit"
                disabled={savingCodes}
                className="px-5 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {savingCodes ? 'Saving Codes...' : 'Save Secret Codes'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Authorize Teacher Form (Teachers Only) */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanEmail = facultyEmail.trim().toLowerCase();
                if (!cleanEmail || !facultyName.trim()) {
                  setFacultyFeedback({
                    type: 'err',
                    text: 'Please provide both Teacher Full Name and Gmail Address.',
                  });
                  return;
                }
                setSavingFaculty(true);
                setFacultyFeedback(null);
                try {
                  await onAddAuthorizedFaculty(cleanEmail, facultyName.trim(), 'teacher');
                  soundFx.playLevelUp();
                  setFacultyFeedback({
                    type: 'ok',
                    text: `Authorized ${cleanEmail} as a Teacher.`,
                  });
                  setFacultyEmail('');
                  setFacultyName('');
                } catch (err) {
                  soundFx.playWrong();
                  setFacultyFeedback({
                    type: 'err',
                    text: err instanceof Error ? err.message : 'Unable to authorize teacher email.',
                  });
                } finally {
                  setSavingFaculty(false);
                }
              }}
              className="lg:col-span-5 bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4"
            >
            <div>
              <h3 className="text-lg font-bold text-[#172A1E] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#EA7A26]" />
                Authorize Teacher Gmail
              </h3>
              <p className="text-xs text-[#4D6354] mt-1">
                Pre-authorize a teacher&apos;s Gmail account so they enter Teacher Classroom mode directly without needing Admin privileges.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-1">Teacher Full Name</label>
              <input
                type="text"
                required
                maxLength={60}
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                placeholder="e.g., Ms. Elena Santos"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-1">Gmail Address</label>
              <input
                type="email"
                required
                maxLength={120}
                value={facultyEmail}
                onChange={(e) => setFacultyEmail(e.target.value)}
                placeholder="teacher@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#E5DEC9] text-xs text-[#4D6354]">
              Authorized Role: <strong className="text-[#1E5B3A]">Teacher</strong> (Individual Classroom Room &amp; Quizzes only — cannot promote to Admin).
            </div>

            {facultyFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold ${
                  facultyFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-[#1E5B3A]'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {facultyFeedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingFaculty}
              className="w-full py-2.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {savingFaculty ? 'Saving Authorization...' : 'Authorize Teacher'}
            </button>
          </form>

          {/* Authorized Faculty List & Enrolled User Role Control */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
              <h4 className="text-sm font-bold text-[#172A1E]">Authorized Teachers Allowlist</h4>
              {authorizedFaculty.length === 0 ? (
                <p className="text-xs text-[#4D6354]">
                  No pre-authorized teachers added yet. Teachers can also join using the Teacher Secret Code.
                </p>
              ) : (
                <div className="divide-y divide-[#F2EFE6]">
                  {authorizedFaculty.map((fac) => (
                    <div key={fac.email} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#172A1E]">{fac.fullName}</p>
                        <p className="text-xs text-[#4D6354]">
                          {fac.email} · <span className="capitalize font-semibold text-[#1E5B3A]">{fac.role}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onRemoveAuthorizedFaculty(fac.email)}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#172A1E]">Manage Student &amp; Teacher Accounts</h4>
                <p className="text-xs text-[#4D6354] mt-0.5">
                  Assign accounts between Student and Teacher roles. Teachers cannot be elevated to Admin here.
                </p>
              </div>
              <div className="divide-y divide-[#F2EFE6]">
                {allProfiles.map((userProf) => (
                  <div key={userProf.uid} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#172A1E]">{userProf.displayName}</p>
                      <p className="text-xs text-[#4D6354] capitalize">
                        Role: <strong className="text-[#1E5B3A]">{userProf.role}</strong> · Section:{' '}
                        {userProf.section || 'Unassigned'} · Pet: {userProf.petName}
                      </p>
                    </div>
                    {userProf.uid === teacherProfile.uid ? (
                      <span className="px-2.5 py-1 rounded-lg bg-[#EA7A26]/15 text-[#C65B10] text-xs font-bold">
                        Your Admin Account
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {(['student', 'teacher'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            disabled={userProf.role === r}
                            onClick={() => void onUpdateUserRole(userProf.uid, r)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                              userProf.role === r
                                ? 'bg-[#1E5B3A] text-white cursor-default'
                                : 'border border-[#D8D0BC] text-[#4D6354] hover:bg-[#FAF8F2]'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

          {/* Admin Reset Web App & Classroom Data */}
          {onAdminResetApp && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (resetConfirmText.trim().toUpperCase() !== 'RESET' || resetBusy) return;
                setResetBusy(true);
                setResetFeedback(null);
                try {
                  const summary = await onAdminResetApp({
                    mode: resetMode,
                    includeCustomDecks: resetDecks,
                    includeFacultyAllowlist: resetMode === 'full_wipe' ? resetAllowlist : false,
                    resetSelfProfile: resetMode === 'full_wipe' ? resetSelf : false,
                  });
                  soundFx.playLevelUp();
                  setResetConfirmText('');
                  setResetFeedback({
                    type: 'ok',
                    text:
                      resetMode === 'scores_only'
                        ? `Reset complete: cleared ${summary.deletedScores} scores, ${summary.deletedAlerts} alerts, ${summary.deletedDecks} custom decks, and reset stats for ${summary.affectedProfiles} accounts.`
                        : `Full reset complete: removed ${summary.affectedProfiles} accounts, ${summary.deletedScores} scores, ${summary.deletedAlerts} alerts, and ${summary.deletedDecks} custom decks.`,
                  });
                } catch (err) {
                  soundFx.playWrong();
                  setResetFeedback({
                    type: 'err',
                    text: err instanceof Error ? err.message : 'Unable to reset web app data.',
                  });
                } finally {
                  setResetBusy(false);
                }
              }}
              className="bg-white rounded-3xl border-2 border-red-200 p-6 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-red-600" />
                    Reset Web App &amp; Classroom Data
                  </h3>
                  <p className="text-xs text-[#4D6354] mt-1">
                    Start a new semester or wipe test data directly from your Admin console without opening Firebase Console.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-[11px] font-bold text-red-700">
                  Admin Only · Permanent Action
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label
                  className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                    resetMode === 'scores_only'
                      ? 'bg-[#FAF8F2] border-[#1E5B3A]'
                      : 'bg-white border-[#E5DEC9] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="adminResetMode"
                      checked={resetMode === 'scores_only'}
                      onChange={() => {
                        setResetMode('scores_only');
                        setResetDecks(false);
                        setResetAllowlist(false);
                        setResetSelf(false);
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-[#172A1E]">
                        Reset Scores, Alerts &amp; Pet Stats (Keep Accounts)
                      </p>
                      <p className="text-xs text-[#4D6354] mt-1">
                        Clears all leaderboard scores and integrity strikes, and resets every user&apos;s coins (120), XP, and level back to Level 1 while keeping their login &amp; section.
                      </p>
                    </div>
                  </div>
                </label>

                <label
                  className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                    resetMode === 'full_wipe'
                      ? 'bg-red-50/70 border-red-400'
                      : 'bg-white border-[#E5DEC9] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="adminResetMode"
                      checked={resetMode === 'full_wipe'}
                      onChange={() => {
                        setResetMode('full_wipe');
                        setResetDecks(true);
                      }}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-red-900">
                        Full Website Reset (Wipe All Accounts &amp; Data)
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        Deletes all student and teacher accounts (they will go through onboarding again), plus all scores and anti-cheat alerts.
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-2.5 text-xs font-semibold text-[#172A1E]">
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={resetDecks}
                    onChange={(e) => setResetDecks(e.target.checked)}
                    className="rounded border-[#D8D0BC]"
                  />
                  Also delete all custom &amp; imported PPTX quiz decks ({customDecks.length})
                </label>

                {resetMode === 'full_wipe' && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                      <input
                        type="checkbox"
                        checked={resetAllowlist}
                        onChange={(e) => setResetAllowlist(e.target.checked)}
                        className="rounded border-[#D8D0BC]"
                      />
                      Also clear the pre-authorized teacher Gmail allowlist ({authorizedFaculty.length})
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer w-fit text-red-700">
                      <input
                        type="checkbox"
                        checked={resetSelf}
                        onChange={(e) => setResetSelf(e.target.checked)}
                        className="rounded border-red-300"
                      />
                      Also delete my own Admin profile and restart onboarding
                    </label>
                  </>
                )}
              </div>

              {resetFeedback && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold ${
                    resetFeedback.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-[#1E5B3A]'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {resetFeedback.text}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <label htmlFor="admin-reset-confirm" className="text-xs font-bold text-[#172A1E] whitespace-nowrap">
                    Type <span className="font-mono text-red-700">RESET</span> to confirm:
                  </label>
                  <input
                    id="admin-reset-confirm"
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    maxLength={10}
                    className="px-3 py-2 rounded-xl border border-red-200 bg-white text-xs font-mono font-bold w-28 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetBusy || resetConfirmText.trim().toUpperCase() !== 'RESET'}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  {resetBusy
                    ? 'Resetting Web App...'
                    : resetMode === 'full_wipe'
                      ? 'Execute Full Website Reset'
                      : 'Reset Scores & Pet Stats'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
