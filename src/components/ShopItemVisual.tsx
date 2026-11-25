import React from 'react';

interface ShopItemVisualProps {
  itemId: string;
  size?: number;
  className?: string;
}

export const ShopItemVisual: React.FC<ShopItemVisualProps> = ({
  itemId,
  size = 64,
  className = '',
}) => {
  const stroke = '#2C2A24';

  const renderGraphic = () => {
    switch (itemId) {
      // --- FOODS ---
      case 'food_pandesal':
        return (
          <g>
            <ellipse cx="40" cy="56" rx="22" ry="6" fill="#172A1E" fillOpacity="0.1" />
            <path
              d="M18 44 C18 28 30 22 42 23 C55 24 63 32 62 44 C61 52 52 55 40 55 C27 55 18 51 18 44 Z"
              fill="#E7A95A"
              stroke={stroke}
              strokeWidth="2.8"
            />
            <path
              d="M24 37 C28 29 48 28 55 36"
              stroke="#B45309"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="32" cy="40" r="1.4" fill="#FDE68A" />
            <circle cx="44" cy="36" r="1.4" fill="#FDE68A" />
            <circle cx="50" cy="43" r="1.4" fill="#FDE68A" />
          </g>
        );

      case 'food_banana_cue':
        return (
          <g>
            <line x1="16" y1="62" x2="62" y2="16" stroke="#92400E" strokeWidth="3.5" strokeLinecap="round" />
            <ellipse cx="32" cy="46" rx="11" ry="8" transform="rotate(-45 32 46)" fill="#D97706" stroke={stroke} strokeWidth="2.6" />
            <ellipse cx="45" cy="33" rx="11" ry="8" transform="rotate(-45 45 33)" fill="#F59E0B" stroke={stroke} strokeWidth="2.6" />
            <path d="M29 43 L34 39 M42 30 L47 26" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" />
            <circle cx="55" cy="23" r="2.2" fill="#FDE047" />
          </g>
        );

      case 'food_milo_cup':
        return (
          <g>
            <path d="M46 12 L52 12 L46 28" stroke="#EA7A26" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M24 27 L56 27 L51 62 C50 64 30 64 29 62 Z" fill="#6D3B1A" stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" />
            <rect x="21" y="23" width="38" height="6" rx="3" fill="#FFFFFF" stroke={stroke} strokeWidth="2.4" />
            <path d="M28 36 Q40 42 52 36 L50 51 Q40 55 30 51 Z" fill="#1E5B3A" />
            <rect x="33" y="29" width="7" height="7" rx="1.5" fill="#F3E8D2" opacity="0.85" />
            <rect x="43" y="31" width="6" height="6" rx="1.5" fill="#F3E8D2" opacity="0.85" />
          </g>
        );

      case 'food_bento':
        return (
          <g>
            <rect x="14" y="22" width="52" height="38" rx="9" fill="#1E5B3A" stroke={stroke} strokeWidth="2.8" />
            <rect x="18" y="26" width="44" height="30" rx="6" fill="#FFFBEB" />
            <line x1="40" y1="26" x2="40" y2="56" stroke="#1E5B3A" strokeWidth="2.5" />
            <ellipse cx="29" cy="41" rx="8" ry="10" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1.5" />
            <circle cx="29" cy="39" r="1.5" fill="#111827" />
            <rect x="25" y="45" width="8" height="4" rx="1" fill="#1F2937" />
            <circle cx="50" cy="35" r="5.5" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1.2" />
            <circle cx="50" cy="35" r="2.8" fill="#F59E0B" />
            <circle cx="47" cy="48" r="4.5" fill="#22C55E" />
            <circle cx="55" cy="48" r="4.5" fill="#EA7A26" />
          </g>
        );

      case 'food_halo_halo':
        return (
          <g>
            <path d="M50 11 L56 11 L47 32" stroke="#EC4899" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M25 32 L55 32 L49 58 L31 58 Z" fill="#FDE68A" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <rect x="36" y="58" width="8" height="6" fill="#E5E7EB" stroke={stroke} strokeWidth="2" />
            <ellipse cx="40" cy="64" rx="13" ry="3.5" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
            <path d="M26 32 C26 20 54 20 54 32 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="2.4" />
            <circle cx="38" cy="24" r="6.5" fill="#9333EA" stroke={stroke} strokeWidth="2" />
            <rect x="42" y="24" width="9" height="5.5" rx="1.5" fill="#FBBF24" stroke={stroke} strokeWidth="1.8" />
            <circle cx="35" cy="46" r="3" fill="#EF4444" />
            <circle cx="44" cy="49" r="3" fill="#22C55E" />
            <circle cx="40" cy="41" r="2.5" fill="#9333EA" />
          </g>
        );

      case 'food_golden_donut':
        return (
          <g>
            <circle cx="40" cy="40" r="22" fill="#E7A95A" stroke={stroke} strokeWidth="2.8" />
            <path
              d="M19 37 C21 23 31 18 40 18 C50 18 59 24 61 37 C58 41 53 38 49 41 C45 44 37 42 32 41 C27 40 22 42 19 37 Z"
              fill="#F59E0B"
              stroke={stroke}
              strokeWidth="2.2"
            />
            <circle cx="40" cy="40" r="7.5" fill="#FAF8F2" stroke={stroke} strokeWidth="2.4" />
            <line x1="28" y1="27" x2="32" y2="25" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="47" y1="24" x2="51" y2="27" stroke="#1E5B3A" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="52" y1="34" x2="56" y2="32" stroke="#EC4899" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="25" y1="34" x2="28" y2="36" stroke="#FEF08A" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );

      case 'food_cracker':
        return (
          <g>
            <rect x="20" y="20" width="40" height="40" rx="7" fill="#FDE68A" stroke={stroke} strokeWidth="2.6" />
            <circle cx="31" cy="31" r="2" fill="#B45309" />
            <circle cx="49" cy="31" r="2" fill="#B45309" />
            <circle cx="40" cy="40" r="2" fill="#B45309" />
            <circle cx="31" cy="49" r="2" fill="#B45309" />
            <circle cx="49" cy="49" r="2" fill="#B45309" />
          </g>
        );

      case 'food_calamansi':
        return (
          <g>
            <path d="M47 11 L54 11 L46 27" stroke="#1E5B3A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M25 26 L55 26 L50 61 C49 63 31 63 30 61 Z" fill="#D9F99D" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M28 36 L52 36 L49 58 L31 58 Z" fill="#A3E635" />
            <circle cx="31" cy="24" r="9" fill="#65A30D" stroke={stroke} strokeWidth="2.2" />
            <circle cx="31" cy="24" r="5" fill="#BEF264" />
            <rect x="35" y="38" width="7" height="7" rx="1.5" fill="#FFFFFF" opacity="0.8" />
            <rect x="42" y="45" width="6" height="6" rx="1.5" fill="#FFFFFF" opacity="0.8" />
          </g>
        );

      case 'food_medicine':
        return (
          <g>
            <rect x="33" y="14" width="14" height="8" rx="2" fill="#EA7A26" stroke={stroke} strokeWidth="2.4" />
            <path d="M35 22 L45 22 L53 34 L53 59 C53 62 49 64 40 64 C31 64 27 62 27 59 L27 34 Z" fill="#ECFDF5" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M29 42 L51 42 L51 58 C51 60 46 62 40 62 C34 62 29 60 29 58 Z" fill="#10B981" />
            <rect x="38" y="45" width="4" height="12" rx="1" fill="#FFFFFF" />
            <rect x="34" y="49" width="12" height="4" rx="1" fill="#FFFFFF" />
          </g>
        );

      case 'food_taho':
        return (
          <g>
            <path d="M24 27 L56 27 L51 61 C50 63 30 63 29 61 Z" fill="#FFFBEB" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M26 31 Q40 36 54 31 L52 44 Q40 48 28 44 Z" fill="#92400E" />
            <circle cx="34" cy="52" r="3" fill="#451A03" />
            <circle cx="42" cy="54" r="3" fill="#451A03" />
            <circle cx="47" cy="49" r="2.8" fill="#451A03" />
            <path d="M24 27 Q40 21 56 27" fill="#FEF3C7" stroke={stroke} strokeWidth="2.2" />
            <line x1="48" y1="14" x2="43" y2="27" stroke="#EA7A26" strokeWidth="3" strokeLinecap="round" />
          </g>
        );

      case 'food_buko_juice':
        return (
          <g>
            <path d="M47 11 L54 11 L45 28" stroke="#EA7A26" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="40" cy="44" r="21" fill="#15803D" stroke={stroke} strokeWidth="2.6" />
            <ellipse cx="40" cy="30" rx="14" ry="5.5" fill="#ECFDF5" stroke={stroke} strokeWidth="2.2" />
            <ellipse cx="40" cy="30" rx="10" ry="3.2" fill="#D1FAE5" />
          </g>
        );

      case 'food_siopao':
        return (
          <g>
            <ellipse cx="40" cy="56" rx="22" ry="6" fill="#172A1E" fillOpacity="0.1" />
            <path d="M18 46 C18 26 29 20 40 20 C51 20 62 26 62 46 C62 53 52 56 40 56 C28 56 18 53 18 46 Z" fill="#FFFDF8" stroke={stroke} strokeWidth="2.6" />
            <path d="M35 21 L40 28 L45 21" stroke="#D1D5DB" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <circle cx="40" cy="34" r="3.2" fill="#EF4444" />
          </g>
        );

      case 'food_mango_shake':
        return (
          <g>
            <path d="M48 11 L55 11 L46 27" stroke="#1E5B3A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M24 27 L56 27 L50 61 C49 63 31 63 30 61 Z" fill="#FACC15" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M25 27 C27 18 53 18 55 27 Z" fill="#FFFBEB" stroke={stroke} strokeWidth="2.2" />
            <rect x="33" y="21" width="7" height="7" rx="1.5" fill="#F59E0B" />
            <rect x="41" y="23" width="6" height="6" rx="1.5" fill="#EA7A26" />
          </g>
        );

      case 'food_matcha_latte':
        return (
          <g>
            <path d="M47 11 L54 11 L46 27" stroke="#2C2A24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M25 26 L55 26 L50 61 C49 63 31 63 30 61 Z" fill="#22C55E" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M27 32 Q40 36 53 32 L52 42 Q40 45 28 42 Z" fill="#FFFFFF" fillOpacity="0.85" />
            <rect x="22" y="22" width="36" height="5" rx="2.5" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <rect x="35" y="31" width="6" height="6" rx="1.2" fill="#ECFDF5" />
          </g>
        );

      case 'food_spaghetti':
        return (
          <g>
            <ellipse cx="40" cy="52" rx="26" ry="12" fill="#FFFFFF" stroke={stroke} strokeWidth="2.6" />
            <path d="M20 47 Q40 25 60 47 Z" fill="#FBBF24" stroke={stroke} strokeWidth="2.2" />
            <path d="M25 43 Q40 28 55 43" fill="#EF4444" stroke="#B91C1C" strokeWidth="2" />
            <circle cx="35" cy="39" r="3.5" fill="#991B1B" />
            <circle cx="45" cy="40" r="3.5" fill="#991B1B" />
            <circle cx="40" cy="34" r="3" fill="#FEF08A" />
          </g>
        );

      case 'food_turon':
        return (
          <g>
            <ellipse cx="40" cy="57" rx="22" ry="5.5" fill="#172A1E" fillOpacity="0.1" />
            <rect x="17" y="34" width="42" height="16" rx="7" transform="rotate(-14 38 42)" fill="#D97706" stroke={stroke} strokeWidth="2.6" />
            <rect x="22" y="25" width="40" height="15" rx="7" transform="rotate(8 42 32)" fill="#F59E0B" stroke={stroke} strokeWidth="2.6" />
            <path d="M25 32 Q42 36 56 30" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <circle cx="33" cy="29" r="1.6" fill="#FEF08A" />
            <circle cx="47" cy="34" r="1.6" fill="#FEF08A" />
          </g>
        );

      case 'food_boba_tea':
        return (
          <g>
            <path d="M47 10 L54 10 L46 27" stroke="#2C2A24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M25 26 L55 26 L50 61 C49 63 31 63 30 61 Z" fill="#E7C9A9" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M27 36 Q40 42 53 36 L51 54 Q40 58 29 54 Z" fill="#C68B59" />
            <rect x="22" y="22" width="36" height="5" rx="2.5" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <circle cx="34" cy="56" r="2.8" fill="#451A03" />
            <circle cx="40" cy="57" r="2.8" fill="#451A03" />
            <circle cx="46" cy="55" r="2.8" fill="#451A03" />
            <circle cx="37" cy="51" r="2.5" fill="#451A03" />
            <circle cx="44" cy="50" r="2.5" fill="#451A03" />
          </g>
        );

      case 'food_sisig_rice':
        return (
          <g>
            <ellipse cx="40" cy="48" rx="26" ry="14" fill="#1F2937" stroke={stroke} strokeWidth="2.6" />
            <ellipse cx="40" cy="46" rx="21" ry="10" fill="#92400E" />
            <circle cx="33" cy="44" r="6" fill="#FFFDF8" stroke="#E5E7EB" strokeWidth="1.2" />
            <circle cx="33" cy="44" r="2.8" fill="#FACC15" />
            <circle cx="46" cy="45" r="4.5" fill="#D97706" />
            <circle cx="43" cy="39" r="3" fill="#22C55E" />
            <circle cx="51" cy="41" r="2.5" fill="#EF4444" />
          </g>
        );

      case 'food_ube_cake':
        return (
          <g>
            <ellipse cx="40" cy="58" rx="24" ry="6" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <path d="M20 48 L60 48 L54 27 L24 35 Z" fill="#9333EA" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M24 35 L54 27 L52 22 L24 30 Z" fill="#FACC15" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
            <line x1="22" y1="42" x2="57" y2="39" stroke="#F3E8FF" strokeWidth="2.4" />
            <circle cx="40" cy="23" r="3.5" fill="#C084FC" stroke={stroke} strokeWidth="1.4" />
          </g>
        );

      case 'food_ramen_bowl':
        return (
          <g>
            <path d="M16 38 L64 38 C62 56 52 62 40 62 C28 62 18 56 16 38 Z" fill="#DC2626" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <ellipse cx="40" cy="38" rx="24" ry="7" fill="#FDE68A" stroke={stroke} strokeWidth="2.2" />
            <path d="M26 38 Q33 32 40 38 Q47 32 54 38" stroke="#F59E0B" strokeWidth="2.4" fill="none" />
            <circle cx="32" cy="36" r="4.5" fill="#FFFFFF" stroke={stroke} strokeWidth="1.4" />
            <circle cx="32" cy="36" r="2.2" fill="#F59E0B" />
            <rect x="46" y="30" width="9" height="8" rx="1.5" fill="#1F2937" />
            <line x1="48" y1="16" x2="58" y2="30" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="53" y1="15" x2="62" y2="29" stroke="#78350F" strokeWidth="2.8" strokeLinecap="round" />
          </g>
        );

      case 'food_galaxy_sundae':
        return (
          <g>
            <path d="M25 36 L55 36 L48 59 L32 59 Z" fill="#312E81" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
            <ellipse cx="40" cy="62" rx="13" ry="3.5" fill="#E0E7FF" stroke={stroke} strokeWidth="2" />
            <circle cx="34" cy="31" r="8" fill="#818CF8" stroke={stroke} strokeWidth="2.2" />
            <circle cx="46" cy="31" r="8" fill="#C084FC" stroke={stroke} strokeWidth="2.2" />
            <circle cx="40" cy="24" r="8.5" fill="#38BDF8" stroke={stroke} strokeWidth="2.2" />
            <path d="M40 12 L42 16 L46 16 L43 18.5 L44 22 L40 20 L36 22 L37 18.5 L34 16 L38 16 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.2" />
          </g>
        );

      case 'tool_soap':
        return (
          <g>
            <rect x="17" y="28" width="46" height="28" rx="12" fill="#F9A8D4" stroke={stroke} strokeWidth="2.6" />
            <rect x="23" y="34" width="34" height="16" rx="8" fill="#FBCFE8" />
            <circle cx="24" cy="24" r="6" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.8" />
            <circle cx="56" cy="23" r="4.5" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.8" />
            <circle cx="62" cy="54" r="5" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.8" />
          </g>
        );

      case 'tool_shower':
        return (
          <g>
            <path d="M20 56 C20 34 32 22 46 22" stroke="#64748B" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M44 16 L60 28 L52 38 L36 26 Z" fill="#94A3B8" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="40" y1="36" x2="34" y2="48" stroke="#0EA5E9" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="47" y1="40" x2="43" y2="54" stroke="#0EA5E9" strokeWidth="2.6" strokeLinecap="round" />
            <line x1="54" y1="42" x2="52" y2="56" stroke="#38BDF8" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        );

      // --- CLOTHES ---
      case 'outfit_sla_polo':
        return (
          <g>
            <path d="M22 23 L32 18 L40 25 L48 18 L58 23 L65 36 L57 41 L54 34 L54 61 L26 61 L26 34 L23 41 L15 36 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M32 18 L40 27 L48 18" fill="#1E5B3A" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M37 26 L43 26 L41.5 39 L38.5 39 Z" fill="#1E5B3A" />
            <circle cx="48" cy="38" r="3.5" fill="#EA7A26" />
          </g>
        );

      case 'outfit_sla_hoodie':
        return (
          <g>
            <path d="M28 18 C32 12 48 12 52 18 L64 34 L56 42 L53 35 L53 62 L27 62 L27 35 L24 42 L16 34 Z" fill="#2E7D32" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <ellipse cx="40" cy="21" rx="9" ry="5" fill="#17422B" stroke={stroke} strokeWidth="2" />
            <line x1="36" y1="25" x2="36" y2="38" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="44" y1="25" x2="44" y2="38" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
            <rect x="31" y="45" width="18" height="11" rx="4" fill="#1E5B3A" stroke={stroke} strokeWidth="1.8" />
            <circle cx="49" cy="34" r="3.2" fill="#F59E0B" />
          </g>
        );

      case 'outfit_pe_jersey':
        return (
          <g>
            <path d="M25 18 L34 18 C36 24 44 24 46 18 L55 18 L57 62 L23 62 Z" fill="#16A34A" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M34 18 C36 24 44 24 46 18" fill="none" stroke="#FACC15" strokeWidth="3" />
            <rect x="24" y="34" width="32" height="6" fill="#FFFFFF" />
            <text x="40" y="54" textAnchor="middle" fill="#FACC15" fontSize="14" fontWeight="900" fontFamily="Outfit, sans-serif">
              01
            </text>
          </g>
        );

      case 'outfit_orange_varsity':
        return (
          <g>
            <path d="M23 21 L33 18 L40 24 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M23 21 L15 37 L23 42 L26 35 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
            <path d="M57 21 L65 37 L57 42 L54 35 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
            <line x1="40" y1="24" x2="40" y2="61" stroke="#FFFFFF" strokeWidth="2.4" />
            <rect x="26" y="56" width="28" height="5" fill="#1E5B3A" />
            <circle cx="48" cy="35" r="3.5" fill="#1E5B3A" />
          </g>
        );

      case 'outfit_denim_jacket':
        return (
          <g>
            <path d="M23 21 L33 18 L40 25 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#2563EB" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M35 23 L45 23 L45 61 L35 61 Z" fill="#FFFFFF" />
            <path d="M31 18 L36 29 L40 25 L44 29 L49 18" fill="#1D4ED8" stroke={stroke} strokeWidth="2" />
            <rect x="28" y="37" width="6" height="7" rx="1" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.2" />
            <rect x="46" y="37" width="6" height="7" rx="1" fill="#1D4ED8" stroke="#93C5FD" strokeWidth="1.2" />
          </g>
        );

      case 'outfit_teacher_blazer':
        return (
          <g>
            <path d="M23 21 L33 18 L40 28 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#17422B" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M33 18 L40 38 L47 18 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="1.8" />
            <path d="M38 24 L42 24 L42.5 42 L40 46 L37.5 42 Z" fill="#EA7A26" stroke={stroke} strokeWidth="1.4" />
            <circle cx="48" cy="38" r="3" fill="#F59E0B" />
          </g>
        );

      case 'outfit_scholar_cape':
        return (
          <g>
            <path d="M24 22 L56 22 L66 60 L14 60 Z" fill="#0F4C2B" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M28 22 L52 22 L55 60 L25 60 Z" fill="#1E5B3A" />
            <path d="M24 22 Q40 31 56 22" stroke="#F59E0B" strokeWidth="4" fill="none" />
            <circle cx="30" cy="25" r="3.5" fill="#FACC15" stroke={stroke} strokeWidth="1.6" />
            <circle cx="50" cy="25" r="3.5" fill="#FACC15" stroke={stroke} strokeWidth="1.6" />
            <path d="M40 34 L43 41 L50 41 L44 45 L46 52 L40 48 L34 52 L36 45 L30 41 L37 41 Z" fill="#FACC15" />
          </g>
        );

      case 'outfit_raincoat':
        return (
          <g>
            <path d="M23 21 L33 18 L40 24 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#FACC15" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M33 18 L40 27 L47 18" fill="#EA7A26" stroke={stroke} strokeWidth="2" />
            <line x1="40" y1="27" x2="40" y2="61" stroke="#B45309" strokeWidth="2.2" />
            <circle cx="40" cy="35" r="2.5" fill="#EA7A26" />
            <circle cx="40" cy="45" r="2.5" fill="#EA7A26" />
            <circle cx="40" cy="54" r="2.5" fill="#EA7A26" />
          </g>
        );

      case 'outfit_science_lab':
        return (
          <g>
            <path d="M23 21 L33 18 L40 28 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#F8FAFC" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M33 18 L40 36 L47 18 Z" fill="#0EA5E9" stroke={stroke} strokeWidth="1.8" />
            <line x1="40" y1="36" x2="40" y2="61" stroke="#CBD5E1" strokeWidth="2" />
            <rect x="44" y="40" width="8" height="10" rx="1.5" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.4" />
            <line x1="47" y1="36" x2="47" y2="41" stroke="#1E5B3A" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );

      case 'outfit_chef_apron':
        return (
          <g>
            <path d="M28 18 L34 18 L35 28 L45 28 L46 18 L52 18 L55 34 L55 61 L25 61 L25 34 Z" fill="#FFFFFF" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <line x1="33" y1="28" x2="33" y2="61" stroke="#FCA5A5" strokeWidth="2.5" />
            <line x1="40" y1="28" x2="40" y2="61" stroke="#FCA5A5" strokeWidth="2.5" />
            <line x1="47" y1="28" x2="47" y2="61" stroke="#FCA5A5" strokeWidth="2.5" />
            <rect x="30" y="42" width="20" height="11" rx="2.5" fill="#EF4444" stroke={stroke} strokeWidth="1.5" />
          </g>
        );

      case 'outfit_grad_toga':
        return (
          <g>
            <path d="M23 21 L33 18 L40 25 L47 18 L57 21 L65 37 L57 42 L54 35 L55 61 L25 61 L26 35 L23 42 L15 37 Z" fill="#1E5B3A" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M32 19 L36 61 L29 61 L27 21 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.4" />
            <path d="M48 19 L44 61 L51 61 L53 21 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.4" />
          </g>
        );

      case 'outfit_cyber_suit':
        return (
          <g>
            <path d="M23 21 L33 18 L40 26 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#1E293B" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M32 18 L40 28 L48 18" fill="#0F172A" stroke="#10B981" strokeWidth="2.2" />
            <circle cx="40" cy="44" r="6" fill="#0F172A" stroke="#10B981" strokeWidth="2.2" />
            <circle cx="40" cy="44" r="2.5" fill="#34D399" />
          </g>
        );

      case 'outfit_arcade_hoodie':
        return (
          <g>
            <path d="M28 18 C32 12 48 12 52 18 L64 34 L56 42 L53 35 L53 62 L27 62 L27 35 L24 42 L16 34 Z" fill="#7C3AED" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <ellipse cx="40" cy="21" rx="9" ry="5" fill="#4C1D95" stroke={stroke} strokeWidth="2" />
            <rect x="34" y="34" width="12" height="10" rx="2" fill="#2E1065" stroke="#38BDF8" strokeWidth="1.6" />
            <circle cx="38" cy="39" r="1.8" fill="#F472B6" />
            <circle cx="42" cy="39" r="1.8" fill="#F472B6" />
          </g>
        );

      case 'outfit_astronaut':
        return (
          <g>
            <path d="M23 21 L33 18 L40 25 L47 18 L57 21 L65 37 L57 42 L54 35 L54 61 L26 61 L26 35 L23 42 L15 37 Z" fill="#F8FAFC" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <rect x="26" y="45" width="28" height="6" fill="#EA7A26" />
            <rect x="33" y="29" width="14" height="11" rx="2" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.8" />
            <circle cx="49" cy="33" r="3" fill="#38BDF8" />
          </g>
        );

      case 'outfit_wizard_robe':
        return (
          <g>
            <path d="M23 21 L33 18 L40 26 L47 18 L57 21 L66 40 L57 44 L54 35 L56 62 L24 62 L26 35 L23 44 L14 40 Z" fill="#3730A3" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M32 18 L40 29 L48 18" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
            <path d="M40 36 L42.5 41 L48 41 L43.5 44.5 L45 50 L40 46.5 L35 50 L36.5 44.5 L32 41 L37.5 41 Z" fill="#FACC15" />
          </g>
        );

      // --- ACCESSORIES ---
      case 'acc_orange_bandana':
        return (
          <g>
            <path d="M16 26 Q40 38 64 26 L40 58 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2.8" strokeLinejoin="round" />
            <circle cx="40" cy="37" r="3.5" fill="#FFFBEB" />
          </g>
        );

      case 'acc_academy_cap':
        return (
          <g>
            <path d="M18 46 C20 24 58 24 60 46 Z" fill="#1E5B3A" stroke={stroke} strokeWidth="2.8" />
            <path d="M16 46 Q42 39 70 49 Q52 54 16 46 Z" fill="#17422B" stroke={stroke} strokeWidth="2.4" />
            <circle cx="40" cy="34" r="4.5" fill="#EA7A26" stroke={stroke} strokeWidth="1.8" />
          </g>
        );

      case 'acc_green_scarf':
        return (
          <g>
            <rect x="17" y="24" width="46" height="13" rx="6.5" fill="#1E5B3A" stroke={stroke} strokeWidth="2.6" />
            <rect x="44" y="33" width="13" height="27" rx="4" fill="#2E7D32" stroke={stroke} strokeWidth="2.6" />
            <line x1="46" y1="45" x2="55" y2="45" stroke="#F59E0B" strokeWidth="3.5" />
            <line x1="46" y1="53" x2="55" y2="53" stroke="#F59E0B" strokeWidth="3.5" />
          </g>
        );

      case 'acc_flower_clip':
        return (
          <g>
            <circle cx="40" cy="25" r="9" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <circle cx="54" cy="36" r="9" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <circle cx="49" cy="52" r="9" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <circle cx="31" cy="52" r="9" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <circle cx="26" cy="36" r="9" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <circle cx="40" cy="40" r="8" fill="#FACC15" stroke={stroke} strokeWidth="2.2" />
          </g>
        );

      case 'acc_glasses':
        return (
          <g stroke="#2C2A24" strokeWidth="3.2" fill="#E0F2FE" fillOpacity="0.45">
            <circle cx="26" cy="40" r="11.5" />
            <circle cx="54" cy="40" r="11.5" />
            <line x1="37.5" y1="40" x2="42.5" y2="40" />
            <line x1="12" y1="38" x2="15" y2="40" />
            <line x1="65" y1="40" x2="68" y2="38" />
          </g>
        );

      case 'acc_bowtie':
        return (
          <g fill="#F59E0B" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round">
            <path d="M16 25 L40 40 L16 55 Z" />
            <path d="M64 25 L40 40 L64 55 Z" />
            <circle cx="40" cy="40" r="6.5" fill="#EA7A26" />
          </g>
        );

      case 'acc_sunglasses':
        return (
          <g>
            <path d="M14 33 L37 33 L35 48 C34 51 17 51 16 48 Z" fill="#111827" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M43 33 L66 33 L64 48 C63 51 46 51 45 48 Z" fill="#111827" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <line x1="37" y1="35" x2="43" y2="35" stroke={stroke} strokeWidth="3" />
            <line x1="20" y1="37" x2="26" y2="45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <line x1="49" y1="37" x2="55" y2="45" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          </g>
        );

      case 'acc_headphones':
        return (
          <g>
            <path d="M20 44 C20 20 60 20 60 44" stroke="#1E5B3A" strokeWidth="5.5" strokeLinecap="round" fill="none" />
            <rect x="13" y="38" width="11" height="20" rx="5" fill="#EA7A26" stroke={stroke} strokeWidth="2.4" />
            <rect x="56" y="38" width="11" height="20" rx="5" fill="#EA7A26" stroke={stroke} strokeWidth="2.4" />
          </g>
        );

      case 'acc_crown':
        return (
          <g>
            <path
              d="M16 54 L14 26 L30 40 L40 20 L50 40 L66 26 L64 54 Z"
              fill="#FACC15"
              stroke={stroke}
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            <rect x="16" y="51" width="48" height="6" rx="2" fill="#EAB308" stroke={stroke} strokeWidth="2.2" />
            <circle cx="40" cy="43" r="4.5" fill="#10B981" stroke={stroke} strokeWidth="1.8" />
            <circle cx="25" cy="46" r="2.6" fill="#EA7A26" />
            <circle cx="55" cy="46" r="2.6" fill="#EA7A26" />
          </g>
        );

      case 'acc_study_visor':
        return (
          <g>
            <path d="M16 36 C16 26 64 26 64 36" stroke={stroke} strokeWidth="3.2" fill="none" />
            <path d="M15 36 Q40 26 69 40 Q48 53 15 36 Z" fill="#10B981" fillOpacity="0.78" stroke={stroke} strokeWidth="2.6" />
          </g>
        );

      case 'acc_gold_medal':
        return (
          <g>
            <path d="M24 14 L40 38 L56 14" stroke="#1E5B3A" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="40" cy="48" r="14" fill="#FACC15" stroke={stroke} strokeWidth="2.6" />
            <path d="M40 40 L42.5 45 L48 45 L43.5 48.5 L45 54 L40 50.5 L35 54 L36.5 48.5 L32 45 L37.5 45 Z" fill="#EA7A26" />
          </g>
        );

      case 'acc_cat_ears':
        return (
          <g>
            <path d="M16 52 C16 28 64 28 64 52" stroke="#F59E0B" strokeWidth="4" fill="none" />
            <path d="M27 32 L30 24 L37 24 L32 19 L34 12 L27 16 L20 12 L22 19 L17 24 L24 24 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
            <path d="M53 32 L56 24 L63 24 L58 19 L60 12 L53 16 L46 12 L48 19 L43 24 L50 24 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
          </g>
        );

      case 'acc_halo':
        return (
          <g>
            <ellipse cx="40" cy="40" rx="24" ry="8" stroke="#FACC15" strokeWidth="6" fill="none" />
            <ellipse cx="40" cy="40" rx="24" ry="8" stroke="#FEF08A" strokeWidth="2" fill="none" />
          </g>
        );

      case 'acc_grad_cap':
        return (
          <g>
            <rect x="24" y="40" width="32" height="12" rx="3" fill="#172A1E" stroke={stroke} strokeWidth="2.4" />
            <path d="M12 36 L40 22 L68 36 L40 49 Z" fill="#1E5B3A" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <line x1="60" y1="36" x2="65" y2="56" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
            <circle cx="65" cy="57" r="3.5" fill="#FACC15" />
          </g>
        );

      case 'acc_party_shades':
        return (
          <g>
            <rect x="13" y="31" width="23" height="15" rx="2" fill="#1E1B4B" stroke="#A855F7" strokeWidth="2.6" />
            <rect x="44" y="31" width="23" height="15" rx="2" fill="#1E1B4B" stroke="#A855F7" strokeWidth="2.6" />
            <line x1="36" y1="36" x2="44" y2="36" stroke="#A855F7" strokeWidth="3" />
            <rect x="18" y="35" width="4" height="4" fill="#38BDF8" />
            <rect x="23" y="39" width="4" height="4" fill="#38BDF8" />
            <rect x="49" y="35" width="4" height="4" fill="#38BDF8" />
            <rect x="54" y="39" width="4" height="4" fill="#38BDF8" />
          </g>
        );

      case 'acc_astro_helmet':
        return (
          <g>
            <circle cx="40" cy="42" r="24" fill="#E0F2FE" fillOpacity="0.6" stroke={stroke} strokeWidth="2.8" />
            <ellipse cx="40" cy="42" rx="17" ry="13" fill="#0284C7" fillOpacity="0.45" stroke="#38BDF8" strokeWidth="2.2" />
            <path d="M29 36 Q35 32 42 35" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
        );

      case 'acc_wizard_hat':
        return (
          <g>
            <ellipse cx="40" cy="54" rx="28" ry="8" fill="#312E81" stroke={stroke} strokeWidth="2.6" />
            <path d="M21 53 L39 14 L54 24 L49 34 L59 53 Z" fill="#4338CA" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M23 49 Q40 53 57 49" stroke="#FACC15" strokeWidth="4" fill="none" />
            <circle cx="40" cy="36" r="3" fill="#FACC15" />
          </g>
        );

      // --- FURNITURE ---
      case 'furn_study_plant':
        return (
          <g>
            <path d="M27 42 L53 42 L49 62 L31 62 Z" fill="#C2410C" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <rect x="24" y="38" width="32" height="6" rx="2" fill="#EA7A26" stroke={stroke} strokeWidth="2.2" />
            <ellipse cx="40" cy="25" rx="7" ry="13" fill="#1E5B3A" stroke={stroke} strokeWidth="2.2" />
            <ellipse cx="28" cy="29" rx="10" ry="6" transform="rotate(-25 28 29)" fill="#2E7D32" stroke={stroke} strokeWidth="2.2" />
            <ellipse cx="52" cy="29" rx="10" ry="6" transform="rotate(25 52 29)" fill="#2E7D32" stroke={stroke} strokeWidth="2.2" />
          </g>
        );

      case 'furn_orange_rug':
        return (
          <g>
            <ellipse cx="40" cy="42" rx="26" ry="16" fill="#EA7A26" stroke={stroke} strokeWidth="2.6" />
            <ellipse cx="40" cy="42" rx="18" ry="10" fill="#FDE68A" stroke="#C2410C" strokeWidth="2" />
            <ellipse cx="40" cy="42" rx="9" ry="5" fill="#1E5B3A" />
          </g>
        );

      case 'furn_leaf_bed':
        return (
          <g>
            <rect x="13" y="34" width="54" height="24" rx="8" fill="#1E5B3A" stroke={stroke} strokeWidth="2.6" />
            <rect x="17" y="27" width="17" height="12" rx="5" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
            <path d="M35 34 L63 34 C65 34 67 36 67 38 L67 52 C67 55 64 58 60 58 L35 58 Z" fill="#4ADE80" stroke={stroke} strokeWidth="2.2" />
            <path d="M44 43 Q52 39 58 47" stroke="#1E5B3A" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        );

      case 'furn_bookshelf':
        return (
          <g>
            <rect x="18" y="16" width="44" height="48" rx="4" fill="#92400E" stroke={stroke} strokeWidth="2.6" />
            <rect x="22" y="21" width="36" height="16" fill="#78350F" />
            <rect x="22" y="42" width="36" height="16" fill="#78350F" />
            <rect x="25" y="23" width="6" height="14" fill="#1E5B3A" />
            <rect x="32" y="25" width="6" height="12" fill="#EA7A26" />
            <rect x="39" y="22" width="7" height="15" fill="#3B82F6" />
            <rect x="25" y="44" width="7" height="14" fill="#FACC15" />
            <rect x="33" y="46" width="6" height="12" fill="#EF4444" />
            <rect x="46" y="44" width="7" height="14" fill="#10B981" />
          </g>
        );

      case 'furn_desk_lamp':
        return (
          <g>
            <ellipse cx="40" cy="60" rx="14" ry="4.5" fill="#1E5B3A" stroke={stroke} strokeWidth="2.2" />
            <path d="M38 58 L30 38 L42 25" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M33 21 L52 21 L57 35 L28 35 Z" fill="#F59E0B" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
            <ellipse cx="42.5" cy="36" rx="8" ry="3" fill="#FEF08A" />
          </g>
        );

      case 'furn_aquarium':
        return (
          <g>
            <rect x="16" y="24" width="48" height="36" rx="6" fill="#E0F2FE" stroke={stroke} strokeWidth="2.6" />
            <rect x="18" y="30" width="44" height="28" rx="4" fill="#38BDF8" fillOpacity="0.45" />
            <rect x="16" y="53" width="48" height="7" rx="2" fill="#FDE68A" />
            <ellipse cx="38" cy="43" rx="7" ry="4.5" fill="#EA7A26" stroke={stroke} strokeWidth="1.6" />
            <path d="M44 43 L50 39 L50 47 Z" fill="#EA7A26" stroke={stroke} strokeWidth="1.4" />
            <circle cx="34" cy="42" r="1.3" fill="#111827" />
            <circle cx="29" cy="34" r="2.2" fill="#FFFFFF" />
          </g>
        );

      case 'furn_beanbag':
        return (
          <g>
            <path d="M16 48 C16 32 25 22 40 22 C55 22 64 32 64 48 C64 58 54 62 40 62 C26 62 16 58 16 48 Z" fill="#EA7A26" stroke={stroke} strokeWidth="2.6" />
            <path d="M26 38 Q40 46 54 38" stroke="#C2410C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </g>
        );

      case 'furn_trophy_case':
        return (
          <g>
            <rect x="22" y="16" width="36" height="48" rx="4" fill="#1E5B3A" stroke={stroke} strokeWidth="2.6" />
            <rect x="26" y="20" width="28" height="32" rx="2" fill="#ECFDF5" />
            <path d="M33 26 L47 26 L44 37 C43 40 37 40 36 37 Z" fill="#FACC15" stroke={stroke} strokeWidth="1.8" />
            <rect x="38" y="38" width="4" height="6" fill="#EAB308" />
            <rect x="34" y="44" width="12" height="4" rx="1" fill="#EA7A26" stroke={stroke} strokeWidth="1.4" />
          </g>
        );

      case 'furn_mini_arcade':
        return (
          <g>
            <path d="M23 18 L57 18 L57 64 L23 64 Z" fill="#4C1D95" stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
            <rect x="27" y="21" width="26" height="6" rx="1.5" fill="#F43F5E" />
            <rect x="27" y="29" width="26" height="17" rx="2" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.6" />
            <circle cx="36" cy="37" r="3" fill="#FACC15" />
            <circle cx="45" cy="39" r="2.5" fill="#34D399" />
            <circle cx="33" cy="51" r="2.2" fill="#EF4444" />
            <circle cx="46" cy="51" r="2.2" fill="#38BDF8" />
            <circle cx="51" cy="51" r="2.2" fill="#FACC15" />
          </g>
        );

      case 'furn_telescope':
        return (
          <g>
            <line x1="40" y1="38" x2="24" y2="62" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
            <line x1="40" y1="38" x2="40" y2="63" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
            <line x1="40" y1="38" x2="56" y2="62" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
            <rect x="20" y="24" width="38" height="11" rx="4" transform="rotate(-24 39 30)" fill="#F59E0B" stroke={stroke} strokeWidth="2.5" />
            <circle cx="56" cy="22" r="5" fill="#BAE6FD" stroke={stroke} strokeWidth="2" />
          </g>
        );

      case 'furn_plush_sofa':
        return (
          <g>
            <rect x="14" y="28" width="52" height="26" rx="8" fill="#0891B2" stroke={stroke} strokeWidth="2.6" />
            <rect x="11" y="38" width="12" height="20" rx="5" fill="#06B6D4" stroke={stroke} strokeWidth="2.4" />
            <rect x="57" y="38" width="12" height="20" rx="5" fill="#06B6D4" stroke={stroke} strokeWidth="2.4" />
            <rect x="21" y="42" width="38" height="14" rx="4" fill="#22D3EE" stroke={stroke} strokeWidth="2" />
          </g>
        );

      default:
        return (
          <circle cx="40" cy="40" r="18" fill="#1E5B3A" stroke={stroke} strokeWidth="2.5" />
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {renderGraphic()}
    </svg>
  );
};
