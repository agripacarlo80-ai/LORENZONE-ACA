import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileUp,
  Plus,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserPlus,
  Volume2,
  Play,
  KeyRound,
  Copy,
} from 'lucide-react';
import {
  AntiCheatAlert,
  AuthorizedFaculty,
  GameId,
  PublicProfile,
  QuizDeck,
  QuizQuestion,
  ScoreRecord,
  UserRole,
} from '../types';
import { downloadLeaderboardCsv, parsePlainTextSlides, parsePptxFile } from '../lib/pptxParser';
import { getStudentPresence } from '../lib/presence';
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
  onAddAuthorizedFaculty: (email: string, fullName: string, role: 'teacher' | 'admin') => Promise<void>;
  onRemoveAuthorizedFaculty: (email: string) => Promise<void>;
  onUpdateUserRole: (uid: string, nextRole: UserRole) => Promise<void>;
  accessCodes: { teacherCode: string; adminCode: string };
  onUpdateAccessCodes: (teacherCode: string, adminCode: string) => Promise<void>;
}

type MonitorTab = 'live' | 'builder' | 'pptx' | 'admin';

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
  accessCodes,
  onUpdateAccessCodes,
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

  // Admin Faculty Access state
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [facultyRole, setFacultyRole] = useState<'teacher' | 'admin'>('teacher');
  const [facultyFeedback, setFacultyFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [savingFaculty, setSavingFaculty] = useState(false);

  // Admin Secret Access Codes state
  const [teacherCodeInput, setTeacherCodeInput] = useState(accessCodes.teacherCode);
  const [adminCodeInput, setAdminCodeInput] = useState(accessCodes.adminCode);
  const [savingCodes, setSavingCodes] = useState(false);
  const [codesFeedback, setCodesFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTeacherCodeInput(accessCodes.teacherCode);
    setAdminCodeInput(accessCodes.adminCode);
  }, [accessCodes.teacherCode, accessCodes.adminCode]);

  const isAdmin = teacherProfile.role === 'admin';
  const lockedAlerts = alerts.filter((a) => a.status === 'locked');
  const students = allProfiles.filter((p) => p.role === 'student');
  const onlineCount = students.filter((st) => getStudentPresence(st, nowMs).isOnline).length;
  const offlineCount = students.length - onlineCount;
  const filteredStudents = students.filter((st) => {
    if (presenceFilter === 'all') return true;
    const { isOnline } = getStudentPresence(st, nowMs);
    return presenceFilter === 'online' ? isOnline : !isOnline;
  });

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
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#EA7A26]">San Lorenzo Academy Faculty Console</p>
          <h2 className="text-2xl font-bold text-[#172A1E]">Teacher Monitor &amp; Quiz Studio</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9]">
            {[
              { id: 'live', label: 'Class Monitor' },
              { id: 'pptx', label: 'Import PPTX' },
              { id: 'builder', label: 'Quiz Builder' },
              ...(isAdmin ? [{ id: 'admin', label: 'Admin Access' }] : []),
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setTab(t.id as MonitorTab);
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

      {tab === 'live' && (
        <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#172A1E]">
                Student Pet Progress &amp; Integrity Status
              </h3>
              <p className="text-xs text-[#4D6354]">
                Track every student&apos;s live online/offline presence, pet companion level, quiz performance, and focus status.
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
                  downloadLeaderboardCsv(allProfiles, records);
                }}
                className="px-4 py-2 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Export Class CSV
              </button>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="text-sm text-[#4D6354] py-8 text-center bg-[#FAF8F2] rounded-2xl">
              {students.length === 0
                ? 'No student accounts enrolled yet. Students who sign in with Google will appear here automatically.'
                : `No ${presenceFilter} students right now.`}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#ECE7D8] text-xs text-[#4D6354]">
                    <th className="py-3 pr-4 font-semibold">Student</th>
                    <th className="py-3 pr-4 font-semibold">Presence</th>
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
                    const strikeCount = alerts.filter((a) => a.studentId === st.uid).length;
                    const presence = getStudentPresence(st, nowMs);

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
                            <span>{st.displayName}</span>
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
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E5B3A]">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {presence.isOnline ? `Active (${st.activeGame || 'Lobby'})` : 'Signed Out'}
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

          {alerts.length > 0 && (
            <div className="pt-5 border-t border-[#ECE7D8] space-y-3">
              <div>
                <h4 className="text-sm font-bold text-[#172A1E]">
                  Integrity Violation History ({alerts.length})
                </h4>
                <p className="text-xs text-[#4D6354]">
                  Permanent log of every tab switch, split-screen, fullscreen exit, or copy/paste attempt — even after a student is allowed back.
                </p>
              </div>
              <div className="divide-y divide-[#F2EFE6] max-h-64 overflow-y-auto">
                {alerts.slice(0, 25).map((al) => (
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
                  Multi-User Teacher &amp; Admin Secret Codes
                </h3>
                <p className="text-xs text-[#4D6354] mt-1">
                  Share the Teacher Secret Code with SLA teachers and the Admin Secret Code with co-admins so they can sign in from any Gmail account. Students without a code stay locked in Student mode.
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
                  Tip: Rotate these codes each term for stronger classroom security.
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
            {/* Authorize Faculty Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanEmail = facultyEmail.trim().toLowerCase();
                if (!cleanEmail || !facultyName.trim()) {
                  setFacultyFeedback({
                    type: 'err',
                    text: 'Please provide both Faculty Full Name and Gmail Address.',
                  });
                  return;
                }
                setSavingFaculty(true);
                setFacultyFeedback(null);
                try {
                  await onAddAuthorizedFaculty(cleanEmail, facultyName.trim(), facultyRole);
                  soundFx.playLevelUp();
                  setFacultyFeedback({
                    type: 'ok',
                    text: `Authorized ${cleanEmail} as ${facultyRole}.`,
                  });
                  setFacultyEmail('');
                  setFacultyName('');
                } catch (err) {
                  soundFx.playWrong();
                  setFacultyFeedback({
                    type: 'err',
                    text: err instanceof Error ? err.message : 'Unable to authorize faculty email.',
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
                Authorize Teacher or Admin
              </h3>
              <p className="text-xs text-[#4D6354] mt-1">
                Only Gmail accounts listed here can register or sign in as a Teacher or Admin. All other Gmail logins are locked to Student mode.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-1">Faculty Full Name</label>
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

            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-1">Authorized Role</label>
              <select
                value={facultyRole}
                onChange={(e) => setFacultyRole(e.target.value as 'teacher' | 'admin')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm bg-white"
              >
                <option value="teacher">Teacher (Monitor, Quizzes &amp; Duck Recitation)</option>
                <option value="admin">Admin (Full Faculty Access &amp; Role Management)</option>
              </select>
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
              {savingFaculty ? 'Saving Authorization...' : 'Grant Faculty Access'}
            </button>
          </form>

          {/* Authorized Faculty List & Enrolled User Role Control */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 space-y-4">
              <h4 className="text-sm font-bold text-[#172A1E]">Authorized Faculty Allowlist</h4>
              {authorizedFaculty.length === 0 ? (
                <p className="text-xs text-[#4D6354]">
                  No additional teachers added yet. Your Admin email (maxsison2@gmail.com) is always authorized.
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
              <h4 className="text-sm font-bold text-[#172A1E]">Manage Enrolled Account Roles</h4>
              <div className="divide-y divide-[#F2EFE6]">
                {allProfiles.map((userProf) => (
                  <div key={userProf.uid} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#172A1E]">{userProf.displayName}</p>
                      <p className="text-xs text-[#4D6354] capitalize">
                        Current role: <strong className="text-[#1E5B3A]">{userProf.role}</strong> · Pet: {userProf.petName}
                      </p>
                    </div>
                    {userProf.uid !== teacherProfile.uid && (
                      <div className="flex items-center gap-1.5">
                        {(['student', 'teacher', 'admin'] as UserRole[]).map((r) => (
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
        </div>
      )}
    </div>
  );
};
