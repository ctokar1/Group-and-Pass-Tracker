import {
  CLASSROOM_ROLES,
  COLOR_DEFINITIONS,
  LIMITS,
  type ClassSectionDoc,
  type GroupEntry,
  type StudentDoc,
} from '../types/classroom';

export function makePairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
}

export function parsePairKey(key: string): [string, string] | null {
  const parts = key.split('|');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

export function extractPairsFromGroups(groups: GroupEntry[]): string[] {
  const pairs: string[] = [];
  groups.forEach((g) => {
    const ids = g.studentIds || [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pairs.push(makePairKey(ids[i], ids[j]));
      }
    }
  });
  return pairs;
}

export function assignGroupRoles(
  studentIds: string[],
  offset: number = 0
): Record<string, string> {
  const roles: Record<string, string> = {};
  studentIds.forEach((sid, idx) => {
    roles[sid] = CLASSROOM_ROLES[(idx + offset) % CLASSROOM_ROLES.length];
  });
  return roles;
}

export function clearGroupRoles(groups: GroupEntry[]): GroupEntry[] {
  return groups.map((g) => ({
    ...g,
    roles: {},
  }));
}

export function rotateGroupRoles(groups: GroupEntry[]): GroupEntry[] {
  return groups.map((g) => {
    const ids = g.studentIds || [];
    if (ids.length === 0) return g;
    const currentRoles = g.roles || {};
    const firstRole = currentRoles[ids[0]];
    const currentIdx = firstRole
      ? CLASSROOM_ROLES.indexOf(firstRole as (typeof CLASSROOM_ROLES)[number])
      : -1;
    const nextOffset = currentIdx >= 0 ? currentIdx + 1 : 1;
    return {
      ...g,
      roles: assignGroupRoles(ids, nextOffset),
    };
  });
}

export function formatRuleSummary(section: ClassSectionDoc | undefined): string {
  if (!section) return 'Groups of 4 Students (Default)';
  const qSize = section.quickSize || 0;
  const qCount = section.quickCount || 0;
  const forceExact = Boolean(section.forceExactCount);

  let ruleText = '';
  if (qCount > 0 && qSize > 0) {
    ruleText = `${qCount} Total Groups · ${qSize} Students / Group`;
  } else if (qCount > 0) {
    ruleText = `${qCount} Total Groups (Evenly Divided)`;
  } else if (qSize > 0) {
    ruleText = `Groups of ${qSize} Students`;
  } else {
    ruleText = 'Groups of 4 Students (Default)';
  }

  if (forceExact && qCount > 0) {
    ruleText += ' [Strict Cap]';
  }

  return ruleText;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface GenerateGroupsOptions {
  assignRoles?: boolean;
  avoidRecentPairs?: boolean;
}

export function generateColorGroups(
  students: StudentDoc[],
  section: ClassSectionDoc,
  options: GenerateGroupsOptions = {}
): { groups: GroupEntry[]; nextRecentPairKeys: string[] } {
  const { assignRoles = false, avoidRecentPairs = true } = options;
  const presentStudents = students.filter((s) => s.present);
  if (presentStudents.length === 0) {
    return { groups: [], nextRecentPairKeys: section.recentPairKeys || [] };
  }

  const presentIdSet = new Set(presentStudents.map((s) => s.id));
  const existingGroups = section.groups || [];

  // 1. Identify pinned/locked students and which group index they belong to
  const lockedByGroupIndex = new Map<number, string[]>();
  const lockedStudentSet = new Set<string>();
  const pointsByGroupIndex = new Map<number, number>();

  existingGroups.forEach((g, idx) => {
    if (typeof g.points === 'number' && g.points !== 0) {
      pointsByGroupIndex.set(idx, g.points);
    }
    const locked = (g.lockedStudentIds || []).filter(
      (sid) => presentIdSet.has(sid) && g.studentIds.includes(sid)
    );
    if (locked.length > 0) {
      lockedByGroupIndex.set(idx, locked);
      locked.forEach((sid) => lockedStudentSet.add(sid));
    }
  });

  const totalCount = presentStudents.length;
  let qSize = section.quickSize || 0;
  const qCount = section.quickCount || 0;

  let numGroups = 0;
  let targetCapacity = 0;

  if (qCount > 0 && qSize > 0) {
    numGroups = qCount;
    targetCapacity = qSize;
  } else if (qCount > 0) {
    numGroups = qCount;
    targetCapacity = Math.ceil(totalCount / numGroups);
  } else if (qSize > 0) {
    numGroups = Math.ceil(totalCount / qSize);
    targetCapacity = qSize;
  } else {
    qSize = 4;
    numGroups = Math.ceil(totalCount / qSize);
    targetCapacity = qSize;
  }

  const maxLockedIdx = lockedByGroupIndex.size > 0
    ? Math.max(...Array.from(lockedByGroupIndex.keys())) + 1
    : 1;
  numGroups = Math.max(1, Math.min(Math.max(numGroups, maxLockedIdx), LIMITS.MAX_GROUPS));

  const groups: GroupEntry[] = [];
  for (let i = 0; i < numGroups; i++) {
    const colorDef = COLOR_DEFINITIONS[i % COLOR_DEFINITIONS.length];
    const lockedIds = lockedByGroupIndex.get(i) || [];
    groups.push({
      id: existingGroups[i]?.id || `grp_${i + 1}`,
      colorIndex: i,
      name: existingGroups[i]?.name || colorDef.name,
      studentIds: [...lockedIds],
      lockedStudentIds: [...lockedIds],
      points: pointsByGroupIndex.get(i) ?? 0,
    });
  }

  // 2. Build pairing constraints sets
  const keepApartSet = new Set(section.keepApartPairs || []);
  const recentPairSet = avoidRecentPairs ? new Set(section.recentPairKeys || []) : new Set<string>();

  // Connected components for "Pair Together" rules
  const adj = new Map<string, Set<string>>();
  (section.pairTogetherPairs || []).forEach((pairKey) => {
    const parsed = parsePairKey(pairKey);
    if (!parsed) return;
    const [a, b] = parsed;
    if (!presentIdSet.has(a) || !presentIdSet.has(b)) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  });

  const visited = new Set<string>();
  const placementUnits: string[][] = [];

  const unlockedPresent = shuffleArray(
    presentStudents.filter((s) => !lockedStudentSet.has(s.id))
  );

  // First handle components attached to a locked student
  lockedStudentSet.forEach((lockedSid) => {
    if (visited.has(lockedSid)) return;
    const queue = [lockedSid];
    const comp: string[] = [];
    visited.add(lockedSid);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      adj.get(curr)?.forEach((nbr) => {
        if (!visited.has(nbr)) {
          visited.add(nbr);
          queue.push(nbr);
        }
      });
    }
    const lockedHostGroup = groups.find((g) => g.studentIds.includes(lockedSid));
    if (lockedHostGroup) {
      comp.forEach((sid) => {
        if (!lockedHostGroup.studentIds.includes(sid)) {
          lockedHostGroup.studentIds.push(sid);
        }
      });
    }
  });

  // Remaining unlocked components / singletons
  for (const st of unlockedPresent) {
    if (visited.has(st.id)) continue;
    const queue = [st.id];
    const comp: string[] = [];
    visited.add(st.id);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      comp.push(curr);
      adj.get(curr)?.forEach((nbr) => {
        if (!visited.has(nbr) && !lockedStudentSet.has(nbr)) {
          visited.add(nbr);
          queue.push(nbr);
        }
      });
    }
    placementUnits.push(comp);
  }

  // Place larger bonded pairs/units first so they fit cleanly
  placementUnits.sort((a, b) => b.length - a.length);

  // Target ideal group sizes (even distribution)
  const idealBase = Math.floor(totalCount / numGroups);
  const remainder = totalCount % numGroups;
  const softCaps = groups.map((_, idx) => {
    if (qCount > 0 && qSize > 0) return targetCapacity;
    return idealBase + (idx < remainder ? 1 : 0);
  });

  // 3. Score-based placement respecting Keep Apart, Recent Pairs, and Size Balance
  for (const unit of placementUnits) {
    let bestGroupIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    const candidateIndices = shuffleArray(groups.map((_, idx) => idx));
    for (const gIdx of candidateIndices) {
      const grp = groups[gIdx];
      let score = 0;

      // Capacity penalty
      const projectedLen = grp.studentIds.length + unit.length;
      if (projectedLen > softCaps[gIdx]) {
        score += (projectedLen - softCaps[gIdx]) * 500;
      }
      score += grp.studentIds.length * 10;

      // Check every member in unit against existing members in group
      for (const memberId of unit) {
        for (const existingId of grp.studentIds) {
          const pk = makePairKey(memberId, existingId);
          if (keepApartSet.has(pk)) {
            score += 50000;
          }
          if (recentPairSet.has(pk)) {
            score += 120;
          }
        }
      }

      if (score < bestScore) {
        bestScore = score;
        bestGroupIdx = gIdx;
      }
    }

    groups[bestGroupIdx].studentIds.push(...unit);
  }

  // 4. Assign rotating roles only when opted in; otherwise clear roles
  groups.forEach((g, idx) => {
    g.roles = assignRoles ? assignGroupRoles(g.studentIds, idx) : {};
  });

  // 5. Update recent pairing memory (merge new round with previous, cap at LIMITS.MAX_RECENT_PAIRS)
  const newPairs = extractPairsFromGroups(groups);
  const combinedSet = new Set<string>([...newPairs, ...(section.recentPairKeys || [])]);
  const nextRecentPairKeys = Array.from(combinedSet).slice(0, LIMITS.MAX_RECENT_PAIRS);

  return { groups, nextRecentPairKeys };
}

/**
 * Drops a late-arriving (tardy) student directly into the open seat / smallest group
 * without reshuffling existing seated students.
 */
export function dropStudentIntoOpenSeat(
  studentId: string,
  groups: GroupEntry[],
  keepApartPairs: string[] = [],
  assignRoles: boolean = false
): GroupEntry[] {
  if (groups.length === 0) return groups;
  const alreadySeated = groups.some((g) => g.studentIds.includes(studentId));
  if (alreadySeated) return groups;

  const keepApartSet = new Set(keepApartPairs);
  let bestIdx = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  groups.forEach((g, idx) => {
    let score = g.studentIds.length * 10;
    g.studentIds.forEach((otherId) => {
      if (keepApartSet.has(makePairKey(studentId, otherId))) {
        score += 10000;
      }
    });
    if (score < bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  const anyExistingRoles = groups.some(
    (g) => g.roles && Object.keys(g.roles).length > 0
  );

  return groups.map((g, idx) => {
    if (idx !== bestIdx) return g;
    const nextIds = [...g.studentIds, studentId];
    if (!assignRoles && !anyExistingRoles) {
      return {
        ...g,
        studentIds: nextIds,
      };
    }
    const usedRoles = new Set(Object.values(g.roles || {}));
    const nextRole =
      CLASSROOM_ROLES.find((r) => !usedRoles.has(r)) ||
      CLASSROOM_ROLES[nextIds.length % CLASSROOM_ROLES.length];
    return {
      ...g,
      studentIds: nextIds,
      roles: {
        ...(g.roles || {}),
        [studentId]: nextRole,
      },
    };
  });
}
