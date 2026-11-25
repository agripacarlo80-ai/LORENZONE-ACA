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
  | 'quick_recall'
  | 'four_pics_one_word';

export type QuestionType =
  | 'multiple_choice'
  | 'identification'
  | 'fill_in_blank'
  | 'enumeration'
  | 'four_pics';

export interface CluePanel {
  label: string;
  emoji?: string;
  imageUrl?: string;
}

export interface GeneratedSlide {
  slideNumber: number;
  title: string;
  subtitle: string;
  bullets: string[];
  keyTerm: string;
  speakerNote: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PublicProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  approvalStatus?: ApprovalStatus;
  approvalNote?: string;
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
  sleepTickAt?: unknown;
  roomBackground?: string;
  lockedOut: boolean;
  lockReason: string;
  activeGame: string;
  section?: string;
  photoUrl?: string;
  isOnline?: boolean;
  lastSeenAt?: unknown;
  foodInventory?: Record<string, number>;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SchoolIdVerification {
  uid: string;
  studentName: string;
  email: string;
  section: string;
  schoolIdNumber: string;
  idPhotoUrl: string;
  status: ApprovalStatus;
  reviewedBy: string;
  reviewNote: string;
  submittedAt: unknown;
  updatedAt: unknown;
}

export interface SectionChangeRequest {
  uid: string;
  studentName: string;
  currentSection: string;
  requestedSection: string;
  reason: string;
  status: ApprovalStatus;
  reviewedBy: string;
  reviewNote: string;
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
  questionType?: QuestionType;
  enumerationItems?: string[];
  cluePanels?: CluePanel[];
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

export type ShopCategory = 'food' | 'clothes' | 'accessories' | 'furniture' | 'backgrounds';

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  price: number;
  requiredLevel: number;
  description: string;
  previewColor: string;
  backgroundUrl?: string;
  hungerBoost?: number;
  happinessBoost?: number;
  energyBoost?: number;
  cleanlinessBoost?: number;
  xpBoost?: number;
  isDrink?: boolean;
  isMedicine?: boolean;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface AttendanceRecord {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  section: string;
  status: AttendanceStatus;
  source: 'auto' | 'teacher';
  markedBy: string;
  note: string;
  checkInAt: unknown;
  updatedAt: unknown;
}

export interface ClassroomSession {
  id: string;
  section: string;
  teacherId: string;
  teacherName: string;
  gameId: GameId;
  gameTitle: string;
  deckId: string;
  deckTitle: string;
  subject: string;
  status: 'active' | 'ended';
  startedAt: unknown;
  updatedAt: unknown;
}



