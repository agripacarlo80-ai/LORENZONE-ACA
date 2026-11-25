import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Utensils,
  Gamepad2,
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
  Hand,
  Bath,
  Eye,
  RotateCcw,
  Plus,
  HeartPulse,
  Sparkles,
  Clock,
  Image as ImageIcon,
} from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import {
  PET_COLORS,
  PET_SPECIES_INFO,
  ROOM_BACKGROUNDS,
  RoomBackgroundTheme,
  SHOP_ITEMS,
} from '../data/defaultDecks';
import { PetSpecies, PublicProfile, ScoreRecord, ShopCategory, ShopItem } from '../types';
import { PetAvatar } from './PetAvatar';
import { ShopItemVisual } from './ShopItemVisual';
import { soundFx } from '../lib/sound';
import { compressProfilePhoto } from '../lib/imageUpload';
import { applyXpGain, getPetHealthState, xpRequiredForLevel } from '../lib/progression';
import { timestampToMillis } from '../lib/presence';

interface PetHomeAndCareProps {
  profile: PublicProfile;
  records: ScoreRecord[];
  onUpdateProfile: (patch: Partial<PublicProfile>) => Promise<void>;
  onOpenGames: () => void;
  onSetActivity?: (activity: string) => void;
}

type HomeSubView = 'room' | 'shop' | 'customize' | 'history';
type RoomMode = 'pet' | 'feed' | 'play' | 'wash';
type PetMoodState =
  | 'happy'
  | 'excited'
  | 'sleepy'
  | 'concerned'
  | 'eating'
  | 'blushing'
  | 'soapy'
  | 'sick'
  | 'showering';

type DragItemKind =
  | { kind: 'food'; itemId: string; isEmergency?: boolean }
  | { kind: 'soap'; itemId: 'tool_soap' }
  | { kind: 'shower'; itemId: 'tool_shower' };

interface ActiveDragState {
  target: DragItemKind;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

interface FloatingParticle {
  id: number;
  text: string;
  tone: 'green' | 'orange' | 'sky' | 'rose';
  xOffset: number;
}

const SUB_VIEW_ACTIVITY: Record<HomeSubView, string> = {
  room: 'Pet Home Room',
  shop: 'Browsing SLA Shop',
  customize: 'Customizing Pet & Profile',
  history: 'Viewing Game History',
};

const SLEEP_RECOVERY_INTERVAL_MS = 120_000;

const AmbientRoomEffects: React.FC<{
  effect: RoomBackgroundTheme['ambientEffect'];
  isSleeping?: boolean;
}> = ({ effect, isSleeping }) => {
  if (isSleeping || effect === 'stars' || effect === 'aurora') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
        {effect === 'aurora' && !isSleeping && (
          <div className="absolute -top-12 left-1/4 w-3/4 h-36 rounded-full bg-gradient-to-r from-emerald-400/20 via-cyan-300/20 to-violet-400/20 blur-2xl" />
        )}
        {[
          { left: '12%', top: '16%', delay: '0s', size: 'w-2 h-2' },
          { left: '28%', top: '24%', delay: '0.7s', size: 'w-1.5 h-1.5' },
          { left: '48%', top: '12%', delay: '1.3s', size: 'w-2 h-2' },
          { left: '72%', top: '20%', delay: '0.4s', size: 'w-1.5 h-1.5' },
          { left: '86%', top: '14%', delay: '1.9s', size: 'w-2.5 h-2.5' },
          { left: '62%', top: '34%', delay: '1.1s', size: 'w-1.5 h-1.5' },
        ].map((star, idx) => (
          <span
            key={idx}
            style={{ left: star.left, top: star.top, animationDelay: star.delay }}
            className={`absolute rounded-full bg-amber-100 shadow-[0_0_8px_rgba(254,243,199,0.85)] animate-ambient-twinkle ${star.size}`}
          />
        ))}
      </div>
    );
  }

  if (effect === 'petals') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
        {[
          { left: '10%', delay: '0s', dur: '7.5s' },
          { left: '26%', delay: '1.8s', dur: '8.5s' },
          { left: '44%', delay: '3.2s', dur: '7s' },
          { left: '63%', delay: '0.9s', dur: '9s' },
          { left: '78%', delay: '2.4s', dur: '8s' },
          { left: '90%', delay: '4.1s', dur: '7.8s' },
        ].map((p, idx) => (
          <span
            key={idx}
            style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur }}
            className="absolute -top-4 w-3 h-2 rounded-full bg-pink-200/90 border border-pink-300/60 shadow-xs animate-ambient-petal"
          />
        ))}
      </div>
    );
  }

  if (effect === 'bubbles') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
        {[
          { left: '14%', delay: '0s', size: 'w-3 h-3' },
          { left: '32%', delay: '1.6s', size: 'w-4 h-4' },
          { left: '54%', delay: '2.8s', size: 'w-2.5 h-2.5' },
          { left: '71%', delay: '0.8s', size: 'w-3.5 h-3.5' },
          { left: '84%', delay: '2.1s', size: 'w-3 h-3' },
        ].map((b, idx) => (
          <span
            key={idx}
            style={{ left: b.left, animationDelay: b.delay }}
            className={`absolute bottom-4 rounded-full border border-sky-200/80 bg-white/25 animate-ambient-bubble ${b.size}`}
          />
        ))}
      </div>
    );
  }

  if (effect === 'fireflies') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
        {[
          { left: '18%', top: '28%', delay: '0.2s' },
          { left: '37%', top: '42%', delay: '1.2s' },
          { left: '66%', top: '26%', delay: '0.8s' },
          { left: '81%', top: '48%', delay: '1.7s' },
          { left: '49%', top: '22%', delay: '2.1s' },
        ].map((f, idx) => (
          <span
            key={idx}
            style={{ left: f.left, top: f.top, animationDelay: f.delay }}
            className="absolute w-2.5 h-2.5 rounded-full bg-amber-300/90 shadow-[0_0_12px_rgba(252,211,77,0.9)] animate-ambient-twinkle"
          />
        ))}
      </div>
    );
  }

  if (effect === 'neon') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fuchsia-500/70 via-cyan-400/70 to-amber-400/70" />
        {[
          { left: '16%', top: '20%', delay: '0.1s', color: 'bg-fuchsia-400' },
          { left: '76%', top: '24%', delay: '0.9s', color: 'bg-cyan-300' },
          { left: '34%', top: '34%', delay: '1.6s', color: 'bg-amber-300' },
          { left: '88%', top: '40%', delay: '0.5s', color: 'bg-emerald-300' },
        ].map((n, idx) => (
          <span
            key={idx}
            style={{ left: n.left, top: n.top, animationDelay: n.delay }}
            className={`absolute w-2 h-2 rounded-xs animate-ambient-twinkle ${n.color}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
      {[
        { left: '20%', top: '24%', delay: '0.4s' },
        { left: '74%', top: '20%', delay: '1.2s' },
        { left: '48%', top: '16%', delay: '2.0s' },
      ].map((s, idx) => (
        <span
          key={idx}
          style={{ left: s.left, top: s.top, animationDelay: s.delay }}
          className="absolute w-1.5 h-1.5 rounded-full bg-amber-100/80 animate-ambient-twinkle"
        />
      ))}
    </div>
  );
};

export const PetHomeAndCare: React.FC<PetHomeAndCareProps> = ({
  profile,
  records,
  onUpdateProfile,
  onOpenGames,
  onSetActivity,
}) => {
  const [subView, setSubView] = useState<HomeSubView>('room');
  const [shopCategory, setShopCategory] = useState<ShopCategory>('food');
  const [roomMode, setRoomMode] = useState<RoomMode>('pet');
  const [transientMood, setTransientMood] = useState<PetMoodState | null>(null);
  const [bounceKey, setBounceKey] = useState(0);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [feedingVisualId, setFeedingVisualId] = useState<string | null>(null);
  const [ballPos, setBallPos] = useState<{ x: number; y: number }>({ x: 76, y: 74 });
  const [foamLevel, setFoamLevel] = useState(0);
  const [dragState, setDragState] = useState<ActiveDragState | null>(null);
  const [isHoveringPet, setIsHoveringPet] = useState(false);

  const [previewOutfitId, setPreviewOutfitId] = useState<string | null>(null);
  const [previewAccessoryId, setPreviewAccessoryId] = useState<string | null>(null);
  const [previewBackgroundId, setPreviewBackgroundId] = useState<string | null>(null);
  const [selectedShopItem, setSelectedShopItem] = useState<ShopItem>(SHOP_ITEMS[0]);
  const [sleepNowMs, setSleepNowMs] = useState(() => Date.now());

  const [petMessage, setPetMessage] = useState<string>(
    profile.isSleeping
      ? `Zzz... ${profile.petName} is asleep! Restores +5% Energy every 2 minutes.`
      : `Tap ${profile.petName}, drag snacks from the pantry, or start Bath Time!`
  );
  const [editingPetName, setEditingPetName] = useState(profile.petName);
  const [editingDisplayName, setEditingDisplayName] = useState(profile.displayName);
  const [savingName, setSavingName] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const petDropRef = useRef<HTMLDivElement | null>(null);
  const lastXpGrantRef = useRef<number>(0);
  const lastScrubTickRef = useRef<number>(0);
  const lastFurnTapRef = useRef<number>(0);
  const prevEnergyRef = useRef<number>(profile.energy);
  const moodTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setEditingPetName(profile.petName);
    setEditingDisplayName(profile.displayName);
  }, [profile.petName, profile.displayName]);

  useEffect(() => {
    if (!profile.isSleeping || profile.energy >= 100) return;
    setSleepNowMs(Date.now());
    const interval = window.setInterval(() => {
      setSleepNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [profile.isSleeping, profile.energy]);

  useEffect(() => {
    return () => {
      if (moodTimeoutRef.current !== null) {
        window.clearTimeout(moodTimeoutRef.current);
      }
    };
  }, []);

  const hasStudyPlant = profile.unlockedItems.includes('furn_study_plant');
  const hasOrangeRug = profile.unlockedItems.includes('furn_orange_rug');
  const hasBookshelf = profile.unlockedItems.includes('furn_bookshelf');
  const hasDeskLamp = profile.unlockedItems.includes('furn_desk_lamp');
  const hasMiniArcade = profile.unlockedItems.includes('furn_mini_arcade');
  const hasAquarium = profile.unlockedItems.includes('furn_aquarium');
  const hasTelescope = profile.unlockedItems.includes('furn_telescope');
  const hasBeanbag = profile.unlockedItems.includes('furn_beanbag');
  const hasPlushSofa = profile.unlockedItems.includes('furn_plush_sofa');
  const hasTrophyCase = profile.unlockedItems.includes('furn_trophy_case');
  const ownedFurniture = useMemo(
    () =>
      SHOP_ITEMS.filter(
        (item) => item.category === 'furniture' && profile.unlockedItems.includes(item.id)
      ),
    [profile.unlockedItems]
  );

  const activeBackgroundId = profile.roomBackground || 'bg_default_study';
  const activeBackgroundTheme =
    ROOM_BACKGROUNDS[activeBackgroundId] || ROOM_BACKGROUNDS.bg_default_study;

  const sleepCountdownText = useMemo(() => {
    if (!profile.isSleeping) return null;
    if (profile.energy >= 100) return 'Fully Rested · 100% Energy';
    const baseMs =
      timestampToMillis(profile.sleepTickAt) || timestampToMillis(profile.updatedAt) || sleepNowMs;
    const elapsed = Math.max(0, sleepNowMs - baseMs);
    const remainingMs = Math.max(
      0,
      SLEEP_RECOVERY_INTERVAL_MS - (elapsed % SLEEP_RECOVERY_INTERVAL_MS)
    );
    const totalSec = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `Next +5% Energy in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [profile.isSleeping, profile.energy, profile.sleepTickAt, profile.updatedAt, sleepNowMs]);

  const healthState = useMemo(
    () =>
      getPetHealthState({
        hunger: profile.hunger,
        happiness: profile.happiness,
        energy: profile.energy,
        cleanliness: profile.cleanliness,
      }),
    [profile.cleanliness, profile.energy, profile.happiness, profile.hunger]
  );

  const foodInventory = useMemo(() => profile.foodInventory ?? {}, [profile.foodInventory]);
  const ownedFoods = useMemo(
    () =>
      SHOP_ITEMS.filter(
        (item) => item.category === 'food' && (foodInventory[item.id] ?? 0) > 0
      ),
    [foodInventory]
  );
  const totalFoodCount = useMemo(
    () => Object.values(foodInventory).reduce((sum, count) => sum + Math.max(0, count || 0), 0),
    [foodInventory]
  );

  const xpNeeded = xpRequiredForLevel(profile.petLevel);
  const xpProgress = Math.min(100, Math.round((profile.petXp / xpNeeded) * 100));

  const triggerMood = useCallback((mood: PetMoodState, durationMs = 1100) => {
    setTransientMood(mood);
    setBounceKey((k) => k + 1);
    if (moodTimeoutRef.current !== null) {
      window.clearTimeout(moodTimeoutRef.current);
    }
    moodTimeoutRef.current = window.setTimeout(() => {
      setTransientMood(null);
    }, durationMs);
  }, []);

  const spawnParticle = useCallback((text: string, tone: FloatingParticle['tone']) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const xOffset = Math.round((Math.random() - 0.5) * 90);
    setParticles((prev) => [...prev.slice(-5), { id, text, tone, xOffset }]);
    window.setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1100);
  }, []);

  const computeSmallCareXp = useCallback(
    (wasNeeded: boolean, baseXp: number, allowWhileSick = false): number => {
      if (!wasNeeded) return 0;
      if (healthState.isSick && !allowWhileSick) return 0;
      const now = Date.now();
      if (now - lastXpGrantRef.current < 4500) {
        return 0;
      }
      lastXpGrantRef.current = now;
      const furnitureXpBonus =
        (hasBookshelf ? 1 : 0) + (hasTelescope ? 1 : 0) + (hasTrophyCase ? 2 : 0);
      return baseXp + furnitureXpBonus;
    },
    [hasBookshelf, hasTelescope, hasTrophyCase, healthState.isSick]
  );

  useEffect(() => {
    if (profile.isSleeping && profile.energy > prevEnergyRef.current) {
      const gained = profile.energy - prevEnergyRef.current;
      spawnParticle(`+${gained}% Energy`, 'orange');
      setPetMessage(
        profile.energy >= 100
          ? `Fully Rested! ${profile.petName} reached 100% Energy!`
          : `Zzz... ${profile.petName} recovered +${gained}% Energy from resting!`
      );
    }
    prevEnergyRef.current = profile.energy;
  }, [profile.energy, profile.isSleeping, profile.petName, spawnParticle]);

  const baseMood: PetMoodState = useMemo(() => {
    if (healthState.isSick) return 'sick';
    if (profile.isSleeping) return 'sleepy';
    if (profile.hunger < 28 || profile.cleanliness < 28 || profile.happiness < 25) {
      return 'concerned';
    }
    if (profile.energy < 22) return 'sleepy';
    return 'happy';
  }, [
    healthState.isSick,
    profile.cleanliness,
    profile.energy,
    profile.happiness,
    profile.hunger,
    profile.isSleeping,
  ]);

  const activeMood: PetMoodState =
    dragState?.target.kind === 'food' && isHoveringPet
      ? 'eating'
      : transientMood ?? baseMood;

  const isPointOverPet = useCallback((clientX: number, clientY: number): boolean => {
    const el = petDropRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      clientX >= rect.left - 18 &&
      clientX <= rect.right + 18 &&
      clientY >= rect.top - 18 &&
      clientY <= rect.bottom + 18
    );
  }, []);

  const handleSoapScrub = useCallback(() => {
    soundFx.playCare();
    setFoamLevel((prev) => {
      const next = Math.min(100, prev + 28);
      return next;
    });
    triggerMood('soapy', 1000);
    spawnParticle('Bubbles!', 'sky');
    setPetMessage(`Nice scrub! Now drag or tap the Shower Head to rinse off the foam!`);
  }, [spawnParticle, triggerMood]);

  const handleRinseShower = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      soundFx.playCare();
      triggerMood('showering', 1200);
      const rugBonus = hasOrangeRug ? 4 : 0;
      const aquariumBonus = hasAquarium ? 6 : 0;
      const foamBonus = foamLevel >= 55 ? 16 : 0;
      const cleanBoost = 28 + foamBonus + rugBonus + aquariumBonus;
      const cleanNeeded = profile.cleanliness < 96;
      const gainedXp = computeSmallCareXp(cleanNeeded, foamLevel >= 55 ? 5 : 3, true);
      const nextClean = Math.min(100, profile.cleanliness + cleanBoost);
      const nextHappiness = Math.min(
        100,
        profile.happiness + (foamLevel >= 55 ? 10 : 5) + (hasStudyPlant ? 3 : 0)
      );
      setFoamLevel(0);

      const { petLevel, petXp, leveledUp } = applyXpGain(
        profile.petLevel,
        profile.petXp,
        gainedXp
      );

      spawnParticle(`+${cleanBoost}% Clean`, 'sky');
      if (gainedXp > 0) spawnParticle(`+${gainedXp} XP`, 'green');

      setPetMessage(
        leveledUp
          ? `Level Up! ${profile.petName} reached Level ${petLevel}!`
          : foamBonus > 0
            ? `Sparkling Bath Complete! Soapy scrub + warm rinse (+${cleanBoost}% Clean)!`
            : `Fresh rinse! Use the Soap Bar first for a deeper bubble bath!`
      );

      await onUpdateProfile({
        cleanliness: nextClean,
        happiness: nextHappiness,
        isSleeping: false,
        petXp,
        petLevel,
        ...(profile.lockedOut ? {} : { activeGame: 'Bath Time with Pet' }),
      });
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    computeSmallCareXp,
    foamLevel,
    hasAquarium,
    hasOrangeRug,
    hasStudyPlant,
    onUpdateProfile,
    profile.cleanliness,
    profile.happiness,
    profile.lockedOut,
    profile.petLevel,
    profile.petName,
    profile.petXp,
    spawnParticle,
    triggerMood,
  ]);

  const handleFeedItem = useCallback(
    async (foodId: string, isEmergencyCracker = false) => {
      if (actionBusy) return;
      const foodItem = SHOP_ITEMS.find((i) => i.id === foodId);
      if (!isEmergencyCracker && !foodItem) return;

      const isMedicine = Boolean(foodItem?.isMedicine);
      if (!isMedicine && profile.hunger >= 100 && (foodItem?.energyBoost ?? 0) === 0) {
        soundFx.playClick();
        setPetMessage(`${profile.petName} is completely full right now!`);
        return;
      }

      const currentQty = foodInventory[foodId] ?? 0;
      if (!isEmergencyCracker && currentQty <= 0) {
        soundFx.playWrong();
        setPetMessage('Out of this item! Visit SLA Shop to buy more food or drinks.');
        return;
      }

      setActionBusy(true);
      try {
        soundFx.playCare();
        setFeedingVisualId(foodId);
        triggerMood('eating', 1100);
        window.setTimeout(() => setFeedingVisualId(null), 900);

        const hungerGain = isEmergencyCracker ? 14 : foodItem?.hungerBoost ?? 20;
        const joyGain = isEmergencyCracker ? 2 : foodItem?.happinessBoost ?? 4;
        const lampEnergyBonus = !isEmergencyCracker && foodItem?.isDrink && hasDeskLamp ? 6 : 0;
        const energyGain = isEmergencyCracker ? 0 : (foodItem?.energyBoost ?? 0) + lampEnergyBonus;
        const cleanGain = isEmergencyCracker ? 0 : foodItem?.cleanlinessBoost ?? 0;
        const rugBonus = hasOrangeRug ? 4 : 0;

        const hungerWasNeeded = profile.hunger < 98 || isMedicine;
        const gainedXp = isEmergencyCracker
          ? hungerWasNeeded && !healthState.isSick
            ? 1
            : 0
          : computeSmallCareXp(hungerWasNeeded, foodItem?.xpBoost ?? 4, isMedicine);

        const nextHunger = isMedicine
          ? Math.max(55, Math.min(100, profile.hunger + hungerGain))
          : Math.min(100, profile.hunger + hungerGain);
        const nextHappiness = isMedicine
          ? Math.max(55, Math.min(100, profile.happiness + joyGain + rugBonus))
          : Math.min(100, profile.happiness + joyGain + rugBonus);
        const nextEnergy = isMedicine
          ? Math.max(55, Math.min(100, profile.energy + energyGain))
          : Math.min(100, profile.energy + energyGain);
        const nextClean = isMedicine
          ? Math.max(55, Math.min(100, profile.cleanliness + cleanGain))
          : profile.cleanliness;

        const nextInventory: Record<string, number> = { ...foodInventory };
        if (!isEmergencyCracker) {
          const remaining = currentQty - 1;
          if (remaining > 0) {
            nextInventory[foodId] = remaining;
          } else {
            delete nextInventory[foodId];
          }
        }

        const { petLevel, petXp, leveledUp } = applyXpGain(
          profile.petLevel,
          profile.petXp,
          gainedXp
        );

        if (isMedicine) {
          spawnParticle('Cured!', 'green');
        } else {
          spawnParticle(`+${hungerGain}% Hunger`, 'green');
        }
        if (energyGain > 0) spawnParticle(`+${energyGain}% Energy`, 'orange');
        if (gainedXp > 0) spawnParticle(`+${gainedXp} XP`, 'green');

        const healedNow =
          healthState.isSick &&
          !getPetHealthState({
            hunger: nextHunger,
            happiness: nextHappiness,
            energy: nextEnergy,
            cleanliness: nextClean,
          }).isSick;

        setPetMessage(
          leveledUp
            ? `Level Up! ${profile.petName} reached Level ${petLevel}!`
            : isMedicine || healedNow
              ? `${profile.petName} feels much better and recovered from sickness!`
              : isEmergencyCracker
                ? `Crunch! Emergency Cracker helped keep ${profile.petName} going.`
                : foodItem?.isDrink
                  ? `Glug glug! ${profile.petName} loved the ${foodItem.name}!`
                  : `Nom nom! ${profile.petName} devoured the ${foodItem?.name}!`
        );

        await onUpdateProfile({
          hunger: nextHunger,
          happiness: nextHappiness,
          energy: nextEnergy,
          cleanliness: nextClean,
          isSleeping: false,
          foodInventory: nextInventory,
          petXp,
          petLevel,
          ...(profile.lockedOut ? {} : { activeGame: 'Feeding Pet' }),
        });
      } finally {
        setActionBusy(false);
      }
    },
    [
      actionBusy,
      computeSmallCareXp,
      foodInventory,
      hasDeskLamp,
      hasOrangeRug,
      healthState.isSick,
      onUpdateProfile,
      profile.cleanliness,
      profile.energy,
      profile.happiness,
      profile.hunger,
      profile.lockedOut,
      profile.petLevel,
      profile.petName,
      profile.petXp,
      spawnParticle,
      triggerMood,
    ]
  );

  // Global Pointer Drag Listeners for Foods, Drinks, Soap Bar, and Shower Head
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY);
      const moved = dragState.moved || dist > 8;
      const over = isPointOverPet(e.clientX, e.clientY);
      setIsHoveringPet(over);
      setDragState((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY, moved } : null
      );

      if (moved && over && dragState.target.kind === 'soap') {
        const now = Date.now();
        if (now - lastScrubTickRef.current > 360) {
          lastScrubTickRef.current = now;
          handleSoapScrub();
        }
      }
    };

    const handleUp = (e: PointerEvent) => {
      const over = isPointOverPet(e.clientX, e.clientY);
      const currentTarget = dragState.target;
      const didDrag = dragState.moved;
      setDragState(null);
      setIsHoveringPet(false);

      if (currentTarget.kind === 'food') {
        if (over || !didDrag) {
          void handleFeedItem(currentTarget.itemId, currentTarget.isEmergency);
        }
      } else if (currentTarget.kind === 'soap') {
        if (over || !didDrag) {
          handleSoapScrub();
        }
      } else if (currentTarget.kind === 'shower') {
        if (over || !didDrag) {
          void handleRinseShower();
        }
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragState, handleFeedItem, handleRinseShower, handleSoapScrub, isPointOverPet]);

  const startPointerDrag = (e: React.PointerEvent, target: DragItemKind) => {
    if (actionBusy) return;
    e.preventDefault();
    setDragState({
      target,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    });
    setIsHoveringPet(isPointOverPet(e.clientX, e.clientY));
  };

  const handlePlayBall = async () => {
    if (actionBusy) return;
    if (healthState.isSick) {
      soundFx.playWrong();
      setPetMessage(`${profile.petName} is too sick to play! Feed food, give Bath Time, or use SLA Care Potion.`);
      return;
    }
    if (profile.energy < 8) {
      soundFx.playWrong();
      setPetMessage(`${profile.petName} is too tired to chase the ball! Let your pet rest or drink a Choco Energy Shake.`);
      return;
    }
    setActionBusy(true);
    try {
      soundFx.playCare();
      triggerMood('excited', 950);
      setBallPos({
        x: Math.round(14 + Math.random() * 72),
        y: Math.round(28 + Math.random() * 54),
      });

      const plantBonus = hasStudyPlant ? 5 : 0;
      const beanbagBonus = hasBeanbag ? 6 : 0;
      const roomFunBonus = (hasMiniArcade ? 5 : 0) + (hasPlushSofa ? 5 : 0);
      const joyNeeded = profile.happiness < 96;
      const gainedXp = computeSmallCareXp(joyNeeded, 3);
      const joyBoost = 14 + plantBonus + beanbagBonus + roomFunBonus;
      const nextHappiness = Math.min(100, profile.happiness + joyBoost);
      const nextEnergy = Math.max(0, profile.energy - 6);
      const nextHunger = Math.max(0, profile.hunger - 4);
      const nextClean = Math.max(0, profile.cleanliness - 2);
      const { petLevel, petXp, leveledUp } = applyXpGain(
        profile.petLevel,
        profile.petXp,
        gainedXp
      );

      spawnParticle(`+${joyBoost}% Joy`, 'orange');
      if (gainedXp > 0) spawnParticle(`+${gainedXp} XP`, 'green');

      setPetMessage(
        leveledUp
          ? `Level Up! ${profile.petName} reached Level ${petLevel}!`
          : `${profile.petName} chased the SLA ball across the room!`
      );

      await onUpdateProfile({
        happiness: nextHappiness,
        energy: nextEnergy,
        hunger: nextHunger,
        cleanliness: nextClean,
        isSleeping: false,
        petXp,
        petLevel,
        ...(profile.lockedOut ? {} : { activeGame: 'Playing with Pet' }),
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleDirectPetTap = async () => {
    if (actionBusy) return;

    if (roomMode === 'wash') {
      if (foamLevel < 60) {
        handleSoapScrub();
      } else {
        await handleRinseShower();
      }
      return;
    }

    if (roomMode === 'play') {
      await handlePlayBall();
      return;
    }

    if (healthState.isSick) {
      soundFx.playWrong();
      setPetMessage(
        `${profile.petName} has a fever (${healthState.reasons.join(', ')})! Feed food, give a Bath, or use SLA Care Potion.`
      );
      return;
    }

    setActionBusy(true);
    try {
      soundFx.playCare();
      triggerMood('blushing', 1000);
      const plantBonus =
        (hasStudyPlant ? 3 : 0) + (hasBeanbag ? 6 : 0) + (hasPlushSofa ? 4 : 0);
      const happinessNeeded = profile.happiness < 96;
      const gainedXp = computeSmallCareXp(happinessNeeded, 2);
      const nextHappiness = Math.min(100, profile.happiness + 6 + plantBonus);
      const { petLevel, petXp, leveledUp } = applyXpGain(
        profile.petLevel,
        profile.petXp,
        gainedXp
      );

      spawnParticle(`+${6 + plantBonus}% Joy`, 'rose');
      if (gainedXp > 0) spawnParticle(`+${gainedXp} XP`, 'green');

      setPetMessage(
        leveledUp
          ? `Level Up! ${profile.petName} reached Level ${petLevel}!`
          : happinessNeeded
            ? `${profile.petName} giggles happily from your pat!`
            : `${profile.petName} is already super cheerful! Play quizzes for Coins & XP.`
      );

      await onUpdateProfile({
        happiness: nextHappiness,
        isSleeping: false,
        petXp,
        petLevel,
        ...(profile.lockedOut ? {} : { activeGame: 'Playing with Pet' }),
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleInteractFurniture = (item: ShopItem) => {
    soundFx.playCare();
    triggerMood('excited', 900);
    const messages: Record<string, { badge: string; tone: FloatingParticle['tone']; text: string }> = {
      furn_mini_arcade: {
        badge: 'High Score!',
        tone: 'orange',
        text: `${profile.petName} played a quick round on the Retro Mini Arcade!`,
      },
      furn_aquarium: {
        badge: 'Blub Blub!',
        tone: 'sky',
        text: `${profile.petName} watched the goldfish blow shimmering bubbles!`,
      },
      furn_telescope: {
        badge: 'Starlight!',
        tone: 'green',
        text: `${profile.petName} spotted a bright shooting star through the telescope!`,
      },
      furn_plush_sofa: {
        badge: 'So Comfy!',
        tone: 'rose',
        text: `${profile.petName} bounced playfully on the Cloud Velvet Sofa!`,
      },
      furn_bookshelf: {
        badge: 'Study Boost!',
        tone: 'green',
        text: `${profile.petName} flipped through favorite San Lorenzo storybooks!`,
      },
    };
    const reaction = messages[item.id] || {
      badge: `${item.name}!`,
      tone: 'orange' as const,
      text: `${profile.petName} loves hanging out near the ${item.name}!`,
    };
    spawnParticle(reaction.badge, reaction.tone);
    setPetMessage(reaction.text);

    const now = Date.now();
    if (!profile.isSleeping && profile.happiness < 100 && now - lastFurnTapRef.current > 4000) {
      lastFurnTapRef.current = now;
      void onUpdateProfile({
        happiness: Math.min(100, profile.happiness + 2),
      });
    }
  };

  const handleToggleSleep = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      soundFx.playCare();
      const nextSleeping = !profile.isSleeping;

      if (nextSleeping) {
        triggerMood('sleepy', 1200);
        spawnParticle('Zzz... Resting', 'sky');
        setPetMessage(
          profile.energy >= 100
            ? `Zzz... ${profile.petName} is already at 100% Energy and taking a cozy nap!`
            : `Zzz... ${profile.petName} went to sleep! Recovers +5% Energy every 2 minutes.`
        );
      } else {
        triggerMood('happy', 900);
        setPetMessage(`Good morning! ${profile.petName} is awake and ready to study!`);
      }

      await onUpdateProfile({
        isSleeping: nextSleeping,
        sleepTickAt: serverTimestamp(),
        ...(profile.lockedOut
          ? {}
          : { activeGame: nextSleeping ? 'Pet Sleeping' : 'Pet Home Room' }),
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleBuyFood = async (item: ShopItem, quantity = 1) => {
    if (actionBusy) return;
    if (profile.petLevel < item.requiredLevel) {
      soundFx.playWrong();
      setPetMessage(`Reach Level ${item.requiredLevel} to unlock ${item.name}!`);
      return;
    }

    const totalCost = item.price * quantity;
    if (profile.coins < totalCost) {
      soundFx.playWrong();
      setPetMessage(`Need ${totalCost - profile.coins} more Coins for ${quantity}× ${item.name}! Play quiz games to earn Coins.`);
      return;
    }

    const currentCount = foodInventory[item.id] ?? 0;
    if (currentCount + quantity > 99) {
      soundFx.playWrong();
      setPetMessage(`Pantry limit reached for ${item.name} (max 99).`);
      return;
    }

    setActionBusy(true);
    try {
      soundFx.playLevelUp();
      const nextInventory: Record<string, number> = {
        ...foodInventory,
        [item.id]: currentCount + quantity,
      };
      await onUpdateProfile({
        coins: profile.coins - totalCost,
        foodInventory: nextInventory,
      });
      setPetMessage(`Bought ${quantity}× ${item.name}! Drag it to ${profile.petName} in Feed mode!`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleBuyOrEquip = async (item: ShopItem) => {
    if (item.category === 'food') {
      await handleBuyFood(item, 1);
      return;
    }
    if (actionBusy) return;
    const isOwned = profile.unlockedItems.includes(item.id) || item.price === 0;
    if (isOwned) {
      soundFx.playClick();
      if (item.category === 'clothes') {
        setActionBusy(true);
        try {
          setPreviewOutfitId(null);
          await onUpdateProfile({ outfit: item.id });
          setPetMessage(`Equipped ${item.name}!`);
        } finally {
          setActionBusy(false);
        }
      } else if (item.category === 'accessories') {
        setActionBusy(true);
        try {
          setPreviewAccessoryId(null);
          await onUpdateProfile({ accessory: item.id });
          setPetMessage(`Equipped ${item.name}!`);
        } finally {
          setActionBusy(false);
        }
      } else if (item.category === 'backgrounds') {
        setActionBusy(true);
        try {
          setPreviewBackgroundId(null);
          await onUpdateProfile({ roomBackground: item.id });
          setPetMessage(`Equipped ${item.name} as your Pet Room background!`);
        } finally {
          setActionBusy(false);
        }
      } else {
        setPetMessage(`${item.name} is active and decorating your Pet Room!`);
      }
      return;
    }

    if (profile.petLevel < item.requiredLevel) {
      soundFx.playWrong();
      setPetMessage(`Reach Level ${item.requiredLevel} to unlock ${item.name}!`);
      return;
    }

    if (profile.coins < item.price) {
      soundFx.playWrong();
      setPetMessage(`Need ${item.price - profile.coins} more Coins! Beat quiz games with high accuracy to earn Coins.`);
      return;
    }

    setActionBusy(true);
    try {
      soundFx.playLevelUp();
      const nextUnlocked = Array.from(new Set([...profile.unlockedItems, item.id])).slice(0, 100);
      const patch: Partial<PublicProfile> = {
        coins: profile.coins - item.price,
        unlockedItems: nextUnlocked,
      };
      if (item.category === 'clothes') {
        patch.outfit = item.id;
        setPreviewOutfitId(null);
      }
      if (item.category === 'accessories') {
        patch.accessory = item.id;
        setPreviewAccessoryId(null);
      }
      if (item.category === 'backgrounds') {
        patch.roomBackground = item.id;
        setPreviewBackgroundId(null);
      }
      await onUpdateProfile(patch);
      setPetMessage(
        item.category === 'furniture'
          ? `${item.name} unlocked and placed in your Pet Room!`
          : item.category === 'backgrounds'
            ? `Unlocked & activated ${item.name} in your Pet Room!`
            : `Unlocked & equipped ${item.name}!`
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleTryOnItem = (item: ShopItem) => {
    soundFx.playClick();
    setSelectedShopItem(item);
    if (item.category === 'clothes') {
      setPreviewOutfitId(item.id);
    } else if (item.category === 'accessories') {
      setPreviewAccessoryId(item.id);
    } else if (item.category === 'backgrounds') {
      setPreviewBackgroundId(item.id);
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

  const displayedOutfit = previewOutfitId ?? profile.outfit;
  const displayedAccessory = previewAccessoryId ?? profile.accessory;
  const displayedBackgroundId = previewBackgroundId ?? activeBackgroundId;
  const displayedBackgroundTheme =
    ROOM_BACKGROUNDS[displayedBackgroundId] || ROOM_BACKGROUNDS.bg_default_study;
  const isPreviewingUnsaved =
    (previewOutfitId !== null && previewOutfitId !== profile.outfit) ||
    (previewAccessoryId !== null && previewAccessoryId !== profile.accessory) ||
    (previewBackgroundId !== null && previewBackgroundId !== activeBackgroundId);

  return (
    <div className="space-y-6">
      {/* Floating Drag Ghost Layer */}
      {dragState && (
        <div
          style={{ left: dragState.x, top: dragState.y }}
          className="fixed z-50 -translate-x-1/2 -translate-y-1/2 pointer-events-none drop-shadow-xl scale-110"
        >
          <ShopItemVisual itemId={dragState.target.itemId} size={68} />
        </div>
      )}

      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#EDE8D8] rounded-xl overflow-x-auto">
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
                const nextView = tab.id as HomeSubView;
                setSubView(nextView);
                onSetActivity?.(SUB_VIEW_ACTIVITY[nextView]);
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

        <div className="flex items-center gap-4 text-sm tabular-nums">
          <div className="flex items-center gap-1.5 font-semibold text-[#172A1E]">
            <Coins className="w-4 h-4 text-[#EA7A26]" />
            <span>{profile.coins} Coins</span>
          </div>
          <span className="text-[#D4CCB5]" aria-hidden="true">|</span>
          <div className="font-semibold text-[#1E5B3A]">
            Lv. {profile.petLevel} · {profile.petXp}/{xpNeeded} XP
          </div>
        </div>
      </div>

      {subView === 'room' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Stage: Interactive Pou-Inspired Pet Room */}
          <div className="lg:col-span-7 relative rounded-3xl overflow-hidden border border-[#E5DEC9] bg-white min-h-[500px] flex flex-col justify-between select-none">
            <img
              src={
                profile.isSleeping && activeBackgroundTheme.sleepImageUrl
                  ? activeBackgroundTheme.sleepImageUrl
                  : activeBackgroundTheme.imageUrl
              }
              alt={
                profile.isSleeping
                  ? `${activeBackgroundTheme.name} at night`
                  : activeBackgroundTheme.name
              }
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            />
            <div
              className={`absolute inset-0 transition-colors duration-300 ${
                roomMode === 'wash'
                  ? 'bg-gradient-to-t from-sky-950/65 via-sky-700/30 to-cyan-500/25'
                  : profile.isSleeping
                    ? 'bg-slate-950/60'
                    : 'bg-gradient-to-t from-black/60 via-black/10 to-black/25'
              }`}
            />
            <AmbientRoomEffects
              effect={activeBackgroundTheme.ambientEffect}
              isSleeping={profile.isSleeping}
            />

            {/* Top HUD inside Room */}
            <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="bg-white/95 rounded-2xl px-3.5 py-2 shadow-sm flex items-center gap-3">
                {profile.photoUrl && (
                  <img
                    src={profile.photoUrl}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border-2 border-[#1E5B3A] shrink-0"
                  />
                )}
                <div>
                  <p className="text-sm font-bold text-[#172A1E]">
                    {profile.petName}{' '}
                    <span className="font-normal text-xs text-[#4D6354] capitalize">
                      · Lv. {profile.petLevel} {profile.petSpecies}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-28 sm:w-36 h-1.5 bg-[#E6E0CE] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E5B3A] rounded-full transition-all duration-300"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#4D6354] tabular-nums">
                      {profile.petXp}/{xpNeeded}
                    </span>
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
                Earn Coins &amp; XP
              </button>
            </div>

            {/* Sickness Alert Banner */}
            {healthState.isSick && (
              <div className="relative z-10 mx-4 sm:mx-5 px-3.5 py-2 rounded-2xl bg-red-600/95 text-white text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-sm">
                <span className="flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 shrink-0" />
                  {profile.petName} is Sick ({healthState.reasons.join(' · ')})! Feed food, give a Bath, or use SLA Care Potion.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setShopCategory('food');
                    setSubView('shop');
                    onSetActivity?.(SUB_VIEW_ACTIVITY.shop);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white text-red-700 text-[11px] font-bold hover:bg-red-50 cursor-pointer"
                >
                  Get Care Potion
                </button>
              </div>
            )}

            {/* Interactive Room Furniture & Sleep / Bath Status */}
            <div className="relative z-10 px-5 flex flex-wrap items-center justify-between gap-2 mt-2">
              {ownedFurniture.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 bg-white/90 px-2.5 py-1.5 rounded-2xl shadow-xs max-w-[78%]">
                  {ownedFurniture.map((furn) => (
                    <button
                      key={furn.id}
                      type="button"
                      onClick={() => handleInteractFurniture(furn)}
                      title={`Tap ${furn.name}`}
                      className="p-0.5 rounded-lg hover:bg-[#FAF8F2] active:scale-95 transition-transform cursor-pointer"
                    >
                      <ShopItemVisual itemId={furn.id} size={26} />
                    </button>
                  ))}
                  <span className="text-[11px] font-bold text-[#1E5B3A] ml-1">
                    Tap Item ({ownedFurniture.length})
                  </span>
                </div>
              ) : (
                <span className="bg-white/85 px-2.5 py-1 rounded-xl text-[11px] font-semibold text-[#172A1E]">
                  {activeBackgroundTheme.name}
                </span>
              )}

              <div className="flex items-center gap-2">
                {profile.isSleeping && sleepCountdownText && (
                  <div className="bg-slate-900/90 border border-amber-300/40 px-3 py-1 rounded-xl text-[11px] font-bold text-amber-200 flex items-center gap-1.5 shadow-xs tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    {sleepCountdownText}
                  </div>
                )}
                {roomMode === 'wash' && (
                  <div className="bg-sky-50/95 border border-sky-200 px-3 py-1 rounded-xl text-[11px] font-bold text-sky-800 flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    Bath Time · Soap Foam {foamLevel}%
                  </div>
                )}
              </div>
            </div>

            {/* Center Interactive Pet Stage (Drop Zone) */}
            <div className="relative z-10 flex flex-col items-center justify-end pb-4 px-4 flex-1">
              <div className="bg-white/95 text-[#172A1E] text-xs font-medium px-4 py-2 rounded-2xl shadow-sm mb-2 max-w-sm text-center">
                {petMessage}
              </div>

              <div
                ref={petDropRef}
                className={`relative flex items-center justify-center rounded-full transition-all ${
                  isHoveringPet && dragState
                    ? 'ring-4 ring-[#FACC15] bg-white/20 scale-105'
                    : ''
                }`}
              >
                {/* Drop Hint Badge */}
                {isHoveringPet && dragState && (
                  <span className="pointer-events-none absolute -top-7 z-30 px-3 py-1 rounded-lg bg-[#EA7A26] text-white text-xs font-extrabold shadow-sm whitespace-nowrap">
                    {dragState.target.kind === 'food'
                      ? 'Drop to Feed!'
                      : dragState.target.kind === 'soap'
                        ? 'Scrubbing Suds!'
                        : 'Release to Rinse!'}
                  </span>
                )}

                {/* Floating feedback badges */}
                {particles.map((pt) => (
                  <span
                    key={pt.id}
                    style={{ marginLeft: `${pt.xOffset}px` }}
                    className={`pointer-events-none absolute -top-2 z-20 px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-sm animate-float-feedback whitespace-nowrap ${
                      pt.tone === 'green'
                        ? 'bg-[#1E5B3A] text-white'
                        : pt.tone === 'orange'
                          ? 'bg-[#EA7A26] text-white'
                          : pt.tone === 'sky'
                            ? 'bg-sky-500 text-white'
                            : 'bg-rose-500 text-white'
                    }`}
                  >
                    {pt.text}
                  </span>
                ))}

                {/* Flying Food Visual when feeding */}
                {feedingVisualId && (
                  <div className="pointer-events-none absolute z-20 -bottom-1 animate-bounce">
                    <ShopItemVisual itemId={feedingVisualId} size={56} />
                  </div>
                )}

                {/* Bouncy Toy Ball in Play Mode */}
                {roomMode === 'play' && (
                  <button
                    type="button"
                    onClick={() => void handlePlayBall()}
                    style={{ left: `${ballPos.x}%`, top: `${ballPos.y}%` }}
                    aria-label="Bounce toy ball"
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-gradient-to-br from-[#EA7A26] to-[#FACC15] border-2 border-[#2C2A24] shadow-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
                  >
                    <span className="w-5 h-5 rounded-full border-2 border-white/80" />
                  </button>
                )}

                {/* Interactive Pet Button */}
                <button
                  type="button"
                  onClick={() => void handleDirectPetTap()}
                  aria-label={`Interact with ${profile.petName}`}
                  className="relative rounded-full p-2 transition-transform focus:outline-none cursor-pointer hover:scale-[1.03] active:scale-95"
                >
                  <div key={bounceKey} className={bounceKey > 0 ? 'animate-pet-bounce' : ''}>
                    <PetAvatar
                      species={profile.petSpecies}
                      color={profile.petColor}
                      outfit={profile.outfit}
                      accessory={profile.accessory}
                      role={profile.role}
                      isSleeping={profile.isSleeping}
                      mood={activeMood}
                      cleanliness={profile.cleanliness}
                      foamLevel={roomMode === 'wash' ? foamLevel : 0}
                      size={195}
                      className={profile.isSleeping ? '' : 'animate-float-gentle'}
                    />
                  </div>
                </button>
              </div>

              <p className="text-[11px] font-semibold text-white/95 drop-shadow-xs mt-1 text-center">
                {roomMode === 'pet' && `Tap ${profile.petName} to pat & cheer up`}
                {roomMode === 'feed' && `Drag any food or drink onto ${profile.petName} (or tap to serve)`}
                {roomMode === 'play' && 'Tap the bouncy ball or your pet to play fetch!'}
                {roomMode === 'wash' && `Drag the Soap Bar to lather foam, then drag the Shower Head to rinse!`}
              </p>
            </div>

            {/* Bottom Pou-Style Interactive Food & Drink Pantry Drawer */}
            {roomMode === 'feed' && (
              <div className="relative z-20 bg-white/95 border-t border-[#E5DEC9] px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-[#172A1E]">
                    Drag Food &amp; Drinks to {profile.petName} ({totalFoodCount} in pantry)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setShopCategory('food');
                      setSubView('shop');
                      onSetActivity?.(SUB_VIEW_ACTIVITY.shop);
                    }}
                    className="text-xs font-bold text-[#EA7A26] hover:text-[#C65B10] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Buy Food &amp; Drinks
                  </button>
                </div>

                {ownedFoods.length > 0 ? (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 touch-none">
                    {ownedFoods.map((food) => {
                      const qty = foodInventory[food.id] ?? 0;
                      return (
                        <button
                          key={food.id}
                          type="button"
                          disabled={actionBusy}
                          onPointerDown={(e) =>
                            startPointerDrag(e, { kind: 'food', itemId: food.id })
                          }
                          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5DEC9] bg-[#FAF8F2] hover:border-[#1E5B3A] hover:bg-white transition-colors cursor-grab active:cursor-grabbing disabled:opacity-50 select-none"
                        >
                          <ShopItemVisual itemId={food.id} size={38} />
                          <div className="text-left">
                            <p className="text-xs font-bold text-[#172A1E] whitespace-nowrap">
                              {food.name}{' '}
                              <span className="text-[#EA7A26] tabular-nums">×{qty}</span>
                            </p>
                            <p className="text-[11px] text-[#4D6354] tabular-nums">
                              {food.isMedicine
                                ? 'Cures Sickness!'
                                : food.isDrink
                                  ? `+${food.energyBoost ?? 0}% Energy · +${food.hungerBoost ?? 0}% Hunger`
                                  : `+${food.hungerBoost ?? 0}% Hunger`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 py-1">
                    <p className="text-xs text-[#4D6354]">
                      Your pantry is empty! Buy food, drinks, or Care Potion in the SLA Shop.
                    </p>
                    <div className="flex items-center gap-2">
                      {profile.hunger < 30 && profile.coins < 25 && (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onPointerDown={(e) =>
                            startPointerDrag(e, {
                              kind: 'food',
                              itemId: 'food_cracker',
                              isEmergency: true,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-[#1E5B3A] text-[#1E5B3A] text-xs font-bold hover:bg-[#1E5B3A]/5 cursor-grab flex items-center gap-1.5 touch-none"
                        >
                          <ShopItemVisual itemId="food_cracker" size={22} />
                          Drag Emergency Cracker (+14%)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          soundFx.playClick();
                          setShopCategory('food');
                          setSubView('shop');
                          onSetActivity?.(SUB_VIEW_ACTIVITY.shop);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#EA7A26] text-white text-xs font-bold hover:bg-[#D46818] cursor-pointer"
                      >
                        Go to Food Shop
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Bath Time Interactive Dock */}
            {roomMode === 'wash' && (
              <div className="relative z-20 bg-white/95 border-t border-sky-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#172A1E]">
                      Bath Time Station · Scrub with Soap, then Rinse with Shower
                    </p>
                    <p className="text-[11px] text-[#4D6354]">
                      Drag either tool over {profile.petName} (or tap to use). Foam bonus at 60%+!
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 touch-none">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onPointerDown={(e) =>
                        startPointerDrag(e, { kind: 'soap', itemId: 'tool_soap' })
                      }
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-pink-300 bg-pink-50 hover:bg-pink-100 text-xs font-bold text-pink-900 cursor-grab active:cursor-grabbing select-none"
                    >
                      <ShopItemVisual itemId="tool_soap" size={30} />
                      Soap Bar ({foamLevel}%)
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onPointerDown={(e) =>
                        startPointerDrag(e, { kind: 'shower', itemId: 'tool_shower' })
                      }
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-xs font-bold text-sky-900 cursor-grab active:cursor-grabbing select-none"
                    >
                      <ShopItemVisual itemId="tool_shower" size={30} />
                      Shower Rinse
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Deck: Care Meters & Interactive Pou Tools */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E5DEC9] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-[#172A1E]">Companion Health &amp; Care</h3>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                    healthState.isSick
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-50 text-[#1E5B3A]'
                  }`}
                >
                  {healthState.isSick ? 'Sick' : 'Healthy'}
                </span>
              </div>
              <p className="text-xs text-[#4D6354] mt-1">
                Neglected pets lose energy and get sick! Drag food, give Bath Time, and play quizzes to level up and unlock expensive gear.
              </p>

              <div className="space-y-4 mt-6">
                {[
                  {
                    label: 'Hunger',
                    value: Math.min(100, Math.max(0, profile.hunger)),
                    color: profile.hunger < 28 ? 'bg-red-500' : 'bg-[#2E7D32]',
                    status: profile.hunger >= 50 ? 'Satisfied' : profile.hunger < 25 ? 'Starving!' : 'Hungry',
                  },
                  {
                    label: 'Happiness',
                    value: Math.min(100, Math.max(0, profile.happiness)),
                    color: profile.happiness < 25 ? 'bg-red-500' : 'bg-[#EA7A26]',
                    status: profile.happiness >= 50 ? 'Cheerful' : 'Needs Play',
                  },
                  {
                    label: 'Energy',
                    value: Math.min(100, Math.max(0, profile.energy)),
                    color: profile.energy < 22 ? 'bg-red-500' : 'bg-[#F59E0B]',
                    status: profile.energy >= 45 ? 'Energetic' : 'Sleepy',
                  },
                  {
                    label: 'Cleanliness',
                    value: Math.min(100, Math.max(0, profile.cleanliness)),
                    color: profile.cleanliness < 28 ? 'bg-red-500' : 'bg-[#0EA5E9]',
                    status: profile.cleanliness >= 50 ? 'Fresh & Clean' : 'Needs Bath!',
                  },
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
                    {stat.label === 'Energy' && profile.isSleeping && sleepCountdownText && (
                      <p className="text-[11px] font-semibold text-[#EA7A26] mt-1 flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {sleepCountdownText} (+5% every 2 mins)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#ECE7D8] space-y-3">
              <p className="text-xs font-semibold text-[#4D6354]">Interactive Pet Tools</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRoomMode('pet');
                    setPetMessage(`Tap ${profile.petName} directly to pat and make it blush!`);
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                    roomMode === 'pet'
                      ? 'border-[#1E5B3A] bg-[#1E5B3A]/10 text-[#1E5B3A]'
                      : 'border-[#E5DEC9] text-[#172A1E] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <Hand className="w-4 h-4 text-[#1E5B3A]" />
                  Pat
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRoomMode('feed');
                    setPetMessage(`Drag food or drinks onto ${profile.petName} from the pantry!`);
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                    roomMode === 'feed'
                      ? 'border-[#2E7D32] bg-[#2E7D32]/10 text-[#1E5B3A]'
                      : 'border-[#E5DEC9] text-[#172A1E] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <Utensils className="w-4 h-4 text-[#2E7D32]" />
                  Feed ({totalFoodCount})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRoomMode('play');
                    setPetMessage('Tap the bouncy ball in the room to play fetch!');
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                    roomMode === 'play'
                      ? 'border-[#EA7A26] bg-[#EA7A26]/10 text-[#C65B10]'
                      : 'border-[#E5DEC9] text-[#172A1E] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <Gamepad2 className="w-4 h-4 text-[#EA7A26]" />
                  Play Ball
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setRoomMode('wash');
                    setPetMessage(`Bath Time! Drag the Soap Bar over ${profile.petName}, then rinse with the Shower Head!`);
                  }}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                    roomMode === 'wash'
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-[#E5DEC9] text-[#172A1E] hover:bg-[#FAF8F2]'
                  }`}
                >
                  <Bath className="w-4 h-4 text-sky-500" />
                  Bath Time
                </button>

                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleToggleSleep()}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 col-span-2 sm:col-span-1 ${
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
                  {profile.isSleeping ? 'Wake' : 'Sleep'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subView === 'shop' && (
        <div className="bg-white rounded-3xl border border-[#E5DEC9] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#ECE7D8]">
            <div>
              <h3 className="text-xl font-bold text-[#172A1E] flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#EA7A26]" />
                San Lorenzo Academy Shop
              </h3>
              <p className="text-xs text-[#4D6354] mt-1">
                Level up your pet and save Coins from quizzes to unlock foods, drinks, outfits, accessories, furniture, and cool room backgrounds.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FAF8F2] rounded-xl border border-[#E5DEC9]">
              {(
                [
                  { id: 'food', label: 'Foods & Drinks' },
                  { id: 'clothes', label: 'Clothes' },
                  { id: 'accessories', label: 'Accessories' },
                  { id: 'furniture', label: 'Furniture' },
                  { id: 'backgrounds', label: 'Backgrounds' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setShopCategory(cat.id);
                    const firstInCat = SHOP_ITEMS.find((i) => i.category === cat.id);
                    if (firstInCat) {
                      setSelectedShopItem(firstInCat);
                      if (cat.id === 'backgrounds') {
                        setPreviewBackgroundId(firstInCat.id);
                      }
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    shopCategory === cat.id ? 'bg-[#1E5B3A] text-white' : 'text-[#4D6354]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Try-On & Item Preview Stage */}
          <div className="rounded-2xl bg-[#FAF8F2] border border-[#E5DEC9] p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-5 flex items-center justify-center gap-4 bg-white rounded-2xl border border-[#ECE7D8] p-4 relative overflow-hidden min-h-[188px]">
              <img
                src={displayedBackgroundTheme.imageUrl}
                alt={displayedBackgroundTheme.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-black/20" />
              <AmbientRoomEffects effect={displayedBackgroundTheme.ambientEffect} />

              <div className="relative z-10 flex items-center justify-center gap-4">
                <PetAvatar
                  species={profile.petSpecies}
                  color={profile.petColor}
                  outfit={displayedOutfit}
                  accessory={displayedAccessory}
                  role={profile.role}
                  mood={selectedShopItem.category === 'food' ? 'happy' : 'excited'}
                  cleanliness={profile.cleanliness}
                  size={148}
                  className="animate-float-gentle"
                />
                {(selectedShopItem.category === 'food' || selectedShopItem.category === 'furniture') && (
                  <div className="flex flex-col items-center bg-white/95 rounded-xl p-2 shadow-sm">
                    <ShopItemVisual itemId={selectedShopItem.id} size={72} />
                    <span className="text-[11px] font-bold text-[#4D6354] mt-1">Preview</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-7 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#EA7A26]">
                    Live Fitting &amp; Room Preview · Requires Lv. {selectedShopItem.requiredLevel}
                  </p>
                  <h4 className="text-lg font-extrabold text-[#172A1E]">{selectedShopItem.name}</h4>
                </div>
                {isPreviewingUnsaved && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setPreviewOutfitId(null);
                      setPreviewAccessoryId(null);
                      setPreviewBackgroundId(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#D8D0BC] bg-white text-xs font-semibold text-[#4D6354] hover:text-[#172A1E] flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Preview
                  </button>
                )}
              </div>

              <p className="text-xs text-[#4D6354] leading-relaxed">{selectedShopItem.description}</p>

              {selectedShopItem.category === 'food' && (
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#1E5B3A] tabular-nums">
                  {selectedShopItem.hungerBoost && <span>+{selectedShopItem.hungerBoost}% Hunger</span>}
                  {selectedShopItem.happinessBoost && <span>+{selectedShopItem.happinessBoost}% Joy</span>}
                  {selectedShopItem.energyBoost ? <span>+{selectedShopItem.energyBoost}% Energy</span> : null}
                  {selectedShopItem.cleanlinessBoost ? <span>+{selectedShopItem.cleanlinessBoost}% Clean</span> : null}
                  {selectedShopItem.xpBoost && <span>+{selectedShopItem.xpBoost} XP</span>}
                  <span className="text-[#EA7A26]">
                    In Pantry: ×{foodInventory[selectedShopItem.id] ?? 0}
                  </span>
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                {profile.petLevel < selectedShopItem.requiredLevel ? (
                  <span className="px-4 py-2 rounded-xl bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Unlocks at Level {selectedShopItem.requiredLevel} (You are Lv. {profile.petLevel})
                  </span>
                ) : selectedShopItem.category === 'food' ? (
                  <>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void handleBuyFood(selectedShopItem, 1)}
                      className="px-4 py-2 rounded-xl bg-[#EA7A26] hover:bg-[#D46818] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Buy 1 · {selectedShopItem.price} Coins
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void handleBuyFood(selectedShopItem, 3)}
                      className="px-4 py-2 rounded-xl border border-[#EA7A26] text-[#C65B10] hover:bg-[#EA7A26]/10 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      Buy 3 · {selectedShopItem.price * 3} Coins
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleBuyOrEquip(selectedShopItem)}
                    className="px-4 py-2 rounded-xl bg-[#1E5B3A] hover:bg-[#17462C] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {profile.outfit === selectedShopItem.id ||
                    profile.accessory === selectedShopItem.id ||
                    activeBackgroundId === selectedShopItem.id
                      ? 'Currently Equipped'
                      : profile.unlockedItems.includes(selectedShopItem.id) || selectedShopItem.price === 0
                        ? selectedShopItem.category === 'furniture'
                          ? 'Active in Room'
                          : 'Equip Now'
                        : `Buy ${selectedShopItem.name} · ${selectedShopItem.price} Coins`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Visible Item Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SHOP_ITEMS.filter((i) => i.category === shopCategory).map((item) => {
              const isFood = item.category === 'food';
              const isBackground = item.category === 'backgrounds';
              const owned = !isFood && (profile.unlockedItems.includes(item.id) || item.price === 0);
              const equipped =
                !isFood &&
                (profile.outfit === item.id ||
                  profile.accessory === item.id ||
                  activeBackgroundId === item.id);
              const isSelected = selectedShopItem.id === item.id;
              const foodQty = foodInventory[item.id] ?? 0;
              const levelLocked = !owned && profile.petLevel < item.requiredLevel;

              return (
                <div
                  key={item.id}
                  onClick={() => handleTryOnItem(item)}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#1E5B3A] bg-white shadow-sm'
                      : 'border-[#E5DEC9] bg-[#FAF8F2]/60 hover:bg-white'
                  }`}
                >
                  <div>
                    {/* Visible Item Artwork Stage */}
                    <div className="w-full h-28 rounded-xl bg-white border border-[#ECE7D8] flex items-center justify-center relative mb-3 overflow-hidden">
                      {isBackground && item.backgroundUrl ? (
                        <img
                          src={item.backgroundUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShopItemVisual itemId={item.id} size={82} />
                      )}
                      <span
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                          levelLocked
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-white/95 text-[#4D6354] border border-[#E5DEC9]'
                        }`}
                      >
                        Lv. {item.requiredLevel}
                      </span>
                      {isFood && foodQty > 0 && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[#1E5B3A] text-white text-[11px] font-bold tabular-nums">
                          ×{foodQty}
                        </span>
                      )}
                      {!isFood && (item.category === 'clothes' || item.category === 'accessories' || isBackground) && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/95 border border-[#E5DEC9] text-[10px] font-bold text-[#4D6354] flex items-center gap-1">
                          {isBackground ? <ImageIcon className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {isBackground ? 'Preview' : 'Try On'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-[#172A1E]">{item.name}</h4>
                      {item.isMedicine ? (
                        <span className="text-[10px] font-bold text-emerald-700">Medicine</span>
                      ) : item.isDrink ? (
                        <span className="text-[10px] font-bold text-sky-700">Drink</span>
                      ) : isBackground ? (
                        <span className="text-[10px] font-bold text-[#1E5B3A]">Theme</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-[#4D6354] mt-1 leading-relaxed">{item.description}</p>
                    {isFood && (
                      <p className="text-[11px] font-semibold text-[#1E5B3A] mt-2 tabular-nums">
                        +{item.hungerBoost}% Hunger · +{item.happinessBoost}% Joy
                        {item.energyBoost ? ` · +${item.energyBoost}% Energy` : ''}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={actionBusy || levelLocked}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedShopItem(item);
                      void handleBuyOrEquip(item);
                    }}
                    className={`mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                      equipped
                        ? 'bg-[#1E5B3A] text-white'
                        : levelLocked
                          ? 'bg-stone-200 text-stone-700 cursor-not-allowed'
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
                    ) : levelLocked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Unlock at Lv. {item.requiredLevel}
                      </>
                    ) : owned ? (
                      item.category === 'furniture' ? 'Active in Room' : 'Equip Item'
                    ) : (
                      <>
                        <ShoppingBag className="w-3.5 h-3.5" />
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
              cleanliness={profile.cleanliness}
              mood={healthState.isSick ? 'sick' : 'happy'}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-xs font-semibold text-[#172A1E] mb-1.5">
                  Room Background
                </label>
                <select
                  value={activeBackgroundId}
                  onChange={(e) => {
                    soundFx.playClick();
                    void onUpdateProfile({ roomBackground: e.target.value });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D0BC] text-sm bg-white"
                >
                  {SHOP_ITEMS.filter(
                    (i) =>
                      i.category === 'backgrounds' &&
                      (i.price === 0 ||
                        profile.unlockedItems.includes(i.id) ||
                        i.id === activeBackgroundId)
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
