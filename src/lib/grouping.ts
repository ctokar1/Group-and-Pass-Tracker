import {
  COLOR_DEFINITIONS,
  type ClassSectionDoc,
  type GroupEntry,
  type StudentDoc,
} from '../types/classroom';

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

export function generateColorGroups(
  students: StudentDoc[],
  section: ClassSectionDoc
): GroupEntry[] {
  const presentStudents = students.filter((s) => s.present);
  if (presentStudents.length === 0) {
    return [];
  }

  // Fisher-Yates shuffle
  const shuffled = [...presentStudents];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const totalCount = shuffled.length;
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

  numGroups = Math.max(1, Math.min(numGroups, 8));

  const groups: GroupEntry[] = [];
  for (let i = 0; i < numGroups; i++) {
    const colorDef = COLOR_DEFINITIONS[i % COLOR_DEFINITIONS.length];
    groups.push({
      id: `grp_${i + 1}`,
      colorIndex: i,
      name: colorDef.name,
      studentIds: [],
    });
  }

  let studentIdx = 0;

  if (qCount > 0 && qSize > 0) {
    for (let g = 0; g < groups.length; g++) {
      while (groups[g].studentIds.length < targetCapacity && studentIdx < totalCount) {
        groups[g].studentIds.push(shuffled[studentIdx++].id);
      }
    }
    while (studentIdx < totalCount) {
      const randomGrp = groups[Math.floor(Math.random() * groups.length)];
      randomGrp.studentIds.push(shuffled[studentIdx++].id);
    }
  } else {
    let currentGroup = 0;
    while (studentIdx < totalCount) {
      groups[currentGroup % numGroups].studentIds.push(shuffled[studentIdx++].id);
      currentGroup++;
    }
  }

  return groups;
}
