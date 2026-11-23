import {
  LIMITS,
  type AppSettings,
  type BellScheduleProfile,
  type ClassSectionDoc,
  type StudentDoc,
} from '../types/classroom';

export function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export interface DeadZoneStatus {
  locked: boolean;
  reason: string;
  unlockCountdownSeconds: number;
  windowLabel: string;
}

export interface BellEvaluation {
  activeProfile: BellScheduleProfile | null;
  currentSlotSectionId: string | null;
  currentSlotLabel: string | null;
  nextAutoSwitchSectionId: string | null;
  deadZone: DeadZoneStatus;
}

export function formatCountdownMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function evaluateBellSchedule(
  nowMs: number,
  activeSectionId: string | undefined,
  sections: ClassSectionDoc[],
  settings: AppSettings
): BellEvaluation {
  const profiles = settings.bellSchedules || [];
  const activeProfile =
    profiles.find((p) => p.id === settings.activeScheduleId) || profiles[0] || null;

  const emptyDeadZone: DeadZoneStatus = {
    locked: false,
    reason: '',
    unlockCountdownSeconds: 0,
    windowLabel: '',
  };

  if (!activeProfile) {
    return {
      activeProfile: null,
      currentSlotSectionId: null,
      currentSlotLabel: null,
      nextAutoSwitchSectionId: null,
      deadZone: emptyDeadZone,
    };
  }

  const d = new Date(nowMs);
  const currentSecOfDay = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  const sectionIds = new Set(sections.map((s) => s.id));

  let currentSlotSectionId: string | null = null;
  let currentSlotLabel: string | null = null;
  let nextAutoSwitchSectionId: string | null = null;

  const leadSecs = Math.max(0, Math.round(settings.autoSwitchLeadMinutes || 0) * 60);

  const validSlots = activeProfile.slots
    .map((slot) => {
      const startMin = parseTimeToMinutes(slot.startTime);
      const endMin = parseTimeToMinutes(slot.endTime);
      if (startMin === null || endMin === null || endMin <= startMin) return null;
      return {
        sectionId: slot.sectionId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        startSec: startMin * 60,
        endSec: endMin * 60,
      };
    })
    .filter((s): s is NonNullable<typeof s> => Boolean(s && sectionIds.has(s.sectionId)))
    .sort((a, b) => a.startSec - b.startSec);

  for (const slot of validSlots) {
    if (currentSecOfDay >= slot.startSec && currentSecOfDay < slot.endSec) {
      currentSlotSectionId = slot.sectionId;
      currentSlotLabel = `${slot.startTime}–${slot.endTime}`;
    }
    if (
      settings.autoSwitchPeriod &&
      currentSecOfDay >= slot.startSec - leadSecs &&
      currentSecOfDay < slot.endSec
    ) {
      nextAutoSwitchSectionId = slot.sectionId;
    }
  }

  // Evaluate Dead Zone for the currently viewed activeSectionId
  let deadZone: DeadZoneStatus = emptyDeadZone;
  if (settings.deadZoneEnabled && activeSectionId) {
    const viewedSlot = validSlots.find((s) => s.sectionId === activeSectionId);
    if (viewedSlot && currentSecOfDay >= viewedSlot.startSec && currentSecOfDay < viewedSlot.endSec) {
      const startWindowEnd = viewedSlot.startSec + settings.deadZoneStartMinutes * 60;
      const endWindowStart = viewedSlot.endSec - settings.deadZoneEndMinutes * 60;

      if (settings.deadZoneStartMinutes > 0 && currentSecOfDay < startWindowEnd) {
        const remaining = Math.max(0, startWindowEnd - currentSecOfDay);
        deadZone = {
          locked: true,
          reason: `First ${settings.deadZoneStartMinutes} min of class`,
          unlockCountdownSeconds: remaining,
          windowLabel: `Opening Lockout (${viewedSlot.startTime})`,
        };
      } else if (settings.deadZoneEndMinutes > 0 && currentSecOfDay >= endWindowStart) {
        const remaining = Math.max(0, viewedSlot.endSec - currentSecOfDay);
        deadZone = {
          locked: true,
          reason: `Last ${settings.deadZoneEndMinutes} min of class`,
          unlockCountdownSeconds: remaining,
          windowLabel: `Closing Lockout (Bell ${viewedSlot.endTime})`,
        };
      }
    }
  }

  return {
    activeProfile,
    currentSlotSectionId,
    currentSlotLabel,
    nextAutoSwitchSectionId,
    deadZone,
  };
}

export interface ParsedRosterCandidate {
  name: string;
  badgeCode: string;
  isDuplicate: boolean;
  rawLine: string;
}

function normalizeNameWords(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word === word.toUpperCase() && word.length > 1) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    })
    .join(' ')
    .slice(0, LIMITS.STUDENT_NAME_MAX);
}

/**
 * Parses raw pasted columns from SIS (ProgressBook, Infinite Campus, PowerSchool, CSV/TSV)
 * - Strips row numbers ("1.", "2)", "12 ")
 * - Strips email addresses and parenthetical grades/notes
 * - Converts "Last, First [Middle]" -> "First Last"
 * - Extracts optional student numeric ID / badge code (4–12 digits/alphanumeric token)
 * - Deduplicates against existing students and within the pasted block
 */
export function parseSmartRosterInput(
  rawText: string,
  existingStudents: StudentDoc[]
): ParsedRosterCandidate[] {
  const existingNames = new Set(
    existingStudents.map((s) => s.name.trim().toLowerCase())
  );
  const seenInBatch = new Set<string>();
  const lines = rawText.split(/\r?\n/);
  const results: ParsedRosterCandidate[] = [];

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Skip obvious CSV/SIS header rows
    const lowerHeader = line.toLowerCase();
    if (
      lowerHeader === 'student name' ||
      lowerHeader === 'name' ||
      lowerHeader.startsWith('student_name') ||
      lowerHeader.startsWith('last name,first name') ||
      lowerHeader.startsWith('student id')
    ) {
      continue;
    }

    let badgeCode = '';

    // Check tab-delimited columns (e.g. from spreadsheet/SIS table copy)
    if (line.includes('\t')) {
      const cols = line
        .split('\t')
        .map((c) => c.trim())
        .filter(Boolean);
      const idCol = cols.find((c) => /^[a-zA-Z0-9-]{4,16}$/.test(c) && /\d/.test(c));
      if (idCol) badgeCode = idCol.slice(0, LIMITS.BADGE_CODE_MAX);
      const nonIdCols = cols.filter(
        (c) =>
          c !== idCol &&
          !c.includes('@') &&
          !/^(grade\s*)?\d{1,2}(th|st|nd|rd)?$/i.test(c)
      );
      if (nonIdCols.length >= 2 && nonIdCols.every((c) => !c.includes(' '))) {
        // Likely First \t Last or Last \t First — assume First Last unless comma
        line = `${nonIdCols[0]} ${nonIdCols[1]}`;
      } else if (nonIdCols.length >= 1) {
        line = nonIdCols[0];
      }
    }

    // Remove email addresses and parenthetical metadata like (123456) or (Grade 9)
    line = line.replace(/\S+@\S+\.\S+/g, ' ');
    const parenMatch = /\(([a-zA-Z0-9_-]{3,16})\)/.exec(line);
    if (parenMatch && /\d/.test(parenMatch[1]) && !badgeCode) {
      badgeCode = parenMatch[1].slice(0, LIMITS.BADGE_CODE_MAX);
    }
    line = line.replace(/\([^)]*\)/g, ' ').trim();

    // Remove leading row numbering like "1." "02)" "3 -"
    line = line.replace(/^\s*\d{1,3}[.):\-]\s+/, '').trim();

    // Extract trailing standalone numeric/alphanumeric student ID if present
    const trailingIdMatch = /\s+([A-Za-z]?\d{4,12})$/.exec(line);
    if (trailingIdMatch) {
      if (!badgeCode) badgeCode = trailingIdMatch[1].slice(0, LIMITS.BADGE_CODE_MAX);
      line = line.slice(0, trailingIdMatch.index).trim();
    }

    // Handle "Last, First [Middle]" format
    if (line.includes(',')) {
      const parts = line
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2 && !/\d/.test(parts[0]) && !/\d/.test(parts[1])) {
        // Check if second part is multiple tokens "First Middle" -> keep First Middle + Last or First Last
        line = `${parts[1]} ${parts[0]}`;
      } else if (parts.length >= 1) {
        line = parts[0];
      }
    }

    const cleanName = normalizeNameWords(line.replace(/["']/g, (m) => (m === '"' ? '' : m)));
    if (!cleanName || cleanName.length < 2 || /^\d+$/.test(cleanName)) continue;

    const key = cleanName.toLowerCase();
    const isDuplicate = existingNames.has(key) || seenInBatch.has(key);
    seenInBatch.add(key);

    results.push({
      name: cleanName,
      badgeCode,
      isDuplicate,
      rawLine,
    });
  }

  return results;
}
