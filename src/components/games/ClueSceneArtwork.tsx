import React from 'react';
import { CluePanel } from '../../types';

interface ClueSceneArtworkProps {
  panel: CluePanel;
  panelIndex: number;
  showLabel?: boolean;
  className?: string;
}

type SceneTheme =
  | 'solar'
  | 'optics'
  | 'space'
  | 'ocean'
  | 'nature'
  | 'physics'
  | 'lab'
  | 'math'
  | 'civics'
  | 'cyber'
  | 'literature';

function detectSceneTheme(panel: CluePanel): SceneTheme {
  const text = `${panel.label || ''} ${panel.emoji || ''}`.toLowerCase();
  if (/sun|solar|daylight|puddle|drying|clothes|photovoltaic|desert|☀️|🌻|👕|🏜️|🔋|⚡/.test(text)) {
    return 'solar';
  }
  if (/prism|rainbow|straw|lens|aperture|glass|mirror|🌈|🔍|👓|📷|🥤/.test(text)) {
    return 'optics';
  }
  if (/mars|orbit|star|constellation|night|moon|observatory|nebula|planet|🪐|🚀|🔭|🌙|✨|🌌|⭐|🌑/.test(text)) {
    return 'space';
  }
  if (/ocean|sea|island|archipelago|fish|reef|boat|tide|vapor|cloud|🌊|🏝️|⛵|🐠|☁️/.test(text)) {
    return 'ocean';
  }
  if (/leaf|plant|forest|tree|flower|bee|mushroom|biosphere|rhino|habitat|🌿|🌱|🌳|🐝|🍄|🦁/.test(text)) {
    return 'nature';
  }
  if (/scale|gravity|apple|tug|bridge|pendulum|tightrope|⚖️|🪢|🌉|⬇️|🕰️|🎪|🍎/.test(text)) {
    return 'physics';
  }
  if (/lab|test tube|microscope|thermometer|tea|salt|notebook|📓|🧪|🔬|🌡️|☕|🧂/.test(text)) {
    return 'lab';
  }
  if (/fence|track|frame|tape|polygon|triangle|number|grid|📐|📏|🏡|🏃|🖼️|🧱|🔢/.test(text)) {
    return 'math';
  }
  if (/ballot|town|vote|scroll|constitution|rights|🗣️|🗳️|🏛️|✋|📜/.test(text)) {
    return 'civics';
  }
  if (/lock|cipher|binary|code|shield|envelope|circuit|flow|compass|🔒|🔑|💻|✉️|🛡️|🧭|🗺️/.test(text)) {
    return 'cyber';
  }
  return 'literature';
}

const THEME_PALETTES: Record<
  SceneTheme,
  { skyTop: string; skyBottom: string; hillBack: string; hillFront: string; accent: string }
> = {
  solar: {
    skyTop: '#FEF3C7',
    skyBottom: '#FDE68A',
    hillBack: '#F59E0B',
    hillFront: '#D97706',
    accent: '#EA7A26',
  },
  optics: {
    skyTop: '#E0F2FE',
    skyBottom: '#FCE7F3',
    hillBack: '#818CF8',
    hillFront: '#0EA5E9',
    accent: '#EC4899',
  },
  space: {
    skyTop: '#0F172A',
    skyBottom: '#1E293B',
    hillBack: '#334155',
    hillFront: '#1E1B4B',
    accent: '#FACC15',
  },
  ocean: {
    skyTop: '#BAE6FD',
    skyBottom: '#E0F2FE',
    hillBack: '#0284C7',
    hillFront: '#0369A1',
    accent: '#14B8A6',
  },
  nature: {
    skyTop: '#DCFCE7',
    skyBottom: '#BBF7D0',
    hillBack: '#22C55E',
    hillFront: '#15803D',
    accent: '#1E5B3A',
  },
  physics: {
    skyTop: '#FFF7ED',
    skyBottom: '#FFEDD5',
    hillBack: '#FB923C',
    hillFront: '#C2410C',
    accent: '#1E5B3A',
  },
  lab: {
    skyTop: '#ECFEFF',
    skyBottom: '#CCFBF1',
    hillBack: '#14B8A6',
    hillFront: '#0F766E',
    accent: '#EA7A26',
  },
  math: {
    skyTop: '#F3F4F6',
    skyBottom: '#E5E7EB',
    hillBack: '#64748B',
    hillFront: '#334155',
    accent: '#EA7A26',
  },
  civics: {
    skyTop: '#FEF9C3',
    skyBottom: '#FDE047',
    hillBack: '#B45309',
    hillFront: '#78350F',
    accent: '#1E5B3A',
  },
  cyber: {
    skyTop: '#064E3B',
    skyBottom: '#022C22',
    hillBack: '#047857',
    hillFront: '#065F46',
    accent: '#34D399',
  },
  literature: {
    skyTop: '#FDF4FF',
    skyBottom: '#F3E8FF',
    hillBack: '#A855F7',
    hillFront: '#7E22CE',
    accent: '#EA7A26',
  },
};

export const ClueSceneArtwork: React.FC<ClueSceneArtworkProps> = ({
  panel,
  panelIndex,
  showLabel = false,
  className = '',
}) => {
  if (panel.imageUrl) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <img
          src={panel.imageUrl}
          alt={showLabel ? panel.label : `Visual clue ${panelIndex + 1}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        {showLabel && panel.label && (
          <span className="absolute inset-x-2 bottom-2 bg-[#172A1E]/85 text-white text-[11px] font-semibold px-2 py-1 rounded-lg truncate">
            {panel.label}
          </span>
        )}
      </div>
    );
  }

  const theme = detectSceneTheme(panel);
  const pal = THEME_PALETTES[theme];
  const gradId = `scene_grad_${theme}_${panelIndex}`;

  return (
    <div className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.skyTop} />
            <stop offset="100%" stopColor={pal.skyBottom} />
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill={`url(#${gradId})`} />

        {/* Atmospheric Scene Layer by Theme */}
        {theme === 'space' && (
          <>
            <circle cx="32" cy="36" r="2.2" fill="#FDE047" opacity="0.9" />
            <circle cx="72" cy="24" r="1.6" fill="#FFFFFF" opacity="0.85" />
            <circle cx="154" cy="38" r="2.4" fill="#FDE047" opacity="0.9" />
            <circle cx="170" cy="78" r="1.5" fill="#FFFFFF" opacity="0.7" />
            <circle cx="44" cy="96" r="1.8" fill="#93C5FD" opacity="0.8" />
            <path d="M32 36 L72 24 L154 38 L170 78" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" fill="none" />
          </>
        )}

        {theme === 'solar' && (
          <>
            <circle cx="158" cy="40" r="26" fill="#FBBF24" opacity="0.55" />
            <circle cx="158" cy="40" r="16" fill="#F59E0B" opacity="0.85" />
            <path d="M126 40 L108 40 M158 72 L158 90 M135 62 L120 77" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
          </>
        )}

        {theme === 'optics' && (
          <>
            <polygon points="100,32 146,118 54,118" fill="#FFFFFF" opacity="0.5" stroke="#0EA5E9" strokeWidth="2" />
            <line x1="12" y1="74" x2="76" y2="74" stroke="#F59E0B" strokeWidth="3.5" opacity="0.7" />
            <line x1="122" y1="76" x2="192" y2="54" stroke="#EF4444" strokeWidth="2.5" opacity="0.75" />
            <line x1="124" y1="84" x2="192" y2="78" stroke="#10B981" strokeWidth="2.5" opacity="0.75" />
            <line x1="126" y1="92" x2="192" y2="104" stroke="#6366F1" strokeWidth="2.5" opacity="0.75" />
          </>
        )}

        {theme === 'cyber' && (
          <g stroke="#34D399" strokeWidth="1.2" opacity="0.28" fill="none">
            <path d="M16 32 H70 L88 50 H184" />
            <path d="M16 154 H112 L132 134 H184" />
            <circle cx="70" cy="32" r="3.5" fill="#34D399" />
            <circle cx="132" cy="134" r="3.5" fill="#34D399" />
          </g>
        )}

        {theme === 'math' && (
          <g stroke="#94A3B8" strokeWidth="1" opacity="0.32">
            <line x1="0" y1="50" x2="200" y2="50" />
            <line x1="0" y1="100" x2="200" y2="100" />
            <line x1="0" y1="150" x2="200" y2="150" />
            <line x1="50" y1="0" x2="50" y2="200" />
            <line x1="100" y1="0" x2="100" y2="200" />
            <line x1="150" y1="0" x2="150" y2="200" />
          </g>
        )}

        {theme === 'ocean' ? (
          <>
            <path d="M0 132 Q45 118 90 132 T180 132 T220 132 L220 200 L0 200 Z" fill={pal.hillBack} opacity="0.5" />
            <path d="M0 148 Q50 134 100 148 T200 148 L200 200 L0 200 Z" fill={pal.hillFront} opacity="0.75" />
          </>
        ) : (
          <>
            <path d="M0 145 Q60 112 125 142 T200 135 L200 200 L0 200 Z" fill={pal.hillBack} opacity="0.4" />
            <path d="M0 162 Q85 135 200 158 L200 200 L0 200 Z" fill={pal.hillFront} opacity="0.65" />
          </>
        )}

        {/* Center Scene Medallion */}
        <circle cx="100" cy="96" r="44" fill="#FFFFFF" opacity="0.92" stroke={pal.accent} strokeWidth="3" />
      </svg>

      {/* Crisp Central Visual Symbol */}
      <span
        className="absolute text-5xl sm:text-6xl select-none drop-shadow-xs pointer-events-none"
        style={{ transform: 'translateY(-4%)' }}
        aria-hidden="true"
      >
        {panel.emoji || '🔍'}
      </span>

      {showLabel && panel.label && (
        <span className="absolute inset-x-2 bottom-2 bg-[#172A1E]/85 text-white text-[11px] font-semibold px-2 py-1 rounded-lg truncate text-center">
          {panel.label}
        </span>
      )}
    </div>
  );
};
