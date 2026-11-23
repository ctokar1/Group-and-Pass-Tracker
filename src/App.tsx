import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  auth,
  db,
  isAuthorizedTeacherUser,
  signOutTeacher,
} from './lib/firebase';
import {
  addStudent,
  adjustStudentPassCount,
  applyDefaultGroupingToAllSections,
  bulkAddStudents,
  clearPassLogs,
  createSection,
  deletePassLogEntry,
  deleteSection,
  deleteStudent,
  ensureWorkspaceAndSeed,
  importBackupToFirestore,
  issueStudentPass,
  markAllAttendance,
  markStudentAbsentAndRemoveFromGroups,
  renameSection,
  resetQuarterPasses,
  returnStudentPass,
  sanitizeWorkspaceSettings,
  setActiveSection,
  subscribePassLogs,
  subscribeSections,
  subscribeStudents,
  subscribeWorkspace,
  toggleStudentAttendance,
  updatePassLogEntry,
  updateSectionGroups,
  updateSectionPassQueue,
  updateSectionSettings,
  updateWorkspaceSettings,
  type LegacyOrCloudBackupSection,
} from './lib/classroomService';
import { generateColorGroups } from './lib/grouping';
import {
  WORKSPACE_ID,
  type ActiveTab,
  type AppSettings,
  type ClassSectionDoc,
  type PassAction,
  type PassLogDoc,
  type StudentDoc,
  type ThemeId,
  type ToastMessage,
  type WorkspaceDoc,
} from './types/classroom';
import { AuthGate } from './components/AuthGate';
import { HeaderBar } from './components/HeaderBar';
import { ColorGroupsTab } from './components/ColorGroupsTab';
import { ClassRosterTab } from './components/ClassRosterTab';
import { GroupRulesTab } from './components/GroupRulesTab';
import { HallPassesTab } from './components/HallPassesTab';
import { PassHistoryTab } from './components/PassHistoryTab';
import { PassMonitorBoard } from './components/PassMonitorBoard';
import {
  ProjectorOverlay,
  type SpotlightWinnerInfo,
} from './components/ProjectorOverlay';
import {
  AddSectionModal,
  ProjectorRulesModal,
  QuickMoveModal,
  ResetPassesModal,
} from './components/Modals';
import {
  StudentHistoryModal,
  type StudentHistoryTarget,
} from './components/StudentHistoryModal';
import { SettingsModal } from './components/SettingsModal';
import {
  ClearHistoryModal,
  EditPassLogModal,
} from './components/PassHistoryModals';

interface DocumentPictureInPictureApi {
  window: Window | null;
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceDoc | null>(null);
  const [sections, setSections] = useState<ClassSectionDoc[]>([]);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [passLogs, setPassLogs] = useState<PassLogDoc[]>([]);
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const saved = sessionStorage.getItem('tiger_active_tab');
    if (
      saved === 'groups' ||
      saved === 'roster' ||
      saved === 'settings' ||
      saved === 'passes' ||
      saved === 'history'
    ) {
      return saved;
    }
    return 'passes';
  });

  const [projectorOpen, setProjectorOpen] = useState(false);
  const [spotlightTrigger, setSpotlightTrigger] = useState(0);
  const [projectorRulesOpen, setProjectorRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<PassLogDoc | null>(null);
  const [passBoardModalOpen, setPassBoardModalOpen] = useState(false);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const [quickMoveTarget, setQuickMoveTarget] = useState<{
    studentId: string;
    currentGroupId: string;
  } | null>(null);
  const [spotlightWinner, setSpotlightWinner] = useState<SpotlightWinnerInfo | null>(null);
  const [historyTarget, setHistoryTarget] = useState<StudentHistoryTarget | null>(null);

  const [previewTheme, setPreviewTheme] = useState<ThemeId | null>(null);
  const [cachedTheme] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'gold';
    const raw = localStorage.getItem('tiger_theme_id');
    if (
      raw === 'gold' ||
      raw === 'sapphire' ||
      raw === 'emerald' ||
      raw === 'violet' ||
      raw === 'crimson' ||
      raw === 'tangerine'
    ) {
      return raw;
    }
    return 'gold';
  });
  const hasInitializedTabRef = useRef(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isPassBoardMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('view') === 'passboard';
  }, []);

  const standaloneBoardUrl = useMemo(() => {
    if (typeof window === 'undefined') return '?view=passboard';
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'passboard');
    return url.toString();
  }, []);

  if (fatalError) {
    throw fatalError;
  }

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    sessionStorage.setItem('tiger_active_tab', tab);
  };

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setWorkspaceReady(false);
        setWorkspace(null);
        setSections([]);
        setStudents([]);
        setPassLogs([]);
      }
    });
    return () => unsub();
  }, []);

  const isAuthorized = useMemo(() => isAuthorizedTeacherUser(user), [user]);
  const teacherEmail = useMemo(() => (user?.email || '').trim().toLowerCase(), [user]);

  // Seed & subscribe to shared workspace, sections, and passLogs when authorized
  useEffect(() => {
    if (!authReady || !user || !isAuthorized || !teacherEmail) return;

    let cancelled = false;
    let unsubWorkspace: (() => void) | undefined;
    let unsubSections: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;

    (async () => {
      try {
        await ensureWorkspaceAndSeed(teacherEmail);
        if (cancelled) return;
        setWorkspaceReady(true);

        unsubWorkspace = subscribeWorkspace(
          (ws) => setWorkspace(ws),
          (err) => setFatalError(err)
        );
        unsubSections = subscribeSections(
          (secs) => setSections(secs),
          (err) => setFatalError(err)
        );
        unsubLogs = subscribePassLogs(
          (logs) => setPassLogs(logs),
          (err) => setFatalError(err)
        );
      } catch (err) {
        if (!cancelled) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubWorkspace?.();
      unsubSections?.();
      unsubLogs?.();
    };
  }, [authReady, user, isAuthorized, teacherEmail]);

  const activeSection = useMemo(() => {
    if (sections.length === 0) return undefined;
    const match = workspace?.activeSectionId
      ? sections.find((s) => s.id === workspace.activeSectionId)
      : undefined;
    return match || sections[0];
  }, [sections, workspace]);

  // Subscribe to students of the active section
  useEffect(() => {
    if (!workspaceReady || !activeSection?.id) {
      setStudents([]);
      return;
    }

    const unsub = subscribeStudents(
      activeSection.id,
      (list) => setStudents(list),
      (err) => setFatalError(err)
    );
    return () => unsub();
  }, [workspaceReady, activeSection?.id]);

  const appSettings = useMemo(
    () => sanitizeWorkspaceSettings(workspace?.settings),
    [workspace?.settings]
  );

  const effectiveTheme: ThemeId =
    previewTheme ?? (workspaceReady ? appSettings.theme : cachedTheme);

  // Keep DOM and PiP window theme attributes synchronized
  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    if (workspaceReady && !previewTheme) {
      try {
        localStorage.setItem('tiger_theme_id', effectiveTheme);
      } catch {
        // ignore storage errors
      }
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.document.documentElement.dataset.theme = effectiveTheme;
    }
  }, [effectiveTheme, workspaceReady, previewTheme]);

  // Apply configured default starting tab on fresh session
  useEffect(() => {
    if (!workspaceReady || hasInitializedTabRef.current) return;
    hasInitializedTabRef.current = true;
    const saved = sessionStorage.getItem('tiger_active_tab');
    if (!saved && appSettings.defaultTab) {
      setActiveTab(appSettings.defaultTab);
    }
  }, [workspaceReady, appSettings.defaultTab]);

  const withSync = async (fn: () => Promise<void>) => {
    setSyncing(true);
    try {
      await fn();
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      showToast(errorObj.message, 'error');
      setFatalError(errorObj);
    } finally {
      setSyncing(false);
    }
  };

  if (!authReady || !user || !isAuthorized) {
    return <AuthGate authReady={authReady} user={user} isAuthorized={isAuthorized} />;
  }

  if (!workspaceReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3 max-w-sm w-full">
          <div className="text-3xl">🐾</div>
          <h2 className="font-bold text-base text-white">Loading Classroom Workspace</h2>
          <p className="text-xs text-slate-400">Syncing periods, rosters, and live hall passes...</p>
        </div>
      </div>
    );
  }

  const currentlyOutCount = students.filter((s) => s.outTimestamp > 0).length;

  const openStudentHistory = (target: StudentHistoryTarget) => {
    const liveMatch = target.liveStudent || students.find((s) => s.id === target.id);
    setHistoryTarget({
      ...target,
      sectionName: target.sectionName || activeSection?.name,
      liveStudent: liveMatch,
    });
  };

  const openStudentDocHistory = (st: StudentDoc) => {
    openStudentHistory({
      id: st.id,
      name: st.name,
      sectionId: st.sectionId,
      sectionName: activeSection?.name,
      passesUsed: st.passesUsed,
      outTimestamp: st.outTimestamp,
      liveStudent: st,
    });
  };

  // Handlers
  const handleSwitchSection = (secId: string) => {
    const target = sections.find((s) => s.id === secId);
    void withSync(async () => {
      await setActiveSection(secId, teacherEmail);
      if (target) showToast(`Switched to ${target.name}`);
    });
  };

  const handleCreateSection = async (name: string) => {
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.order), -1);
    await withSync(async () => {
      await createSection(name, maxOrder + 1, teacherEmail, {
        quickSize: appSettings.defaultQuickSize,
        quickCount: appSettings.defaultQuickCount,
        forceExactCount: appSettings.defaultForceExactCount,
      });
      showToast(`Created section: ${name}`);
    });
  };

  const handleRenameSection = async (newName: string) => {
    if (!activeSection) return;
    await withSync(async () => {
      await renameSection(activeSection.id, newName, teacherEmail);
      showToast(`Section renamed to ${newName}`);
    });
  };

  const handleDeleteSection = async () => {
    if (!activeSection) return;
    if (sections.length <= 1) {
      showToast('Cannot delete the only class section!', 'error');
      return;
    }
    const fallback = sections.find((s) => s.id !== activeSection.id) || sections[0];
    await withSync(async () => {
      await deleteSection(activeSection.id, fallback.id, teacherEmail);
      showToast('Section deleted');
    });
  };

  const handleSelectQuickSize = (size: number) => {
    if (!activeSection) return;
    const nextSize =
      activeSection.quickSize === size && activeSection.quickCount > 0 ? 0 : size;
    void withSync(async () => {
      await updateSectionSettings(
        activeSection.id,
        {
          quickSize: nextSize,
          quickCount: activeSection.quickCount,
          forceExactCount: activeSection.forceExactCount,
        },
        teacherEmail
      );
    });
  };

  const handleSelectQuickCount = (count: number) => {
    if (!activeSection) return;
    const nextCount = activeSection.quickCount === count ? 0 : count;
    void withSync(async () => {
      await updateSectionSettings(
        activeSection.id,
        {
          quickSize: activeSection.quickSize,
          quickCount: nextCount,
          forceExactCount: activeSection.forceExactCount,
        },
        teacherEmail
      );
    });
  };

  const handleToggleForceCount = (forced: boolean) => {
    if (!activeSection) return;
    void withSync(async () => {
      await updateSectionSettings(
        activeSection.id,
        {
          quickSize: activeSection.quickSize,
          quickCount: activeSection.quickCount,
          forceExactCount: forced,
        },
        teacherEmail
      );
    });
  };

  const handleGenerateGroups = () => {
    if (!activeSection) return;
    const presentCount = students.filter((s) => s.present).length;
    if (presentCount === 0) {
      showToast('No students marked present in roster!', 'error');
      return;
    }
    const nextGroups = generateColorGroups(students, activeSection);
    void withSync(async () => {
      await updateSectionGroups(activeSection.id, nextGroups, teacherEmail);
      showToast('Shuffled color groups!');
    });
  };

  const handleMoveStudent = (studentId: string, fromGroupId: string, toGroupId: string) => {
    if (!activeSection || fromGroupId === toGroupId) return;
    const nextGroups = activeSection.groups.map((g) => {
      if (g.id === fromGroupId) {
        return { ...g, studentIds: g.studentIds.filter((id) => id !== studentId) };
      }
      if (g.id === toGroupId) {
        return {
          ...g,
          studentIds: g.studentIds.includes(studentId) ? g.studentIds : [...g.studentIds, studentId],
        };
      }
      return g;
    });
    void withSync(async () => {
      await updateSectionGroups(activeSection.id, nextGroups, teacherEmail);
    });
  };

  const handleRemoveStudentFromGroup = (groupId: string, studentId: string) => {
    if (!activeSection) return;
    const nextGroups = activeSection.groups.map((g) =>
      g.id === groupId ? { ...g, studentIds: g.studentIds.filter((id) => id !== studentId) } : g
    );
    void withSync(async () => {
      await updateSectionGroups(activeSection.id, nextGroups, teacherEmail);
    });
  };

  const handleAddStudent = async (name: string) => {
    if (!activeSection) return;
    await withSync(async () => {
      await addStudent(activeSection.id, name, teacherEmail);
      showToast(`Added ${name} to roster`);
    });
  };

  const handleBulkImport = async (names: string[]) => {
    if (!activeSection) return;
    await withSync(async () => {
      const added = await bulkAddStudents(activeSection.id, names, teacherEmail);
      showToast(`Imported ${added} students`);
    });
  };

  const handleToggleAttendance = async (studentId: string, present: boolean) => {
    if (!activeSection) return;
    await withSync(async () => {
      await toggleStudentAttendance(activeSection.id, studentId, present, teacherEmail);
    });
  };

  const handleMarkAllAttendance = async (present: boolean) => {
    if (!activeSection) return;
    await withSync(async () => {
      await markAllAttendance(activeSection.id, students, present, teacherEmail);
      showToast(present ? 'Marked all present' : 'Marked all absent');
    });
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!activeSection) return;
    const target = students.find((s) => s.id === studentId);
    await withSync(async () => {
      await deleteStudent(
        activeSection.id,
        studentId,
        activeSection.groups,
        teacherEmail,
        activeSection.passQueue || []
      );
      showToast(`Removed ${target?.name || 'Student'}`);
    });
  };

  const handleIssuePass = async (student: StudentDoc) => {
    if (!activeSection) return;
    const maxPasses = appSettings.maxQuarterPasses;
    const activeOut = students.find((s) => s.outTimestamp > 0);
    if (activeOut) {
      showToast(
        `Only 1 student out at a time! ${activeOut.name} is currently out — add ${student.name} to the line instead.`,
        'error'
      );
      return;
    }
    if (student.passesUsed >= maxPasses) {
      showToast(`${student.name} has 0/${maxPasses} passes remaining!`, 'error');
      return;
    }
    await withSync(async () => {
      await issueStudentPass(
        activeSection.id,
        activeSection.name,
        student,
        teacherEmail,
        activeSection.passQueue || [],
        maxPasses
      );
      const remainingAfter = Math.max(0, maxPasses - (student.passesUsed + 1));
      showToast(`Issued pass to ${student.name} (${remainingAfter}/${maxPasses} left)`);
    });
  };

  const handleReturnStudent = async (student: StudentDoc) => {
    if (!activeSection) return;
    await withSync(async () => {
      await returnStudentPass(activeSection.id, activeSection.name, student, teacherEmail);
      showToast(`${student.name} returned to class`);
    });
  };

  const handleAddToQueue = async (studentId: string) => {
    if (!activeSection) return;
    const maxPasses = appSettings.maxQuarterPasses;
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    if (st.outTimestamp > 0) {
      showToast(`${st.name} is already out!`, 'error');
      return;
    }
    if (st.passesUsed >= maxPasses) {
      showToast(`${st.name} has 0/${maxPasses} passes remaining!`, 'error');
      return;
    }
    const existing = activeSection.passQueue || [];
    if (existing.includes(studentId)) {
      showToast(`${st.name} is already in line!`);
      return;
    }
    const nextQueue = [...existing, studentId];
    await withSync(async () => {
      await updateSectionPassQueue(activeSection.id, nextQueue, teacherEmail);
      showToast(`Added ${st.name} to restroom line (#${nextQueue.length})`);
    });
  };

  const handleRemoveFromQueue = async (studentId: string) => {
    if (!activeSection) return;
    const existing = activeSection.passQueue || [];
    const nextQueue = existing.filter((id) => id !== studentId);
    await withSync(async () => {
      await updateSectionPassQueue(activeSection.id, nextQueue, teacherEmail);
    });
  };

  const handleMoveQueueUp = async (studentId: string) => {
    if (!activeSection) return;
    const existing = [...(activeSection.passQueue || [])];
    const idx = existing.indexOf(studentId);
    if (idx <= 0) return;
    [existing[idx - 1], existing[idx]] = [existing[idx], existing[idx - 1]];
    await withSync(async () => {
      await updateSectionPassQueue(activeSection.id, existing, teacherEmail);
    });
  };

  const handleClearQueue = async () => {
    if (!activeSection) return;
    await withSync(async () => {
      await updateSectionPassQueue(activeSection.id, [], teacherEmail);
      showToast('Cleared restroom line');
    });
  };

  const handleOpenSpotlight = () => {
    if (!activeSection) return;
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const assignedCount = (activeSection.groups || []).reduce(
      (sum, g) => sum + g.studentIds.filter((sid) => studentMap.has(sid)).length,
      0
    );
    if (assignedCount === 0) {
      showToast('Generate groups first before picking a student!', 'error');
      return;
    }
    setProjectorOpen(true);
    setSpotlightTrigger((n) => n + 1);
  };

  const handleOpenPassPopout = async () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.focus();
      return;
    }
    const pipApi = (
      window as unknown as { documentPictureInPicture?: DocumentPictureInPictureApi }
    ).documentPictureInPicture;

    if (pipApi && typeof pipApi.requestWindow === 'function') {
      try {
        const pipWin = await pipApi.requestWindow({ width: 540, height: 700 });
        pipWindowRef.current = pipWin;
        pipWin.document.title = 'Restroom Line — Tiger GroupCraft';
        pipWin.document.documentElement.className = document.documentElement.className;
        pipWin.document.documentElement.dataset.theme = effectiveTheme;
        pipWin.document.body.className = 'bg-slate-950 text-slate-100 antialiased m-0 p-0';

        // Copy all stylesheets so Tailwind v4 styles work inside the pop-out window
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
          pipWin.document.head.appendChild(node.cloneNode(true));
        });

        const mountNode = pipWin.document.createElement('div');
        mountNode.className = 'h-screen overflow-hidden';
        pipWin.document.body.appendChild(mountNode);
        setPipContainer(mountNode);

        pipWin.addEventListener('pagehide', () => {
          setPipContainer(null);
          pipWindowRef.current = null;
        });
        return;
      } catch {
        // Fall back to in-app PassMonitor modal (with Separate Window link) if PiP is blocked
      }
    }

    setPassBoardModalOpen(true);
  };

  const handleAdjustPassCount = async (student: StudentDoc, delta: number) => {
    if (!activeSection) return;
    const maxPasses = appSettings.maxQuarterPasses;
    const next = student.passesUsed + delta;
    if (next < 0 || next > maxPasses) return;
    await withSync(async () => {
      await adjustStudentPassCount(
        activeSection.id,
        activeSection.name,
        student,
        delta,
        teacherEmail,
        maxPasses
      );
    });
  };

  const handleResetQuarterPasses = async () => {
    if (!activeSection) return;
    await withSync(async () => {
      await resetQuarterPasses(activeSection.id, activeSection.name, students, teacherEmail);
      showToast(`Quarter passes reset for ${activeSection.name}!`);
    });
  };

  const handleSaveSettings = async (nextSettings: AppSettings) => {
    await withSync(async () => {
      await updateWorkspaceSettings(nextSettings, teacherEmail);
      setPreviewTheme(null);
      showToast('Settings saved & synced!');
    });
  };

  const handleApplyGroupingDefaultsToAll = async (defaults: {
    quickSize: number;
    quickCount: number;
    forceExactCount: boolean;
  }) => {
    await withSync(async () => {
      await applyDefaultGroupingToAllSections(sections, defaults, teacherEmail);
      showToast(`Applied grouping defaults to all ${sections.length} periods!`);
    });
  };

  const handleRemoveAbsentFromProjector = async (student: StudentDoc) => {
    if (!activeSection) return;
    await withSync(async () => {
      await markStudentAbsentAndRemoveFromGroups(
        activeSection.id,
        student.id,
        activeSection.groups,
        teacherEmail
      );
      if (spotlightWinner?.studentId === student.id) {
        setSpotlightWinner(null);
      }
      showToast(`${student.name} marked absent & removed from groups`);
    });
  };

  const handleRestorePresentStudent = async (student: StudentDoc) => {
    if (!activeSection) return;
    await withSync(async () => {
      await toggleStudentAttendance(activeSection.id, student.id, true, teacherEmail);
      showToast(`Marked ${student.name} present`);
    });
  };

  const handleSaveEditedLog = async (
    log: PassLogDoc,
    patch: {
      action: PassAction;
      passesUsedAfter: number;
      takenAt: number;
      returnedAt: number;
      durationSeconds: number;
    },
    alsoUpdateStudent?: {
      sectionId: string;
      studentId: string;
      passesUsed: number;
      outTimestamp: number;
    }
  ) => {
    await withSync(async () => {
      await updatePassLogEntry(log, patch, teacherEmail, alsoUpdateStudent);
      showToast(`Updated history entry for ${log.studentName}`);
    });
  };

  const handleDeleteLog = async (log: PassLogDoc) => {
    await withSync(async () => {
      await deletePassLogEntry(log.id);
      showToast(`Deleted history entry for ${log.studentName}`);
    });
  };

  const handleClearHistory = async (scopeSectionId: string | 'ALL') => {
    await withSync(async () => {
      const removed = await clearPassLogs(scopeSectionId);
      showToast(
        scopeSectionId === 'ALL'
          ? `Cleared all pass history (${removed} entries)`
          : `Cleared ${removed} pass history entries`
      );
    });
  };

  const copyText = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg);
    } catch {
      showToast('Copy failed — please copy from browser bar.', 'error');
    }
  };

  const handleCopyGroupsText = () => {
    if (!activeSection) return;
    const studentMap = new Map(students.map((s) => [s.id, s]));
    let text = `🐾 ${activeSection.name} - Color Groups\n\n`;
    activeSection.groups.forEach((g) => {
      const names = g.studentIds.map((id) => studentMap.get(id)?.name).filter(Boolean) as string[];
      text += `=== ${g.name} (${names.length}) ===\n`;
      names.forEach((n) => {
        text += `• ${n}\n`;
      });
      text += '\n';
    });
    void copyText(text, 'Groups copied to clipboard!');
  };

  const handleExportCSV = () => {
    if (!activeSection) return;
    const studentMap = new Map(students.map((s) => [s.id, s]));
    let csv = 'Group Name,Student Name\n';
    activeSection.groups.forEach((g) => {
      g.studentIds.forEach((id) => {
        const name = studentMap.get(id)?.name;
        if (name) {
          csv += `"${g.name.replace(/"/g, '""')}","${name.replace(/"/g, '""')}"\n`;
        }
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSection.name.replace(/[^a-z0-9]/gi, '_')}_Groups.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV file exported!');
  };

  const handleExportBackup = async () => {
    await withSync(async () => {
      const exportSections = await Promise.all(
        sections.map(async (sec) => {
          const snap = await getDocs(
            query(
              collection(db, `workspaces/${WORKSPACE_ID}/sections/${sec.id}/students`),
              where('sectionId', '==', sec.id)
            )
          );
          const roster = snap.docs.map((d) => {
            const st = d.data() as StudentDoc;
            return {
              id: st.id,
              name: st.name,
              present: st.present,
              passesUsed: st.passesUsed,
              outTimestamp: st.outTimestamp || null,
            };
          });
          return {
            id: sec.id,
            name: sec.name,
            order: sec.order,
            roster,
            groups: sec.groups,
            settings: {
              quickSize: sec.quickSize,
              quickCount: sec.quickCount,
              forceExactCount: sec.forceExactCount,
            },
          };
        })
      );

      const payload = {
        activeSectionId: activeSection?.id || '',
        sections: exportSections,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tiger_GroupCraft_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data backup file exported!');
    });
  };

  const handleImportBackup = async (file: File) => {
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText) as {
        activeSectionId?: string;
        sections?: LegacyOrCloudBackupSection[];
      };
      if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
        showToast('Invalid backup JSON file!', 'error');
        return;
      }
      await withSync(async () => {
        await importBackupToFirestore(
          parsed.sections!,
          parsed.activeSectionId,
          sections,
          teacherEmail
        );
        showToast('Data backup successfully restored to Google Cloud!');
      });
    } catch {
      showToast('Invalid backup JSON file!', 'error');
    }
  };

  if (isPassBoardMode) {
    return (
      <>
        <PassMonitorBoard
          section={activeSection}
          sections={sections}
          students={students}
          standalone
          maxPasses={appSettings.maxQuarterPasses}
          longPassAlertMinutes={appSettings.longPassAlertMinutes}
          onSwitchSection={handleSwitchSection}
          onAddToQueue={handleAddToQueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onMoveQueueUp={handleMoveQueueUp}
          onClearQueue={handleClearQueue}
          onIssuePass={handleIssuePass}
          onReturnStudent={handleReturnStudent}
        />
        <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 ${
                toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-black'
              }`}
            >
              <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <HeaderBar
        sections={sections}
        activeSectionId={activeSection?.id || ''}
        teacherEmail={teacherEmail}
        syncing={syncing}
        activeTab={activeTab}
        currentlyOutCount={currentlyOutCount}
        onSwitchSection={handleSwitchSection}
        onOpenAddSection={() => setAddSectionOpen(true)}
        onOpenProjector={() => setProjectorOpen(true)}
        onOpenSpotlight={handleOpenSpotlight}
        onOpenPassPopout={() => void handleOpenPassPopout()}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={() => void signOutTeacher()}
        onSwitchTab={handleTabChange}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'groups' && (
          <ColorGroupsTab
            section={activeSection}
            students={students}
            onGenerateGroups={handleGenerateGroups}
            onMoveStudent={handleMoveStudent}
            onRemoveStudentFromGroup={handleRemoveStudentFromGroup}
            onOpenQuickMove={(studentId, currentGroupId) =>
              setQuickMoveTarget({ studentId, currentGroupId })
            }
            onCopyText={handleCopyGroupsText}
            onExportCSV={handleExportCSV}
            onPrint={() => window.print()}
          />
        )}

        {activeTab === 'roster' && (
          <ClassRosterTab
            students={students}
            maxPasses={appSettings.maxQuarterPasses}
            onAddStudent={handleAddStudent}
            onBulkImport={handleBulkImport}
            onToggleAttendance={handleToggleAttendance}
            onMarkAllAttendance={handleMarkAllAttendance}
            onDeleteStudent={handleDeleteStudent}
            onOpenStudentHistory={openStudentDocHistory}
          />
        )}

        {activeTab === 'settings' && (
          <GroupRulesTab
            section={activeSection}
            sectionsCount={sections.length}
            onSelectQuickSize={handleSelectQuickSize}
            onSelectQuickCount={handleSelectQuickCount}
            onToggleForceCount={handleToggleForceCount}
            onGenerateGroups={handleGenerateGroups}
            onRenameSection={handleRenameSection}
            onDeleteSection={handleDeleteSection}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        )}

        {activeTab === 'passes' && (
          <HallPassesTab
            section={activeSection}
            students={students}
            passLogs={passLogs}
            maxPasses={appSettings.maxQuarterPasses}
            longPassAlertMinutes={appSettings.longPassAlertMinutes}
            onIssuePass={handleIssuePass}
            onReturnStudent={handleReturnStudent}
            onAdjustPassCount={handleAdjustPassCount}
            onAddToQueue={handleAddToQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onMoveQueueUp={handleMoveQueueUp}
            onClearQueue={handleClearQueue}
            onOpenPassPopout={() => void handleOpenPassPopout()}
            onOpenResetModal={() => setResetModalOpen(true)}
            onViewFullHistory={() => handleTabChange('history')}
            onOpenStudentHistory={openStudentDocHistory}
          />
        )}

        {activeTab === 'history' && (
          <PassHistoryTab
            section={activeSection}
            students={students}
            passLogs={passLogs}
            maxPasses={appSettings.maxQuarterPasses}
            longPassAlertMinutes={appSettings.longPassAlertMinutes}
            onReturnStudent={handleReturnStudent}
            onOpenStudentHistory={openStudentHistory}
            onEditLog={setEditingLog}
            onDeleteLog={(log) => void handleDeleteLog(log)}
            onOpenClearHistory={() => setClearHistoryOpen(true)}
          />
        )}
      </main>

      {/* Projector View Overlay */}
      <ProjectorOverlay
        open={projectorOpen}
        section={activeSection}
        students={students}
        spotlightWinner={spotlightWinner}
        spotlightTrigger={spotlightTrigger}
        defaultTimerSeconds={appSettings.defaultTimerSeconds}
        timerSoundEnabled={appSettings.timerSoundEnabled}
        onSpotlightWinner={(winner) => {
          setSpotlightWinner(winner);
          if (winner) {
            showToast(`Spotlight: ${winner.studentName}!`);
          }
        }}
        onNotifyError={(msg) => showToast(msg, 'error')}
        onClose={() => setProjectorOpen(false)}
        onOpenGroupRules={() => setProjectorRulesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onReshuffle={handleGenerateGroups}
        onMoveStudent={handleMoveStudent}
        onOpenQuickMove={(studentId, currentGroupId) =>
          setQuickMoveTarget({ studentId, currentGroupId })
        }
        onRemoveAbsentFromGroups={handleRemoveAbsentFromProjector}
        onRestorePresentStudent={handleRestorePresentStudent}
        onTimerFinished={() => showToast("🔔 Time's Up!")}
      />

      {/* Document PiP Floating Window Portal */}
      {pipContainer &&
        createPortal(
          <PassMonitorBoard
            section={activeSection}
            students={students}
            maxPasses={appSettings.maxQuarterPasses}
            longPassAlertMinutes={appSettings.longPassAlertMinutes}
            onAddToQueue={handleAddToQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onMoveQueueUp={handleMoveQueueUp}
            onClearQueue={handleClearQueue}
            onIssuePass={handleIssuePass}
            onReturnStudent={handleReturnStudent}
            standaloneUrl={standaloneBoardUrl}
            onClose={() => {
              pipWindowRef.current?.close();
              pipWindowRef.current = null;
              setPipContainer(null);
            }}
          />,
          pipContainer
        )}

      {/* Fallback In-App Modal for Browsers / Iframes Without Document PiP */}
      {passBoardModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPassBoardModalOpen(false)}
        >
          <div
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-xl w-full h-[85vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <PassMonitorBoard
              section={activeSection}
              students={students}
              maxPasses={appSettings.maxQuarterPasses}
              longPassAlertMinutes={appSettings.longPassAlertMinutes}
              onAddToQueue={handleAddToQueue}
              onRemoveFromQueue={handleRemoveFromQueue}
              onMoveQueueUp={handleMoveQueueUp}
              onClearQueue={handleClearQueue}
              onIssuePass={handleIssuePass}
              onReturnStudent={handleReturnStudent}
              standaloneUrl={standaloneBoardUrl}
              onClose={() => setPassBoardModalOpen(false)}
            />
          </div>
        </div>
      )}

      <ProjectorRulesModal
        open={projectorRulesOpen}
        section={activeSection}
        onSelectQuickSize={handleSelectQuickSize}
        onSelectQuickCount={handleSelectQuickCount}
        onToggleForceCount={handleToggleForceCount}
        onReshuffleAndClose={() => {
          handleGenerateGroups();
          setProjectorRulesOpen(false);
        }}
        onClose={() => setProjectorRulesOpen(false)}
      />

      <AddSectionModal
        open={addSectionOpen}
        onCreate={handleCreateSection}
        onClose={() => setAddSectionOpen(false)}
      />

      <QuickMoveModal
        target={quickMoveTarget}
        section={activeSection}
        students={students}
        onExecuteMove={(toGroupId) => {
          if (quickMoveTarget) {
            handleMoveStudent(
              quickMoveTarget.studentId,
              quickMoveTarget.currentGroupId,
              toGroupId
            );
          }
          setQuickMoveTarget(null);
        }}
        onClose={() => setQuickMoveTarget(null)}
      />

      <ResetPassesModal
        open={resetModalOpen}
        sectionName={activeSection?.name || 'this section'}
        maxPasses={appSettings.maxQuarterPasses}
        onConfirm={handleResetQuarterPasses}
        onClose={() => setResetModalOpen(false)}
      />

      <StudentHistoryModal
        target={
          historyTarget
            ? {
                ...historyTarget,
                liveStudent:
                  students.find((s) => s.id === historyTarget.id) ||
                  historyTarget.liveStudent,
              }
            : null
        }
        passLogs={passLogs}
        maxPasses={appSettings.maxQuarterPasses}
        longPassAlertMinutes={appSettings.longPassAlertMinutes}
        onReturnStudent={handleReturnStudent}
        onEditLog={setEditingLog}
        onClose={() => setHistoryTarget(null)}
      />

      <SettingsModal
        open={settingsOpen}
        settings={appSettings}
        sectionsCount={sections.length}
        activeSectionName={activeSection?.name}
        onPreviewTheme={(theme) =>
          setPreviewTheme(theme === appSettings.theme ? null : theme)
        }
        onSave={handleSaveSettings}
        onApplyGroupingToAllSections={handleApplyGroupingDefaultsToAll}
        onClose={() => {
          setPreviewTheme(null);
          setSettingsOpen(false);
        }}
      />

      <EditPassLogModal
        log={editingLog}
        maxPasses={appSettings.maxQuarterPasses}
        liveStudent={
          editingLog ? students.find((s) => s.id === editingLog.studentId) : undefined
        }
        onSave={handleSaveEditedLog}
        onDelete={handleDeleteLog}
        onClose={() => setEditingLog(null)}
      />

      <ClearHistoryModal
        open={clearHistoryOpen}
        sectionId={activeSection?.id}
        sectionName={activeSection?.name}
        sectionLogCount={
          activeSection
            ? passLogs.filter((l) => l.sectionId === activeSection.id).length
            : 0
        }
        totalLogCount={passLogs.length}
        onConfirmClear={handleClearHistory}
        onClose={() => setClearHistoryOpen(false)}
      />

      {/* Toast Container */}
      <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-2.5 rounded-xl font-bold text-xs shadow-2xl flex items-center gap-2 ${
              toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-black'
            }`}
          >
            <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
