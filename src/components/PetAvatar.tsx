import React from 'react';
import { PetSpecies, UserRole } from '../types';

interface PetAvatarProps {
  species: PetSpecies;
  color?: string;
  outfit?: string;
  accessory?: string;
  role?: UserRole;
  isSleeping?: boolean;
  mood?: 'happy' | 'excited' | 'sleepy' | 'concerned' | 'eating' | 'blushing' | 'soapy' | 'sick' | 'showering';
  cleanliness?: number;
  foamLevel?: number;
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
  cleanliness = 100,
  foamLevel = 0,
  size = 160,
  className = '',
}) => {
  const stroke = '#2C2A24';
  const cheek =
    mood === 'sick'
      ? '#A3E635'
      : mood === 'blushing' || mood === 'excited'
        ? '#FB7185'
        : '#F7A99A';
  const isDirty = cleanliness < 45;

  const outfitColors: Record<string, { main: string; trim: string; collar: string }> = {
    outfit_sla_polo: { main: '#FFFFFF', trim: '#1E5B3A', collar: '#1E5B3A' },
    outfit_sla_hoodie: { main: '#2E7D32', trim: '#17422B', collar: '#F59E0B' },
    outfit_raincoat: { main: '#FACC15', trim: '#EA7A26', collar: '#EA7A26' },
    outfit_pe_jersey: { main: '#16A34A', trim: '#FACC15', collar: '#FACC15' },
    outfit_science_lab: { main: '#F8FAFC', trim: '#0EA5E9', collar: '#1E5B3A' },
    outfit_orange_varsity: { main: '#EA7A26', trim: '#FFFFFF', collar: '#1E5B3A' },
    outfit_chef_apron: { main: '#FFFFFF', trim: '#EF4444', collar: '#EF4444' },
    outfit_denim_jacket: { main: '#2563EB', trim: '#93C5FD', collar: '#1D4ED8' },
    outfit_teacher_blazer: { main: '#17422B', trim: '#EA7A26', collar: '#FFFFFF' },
    outfit_grad_toga: { main: '#1E5B3A', trim: '#FACC15', collar: '#FACC15' },
    outfit_scholar_cape: { main: '#0F4C2B', trim: '#FACC15', collar: '#FACC15' },
    outfit_cyber_suit: { main: '#1E293B', trim: '#10B981', collar: '#10B981' },
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

      {/* Royal Scholar Cape Back Layer */}
      {outfit === 'outfit_scholar_cape' && (
        <path
          d="M48 106 L132 106 L146 158 L34 158 Z"
          fill="#0F4C2B"
          stroke={stroke}
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
      )}

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

      {/* SLA Uniform & Outfit Details */}
      {outfit !== 'none' && (
        <g>
          {outfit === 'outfit_denim_jacket' ? (
            <g>
              <rect x="81" y="108" width="18" height="50" fill="#FFFFFF" />
              <path d="M72 106 L82 122 L82 108 Z" fill="#1D4ED8" stroke={stroke} strokeWidth="2" />
              <path d="M108 106 L98 122 L98 108 Z" fill="#1D4ED8" stroke={stroke} strokeWidth="2" />
              <rect x="61" y="128" width="13" height="12" rx="2" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.5" />
              <rect x="106" y="128" width="13" height="12" rx="2" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.5" />
            </g>
          ) : outfit === 'outfit_pe_jersey' ? (
            <g>
              <rect x="54" y="125" width="72" height="8" fill="#FFFFFF" />
              <path d="M75 106 Q90 118 105 106" stroke="#FACC15" strokeWidth="3.5" fill="none" />
              <text x="90" y="150" textAnchor="middle" fill="#FACC15" fontSize="14" fontWeight="900" fontFamily="Outfit, sans-serif">
                01
              </text>
            </g>
          ) : outfit === 'outfit_raincoat' ? (
            <g>
              <path d="M72 106 L90 118 L108 106" fill="#EA7A26" stroke={stroke} strokeWidth="2.4" />
              <line x1="90" y1="118" x2="90" y2="158" stroke="#B45309" strokeWidth="2.5" />
              <circle cx="90" cy="127" r="2.8" fill="#EA7A26" />
              <circle cx="90" cy="139" r="2.8" fill="#EA7A26" />
              <circle cx="90" cy="150" r="2.8" fill="#EA7A26" />
            </g>
          ) : outfit === 'outfit_science_lab' ? (
            <g>
              <path d="M76 106 L90 128 L104 106 Z" fill="#0EA5E9" stroke={stroke} strokeWidth="2" />
              <line x1="90" y1="128" x2="90" y2="158" stroke="#CBD5E1" strokeWidth="2.2" />
              <rect x="63" y="131" width="14" height="15" rx="2" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
              <line x1="67" y1="126" x2="67" y2="133" stroke="#1E5B3A" strokeWidth="2.6" strokeLinecap="round" />
              <line x1="72" y1="125" x2="72" y2="133" stroke="#EA7A26" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          ) : outfit === 'outfit_chef_apron' ? (
            <g>
              <rect x="66" y="114" width="48" height="44" rx="5" fill="#FEF2F2" stroke="#EF4444" strokeWidth="2.2" />
              <line x1="78" y1="114" x2="78" y2="158" stroke="#FCA5A5" strokeWidth="2.2" />
              <line x1="90" y1="114" x2="90" y2="158" stroke="#FCA5A5" strokeWidth="2.2" />
              <line x1="102" y1="114" x2="102" y2="158" stroke="#FCA5A5" strokeWidth="2.2" />
              <rect x="75" y="132" width="30" height="14" rx="3" fill="#EF4444" />
            </g>
          ) : outfit === 'outfit_grad_toga' ? (
            <g>
              <path d="M73 106 L82 158 L70 158 L64 108 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
              <path d="M107 106 L98 158 L110 158 L116 108 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
              <line x1="90" y1="110" x2="90" y2="158" stroke="#0F4C2B" strokeWidth="2.5" />
            </g>
          ) : outfit === 'outfit_cyber_suit' ? (
            <g>
              <path d="M72 106 L90 120 L108 106" fill="#0F172A" stroke="#10B981" strokeWidth="2.4" />
              <line x1="65" y1="126" x2="80" y2="126" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="100" y1="126" x2="115" y2="126" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="90" cy="137" r="7" fill="#0F172A" stroke="#10B981" strokeWidth="2.4" />
              <circle cx="90" cy="137" r="3" fill="#34D399" />
            </g>
          ) : outfit === 'outfit_scholar_cape' ? (
            <g>
              <path d="M62 108 Q90 120 118 108" stroke="#FACC15" strokeWidth="4.5" fill="none" strokeLinecap="round" />
              <circle cx="67" cy="111" r="4.5" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
              <circle cx="113" cy="111" r="4.5" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
              <path d="M90 125 L93 132 L100 132 L94 136 L96 143 L90 139 L84 143 L86 136 L80 132 L87 132 Z" fill="#FACC15" />
            </g>
          ) : (
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
      <ellipse cx="64" cy="84" rx="7" ry="4.5" fill={cheek} fillOpacity={mood === 'blushing' || mood === 'excited' || mood === 'sick' ? '0.88' : '0.7'} />
      <ellipse cx="116" cy="84" rx="7" ry="4.5" fill={cheek} fillOpacity={mood === 'blushing' || mood === 'excited' || mood === 'sick' ? '0.88' : '0.7'} />

      {/* Dirt smudges when cleanliness < 45% */}
      {isDirty && (
        <g fill="#78553A" fillOpacity="0.45">
          <ellipse cx="59" cy="64" rx="6" ry="3.5" transform="rotate(-15 59 64)" />
          <ellipse cx="119" cy="95" rx="7" ry="4" transform="rotate(12 119 95)" />
          <circle cx="75" cy="138" r="4" />
        </g>
      )}

      {/* Eyes */}
      {isSleeping || mood === 'sleepy' ? (
        <g stroke={stroke} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M67 74 Q73 79 79 74" />
          <path d="M101 74 Q107 79 113 74" />
        </g>
      ) : mood === 'sick' ? (
        <g stroke={stroke} strokeWidth="2.8" strokeLinecap="round" fill="none">
          <path d="M67 70 L78 78 M78 70 L67 78" />
          <path d="M102 70 L113 78 M113 70 L102 78" />
          {/* Fever sweat drop */}
          <path d="M119 56 Q124 63 119 67 Q114 63 119 56 Z" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
        </g>
      ) : mood === 'blushing' || mood === 'excited' || mood === 'showering' ? (
        <g stroke={stroke} strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M67 75 Q73 67 79 75" />
          <path d="M101 75 Q107 67 113 75" />
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
        <g>
          <path d="M83 80 L97 80 L90 90 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
          {mood === 'eating' && (
            <ellipse cx="90" cy="87" rx="5" ry="4" fill="#991B1B" stroke={stroke} strokeWidth="1.8" />
          )}
        </g>
      ) : (
        <g>
          <ellipse cx="90" cy="81" rx="4.5" ry="3.2" fill={species === 'dog' ? '#3B281E' : '#E77B72'} />
          {mood === 'eating' ? (
            <ellipse cx="90" cy="91" rx="7" ry="6" fill="#B91C1C" stroke={stroke} strokeWidth="2.4" />
          ) : mood === 'concerned' || mood === 'sick' ? (
            <path d="M83 92 Q86.5 87 90 90 Q93.5 87 97 92" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M83 87 Q86.5 92 90 87 Q93.5 92 97 87" stroke={stroke} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          )}
        </g>
      )}

      {/* Fever Thermometer when Sick */}
      {mood === 'sick' && (
        <g transform="translate(96, 89) rotate(-18)">
          <rect x="0" y="0" width="22" height="5" rx="2.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.8" />
          <circle cx="2" cy="2.5" r="3" fill="#EF4444" stroke={stroke} strokeWidth="1.4" />
          <line x1="6" y1="2.5" x2="17" y2="2.5" stroke="#EF4444" strokeWidth="1.8" />
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

      {accessory === 'acc_sunglasses' && (
        <g>
          <path d="M60 67 L84 67 L82 81 C81 84 63 84 62 81 Z" fill="#111827" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M96 67 L120 67 L118 81 C117 84 99 84 98 81 Z" fill="#111827" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
          <line x1="84" y1="69" x2="96" y2="69" stroke={stroke} strokeWidth="2.8" />
          <line x1="65" y1="70" x2="70" y2="77" stroke="#FFFFFF" strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />
          <line x1="101" y1="70" x2="106" y2="77" stroke="#FFFFFF" strokeWidth="1.8" opacity="0.6" strokeLinecap="round" />
        </g>
      )}

      {accessory === 'acc_academy_cap' && (
        <g>
          <path d="M58 49 C62 32 118 32 122 49 Z" fill="#1E5B3A" stroke={stroke} strokeWidth="3" />
          <path d="M55 49 Q90 42 132 51 Q112 56 55 49 Z" fill="#17422B" stroke={stroke} strokeWidth="2.5" />
          <circle cx="90" cy="40" r="4" fill="#EA7A26" stroke={stroke} strokeWidth="1.5" />
        </g>
      )}

      {accessory === 'acc_headphones' && (
        <g>
          <path d="M47 72 C47 34 133 34 133 72" stroke="#1E5B3A" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          <rect x="40" y="65" width="11" height="22" rx="5" fill="#EA7A26" stroke={stroke} strokeWidth="2.4" />
          <rect x="129" y="65" width="11" height="22" rx="5" fill="#EA7A26" stroke={stroke} strokeWidth="2.4" />
        </g>
      )}

      {accessory === 'acc_crown' && (
        <g>
          <path d="M68 45 L66 23 L80 34 L90 17 L100 34 L114 23 L112 45 Z" fill="#FACC15" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx="90" cy="36" r="3.8" fill="#10B981" stroke={stroke} strokeWidth="1.4" />
        </g>
      )}

      {accessory === 'acc_flower_clip' && (
        <g transform="translate(120, 48)">
          <circle cx="0" cy="-6" r="4.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.5" />
          <circle cx="6" cy="-1" r="4.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.5" />
          <circle cx="4" cy="6" r="4.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.5" />
          <circle cx="-4" cy="6" r="4.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.5" />
          <circle cx="-6" cy="-1" r="4.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.5" />
          <circle cx="0" cy="1" r="3.8" fill="#FACC15" stroke={stroke} strokeWidth="1.4" />
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

      {accessory === 'acc_study_visor' && (
        <g>
          <path d="M56 51 C56 44 124 44 124 51" stroke={stroke} strokeWidth="3.2" fill="none" />
          <path d="M55 51 Q90 43 130 55 Q110 64 55 51 Z" fill="#10B981" fillOpacity="0.72" stroke={stroke} strokeWidth="2.4" />
        </g>
      )}

      {accessory === 'acc_gold_medal' && (
        <g>
          <path d="M77 104 L90 120 L103 104" stroke="#1E5B3A" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="90" cy="123" r="8" fill="#FACC15" stroke={stroke} strokeWidth="2.2" />
          <path d="M90 118 L92 122 L96 122 L93 124.5 L94 128 L90 126 L86 128 L87 124.5 L84 122 L88 122 Z" fill="#EA7A26" />
        </g>
      )}

      {accessory === 'acc_cat_ears' && (
        <g>
          <path d="M58 46 Q90 32 122 46" stroke="#F59E0B" strokeWidth="3.5" fill="none" />
          <path d="M72 34 L75 26 L82 26 L77 21 L79 14 L72 18 L65 14 L67 21 L62 26 L69 26 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.6" />
          <path d="M108 34 L111 26 L118 26 L113 21 L115 14 L108 18 L101 14 L103 21 L98 26 L105 26 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.6" />
        </g>
      )}

      {accessory === 'acc_halo' && (
        <ellipse cx="90" cy="24" rx="22" ry="6" stroke="#FACC15" strokeWidth="4.5" fill="none" />
      )}

      {accessory === 'acc_grad_cap' && (
        <g>
          <rect x="72" y="38" width="36" height="9" rx="2" fill="#172A1E" stroke={stroke} strokeWidth="2.2" />
          <path d="M56 36 L90 23 L124 36 L90 47 Z" fill="#1E5B3A" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
          <line x1="118" y1="36" x2="122" y2="54" stroke="#FACC15" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="122" cy="55" r="3" fill="#FACC15" />
        </g>
      )}

      {/* Bath Time Foam Suds */}
      {(foamLevel > 0 || mood === 'soapy') && (
        <g>
          <circle cx="66" cy="54" r="10" fill="#FFFFFF" fillOpacity="0.92" stroke="#BAE6FD" strokeWidth="1.8" />
          <circle cx="80" cy="48" r="11" fill="#FFFFFF" fillOpacity="0.92" stroke="#BAE6FD" strokeWidth="1.8" />
          <circle cx="105" cy="50" r="10" fill="#FFFFFF" fillOpacity="0.92" stroke="#BAE6FD" strokeWidth="1.8" />
          {(foamLevel >= 40 || mood === 'soapy') && (
            <>
              <circle cx="68" cy="118" r="11" fill="#FFFFFF" fillOpacity="0.9" stroke="#BAE6FD" strokeWidth="1.8" />
              <circle cx="110" cy="122" r="10" fill="#FFFFFF" fillOpacity="0.9" stroke="#BAE6FD" strokeWidth="1.8" />
              <circle cx="90" cy="132" r="12" fill="#FFFFFF" fillOpacity="0.9" stroke="#BAE6FD" strokeWidth="1.8" />
            </>
          )}
          {foamLevel >= 70 && (
            <>
              <circle cx="52" cy="86" r="8" fill="#E0F2FE" fillOpacity="0.9" stroke="#38BDF8" strokeWidth="1.6" />
              <circle cx="128" cy="84" r="9" fill="#E0F2FE" fillOpacity="0.9" stroke="#38BDF8" strokeWidth="1.6" />
            </>
          )}
        </g>
      )}

      {/* Shower Water Stream */}
      {mood === 'showering' && (
        <g stroke="#38BDF8" strokeWidth="2.6" strokeLinecap="round" opacity="0.85">
          <line x1="62" y1="22" x2="58" y2="40" />
          <line x1="76" y1="18" x2="72" y2="38" />
          <line x1="90" y1="16" x2="90" y2="36" />
          <line x1="104" y1="18" x2="108" y2="38" />
          <line x1="118" y1="22" x2="122" y2="40" />
          <circle cx="64" cy="96" r="2.2" fill="#38BDF8" />
          <circle cx="115" cy="102" r="2.2" fill="#38BDF8" />
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
