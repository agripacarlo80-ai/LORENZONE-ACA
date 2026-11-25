import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileUp,
  GraduationCap,
  IdCard,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Play,
  Plus,
  Presentation,
  Radio,
  RotateCcw,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  UserPlus,
  Users,
  Volume2,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import {
  AntiCheatAlert,
  ApprovalStatus,
  AuthorizedFaculty,
  ClassroomSession,
  CluePanel,
  GameId,
  GeneratedSlide,
  PublicProfile,
  QuestionType,
  QuizDeck,
  QuizQuestion,
  SchoolIdVerification,
  ScoreRecord,
  SectionChangeRequest,
} from '../types';
import { STARTING_COINS } from '../lib/progression';
import { GAMES_CATALOG, SLA_SECTIONS } from '../data/defaultDecks';
import { auth } from '../lib/firebase';
import { compressCluePhoto } from '../lib/imageUpload';
import { downloadGeneratedPptx } from '../lib/pptxGenerator';
import { downloadLeaderboardCsv, parsePlainTextSlides, parsePptxFile } from '../lib/pptxParser';
import { formatLastSeen, getStudentPresence, timestampToMillis } from '../lib/presence';
import { QUESTION_TYPE_LABELS, sanitizeQuestionForFirestore } from '../lib/questionUtils';
import { soundFx } from '../lib/sound';
import { PetAvatar } from './PetAvatar';

interface TeacherMonitorProps {
  teacherProfile: PublicProfile;
  allProfiles: PublicProfile[];
  alerts: AntiCheatAlert[];
  records: ScoreRecord[];
  customDecks: QuizDeck[];
  publishedDecks: QuizDeck[];
  classroomSessions: ClassroomSession[];
  authorizedFaculty: AuthorizedFaculty[];
  schoolIdVerifications?: SchoolIdVerification[];
  onReviewStudentApproval?: (
    studentUid: string,
    decision: 'approved' | 'rejected',
    note: string
  ) => Promise<void>;
  sectionChangeRequests?: SectionChangeRequest[];
  onReviewSectionChange?: (
    studentUid: string,
    decision: 'approved' | 'rejected',
    finalSection: string,
    note: string
  ) => Promise<void>;
  onAllowStudent: (alert: AntiCheatAlert) => Promise<void>;
  onSaveDeck: (deck: Omit<QuizDeck, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateDeck: (
    deckId: string,
    patch: Pick<QuizDeck, 'title' | 'subject' | 'description' | 'sourceType' | 'questions' | 'isPublished'>
  ) => Promise<void>;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onLaunchTeacherGame: (gameId: GameId, deckId?: string) => void;
  onStartClassroomSession: (section: string, gameId: GameId, deck: QuizDeck) => Promise<void>;
  onEndClassroomSession: (sessionId: string) => Promise<void>;
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

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'SL'
  );
}

function getActivityBadge(profile: PublicProfile, isOnline: boolean, ignoreLock = false) {
  if (profile.lockedOut && !ignoreLock) {
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
  const activity = (profile.activeGame || 'Lobby').replace(/\s*\(Locked\)$/i, '').trim() || 'Lobby';
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
  publishedDecks,
  classroomSessions,
  authorizedFaculty,
  schoolIdVerifications = [],
  onReviewStudentApproval,
  sectionChangeRequests = [],
  onReviewSectionChange,
  onAllowStudent,
  onSaveDeck,
  onUpdateDeck,
  onDeleteDeck,
  onLaunchTeacherGame,
  onStartClassroomSession,
  onEndClassroomSession,
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
      questionType: 'multiple_choice',
      prompt: '',
      answer: '',
      options: ['', '', '', ''],
      hint: '',
      category: 'Core',
    },
  ]);
  const [savingDeck, setSavingDeck] = useState(false);
  const [builderFeedback, setBuilderFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // PPTX Importer & AI PPTX Generator state
  const [pptxStatus, setPptxStatus] = useState<string | null>(null);
  const [pptxTextFallback, setPptxTextFallback] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiSubject, setAiSubject] = useState('Science');
  const [aiGradeLevel, setAiGradeLevel] = useState('Grade 8');
  const [aiSlideCount, setAiSlideCount] = useState(6);
  const [aiQuestionCount, setAiQuestionCount] = useState(6);
  const [aiNotes, setAiNotes] = useState('');
  const [aiQuestionMix, setAiQuestionMix] = useState<QuestionType[]>([
    'identification',
    'fill_in_blank',
    'enumeration',
    'four_pics',
    'multiple_choice',
  ]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDownloadingPptx, setAiDownloadingPptx] = useState(false);
  const [aiPublishing, setAiPublishing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPublishMsg, setAiPublishMsg] = useState<string | null>(null);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<{
    deckTitle: string;
    subject: string;
    gradeLevel: string;
    description: string;
    slides: GeneratedSlide[];
    questions: QuizQuestion[];
  } | null>(null);

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

  // Per-Classroom Live Quiz Launcher state
  const [launcherGameId, setLauncherGameId] = useState<GameId>('quiz_master');
  const [launcherDeckId, setLauncherDeckId] = useState<string>(() => publishedDecks[0]?.id || '');
  const [adminTargetRoom, setAdminTargetRoom] = useState<string>(SLA_SECTIONS[6]);
  const [launcherBusy, setLauncherBusy] = useState(false);
  const [launcherFeedback, setLauncherFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showActiveAnswerKey, setShowActiveAnswerKey] = useState(false);

  // Admin Student School ID Approval state
  const [approvalFilter, setApprovalFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [approvalSearch, setApprovalSearch] = useState('');
  const [inspectingUid, setInspectingUid] = useState<string | null>(null);
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [reviewBusyUid, setReviewBusyUid] = useState<string | null>(null);

  // Admin Section Spelling Correction Requests state
  const [sectionReqFilter, setSectionReqFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [sectionEdits, setSectionEdits] = useState<Record<string, string>>({});
  const [sectionReviewNotes, setSectionReviewNotes] = useState<Record<string, string>>({});
  const [sectionReviewBusyUid, setSectionReviewBusyUid] = useState<string | null>(null);

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

  useEffect(() => {
    if (publishedDecks.length > 0 && !publishedDecks.some((d) => d.id === launcherDeckId)) {
      setLauncherDeckId(publishedDecks[0].id);
    }
  }, [publishedDecks, launcherDeckId]);

  const isAdmin = teacherProfile.role === 'admin';

  // Ensure Admin never enters quiz builder or PPTX tabs
  useEffect(() => {
    if (isAdmin && (tab === 'builder' || tab === 'pptx')) {
      setTab('live');
    }
  }, [isAdmin, tab]);

  const myTeachingSection = teacherProfile.section?.trim() || SLA_SECTIONS[6];
  const allStudents = allProfiles.filter((p) => p.role === 'student');
  const allTeachers = allProfiles.filter((p) => p.role === 'teacher');

  const verificationByUid = new Map(schoolIdVerifications.map((v) => [v.uid, v]));
  const studentApprovalRecords = allStudents.map((st) => {
    const verif = verificationByUid.get(st.uid) || null;
    const effectiveStatus: ApprovalStatus = st.approvalStatus || verif?.status || 'pending';
    return {
      student: st,
      verification: verif,
      status: effectiveStatus,
      note: st.approvalNote || verif?.reviewNote || '',
    };
  });

  const pendingApprovalsCount = studentApprovalRecords.filter((r) => r.status === 'pending').length;
  const approvedStudentsCount = studentApprovalRecords.filter((r) => r.status === 'approved').length;
  const rejectedApprovalsCount = studentApprovalRecords.filter((r) => r.status === 'rejected').length;

  const filteredApprovalRecords = studentApprovalRecords.filter((rec) => {
    if (approvalFilter !== 'all' && rec.status !== approvalFilter) return false;
    const q = approvalSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      rec.student.displayName.toLowerCase().includes(q) ||
      (rec.student.section || '').toLowerCase().includes(q) ||
      (rec.verification?.schoolIdNumber || '').toLowerCase().includes(q) ||
      (rec.verification?.email || '').toLowerCase().includes(q)
    );
  });

  const inspectedApprovalItem = inspectingUid
    ? studentApprovalRecords.find((r) => r.student.uid === inspectingUid) || null
    : null;

  const pendingSectionRequestsCount = sectionChangeRequests.filter((r) => r.status === 'pending').length;
  const approvedSectionRequestsCount = sectionChangeRequests.filter((r) => r.status === 'approved').length;
  const rejectedSectionRequestsCount = sectionChangeRequests.filter((r) => r.status === 'rejected').length;
  const filteredSectionRequests = sectionChangeRequests.filter((r) =>
    sectionReqFilter === 'all' ? true : r.status === sectionReqFilter
  );

  const availableRoomSections = Array.from(
    new Set([
      ...SLA_SECTIONS,
      ...allStudents.map((s) => (s.section || '').trim()).filter(Boolean),
    ])
  );

  useEffect(() => {
    if (adminRoomFilter !== 'ALL' && adminRoomFilter !== '__UNASSIGNED__') {
      setAdminTargetRoom(adminRoomFilter);
    }
  }, [adminRoomFilter]);

  const launcherTargetSection = isAdmin ? adminTargetRoom : myTeachingSection;
  const launcherSelectedDeck =
    publishedDecks.find((d) => d.id === launcherDeckId) || publishedDecks[0] || null;
  const activeClassroomSessions = classroomSessions.filter((s) => s.status === 'active');
  const activeSessionForTarget = activeClassroomSessions.find(
    (s) => s.section.trim() === launcherTargetSection.trim()
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

  const roomAlerts = isAdmin
    ? []
    : alerts.filter((a) => roomStudentIds.has(a.studentId));
  const lockedAlerts = roomAlerts.filter((a) => a.status === 'locked');

  const onlineCount = students.filter((st) => getStudentPresence(st, nowMs).isOnline).length;
  const offlineCount = students.length - onlineCount;
  const filteredStudents = students.filter((st) => {
    if (presenceFilter === 'all') return true;
    const { isOnline } = getStudentPresence(st, nowMs);
    return presenceFilter === 'online' ? isOnline : !isOnline;
  });

  // Admin Campus-wide live monitoring metrics (no pets, quizzes, or anti-cheat alerts)
  const onlineTeachersCount = allTeachers.filter((t) => getStudentPresence(t, nowMs).isOnline).length;
  const allOnlineStudentsCount = allStudents.filter((s) => getStudentPresence(s, nowMs).isOnline).length;
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
        ...schoolIdVerifications.slice(0, 10).map((v) => ({
          id: `ver_${v.uid}`,
          kind: (v.status === 'rejected' ? 'declined' : 'verification') as 'verification' | 'declined' | 'score',
          actorName: v.studentName,
          section: v.section || '',
          detail:
            v.status === 'approved'
              ? `School ID #${v.schoolIdNumber} approved by ${v.reviewedBy || 'Admin'}`
              : v.status === 'rejected'
                ? `School ID #${v.schoolIdNumber} declined${v.reviewNote ? ` — ${v.reviewNote}` : ''}`
                : `Submitted School ID #${v.schoolIdNumber} for student verification`,
          ts: timestampToMillis(v.updatedAt) || timestampToMillis(v.submittedAt),
        })),
        ...records.slice(0, 10).map((r) => ({
          id: `rec_${r.id}`,
          kind: 'score' as const,
          actorName: r.studentName,
          section: profileByUid.get(r.studentId)?.section || '',
          detail: `Activity in ${r.subject} · ${r.score} pts`,
          ts: timestampToMillis(r.createdAt),
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
        questionType: 'multiple_choice',
        prompt: '',
        answer: '',
        options: ['', '', '', ''],
        hint: '',
        category: deckSubject,
      },
    ]);
  };

  const handleToggleAiQuestionMix = (qType: QuestionType) => {
    setAiQuestionMix((prev) => {
      if (prev.includes(qType)) {
        return prev.length > 1 ? prev.filter((t) => t !== qType) : prev;
      }
      return [...prev, qType];
    });
  };

  const handleGenerateAiPptx = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTopic = aiTopic.trim();
    if (cleanTopic.length < 3) {
      setAiError('Please enter a lesson topic (at least 3 characters).');
      return;
    }
    setAiGenerating(true);
    setAiError(null);
    setAiPublishMsg(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Please sign in again before generating a PowerPoint deck.');
      }
      const res = await fetch('/api/generate-pptx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          topic: cleanTopic,
          subject: aiSubject.trim() || 'General Education',
          gradeLevel: aiGradeLevel.trim() || 'Grade 8',
          slideCount: aiSlideCount,
          questionCount: aiQuestionCount,
          questionMix: aiQuestionMix,
          notes: aiNotes.trim(),
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        deckTitle?: string;
        subject?: string;
        gradeLevel?: string;
        description?: string;
        slides?: GeneratedSlide[];
        questions?: QuizQuestion[];
      };
      if (!res.ok) {
        throw new Error(payload.error || 'Could not generate PowerPoint slides.');
      }
      if (!payload.slides || payload.slides.length === 0) {
        throw new Error('No slides were generated. Please adjust your topic and try again.');
      }
      setAiGeneratedResult({
        deckTitle: payload.deckTitle || cleanTopic,
        subject: payload.subject || aiSubject,
        gradeLevel: payload.gradeLevel || aiGradeLevel,
        description: payload.description || `${aiSubject} presentation on ${cleanTopic}`,
        slides: payload.slides,
        questions: payload.questions || [],
      });
      soundFx.playLevelUp();
    } catch (err) {
      soundFx.playWrong();
      setAiError(err instanceof Error ? err.message : 'PowerPoint generation failed.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDownloadAiPptx = async () => {
    if (!aiGeneratedResult) return;
    setAiDownloadingPptx(true);
    setAiError(null);
    try {
      await downloadGeneratedPptx({
        title: aiGeneratedResult.deckTitle,
        subject: aiGeneratedResult.subject,
        gradeLevel: aiGeneratedResult.gradeLevel,
        teacherName: teacherProfile.displayName,
        slides: aiGeneratedResult.slides,
        questions: aiGeneratedResult.questions,
      });
      soundFx.playCorrect();
      setAiPublishMsg('PowerPoint (.pptx) downloaded!');
    } catch (err) {
      soundFx.playWrong();
      setAiError(err instanceof Error ? err.message : 'Failed to build .pptx file.');
    } finally {
      setAiDownloadingPptx(false);
    }
  };

  const handleLoadAiIntoBuilder = () => {
    if (!aiGeneratedResult) return;
    soundFx.playClick();
    setEditingDeckId(null);
    setDeckTitle(aiGeneratedResult.deckTitle.slice(0, 100));
    setDeckSubject(aiGeneratedResult.subject.slice(0, 50));
    setDeckDesc(aiGeneratedResult.description.slice(0, 240));
    setDeckSourceType('pptx');
    setDeckPublished(true);
    setQuestions(
      aiGeneratedResult.questions.map((q, idx) => ({
        ...q,
        id: q.id || `ai_q_${Date.now()}_${idx}`,
        questionType: q.questionType || 'multiple_choice',
        options: [q.options[0] || '', q.options[1] || '', q.options[2] || '', q.options[3] || ''],
      }))
    );
    setBuilderFeedback({
      type: 'ok',
      text: `Loaded ${aiGeneratedResult.questions.length} AI-generated questions into Quiz Builder. Review or customize any item, then click Publish!`,
    });
    setTab('builder');
    onSetActivity?.('Building Quiz Deck');
  };

  const handlePublishAiDirectly = async () => {
    if (!aiGeneratedResult || aiGeneratedResult.questions.length === 0) return;
    setAiPublishing(true);
    setAiError(null);
    setAiPublishMsg(null);
    try {
      const cleanSubject = aiGeneratedResult.subject.trim().slice(0, 50) || 'General';
      const cleanedQuestions = aiGeneratedResult.questions
        .filter((q) => q.prompt.trim() && q.answer.trim())
        .slice(0, 50)
        .map((q) => sanitizeQuestionForFirestore(q, cleanSubject));

      if (cleanedQuestions.length === 0) {
        throw new Error('Generated quiz contained no valid questions.');
      }

      const newDeckId = `deck_${Date.now()}`;
      await onSaveDeck({
        id: newDeckId,
        title: aiGeneratedResult.deckTitle.trim().slice(0, 100),
        subject: cleanSubject,
        description: aiGeneratedResult.description.trim().slice(0, 240),
        sourceType: 'pptx',
        teacherId: teacherProfile.uid,
        teacherName: teacherProfile.displayName,
        questions: cleanedQuestions,
        isPublished: true,
      });
      setLauncherDeckId(newDeckId);
      soundFx.playLevelUp();
      setAiPublishMsg(
        `Published "${aiGeneratedResult.deckTitle}" (${cleanedQuestions.length} questions) to all 12 student games!`
      );
    } catch (err) {
      soundFx.playWrong();
      setAiError(err instanceof Error ? err.message : 'Could not publish generated quiz deck.');
    } finally {
      setAiPublishing(false);
    }
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

  const addBlankQuestion = (presetType: QuestionType = 'multiple_choice') => {
    if (questions.length >= 50) return;
    soundFx.playClick();
    const base: QuizQuestion = {
      id: `q_${Date.now()}_${questions.length}`,
      questionType: presetType,
      prompt:
        presetType === 'four_pics'
          ? `4 Pics 1 Word: Identify the ${deckSubject} concept from these 4 visual clues.`
          : '',
      answer: '',
      options: ['', '', '', ''],
      hint: '',
      category: deckSubject,
    };
    if (presetType === 'enumeration') {
      base.enumerationItems = ['', '', ''];
    }
    if (presetType === 'four_pics') {
      base.cluePanels = [
        { label: '', emoji: '🔍' },
        { label: '', emoji: '💡' },
        { label: '', emoji: '📚' },
        { label: '', emoji: '🧩' },
      ];
    }
    setQuestions((prev) => [...prev, base]);
  };

  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const handleChangeQuestionType = (index: number, nextType: QuestionType) => {
    soundFx.playClick();
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        const next: QuizQuestion = { ...q, questionType: nextType };
        if (nextType === 'enumeration') {
          const seedItems =
            q.enumerationItems && q.enumerationItems.length >= 2
              ? q.enumerationItems
              : q.answer.includes(',')
                ? q.answer.split(',').map((s) => s.trim()).filter(Boolean)
                : [q.answer.trim(), '', ''];
          next.enumerationItems = seedItems.length >= 2 ? seedItems : ['', ''];
          next.answer = next.enumerationItems.filter(Boolean).join(', ');
        }
        if (nextType === 'four_pics') {
          if (!q.cluePanels || q.cluePanels.length < 4) {
            next.cluePanels = [
              { label: q.cluePanels?.[0]?.label || '', emoji: q.cluePanels?.[0]?.emoji || '🔍', imageUrl: q.cluePanels?.[0]?.imageUrl },
              { label: q.cluePanels?.[1]?.label || '', emoji: q.cluePanels?.[1]?.emoji || '💡', imageUrl: q.cluePanels?.[1]?.imageUrl },
              { label: q.cluePanels?.[2]?.label || '', emoji: q.cluePanels?.[2]?.emoji || '📚', imageUrl: q.cluePanels?.[2]?.imageUrl },
              { label: q.cluePanels?.[3]?.label || '', emoji: q.cluePanels?.[3]?.emoji || '🧩', imageUrl: q.cluePanels?.[3]?.imageUrl },
            ];
          }
          if (!q.prompt.trim()) {
            next.prompt = `4 Pics 1 Word: Decode the visual clues to guess the ${deckSubject} term!`;
          }
        }
        return next;
      })
    );
  };

  const handleUploadClueImage = async (qIdx: number, panelIdx: number, file: File | undefined) => {
    if (!file) return;
    setBuilderFeedback(null);
    try {
      const compressedUrl = await compressCluePhoto(file);
      setQuestions((prev) =>
        prev.map((q, i) => {
          if (i !== qIdx) return q;
          const targetCount = q.cluePanels && q.cluePanels.length >= 6 ? 6 : 4;
          const basePanels: CluePanel[] = Array.from({ length: targetCount }, (_, pIdx) => ({
            label: q.cluePanels?.[pIdx]?.label || '',
            emoji: q.cluePanels?.[pIdx]?.emoji || ['🔍', '💡', '📚', '🧩', '🧭', '⚡'][pIdx],
            imageUrl: q.cluePanels?.[pIdx]?.imageUrl,
          }));
          basePanels[panelIdx] = {
            ...basePanels[panelIdx],
            imageUrl: compressedUrl,
          };
          return { ...q, cluePanels: basePanels };
        })
      );
      soundFx.playCorrect();
    } catch (err) {
      soundFx.playWrong();
      setBuilderFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to process clue image.',
      });
    }
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
        questionType: q.questionType || 'multiple_choice',
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
      .map((q) => {
        if (q.questionType === 'enumeration' && q.enumerationItems) {
          const validItems = q.enumerationItems.map((it) => it.trim()).filter(Boolean);
          return {
            ...q,
            enumerationItems: validItems,
            answer: validItems.join(', '),
          };
        }
        return q;
      })
      .filter((q) => {
        if (!q.prompt.trim()) return false;
        if (q.questionType === 'enumeration') {
          return Boolean(q.enumerationItems && q.enumerationItems.length >= 2);
        }
        return Boolean(q.answer.trim());
      })
      .slice(0, 50)
      .map((q, idx) =>
        sanitizeQuestionForFirestore(
          { ...q, id: q.id || `q_${idx + 1}` },
          deckSubject.trim() || 'Core'
        )
      );

    if (!deckTitle.trim() || !deckSubject.trim() || cleaned.length === 0) {
      setBuilderFeedback({
        type: 'err',
        text: 'Please enter a deck title, subject, and at least one valid question (for Enumeration, provide at least 2 items).',
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
          text: `Published "${cleanTitle}" (${cleaned.length} questions) to all 12 student mini-games!`,
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
      {/* Real-time Cheating Detector Alert Banner (Teachers only — removed from Admin) */}
      {!isAdmin && lockedAlerts.length > 0 && (
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

      {/* Teacher / Admin Monitor Navigation & Actions */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#EA7A26]">
              San Lorenzo Academy · {isAdmin ? 'Administrator Console' : `Classroom Room: ${myTeachingSection}`}
            </p>
            <h2 className="text-2xl font-bold text-[#172A1E]">
              {isAdmin ? 'Admin Monitoring & Student ID Approvals' : `${myTeachingSection} — Teacher Room`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9]">
              {(isAdmin
                ? [
                    { id: 'live', label: 'Monitor & Approvals' },
                    { id: 'admin', label: 'Admin & Secret Codes' },
                  ]
                : [
                    { id: 'live', label: 'My Classroom' },
                    { id: 'pptx', label: 'PowerPoint & AI' },
                    { id: 'builder', label: 'Quiz Builder' },
                  ]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    const nextTab = t.id as MonitorTab;
                    setTab(nextTab);
                    if (nextTab === 'live') {
                      onSetActivity?.(isAdmin ? 'Admin Control Center' : `Monitoring: ${myTeachingSection}`);
                    } else if (nextTab === 'pptx') {
                      onSetActivity?.('Importing PPTX Slides');
                    } else if (nextTab === 'builder') {
                      onSetActivity?.('Building Quiz Deck');
                    } else if (nextTab === 'admin') {
                      onSetActivity?.('Admin & Secret Codes');
                    }
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    tab === t.id ? 'bg-[#1E5B3A] text-white' : 'text-[#4D6354]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {!isAdmin && (
              <button
                type="button"
                onClick={async () => {
                  soundFx.playQuack();
                  if (launcherSelectedDeck && launcherTargetSection) {
                    try {
                      await onStartClassroomSession(
                        launcherTargetSection,
                        'catch_the_duck',
                        launcherSelectedDeck
                      );
                    } catch {
                      // Proceed to host screen even if broadcast fails
                    }
                  }
                  onLaunchTeacherGame('catch_the_duck', launcherSelectedDeck?.id);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Host Catch the Duck
              </button>
            )}
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
          {/* Live Classroom Quiz Launcher (Teachers only — removed from Admin) */}
          {!isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#EA7A26] flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  Live Classroom Quiz Control (Monitor-Only)
                </p>
                <h3 className="text-lg font-bold text-[#172A1E] mt-0.5">
                  Launch &amp; Monitor Students in {launcherTargetSection}
                </h3>
                <p className="text-xs text-[#4D6354]">
                  Choose a quiz deck and mini-game for your classroom. Enrolled students in{' '}
                  <strong>{launcherTargetSection}</strong> enter automatically and stay locked inside the quiz until they finish or you click End Live Quiz — you only monitor here without answering questions.
                </p>
              </div>
              {activeSessionForTarget && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#1E5B3A] whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Now
                  </span>
                  {activeSessionForTarget.gameId === 'catch_the_duck' ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        onLaunchTeacherGame(activeSessionForTarget.gameId, activeSessionForTarget.deckId);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Open Duck Recitation Host
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        setShowActiveAnswerKey((v) => !v);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {showActiveAnswerKey ? 'Hide Answer Key' : 'View Answer Key'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={launcherBusy}
                    onClick={async () => {
                      setLauncherBusy(true);
                      setLauncherFeedback(null);
                      try {
                        await onEndClassroomSession(activeSessionForTarget.id);
                        soundFx.playClick();
                        setLauncherFeedback({
                          type: 'ok',
                          text: `Ended live classroom quiz for ${activeSessionForTarget.section}.`,
                        });
                      } catch (err) {
                        soundFx.playWrong();
                        setLauncherFeedback({
                          type: 'err',
                          text: err instanceof Error ? err.message : 'Unable to end live quiz.',
                        });
                      } finally {
                        setLauncherBusy(false);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    End Live Quiz
                  </button>
                </div>
              )}
            </div>

            {activeSessionForTarget && (() => {
              const sessionStudents = allStudents.filter(
                (st) => (st.section || '').trim() === activeSessionForTarget.section.trim()
              );
              const sessionStartMs = timestampToMillis(activeSessionForTarget.startedAt);
              const activeSessionDeck =
                publishedDecks.find((d) => d.id === activeSessionForTarget.deckId) || null;
              const finishedByUid = new Map<string, ScoreRecord>();
              records.forEach((rec) => {
                if (
                  rec.gameId === activeSessionForTarget.gameId &&
                  rec.deckId === activeSessionForTarget.deckId &&
                  (!sessionStartMs || timestampToMillis(rec.createdAt) >= sessionStartMs - 5000) &&
                  !finishedByUid.has(rec.studentId)
                ) {
                  finishedByUid.set(rec.studentId, rec);
                }
              });
              const insideCount = sessionStudents.filter(
                (st) =>
                  getStudentPresence(st, nowMs).isOnline &&
                  st.activeGame === `Playing: ${activeSessionForTarget.gameTitle}`
              ).length;

              return (
                <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#1E5B3A]/30 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-[#1E5B3A]">
                        Active in {activeSessionForTarget.section}:
                      </span>{' '}
                      <span className="font-bold text-[#172A1E]">{activeSessionForTarget.gameTitle}</span>
                      <span className="text-[#4D6354]">
                        {' '}
                        · {activeSessionForTarget.subject}: {activeSessionForTarget.deckTitle} · Started by{' '}
                        {activeSessionForTarget.teacherName}
                      </span>
                    </div>
                    <span className="font-semibold text-[#EA7A26] tabular-nums">
                      {insideCount} taking quiz · {finishedByUid.size} completed
                    </span>
                  </div>

                  {sessionStudents.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                      {sessionStudents.map((st) => {
                        const pres = getStudentPresence(st, nowMs);
                        const rec = finishedByUid.get(st.uid);
                        const alertMatch = lockedAlerts.find((a) => a.studentId === st.uid);
                        const inQuiz =
                          pres.isOnline && st.activeGame === `Playing: ${activeSessionForTarget.gameTitle}`;

                        return (
                          <div
                            key={st.uid}
                            className="px-3 py-2 rounded-xl bg-white border border-[#E5DEC9] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-[#172A1E] truncate">{st.displayName}</p>
                              <p className="text-[11px] text-[#4D6354]">
                                {st.lockedOut
                                  ? 'Anti-Cheat Locked'
                                  : rec
                                    ? `Finished · ${rec.score} pts (${rec.correctCount}/${rec.totalCount})`
                                    : inQuiz
                                      ? 'Taking Quiz (Locked)'
                                      : pres.isOnline
                                        ? 'Entering Quiz...'
                                        : 'Offline'}
                              </p>
                            </div>
                            {st.lockedOut && alertMatch ? (
                              <button
                                type="button"
                                onClick={() => {
                                  soundFx.playCorrect();
                                  void onAllowStudent(alertMatch);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                              >
                                Allow
                              </button>
                            ) : (
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                  st.lockedOut
                                    ? 'bg-red-500'
                                    : rec
                                      ? 'bg-[#1E5B3A]'
                                      : inQuiz
                                        ? 'bg-[#EA7A26] animate-pulse'
                                        : 'bg-stone-300'
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showActiveAnswerKey && activeSessionDeck && (
                    <div className="pt-3 border-t border-[#E5DEC9] grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {activeSessionDeck.questions.map((qItem, qIdx) => (
                        <div key={qItem.id || qIdx} className="p-2.5 rounded-xl bg-white border border-[#E5DEC9]">
                          <p className="font-bold text-[#172A1E]">
                            Q{qIdx + 1}. {qItem.prompt}
                          </p>
                          <p className="font-semibold text-[#1E5B3A] mt-0.5">
                            Answer: {qItem.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {isAdmin && (
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-[#172A1E] mb-1">
                    Target Classroom
                  </label>
                  <select
                    value={adminTargetRoom}
                    onChange={(e) => {
                      setAdminTargetRoom(e.target.value);
                      setLauncherFeedback(null);
                    }}
                    aria-label="Target classroom section for live quiz"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] text-xs font-semibold text-[#172A1E]"
                  >
                    {availableRoomSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={isAdmin ? 'md:col-span-4' : 'md:col-span-5'}>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">
                  Quiz Deck (Subject / Custom / PPTX)
                </label>
                <select
                  value={launcherSelectedDeck?.id || ''}
                  onChange={(e) => {
                    setLauncherDeckId(e.target.value);
                    setLauncherFeedback(null);
                  }}
                  aria-label="Choose quiz deck for classroom"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] text-xs font-semibold text-[#172A1E]"
                >
                  {publishedDecks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.subject}: {d.title} ({d.questions.length} Qs)
                    </option>
                  ))}
                </select>
              </div>

              <div className={isAdmin ? 'md:col-span-3' : 'md:col-span-4'}>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">
                  Mini-Game Mode
                </label>
                <select
                  value={launcherGameId}
                  onChange={(e) => {
                    setLauncherGameId(e.target.value as GameId);
                    setLauncherFeedback(null);
                  }}
                  aria-label="Choose mini-game for classroom"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] text-xs font-semibold text-[#172A1E]"
                >
                  {GAMES_CATALOG.map((g) => (
                    <option key={g.id} value={g.id}>
                      {String(g.number).padStart(2, '0')}. {g.title} ({g.modeLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div className={isAdmin ? 'md:col-span-2' : 'md:col-span-3'}>
                <button
                  type="button"
                  disabled={launcherBusy || !launcherSelectedDeck || launcherSelectedDeck.questions.length === 0}
                  onClick={async () => {
                    if (!launcherSelectedDeck) return;
                    setLauncherBusy(true);
                    setLauncherFeedback(null);
                    try {
                      await onStartClassroomSession(
                        launcherTargetSection,
                        launcherGameId,
                        launcherSelectedDeck
                      );
                      soundFx.playLevelUp();
                      const gameName =
                        GAMES_CATALOG.find((g) => g.id === launcherGameId)?.title || launcherGameId;
                      setLauncherFeedback({
                        type: 'ok',
                        text: `Started "${gameName}" (${launcherSelectedDeck.title}) for ${launcherTargetSection}! Students in this section are entering now.`,
                      });
                    } catch (err) {
                      soundFx.playWrong();
                      setLauncherFeedback({
                        type: 'err',
                        text: err instanceof Error ? err.message : 'Could not start classroom quiz.',
                      });
                    } finally {
                      setLauncherBusy(false);
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  {launcherBusy
                    ? 'Starting...'
                    : activeSessionForTarget
                      ? 'Switch Live Quiz'
                      : 'Start Class Quiz'}
                </button>
              </div>
            </div>

            {launcherFeedback && (
              <p
                className={`text-xs font-semibold ${
                  launcherFeedback.type === 'ok' ? 'text-[#1E5B3A]' : 'text-red-700'
                }`}
              >
                {launcherFeedback.text}
              </p>
            )}

            {isAdmin && activeClassroomSessions.length > 0 && (
              <div className="pt-3 border-t border-[#ECE7D8] flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-[#4D6354]">Active Rooms:</span>
                {activeClassroomSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#FAF8F2] border border-[#E5DEC9]"
                  >
                    <span className="font-bold text-[#172A1E]">{sess.section}</span>
                    <span className="text-[#4D6354]">
                      · {sess.gameTitle} ({sess.subject})
                    </span>
                    <button
                      type="button"
                      onClick={() => void onEndClassroomSession(sess.id)}
                      className="text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      End
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}

          {/* Admin Campus-Wide Overview Metrics */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border border-[#E5DEC9] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#4D6354]">Students Online</p>
                  <p className="text-2xl font-extrabold text-[#172A1E] mt-1 tabular-nums">
                    {allOnlineStudentsCount} <span className="text-sm font-semibold text-[#4D6354]">/ {allStudents.length}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-[#1E5B3A] mt-0.5">
                    {approvedStudentsCount} verified enrolled
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
                  <p className="text-xs font-semibold text-[#4D6354]">Pending ID Approvals</p>
                  <p className={`text-2xl font-extrabold mt-1 tabular-nums ${pendingApprovalsCount > 0 ? 'text-[#EA7A26]' : 'text-[#1E5B3A]'}`}>
                    {pendingApprovalsCount} Waiting
                  </p>
                  <p className="text-[11px] text-[#4D6354] mt-0.5">
                    Requires School ID verification
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${pendingApprovalsCount > 0 ? 'bg-[#EA7A26]/15 text-[#EA7A26]' : 'bg-emerald-50 text-[#1E5B3A]'}`}>
                  <IdCard className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-[#E5DEC9] p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#4D6354]">Section Spelling Fixes</p>
                  <p className={`text-2xl font-extrabold mt-1 tabular-nums ${pendingSectionRequestsCount > 0 ? 'text-[#EA7A26]' : 'text-[#1E5B3A]'}`}>
                    {pendingSectionRequestsCount} Pending
                  </p>
                  <p className="text-[11px] text-[#4D6354] mt-0.5">
                    {approvedSectionRequestsCount} approved · {rejectedApprovalsCount} IDs declined
                  </p>
                </div>
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${pendingSectionRequestsCount > 0 ? 'bg-[#EA7A26]/15 text-[#EA7A26]' : 'bg-[#FAF8F2] border border-[#E5DEC9] text-[#1E5B3A]'}`}>
                  <Lock className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}

          {/* Admin Student School ID Approvals Queue */}
          {isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-[#EA7A26] flex items-center gap-1.5">
                    <IdCard className="w-4 h-4" />
                    Campus Access Security
                  </p>
                  <h3 className="text-lg font-bold text-[#172A1E] mt-0.5">
                    Student School ID Verification &amp; Approvals
                  </h3>
                  <p className="text-xs text-[#4D6354]">
                    Inspect each student&apos;s uploaded San Lorenzo Academy School ID before allowing them into the platform so civilians cannot enter.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#4D6354] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={approvalSearch}
                      onChange={(e) => setApprovalSearch(e.target.value)}
                      placeholder="Search name, ID#, section..."
                      aria-label="Search student approvals"
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-[#D8D0BC] text-xs bg-white focus:outline-none focus:border-[#1E5B3A] w-48"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9] text-xs font-semibold">
                    {[
                      { id: 'pending', label: `Pending (${pendingApprovalsCount})` },
                      { id: 'approved', label: `Approved (${approvedStudentsCount})` },
                      { id: 'rejected', label: `Declined (${rejectedApprovalsCount})` },
                      { id: 'all', label: `All (${studentApprovalRecords.length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setApprovalFilter(f.id as 'pending' | 'approved' | 'rejected' | 'all')}
                        className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
                          approvalFilter === f.id
                            ? 'bg-[#1E5B3A] text-white'
                            : 'text-[#4D6354] hover:text-[#172A1E]'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredApprovalRecords.length === 0 ? (
                <p className="text-sm text-[#4D6354] py-8 text-center bg-[#FAF8F2] rounded-2xl">
                  {approvalFilter === 'pending'
                    ? 'No students waiting for School ID approval right now.'
                    : 'No student verification records match this filter.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredApprovalRecords.map(({ student, verification, status, note }) => {
                    const isBusy = reviewBusyUid === student.uid;
                    const isRejectingThis = rejectingUid === student.uid;
                    return (
                      <div
                        key={student.uid}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          status === 'pending'
                            ? 'border-[#EA7A26]/50 bg-[#FFFDF8]'
                            : status === 'rejected'
                              ? 'border-red-200 bg-red-50/40'
                              : 'border-[#E5DEC9] bg-[#FAF8F2]/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {student.photoUrl ? (
                              <img
                                src={student.photoUrl}
                                alt={student.displayName}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover border border-[#1E5B3A] shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#1E5B3A]/10 text-[#1E5B3A] border border-[#1E5B3A]/20 flex items-center justify-center font-bold text-xs shrink-0">
                                {getInitials(student.displayName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#172A1E] truncate">
                                {student.displayName}
                              </p>
                              <p className="text-xs text-[#4D6354] truncate">
                                {student.section || 'No section'}
                                {verification?.email ? ` · ${verification.email}` : ''}
                              </p>
                              <p className="text-xs font-semibold text-[#1E5B3A] mt-0.5">
                                School ID #:{' '}
                                <span className="font-mono">
                                  {verification?.schoolIdNumber || 'Not uploaded yet'}
                                </span>
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 whitespace-nowrap ${
                              status === 'approved'
                                ? 'bg-emerald-50 text-[#1E5B3A] border-emerald-200'
                                : status === 'rejected'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {status === 'approved'
                              ? 'Approved'
                              : status === 'rejected'
                                ? 'Declined'
                                : 'Pending Review'}
                          </span>
                        </div>

                        {verification?.idPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() => setInspectingUid(student.uid)}
                            className="w-full rounded-xl border border-[#E5DEC9] bg-white p-2 flex items-center justify-between gap-3 hover:border-[#1E5B3A] transition-colors cursor-pointer text-left"
                          >
                            <img
                              src={verification.idPhotoUrl}
                              alt={`${student.displayName} School ID`}
                              className="h-20 w-32 object-contain rounded-lg bg-[#FAF8F2] border border-[#ECE7D8] shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-[#172A1E] flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-[#1E5B3A]" />
                                Click to Inspect Full School ID
                              </p>
                              <p className="text-[11px] text-[#4D6354] mt-0.5">
                                Submitted {formatLastSeen(timestampToMillis(verification.submittedAt), nowMs)}
                              </p>
                            </div>
                          </button>
                        ) : (
                          <div className="p-3 rounded-xl bg-white border border-dashed border-[#D8D0BC] text-xs text-[#4D6354]">
                            No School ID card image uploaded yet (legacy account or awaiting upload).
                          </div>
                        )}

                        {status === 'rejected' && note && (
                          <p className="text-xs text-red-700 bg-white border border-red-200 rounded-xl px-3 py-2">
                            Decline note: {note}
                          </p>
                        )}

                        {isRejectingThis ? (
                          <div className="p-3 rounded-xl bg-white border border-red-200 space-y-2">
                            <input
                              type="text"
                              maxLength={140}
                              value={rejectReasonInput}
                              onChange={(e) => setRejectReasonInput(e.target.value)}
                              placeholder="Reason (e.g., ID unreadable or not an SLA student)"
                              className="w-full px-3 py-2 rounded-lg border border-[#D8D0BC] text-xs focus:outline-none focus:border-red-500"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingUid(null);
                                  setRejectReasonInput('');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-[#D8D0BC] text-xs font-semibold text-[#4D6354] cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || !onReviewStudentApproval}
                                onClick={async () => {
                                  if (!onReviewStudentApproval) return;
                                  setReviewBusyUid(student.uid);
                                  try {
                                    await onReviewStudentApproval(
                                      student.uid,
                                      'rejected',
                                      rejectReasonInput.trim() ||
                                        'School ID could not be verified as an enrolled SLA student.'
                                    );
                                    soundFx.playWrong();
                                    setRejectingUid(null);
                                    setRejectReasonInput('');
                                  } finally {
                                    setReviewBusyUid(null);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                              >
                                {isBusy ? 'Declining...' : 'Confirm Decline'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setRejectingUid(student.uid);
                                  setRejectReasonInput(note || '');
                                }}
                                className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Decline
                              </button>
                            )}
                            {status !== 'approved' && (
                              <button
                                type="button"
                                disabled={isBusy || !onReviewStudentApproval}
                                onClick={async () => {
                                  if (!onReviewStudentApproval) return;
                                  setReviewBusyUid(student.uid);
                                  try {
                                    await onReviewStudentApproval(student.uid, 'approved', '');
                                    soundFx.playCorrect();
                                  } finally {
                                    setReviewBusyUid(null);
                                  }
                                }}
                                className="px-4 py-1.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isBusy ? 'Approving...' : 'Approve Student'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin Section Spelling Correction Requests */}
          {isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-[#EA7A26] flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    Permanent Section Control
                  </p>
                  <h3 className="text-lg font-bold text-[#172A1E] mt-0.5">
                    Section Spelling Correction Requests
                  </h3>
                  <p className="text-xs text-[#4D6354]">
                    Student Grade &amp; Section is permanent after sign-in. Review and approve only genuine spelling corrections here.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9] text-xs font-semibold w-fit">
                  {[
                    { id: 'pending', label: `Pending (${pendingSectionRequestsCount})` },
                    { id: 'approved', label: `Approved (${approvedSectionRequestsCount})` },
                    { id: 'rejected', label: `Declined (${rejectedSectionRequestsCount})` },
                    { id: 'all', label: `All (${sectionChangeRequests.length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSectionReqFilter(f.id as 'pending' | 'approved' | 'rejected' | 'all')}
                      className={`px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap ${
                        sectionReqFilter === f.id
                          ? 'bg-[#1E5B3A] text-white'
                          : 'text-[#4D6354] hover:text-[#172A1E]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSectionRequests.length === 0 ? (
                <p className="text-sm text-[#4D6354] py-6 text-center bg-[#FAF8F2] rounded-2xl">
                  {sectionReqFilter === 'pending'
                    ? 'No students are requesting a section spelling correction right now.'
                    : 'No section spelling requests match this filter.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSectionRequests.map((req) => {
                    const isBusy = sectionReviewBusyUid === req.uid;
                    const draftSection =
                      sectionEdits[req.uid] !== undefined ? sectionEdits[req.uid] : req.requestedSection;
                    const draftNote =
                      sectionReviewNotes[req.uid] !== undefined ? sectionReviewNotes[req.uid] : req.reviewNote;

                    return (
                      <div
                        key={req.uid}
                        className={`p-4 rounded-2xl border space-y-3 ${
                          req.status === 'pending'
                            ? 'border-[#EA7A26]/50 bg-[#FFFDF8]'
                            : req.status === 'rejected'
                              ? 'border-red-200 bg-red-50/40'
                              : 'border-[#E5DEC9] bg-[#FAF8F2]/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-[#172A1E]">{req.studentName}</p>
                            <p className="text-xs text-[#4D6354] mt-0.5">
                              Current: <span className="line-through text-red-700">{req.currentSection}</span>{' '}
                              → Requested: <strong className="text-[#1E5B3A]">{req.requestedSection}</strong>
                            </p>
                            <p className="text-xs text-[#4D6354] mt-1">
                              Reason: <span className="text-[#172A1E]">{req.reason}</span>
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 whitespace-nowrap ${
                              req.status === 'approved'
                                ? 'bg-emerald-50 text-[#1E5B3A] border-emerald-200'
                                : req.status === 'rejected'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {req.status === 'approved'
                              ? 'Approved'
                              : req.status === 'rejected'
                                ? 'Declined'
                                : 'Pending'}
                          </span>
                        </div>

                        {req.status === 'pending' ? (
                          <div className="space-y-2 pt-1">
                            <div>
                              <label className="block text-[11px] font-semibold text-[#172A1E] mb-1">
                                Final Approved Section Spelling
                              </label>
                              <input
                                type="text"
                                maxLength={40}
                                value={draftSection}
                                onChange={(e) =>
                                  setSectionEdits((prev) => ({ ...prev, [req.uid]: e.target.value }))
                                }
                                className="w-full px-3 py-1.5 rounded-xl border border-[#D8D0BC] bg-white text-xs font-semibold text-[#172A1E]"
                              />
                            </div>
                            <input
                              type="text"
                              maxLength={140}
                              value={draftNote}
                              onChange={(e) =>
                                setSectionReviewNotes((prev) => ({ ...prev, [req.uid]: e.target.value }))
                              }
                              placeholder="Optional Admin note (required if declining)..."
                              className="w-full px-3 py-1.5 rounded-xl border border-[#D8D0BC] bg-white text-xs"
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                disabled={isBusy || !onReviewSectionChange}
                                onClick={async () => {
                                  if (!onReviewSectionChange) return;
                                  setSectionReviewBusyUid(req.uid);
                                  try {
                                    await onReviewSectionChange(
                                      req.uid,
                                      'rejected',
                                      draftSection.trim() || req.requestedSection,
                                      draftNote.trim() || 'Only spelling errors in your current section can be changed.'
                                    );
                                    soundFx.playWrong();
                                  } finally {
                                    setSectionReviewBusyUid(null);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Decline
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || !onReviewSectionChange || !draftSection.trim()}
                                onClick={async () => {
                                  if (!onReviewSectionChange) return;
                                  setSectionReviewBusyUid(req.uid);
                                  try {
                                    await onReviewSectionChange(
                                      req.uid,
                                      'approved',
                                      draftSection.trim(),
                                      draftNote.trim()
                                    );
                                    soundFx.playCorrect();
                                  } finally {
                                    setSectionReviewBusyUid(null);
                                  }
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isBusy ? 'Saving...' : 'Approve Spelling Change'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#4D6354]">
                            Reviewed by {req.reviewedBy || 'Admin'}
                            {req.reviewNote ? ` · Note: ${req.reviewNote}` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin Teachers Live Monitor */}
          {isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#172A1E] flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#1E5B3A]" />
                    Teachers Live Monitor
                  </h3>
                  <p className="text-xs text-[#4D6354]">
                    Monitor every teacher&apos;s online status, assigned classroom section, and current activity in real time.
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
                        <th className="py-3 pr-4 font-semibold">Current Activity</th>
                        <th className="py-3 font-semibold text-right">Room Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2EFE6]">
                      {visibleTeachers.map((t) => {
                        const presence = getStudentPresence(t, nowMs);
                        const activity = getActivityBadge(t, presence.isOnline, true);
                        const teacherSec = (t.section || '').trim();
                        const roomStudentCount = teacherSec
                          ? allStudents.filter((s) => (s.section || '').trim() === teacherSec).length
                          : 0;
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
                                    <div className="w-9 h-9 rounded-full bg-[#1E5B3A]/10 text-[#1E5B3A] border border-[#1E5B3A]/20 flex items-center justify-center font-bold text-xs">
                                      {getInitials(t.displayName)}
                                    </div>
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
                    ? 'All Students — Live Presence & Approval Status'
                    : `${activeRoomSection === '__UNASSIGNED__' ? 'Unassigned Students' : activeRoomSection} — Student Roster (${students.length})`}
                </h3>
                <p className="text-xs text-[#4D6354]">
                  {isAdmin
                    ? 'Monitor student online/offline presence, current classroom activity, and School ID verification status.'
                    : 'Track every student in real time: online/offline presence, what they are doing right now, pet level, quiz performance, and anti-cheat focus status.'}
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
                      <th className="py-3 pr-4 font-semibold">{isAdmin ? 'Activity' : 'What They Are Doing'}</th>
                      {!isAdmin && <th className="py-3 pr-4 font-semibold">Pet Progress</th>}
                      {!isAdmin && <th className="py-3 pr-4 font-semibold">Care Avg</th>}
                      <th className="py-3 pr-4 font-semibold">Accuracy</th>
                      <th className="py-3 pr-4 font-semibold">Score</th>
                      {!isAdmin && <th className="py-3 pr-4 font-semibold">Strikes</th>}
                      <th className="py-3 font-semibold text-right">
                        {isAdmin ? 'ID Status' : 'Focus Status'}
                      </th>
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
                      const activity = getActivityBadge(st, presence.isOnline, isAdmin);
                      const approvalState: ApprovalStatus = st.approvalStatus || 'pending';

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
                                ) : isAdmin ? (
                                  <div className="w-9 h-9 rounded-full bg-[#1E5B3A]/10 text-[#1E5B3A] border border-[#1E5B3A]/20 flex items-center justify-center font-bold text-xs">
                                    {getInitials(st.displayName)}
                                  </div>
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
                          {!isAdmin && (
                            <td className="py-3 pr-4 text-[#4D6354] capitalize">
                              {st.petName} · Lv. {st.petLevel}
                            </td>
                          )}
                          {!isAdmin && (
                            <td className="py-3 pr-4 tabular-nums text-[#4D6354]">{careAvg}%</td>
                          )}
                          <td className="py-3 pr-4 tabular-nums text-[#4D6354]">{acc}%</td>
                          <td className="py-3 pr-4 font-bold text-[#1E5B3A] tabular-nums">
                            {st.totalScore}
                          </td>
                          {!isAdmin && (
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
                          )}
                          <td className="py-3 text-right">
                            {isAdmin ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  approvalState === 'approved'
                                    ? 'bg-emerald-50 text-[#1E5B3A] border-emerald-200'
                                    : approvalState === 'rejected'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {approvalState === 'approved'
                                  ? 'Approved'
                                  : approvalState === 'rejected'
                                    ? 'Declined'
                                    : 'Pending ID'}
                              </span>
                            ) : st.lockedOut ? (
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
                          <p className="text-[11px] text-[#4D6354] truncate">
                            {isAdmin
                              ? `Status: ${st.approvalStatus || 'pending'}`
                              : `Pet: ${st.petName}`}
                          </p>
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

            {!isAdmin && roomAlerts.length > 0 && (
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
                    Latest School ID verifications, approvals, and classroom participation across San Lorenzo Academy.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#4D6354]">
                  Showing {campusActivityFeed.length} recent events
                </span>
              </div>

              {campusActivityFeed.length === 0 ? (
                <p className="text-sm text-[#4D6354] py-6 text-center bg-[#FAF8F2] rounded-2xl">
                  No student verification or classroom activity recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-[#F2EFE6]">
                  {campusActivityFeed.map((item) => (
                    <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                            item.kind === 'declined'
                              ? 'bg-red-500'
                              : item.kind === 'verification'
                                ? 'bg-[#EA7A26]'
                                : 'bg-emerald-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-[#172A1E]">
                            <span className="font-bold">{item.actorName}</span>
                            {item.section && (
                              <span className="text-[#4D6354]"> · {item.section}</span>
                            )}
                          </p>
                          <p className={item.kind === 'declined' ? 'text-red-700 font-medium mt-0.5' : 'text-[#4D6354] mt-0.5'}>
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

      {!isAdmin && tab === 'pptx' && (
        <div className="space-y-6">
          {/* AI PowerPoint (.pptx) & Quiz Generator */}
          <form
            onSubmit={(e) => void handleGenerateAiPptx(e)}
            className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#EA7A26] flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  Teacher Workload Saver
                </p>
                <h3 className="text-lg font-bold text-[#172A1E] mt-0.5 flex items-center gap-2">
                  <Presentation className="w-5 h-5 text-[#1E5B3A]" />
                  Generate PowerPoint (.pptx) &amp; Quiz Automatically
                </h3>
                <p className="text-xs text-[#4D6354] mt-1">
                  Enter your lesson topic and desired question formats. LORENZONE creates formatted lecture slides to download as a real <code>.pptx</code> file plus a ready-to-play quiz deck.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-5">
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">
                  Lesson Topic / Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g., Photosynthesis and Cellular Energy"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">Subject</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  placeholder="e.g., Science, Math, Filipino"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">Grade Level</label>
                <select
                  value={aiGradeLevel}
                  onChange={(e) => setAiGradeLevel(e.target.value)}
                  aria-label="Target grade level"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D8D0BC] bg-[#FAF8F2] text-sm font-semibold text-[#172A1E]"
                >
                  {['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">Slides</label>
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={aiSlideCount}
                  onChange={(e) => setAiSlideCount(Math.max(4, Math.min(12, Number(e.target.value) || 6)))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D8D0BC] text-sm tabular-nums"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-[#172A1E] mb-1">Quiz Qs</label>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={aiQuestionCount}
                  onChange={(e) => setAiQuestionCount(Math.max(3, Math.min(15, Number(e.target.value) || 6)))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#D8D0BC] text-sm tabular-nums"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#172A1E] mb-2">
                Question Formats to Generate
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'identification',
                    'fill_in_blank',
                    'enumeration',
                    'four_pics',
                    'multiple_choice',
                  ] as QuestionType[]
                ).map((qType) => {
                  const active = aiQuestionMix.includes(qType);
                  return (
                    <button
                      key={qType}
                      type="button"
                      onClick={() => handleToggleAiQuestionMix(qType)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#1E5B3A] border-[#1E5B3A] text-white'
                          : 'bg-[#FAF8F2] border-[#D8D0BC] text-[#4D6354] hover:border-[#1E5B3A]'
                      }`}
                    >
                      {active ? '✓ ' : ''}
                      {QUESTION_TYPE_LABELS[qType]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-1">
                Optional Teaching Objectives or Key Points to Include
              </label>
              <textarea
                rows={2}
                maxLength={1200}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.target.value)}
                placeholder="Optional: e.g., Focus on light-dependent reactions, Calvin cycle, and examples in Philippine crops."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-xs focus:outline-none focus:border-[#1E5B3A]"
              />
            </div>

            {aiError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {aiError}
              </div>
            )}

            {aiPublishMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-[#1E5B3A] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {aiPublishMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-[#4D6354]">
                Generates {aiSlideCount} lecture slides + {aiQuestionCount} ready-to-play questions.
              </span>
              <button
                type="submit"
                disabled={aiGenerating}
                className="px-5 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Slides &amp; Quiz...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate PowerPoint &amp; Quiz
                  </>
                )}
              </button>
            </div>
          </form>

          {aiGeneratedResult && (
            <div className="bg-white rounded-3xl border border-[#1E5B3A]/30 p-6 sm:p-8 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#ECE7D8] pb-4">
                <div>
                  <p className="text-xs font-bold text-[#EA7A26]">
                    Ready · {aiGeneratedResult.subject} · {aiGeneratedResult.gradeLevel}
                  </p>
                  <h4 className="text-xl font-bold text-[#172A1E]">{aiGeneratedResult.deckTitle}</h4>
                  <p className="text-xs text-[#4D6354] mt-0.5">
                    {aiGeneratedResult.slides.length} content slides + cover &amp; review slides ·{' '}
                    {aiGeneratedResult.questions.length} quiz questions
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={aiDownloadingPptx}
                    onClick={() => void handleDownloadAiPptx()}
                    className="px-4 py-2.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    {aiDownloadingPptx ? 'Building .pptx...' : 'Download .pptx'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadAiIntoBuilder}
                    className="px-4 py-2.5 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Edit in Quiz Builder
                  </button>
                  <button
                    type="button"
                    disabled={aiPublishing}
                    onClick={() => void handlePublishAiDirectly()}
                    className="px-4 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    {aiPublishing ? 'Publishing...' : 'Publish Quiz Now'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiGeneratedResult.slides.map((s) => (
                  <div
                    key={s.slideNumber}
                    className="rounded-2xl border border-[#E5DEC9] bg-[#FAF8F2] p-4 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#4D6354] tabular-nums">
                        <span>Slide {s.slideNumber}</span>
                        <span className="text-[#1E5B3A] truncate max-w-[140px]">{s.subtitle}</span>
                      </div>
                      <h5 className="text-sm font-bold text-[#172A1E] leading-snug">{s.title}</h5>
                      <ul className="space-y-1 text-xs text-[#4D6354] list-disc pl-4">
                        {s.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-2 border-t border-[#E5DEC9] text-[11px]">
                      <p className="font-bold text-[#C65B10]">{s.keyTerm}</p>
                      <p className="text-[#4D6354] mt-1 italic">Note: {s.speakerNote}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Local PPTX File Importer & Notes Converter */}
          <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-[#172A1E]">
                Upload Existing PowerPoint (.pptx) to Create Quiz Game
              </h3>
              <p className="text-xs text-[#4D6354] mt-1">
                Already have a presentation? Upload your <code>.pptx</code> file. LORENZONE reads your slide XML locally and turns slide titles, &quot;Term: Definition&quot; bullets, and &quot;Q:/A:&quot; pairs into a playable quiz deck for all 12 games.
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
        </div>
      )}

      {!isAdmin && tab === 'builder' && (
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
              {questions.map((q, idx) => {
                const qType: QuestionType = q.questionType || 'multiple_choice';
                const enumItems = q.enumerationItems && q.enumerationItems.length > 0 ? q.enumerationItems : ['', ''];
                const panelTargetCount = q.cluePanels && q.cluePanels.length >= 6 ? 6 : 4;
                const cluePanels: CluePanel[] = Array.from({ length: panelTargetCount }, (_, pIdx) => ({
                  label: q.cluePanels?.[pIdx]?.label || '',
                  emoji: q.cluePanels?.[pIdx]?.emoji || ['🔍', '💡', '📚', '🧩', '🧭', '⚡'][pIdx],
                  imageUrl: q.cluePanels?.[pIdx]?.imageUrl,
                }));

                return (
                  <div key={q.id} className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-bold text-[#1E5B3A] tabular-nums">
                          Question #{idx + 1}
                        </span>
                        <select
                          value={qType}
                          onChange={(e) => handleChangeQuestionType(idx, e.target.value as QuestionType)}
                          aria-label={`Question ${idx + 1} format`}
                          className="px-2.5 py-1 rounded-lg border border-[#D8D0BC] bg-white text-xs font-bold text-[#172A1E]"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="identification">Identification</option>
                          <option value="fill_in_blank">Fill in the Blank</option>
                          <option value="enumeration">Enumeration</option>
                          <option value="four_pics">4 Pics 1 Word</option>
                        </select>
                      </div>
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

                    {/* Prompt input + quick Insert Blank for Fill in the Blank */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder={
                          qType === 'fill_in_blank'
                            ? 'Sentence with _____ blank (e.g., Plants absorb _____ during photosynthesis.)'
                            : qType === 'enumeration'
                              ? 'Enumeration prompt (e.g., Enumerate the 3 states of matter)'
                              : qType === 'four_pics'
                                ? 'Optional clue question or category context...'
                                : qType === 'identification'
                                  ? 'Identification prompt (e.g., What organelle produces ATP energy?)'
                                  : 'Question prompt...'
                        }
                        value={q.prompt}
                        onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-sm"
                      />
                      {qType === 'fill_in_blank' && (
                        <button
                          type="button"
                          onClick={() => {
                            const base = q.prompt.trimEnd();
                            updateQuestion(idx, { prompt: base ? `${base} _____ ` : '_____ ' });
                          }}
                          className="px-3 py-2 rounded-xl border border-[#1E5B3A] bg-white text-[#1E5B3A] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                        >
                          + Insert Blank (_____)
                        </button>
                      )}
                    </div>

                    {/* Tailored inputs by Question Type */}
                    {qType === 'enumeration' ? (
                      <div className="space-y-2 p-3 rounded-xl bg-white border border-[#E5DEC9]">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[#172A1E]">
                            Enumeration Answers ({enumItems.length} items — any order accepted)
                          </p>
                          {enumItems.length < 8 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateQuestion(idx, {
                                  enumerationItems: [...enumItems, ''],
                                })
                              }
                              className="text-xs font-bold text-[#1E5B3A] hover:underline cursor-pointer"
                            >
                              + Add Item
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {enumItems.map((itemVal, itemIdx) => (
                            <div key={itemIdx} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder={`Item #${itemIdx + 1}`}
                                value={itemVal}
                                onChange={(e) => {
                                  const nextItems = [...enumItems];
                                  nextItems[itemIdx] = e.target.value;
                                  updateQuestion(idx, {
                                    enumerationItems: nextItems,
                                    answer: nextItems.map((s) => s.trim()).filter(Boolean).join(', '),
                                  });
                                }}
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#D8D0BC] text-xs font-semibold"
                              />
                              {enumItems.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextItems = enumItems.filter((_, k) => k !== itemIdx);
                                    updateQuestion(idx, {
                                      enumerationItems: nextItems,
                                      answer: nextItems.map((s) => s.trim()).filter(Boolean).join(', '),
                                    });
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                  aria-label={`Remove item ${itemIdx + 1}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          placeholder={
                            qType === 'four_pics'
                              ? 'Hidden 1-Word Answer (e.g., GRAVITY)'
                              : qType === 'fill_in_blank'
                                ? 'Missing Word/Phrase'
                                : 'Exact Answer (e.g., PHOTOSYNTHESIS)'
                          }
                          value={q.answer}
                          onChange={(e) => updateQuestion(idx, { answer: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-sm font-semibold"
                        />
                        <input
                          type="text"
                          placeholder="Hint (for Lorenscape / 4 Pics)"
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
                    )}

                    {qType === 'enumeration' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          placeholder="Hint (e.g., Think about ice, water, and steam)"
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
                    )}

                    {/* 4/6 Pics 1 Word Visual Clue Editor */}
                    {qType === 'four_pics' && (
                      <div className="p-3 rounded-xl bg-white border border-[#E5DEC9] space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#EA7A26]">
                            {cluePanels.length} Picture Clue Panels (Upload photos or pick visual icons + short captions)
                          </p>
                          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#FAF8F2] border border-[#E5DEC9]">
                            {([4, 6] as const).map((cnt) => (
                              <button
                                key={cnt}
                                type="button"
                                onClick={() => {
                                  const resized: CluePanel[] = Array.from({ length: cnt }, (_, pIdx) => ({
                                    label: cluePanels[pIdx]?.label || '',
                                    emoji: cluePanels[pIdx]?.emoji || ['🔍', '💡', '📚', '🧩', '🧭', '⚡'][pIdx],
                                    imageUrl: cluePanels[pIdx]?.imageUrl,
                                  }));
                                  updateQuestion(idx, { cluePanels: resized });
                                }}
                                className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                                  cluePanels.length === cnt
                                    ? 'bg-[#EA7A26] text-white'
                                    : 'text-[#4D6354] hover:text-[#172A1E]'
                                }`}
                              >
                                {cnt} Pics {cnt === 6 ? '(Hard)' : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {cluePanels.map((panel, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-2.5 rounded-xl bg-[#FAF8F2] border border-[#E5DEC9] flex items-center gap-2.5"
                            >
                              {panel.imageUrl ? (
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[#D8D0BC] shrink-0">
                                  <img
                                    src={panel.imageUrl}
                                    alt={panel.label || `Clue ${pIdx + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextPanels = [...cluePanels];
                                      nextPanels[pIdx] = { label: panel.label, emoji: panel.emoji || '🔍' };
                                      updateQuestion(idx, { cluePanels: nextPanels });
                                    }}
                                    className="absolute top-0 right-0 bg-red-600 text-white p-0.5 cursor-pointer"
                                    aria-label={`Remove photo ${pIdx + 1}`}
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  maxLength={4}
                                  value={panel.emoji || '🔍'}
                                  onChange={(e) => {
                                    const nextPanels = [...cluePanels];
                                    nextPanels[pIdx] = { ...panel, emoji: e.target.value };
                                    updateQuestion(idx, { cluePanels: nextPanels });
                                  }}
                                  aria-label={`Clue ${pIdx + 1} emoji`}
                                  className="w-11 h-11 rounded-lg border border-[#D8D0BC] bg-white text-center text-xl shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <input
                                  type="text"
                                  maxLength={40}
                                  placeholder={`Pic #${pIdx + 1} clue label`}
                                  value={panel.label}
                                  onChange={(e) => {
                                    const nextPanels = [...cluePanels];
                                    nextPanels[pIdx] = { ...panel, label: e.target.value };
                                    updateQuestion(idx, { cluePanels: nextPanels });
                                  }}
                                  className="w-full px-2 py-1 rounded-lg border border-[#D8D0BC] bg-white text-xs"
                                />
                                <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E5B3A] hover:underline cursor-pointer">
                                  <ImagePlus className="w-3 h-3" />
                                  {panel.imageUrl ? 'Replace Photo' : 'Upload Photo'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.currentTarget.files?.[0];
                                      e.currentTarget.value = '';
                                      void handleUploadClueImage(idx, pIdx, file);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Multiple-Choice Distractors (always shown for MC; optional fallback note otherwise) */}
                    <div>
                      <p className="text-[11px] text-[#4D6354] mb-1.5">
                        {qType === 'multiple_choice'
                          ? 'Answer Choices (include the Exact Answer + 3 distractors):'
                          : 'Optional Multiple-Choice Distractors (auto-filled if blank so all 12 games work):'}
                      </p>
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
                  </div>
                );
              })}
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={questions.length >= 50}
                  onClick={() => addBlankQuestion('identification')}
                  className="px-3 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Identification
                </button>
                <button
                  type="button"
                  disabled={questions.length >= 50}
                  onClick={() => addBlankQuestion('fill_in_blank')}
                  className="px-3 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Fill Blank
                </button>
                <button
                  type="button"
                  disabled={questions.length >= 50}
                  onClick={() => addBlankQuestion('enumeration')}
                  className="px-3 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Enumeration
                </button>
                <button
                  type="button"
                  disabled={questions.length >= 50}
                  onClick={() => addBlankQuestion('four_pics')}
                  className="px-3 py-2 rounded-xl border border-[#EA7A26] text-[#C65B10] text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  4 Pics 1 Word
                </button>
                <span className="text-[11px] font-semibold text-[#4D6354] tabular-nums">
                  ({questions.length}/50)
                </span>
              </div>
              <button
                type="submit"
                disabled={savingDeck}
                className="px-6 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
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
                        {userProf.section || 'Unassigned'}
                        {userProf.role === 'student'
                          ? ` · ID Status: ${userProf.approvalStatus || 'pending'}`
                          : ''}
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
                        Clears all leaderboard scores and integrity strikes, and resets every user&apos;s coins ({STARTING_COINS}), starter snack, XP, and level back to Level 1 while keeping their login &amp; section.
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

      {/* Admin Full-Size School ID Card Inspector Modal */}
      {isAdmin && inspectedApprovalItem && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E5DEC9] max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#ECE7D8]">
              <div>
                <p className="text-xs font-bold text-[#EA7A26]">School ID Card Verification</p>
                <h3 className="text-lg font-extrabold text-[#172A1E]">
                  {inspectedApprovalItem.student.displayName}
                </h3>
                <p className="text-xs text-[#4D6354]">
                  {inspectedApprovalItem.student.section || 'No section'} · ID #:{' '}
                  <strong className="font-mono text-[#1E5B3A]">
                    {inspectedApprovalItem.verification?.schoolIdNumber || 'N/A'}
                  </strong>
                  {inspectedApprovalItem.verification?.email
                    ? ` · ${inspectedApprovalItem.verification.email}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingUid(null)}
                className="p-1.5 rounded-xl hover:bg-[#FAF8F2] text-[#4D6354] cursor-pointer"
                aria-label="Close School ID inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectedApprovalItem.verification?.idPhotoUrl ? (
              <div className="rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] p-4 flex justify-center">
                <img
                  src={inspectedApprovalItem.verification.idPhotoUrl}
                  alt={`${inspectedApprovalItem.student.displayName} School ID`}
                  className="max-h-80 w-auto object-contain rounded-xl"
                />
              </div>
            ) : (
              <p className="text-xs text-[#4D6354] py-8 text-center bg-[#FAF8F2] rounded-2xl">
                No School ID photo attached.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {inspectedApprovalItem.status !== 'rejected' && (
                <button
                  type="button"
                  disabled={reviewBusyUid === inspectedApprovalItem.student.uid}
                  onClick={() => {
                    setRejectingUid(inspectedApprovalItem.student.uid);
                    setRejectReasonInput(inspectedApprovalItem.note || '');
                    setInspectingUid(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Decline / Not in School
                </button>
              )}
              {inspectedApprovalItem.status !== 'approved' && (
                <button
                  type="button"
                  disabled={reviewBusyUid === inspectedApprovalItem.student.uid || !onReviewStudentApproval}
                  onClick={async () => {
                    if (!onReviewStudentApproval) return;
                    const targetUid = inspectedApprovalItem.student.uid;
                    setReviewBusyUid(targetUid);
                    try {
                      await onReviewStudentApproval(targetUid, 'approved', '');
                      soundFx.playCorrect();
                      setInspectingUid(null);
                    } finally {
                      setReviewBusyUid(null);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  Approve Student
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
