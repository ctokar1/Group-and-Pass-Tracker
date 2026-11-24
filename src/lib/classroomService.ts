import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  COLOR_DEFINITIONS,
  createDefaultFloorPlan,
  DEFAULT_APP_SETTINGS,
  DEFAULT_BELL_SCHEDULES,
  DEFAULT_TIMER_STAGES,
  LIMITS,
  WORKSPACE_ID,
  type ActiveTab,
  type AppSettings,
  type AttendanceStatus,
  type BellScheduleProfile,
  type ClassSectionDoc,
  type FloorPlanLayout,
  type GroupEntry,
  type PassAction,
  type PassDestination,
  type PassLogDoc,
  type StudentDoc,
  type ThemeId,
  type TimerStageItem,
  type WhiteboardEdge,
  type WorkspaceDoc,
} from '../types/classroom';

const WORKSPACE_PATH = `workspaces/${WORKSPACE_ID}`;
const SECTIONS_PATH = `workspaces/${WORKSPACE_ID}/sections`;
const PASS_LOGS_PATH = `workspaces/${WORKSPACE_ID}/passLogs`;

const LEGACY_SAMPLE_SECTION_ID = 'sec_1';
const LEGACY_SAMPLE_SECTION_NAME = 'Period 1 - Heights Tigers';

interface PresetClassSeed {
  id: string;
  name: string;
  studentPrefix: string;
  skipKey: string;
  roster: string[];
}

const PRESET_CLASSES: PresetClassSeed[] = [
  {
    id: 'sec_alg1_p2',
    name: 'Algebra 1 - Period 2',
    studentPrefix: 'st_alg1_p2',
    skipKey: 'tiger_skip_seed_sec_alg1_p2',
    roster: [
      "A'Lontae Austin",
      'Todd Averytt',
      'Walid Baker',
      'Keiston Casson',
      'Jakieh Edwards',
      'Emanuel Galdamez',
      'Jailynn Gates',
      'Honestie Grady',
      'Nehemiah Green',
      'Breeya Horne',
      'Dezmond Jamerson',
      'Brooklynn Jones',
      'Jada Jones',
      'Thea Lees',
      'Niko Miller',
      'Daniyah Moon',
      'Amiia Reid',
      'Ameirah Robinson',
      'Chaz Sturdivant',
      'Payge Wright',
      'Emani Dillon',
      "Ky'lah Finley",
      'Gabriel Mixson',
      'Aliyah Reaves',
      'Robert Woodson',
    ],
  },
  {
    id: 'sec_alg1_p4',
    name: 'Algebra 1 - Period 4',
    studentPrefix: 'st_alg1_p4',
    skipKey: 'tiger_skip_seed_sec_alg1_p4',
    roster: [
      "Wanh'ca Belt",
      'Derrick Black',
      'King Fletcher',
      'Nyomi Johnson',
      'Londyn Jolly',
      'Kaiden Jones',
      'Ryian McMillon',
      "Sy'Eria Melton",
      'Phillip Moreland',
      'Ajanae Pearsall',
    ],
  },
  {
    id: 'sec_alg1_p8',
    name: 'Algebra 1 - Period 8',
    studentPrefix: 'st_alg1_p8',
    skipKey: 'tiger_skip_seed_sec_alg1_p8',
    roster: [
      'Imogen Butler',
      'Aliyanna Claybrooks',
      'Gissel Dominguez Freire',
      'Dorian Edwards',
      'Pierre Green',
      'Stephen Hunter',
      'Kalaijah King',
      'London Minor',
      'Justin Roberts',
      'Israel Yeboah',
      'Asher Benedict',
      'Ciara Cantie',
      'Ramone Hayes',
      'Leah Holliday',
      'Angel McLendon',
      'Allen Miller',
      'Wyatt Money',
      'Ayden Scroggins',
      'Blessed Williams',
    ],
  },
];

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, LIMITS.ID_MAX);
  if (cleaned.length > 0 && LIMITS.ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function clampText(text: string, maxLen: number): string {
  return text.trim().slice(0, maxLen);
}

function clampPassCount(count: number, maxLimit: number = LIMITS.MAX_PASSES): number {
  const cap = Math.max(1, Math.min(LIMITS.MAX_PASSES, Math.round(maxLimit)));
  const rounded = Math.round(Number(count) || 0);
  return Math.max(0, Math.min(cap, rounded));
}

const VALID_THEMES: ThemeId[] = ['gold', 'sapphire', 'emerald', 'violet', 'crimson', 'tangerine'];
const VALID_TABS: ActiveTab[] = ['groups', 'roster', 'settings', 'passes', 'history'];
const VALID_DESTINATIONS: PassDestination[] = [
  'Restroom',
  'Water',
  'Nurse',
  'Counselor',
  'Main Office',
];
const VALID_WHITEBOARD_EDGES: WhiteboardEdge[] = ['top', 'bottom', 'left', 'right'];

function clampCoord(val: unknown, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(5, Math.min(95, Math.round(num * 10) / 10));
}

export function sanitizeFloorPlan(raw?: Partial<FloorPlanLayout> | null): FloorPlanLayout {
  const base = createDefaultFloorPlan();
  if (!raw) return base;
  const whiteboardEdge = VALID_WHITEBOARD_EDGES.includes(raw.whiteboardEdge as WhiteboardEdge)
    ? (raw.whiteboardEdge as WhiteboardEdge)
    : base.whiteboardEdge;
  const teacherDesk = {
    x: clampCoord(raw.teacherDesk?.x, base.teacherDesk.x),
    y: clampCoord(raw.teacherDesk?.y, base.teacherDesk.y),
  };
  const tables: Record<string, { x: number; y: number }> = { ...base.tables };
  if (raw.tables && typeof raw.tables === 'object') {
    Object.entries(raw.tables)
      .slice(0, 12)
      .forEach(([key, coord]) => {
        const cleanKey = sanitizeId(key, 'grp');
        const fallback = base.tables[cleanKey] || { x: 50, y: 50 };
        tables[cleanKey] = {
          x: clampCoord(coord?.x, fallback.x),
          y: clampCoord(coord?.y, fallback.y),
        };
      });
  }
  const limitedTables = Object.fromEntries(Object.entries(tables).slice(0, 12));
  return { whiteboardEdge, teacherDesk, tables: limitedTables };
}

function sanitizeBellSchedules(raw: unknown): BellScheduleProfile[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_BELL_SCHEDULES;
  const cleaned = raw.slice(0, 6).map((item, idx) => {
    const p = (item || {}) as Partial<BellScheduleProfile>;
    const id = sanitizeId(p.id || `sched_${idx + 1}`, `sched_${idx + 1}`).slice(0, 64);
    const name = clampText(p.name || `Schedule ${idx + 1}`, 60) || `Schedule ${idx + 1}`;
    const slots = Array.isArray(p.slots)
      ? p.slots.slice(0, 16).map((sl) => ({
          sectionId: sanitizeId(sl?.sectionId || 'sec', 'sec'),
          startTime: typeof sl?.startTime === 'string' ? sl.startTime.slice(0, 10) : '08:00',
          endTime: typeof sl?.endTime === 'string' ? sl.endTime.slice(0, 10) : '08:50',
        }))
      : [];
    return { id, name, slots };
  });
  return cleaned.length > 0 ? cleaned : DEFAULT_BELL_SCHEDULES;
}

function sanitizeTimerStages(raw: unknown): TimerStageItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_TIMER_STAGES;
  const cleaned = raw.slice(0, 15).map((item, idx) => {
    const st = (item || {}) as Partial<TimerStageItem>;
    const dur = Math.round(Number(st.durationSeconds ?? 180));
    return {
      id: sanitizeId(st.id || `stage_${idx + 1}`, `stage_${idx + 1}`),
      title: clampText(st.title || `Phase ${idx + 1}`, 80) || `Phase ${idx + 1}`,
      instructions: clampText(st.instructions || '', 240),
      durationSeconds: Number.isFinite(dur) ? Math.max(5, Math.min(59999, dur)) : 180,
    };
  });
  return cleaned.length > 0 ? cleaned : DEFAULT_TIMER_STAGES;
}

export function sanitizeWorkspaceSettings(raw?: Partial<AppSettings> | null): AppSettings {
  const s = raw || {};
  const theme = VALID_THEMES.includes(s.theme as ThemeId)
    ? (s.theme as ThemeId)
    : DEFAULT_APP_SETTINGS.theme;
  const defaultTab = VALID_TABS.includes(s.defaultTab as ActiveTab)
    ? (s.defaultTab as ActiveTab)
    : DEFAULT_APP_SETTINGS.defaultTab;
  const quickSizeNum = Math.round(Number(s.defaultQuickSize ?? DEFAULT_APP_SETTINGS.defaultQuickSize));
  const quickCountNum = Math.round(Number(s.defaultQuickCount ?? DEFAULT_APP_SETTINGS.defaultQuickCount));
  const timerNum = Math.round(Number(s.defaultTimerSeconds ?? DEFAULT_APP_SETTINGS.defaultTimerSeconds));
  const warnNum = Math.round(Number(s.warnPassAlertMinutes ?? DEFAULT_APP_SETTINGS.warnPassAlertMinutes));
  const alertNum = Math.round(Number(s.longPassAlertMinutes ?? DEFAULT_APP_SETTINGS.longPassAlertMinutes));
  const maxPassNum = Math.round(Number(s.maxQuarterPasses ?? DEFAULT_APP_SETTINGS.maxQuarterPasses));
  const maxConcurrentNum = Math.round(
    Number(s.maxConcurrentPasses ?? DEFAULT_APP_SETTINGS.maxConcurrentPasses)
  );
  const dzStart = Math.round(Number(s.deadZoneStartMinutes ?? DEFAULT_APP_SETTINGS.deadZoneStartMinutes));
  const dzEnd = Math.round(Number(s.deadZoneEndMinutes ?? DEFAULT_APP_SETTINGS.deadZoneEndMinutes));
  const leadMin = Math.round(Number(s.autoSwitchLeadMinutes ?? DEFAULT_APP_SETTINGS.autoSwitchLeadMinutes));

  const exemptRaw = Array.isArray(s.exemptDestinations)
    ? s.exemptDestinations.filter((d): d is PassDestination =>
        VALID_DESTINATIONS.includes(d as PassDestination)
      )
    : DEFAULT_APP_SETTINGS.exemptDestinations;

  const bellSchedules = sanitizeBellSchedules(s.bellSchedules);
  const activeSchedMatch = bellSchedules.some((b) => b.id === s.activeScheduleId)
    ? String(s.activeScheduleId).slice(0, 64)
    : bellSchedules[0].id;

  return {
    theme,
    defaultTab,
    defaultQuickSize: Number.isFinite(quickSizeNum) ? Math.max(0, Math.min(12, quickSizeNum)) : DEFAULT_APP_SETTINGS.defaultQuickSize,
    defaultQuickCount: Number.isFinite(quickCountNum) ? Math.max(0, Math.min(8, quickCountNum)) : DEFAULT_APP_SETTINGS.defaultQuickCount,
    defaultForceExactCount: Boolean(s.defaultForceExactCount ?? DEFAULT_APP_SETTINGS.defaultForceExactCount),
    defaultTimerSeconds: Number.isFinite(timerNum) ? Math.max(10, Math.min(59999, timerNum)) : DEFAULT_APP_SETTINGS.defaultTimerSeconds,
    timerSoundEnabled: s.timerSoundEnabled !== undefined ? Boolean(s.timerSoundEnabled) : DEFAULT_APP_SETTINGS.timerSoundEnabled,
    warnPassAlertMinutes: Number.isFinite(warnNum) ? Math.max(1, Math.min(30, warnNum)) : DEFAULT_APP_SETTINGS.warnPassAlertMinutes,
    longPassAlertMinutes: Number.isFinite(alertNum) ? Math.max(1, Math.min(60, alertNum)) : DEFAULT_APP_SETTINGS.longPassAlertMinutes,
    overdueSoundEnabled: s.overdueSoundEnabled !== undefined ? Boolean(s.overdueSoundEnabled) : DEFAULT_APP_SETTINGS.overdueSoundEnabled,
    maxQuarterPasses: Number.isFinite(maxPassNum) ? Math.max(1, Math.min(LIMITS.MAX_PASSES, maxPassNum)) : DEFAULT_APP_SETTINGS.maxQuarterPasses,
    maxConcurrentPasses: Number.isFinite(maxConcurrentNum)
      ? Math.max(0, Math.min(30, maxConcurrentNum))
      : DEFAULT_APP_SETTINGS.maxConcurrentPasses,
    autoRotateRoles:
      Boolean(s.rolesOptInDefaulted) && s.autoRotateRoles !== undefined
        ? Boolean(s.autoRotateRoles)
        : DEFAULT_APP_SETTINGS.autoRotateRoles,
    rolesOptInDefaulted: true,
    avoidRecentPairs: s.avoidRecentPairs !== undefined ? Boolean(s.avoidRecentPairs) : DEFAULT_APP_SETTINGS.avoidRecentPairs,
    deadZoneEnabled: Boolean(s.deadZoneEnabled ?? DEFAULT_APP_SETTINGS.deadZoneEnabled),
    deadZoneStartMinutes: Number.isFinite(dzStart) ? Math.max(0, Math.min(30, dzStart)) : DEFAULT_APP_SETTINGS.deadZoneStartMinutes,
    deadZoneEndMinutes: Number.isFinite(dzEnd) ? Math.max(0, Math.min(30, dzEnd)) : DEFAULT_APP_SETTINGS.deadZoneEndMinutes,
    exemptDestinations: Array.from(new Set(exemptRaw)).slice(0, 5),
    autoSwitchPeriod: Boolean(s.autoSwitchPeriod ?? DEFAULT_APP_SETTINGS.autoSwitchPeriod),
    autoSwitchLeadMinutes: Number.isFinite(leadMin) ? Math.max(0, Math.min(15, leadMin)) : DEFAULT_APP_SETTINGS.autoSwitchLeadMinutes,
    activeScheduleId: activeSchedMatch,
    bellSchedules,
    timerStages: sanitizeTimerStages(s.timerStages),
  };
}

function sanitizeGroups(groups: GroupEntry[]): GroupEntry[] {
  return groups.slice(0, LIMITS.MAX_GROUPS).map((g, idx) => {
    const cleanStudentIds = (g.studentIds || [])
      .map((sid) => sanitizeId(sid, 'st'))
      .slice(0, LIMITS.MAX_GROUP_STUDENTS);
    const cleanStudentSet = new Set(cleanStudentIds);
    const cleanLocked = (g.lockedStudentIds || [])
      .map((sid) => sanitizeId(sid, 'st'))
      .filter((sid) => cleanStudentSet.has(sid))
      .slice(0, LIMITS.MAX_GROUP_STUDENTS);

    const cleanRoles: Record<string, string> = {};
    if (g.roles && typeof g.roles === 'object') {
      Object.entries(g.roles)
        .slice(0, LIMITS.MAX_GROUP_STUDENTS)
        .forEach(([sid, role]) => {
          const cleanSid = sanitizeId(sid, 'st');
          if (cleanStudentSet.has(cleanSid) && typeof role === 'string' && role.trim()) {
            cleanRoles[cleanSid] = clampText(role, 40);
          }
        });
    }

    const rawPoints = Math.round(Number(g.points ?? 0));
    const cleanPoints = Number.isFinite(rawPoints)
      ? Math.max(-999, Math.min(999, rawPoints))
      : 0;

    return {
      id: sanitizeId(g.id, `grp_${idx + 1}`),
      colorIndex: Math.max(0, Math.min(7, Math.round(Number(g.colorIndex) || 0))),
      name:
        clampText(
          typeof g.name === 'string' && g.name.trim()
            ? g.name
            : COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length].name,
          LIMITS.GROUP_NAME_MAX
        ) || COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length].name,
      studentIds: cleanStudentIds,
      lockedStudentIds: cleanLocked,
      roles: cleanRoles,
      points: cleanPoints,
    };
  });
}

function sanitizePairKeyList(list: string[], maxLen: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().slice(0, 260);
    if (!trimmed || !trimmed.includes('|') || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxLen) break;
  }
  return out;
}

function sanitizePassQueue(queue: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const rawId of queue) {
    const id = sanitizeId(rawId, 'st');
    if (!seen.has(id)) {
      seen.add(id);
      clean.push(id);
    }
    if (clean.length >= LIMITS.MAX_GROUP_STUDENTS) break;
  }
  return clean;
}

function isPresetSkipped(preset: PresetClassSeed): boolean {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(preset.skipKey) === '1'
  );
}

const VALID_SECTION_KEYS = new Set([
  'id',
  'workspaceId',
  'name',
  'order',
  'quickSize',
  'quickCount',
  'forceExactCount',
  'groups',
  'passQueue',
  'floorPlan',
  'keepApartPairs',
  'pairTogetherPairs',
  'recentPairKeys',
  'spotlightCalledIds',
  'spotlightDeckMode',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
]);

function isValidFloorPlanShape(fp: unknown): boolean {
  if (!fp || typeof fp !== 'object') return false;
  const obj = fp as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (
    !keys.includes('whiteboardEdge') ||
    !keys.includes('teacherDesk') ||
    !keys.includes('tables') ||
    keys.some((k) => k !== 'whiteboardEdge' && k !== 'teacherDesk' && k !== 'tables')
  ) {
    return false;
  }
  if (!VALID_WHITEBOARD_EDGES.includes(obj.whiteboardEdge as WhiteboardEdge)) return false;
  const td = obj.teacherDesk as Record<string, unknown> | null;
  if (!td || typeof td !== 'object') return false;
  const tdKeys = Object.keys(td);
  if (
    tdKeys.length !== 2 ||
    typeof td.x !== 'number' ||
    typeof td.y !== 'number' ||
    td.x < 0 ||
    td.x > 100 ||
    td.y < 0 ||
    td.y > 100
  ) {
    return false;
  }
  const tables = obj.tables as Record<string, unknown> | null;
  if (!tables || typeof tables !== 'object' || Object.keys(tables).length > 12) return false;
  return true;
}

function isFirestoreTimestamp(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.toMillis === 'function' ||
    (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number')
  );
}

function sectionNeedsHeal(raw: Record<string, unknown>, sectionId: string): boolean {
  const keys = Object.keys(raw);
  if (keys.some((k) => !VALID_SECTION_KEYS.has(k))) return true;
  const required = [
    'id',
    'workspaceId',
    'name',
    'order',
    'quickSize',
    'quickCount',
    'forceExactCount',
    'groups',
    'createdBy',
    'updatedBy',
    'createdAt',
    'updatedAt',
  ];
  if (required.some((k) => raw[k] === undefined || raw[k] === null)) return true;
  if (raw.id !== sectionId || raw.workspaceId !== WORKSPACE_ID) return true;
  if (typeof raw.name !== 'string' || raw.name.length < 1 || raw.name.length > 120) return true;
  if (typeof raw.order !== 'number' || !Number.isFinite(raw.order) || raw.order < 0 || raw.order > 10000) {
    return true;
  }
  if (
    typeof raw.quickSize !== 'number' ||
    !Number.isFinite(raw.quickSize) ||
    raw.quickSize < 0 ||
    raw.quickSize > 12
  ) {
    return true;
  }
  if (
    typeof raw.quickCount !== 'number' ||
    !Number.isFinite(raw.quickCount) ||
    raw.quickCount < 0 ||
    raw.quickCount > 8
  ) {
    return true;
  }
  if (typeof raw.forceExactCount !== 'boolean') return true;
  if (typeof raw.createdBy !== 'string' || raw.createdBy.length < 3 || raw.createdBy.length > 256) {
    return true;
  }
  if (typeof raw.updatedBy !== 'string' || raw.updatedBy.length < 3 || raw.updatedBy.length > 256) {
    return true;
  }
  if (!isFirestoreTimestamp(raw.createdAt) || !isFirestoreTimestamp(raw.updatedAt)) return true;
  if (!Array.isArray(raw.groups) || raw.groups.length > LIMITS.MAX_GROUPS) return true;
  for (const grp of raw.groups) {
    if (!grp || typeof grp !== 'object') return true;
    const g = grp as Record<string, unknown>;
    const gKeys = Object.keys(g);
    const allowedGroupKeys = new Set([
      'id',
      'colorIndex',
      'name',
      'studentIds',
      'lockedStudentIds',
      'roles',
      'points',
    ]);
    if (gKeys.some((k) => !allowedGroupKeys.has(k))) return true;
    if (typeof g.id !== 'string' || !LIMITS.ID_PATTERN.test(g.id)) return true;
    if (typeof g.colorIndex !== 'number' || !Number.isFinite(g.colorIndex) || g.colorIndex < 0 || g.colorIndex > 7) {
      return true;
    }
    if (typeof g.name !== 'string' || g.name.length < 1 || g.name.length > 60) return true;
    if (!Array.isArray(g.studentIds) || g.studentIds.length > 100) return true;
    if (g.studentIds.length > 0 && (typeof g.studentIds[0] !== 'string' || !LIMITS.ID_PATTERN.test(g.studentIds[0]))) {
      return true;
    }
    if ('lockedStudentIds' in g) {
      if (
        !Array.isArray(g.lockedStudentIds) ||
        g.lockedStudentIds.length > 100 ||
        (g.lockedStudentIds.length > 0 &&
          (typeof g.lockedStudentIds[0] !== 'string' || !LIMITS.ID_PATTERN.test(g.lockedStudentIds[0])))
      ) {
        return true;
      }
    }
    if ('roles' in g) {
      if (!g.roles || typeof g.roles !== 'object' || Array.isArray(g.roles) || Object.keys(g.roles).length > 100) {
        return true;
      }
    }
    if ('points' in g) {
      if (typeof g.points !== 'number' || !Number.isFinite(g.points) || g.points < -999 || g.points > 999) {
        return true;
      }
    }
  }
  if ('passQueue' in raw) {
    if (
      !Array.isArray(raw.passQueue) ||
      raw.passQueue.length > 100 ||
      (raw.passQueue.length > 0 && (typeof raw.passQueue[0] !== 'string' || !LIMITS.ID_PATTERN.test(raw.passQueue[0])))
    ) {
      return true;
    }
  }
  if ('floorPlan' in raw && !isValidFloorPlanShape(raw.floorPlan)) return true;
  if ('keepApartPairs' in raw) {
    if (
      !Array.isArray(raw.keepApartPairs) ||
      raw.keepApartPairs.length > 50 ||
      (raw.keepApartPairs.length > 0 &&
        (typeof raw.keepApartPairs[0] !== 'string' || raw.keepApartPairs[0].length > 260))
    ) {
      return true;
    }
  }
  if ('pairTogetherPairs' in raw) {
    if (
      !Array.isArray(raw.pairTogetherPairs) ||
      raw.pairTogetherPairs.length > 50 ||
      (raw.pairTogetherPairs.length > 0 &&
        (typeof raw.pairTogetherPairs[0] !== 'string' || raw.pairTogetherPairs[0].length > 260))
    ) {
      return true;
    }
  }
  if ('recentPairKeys' in raw) {
    if (
      !Array.isArray(raw.recentPairKeys) ||
      raw.recentPairKeys.length > LIMITS.MAX_RECENT_PAIRS ||
      (raw.recentPairKeys.length > 0 &&
        (typeof raw.recentPairKeys[0] !== 'string' || raw.recentPairKeys[0].length > 260))
    ) {
      return true;
    }
  }
  if (
    'spotlightCalledIds' in raw &&
    (!Array.isArray(raw.spotlightCalledIds) ||
      raw.spotlightCalledIds.length > 150 ||
      (raw.spotlightCalledIds.length > 0 &&
        (typeof raw.spotlightCalledIds[0] !== 'string' ||
          !LIMITS.ID_PATTERN.test(raw.spotlightCalledIds[0]))))
  ) {
    return true;
  }
  if ('spotlightDeckMode' in raw && typeof raw.spotlightDeckMode !== 'boolean') {
    return true;
  }
  return false;
}

function buildCleanSectionPayload(
  raw: Record<string, unknown>,
  sectionId: string,
  fallbackOrder: number,
  email: string,
  forceFreshCreate: boolean = false
): Record<string, unknown> {
  const cleanId = sanitizeId(sectionId, 'sec');
  const rawName = typeof raw.name === 'string' ? raw.name : 'Class Period';
  const rawOrder = Math.round(Number(raw.order ?? fallbackOrder));
  const rawQuickSize = Math.round(Number(raw.quickSize ?? 4));
  const rawQuickCount = Math.round(Number(raw.quickCount ?? 0));

  const validExistingCreator =
    !forceFreshCreate &&
    typeof raw.createdBy === 'string' &&
    raw.createdBy.trim().length >= 3 &&
    raw.createdBy.length <= LIMITS.EMAIL_MAX
      ? raw.createdBy
      : email;

  const validExistingCreatedAt =
    !forceFreshCreate && isFirestoreTimestamp(raw.createdAt)
      ? raw.createdAt
      : serverTimestamp();

  const out: Record<string, unknown> = {
    id: cleanId,
    workspaceId: WORKSPACE_ID,
    name: clampText(rawName, LIMITS.SECTION_NAME_MAX) || 'Class Period',
    order: Number.isFinite(rawOrder) ? Math.max(0, Math.min(10000, rawOrder)) : fallbackOrder,
    quickSize: Number.isFinite(rawQuickSize) ? Math.max(0, Math.min(12, rawQuickSize)) : 4,
    quickCount: Number.isFinite(rawQuickCount) ? Math.max(0, Math.min(8, rawQuickCount)) : 0,
    forceExactCount: Boolean(raw.forceExactCount ?? false),
    groups: Array.isArray(raw.groups) ? sanitizeGroups(raw.groups as GroupEntry[]) : [],
    createdBy: validExistingCreator,
    updatedBy: email,
    createdAt: validExistingCreatedAt,
    updatedAt: serverTimestamp(),
  };

  if (Array.isArray(raw.passQueue)) {
    out.passQueue = sanitizePassQueue(raw.passQueue as string[]);
  }
  if (raw.floorPlan && typeof raw.floorPlan === 'object') {
    out.floorPlan = sanitizeFloorPlan(raw.floorPlan as Partial<FloorPlanLayout>);
  }
  if (Array.isArray(raw.keepApartPairs)) {
    out.keepApartPairs = sanitizePairKeyList(raw.keepApartPairs as string[], LIMITS.MAX_PAIR_RULES);
  }
  if (Array.isArray(raw.pairTogetherPairs)) {
    out.pairTogetherPairs = sanitizePairKeyList(raw.pairTogetherPairs as string[], LIMITS.MAX_PAIR_RULES);
  }
  if (Array.isArray(raw.recentPairKeys)) {
    out.recentPairKeys = sanitizePairKeyList(raw.recentPairKeys as string[], LIMITS.MAX_RECENT_PAIRS);
  }
  if (Array.isArray(raw.spotlightCalledIds)) {
    out.spotlightCalledIds = Array.from(
      new Set(
        raw.spotlightCalledIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => sanitizeId(id, 'st'))
      )
    ).slice(0, 150);
  }
  if (typeof raw.spotlightDeckMode === 'boolean') {
    out.spotlightDeckMode = raw.spotlightDeckMode;
  }

  return out;
}

async function healSectionDocument(
  sectionRef: ReturnType<typeof doc>,
  raw: Record<string, unknown>,
  sectionId: string,
  fallbackOrder: number,
  email: string,
  patch?: Record<string, unknown>
): Promise<void> {
  const mergedRaw = patch ? { ...raw, ...patch } : raw;
  const cleanDoc = buildCleanSectionPayload(mergedRaw, sectionId, fallbackOrder, email, false);
  try {
    await setDoc(sectionRef, cleanDoc);
  } catch {
    const freshDoc = buildCleanSectionPayload(mergedRaw, sectionId, fallbackOrder, email, true);
    try {
      await deleteDoc(sectionRef);
    } catch {
      // ignore if doc already missing
    }
    await setDoc(sectionRef, freshDoc);
  }
}

async function updateSectionWithAutoHeal(
  sectionId: string,
  patch: Record<string, unknown>,
  email: string,
  fallbackOrder: number = 0
): Promise<void> {
  const path = `${SECTIONS_PATH}/${sectionId}`;
  const sectionRef = doc(db, SECTIONS_PATH, sectionId);
  const fullPatch: Record<string, unknown> = {
    ...patch,
    updatedBy: email,
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(sectionRef, fullPatch);
  } catch (error) {
    try {
      const existingSnap = await getDoc(sectionRef);
      const raw = existingSnap.exists() ? (existingSnap.data() as Record<string, unknown>) : {};
      await healSectionDocument(sectionRef, raw, sectionId, fallbackOrder, email, fullPatch);
      return;
    } catch {
      // fall through to standard error reporting
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function ensureWorkspaceAndSeed(teacherEmail: string): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const workspaceRef = doc(db, 'workspaces', WORKSPACE_ID);

  try {
    const snap = await getDoc(workspaceRef);

    if (!snap.exists()) {
      const batch = writeBatch(db);
      const activePresets = PRESET_CLASSES.filter((p) => !isPresetSkipped(p));
      const presetsToSeed = activePresets.length > 0 ? activePresets : [PRESET_CLASSES[0]];
      const initialActiveId = presetsToSeed[0].id;

      batch.set(workspaceRef, {
        id: WORKSPACE_ID,
        activeSectionId: initialActiveId,
        createdBy: email,
        updatedBy: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      presetsToSeed.forEach((preset, presetIdx) => {
        batch.set(doc(db, SECTIONS_PATH, preset.id), {
          id: preset.id,
          workspaceId: WORKSPACE_ID,
          name: preset.name,
          order: presetIdx,
          quickSize: 4,
          quickCount: 0,
          forceExactCount: false,
          groups: [],
          createdBy: email,
          updatedBy: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        preset.roster.forEach((studentName, idx) => {
          const studentId = `${preset.studentPrefix}_${idx + 1}`;
          batch.set(doc(db, `${SECTIONS_PATH}/${preset.id}/students`, studentId), {
            id: studentId,
            workspaceId: WORKSPACE_ID,
            sectionId: preset.id,
            name: studentName,
            present: true,
            passesUsed: 0,
            outTimestamp: 0,
            createdBy: email,
            updatedBy: email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      });

      await batch.commit();
      return;
    }

    const candidates = PRESET_CLASSES.filter((p) => !isPresetSkipped(p));
    const existingSectionsSnap = await getDocs(
      query(collection(db, SECTIONS_PATH), where('workspaceId', '==', WORKSPACE_ID))
    );
    const existingSections = existingSectionsSnap.docs
      .map((d) => d.data() as ClassSectionDoc)
      .sort((a, b) => a.order - b.order);

    const missingPresets = candidates.filter(
      (preset) =>
        !existingSections.some(
          (s) =>
            s.id === preset.id ||
            s.name.trim().toLowerCase() === preset.name.toLowerCase()
        )
    );

    let currentActiveId = (snap.data() as WorkspaceDoc).activeSectionId;

    if (missingPresets.length > 0) {
      let nextOrder = Math.max(
        0,
        Math.min(
          10000,
          existingSections.reduce((max, s) => Math.max(max, Number(s.order) || 0), -1) + 1
        )
      );

      const batch = writeBatch(db);
      let lastSeededId = '';

      for (const preset of missingPresets) {
        batch.set(doc(db, SECTIONS_PATH, preset.id), {
          id: preset.id,
          workspaceId: WORKSPACE_ID,
          name: preset.name,
          order: Math.min(10000, nextOrder),
          quickSize: 4,
          quickCount: 0,
          forceExactCount: false,
          groups: [],
          createdBy: email,
          updatedBy: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        nextOrder += 1;
        lastSeededId = preset.id;

        preset.roster.forEach((studentName, idx) => {
          const studentId = `${preset.studentPrefix}_${idx + 1}`;
          batch.set(doc(db, `${SECTIONS_PATH}/${preset.id}/students`, studentId), {
            id: studentId,
            workspaceId: WORKSPACE_ID,
            sectionId: preset.id,
            name: studentName,
            present: true,
            passesUsed: 0,
            outTimestamp: 0,
            createdBy: email,
            updatedBy: email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }

      if (lastSeededId) {
        currentActiveId = lastSeededId;
        batch.update(workspaceRef, {
          activeSectionId: lastSeededId,
          updatedBy: email,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    }

    // Heal any legacy or malformed section documents so future partial updates pass security rules
    for (let idx = 0; idx < existingSectionsSnap.docs.length; idx++) {
      const sDoc = existingSectionsSnap.docs[idx];
      const rawData = sDoc.data() as Record<string, unknown>;
      if (sectionNeedsHeal(rawData, sDoc.id)) {
        await healSectionDocument(sDoc.ref, rawData, sDoc.id, idx, email);
      }
    }

    // Remove the legacy default "Period 1 - Heights Tigers" sample section if present
    const legacySection = existingSections.find(
      (s) =>
        s.id === LEGACY_SAMPLE_SECTION_ID ||
        s.name.trim().toLowerCase() === LEGACY_SAMPLE_SECTION_NAME.toLowerCase()
    );
    if (legacySection) {
      const remainingIds = [
        ...existingSections.filter((s) => s.id !== legacySection.id).map((s) => s.id),
        ...missingPresets.map((p) => p.id),
      ];
      if (remainingIds.length > 0) {
        const legacyStudentsPath = `${SECTIONS_PATH}/${legacySection.id}/students`;
        const legacyStudentsSnap = await getDocs(
          query(
            collection(db, legacyStudentsPath),
            where('sectionId', '==', legacySection.id)
          )
        );
        const delBatch = writeBatch(db);
        legacyStudentsSnap.docs.forEach((sDoc) => {
          delBatch.delete(sDoc.ref);
        });
        delBatch.delete(doc(db, SECTIONS_PATH, legacySection.id));
        if (currentActiveId === legacySection.id) {
          delBatch.update(workspaceRef, {
            activeSectionId: remainingIds[0],
            updatedBy: email,
            updatedAt: serverTimestamp(),
          });
        }
        await delBatch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, WORKSPACE_PATH);
  }
}

export function subscribeWorkspace(
  onData: (workspace: WorkspaceDoc | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, 'workspaces', WORKSPACE_ID);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as WorkspaceDoc) : null);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, WORKSPACE_PATH);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeSections(
  onData: (sections: ClassSectionDoc[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, SECTIONS_PATH),
    where('workspaceId', '==', WORKSPACE_ID)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as ClassSectionDoc)
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, SECTIONS_PATH);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeStudents(
  sectionId: string,
  onData: (students: StudentDoc[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `${SECTIONS_PATH}/${sectionId}/students`;
  const q = query(
    collection(db, path),
    where('sectionId', '==', sectionId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as StudentDoc)
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

function getTimestampMillis(ts: unknown): number {
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function subscribePassLogs(
  onData: (logs: PassLogDoc[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, PASS_LOGS_PATH),
    where('workspaceId', '==', WORKSPACE_ID)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as PassLogDoc)
        .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt))
        .slice(0, 500);
      onData(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, PASS_LOGS_PATH);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function setActiveSection(sectionId: string, teacherEmail: string): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  try {
    await updateDoc(doc(db, 'workspaces', WORKSPACE_ID), {
      activeSectionId: sanitizeId(sectionId, 'sec'),
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, WORKSPACE_PATH);
  }
}

export async function updateWorkspaceSettings(
  settings: AppSettings,
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const clean = sanitizeWorkspaceSettings(settings);
  try {
    await updateDoc(doc(db, 'workspaces', WORKSPACE_ID), {
      settings: clean,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, WORKSPACE_PATH);
  }
}

export async function createSection(
  name: string,
  nextOrder: number,
  teacherEmail: string,
  defaults?: { quickSize?: number; quickCount?: number; forceExactCount?: boolean }
): Promise<string> {
  const cleanName = clampText(name, LIMITS.SECTION_NAME_MAX);
  if (!cleanName) throw new Error('Section name is required.');
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const sectionId = generateId('sec');
  const order = Math.max(0, Math.min(10000, Math.round(nextOrder)));
  const quickSize = Math.max(0, Math.min(12, Math.round(defaults?.quickSize ?? 4)));
  const quickCount = Math.max(0, Math.min(8, Math.round(defaults?.quickCount ?? 0)));
  const forceExactCount = Boolean(defaults?.forceExactCount ?? false);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, SECTIONS_PATH, sectionId), {
      id: sectionId,
      workspaceId: WORKSPACE_ID,
      name: cleanName,
      order,
      quickSize,
      quickCount,
      forceExactCount,
      groups: [],
      createdBy: email,
      updatedBy: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'workspaces', WORKSPACE_ID), {
      activeSectionId: sectionId,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return sectionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${SECTIONS_PATH}/${sectionId}`);
  }
}

export async function renameSection(
  sectionId: string,
  newName: string,
  teacherEmail: string
): Promise<void> {
  const cleanName = clampText(newName, LIMITS.SECTION_NAME_MAX);
  if (!cleanName) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  await updateSectionWithAutoHeal(sectionId, { name: cleanName }, email);
}

export async function deleteSection(
  sectionId: string,
  fallbackSectionId: string,
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const studentsPath = `${SECTIONS_PATH}/${sectionId}/students`;
  try {
    const studentsSnap = await getDocs(
      query(
        collection(db, studentsPath),
        where('sectionId', '==', sectionId)
      )
    );
    const batch = writeBatch(db);
    studentsSnap.docs.forEach((sDoc) => {
      batch.delete(sDoc.ref);
    });
    batch.delete(doc(db, SECTIONS_PATH, sectionId));
    batch.update(doc(db, 'workspaces', WORKSPACE_ID), {
      activeSectionId: sanitizeId(fallbackSectionId, 'sec'),
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    const deletedPreset = PRESET_CLASSES.find((p) => p.id === sectionId);
    if (deletedPreset && typeof window !== 'undefined') {
      window.localStorage.setItem(deletedPreset.skipKey, '1');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${SECTIONS_PATH}/${sectionId}`);
  }
}

export async function updateSectionSettings(
  sectionId: string,
  settings: { quickSize: number; quickCount: number; forceExactCount: boolean },
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  await updateSectionWithAutoHeal(
    sectionId,
    {
      quickSize: Math.max(0, Math.min(12, Math.round(settings.quickSize))),
      quickCount: Math.max(0, Math.min(8, Math.round(settings.quickCount))),
      forceExactCount: Boolean(settings.forceExactCount),
    },
    email
  );
}

export async function updateSectionGroups(
  sectionId: string,
  groups: GroupEntry[],
  teacherEmail: string,
  recentPairKeys?: string[]
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const patch: Record<string, unknown> = {
    groups: sanitizeGroups(groups),
  };
  if (Array.isArray(recentPairKeys)) {
    patch.recentPairKeys = sanitizePairKeyList(recentPairKeys, LIMITS.MAX_RECENT_PAIRS);
  }
  await updateSectionWithAutoHeal(sectionId, patch, email);
}

export async function updateSectionFloorPlan(
  sectionId: string,
  floorPlan: FloorPlanLayout,
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  await updateSectionWithAutoHeal(sectionId, { floorPlan: sanitizeFloorPlan(floorPlan) }, email);
}

export async function applyFloorPlanToAllSections(
  sections: ClassSectionDoc[],
  floorPlan: FloorPlanLayout,
  teacherEmail: string
): Promise<void> {
  if (sections.length === 0) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const cleanPlan = sanitizeFloorPlan(floorPlan);
  try {
    const batch = writeBatch(db);
    sections.forEach((sec) => {
      batch.update(doc(db, SECTIONS_PATH, sec.id), {
        floorPlan: cleanPlan,
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch {
    for (let idx = 0; idx < sections.length; idx++) {
      await updateSectionWithAutoHeal(sections[idx].id, { floorPlan: cleanPlan }, email, idx);
    }
  }
}

export async function updateSectionPairRules(
  sectionId: string,
  patch: {
    keepApartPairs?: string[];
    pairTogetherPairs?: string[];
    recentPairKeys?: string[];
  },
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const payload: Record<string, unknown> = {};
  if (patch.keepApartPairs !== undefined) {
    payload.keepApartPairs = sanitizePairKeyList(patch.keepApartPairs, LIMITS.MAX_PAIR_RULES);
  }
  if (patch.pairTogetherPairs !== undefined) {
    payload.pairTogetherPairs = sanitizePairKeyList(patch.pairTogetherPairs, LIMITS.MAX_PAIR_RULES);
  }
  if (patch.recentPairKeys !== undefined) {
    payload.recentPairKeys = sanitizePairKeyList(patch.recentPairKeys, LIMITS.MAX_RECENT_PAIRS);
  }
  await updateSectionWithAutoHeal(sectionId, payload, email);
}

export async function updateSectionSpotlightDeck(
  sectionId: string,
  patch: { spotlightCalledIds?: string[]; spotlightDeckMode?: boolean },
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const payload: Record<string, unknown> = {};
  if (patch.spotlightCalledIds !== undefined) {
    payload.spotlightCalledIds = Array.from(
      new Set(
        patch.spotlightCalledIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => sanitizeId(id, 'st'))
      )
    ).slice(0, 150);
  }
  if (patch.spotlightDeckMode !== undefined) {
    payload.spotlightDeckMode = Boolean(patch.spotlightDeckMode);
  }
  await updateSectionWithAutoHeal(sectionId, payload, email);
}

export async function applyDefaultGroupingToAllSections(
  sections: ClassSectionDoc[],
  defaults: { quickSize: number; quickCount: number; forceExactCount: boolean },
  teacherEmail: string
): Promise<void> {
  if (sections.length === 0) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const quickSize = Math.max(0, Math.min(12, Math.round(defaults.quickSize)));
  const quickCount = Math.max(0, Math.min(8, Math.round(defaults.quickCount)));
  const forceExactCount = Boolean(defaults.forceExactCount);
  try {
    const batch = writeBatch(db);
    sections.forEach((sec) => {
      batch.update(doc(db, SECTIONS_PATH, sec.id), {
        quickSize,
        quickCount,
        forceExactCount,
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch {
    for (let idx = 0; idx < sections.length; idx++) {
      await updateSectionWithAutoHeal(
        sections[idx].id,
        { quickSize, quickCount, forceExactCount },
        email,
        idx
      );
    }
  }
}

export async function updateSectionPassQueue(
  sectionId: string,
  passQueue: string[],
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  await updateSectionWithAutoHeal(
    sectionId,
    { passQueue: sanitizePassQueue(passQueue) },
    email
  );
}

export async function markStudentAbsentAndRemoveFromGroups(
  sectionId: string,
  studentId: string,
  currentGroups: GroupEntry[],
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  const nextGroups = sanitizeGroups(
    currentGroups.map((g) => ({
      ...g,
      studentIds: g.studentIds.filter((id) => id !== studentId),
    }))
  );
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
      present: false,
      attendanceStatus: 'absent',
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, SECTIONS_PATH, sectionId), {
      groups: nextGroups,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    try {
      await updateSectionWithAutoHeal(sectionId, { groups: nextGroups }, email);
      await updateDoc(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
        present: false,
        attendanceStatus: 'absent',
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
      return;
    } catch {
      // fall through
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addStudent(
  sectionId: string,
  name: string,
  teacherEmail: string,
  badgeCode: string = ''
): Promise<void> {
  const cleanName = clampText(name, LIMITS.STUDENT_NAME_MAX);
  if (!cleanName) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const studentId = generateId('st');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  const cleanBadge = clampText(badgeCode, LIMITS.BADGE_CODE_MAX);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
      id: studentId,
      workspaceId: WORKSPACE_ID,
      sectionId,
      name: cleanName,
      present: true,
      attendanceStatus: 'present',
      ...(cleanBadge ? { badgeCode: cleanBadge } : {}),
      passesUsed: 0,
      outTimestamp: 0,
      createdBy: email,
      updatedBy: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function bulkAddStudents(
  sectionId: string,
  entries: Array<string | { name: string; badgeCode?: string }>,
  teacherEmail: string
): Promise<number> {
  const cleanEntries = entries
    .map((entry) =>
      typeof entry === 'string'
        ? { name: clampText(entry, LIMITS.STUDENT_NAME_MAX), badgeCode: '' }
        : {
            name: clampText(entry.name, LIMITS.STUDENT_NAME_MAX),
            badgeCode: clampText(entry.badgeCode || '', LIMITS.BADGE_CODE_MAX),
          }
    )
    .filter((e) => e.name.length > 0);
  if (cleanEntries.length === 0) return 0;

  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students`;

  try {
    for (let i = 0; i < cleanEntries.length; i += 400) {
      const chunk = cleanEntries.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((entry, idx) => {
        const studentId = `st_${Date.now()}_${i + idx}_${Math.random().toString(36).slice(2, 6)}`;
        batch.set(doc(db, path, studentId), {
          id: studentId,
          workspaceId: WORKSPACE_ID,
          sectionId,
          name: entry.name,
          present: true,
          attendanceStatus: 'present',
          ...(entry.badgeCode ? { badgeCode: entry.badgeCode } : {}),
          passesUsed: 0,
          outTimestamp: 0,
          createdBy: email,
          updatedBy: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
    return cleanEntries.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleStudentAttendance(
  sectionId: string,
  studentId: string,
  present: boolean,
  teacherEmail: string,
  attendanceStatus?: AttendanceStatus
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  const status: AttendanceStatus = attendanceStatus || (present ? 'present' : 'absent');
  try {
    await updateDoc(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
      present: Boolean(present),
      attendanceStatus: status,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateStudentBadgeCode(
  sectionId: string,
  studentId: string,
  badgeCode: string,
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  try {
    await updateDoc(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
      badgeCode: clampText(badgeCode, LIMITS.BADGE_CODE_MAX),
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllAttendance(
  sectionId: string,
  students: StudentDoc[],
  present: boolean,
  teacherEmail: string
): Promise<void> {
  if (students.length === 0) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students`;
  const status: AttendanceStatus = present ? 'present' : 'absent';
  try {
    for (let i = 0; i < students.length; i += 400) {
      const chunk = students.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((st) => {
        batch.update(doc(db, path, st.id), {
          present: Boolean(present),
          attendanceStatus: status,
          updatedBy: email,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStudent(
  sectionId: string,
  studentId: string,
  currentGroups: GroupEntry[],
  teacherEmail: string,
  currentPassQueue: string[] = []
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId));
    const hasStudentInGroups = currentGroups.some((g) => g.studentIds.includes(studentId));
    const hasStudentInQueue = currentPassQueue.includes(studentId);
    if (hasStudentInGroups || hasStudentInQueue) {
      const sectionPatch: Record<string, unknown> = {
        updatedBy: email,
        updatedAt: serverTimestamp(),
      };
      if (hasStudentInGroups) {
        sectionPatch.groups = sanitizeGroups(
          currentGroups.map((g) => ({
            ...g,
            studentIds: g.studentIds.filter((id) => id !== studentId),
          }))
        );
      }
      if (hasStudentInQueue) {
        sectionPatch.passQueue = sanitizePassQueue(
          currentPassQueue.filter((id) => id !== studentId)
        );
      }
      batch.update(doc(db, SECTIONS_PATH, sectionId), sectionPatch);
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function buildPassLogPayload(params: {
  logId: string;
  sectionId: string;
  sectionName: string;
  studentId: string;
  studentName: string;
  action: PassAction;
  destination?: PassDestination;
  quotaExempt?: boolean;
  passesUsedAfter: number;
  durationMinutes: number;
  durationSeconds: number;
  takenAt: number;
  returnedAt: number;
  email: string;
}) {
  return {
    id: params.logId,
    workspaceId: WORKSPACE_ID,
    sectionId: sanitizeId(params.sectionId, 'sec'),
    sectionName: clampText(params.sectionName || 'Class Period', LIMITS.SECTION_NAME_MAX),
    studentId: sanitizeId(params.studentId, 'st'),
    studentName: clampText(params.studentName || 'Student', LIMITS.STUDENT_NAME_MAX),
    action: params.action,
    ...(params.destination ? { destination: params.destination } : {}),
    ...(typeof params.quotaExempt === 'boolean' ? { quotaExempt: params.quotaExempt } : {}),
    passesUsedAfter: clampPassCount(params.passesUsedAfter),
    durationMinutes: Math.max(
      0,
      Math.min(LIMITS.MAX_DURATION_MINUTES, Math.round(params.durationMinutes))
    ),
    durationSeconds: Math.max(
      0,
      Math.min(LIMITS.MAX_DURATION_SECONDS, Math.round(params.durationSeconds))
    ),
    takenAt: Math.max(0, Math.round(params.takenAt)),
    returnedAt: Math.max(0, Math.round(params.returnedAt)),
    actorEmail: params.email,
    createdAt: serverTimestamp(),
  };
}

export async function issueStudentPass(
  sectionId: string,
  sectionName: string,
  student: StudentDoc,
  teacherEmail: string,
  currentPassQueue: string[] = [],
  maxPasses: number = LIMITS.DEFAULT_MAX_PASSES,
  destination: PassDestination = 'Restroom',
  quotaExempt: boolean = false
): Promise<void> {
  const effectiveMax = Math.max(1, Math.min(LIMITS.MAX_PASSES, Math.round(maxPasses)));
  if (!quotaExempt && student.passesUsed >= effectiveMax) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const nextCount = quotaExempt
    ? clampPassCount(student.passesUsed, effectiveMax)
    : clampPassCount(student.passesUsed + 1, effectiveMax);
  const nowMs = Date.now();
  const logId = generateId('log');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${student.id}`;
  const cleanDest: PassDestination = VALID_DESTINATIONS.includes(destination)
    ? destination
    : 'Restroom';

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, student.id), {
      passesUsed: nextCount,
      outTimestamp: nowMs,
      activeDestination: cleanDest,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    if (currentPassQueue.includes(student.id)) {
      batch.update(doc(db, SECTIONS_PATH, sectionId), {
        passQueue: sanitizePassQueue(currentPassQueue.filter((id) => id !== student.id)),
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
    }
    batch.set(
      doc(db, PASS_LOGS_PATH, logId),
      buildPassLogPayload({
        logId,
        sectionId,
        sectionName,
        studentId: student.id,
        studentName: student.name,
        action: 'issued',
        destination: cleanDest,
        quotaExempt,
        passesUsedAfter: nextCount,
        durationMinutes: 0,
        durationSeconds: 0,
        takenAt: nowMs,
        returnedAt: 0,
        email,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function returnStudentPass(
  sectionId: string,
  sectionName: string,
  student: StudentDoc,
  teacherEmail: string,
  quotaExempt: boolean = false
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const nowMs = Date.now();
  const takenAtMs = student.outTimestamp > 0 ? student.outTimestamp : nowMs;
  const elapsedSeconds =
    student.outTimestamp > 0 ? Math.max(0, Math.round((nowMs - student.outTimestamp) / 1000)) : 0;
  const elapsedMins = Math.round(elapsedSeconds / 60);
  const logId = generateId('log');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${student.id}`;
  const activeDest: PassDestination = VALID_DESTINATIONS.includes(
    student.activeDestination as PassDestination
  )
    ? (student.activeDestination as PassDestination)
    : 'Restroom';

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, student.id), {
      passesUsed: clampPassCount(student.passesUsed),
      outTimestamp: 0,
      activeDestination: '',
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    batch.set(
      doc(db, PASS_LOGS_PATH, logId),
      buildPassLogPayload({
        logId,
        sectionId,
        sectionName,
        studentId: student.id,
        studentName: student.name,
        action: 'returned',
        destination: activeDest,
        quotaExempt,
        passesUsedAfter: student.passesUsed,
        durationMinutes: elapsedMins,
        durationSeconds: elapsedSeconds,
        takenAt: takenAtMs,
        returnedAt: nowMs,
        email,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adjustStudentPassCount(
  sectionId: string,
  sectionName: string,
  student: StudentDoc,
  delta: number,
  teacherEmail: string,
  maxPasses: number = LIMITS.DEFAULT_MAX_PASSES
): Promise<void> {
  const effectiveMax = Math.max(1, Math.min(LIMITS.MAX_PASSES, Math.round(maxPasses)));
  const target = student.passesUsed + delta;
  if (target < 0 || target > effectiveMax) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const nextCount = clampPassCount(target, effectiveMax);
  const logId = generateId('log');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${student.id}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, student.id), {
      passesUsed: nextCount,
      outTimestamp: student.outTimestamp || 0,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
    batch.set(
      doc(db, PASS_LOGS_PATH, logId),
      buildPassLogPayload({
        logId,
        sectionId,
        sectionName,
        studentId: student.id,
        studentName: student.name,
        action: 'adjusted',
        passesUsedAfter: nextCount,
        durationMinutes: 0,
        durationSeconds: 0,
        takenAt: Date.now(),
        returnedAt: 0,
        email,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePassLogEntry(
  log: PassLogDoc,
  patch: {
    action: PassAction;
    destination?: PassDestination;
    quotaExempt?: boolean;
    passesUsedAfter: number;
    takenAt: number;
    returnedAt: number;
    durationSeconds: number;
  },
  teacherEmail: string,
  alsoUpdateStudent?: {
    sectionId: string;
    studentId: string;
    passesUsed: number;
    outTimestamp: number;
  }
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${PASS_LOGS_PATH}/${log.id}`;
  const cleanSeconds = Math.max(
    0,
    Math.min(LIMITS.MAX_DURATION_SECONDS, Math.round(patch.durationSeconds))
  );
  const cleanMinutes = Math.max(
    0,
    Math.min(LIMITS.MAX_DURATION_MINUTES, Math.round(cleanSeconds / 60))
  );
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      action: patch.action,
      passesUsedAfter: clampPassCount(patch.passesUsedAfter),
      durationMinutes: cleanMinutes,
      durationSeconds: cleanSeconds,
      takenAt: Math.max(0, Math.round(patch.takenAt)),
      returnedAt: Math.max(0, Math.round(patch.returnedAt)),
      actorEmail: email,
    };
    if (patch.destination && VALID_DESTINATIONS.includes(patch.destination)) {
      updatePayload.destination = patch.destination;
    }
    if (typeof patch.quotaExempt === 'boolean') {
      updatePayload.quotaExempt = patch.quotaExempt;
    }
    batch.update(doc(db, PASS_LOGS_PATH, log.id), updatePayload);
    if (alsoUpdateStudent) {
      batch.update(
        doc(
          db,
          `${SECTIONS_PATH}/${alsoUpdateStudent.sectionId}/students`,
          alsoUpdateStudent.studentId
        ),
        {
          passesUsed: clampPassCount(alsoUpdateStudent.passesUsed),
          outTimestamp: Math.max(0, Math.round(alsoUpdateStudent.outTimestamp)),
          updatedBy: email,
          updatedAt: serverTimestamp(),
        }
      );
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePassLogEntry(logId: string): Promise<void> {
  const path = `${PASS_LOGS_PATH}/${logId}`;
  try {
    await deleteDoc(doc(db, PASS_LOGS_PATH, logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearPassLogs(sectionIdOrAll: string | 'ALL'): Promise<number> {
  try {
    const snap = await getDocs(
      query(collection(db, PASS_LOGS_PATH), where('workspaceId', '==', WORKSPACE_ID))
    );
    const matchingDocs =
      sectionIdOrAll === 'ALL'
        ? snap.docs
        : snap.docs.filter((d) => (d.data() as PassLogDoc).sectionId === sectionIdOrAll);

    for (let i = 0; i < matchingDocs.length; i += 400) {
      const chunk = matchingDocs.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return matchingDocs.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, PASS_LOGS_PATH);
  }
}

export async function resetQuarterPasses(
  sectionId: string,
  sectionName: string,
  students: StudentDoc[],
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students`;
  const logId = generateId('log');

  try {
    const batch = writeBatch(db);
    students.forEach((st) => {
      batch.update(doc(db, path, st.id), {
        passesUsed: 0,
        outTimestamp: 0,
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
    });
    batch.set(
      doc(db, PASS_LOGS_PATH, logId),
      buildPassLogPayload({
        logId,
        sectionId,
        sectionName,
        studentId: 'ALL',
        studentName: `All Students (${students.length})`,
        action: 'reset',
        passesUsedAfter: 0,
        durationMinutes: 0,
        durationSeconds: 0,
        takenAt: Date.now(),
        returnedAt: 0,
        email,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface LegacyOrCloudBackupSection {
  id: string;
  name: string;
  order?: number;
  roster?: Array<{
    id?: string;
    name: string;
    present?: boolean;
    passesUsed?: number;
    outTimestamp?: number | null;
  }>;
  students?: Array<{
    id?: string;
    name: string;
    present?: boolean;
    passesUsed?: number;
    outTimestamp?: number | null;
  }>;
  groups?: Array<{
    id?: string;
    colorIndex?: number;
    name?: string;
    studentIds?: string[];
    students?: Array<{ id: string }>;
  }>;
  settings?: {
    quickSize?: number;
    quickCount?: number;
    forceExactCount?: boolean;
  };
  quickSize?: number;
  quickCount?: number;
  forceExactCount?: boolean;
}

export async function importBackupToFirestore(
  importedSections: LegacyOrCloudBackupSection[],
  importedActiveSectionId: string | undefined,
  existingSections: ClassSectionDoc[],
  teacherEmail: string
): Promise<void> {
  if (!importedSections || importedSections.length === 0) {
    throw new Error('Backup contains no sections.');
  }
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);

  try {
    // First remove existing sections & their students cleanly
    for (const sec of existingSections) {
      const studentsPath = `${SECTIONS_PATH}/${sec.id}/students`;
      const existingStudents = await getDocs(
        query(
          collection(db, studentsPath),
          where('sectionId', '==', sec.id)
        )
      );
      const delBatch = writeBatch(db);
      existingStudents.docs.forEach((d) => delBatch.delete(d.ref));
      delBatch.delete(doc(db, SECTIONS_PATH, sec.id));
      await delBatch.commit();
    }

    let firstSectionId = '';

    for (let sIdx = 0; sIdx < importedSections.length; sIdx++) {
      const rawSec = importedSections[sIdx];
      const secId = sanitizeId(rawSec.id || `sec_${sIdx + 1}`, `sec_${sIdx + 1}`);
      if (!firstSectionId) firstSectionId = secId;

      const rawRoster = rawSec.roster || rawSec.students || [];
      const studentIdMap = new Map<string, string>();
      const preparedStudents = rawRoster.map((st, idx) => {
        const cleanId = sanitizeId(st.id || `st_${idx + 1}`, `st_${idx + 1}`);
        if (st.id) studentIdMap.set(st.id, cleanId);
        return {
          id: cleanId,
          workspaceId: WORKSPACE_ID,
          sectionId: secId,
          name: clampText(st.name || `Student ${idx + 1}`, LIMITS.STUDENT_NAME_MAX),
          present: st.present !== false,
          passesUsed: clampPassCount(st.passesUsed ?? 0),
          outTimestamp: typeof st.outTimestamp === 'number' && st.outTimestamp > 0 ? st.outTimestamp : 0,
          createdBy: email,
          updatedBy: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      });

      const rawGroups = rawSec.groups || [];
      const preparedGroups: GroupEntry[] = sanitizeGroups(
        rawGroups.map((g, gIdx) => ({
          id: sanitizeId(g.id || `grp_${gIdx + 1}`, `grp_${gIdx + 1}`),
          colorIndex: typeof g.colorIndex === 'number' ? g.colorIndex : gIdx % COLOR_DEFINITIONS.length,
          name: g.name || COLOR_DEFINITIONS[gIdx % COLOR_DEFINITIONS.length].name,
          studentIds: (g.studentIds || (g.students ? g.students.map((s) => s.id) : []))
            .map((sid) => studentIdMap.get(sid) || sanitizeId(sid, 'st')),
        }))
      );

      const quickSize = rawSec.settings?.quickSize ?? rawSec.quickSize ?? 4;
      const quickCount = rawSec.settings?.quickCount ?? rawSec.quickCount ?? 0;
      const forceExactCount = rawSec.settings?.forceExactCount ?? rawSec.forceExactCount ?? false;

      const batch = writeBatch(db);
      batch.set(doc(db, SECTIONS_PATH, secId), {
        id: secId,
        workspaceId: WORKSPACE_ID,
        name: clampText(rawSec.name || `Period ${sIdx + 1}`, LIMITS.SECTION_NAME_MAX),
        order: typeof rawSec.order === 'number' ? Math.max(0, Math.min(10000, rawSec.order)) : sIdx,
        quickSize: Math.max(0, Math.min(12, quickSize)),
        quickCount: Math.max(0, Math.min(8, quickCount)),
        forceExactCount: Boolean(forceExactCount),
        groups: preparedGroups,
        createdBy: email,
        updatedBy: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      preparedStudents.forEach((st) => {
        batch.set(doc(db, `${SECTIONS_PATH}/${secId}/students`, st.id), st);
      });

      await batch.commit();
    }

    const targetActive = importedActiveSectionId
      ? sanitizeId(importedActiveSectionId, 'sec')
      : firstSectionId;

    await updateDoc(doc(db, 'workspaces', WORKSPACE_ID), {
      activeSectionId: targetActive || firstSectionId,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, WORKSPACE_PATH);
  }
}
