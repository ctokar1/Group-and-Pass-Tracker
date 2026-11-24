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
  BADGE_CODE_MAX: 32,
  EMAIL_MAX: 256,
  MAX_GROUPS: 8,
  MAX_GROUP_STUDENTS: 100,
  MAX_PASSES: 10,
  DEFAULT_MAX_PASSES: 4,
  MAX_PAIR_RULES: 50,
  MAX_RECENT_PAIRS: 300,
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

export type AttendanceStatus = 'present' | 'absent' | 'tardy';

export type PassDestination = 'Restroom' | 'Water' | 'Nurse' | 'Counselor' | 'Main Office';

export const PASS_DESTINATIONS: Array<{
  id: PassDestination;
  label: string;
  shortLabel: string;
  defaultExempt: boolean;
}> = [
  { id: 'Restroom', label: 'Restroom', shortLabel: 'Restroom', defaultExempt: false },
  { id: 'Water', label: 'Water Fountain', shortLabel: 'Water', defaultExempt: false },
  { id: 'Nurse', label: 'School Nurse', shortLabel: 'Nurse', defaultExempt: true },
  { id: 'Counselor', label: 'Counselor', shortLabel: 'Counselor', defaultExempt: true },
  { id: 'Main Office', label: 'Main Office', shortLabel: 'Office', defaultExempt: false },
];

export const CLASSROOM_ROLES = [
  'Facilitator',
  'Recorder',
  'Timekeeper',
  'Materials Manager',
  'Presenter',
  'Quality Checker',
] as const;

export type ClassroomRole = (typeof CLASSROOM_ROLES)[number];

export interface BellScheduleSlot {
  sectionId: string;
  startTime: string; // HH:MM (24-hour)
  endTime: string;   // HH:MM (24-hour)
}

export interface BellScheduleProfile {
  id: string;
  name: string;
  slots: BellScheduleSlot[];
}

export interface TimerStageItem {
  id: string;
  title: string;
  instructions: string;
  durationSeconds: number;
}

export const DEFAULT_BELL_SCHEDULES: BellScheduleProfile[] = [
  {
    id: 'regular',
    name: 'Regular Bell Schedule',
    slots: [
      { sectionId: 'sec_alg1_p2', startTime: '08:50', endTime: '09:42' },
      { sectionId: 'sec_alg1_p4', startTime: '10:38', endTime: '11:30' },
      { sectionId: 'sec_alg1_p8', startTime: '14:05', endTime: '14:57' },
    ],
  },
  {
    id: 'late_start',
    name: 'Late Start / Delay',
    slots: [
      { sectionId: 'sec_alg1_p2', startTime: '09:50', endTime: '10:32' },
      { sectionId: 'sec_alg1_p4', startTime: '11:20', endTime: '12:02' },
      { sectionId: 'sec_alg1_p8', startTime: '14:15', endTime: '14:57' },
    ],
  },
  {
    id: 'pep_rally',
    name: 'Pep Rally / Assembly',
    slots: [
      { sectionId: 'sec_alg1_p2', startTime: '08:40', endTime: '09:22' },
      { sectionId: 'sec_alg1_p4', startTime: '10:12', endTime: '10:54' },
      { sectionId: 'sec_alg1_p8', startTime: '13:18', endTime: '14:00' },
    ],
  },
];

export const DEFAULT_TIMER_STAGES: TimerStageItem[] = [
  {
    id: 'stage_1',
    title: 'Independent Setup',
    instructions: 'Read the prompt silently and underline known information.',
    durationSeconds: 180,
  },
  {
    id: 'stage_2',
    title: 'Table Problem Solving',
    instructions: 'Collaborate in your roles to solve and check every step.',
    durationSeconds: 480,
  },
  {
    id: 'stage_3',
    title: 'Board Share-Out',
    instructions: 'Presenter prepares to explain your table strategy clearly.',
    durationSeconds: 120,
  },
];

export interface AppSettings {
  theme: ThemeId;
  defaultTab: ActiveTab;
  defaultQuickSize: number;
  defaultQuickCount: number;
  defaultForceExactCount: boolean;
  defaultTimerSeconds: number;
  timerSoundEnabled: boolean;
  warnPassAlertMinutes: number;
  longPassAlertMinutes: number;
  overdueSoundEnabled: boolean;
  maxQuarterPasses: number;
  maxConcurrentPasses: number;
  autoRotateRoles: boolean;
  rolesOptInDefaulted?: boolean;
  avoidRecentPairs: boolean;
  deadZoneEnabled: boolean;
  deadZoneStartMinutes: number;
  deadZoneEndMinutes: number;
  exemptDestinations: PassDestination[];
  autoSwitchPeriod: boolean;
  autoSwitchLeadMinutes: number;
  activeScheduleId: string;
  bellSchedules: BellScheduleProfile[];
  timerStages: TimerStageItem[];
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'gold',
  defaultTab: 'passes',
  defaultQuickSize: 4,
  defaultQuickCount: 0,
  defaultForceExactCount: false,
  defaultTimerSeconds: 300,
  timerSoundEnabled: true,
  warnPassAlertMinutes: 5,
  longPassAlertMinutes: 8,
  overdueSoundEnabled: true,
  maxQuarterPasses: 4,
  maxConcurrentPasses: 1,
  autoRotateRoles: false,
  rolesOptInDefaulted: true,
  avoidRecentPairs: true,
  deadZoneEnabled: false,
  deadZoneStartMinutes: 10,
  deadZoneEndMinutes: 10,
  exemptDestinations: ['Nurse', 'Counselor'],
  autoSwitchPeriod: false,
  autoSwitchLeadMinutes: 2,
  activeScheduleId: 'regular',
  bellSchedules: DEFAULT_BELL_SCHEDULES,
  timerStages: DEFAULT_TIMER_STAGES,
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

export interface FloorPlanCoords {
  x: number;
  y: number;
}

export type WhiteboardEdge = 'top' | 'bottom' | 'left' | 'right';

export interface FloorPlanLayout {
  whiteboardEdge: WhiteboardEdge;
  teacherDesk: FloorPlanCoords;
  tables: Record<string, FloorPlanCoords>;
}

export const DEFAULT_TABLE_COORDS: FloorPlanCoords[] = [
  { x: 18, y: 32 },
  { x: 50, y: 32 },
  { x: 82, y: 32 },
  { x: 18, y: 70 },
  { x: 50, y: 70 },
  { x: 82, y: 70 },
  { x: 34, y: 50 },
  { x: 66, y: 50 },
];

export function createDefaultFloorPlan(): FloorPlanLayout {
  const tables: Record<string, FloorPlanCoords> = {};
  DEFAULT_TABLE_COORDS.forEach((coord, idx) => {
    tables[`grp_${idx + 1}`] = { ...coord };
  });
  return {
    whiteboardEdge: 'top',
    teacherDesk: { x: 86, y: 14 },
    tables,
  };
}

export interface GroupEntry {
  id: string;
  colorIndex: number;
  name: string;
  studentIds: string[];
  lockedStudentIds?: string[];
  roles?: Record<string, string>;
  points?: number;
}

export interface StudentDoc {
  id: string;
  workspaceId: string;
  sectionId: string;
  name: string;
  present: boolean;
  attendanceStatus?: AttendanceStatus;
  badgeCode?: string;
  activeDestination?: PassDestination | '';
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
  floorPlan?: FloorPlanLayout;
  keepApartPairs?: string[];
  pairTogetherPairs?: string[];
  recentPairKeys?: string[];
  spotlightCalledIds?: string[];
  spotlightDeckMode?: boolean;
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
  destination?: PassDestination;
  quotaExempt?: boolean;
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
