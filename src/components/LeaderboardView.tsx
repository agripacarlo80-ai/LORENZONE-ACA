import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Trophy,
  Medal,
  Eye,
  X,
  ShieldCheck,
  AlertOctagon,
  Coins,
  BookOpen,
  Search,
  Sparkles,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AntiCheatAlert,
  PublicProfile,
  ScoreRecord,
  UserPrivateInfo,
  UserRole,
} from '../types';
import { downloadLeaderboardCsv } from '../lib/pptxParser';
import { getStudentPresence } from '../lib/presence';
import { PetAvatar } from './PetAvatar';
import { soundFx } from '../lib/sound';

interface LeaderboardViewProps {
  profiles: PublicProfile[];
  records: ScoreRecord[];
  alerts: AntiCheatAlert[];
  currentUid: string;
  currentRole: UserRole;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  profiles,
  records,
  alerts,
  currentUid,
  currentRole,
}) => {
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [gameFilter, setGameFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<PublicProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [loadingPrivateInfo, setLoadingPrivateInfo] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isFaculty = currentRole === 'teacher' || currentRole === 'admin';

  useEffect(() => {
    if (!isFaculty) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [isFaculty]);

  useEffect(() => {
    if (!selectedStudent || !isFaculty) {
      setPrivateInfo(null);
      return;
    }

    let cancelled = false;
    setLoadingPrivateInfo(true);
    const loadPrivateInfo = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', selectedStudent.uid, 'private', 'info'));
        if (!cancelled) {
          setPrivateInfo(snap.exists() ? (snap.data() as UserPrivateInfo) : null);
        }
      } catch (err) {
        if (!cancelled) {
          handleFirestoreError(err, OperationType.GET, `users/${selectedStudent.uid}/private/info`);
        }
      } finally {
        if (!cancelled) {
          setLoadingPrivateInfo(false);
        }
      }
    };

    void loadPrivateInfo();
    return () => {
      cancelled = true;
    };
  }, [selectedStudent, isFaculty]);

  const subjects = useMemo(() => {
    const set = new Set<string>(['All']);
    records.forEach((r) => set.add(r.subject));
    return Array.from(set);
  }, [records]);

  const games = useMemo(() => {
    const set = new Set<string>(['All']);
    records.forEach((r) => set.add(r.gameTitle));
    return Array.from(set);
  }, [records]);

  const rankedStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const students = profiles.filter((p) => {
      if (p.role !== 'student') return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.petName.toLowerCase().includes(q) ||
        p.petSpecies.toLowerCase().includes(q)
      );
    });

    if (subjectFilter === 'All' && gameFilter === 'All') {
      return [...students].sort((a, b) => b.totalScore - a.totalScore);
    }

    // Aggregate filtered scoreRecords per student
    const scoreByStudent = new Map<string, number>();
    records.forEach((r) => {
      if (subjectFilter !== 'All' && r.subject !== subjectFilter) return;
      if (gameFilter !== 'All' && r.gameTitle !== gameFilter) return;
      scoreByStudent.set(r.studentId, (scoreByStudent.get(r.studentId) || 0) + r.score);
    });

    return [...students]
      .map((s) => ({
        ...s,
        filteredScore: scoreByStudent.get(s.uid) || 0,
      }))
      .sort((a, b) => b.filteredScore - a.filteredScore);
  }, [profiles, records, subjectFilter, gameFilter, searchQuery]);

  const topThree = rankedStudents.slice(0, 3);

  const selectedStudentRecords = useMemo(() => {
    if (!selectedStudent) return [];
    return records.filter((r) => r.studentId === selectedStudent.uid).slice(0, 12);
  }, [records, selectedStudent]);

  const selectedStudentAlerts = useMemo(() => {
    if (!selectedStudent) return [];
    return alerts.filter((a) => a.studentId === selectedStudent.uid);
  }, [alerts, selectedStudent]);

  const openStudentProfile = (student: PublicProfile) => {
    if (!isFaculty) return;
    soundFx.playClick();
    setSelectedStudent(student);
  };

  return (
    <div className="space-y-6">
      {/* Header & Download CTA */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#EA7A26]">San Lorenzo Academy Rankings</p>
          <h2 className="text-2xl font-bold text-[#172A1E] flex items-center gap-2 mt-0.5">
            <Trophy className="w-6 h-6 text-[#EA7A26]" />
            Automatic Quiz Leaderboard
          </h2>
          <p className="text-xs text-[#4D6354] mt-1">
            {isFaculty
              ? 'Click any student on the leaderboard to inspect their full pet care progress, section, and quiz history.'
              : 'Scores are recorded automatically from all 11 mini-games. Student emails remain private.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#4D6354] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or pet..."
              aria-label="Search student or pet"
              className="pl-8 pr-3 py-2 rounded-xl border border-[#D8D0BC] text-xs bg-white focus:outline-none focus:border-[#1E5B3A] w-44"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter by subject"
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-medium bg-white"
          >
            {subjects.map((subj) => (
              <option key={subj} value={subj}>
                Subject: {subj}
              </option>
            ))}
          </select>

          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            aria-label="Filter by game"
            className="px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-xs font-medium bg-white"
          >
            {games.map((g) => (
              <option key={g} value={g}>
                Game: {g}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              downloadLeaderboardCsv(profiles, records);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Top 3 Podium */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topThree.map((student, idx) => {
            const scoreVal =
              'filteredScore' in student
                ? (student as PublicProfile & { filteredScore: number }).filteredScore
                : student.totalScore;
            return (
              <div
                key={student.uid}
                onClick={isFaculty ? () => openStudentProfile(student) : undefined}
                role={isFaculty ? 'button' : undefined}
                tabIndex={isFaculty ? 0 : undefined}
                onKeyDown={
                  isFaculty
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openStudentProfile(student);
                        }
                      }
                    : undefined
                }
                className={`rounded-3xl border p-5 flex items-center gap-4 bg-white transition-colors ${
                  idx === 0 ? 'border-[#EA7A26]' : 'border-[#E5DEC9]'
                } ${isFaculty ? 'cursor-pointer hover:bg-[#FAF8F2]' : ''}`}
              >
                <div className="relative shrink-0 flex items-center gap-2">
                  {isFaculty && student.photoUrl && (
                    <img
                      src={student.photoUrl}
                      alt={student.displayName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#1E5B3A] shrink-0"
                    />
                  )}
                  <PetAvatar
                    species={student.petSpecies}
                    color={student.petColor}
                    outfit={student.outfit}
                    accessory={student.accessory}
                    role={student.role}
                    size={isFaculty && student.photoUrl ? 62 : 76}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#EA7A26]">
                      <Medal className="w-4 h-4" />
                      <span>Rank #{idx + 1}</span>
                    </div>
                    {isFaculty && (
                      <span
                        className={`text-[11px] font-bold inline-flex items-center gap-1 ${
                          getStudentPresence(student, nowMs).isOnline
                            ? 'text-emerald-700'
                            : 'text-[#4D6354]'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            getStudentPresence(student, nowMs).isOnline
                              ? 'bg-emerald-500'
                              : 'bg-stone-400'
                          }`}
                        />
                        {getStudentPresence(student, nowMs).label}
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-base text-[#172A1E] truncate">
                    {student.displayName}
                  </p>
                  <p className="text-xs text-[#4D6354] truncate">
                    {student.petName} · Lv. {student.petLevel}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-lg font-extrabold text-[#1E5B3A] tabular-nums">
                      {scoreVal.toLocaleString()} pts
                    </p>
                    {isFaculty && (
                      <span className="text-[11px] font-semibold text-[#1E5B3A] flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Profile
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 overflow-x-auto">
        {rankedStudents.length === 0 ? (
          <p className="text-sm text-[#4D6354] py-8 text-center">
            No matching student scores recorded yet. Complete a mini-game to appear on the leaderboard!
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#ECE7D8] text-xs text-[#4D6354]">
                <th className="py-3 pr-4 font-semibold">Rank</th>
                <th className="py-3 pr-4 font-semibold">Student</th>
                <th className="py-3 pr-4 font-semibold">Pet Companion</th>
                <th className="py-3 pr-4 font-semibold">Pet Level</th>
                <th className="py-3 pr-4 font-semibold">Accuracy</th>
                <th className="py-3 pr-4 font-semibold text-right">Score</th>
                {isFaculty && <th className="py-3 pr-4 font-semibold">Status</th>}
                {isFaculty && <th className="py-3 font-semibold text-right">Profile</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EFE6]">
              {rankedStudents.map((student, idx) => {
                const acc =
                  student.totalAnswers > 0
                    ? Math.round((student.correctAnswers / student.totalAnswers) * 100)
                    : 0;
                const scoreVal =
                  'filteredScore' in student
                    ? (student as PublicProfile & { filteredScore: number }).filteredScore
                    : student.totalScore;
                const isMe = student.uid === currentUid;
                const presence = getStudentPresence(student, nowMs);

                return (
                  <tr
                    key={student.uid}
                    className={`${isMe ? 'bg-[#1E5B3A]/5' : ''} ${
                      isFaculty ? 'hover:bg-[#FAF8F2] transition-colors' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 font-bold tabular-nums text-[#172A1E]">#{idx + 1}</td>
                    <td className="py-3 pr-4 font-semibold text-[#172A1E]">
                      <div className="flex items-center gap-2.5">
                        {isFaculty && student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.displayName}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border border-[#1E5B3A] shrink-0"
                          />
                        ) : (
                          <PetAvatar
                            species={student.petSpecies}
                            color={student.petColor}
                            outfit={student.outfit}
                            accessory={student.accessory}
                            role={student.role}
                            size={34}
                          />
                        )}
                        <span>
                          {student.displayName}{' '}
                          {isMe && <span className="text-xs text-[#EA7A26]">(You)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[#4D6354] capitalize">
                      {student.petName} · {student.petSpecies}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-[#4D6354]">Lv. {student.petLevel}</td>
                    <td className="py-3 pr-4 tabular-nums text-[#4D6354]">{acc}%</td>
                    <td className="py-3 pr-4 font-bold text-[#1E5B3A] text-right tabular-nums">
                      {scoreVal.toLocaleString()}
                    </td>
                    {isFaculty && (
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-bold ${
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
                      </td>
                    )}
                    {isFaculty && (
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openStudentProfile(student)}
                          className="px-3 py-1.5 rounded-xl border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A] hover:text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Profile
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Teacher & Admin Student Profile Modal */}
      {isFaculty && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E5DEC9] max-w-2xl w-full p-6 sm:p-7 shadow-xl max-h-[88vh] overflow-y-auto space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#ECE7D8]">
              <div className="flex items-center gap-4">
                {selectedStudent.photoUrl && (
                  <img
                    src={selectedStudent.photoUrl}
                    alt={selectedStudent.displayName}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#1E5B3A] shrink-0 shadow-sm"
                  />
                )}
                <div className="p-2 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
                  <PetAvatar
                    species={selectedStudent.petSpecies}
                    color={selectedStudent.petColor}
                    outfit={selectedStudent.outfit}
                    accessory={selectedStudent.accessory}
                    role={selectedStudent.role}
                    size={76}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#EA7A26]">
                    Faculty Student Profile Inspector
                  </p>
                  <h3 className="text-xl font-extrabold text-[#172A1E]">
                    {selectedStudent.displayName}
                  </h3>
                  <p className="text-xs text-[#4D6354] mt-0.5 capitalize">
                    Pet: <strong>{selectedStudent.petName}</strong> ({selectedStudent.petSpecies}) ·
                    Lv. {selectedStudent.petLevel}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-[#4D6354] mt-0.5">
                      {loadingPrivateInfo
                        ? 'Loading section & account details...'
                        : privateInfo
                          ? `${privateInfo.section || 'SLA General'} · ${privateInfo.email}`
                          : 'Section details unavailable'}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        getStudentPresence(selectedStudent, nowMs).isOnline
                          ? 'text-emerald-700'
                          : 'text-[#4D6354]'
                      }`}
                    >
                      ·
                      <span
                        className={`w-2 h-2 rounded-full ${
                          getStudentPresence(selectedStudent, nowMs).isOnline
                            ? 'bg-emerald-500'
                            : 'bg-stone-400'
                        }`}
                      />
                      {getStudentPresence(selectedStudent, nowMs).label} (
                      {getStudentPresence(selectedStudent, nowMs).lastSeenText})
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl hover:bg-[#FAF8F2] text-[#4D6354] cursor-pointer"
                aria-label="Close student profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
              <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
                <p className="text-[11px] font-semibold text-[#4D6354]">Total Score</p>
                <p className="text-lg font-extrabold text-[#1E5B3A] mt-0.5">
                  {selectedStudent.totalScore.toLocaleString()}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
                <p className="text-[11px] font-semibold text-[#4D6354]">Quiz Accuracy</p>
                <p className="text-lg font-extrabold text-[#172A1E] mt-0.5">
                  {selectedStudent.totalAnswers > 0
                    ? `${Math.round(
                        (selectedStudent.correctAnswers / selectedStudent.totalAnswers) * 100
                      )}%`
                    : '0%'}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
                <p className="text-[11px] font-semibold text-[#4D6354]">Games Played</p>
                <p className="text-lg font-extrabold text-[#172A1E] mt-0.5">
                  {selectedStudent.gamesPlayed}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
                <p className="text-[11px] font-semibold text-[#4D6354]">LorenCoins</p>
                <p className="text-lg font-extrabold text-[#EA7A26] mt-0.5 flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                  {selectedStudent.coins}
                </p>
              </div>
            </div>

            {/* Pet Care Progress (Teacher Progress Basis) */}
            <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#172A1E] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#EA7A26]" />
                  Pet Care Progress
                </h4>
                <span className="text-xs font-semibold text-[#1E5B3A] tabular-nums">
                  {selectedStudent.petXp} / {selectedStudent.petLevel * 100} XP
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'Hunger', val: selectedStudent.hunger },
                  { label: 'Happiness', val: selectedStudent.happiness },
                  { label: 'Energy', val: selectedStudent.energy },
                  { label: 'Cleanliness', val: selectedStudent.cleanliness },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl p-2.5 border border-[#ECE7D8]">
                    <div className="flex items-center justify-between font-semibold text-[#172A1E] mb-1">
                      <span>{stat.label}</span>
                      <span className="tabular-nums">{stat.val}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E9E4D4] overflow-hidden">
                      <div
                        className="h-full bg-[#1E5B3A] rounded-full"
                        style={{ width: `${stat.val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Integrity & Focus Status */}
            <div className="p-4 rounded-2xl border border-[#E5DEC9] space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#172A1E] flex items-center gap-1.5">
                  {selectedStudent.lockedOut ? (
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-[#1E5B3A]" />
                  )}
                  Integrity &amp; Focus Status
                </h4>
                <span
                  className={`text-xs font-bold ${
                    selectedStudent.lockedOut
                      ? 'text-red-600'
                      : selectedStudentAlerts.length > 0
                        ? 'text-[#EA7A26]'
                        : 'text-[#1E5B3A]'
                  }`}
                >
                  {selectedStudent.lockedOut
                    ? `Locked (${selectedStudentAlerts.length} Strikes)`
                    : `${selectedStudentAlerts.length} Past Strike${
                        selectedStudentAlerts.length === 1 ? '' : 's'
                      } · ${selectedStudent.activeGame || 'Lobby'}`}
                </span>
              </div>
              {selectedStudentAlerts.length > 0 && (
                <div className="text-xs text-[#4D6354] space-y-1 pt-1">
                  {selectedStudentAlerts.slice(0, 3).map((al) => (
                    <p key={al.id} className="text-red-700">
                      • {al.gameTitle}: {al.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Quiz Records */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-[#172A1E] flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#1E5B3A]" />
                Recent Mini-Game Scores ({selectedStudentRecords.length})
              </h4>
              {selectedStudentRecords.length === 0 ? (
                <p className="text-xs text-[#4D6354] py-4 text-center bg-[#FAF8F2] rounded-2xl">
                  No completed mini-game records yet.
                </p>
              ) : (
                <div className="divide-y divide-[#F2EFE6] border border-[#E5DEC9] rounded-2xl px-4">
                  {selectedStudentRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-[#172A1E]">{rec.gameTitle}</p>
                        <p className="text-[#4D6354]">
                          {rec.subject} · {rec.correctCount}/{rec.totalCount} correct ·{' '}
                          {rec.durationSeconds}s
                        </p>
                      </div>
                      <span className="font-extrabold text-[#1E5B3A] tabular-nums">
                        +{rec.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

