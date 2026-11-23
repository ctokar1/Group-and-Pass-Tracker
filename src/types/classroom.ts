export const WORKSPACE_ID = 'chuh_shared';
export const MAX_QUARTER_PASSES = 4;

export const AUTHORIZED_TEACHER_EMAILS = [
  'c_tokar@chuh.org',
  'j_kravitz@chuh.org',
] as const;

export const LIMITS = {
  ID_MAX: 128,
  SECTION_NAME_MAX: 120,
  STUDENT_NAME_MAX: 100,
  GROUP_NAME_MAX: 60,
  EMAIL_MAX: 256,
  MAX_GROUPS: 8,
  MAX_GROUP_STUDENTS: 100,
  MAX_PASSES: 10,
  DEFAULT_MAX_PASSES: 4,
  MAX_DURATION_MINUTES: 10080,
  MAX_DURATION_SECONDS: 604800,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
} as const;

export type ThemeId = 'gold' | 'sapphire' | 'emerald' | 'violet' | 'crimson' | 'tangerine';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  subtitle: string;
  bgHex: string;
  surfaceHex: string;
  accentHex: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'gold',
    name: 'Heights Tiger Gold',
    subtitle: 'Classic Black & Gold',
    bgHex: '#020617',
    surfaceHex: '#0f172a',
    accentHex: '#fbbf24',
  },
  {
    id: 'sapphire',
    name: 'Midnight Sapphire',
    subtitle: 'Deep Navy & Electric Sky',
    bgHex: '#040a17',
    surfaceHex: '#0a1428',
    accentHex: '#38bdf8',
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    subtitle: 'Pine Slate & Mint Green',
    bgHex: '#02100c',
    surfaceHex: '#061d16',
    accentHex: '#34d399',
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    subtitle: 'Obsidian & Lavender',
    bgHex: '#090614',
    surfaceHex: '#120d26',
    accentHex: '#c084fc',
  },
  {
    id: 'crimson',
    name: 'Crimson Blaze',
    subtitle: 'Charcoal & Rose Red',
    bgHex: '#12060a',
    surfaceHex: '#1f0c12',
    accentHex: '#fb7185',
  },
  {
    id: 'tangerine',
    name: 'Sunset Tangerine',
    subtitle: 'Warm Espresso & Orange',
    bgHex: '#110a05',
    surfaceHex: '#1d120a',
    accentHex: '#fb923c',
  },
];

export type ActiveTab = 'groups' | 'roster' | 'settings' | 'passes' | 'history';

export interface AppSettings {
  theme: ThemeId;
  defaultTab: ActiveTab;
  defaultQuickSize: number;
  defaultQuickCount: number;
  defaultForceExactCount: boolean;
  defaultTimerSeconds: number;
  timerSoundEnabled: boolean;
  longPassAlertMinutes: number;
  maxQuarterPasses: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'gold',
  defaultTab: 'passes',
  defaultQuickSize: 4,
  defaultQuickCount: 0,
  defaultForceExactCount: false,
  defaultTimerSeconds: 300,
  timerSoundEnabled: true,
  longPassAlertMinutes: 7,
  maxQuarterPasses: 4,
};

export interface ColorDefinition {
  name: string;
  color: string;
  border: string;
  bg: string;
  text: string;
}

export const COLOR_DEFINITIONS: ColorDefinition[] = [
  { name: 'Blue Table', color: 'bg-blue-600', border: 'border-blue-500', bg: 'bg-blue-950/30', text: 'text-blue-400' },
  { name: 'Red Table', color: 'bg-rose-600', border: 'border-rose-500', bg: 'bg-rose-950/30', text: 'text-rose-400' },
  { name: 'Green Table', color: 'bg-emerald-600', border: 'border-emerald-500', bg: 'bg-emerald-950/30', text: 'text-emerald-400' },
  { name: 'Yellow Table', color: 'bg-amber-500', border: 'border-amber-400', bg: 'bg-amber-950/30', text: 'text-amber-300' },
  { name: 'Purple Table', color: 'bg-purple-600', border: 'border-purple-500', bg: 'bg-purple-950/30', text: 'text-purple-400' },
  { name: 'Orange Table', color: 'bg-orange-500', border: 'border-orange-400', bg: 'bg-orange-950/30', text: 'text-orange-400' },
  { name: 'Teal Table', color: 'bg-teal-500', border: 'border-teal-400', bg: 'bg-teal-950/30', text: 'text-teal-400' },
  { name: 'Pink Table', color: 'bg-pink-500', border: 'border-pink-400', bg: 'bg-pink-950/30', text: 'text-pink-400' },
];

export interface GroupEntry {
  id: string;
  colorIndex: number;
  name: string;
  studentIds: string[];
}

export interface StudentDoc {
  id: string;
  workspaceId: string;
  sectionId: string;
  name: string;
  present: boolean;
  passesUsed: number;
  outTimestamp: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClassSectionDoc {
  id: string;
  workspaceId: string;
  name: string;
  order: number;
  quickSize: number;
  quickCount: number;
  forceExactCount: boolean;
  groups: GroupEntry[];
  passQueue?: string[];
  createdBy: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkspaceDoc {
  id: string;
  activeSectionId: string;
  settings?: Partial<AppSettings>;
  createdBy: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PassAction = 'issued' | 'returned' | 'adjusted' | 'reset';

export interface PassLogDoc {
  id: string;
  workspaceId: string;
  sectionId: string;
  sectionName: string;
  studentId: string;
  studentName: string;
  action: PassAction;
  passesUsedAfter: number;
  durationMinutes: number;
  durationSeconds?: number;
  takenAt?: number;
  returnedAt?: number;
  actorEmail: string;
  createdAt?: unknown;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}
