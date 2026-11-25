export const STARTING_COINS = 30;

export const STARTER_FOOD_INVENTORY: Record<string, number> = {
  food_pandesal: 1,
};

/**
 * Challenging progressive XP requirement per pet level:
 * Lv 1 -> 2: 250 XP
 * Lv 2 -> 3: 338 XP
 * Lv 3 -> 4: 456 XP
 * Lv 4 -> 5: 615 XP
 * Lv 5 -> 6: 830 XP
 */
export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.min(999, Math.round(level)));
  return Math.round(250 * Math.pow(1.35, safeLevel - 1));
}

export function applyXpGain(
  currentLevel: number,
  currentXp: number,
  gainedXp: number
): { petLevel: number; petXp: number; leveledUp: boolean } {
  let petLevel = Math.max(1, Math.min(999, Math.round(currentLevel)));
  let petXp = Math.max(0, Math.round(currentXp)) + Math.max(0, Math.round(gainedXp));
  let leveledUp = false;

  while (petLevel < 999 && petXp >= xpRequiredForLevel(petLevel)) {
    petXp -= xpRequiredForLevel(petLevel);
    petLevel += 1;
    leveledUp = true;
  }

  return {
    petLevel: Math.min(999, petLevel),
    petXp: Math.min(1000000, petXp),
    leveledUp,
  };
}

/**
 * Challenging quiz payouts: rewards accuracy and high scores rather than participation.
 */
export function calculateQuizRewards(params: {
  score: number;
  correctCount: number;
  totalCount: number;
}): { earnedCoins: number; earnedXp: number } {
  const safeScore = Math.max(0, Math.round(params.score));
  const safeCorrect = Math.max(0, Math.round(params.correctCount));
  const safeTotal = Math.max(safeCorrect, Math.round(params.totalCount));

  if (safeCorrect === 0) {
    return { earnedCoins: 0, earnedXp: 4 };
  }

  const accuracy = safeTotal > 0 ? safeCorrect / safeTotal : 0;
  const accuracyCoinBonus = accuracy >= 0.9 ? 6 : accuracy >= 0.75 ? 3 : 0;
  const accuracyXpBonus = accuracy >= 0.9 ? 18 : accuracy >= 0.75 ? 10 : 0;

  const earnedCoins = Math.max(
    4,
    Math.min(45, Math.round(safeScore / 14) + safeCorrect * 2 + accuracyCoinBonus)
  );
  const earnedXp = Math.max(
    12,
    Math.min(140, Math.round(safeScore / 7) + safeCorrect * 6 + accuracyXpBonus)
  );

  return { earnedCoins, earnedXp };
}

/**
 * Determines whether the pet has fallen sick from neglected hunger, hygiene, energy, or happiness.
 */
export function getPetHealthState(stats: {
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
}): {
  isSick: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (stats.hunger <= 24) reasons.push('Hungry');
  if (stats.cleanliness <= 24) reasons.push('Needs Bath');
  if (stats.energy <= 18) reasons.push('Exhausted');
  if (stats.happiness <= 18) reasons.push('Lonely');

  const lowMeters = [
    stats.hunger < 30,
    stats.cleanliness < 30,
    stats.energy < 24,
    stats.happiness < 24,
  ].filter(Boolean).length;

  const isSick =
    stats.hunger <= 15 ||
    stats.cleanliness <= 15 ||
    lowMeters >= 2;

  return { isSick, reasons };
}
