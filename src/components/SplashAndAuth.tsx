import React, { useEffect, useState } from 'react';
import { ShieldCheck, ArrowRight, GraduationCap, Users, Check, KeyRound, ShieldAlert, Camera, Trash2 } from 'lucide-react';
import { PET_COLORS, PET_SPECIES_INFO, SLA_SECTIONS } from '../data/defaultDecks';
import { PetSpecies, UserRole } from '../types';
import { PetAvatar } from './PetAvatar';
import { soundFx } from '../lib/sound';
import { compressProfilePhoto } from '../lib/imageUpload';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onFinish, 220);
          return 100;
        }
        return Math.min(100, prev + 22);
      });
    }, 240);
    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-[#1E5B3A]">
      <img
        src="/src/assets/images/lorenzone_hero_campus_1795116396268.jpg"
        alt="San Lorenzo Academy Campus"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover opacity-30"
      />
      <div className="relative z-10 max-w-md w-full bg-[#FAF8F2] rounded-3xl border-2 border-[#E5DEC9] p-8 shadow-xl text-center">
        <p className="text-xs font-semibold tracking-wider text-[#1E5B3A] mb-3">
          SAN LORENZO ACADEMY, INC.
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#1E5B3A] mb-1">
          LOREN<span className="text-[#EA7A26]">ZONE</span>
        </h1>
        <p className="text-sm font-medium text-[#4D6354] mb-6">Play · Learn · Grow</p>

        <div className="w-44 h-44 mx-auto rounded-2xl overflow-hidden border border-[#E5DEC9] bg-white mb-6 shadow-sm">
          <img
            src="/src/assets/images/lorenzone_mascot_emblem_1795116396577.jpg"
            alt="Lorenzone Pet Companions"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="w-full h-3 bg-[#E9E4D4] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-[#EA7A26] rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[#4D6354] tabular-nums">
          <span>Loading Academy Arena</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
};

interface AuthScreenProps {
  portalMode: 'student' | 'faculty';
  onChangePortalMode: (mode: 'student' | 'faculty') => void;
  onGoogleLogin: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  portalMode,
  onChangePortalMode,
  onGoogleLogin,
  loading,
  error,
}) => {
  return (
    <div className="min-h-screen bg-[#FAF8F2] flex items-center justify-center p-6">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl border border-[#E5DEC9] overflow-hidden shadow-sm items-stretch">
        <div className="relative min-h-[300px] bg-[#1E5B3A] p-8 flex flex-col justify-between text-white">
          <img
            src="/src/assets/images/lorenzone_hero_campus_1795116396268.jpg"
            alt="San Lorenzo Academy Campus"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
          <div className="relative z-10">
            <span className="text-xs font-semibold tracking-wide text-amber-200">
              San Lorenzo Academy, Inc.
            </span>
            <h1 className="text-4xl font-extrabold mt-2 tracking-tight text-balance">
              LORENZONE
            </h1>
            <p className="text-sm text-emerald-50 mt-2 max-w-sm leading-relaxed">
              Care for your SLA pet companion, compete across 11 customizable quiz games, and track classroom mastery in real time.
            </p>
          </div>
          <div className="relative z-10 mt-8 bg-white/95 text-[#172A1E] rounded-2xl p-4 flex items-center gap-4">
            <img
              src="/src/assets/images/lorenzone_mascot_emblem_1795116396577.jpg"
              alt="SLA Mascots"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover shrink-0"
            />
            <div className="text-xs leading-relaxed">
              <p className="font-bold text-[#1E5B3A]">11 Interactive Quiz Games</p>
              <p className="text-[#4D6354]">
                Lorenscape, On the Run, Brainzone, Grab It, Catch the Duck, and more.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9] mb-6">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onChangePortalMode('student');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                portalMode === 'student'
                  ? 'bg-[#1E5B3A] text-white'
                  : 'text-[#4D6354] hover:text-[#172A1E]'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Student Login
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onChangePortalMode('faculty');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                portalMode === 'faculty'
                  ? 'bg-[#EA7A26] text-white'
                  : 'text-[#4D6354] hover:text-[#172A1E]'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Teacher / Admin
            </button>
          </div>

          <h2 className="text-2xl font-bold text-[#172A1E] mb-2">
            {portalMode === 'faculty' ? 'Teacher & Admin Portal' : 'Sign in with Gmail'}
          </h2>
          <p className="text-sm text-[#4D6354] mb-6">
            {portalMode === 'faculty'
              ? 'Sign in with your Gmail account, then enter your SLA Teacher or Admin Secret Code to unlock the Faculty Monitor, Quiz Builder, and Admin Console.'
              : 'Students sign in using Google accounts. Personal email addresses remain strictly isolated from public leaderboards.'}
          </p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              soundFx.playClick();
              void onGoogleLogin();
            }}
            className={`w-full py-3.5 px-5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 ${
              portalMode === 'faculty'
                ? 'bg-[#EA7A26] hover:bg-[#D46818]'
                : 'bg-[#1E5B3A] hover:bg-[#17462C]'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#FFFFFF"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
              />
            </svg>
            {loading
              ? 'Connecting Gmail Account...'
              : portalMode === 'faculty'
                ? 'Continue with Google (Teacher / Admin)'
                : 'Continue with Google (Gmail)'}
          </button>

          <div className="mt-6 pt-6 border-t border-[#ECE7D8] flex items-start gap-3 text-xs text-[#4D6354]">
            <ShieldCheck className="w-5 h-5 text-[#1E5B3A] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#172A1E]">
                {portalMode === 'faculty' ? 'Secret Code Protected Access' : 'PII & Anti-Cheat Privacy'}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {portalMode === 'faculty'
                  ? 'Multiple teachers and co-admins can sign in using their Gmail and the academy Secret Code.'
                  : 'Verified Google Sign-In protects your profile, and your personal email is never shown on public leaderboards.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OnboardingProps {
  defaultName: string;
  defaultPhotoUrl?: string;
  email: string;
  authorizedRole: 'admin' | 'teacher' | null;
  defaultPortalMode: 'student' | 'faculty';
  onClaimRoleWithCode: (targetRole: 'teacher' | 'admin', accessCode: string) => Promise<void>;
  onComplete: (data: {
    displayName: string;
    section: string;
    role: UserRole;
    petSpecies: PetSpecies;
    petName: string;
    petColor: string;
    outfit: string;
    accessory: string;
    photoUrl: string;
  }) => Promise<void>;
}

export const OnboardingStudio: React.FC<OnboardingProps> = ({
  defaultName,
  defaultPhotoUrl = '',
  email,
  authorizedRole,
  defaultPortalMode,
  onClaimRoleWithCode,
  onComplete,
}) => {
  const initialRole: UserRole =
    authorizedRole || (defaultPortalMode === 'faculty' ? 'teacher' : 'student');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [accessCode, setAccessCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(defaultName || 'SLA Learner');
  const [section, setSection] = useState(
    initialRole === 'admin' ? 'SLA Administration' : SLA_SECTIONS[6]
  );
  const [useCustomSection, setUseCustomSection] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(defaultPhotoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [petSpecies, setPetSpecies] = useState<PetSpecies>('cat');
  const [petName, setPetName] = useState('Lorenzo');
  const [petColor, setPetColor] = useState('#F6EFE2');
  const [outfit, setOutfit] = useState(
    initialRole !== 'student' ? 'outfit_teacher_blazer' : 'outfit_sla_polo'
  );
  const [accessory, setAccessory] = useState('acc_academy_cap');
  const [saving, setSaving] = useState(false);

  const needsSecretCode =
    (role === 'teacher' && authorizedRole !== 'teacher' && authorizedRole !== 'admin') ||
    (role === 'admin' && authorizedRole !== 'admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !petName.trim()) {
      setCodeError('Please fill in both your Display Name and Pet Name.');
      soundFx.playWrong();
      return;
    }
    setCodeError(null);

    if (needsSecretCode && accessCode.trim().length < 4) {
      setCodeError(`Please enter the ${role === 'admin' ? 'Admin' : 'Teacher'} Secret Code.`);
      soundFx.playWrong();
      return;
    }

    setSaving(true);
    try {
      if (needsSecretCode && (role === 'teacher' || role === 'admin')) {
        await onClaimRoleWithCode(role, accessCode.trim());
      }
      soundFx.playLevelUp();
      const isFaculty = role === 'teacher' || role === 'admin';
      await onComplete({
        displayName: displayName.trim().slice(0, 60),
        section: section.trim().slice(0, 40) || 'SLA General',
        role,
        petSpecies,
        petName: petName.trim().slice(0, 30),
        petColor,
        outfit: isFaculty && outfit === 'outfit_sla_polo' ? 'outfit_teacher_blazer' : outfit,
        accessory,
        photoUrl,
      });
    } catch (err) {
      soundFx.playWrong();
      setCodeError(
        err instanceof Error
          ? err.message
          : 'Invalid secret code. Ask your SLA Administrator for the active code.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F2] py-10 px-4 sm:px-8 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="max-w-4xl w-full bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-10 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ECE7D8]">
          <div>
            <p className="text-xs font-semibold text-[#EA7A26]">San Lorenzo Academy Onboarding</p>
            <h2 className="text-2xl font-bold text-[#172A1E]">
              {role !== 'student' ? 'Faculty & Admin Profile Setup' : 'Student Profile & Pet Companion'}
            </h2>
          </div>
          <span className="text-xs text-[#4D6354]">{email}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6 items-start">
          {/* Left Preview */}
          <div className="lg:col-span-5 bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 flex flex-col items-center text-center">
            <PetAvatar
              species={petSpecies}
              color={petColor}
              outfit={
                (role === 'teacher' || role === 'admin') && outfit === 'outfit_sla_polo'
                  ? 'outfit_teacher_blazer'
                  : outfit
              }
              accessory={accessory}
              role={role}
              size={190}
              className="animate-float-gentle"
            />
            <p className="text-lg font-bold text-[#172A1E] mt-2">{petName || 'Lorenzo'}</p>
            <p className="text-xs text-[#4D6354] capitalize">
              {role} · {petSpecies} · SLA Uniform
            </p>

            <div className="w-full mt-5">
              <p className="text-xs font-semibold text-[#4D6354] mb-2 text-left">Pet Fur / Shell Color</p>
              <div className="flex items-center justify-between gap-2">
                {PET_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setPetColor(c.hex);
                    }}
                    title={c.label}
                    className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${
                      petColor === c.hex ? 'border-[#1E5B3A] scale-110' : 'border-white'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Form */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-2">
                Account Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRole('student');
                    setOutfit('outfit_sla_polo');
                    if (!SLA_SECTIONS.includes(section) && section === 'SLA Administration') {
                      setSection(SLA_SECTIONS[6]);
                      setUseCustomSection(false);
                    }
                    setCodeError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                    role === 'student'
                      ? 'border-[#1E5B3A] bg-[#1E5B3A]/5 text-[#1E5B3A]'
                      : 'border-[#E5DEC9] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <GraduationCap className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Student</p>
                    <p className="text-[11px] text-[#4D6354]">Play &amp; care for pet</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRole('teacher');
                    setOutfit('outfit_teacher_blazer');
                    if (section === 'SLA Administration' || section === 'SLA Faculty & Administration') {
                      setSection(SLA_SECTIONS[6]);
                      setUseCustomSection(false);
                    }
                    setCodeError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                    role === 'teacher'
                      ? 'border-[#EA7A26] bg-[#EA7A26]/10 text-[#C65B10]'
                      : 'border-[#E5DEC9] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <Users className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Teacher</p>
                    <p className="text-[11px] text-[#4D6354]">Class room &amp; quizzes</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRole('admin');
                    setOutfit('outfit_teacher_blazer');
                    setSection('SLA Administration');
                    setUseCustomSection(false);
                    setCodeError(null);
                  }}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2.5 ${
                    role === 'admin'
                      ? 'border-[#EA7A26] bg-[#EA7A26]/10 text-[#C65B10]'
                      : 'border-[#E5DEC9] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Admin</p>
                    <p className="text-[11px] text-[#4D6354]">Full SLA Control</p>
                  </div>
                </button>
              </div>

              {needsSecretCode && (
                <div className="mt-3 p-4 rounded-2xl bg-[#FAF8F2] border border-[#EA7A26]/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#172A1E] flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-[#EA7A26]" />
                      {role === 'admin' ? 'Admin Secret Code Required' : 'Teacher Secret Code Required'}
                    </label>
                    <span className="text-[11px] text-[#4D6354]">Students cannot access without code</span>
                  </div>
                  <input
                    type="password"
                    required
                    minLength={4}
                    maxLength={40}
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      if (codeError) setCodeError(null);
                    }}
                    placeholder={`Enter SLA ${role === 'admin' ? 'Admin' : 'Teacher'} Secret Code`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] bg-white text-sm focus:outline-none focus:border-[#EA7A26]"
                  />
                  {codeError && (
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      {codeError}
                    </p>
                  )}
                </div>
              )}

              {!needsSecretCode && authorizedRole && role !== 'student' && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#1E5B3A] font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Pre-authorized SLA {authorizedRole} Gmail account verified — no secret code needed.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm focus:outline-none focus:border-[#1E5B3A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  {role === 'teacher'
                    ? 'Section / Class You Will Teach'
                    : role === 'admin'
                      ? 'Department / Advisory'
                      : 'Grade & Section'}
                </label>
                {role === 'admin' ? (
                  <input
                    type="text"
                    maxLength={40}
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm focus:outline-none focus:border-[#1E5B3A]"
                  />
                ) : (
                  <div className="space-y-2">
                    <select
                      value={useCustomSection ? '__custom__' : SLA_SECTIONS.includes(section) ? section : '__custom__'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setUseCustomSection(true);
                          if (SLA_SECTIONS.includes(section)) setSection('');
                        } else {
                          setUseCustomSection(false);
                          setSection(val);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm bg-white focus:outline-none focus:border-[#1E5B3A]"
                    >
                      {SLA_SECTIONS.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                      <option value="__custom__">Other / Custom Section...</option>
                    </select>
                    {(useCustomSection || !SLA_SECTIONS.includes(section)) && (
                      <input
                        type="text"
                        required
                        maxLength={40}
                        placeholder="Type custom grade & section (e.g., Grade 10 - Rizal)"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D8D0BC] text-sm focus:outline-none focus:border-[#1E5B3A]"
                      />
                    )}
                    {role === 'teacher' && (
                      <p className="text-[11px] text-[#4D6354]">
                        Your Teacher Monitor will open as an individual room for students in this section.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile preview"
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#1E5B3A]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white border border-[#D8D0BC] flex items-center justify-center text-[#4D6354]">
                    <Camera className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-[#172A1E]">Profile Photo (For Teacher ID)</p>
                  <p className="text-[11px] text-[#4D6354]">
                    Helps your teacher recognize you on the class roster &amp; leaderboard.
                  </p>
                  {photoError && <p className="text-[11px] text-red-600 font-semibold">{photoError}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-white border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A] hover:text-white text-xs font-bold cursor-pointer transition-colors">
                  {photoUrl ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const inputEl = e.currentTarget;
                      const file = inputEl.files?.[0];
                      inputEl.value = '';
                      if (!file) return;
                      setPhotoError(null);
                      try {
                        const compressed = await compressProfilePhoto(file);
                        setPhotoUrl(compressed);
                        soundFx.playClick();
                      } catch (err) {
                        setPhotoError(err instanceof Error ? err.message : 'Unable to process photo.');
                      }
                    }}
                  />
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="p-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                    aria-label="Remove profile photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172A1E] mb-2">
                Choose Your Animal Companion
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PET_SPECIES_INFO.map((animal) => (
                  <button
                    key={animal.id}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setPetSpecies(animal.id);
                      setPetColor(animal.defaultColor);
                    }}
                    className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                      petSpecies === animal.id
                        ? 'border-[#1E5B3A] bg-[#1E5B3A]/5'
                        : 'border-[#E5DEC9] hover:bg-[#FAF8F2]'
                    }`}
                  >
                    <PetAvatar
                      species={animal.id}
                      color={animal.defaultColor}
                      outfit="none"
                      accessory="none"
                      size={44}
                      className="mx-auto"
                    />
                    <span className="text-xs font-semibold text-[#172A1E] block mt-1">
                      {animal.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  Pet Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm focus:outline-none focus:border-[#1E5B3A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  Starter Accessory
                </label>
                <select
                  value={accessory}
                  onChange={(e) => setAccessory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm bg-white focus:outline-none focus:border-[#1E5B3A]"
                >
                  <option value="acc_academy_cap">Academy Cap</option>
                  <option value="acc_orange_bandana">Orange Bandana</option>
                  <option value="acc_green_scarf">Green Stripe Scarf</option>
                  <option value="acc_glasses">Scholar Glasses</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-6 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <>Creating SLA Profile...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enter LORENZONE Campus
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
