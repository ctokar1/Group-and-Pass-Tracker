import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  COLOR_DEFINITIONS,
  LIMITS,
  WORKSPACE_ID,
  type ClassSectionDoc,
  type GroupEntry,
  type PassAction,
  type PassLogDoc,
  type StudentDoc,
  type WorkspaceDoc,
} from '../types/classroom';

const WORKSPACE_PATH = `workspaces/${WORKSPACE_ID}`;
const SECTIONS_PATH = `workspaces/${WORKSPACE_ID}/sections`;
const PASS_LOGS_PATH = `workspaces/${WORKSPACE_ID}/passLogs`;

const DEFAULT_SAMPLE_ROSTER = [
  { id: 'st_1', name: 'Alexander Davis', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_2', name: 'Jordan Carter', present: true, passesUsed: 1, outTimestamp: 0 },
  { id: 'st_3', name: 'Taylor Smith', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_4', name: 'Morgan Vance', present: true, passesUsed: 2, outTimestamp: 0 },
  { id: 'st_5', name: 'Riley Johnson', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_6', name: 'Casey Williams', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_7', name: 'Avery Brown', present: true, passesUsed: 4, outTimestamp: 0 },
  { id: 'st_8', name: 'Dakota Jones', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_9', name: 'Cameron Miller', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_10', name: 'Skyler Wilson', present: true, passesUsed: 1, outTimestamp: 0 },
  { id: 'st_11', name: 'Reese Moore', present: true, passesUsed: 0, outTimestamp: 0 },
  { id: 'st_12', name: 'Quinn Taylor', present: true, passesUsed: 0, outTimestamp: 0 },
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

function clampPassCount(count: number): number {
  const rounded = Math.round(Number(count) || 0);
  return Math.max(0, Math.min(LIMITS.MAX_PASSES, rounded));
}

function sanitizeGroups(groups: GroupEntry[]): GroupEntry[] {
  return groups.slice(0, LIMITS.MAX_GROUPS).map((g, idx) => ({
    id: sanitizeId(g.id, `grp_${idx + 1}`),
    colorIndex: Math.max(0, Math.min(7, Math.round(Number(g.colorIndex) || 0))),
    name: clampText(g.name || COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length].name, LIMITS.GROUP_NAME_MAX),
    studentIds: (g.studentIds || [])
      .map((sid) => sanitizeId(sid, 'st'))
      .slice(0, LIMITS.MAX_GROUP_STUDENTS),
  }));
}

export async function ensureWorkspaceAndSeed(teacherEmail: string): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const workspaceRef = doc(db, 'workspaces', WORKSPACE_ID);

  try {
    const snap = await getDoc(workspaceRef);
    if (snap.exists()) {
      return;
    }

    const batch = writeBatch(db);
    const defaultSectionId = 'sec_1';
    const sectionRef = doc(db, SECTIONS_PATH, defaultSectionId);

    batch.set(workspaceRef, {
      id: WORKSPACE_ID,
      activeSectionId: defaultSectionId,
      createdBy: email,
      updatedBy: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(sectionRef, {
      id: defaultSectionId,
      workspaceId: WORKSPACE_ID,
      name: 'Period 1 - Heights Tigers',
      order: 0,
      quickSize: 4,
      quickCount: 0,
      forceExactCount: false,
      groups: [],
      createdBy: email,
      updatedBy: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const student of DEFAULT_SAMPLE_ROSTER) {
      const studentRef = doc(db, `${SECTIONS_PATH}/${defaultSectionId}/students`, student.id);
      batch.set(studentRef, {
        id: student.id,
        workspaceId: WORKSPACE_ID,
        sectionId: defaultSectionId,
        name: student.name,
        present: student.present,
        passesUsed: student.passesUsed,
        outTimestamp: student.outTimestamp,
        createdBy: email,
        updatedBy: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
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
        .slice(0, 60);
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

export async function createSection(
  name: string,
  nextOrder: number,
  teacherEmail: string
): Promise<string> {
  const cleanName = clampText(name, LIMITS.SECTION_NAME_MAX);
  if (!cleanName) throw new Error('Section name is required.');
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const sectionId = generateId('sec');
  const order = Math.max(0, Math.min(10000, Math.round(nextOrder)));

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, SECTIONS_PATH, sectionId), {
      id: sectionId,
      workspaceId: WORKSPACE_ID,
      name: cleanName,
      order,
      quickSize: 4,
      quickCount: 0,
      forceExactCount: false,
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
  const path = `${SECTIONS_PATH}/${sectionId}`;
  try {
    await updateDoc(doc(db, SECTIONS_PATH, sectionId), {
      name: cleanName,
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
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
  const path = `${SECTIONS_PATH}/${sectionId}`;
  try {
    await updateDoc(doc(db, SECTIONS_PATH, sectionId), {
      quickSize: Math.max(0, Math.min(12, Math.round(settings.quickSize))),
      quickCount: Math.max(0, Math.min(8, Math.round(settings.quickCount))),
      forceExactCount: Boolean(settings.forceExactCount),
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSectionGroups(
  sectionId: string,
  groups: GroupEntry[],
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}`;
  try {
    await updateDoc(doc(db, SECTIONS_PATH, sectionId), {
      groups: sanitizeGroups(groups),
      updatedBy: email,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addStudent(
  sectionId: string,
  name: string,
  teacherEmail: string
): Promise<void> {
  const cleanName = clampText(name, LIMITS.STUDENT_NAME_MAX);
  if (!cleanName) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const studentId = generateId('st');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
      id: studentId,
      workspaceId: WORKSPACE_ID,
      sectionId,
      name: cleanName,
      present: true,
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
  names: string[],
  teacherEmail: string
): Promise<number> {
  const cleanNames = names
    .map((n) => clampText(n, LIMITS.STUDENT_NAME_MAX))
    .filter((n) => n.length > 0);
  if (cleanNames.length === 0) return 0;

  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students`;

  try {
    // Firestore batch supports up to 500 writes per batch
    for (let i = 0; i < cleanNames.length; i += 400) {
      const chunk = cleanNames.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((cleanName, idx) => {
        const studentId = `st_${Date.now()}_${i + idx}_${Math.random().toString(36).slice(2, 6)}`;
        batch.set(doc(db, path, studentId), {
          id: studentId,
          workspaceId: WORKSPACE_ID,
          sectionId,
          name: cleanName,
          present: true,
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
    return cleanNames.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleStudentAttendance(
  sectionId: string,
  studentId: string,
  present: boolean,
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  try {
    await updateDoc(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId), {
      present: Boolean(present),
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
  try {
    for (let i = 0; i < students.length; i += 400) {
      const chunk = students.slice(i, i + 400);
      const batch = writeBatch(db);
      chunk.forEach((st) => {
        batch.update(doc(db, path, st.id), {
          present: Boolean(present),
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
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const path = `${SECTIONS_PATH}/${sectionId}/students/${studentId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, studentId));
    const hasStudentInGroups = currentGroups.some((g) => g.studentIds.includes(studentId));
    if (hasStudentInGroups) {
      const updatedGroups = currentGroups.map((g) => ({
        ...g,
        studentIds: g.studentIds.filter((id) => id !== studentId),
      }));
      batch.update(doc(db, SECTIONS_PATH, sectionId), {
        groups: sanitizeGroups(updatedGroups),
        updatedBy: email,
        updatedAt: serverTimestamp(),
      });
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
  passesUsedAfter: number;
  durationMinutes: number;
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
    passesUsedAfter: clampPassCount(params.passesUsedAfter),
    durationMinutes: Math.max(
      0,
      Math.min(LIMITS.MAX_DURATION_MINUTES, Math.round(params.durationMinutes))
    ),
    actorEmail: params.email,
    createdAt: serverTimestamp(),
  };
}

export async function issueStudentPass(
  sectionId: string,
  sectionName: string,
  student: StudentDoc,
  teacherEmail: string
): Promise<void> {
  if (student.passesUsed >= LIMITS.MAX_PASSES) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const nextCount = clampPassCount(student.passesUsed + 1);
  const nowMs = Date.now();
  const logId = generateId('log');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${student.id}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, student.id), {
      passesUsed: nextCount,
      outTimestamp: nowMs,
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
        action: 'issued',
        passesUsedAfter: nextCount,
        durationMinutes: 0,
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
  teacherEmail: string
): Promise<void> {
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const elapsedMins =
    student.outTimestamp > 0 ? Math.max(0, Math.round((Date.now() - student.outTimestamp) / 60000)) : 0;
  const logId = generateId('log');
  const path = `${SECTIONS_PATH}/${sectionId}/students/${student.id}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, `${SECTIONS_PATH}/${sectionId}/students`, student.id), {
      passesUsed: clampPassCount(student.passesUsed),
      outTimestamp: 0,
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
        passesUsedAfter: student.passesUsed,
        durationMinutes: elapsedMins,
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
  teacherEmail: string
): Promise<void> {
  const target = student.passesUsed + delta;
  if (target < 0 || target > LIMITS.MAX_PASSES) return;
  const email = teacherEmail.trim().toLowerCase().slice(0, LIMITS.EMAIL_MAX);
  const nextCount = clampPassCount(target);
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
        email,
      })
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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
