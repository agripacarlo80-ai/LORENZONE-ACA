import React from 'react';
import { PetSpecies, UserRole } from '../types';

interface PetAvatarProps {
  species: PetSpecies;
  color?: string;
  outfit?: string;
  accessory?: string;
  role?: UserRole;
  isSleeping?: boolean;
  mood?: 'happy' | 'excited' | 'sleepy' | 'concerned';
  size?: number;
  className?: string;
}

export const PetAvatar: React.FC<PetAvatarProps> = ({
  species,
  color = '#F6EFE2',
  outfit = 'outfit_sla_polo',
  accessory = 'acc_academy_cap',
  role = 'student',
  isSleeping = false,
  mood = 'happy',
  size = 160,
  className = '',
}) => {
  const stroke = '#2C2A24';
  const cheek = '#F7A99A';

  const outfitColors: Record<string, { main: string; trim: string; collar: string }> = {
    outfit_sla_polo: { main: '#FFFFFF', trim: '#1E5B3A', collar: '#1E5B3A' },
    outfit_sla_hoodie: { main: '#2E7D32', trim: '#17422B', collar: '#F59E0B' },
    outfit_orange_varsity: { main: '#EA7A26', trim: '#FFFFFF', collar: '#1E5B3A' },
    outfit_teacher_blazer: { main: '#17422B', trim: '#EA7A26', collar: '#FFFFFF' },
    none: { main: color, trim: color, collar: color },
  };

  const activeOutfit = outfitColors[outfit] || outfitColors.outfit_sla_polo;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${species} companion in ${outfit}`}
    >
      {/* Ground soft shadow */}
      <ellipse cx="90" cy="162" rx="48" ry="9" fill="#172A1E" fillOpacity="0.10" />

      {/* Back Ears / Shell */}
      {species === 'cat' && (
        <g>
          <path d="M48 64 L40 28 L72 48 Z" fill={color} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M51 57 L46 37 L65 49 Z" fill="#F4B8A8" />
          <path d="M132 64 L140 28 L108 48 Z" fill={color} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M129 57 L134 37 L115 49 Z" fill="#F4B8A8" />
        </g>
      )}

      {species === 'dog' && (
        <g>
          <ellipse cx="44" cy="76" rx="14" ry="28" transform="rotate(14 44 76)" fill="#B87D4B" stroke={stroke} strokeWidth="3.5" />
          <ellipse cx="136" cy="76" rx="14" ry="28" transform="rotate(-14 136 76)" fill="#B87D4B" stroke={stroke} strokeWidth="3.5" />
        </g>
      )}

      {species === 'bunny' && (
        <g>
          <ellipse cx="66" cy="34" rx="11" ry="28" transform="rotate(-8 66 34)" fill={color} stroke={stroke} strokeWidth="3.5" />
          <ellipse cx="66" cy="36" rx="5.5" ry="18" transform="rotate(-8 66 36)" fill="#F7B8AC" />
          <ellipse cx="114" cy="34" rx="11" ry="28" transform="rotate(8 114 34)" fill={color} stroke={stroke} strokeWidth="3.5" />
          <ellipse cx="114" cy="36" rx="5.5" ry="18" transform="rotate(8 114 36)" fill="#F7B8AC" />
        </g>
      )}

      {species === 'hamster' && (
        <g>
          <circle cx="50" cy="48" r="13" fill={color} stroke={stroke} strokeWidth="3.5" />
          <circle cx="50" cy="48" r="7" fill="#F4B8A8" />
          <circle cx="130" cy="48" r="13" fill={color} stroke={stroke} strokeWidth="3.5" />
          <circle cx="130" cy="48" r="7" fill="#F4B8A8" />
        </g>
      )}

      {species === 'turtle' && (
        <g>
          <ellipse cx="90" cy="122" rx="46" ry="34" fill="#3B7A47" stroke={stroke} strokeWidth="3.5" />
          <path d="M58 112 Q90 96 122 112" stroke="#24542E" strokeWidth="3" fill="none" />
          <path d="M68 134 L76 110 M112 134 L104 110 M90 105 L90 142" stroke="#24542E" strokeWidth="2.5" />
        </g>
      )}

      {/* Body / Torso */}
      <path
        d="M54 118 C54 98 126 98 126 118 L130 146 C130 156 112 160 90 160 C68 160 50 156 50 146 Z"
        fill={outfit === 'none' ? color : activeOutfit.main}
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Penguin belly patch if no outfit */}
      {species === 'penguin' && outfit === 'none' && (
        <ellipse cx="90" cy="134" rx="24" ry="22" fill="#FFFDF8" />
      )}

      {/* SLA Uniform Details */}
      {outfit !== 'none' && (
        <g>
          {/* Uniform collar */}
          <path d="M72 106 L90 118 L108 106" fill={activeOutfit.collar} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          {/* SLA Crest on pocket */}
          <circle cx="107" cy="126" r="6" fill="#EA7A26" stroke={stroke} strokeWidth="1.8" />
          <path d="M107 123 L109.5 126 L107 129 L104.5 126 Z" fill="#FFFFFF" />
          {/* Teacher/Admin lanyard/tie vs Student tie */}
          {role === 'teacher' || role === 'admin' ? (
            <path d="M86 116 L94 116 L95 142 L90 147 L85 142 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2" />
          ) : (
            <path d="M84 116 L96 116 L93 130 L87 130 Z" fill={activeOutfit.trim} stroke={stroke} strokeWidth="2" />
          )}
          {/* Hoodie strings */}
          {outfit === 'outfit_sla_hoodie' && (
            <g stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
              <line x1="82" y1="116" x2="82" y2="132" />
              <line x1="98" y1="116" x2="98" y2="132" />
            </g>
          )}
        </g>
      )}

      {/* Paws / Arms */}
      <ellipse cx="52" cy="132" rx="10" ry="13" transform="rotate(18 52 132)" fill={color} stroke={stroke} strokeWidth="3.5" />
      <ellipse cx="128" cy="132" rx="10" ry="13" transform="rotate(-18 128 132)" fill={color} stroke={stroke} strokeWidth="3.5" />

      {/* Feet */}
      <ellipse cx="70" cy="157" rx="13" ry="7" fill={species === 'penguin' ? '#EA7A26' : color} stroke={stroke} strokeWidth="3" />
      <ellipse cx="110" cy="157" rx="13" ry="7" fill={species === 'penguin' ? '#EA7A26' : color} stroke={stroke} strokeWidth="3" />

      {/* Head */}
      <ellipse cx="90" cy="76" rx="43" ry="37" fill={color} stroke={stroke} strokeWidth="3.5" />

      {/* Penguin face mask */}
      {species === 'penguin' && (
        <path
          d="M57 76 C57 58 76 52 90 62 C104 52 123 58 123 76 C123 95 108 106 90 106 C72 106 57 95 57 76 Z"
          fill="#FFFDF8"
        />
      )}

      {/* Hamster / Dog muzzle patch */}
      {(species === 'dog' || species === 'hamster') && (
        <ellipse cx="90" cy="87" rx="22" ry="15" fill="#FFFDF8" fillOpacity="0.88" />
      )}

      {/* Cheeks */}
      <ellipse cx="64" cy="84" rx="6.5" ry="4" fill={cheek} fillOpacity="0.7" />
      <ellipse cx="116" cy="84" rx="6.5" ry="4" fill={cheek} fillOpacity="0.7" />

      {/* Eyes */}
      {isSleeping || mood === 'sleepy' ? (
        <g stroke={stroke} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M67 74 Q73 79 79 74" />
          <path d="M101 74 Q107 79 113 74" />
        </g>
      ) : (
        <g>
          <circle cx="73" cy="73" r="5.5" fill={stroke} />
          <circle cx="71" cy="71" r="2" fill="#FFFFFF" />
          <circle cx="107" cy="73" r="5.5" fill={stroke} />
          <circle cx="105" cy="71" r="2" fill="#FFFFFF" />
        </g>
      )}

      {/* Nose / Beak & Mouth */}
      {species === 'penguin' ? (
        <path d="M83 80 L97 80 L90 90 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      ) : (
        <g>
          <ellipse cx="90" cy="81" rx="4.5" ry="3.2" fill={species === 'dog' ? '#3B281E' : '#E77B72'} />
          {mood === 'concerned' ? (
            <path d="M84 91 Q90 87 96 91" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M83 87 Q86.5 92 90 87 Q93.5 92 97 87" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          )}
        </g>
      )}

      {/* Cat whiskers */}
      {species === 'cat' && (
        <g stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.65">
          <line x1="48" y1="78" x2="60" y2="80" />
          <line x1="47" y1="85" x2="60" y2="85" />
          <line x1="132" y1="78" x2="120" y2="80" />
          <line x1="133" y1="85" x2="120" y2="85" />
        </g>
      )}

      {/* Accessories */}
      {accessory === 'acc_glasses' && (
        <g stroke="#2C2A24" strokeWidth="2.8" fill="#FFFFFF" fillOpacity="0.22">
          <circle cx="73" cy="73" r="10.5" />
          <circle cx="107" cy="73" r="10.5" />
          <line x1="83.5" y1="73" x2="96.5" y2="73" />
        </g>
      )}

      {accessory === 'acc_academy_cap' && (
        <g>
          <path d="M58 49 C62 32 118 32 122 49 Z" fill="#1E5B3A" stroke={stroke} strokeWidth="3" />
          <path d="M55 49 Q90 42 132 51 Q112 56 55 49 Z" fill="#17422B" stroke={stroke} strokeWidth="2.5" />
          <circle cx="90" cy="40" r="4" fill="#EA7A26" stroke={stroke} strokeWidth="1.5" />
        </g>
      )}

      {accessory === 'acc_orange_bandana' && (
        <path d="M62 103 Q90 116 118 103 L90 124 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" />
      )}

      {accessory === 'acc_green_scarf' && (
        <g>
          <rect x="61" y="100" width="58" height="12" rx="6" fill="#1E5B3A" stroke={stroke} strokeWidth="2.8" />
          <rect x="96" y="108" width="13" height="22" rx="4" fill="#2E7D32" stroke={stroke} strokeWidth="2.8" />
          <line x1="98" y1="118" x2="107" y2="118" stroke="#F59E0B" strokeWidth="3" />
        </g>
      )}

      {accessory === 'acc_bowtie' && (
        <g fill="#F59E0B" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M74 104 L90 111 L74 118 Z" />
          <path d="M106 104 L90 111 L106 118 Z" />
          <circle cx="90" cy="111" r="4" />
        </g>
      )}

      {/* Sleeping Zzz */}
      {isSleeping && (
        <g fill="#EA7A26" fontFamily="Outfit, sans-serif" fontWeight="700">
          <text x="128" y="42" fontSize="14">z</text>
          <text x="138" y="30" fontSize="18">Z</text>
        </g>
      )}
    </svg>
  );
};
