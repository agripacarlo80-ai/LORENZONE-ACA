import React, { useState } from 'react';
import { BookOpen, HelpCircle, Settings, ShieldCheck, Volume2, VolumeX, X, LogOut, KeyRound, CheckCircle2, Palette, School, Lock } from 'lucide-react';
import { SLA_SECTIONS } from '../data/defaultDecks';
import { PublicProfile, SectionChangeRequest, ThemeColor, UserRole } from '../types';
import { soundFx } from '../lib/sound';

const THEME_OPTIONS: Array<{
  id: ThemeColor;
  label: string;
  swatchBg: string;
  swatchBorder: string;
  description: string;
}> = [
  {
    id: 'white',
    label: 'White',
    swatchBg: '#FFFFFF',
    swatchBorder: '#DCE5DF',
    description: 'Clean white canvas with green & orange accents',
  },
  {
    id: 'green',
    label: 'Green',
    swatchBg: '#1E5B3A',
    swatchBorder: '#17462C',
    description: 'SLA forest green header & soft mint campus backdrop',
  },
  {
    id: 'orange',
    label: 'Orange',
    swatchBg: '#EA7A26',
    swatchBorder: '#C05409',
    description: 'Vibrant SLA orange header & warm sunlit backdrop',
  },
];

interface UtilityToolbarProps {
  muted: boolean;
  onToggleMute: () => void;
  onOpenInstructions: () => void;
  onOpenQuestionsHelp: () => void;
  onOpenSettings: () => void;
  theme: ThemeColor;
  onChangeTheme: (next: ThemeColor) => void;
  role: UserRole;
  section?: string;
  lockedAlertCount: number;
}

export const UtilityToolbar: React.FC<UtilityToolbarProps> = ({
  muted,
  onToggleMute,
  onOpenInstructions,
  onOpenQuestionsHelp,
  onOpenSettings,
  theme,
  onChangeTheme,
  role,
  section,
  lockedAlertCount,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-4 bg-[var(--lz-surface)] rounded-2xl border border-[var(--lz-border)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onToggleMute();
          }}
          className="px-3 py-1.5 rounded-xl border border-[var(--lz-border)] hover:bg-[var(--lz-surface-alt)] text-xs font-semibold text-[#172A1E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5 text-[#EA7A26]" /> : <Volume2 className="w-3.5 h-3.5 text-[#1E5B3A]" />}
          {muted ? 'Sound Off' : 'Sound On'}
        </button>

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenInstructions();
          }}
          className="px-3 py-1.5 rounded-xl border border-[var(--lz-border)] hover:bg-[var(--lz-surface-alt)] text-xs font-semibold text-[#172A1E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#1E5B3A]" />
          Instructions
        </button>

        {role !== 'admin' && (
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onOpenQuestionsHelp();
            }}
            className="px-3 py-1.5 rounded-xl border border-[var(--lz-border)] hover:bg-[var(--lz-surface-alt)] text-xs font-semibold text-[#172A1E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#EA7A26]" />
            Game Rules
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenSettings();
          }}
          className="px-3 py-1.5 rounded-xl border border-[var(--lz-border)] hover:bg-[var(--lz-surface-alt)] text-xs font-semibold text-[#172A1E] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Settings className="w-3.5 h-3.5 text-[#4D6354]" />
          Settings
        </button>

        <div
          className="flex items-center gap-1 p-1 rounded-xl bg-[var(--lz-surface-alt)] border border-[var(--lz-border)]"
          role="group"
          aria-label="Campus theme color"
        >
          <Palette className="w-3.5 h-3.5 text-[#4D6354] ml-1.5 mr-0.5 shrink-0" />
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                soundFx.playClick();
                onChangeTheme(opt.id);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                theme === opt.id
                  ? 'bg-white text-[#172A1E] shadow-sm'
                  : 'text-[#4D6354] hover:text-[#172A1E]'
              }`}
              title={opt.description}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border shrink-0"
                style={{ backgroundColor: opt.swatchBg, borderColor: opt.swatchBorder }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-[#4D6354] flex items-center gap-2 flex-wrap">
        <span>San Lorenzo Academy, Inc.</span>
        <span aria-hidden="true">·</span>
        <span className="capitalize font-semibold text-[#1E5B3A]">{role} Portal</span>
        {section && role !== 'admin' && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#EA7A26]">{section}</span>
          </>
        )}
        {role === 'teacher' && lockedAlertCount > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-red-600 tabular-nums">{lockedAlertCount} Focus Alert</span>
          </>
        )}
      </div>
    </div>
  );
};

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const BaseModal: React.FC<ModalProps> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl border border-[#E5DEC9] max-w-lg w-full p-6 sm:p-7 shadow-xl max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between pb-4 border-b border-[#ECE7D8]">
        <h3 className="text-lg font-bold text-[#172A1E]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-[#FAF8F2] text-[#4D6354] cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  </div>
);

export const InstructionsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BaseModal title="How LORENZONE Works" onClose={onClose}>
    <div className="space-y-4 text-sm text-[#4D6354] leading-relaxed">
      <div>
        <h4 className="font-bold text-[#172A1E]">1. Care for Your SLA Pet</h4>
        <p className="text-xs mt-1">
          Feed, play, clean, and rest your animal companion. Teachers view your pet&apos;s level and care consistency alongside quiz results.
        </p>
      </div>
      <div>
        <h4 className="font-bold text-[#172A1E]">2. Play 11 Customizable Quiz Games</h4>
        <p className="text-xs mt-1">
          Pick any subject or teacher-imported PowerPoint deck to earn LorenCoins and unlock SLA uniforms and accessories.
        </p>
      </div>
      <div>
        <h4 className="font-bold text-[#172A1E]">3. Integrity Guard (Anti-Cheating)</h4>
        <p className="text-xs mt-1">
          Leaving the quiz tab or app window during an active round triggers an alert sound on the Teacher Monitor and locks answering until your teacher allows you back.
        </p>
      </div>
    </div>
  </BaseModal>
);

export const GameRulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <BaseModal title="All 11 Quiz Game Rules" onClose={onClose}>
    <div className="space-y-2.5 text-xs text-[#4D6354] leading-relaxed">
      <p><strong className="text-[#EA7A26]">1. Lorenscape:</strong> Tap or type letters from the tray to spell the exact answer.</p>
      <p><strong className="text-[#EA7A26]">2. On the Run:</strong> Sprint across the SLA track by answering recitation questions quickly.</p>
      <p><strong className="text-[#EA7A26]">3. Brainzone:</strong> Type identification answers before the 60s timer ends to elevate your platform.</p>
      <p><strong className="text-[#EA7A26]">4. Grab It:</strong> Answer accurately to earn +25 points or steal +25 points from a rival.</p>
      <p><strong className="text-[#EA7A26]">5. Catch the Duck:</strong> Teachers pick mystery ducks for student recitation; students play solo pond rounds.</p>
      <p><strong className="text-[#1E5B3A]">6. Word Quest:</strong> Unscramble the shuffled letter tiles to spell the lesson term.</p>
      <p><strong className="text-[#1E5B3A]">7. Math Dash:</strong> Solve rapid arithmetic &amp; numeric problems with combo streaks before time expires.</p>
      <p><strong className="text-[#1E5B3A]">8. Quiz Master:</strong> Classic 4-choice mastery quiz with instant right/wrong feedback.</p>
      <p><strong className="text-[#1E5B3A]">9. Memory Match:</strong> Flip cards to pair each lesson clue with its matching answer.</p>
      <p><strong className="text-[#1E5B3A]">10. Sorting Squad:</strong> Classify terms into the correct subject category bins.</p>
      <p><strong className="text-[#1E5B3A]">11. Quick Recall:</strong> Rapid True/False blitz — judge whether each proposed answer matches the clue.</p>
    </div>
  </BaseModal>
);

export const SettingsModal: React.FC<{
  profile: PublicProfile;
  email: string;
  muted: boolean;
  onToggleMute: () => void;
  theme: ThemeColor;
  onChangeTheme: (next: ThemeColor) => void;
  onUpdateSection: (nextSection: string) => Promise<void>;
  sectionRequest?: SectionChangeRequest | null;
  onRequestSectionChange?: (requestedSection: string, reason: string) => Promise<void>;
  onClaimRoleWithCode: (targetRole: 'teacher' | 'admin', accessCode: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onClose: () => void;
}> = ({
  profile,
  email,
  muted,
  onToggleMute,
  theme,
  onChangeTheme,
  onUpdateSection,
  sectionRequest = null,
  onRequestSectionChange,
  onClaimRoleWithCode,
  onSignOut,
  onClose,
}) => {
  const currentStudentSec = (profile.section || '').trim();
  const initialSec = currentStudentSec || SLA_SECTIONS[6];
  const [sectionInput, setSectionInput] = useState(initialSec);
  const [useCustomSection, setUseCustomSection] = useState(!SLA_SECTIONS.includes(initialSec));
  const [savingSection, setSavingSection] = useState(false);
  const [sectionFeedback, setSectionFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [spellingInput, setSpellingInput] = useState(sectionRequest?.requestedSection || initialSec);
  const [useCustomSpelling, setUseCustomSpelling] = useState(
    !SLA_SECTIONS.includes(sectionRequest?.requestedSection || initialSec)
  );
  const [spellingReason, setSpellingReason] = useState('');
  const [submittingSpelling, setSubmittingSpelling] = useState(false);
  const [spellingFeedback, setSpellingFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [secretCode, setSecretCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [roleFeedback, setRoleFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sectionInput.trim().slice(0, 40);
    if (!cleaned) {
      setSectionFeedback({ type: 'err', text: 'Please select or enter a valid class section.' });
      return;
    }
    setSavingSection(true);
    setSectionFeedback(null);
    try {
      await onUpdateSection(cleaned);
      soundFx.playCorrect();
      setSectionFeedback({
        type: 'ok',
        text: `Teaching classroom set to "${cleaned}".`,
      });
    } catch (err) {
      soundFx.playWrong();
      setSectionFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save class section.',
      });
    } finally {
      setSavingSection(false);
    }
  };

  const handleSubmitSpellingCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRequestSectionChange) return;
    const cleaned = spellingInput.trim().slice(0, 40);
    if (!cleaned) {
      setSpellingFeedback({ type: 'err', text: 'Please enter the corrected Grade & Section spelling.' });
      return;
    }
    if (cleaned === currentStudentSec) {
      setSpellingFeedback({
        type: 'err',
        text: 'Please enter a corrected spelling different from your current section.',
      });
      return;
    }
    setSubmittingSpelling(true);
    setSpellingFeedback(null);
    try {
      await onRequestSectionChange(
        cleaned,
        spellingReason.trim() || 'Fix wrong spelling in my Grade & Section'
      );
      soundFx.playCorrect();
      setSpellingReason('');
      setSpellingFeedback({
        type: 'ok',
        text: `Spelling correction request to "${cleaned}" sent to the SLA Admin for approval.`,
      });
    } catch (err) {
      soundFx.playWrong();
      setSpellingFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit section spelling request.',
      });
    } finally {
      setSubmittingSpelling(false);
    }
  };

  const handleUnlockTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secretCode.trim().length < 4) {
      setRoleFeedback({ type: 'err', text: 'Please enter a valid Teacher Secret Code.' });
      return;
    }
    setVerifying(true);
    setRoleFeedback(null);
    try {
      await onClaimRoleWithCode('teacher', secretCode.trim());
      soundFx.playLevelUp();
      setSecretCode('');
      setRoleFeedback({
        type: 'ok',
        text: 'Role updated to TEACHER! Your classroom monitor is now unlocked.',
      });
    } catch (err) {
      soundFx.playWrong();
      setRoleFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Invalid Teacher Secret Code.',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <BaseModal title="Account &amp; Classroom Settings" onClose={onClose}>
      <div className="space-y-5 text-sm">
        <div className="p-4 rounded-2xl bg-[var(--lz-surface-alt)] border border-[var(--lz-border)] space-y-1">
          <p className="font-bold text-[#172A1E]">{profile.displayName}</p>
          <p className="text-xs text-[#4D6354] capitalize">
            Role: {profile.role} · Section: {profile.section || 'Unassigned'}
            {profile.role !== 'admin' ? ` · Pet: ${profile.petName}` : ''}
          </p>
          <p className="text-xs text-[#4D6354]">Private Gmail: {email}</p>
        </div>

        {profile.role === 'teacher' && (
          <form onSubmit={handleSaveSection} className="p-4 rounded-2xl border border-[var(--lz-border)] space-y-3">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-[#1E5B3A]" />
              <div>
                <p className="font-semibold text-[#172A1E] text-xs">
                  Assigned Teaching Classroom
                </p>
                <p className="text-xs text-[#4D6354]">
                  Choose the section you teach to monitor its students inside your individual classroom room.
                </p>
              </div>
            </div>
            <select
              value={useCustomSection ? '__custom__' : SLA_SECTIONS.includes(sectionInput) ? sectionInput : '__custom__'}
              onChange={(e) => {
                const val = e.target.value;
                setSectionFeedback(null);
                if (val === '__custom__') {
                  setUseCustomSection(true);
                  if (SLA_SECTIONS.includes(sectionInput)) setSectionInput('');
                } else {
                  setUseCustomSection(false);
                  setSectionInput(val);
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs font-medium focus:outline-none focus:border-[#1E5B3A]"
            >
              {SLA_SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
              <option value="__custom__">Other / Custom Section...</option>
            </select>
            {(useCustomSection || !SLA_SECTIONS.includes(sectionInput)) && (
              <input
                type="text"
                maxLength={40}
                value={sectionInput}
                onChange={(e) => setSectionInput(e.target.value)}
                placeholder="Enter custom class section..."
                className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs focus:outline-none focus:border-[#1E5B3A]"
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {sectionFeedback && (
                  <p
                    className={`text-xs font-semibold ${
                      sectionFeedback.type === 'ok' ? 'text-[#1E5B3A]' : 'text-red-700'
                    }`}
                  >
                    {sectionFeedback.text}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={savingSection}
                className="px-3.5 py-1.5 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {savingSection ? 'Saving...' : 'Save Section'}
              </button>
            </div>
          </form>
        )}

        {profile.role === 'student' && (
          <div className="p-4 rounded-2xl border border-[var(--lz-border)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#EA7A26] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#172A1E] text-xs">
                    Permanent Grade &amp; Section
                  </p>
                  <p className="text-xs text-[#4D6354]">
                    Your section is locked after sign-in. Only an SLA Admin can approve fixing a wrong spelling.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[#FAF8F2] border border-[#E5DEC9] text-xs font-bold text-[#172A1E] shrink-0">
                {currentStudentSec || 'Unassigned'}
              </span>
            </div>

            {sectionRequest && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-0.5 ${
                  sectionRequest.status === 'pending'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : sectionRequest.status === 'approved'
                      ? 'bg-emerald-50 border-emerald-200 text-[#1E5B3A]'
                      : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <p className="font-bold">
                  {sectionRequest.status === 'pending'
                    ? 'Spelling Correction Pending Admin Approval'
                    : sectionRequest.status === 'approved'
                      ? 'Last Spelling Correction Approved'
                      : 'Spelling Correction Request Declined'}
                </p>
                <p>
                  Requested spelling: <strong>{sectionRequest.requestedSection}</strong>
                  {sectionRequest.reviewNote ? ` · Note: ${sectionRequest.reviewNote}` : ''}
                </p>
              </div>
            )}

            {onRequestSectionChange && (
              <form onSubmit={handleSubmitSpellingCorrection} className="pt-2 border-t border-[#ECE7D8] space-y-2.5">
                <p className="text-xs font-semibold text-[#172A1E]">
                  Made a spelling mistake? Request Admin Spelling Correction
                </p>
                <select
                  value={
                    useCustomSpelling
                      ? '__custom__'
                      : SLA_SECTIONS.includes(spellingInput)
                        ? spellingInput
                        : '__custom__'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setSpellingFeedback(null);
                    if (val === '__custom__') {
                      setUseCustomSpelling(true);
                      if (SLA_SECTIONS.includes(spellingInput)) setSpellingInput('');
                    } else {
                      setUseCustomSpelling(false);
                      setSpellingInput(val);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs font-medium focus:outline-none focus:border-[#1E5B3A]"
                >
                  {SLA_SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                  <option value="__custom__">Type Exact Corrected Spelling...</option>
                </select>
                {(useCustomSpelling || !SLA_SECTIONS.includes(spellingInput)) && (
                  <input
                    type="text"
                    maxLength={40}
                    value={spellingInput}
                    onChange={(e) => setSpellingInput(e.target.value)}
                    placeholder="Enter exact corrected Grade & Section..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs focus:outline-none focus:border-[#1E5B3A]"
                  />
                )}
                <input
                  type="text"
                  maxLength={140}
                  value={spellingReason}
                  onChange={(e) => setSpellingReason(e.target.value)}
                  placeholder="Spelling mistake note (e.g., typo in St. Lorenzo)"
                  className="w-full px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs focus:outline-none focus:border-[#1E5B3A]"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {spellingFeedback && (
                      <p
                        className={`text-xs font-semibold ${
                          spellingFeedback.type === 'ok' ? 'text-[#1E5B3A]' : 'text-red-700'
                        }`}
                      >
                        {spellingFeedback.text}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submittingSpelling}
                    className="px-3.5 py-1.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {submittingSpelling ? 'Sending...' : 'Request Spelling Fix'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="p-4 rounded-2xl border border-[var(--lz-border)] space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#EA7A26]" />
            <div>
              <p className="font-semibold text-[#172A1E] text-xs">SLA Campus Theme Color</p>
              <p className="text-xs text-[#4D6354]">Choose between White, Green, and Orange palettes</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onChangeTheme(opt.id);
                }}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  theme === opt.id
                    ? 'border-[#1E5B3A] bg-[var(--lz-surface-alt)]'
                    : 'border-[var(--lz-border)] bg-white hover:bg-[var(--lz-surface-alt)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border shrink-0"
                    style={{ backgroundColor: opt.swatchBg, borderColor: opt.swatchBorder }}
                  />
                  <span className="text-xs font-bold text-[#172A1E]">{opt.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--lz-border)]">
          <div>
            <p className="font-semibold text-[#172A1E] text-xs">Sound Effects &amp; Alerts</p>
            <p className="text-xs text-[#4D6354]">Game chimes, duck quacks, and monitor alarms</p>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            className="px-3.5 py-1.5 rounded-xl bg-[#1E5B3A] text-white text-xs font-bold cursor-pointer"
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>

        {profile.role === 'student' && (
          <form onSubmit={handleUnlockTeacher} className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#EA7A26]" />
              <p className="font-bold text-[#172A1E] text-xs">
                Unlock Teacher Role
              </p>
            </div>
            <p className="text-xs text-[#4D6354]">
              Enter the Teacher Secret Code provided by your SLA Administrator to switch this account to Teacher mode.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder="Enter teacher secret code"
                className="flex-1 px-3 py-2 rounded-xl border border-[#D8D0BC] bg-white text-xs focus:outline-none focus:border-[#EA7A26]"
              />
              <button
                type="submit"
                disabled={verifying}
                className="px-4 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {verifying ? 'Checking...' : 'Verify'}
              </button>
            </div>
            {roleFeedback && (
              <p
                className={`text-xs font-semibold flex items-center gap-1.5 ${
                  roleFeedback.type === 'ok' ? 'text-[#1E5B3A]' : 'text-red-700'
                }`}
              >
                {roleFeedback.type === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                {roleFeedback.text}
              </p>
            )}
          </form>
        )}

        {profile.role === 'teacher' && (
          <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-1">
            <p className="font-bold text-[#172A1E] text-xs flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#EA7A26]" />
              Teacher Room Access
            </p>
            <p className="text-xs text-[#4D6354]">
              Teacher accounts monitor their own assigned class section and cannot escalate to Admin. Admin consoles use a separate Admin Secret Code.
            </p>
          </div>
        )}

        <div className="flex items-start gap-2.5 text-xs text-[#4D6354]">
          <ShieldCheck className="w-4 h-4 text-[#1E5B3A] shrink-0 mt-0.5" />
          <p>Your Gmail address is isolated from public views to protect user privacy.</p>
        </div>

        <button
          type="button"
          onClick={() => void onSignOut()}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out of Google Account
        </button>
      </div>
    </BaseModal>
  );
};
