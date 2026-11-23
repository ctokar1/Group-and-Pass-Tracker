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
  MAX_PASSES: 4,
  MAX_DURATION_MINUTES: 10080,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
} as const;

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
  createdBy: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkspaceDoc {
  id: string;
  activeSectionId: string;
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
  actorEmail: string;
  createdAt?: unknown;
}

export type ActiveTab = 'groups' | 'roster' | 'settings' | 'passes';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}
