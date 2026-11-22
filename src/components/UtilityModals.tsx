import React, { useState } from 'react';
import { BookOpen, HelpCircle, Settings, ShieldCheck, Volume2, VolumeX, X, LogOut, KeyRound, CheckCircle2, Palette } from 'lucide-react';
import { PublicProfile, ThemeColor, UserRole } from '../types';
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

      <div className="text-xs text-[#4D6354] flex items-center gap-2">
        <span>San Lorenzo Academy, Inc.</span>
        <span aria-hidden="true">·</span>
        <span className="capitalize font-semibold text-[#1E5B3A]">{role} Portal</span>
        {(role === 'teacher' || role === 'admin') && lockedAlertCount > 0 && (
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
  onClaimRoleWithCode,
  onSignOut,
  onClose,
}) => {
  const [targetRole, setTargetRole] = useState<'teacher' | 'admin'>(
    profile.role === 'teacher' ? 'admin' : 'teacher'
  );
  const [secretCode, setSecretCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [roleFeedback, setRoleFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleUnlockRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secretCode.trim().length < 4) {
      setRoleFeedback({ type: 'err', text: 'Please enter a valid Teacher or Admin Secret Code.' });
      return;
    }
    setVerifying(true);
    setRoleFeedback(null);
    try {
      await onClaimRoleWithCode(targetRole, secretCode.trim());
      soundFx.playLevelUp();
      setSecretCode('');
      setRoleFeedback({
        type: 'ok',
        text: `Role updated to ${targetRole.toUpperCase()}! Faculty console unlocked.`,
      });
    } catch (err) {
      soundFx.playWrong();
      setRoleFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Invalid secret code.',
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
          <p className="text-xs text-[#4D6354] capitalize">Role: {profile.role} · Pet: {profile.petName}</p>
          <p className="text-xs text-[#4D6354]">Private Gmail: {email}</p>
        </div>

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

        {profile.role !== 'admin' && (
          <form onSubmit={handleUnlockRole} className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#EA7A26]" />
              <p className="font-bold text-[#172A1E] text-xs">
                Switch / Unlock Teacher or Admin Role
              </p>
            </div>
            <p className="text-xs text-[#4D6354]">
              Enter the academy Secret Code to switch this account to Teacher or Co-Admin.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['teacher', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setTargetRole(r);
                    setRoleFeedback(null);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize cursor-pointer transition-colors ${
                    targetRole === r
                      ? 'border-[#EA7A26] bg-[#EA7A26] text-white'
                      : 'border-[#D8D0BC] bg-white text-[#4D6354]'
                  }`}
                >
                  {r} Code
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder={`Enter ${targetRole} secret code`}
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
