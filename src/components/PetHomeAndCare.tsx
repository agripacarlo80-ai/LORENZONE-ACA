import React, { useEffect, useState } from 'react';
import {
  Utensils,
  Gamepad2,
  Sparkles,
  Moon,
  Sun,
  ShoppingBag,
  UserCheck,
  Coins,
  Award,
  Check,
  Lock,
  Camera,
  Trash2,
} from 'lucide-react';
import { PET_COLORS, PET_SPECIES_INFO, SHOP_ITEMS } from '../data/defaultDecks';
import { PetSpecies, PublicProfile, ScoreRecord } from '../types';
import { PetAvatar } from './PetAvatar';
import { soundFx } from '../lib/sound';
import { compressProfilePhoto } from '../lib/imageUpload';

interface PetHomeAndCareProps {
  profile: PublicProfile;
  records: ScoreRecord[];
  onUpdateProfile: (patch: Partial<PublicProfile>) => Promise<void>;
  onOpenGames: () => void;
}

type HomeSubView = 'room' | 'shop' | 'customize' | 'history';

export const PetHomeAndCare: React.FC<PetHomeAndCareProps> = ({
  profile,
  records,
  onUpdateProfile,
  onOpenGames,
}) => {
  const [subView, setSubView] = useState<HomeSubView>('room');
  const [shopCategory, setShopCategory] = useState<'clothes' | 'accessories' | 'furniture'>('clothes');
  const [petMessage, setPetMessage] = useState<string>(
    profile.isSleeping
      ? `Good night! ${profile.petName} is resting for tomorrow's quiz.`
      : `Welcome back to San Lorenzo Academy, ${profile.displayName}!`
  );
  const [editingPetName, setEditingPetName] = useState(profile.petName);
  const [editingDisplayName, setEditingDisplayName] = useState(profile.displayName);
  const [savingName, setSavingName] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setEditingPetName(profile.petName);
    setEditingDisplayName(profile.displayName);
  }, [profile.petName, profile.displayName]);

  const hasLeafBed = profile.unlockedItems.includes('furn_leaf_bed');
  const hasStudyPlant = profile.unlockedItems.includes('furn_study_plant');
  const hasOrangeRug = profile.unlockedItems.includes('furn_orange_rug');

  const xpNeeded = profile.petLevel * 100;
  const xpProgress = Math.min(100, Math.round((profile.petXp / xpNeeded) * 100));

  const applyCareAction = async (type: 'feed' | 'play' | 'clean' | 'sleep') => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      soundFx.playCare();
      let hunger = Math.min(100, Math.max(0, profile.hunger));
      let happiness = Math.min(100, Math.max(0, profile.happiness));
      let energy = Math.min(100, Math.max(0, profile.energy));
      let cleanliness = Math.min(100, Math.max(0, profile.cleanliness));
      let isSleeping = profile.isSleeping;
      let petXp = profile.petXp + 15;
      let petLevel = profile.petLevel;

      const plantBonus = hasStudyPlant ? 5 : 0;
      const rugBonus = hasOrangeRug ? 4 : 0;

      if (type === 'feed') {
        hunger = Math.min(100, hunger + 22);
        happiness = Math.min(100, happiness + 6 + rugBonus);
        isSleeping = false;
        setPetMessage(
          hasOrangeRug
            ? 'Yum! Cozy campus snacks + Marigold Rug bonus!'
            : 'Yum! Healthy campus snacks boost my focus!'
        );
      } else if (type === 'play') {
        happiness = Math.min(100, happiness + 24 + plantBonus);
        energy = Math.max(0, energy - 10);
        hunger = Math.max(0, hunger - 6);
        isSleeping = false;
        setPetMessage(
          hasStudyPlant
            ? 'So fun! Potted Monstera adds +5% happiness!'
            : 'That was fun! Ready to win a mini-game next!'
        );
      } else if (type === 'clean') {
        cleanliness = Math.min(100, cleanliness + 28 + rugBonus);
        happiness = Math.min(100, happiness + 8 + plantBonus);
        isSleeping = false;
        setPetMessage('Squeaky clean uniform and tidy desk!');
      } else if (type === 'sleep') {
        isSleeping = !isSleeping;
        if (isSleeping) {
          const bonus = (hasLeafBed ? 35 : 25) + rugBonus;
          energy = Math.min(100, energy + bonus);
          setPetMessage(`Zzz... Resting to recharge energy (+${bonus}%).`);
        } else {
          setPetMessage('Good morning! Fully energized for class!');
        }
      }

      while (petXp >= petLevel * 100) {
        petXp -= petLevel * 100;
        petLevel += 1;
        soundFx.playLevelUp();
        setPetMessage(`Level Up! ${profile.petName} reached Level ${petLevel}!`);
      }

      await onUpdateProfile({
        hunger,
        happiness,
        energy,
        cleanliness,
        isSleeping,
        petXp,
        petLevel,
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleBuyOrEquip = async (itemId: string, category: 'clothes' | 'accessories' | 'furniture', price: number) => {
    if (actionBusy) return;
    const isOwned = profile.unlockedItems.includes(itemId) || price === 0;
    if (isOwned) {
      soundFx.playClick();
      if (category === 'clothes') {
        setActionBusy(true);
        try {
          await onUpdateProfile({ outfit: itemId });
        } finally {
          setActionBusy(false);
        }
      } else if (category === 'accessories') {
        setActionBusy(true);
        try {
          await onUpdateProfile({ accessory: itemId });
        } finally {
          setActionBusy(false);
        }
      } else {
        setPetMessage('Room furniture is active and boosting your Pet Room!');
      }
      return;
    }

    if (profile.coins < price) {
      soundFx.playWrong();
      setPetMessage(`Need ${price - profile.coins} more LorenCoins! Play mini-games to earn coins.`);
      return;
    }

    setActionBusy(true);
    try {
      soundFx.playLevelUp();
      const nextUnlocked = Array.from(new Set([...profile.unlockedItems, itemId])).slice(0, 40);
      const patch: Partial<PublicProfile> = {
        coins: profile.coins - price,
        unlockedItems: nextUnlocked,
      };
      if (category === 'clothes') patch.outfit = itemId;
      if (category === 'accessories') patch.accessory = itemId;
      await onUpdateProfile(patch);
      setPetMessage(
        category === 'furniture'
          ? 'New room furniture unlocked! Passive room bonus activated!'
          : 'New item unlocked and equipped!'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveNames = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPetName.trim() || !editingDisplayName.trim()) {
      setPetMessage('Display Name and Pet Name cannot be empty.');
      return;
    }
    setSavingName(true);
    soundFx.playClick();
    try {
      await onUpdateProfile({
        petName: editingPetName.trim().slice(0, 30),
        displayName: editingDisplayName.trim().slice(0, 60),
      });
      setPetMessage('Profile details saved!');
    } finally {
      setSavingName(false);
    }
  };

  const myRecords = records.filter((r) => r.studentId === profile.uid).slice(0, 12);
  const accuracy =
    profile.totalAnswers > 0
      ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#EDE8D8] rounded-xl">
          {[
            { id: 'room', label: 'Pet Room' },
            { id: 'shop', label: 'SLA Shop' },
            { id: 'customize', label: 'Uniform & Profile' },
            { id: 'history', label: 'Game History' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundFx.playClick();
                setSubView(tab.id as HomeSubView);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subView === tab.id
                  ? 'bg-white text-[#1E5B3A] shadow-sm'
                  : 'text-[#4D6354] hover:text-[#172A1E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-5 text-sm tabular-nums">
          <div className="flex items-center gap-1.5 font-semibold text-[#172A1E]">
            <Coins className="w-4 h-4 text-[#EA7A26]" />
            <span>{profile.coins} Coins</span>
          </div>
          <span className="text-[#D4CCB5]" aria-hidden="true">|</span>
          <div className="font-semibold text-[#1E5B3A]">
            Lv. {profile.petLevel} · {xpProgress}% XP
          </div>
        </div>
      </div>

      {subView === 'room' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Stage: Pet Room */}
          <div className="lg:col-span-7 relative rounded-3xl overflow-hidden border border-[#E5DEC9] bg-white min-h-[430px] flex flex-col justify-between">
            <img
              src={
                profile.isSleeping
                  ? '/src/assets/images/lorenzone_pet_sleep_1795116397000.jpg'
                  : '/src/assets/images/lorenzone_pet_room_1795116396715.jpg'
              }
              alt={profile.isSleeping ? 'Pet sleeping bedroom' : 'Pet sunlit study room'}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25" />

            {/* Top HUD inside Room */}
            <div className="relative z-10 p-5 flex items-center justify-between gap-4">
              <div className="bg-white/95 rounded-2xl px-4 py-2.5 shadow-sm flex items-center gap-3">
                {profile.photoUrl && (
                  <img
                    src={profile.photoUrl}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#1E5B3A] shrink-0"
                  />
                )}
                <div>
                  <p className="text-sm font-bold text-[#172A1E]">
                    {profile.petName}{' '}
                    <span className="font-normal text-xs text-[#4D6354] capitalize">
                      · {profile.petSpecies} ({profile.role})
                    </span>
                  </p>
                  <div className="w-36 h-1.5 bg-[#E6E0CE] rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-[#1E5B3A] rounded-full transition-all"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onOpenGames();
                }}
                className="px-4 py-2.5 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2"
              >
                <Gamepad2 className="w-4 h-4" />
                Play Quiz Games
              </button>
            </div>

            {/* Center Pet & Speech Bubble */}
            <div className="relative z-10 flex flex-col items-center justify-end pb-6 px-4">
              {(hasLeafBed || hasOrangeRug || hasStudyPlant) && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
                  {hasLeafBed && (
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 text-[#1E5B3A] text-[11px] font-bold shadow-sm">
                      Leafy Bed (+Rest)
                    </span>
                  )}
                  {hasOrangeRug && (
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 text-[#C65B10] text-[11px] font-bold shadow-sm">
                      Marigold Rug (+Cozy)
                    </span>
                  )}
                  {hasStudyPlant && (
                    <span className="px-2.5 py-1 rounded-lg bg-white/90 text-[#1E5B3A] text-[11px] font-bold shadow-sm">
                      Monstera (+Joy)
                    </span>
                  )}
                </div>
              )}
              <div className="bg-white/95 text-[#172A1E] text-xs font-medium px-4 py-2 rounded-2xl shadow-sm mb-2 max-w-sm text-center">
                {petMessage}
              </div>
              <PetAvatar
                species={profile.petSpecies}
                color={profile.petColor}
                outfit={profile.outfit}
                accessory={profile.accessory}
                role={profile.role}
                isSleeping={profile.isSleeping}
                size={195}
                className={profile.isSleeping ? '' : 'animate-float-gentle'}
              />
            </div>
          </div>

          {/* Right Deck: Care Meters & Actions */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E5DEC9] p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-[#172A1E]">Feed &amp; Care Status</h3>
              <p className="text-xs text-[#4D6354] mt-1">
                Teachers monitor your pet level and daily care alongside quiz accuracy.
              </p>

              <div className="space-y-4 mt-6">
                {[
                  { label: 'Hunger', value: Math.min(100, Math.max(0, profile.hunger)), color: 'bg-[#2E7D32]', status: profile.hunger >= 50 ? 'Satisfied' : 'Hungry' },
                  { label: 'Happiness', value: Math.min(100, Math.max(0, profile.happiness)), color: 'bg-[#EA7A26]', status: profile.happiness >= 50 ? 'Cheerful' : 'Needs Play' },
                  { label: 'Energy', value: Math.min(100, Math.max(0, profile.energy)), color: 'bg-[#F59E0B]', status: profile.energy >= 45 ? 'Energetic' : 'Sleepy' },
                  { label: 'Cleanliness', value: Math.min(100, Math.max(0, profile.cleanliness)), color: 'bg-[#0EA5E9]', status: profile.cleanliness >= 50 ? 'Neat Uniform' : 'Needs Wash' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[#172A1E]">{stat.label}</span>
                      <span className="text-[#4D6354] tabular-nums">
                        {stat.status} · {stat.value}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F2EFE6] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stat.color} rounded-full transition-all duration-300`}
                        style={{ width: `${stat.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#ECE7D8]">
              <p className="text-xs font-semibold text-[#4D6354] mb-3">Quick Care Actions (+15 XP each)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void applyCareAction('feed')}
                  className="py-3 px-2 rounded-xl border border-[#E5DEC9] hover:border-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-xs font-semibold text-[#172A1E] flex flex-col items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Utensils className="w-4 h-4 text-[#2E7D32]" />
                  Feed
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void applyCareAction('play')}
                  className="py-3 px-2 rounded-xl border border-[#E5DEC9] hover:border-[#EA7A26] hover:bg-[#EA7A26]/5 text-xs font-semibold text-[#172A1E] flex flex-col items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Gamepad2 className="w-4 h-4 text-[#EA7A26]" />
                  Play Toy
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void applyCareAction('clean')}
                  className="py-3 px-2 rounded-xl border border-[#E5DEC9] hover:border-[#0EA5E9] hover:bg-sky-50 text-xs font-semibold text-[#172A1E] flex flex-col items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-[#0EA5E9]" />
                  Clean
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void applyCareAction('sleep')}
                  className={`py-3 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                    profile.isSleeping
                      ? 'border-[#EA7A26] bg-[#EA7A26]/10 text-[#C65B10]'
                      : 'border-[#E5DEC9] hover:border-[#1E5B3A] hover:bg-[#1E5B3A]/5 text-[#172A1E]'
                  }`}
                >
                  {profile.isSleeping ? (
                    <Sun className="w-4 h-4 text-[#EA7A26]" />
                  ) : (
                    <Moon className="w-4 h-4 text-[#1E5B3A]" />
                  )}
                  {profile.isSleeping ? 'Wake Up' : 'Sleep'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subView === 'shop' && (
        <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#ECE7D8]">
            <div>
              <h3 className="text-xl font-bold text-[#172A1E] flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#EA7A26]" />
                San Lorenzo Academy Shop
              </h3>
              <p className="text-xs text-[#4D6354] mt-1">
                Earn LorenCoins from quiz games to unlock uniforms, accessories, and cozy room furniture.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9]">
              {(['clothes', 'accessories', 'furniture'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setShopCategory(cat);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
                    shopCategory === cat ? 'bg-[#1E5B3A] text-white' : 'text-[#4D6354]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {SHOP_ITEMS.filter((i) => i.category === shopCategory).map((item) => {
              const owned = profile.unlockedItems.includes(item.id) || item.price === 0;
              const equipped = profile.outfit === item.id || profile.accessory === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E5DEC9] p-5 flex flex-col justify-between bg-[#FAF8F2]/50"
                >
                  <div>
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-3"
                      style={{ backgroundColor: item.previewColor }}
                    >
                      {item.name.slice(0, 1)}
                    </div>
                    <h4 className="font-bold text-sm text-[#172A1E]">{item.name}</h4>
                    <p className="text-xs text-[#4D6354] mt-1 leading-relaxed">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleBuyOrEquip(item.id, item.category, item.price)}
                    className={`mt-5 w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                      equipped
                        ? 'bg-[#1E5B3A] text-white'
                        : owned
                        ? 'bg-white border border-[#1E5B3A] text-[#1E5B3A] hover:bg-[#1E5B3A]/5'
                        : 'bg-[#EA7A26] hover:bg-[#D46818] text-white'
                    }`}
                  >
                    {equipped ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Equipped
                      </>
                    ) : owned ? (
                      item.category === 'furniture' ? 'Active in Room' : 'Equip Item'
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Buy · {item.price} Coins
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subView === 'customize' && (
        <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 bg-[#FAF8F2] rounded-2xl border border-[#E5DEC9] p-6 flex flex-col items-center text-center">
            <PetAvatar
              species={profile.petSpecies}
              color={profile.petColor}
              outfit={profile.outfit}
              accessory={profile.accessory}
              role={profile.role}
              size={200}
              className="animate-float-gentle"
            />
            <p className="text-lg font-bold text-[#172A1E] mt-2">{profile.petName}</p>
            <p className="text-xs text-[#4D6354] capitalize">
              {profile.displayName} · {profile.role} Uniform
            </p>
            <div className="w-full mt-5">
              <p className="text-xs font-semibold text-[#4D6354] mb-2 text-left">Fur / Shell Color</p>
              <div className="flex items-center justify-between gap-2">
                {PET_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      void onUpdateProfile({ petColor: c.hex });
                    }}
                    className={`w-8 h-8 rounded-full border-2 cursor-pointer ${
                      profile.petColor === c.hex ? 'border-[#1E5B3A] scale-110' : 'border-white'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {/* Student / User Profile Photo Upload Card */}
            <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {profile.photoUrl ? (
                  <img
                    src={profile.photoUrl}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-[#1E5B3A] shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white border border-[#D8D0BC] flex items-center justify-center text-[#4D6354] shrink-0">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-[#172A1E]">Your Profile Photo</p>
                  <p className="text-xs text-[#4D6354]">
                    Visible to you and your SLA Teachers/Admins so they can easily recognize you.
                  </p>
                  {photoStatus && (
                    <p className="text-xs font-semibold text-[#1E5B3A] mt-0.5">{photoStatus}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3.5 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer transition-colors">
                  {uploadingPhoto ? 'Uploading...' : profile.photoUrl ? 'Change Photo' : 'Add Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingPhoto}
                    className="hidden"
                    onChange={async (e) => {
                      const inputEl = e.currentTarget;
                      const file = inputEl.files?.[0];
                      inputEl.value = '';
                      if (!file) return;
                      setUploadingPhoto(true);
                      setPhotoStatus(null);
                      try {
                        const compressed = await compressProfilePhoto(file);
                        await onUpdateProfile({ photoUrl: compressed });
                        soundFx.playLevelUp();
                        setPhotoStatus('Profile photo saved!');
                      } catch (err) {
                        soundFx.playWrong();
                        setPhotoStatus(
                          err instanceof Error ? err.message : 'Unable to upload photo.'
                        );
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }}
                  />
                </label>
                {profile.photoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      void onUpdateProfile({ photoUrl: '' });
                      setPhotoStatus('Profile photo removed.');
                    }}
                    className="p-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                    aria-label="Remove profile photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveNames} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">Display Name</label>
                <input
                  type="text"
                  maxLength={60}
                  value={editingDisplayName}
                  onChange={(e) => setEditingDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">Pet Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={30}
                    value={editingPetName}
                    onChange={(e) => setEditingPetName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="px-4 py-2.5 rounded-xl bg-[#1E5B3A] text-white text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    {savingName ? 'Saving' : 'Save'}
                  </button>
                </div>
              </div>
            </form>

            <div>
              <p className="text-xs font-semibold text-[#172A1E] mb-2">Change Animal Companion</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PET_SPECIES_INFO.map((animal) => (
                  <button
                    key={animal.id}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      void onUpdateProfile({ petSpecies: animal.id as PetSpecies, petColor: animal.defaultColor });
                    }}
                    className={`p-2 rounded-xl border text-center cursor-pointer transition-colors ${
                      profile.petSpecies === animal.id
                        ? 'border-[#1E5B3A] bg-[#1E5B3A]/5'
                        : 'border-[#E5DEC9] hover:bg-[#FAF8F2]'
                    }`}
                  >
                    <PetAvatar
                      species={animal.id}
                      color={animal.defaultColor}
                      outfit="none"
                      accessory="none"
                      size={42}
                      className="mx-auto"
                    />
                    <span className="text-xs font-semibold block mt-1">{animal.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  SLA Uniform / Outfit
                </label>
                <select
                  value={profile.outfit}
                  onChange={(e) => {
                    soundFx.playClick();
                    void onUpdateProfile({ outfit: e.target.value });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm bg-white"
                >
                  {SHOP_ITEMS.filter(
                    (i) =>
                      i.category === 'clothes' &&
                      (i.price === 0 || profile.unlockedItems.includes(i.id))
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  <option value="none">No Uniform</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  Equipped Accessory
                </label>
                <select
                  value={profile.accessory}
                  onChange={(e) => {
                    soundFx.playClick();
                    void onUpdateProfile({ accessory: e.target.value });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm bg-white"
                >
                  <option value="none">None</option>
                  {SHOP_ITEMS.filter(
                    (i) =>
                      i.category === 'accessories' &&
                      (i.price === 0 || profile.unlockedItems.includes(i.id) || i.id === profile.accessory)
                  ).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {subView === 'history' && (
        <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
              <p className="text-xs text-[#4D6354]">Total Quiz Score</p>
              <p className="text-2xl font-bold text-[#1E5B3A] tabular-nums mt-1">{profile.totalScore}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
              <p className="text-xs text-[#4D6354]">Games Completed</p>
              <p className="text-2xl font-bold text-[#172A1E] tabular-nums mt-1">{profile.gamesPlayed}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
              <p className="text-xs text-[#4D6354]">Quiz Accuracy</p>
              <p className="text-2xl font-bold text-[#EA7A26] tabular-nums mt-1">{accuracy}%</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9]">
              <p className="text-xs text-[#4D6354]">Achievements</p>
              <p className="text-sm font-semibold text-[#172A1E] mt-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#EA7A26]" />
                {profile.gamesPlayed >= 5 ? 'SLA Honor Scholar' : 'Rising Academy Learner'}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-[#172A1E] mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#1E5B3A]" />
              Recent Quiz Attempts
            </h4>
            {myRecords.length === 0 ? (
              <p className="text-sm text-[#4D6354] py-6 text-center bg-[#FAF8F2] rounded-2xl">
                No games completed yet. Head to Mini Games to earn your first score!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#ECE7D8] text-xs text-[#4D6354]">
                      <th className="py-2.5 pr-4 font-semibold">Game</th>
                      <th className="py-2.5 pr-4 font-semibold">Subject</th>
                      <th className="py-2.5 pr-4 font-semibold">Correct</th>
                      <th className="py-2.5 font-semibold text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EFE6]">
                    {myRecords.map((rec) => (
                      <tr key={rec.id}>
                        <td className="py-3 pr-4 font-semibold text-[#172A1E]">{rec.gameTitle}</td>
                        <td className="py-3 pr-4 text-[#4D6354]">{rec.subject}</td>
                        <td className="py-3 pr-4 tabular-nums text-[#4D6354]">
                          {rec.correctCount}/{rec.totalCount}
                        </td>
                        <td className="py-3 font-bold text-[#1E5B3A] text-right tabular-nums">
                          +{rec.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
