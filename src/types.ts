export type UserRole = 'student' | 'teacher' | 'admin';

export interface AuthorizedFaculty {
  email: string;
  role: 'teacher' | 'admin';
  fullName: string;
  addedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface AccessCodesConfig {
  teacherCode: string;
  adminCode: string;
  updatedBy: string;
  updatedAt: unknown;
}

export type PetSpecies = 'cat' | 'dog' | 'bunny' | 'turtle' | 'hamster' | 'penguin';

export type AppTab = 'home' | 'games' | 'leaderboard' | 'monitor';

export type ThemeColor = 'white' | 'green' | 'orange';

export type GameId =
  | 'lorenscape'
  | 'on_the_run'
  | 'brainzone'
  | 'grab_it'
  | 'catch_the_duck'
  | 'word_quest'
  | 'math_dash'
  | 'quiz_master'
  | 'memory_match'
  | 'sorting_squad'
  | 'quick_recall';

export interface PublicProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  petSpecies: PetSpecies;
  petName: string;
  petLevel: number;
  petXp: number;
  coins: number;
  outfit: string;
  accessory: string;
  petColor: string;
  uniformStyle: string;
  unlockedItems: string[];
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  totalScore: number;
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  isSleeping: boolean;
  lockedOut: boolean;
  lockReason: string;
  activeGame: string;
  photoUrl?: string;
  isOnline?: boolean;
  lastSeenAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  section: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  answer: string;
  options: string[];
  hint: string;
  category?: string;
}

export interface QuizDeck {
  id: string;
  title: string;
  subject: string;
  description: string;
  sourceType: 'custom' | 'pptx';
  teacherId: string;
  teacherName: string;
  questions: QuizQuestion[];
  isPublished: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ScoreRecord {
  id: string;
  studentId: string;
  studentName: string;
  petName: string;
  petSpecies: string;
  gameId: GameId;
  gameTitle: string;
  subject: string;
  deckId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  durationSeconds: number;
  createdAt: unknown;
}

export interface AntiCheatAlert {
  id: string;
  studentId: string;
  studentName: string;
  petName: string;
  gameId: string;
  gameTitle: string;
  subject: string;
  reason: string;
  status: 'locked' | 'allowed';
  resolvedBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface GameMetadata {
  id: GameId;
  number: number;
  title: string;
  tagline: string;
  modeLabel: string;
  isSignature?: boolean;
  rewardCoins: number;
}

export interface ShopItem {
  id: string;
  name: string;
  category: 'clothes' | 'accessories' | 'furniture';
  price: number;
  description: string;
  previewColor: string;
}
