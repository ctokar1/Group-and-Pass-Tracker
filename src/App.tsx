import { useCallback, useEffect, useMemo, useState } from 'react';
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
  bulkAddStudents,
  createSection,
  deleteSection,
  deleteStudent,
  ensureWorkspaceAndSeed,
  importBackupToFirestore,
  issueStudentPass,
  markAllAttendance,
  renameSection,
  resetQuarterPasses,
  returnStudentPass,
  setActiveSection,
  subscribePassLogs,
  subscribeSections,
  subscribeStudents,
  subscribeWorkspace,
  toggleStudentAttendance,
  updateSectionGroups,
  updateSectionSettings,
  type LegacyOrCloudBackupSection,
} from './lib/classroomService';
import { generateColorGroups } from './lib/grouping';
import {
  LIMITS,
  MAX_QUARTER_PASSES,
  WORKSPACE_ID,
  type ActiveTab,
  type ClassSectionDoc,
  type PassLogDoc,
  type StudentDoc,
  type ToastMessage,
  type WorkspaceDoc,
} from './types/classroom';
import { AuthGate } from './components/AuthGate';
import { HeaderBar } from './components/HeaderBar';
import { ColorGroupsTab } from './components/ColorGroupsTab';
import { ClassRosterTab } from './components/ClassRosterTab';
import { GroupRulesTab } from './components/GroupRulesTab';
import { HallPassesTab } from './components/HallPassesTab';
import { ProjectorOverlay } from './components/ProjectorOverlay';
import {
  AddSectionModal,
  ProjectorRulesModal,
  QuickMoveModal,
  ResetPassesModal,
  SpotlightModal,
} from './components/Modals';

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
    if (saved === 'groups' || saved === 'roster' || saved === 'settings' || saved === 'passes') {
      return saved;
    }
    return 'passes';
  });

  const [projectorOpen, setProjectorOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [projectorRulesOpen, setProjectorRulesOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [quickMoveTarget, setQuickMoveTarget] = useState<{
    studentId: string;
    currentGroupId: string;
  } | null>(null);
  const [spotlightWinner, setSpotlightWinner] = useState<{
    studentName: string;
    groupName: string;
  } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      await createSection(name, maxOrder + 1, teacherEmail);
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
      await deleteStudent(activeSection.id, studentId, activeSection.groups, teacherEmail);
      showToast(`Removed ${target?.name || 'Student'}`);
    });
  };

  const handleIssuePass = async (student: StudentDoc) => {
    if (!activeSection) return;
    if (student.passesUsed >= LIMITS.MAX_PASSES) {
      showToast(
        `${student.name} has reached the pass limit (${MAX_QUARTER_PASSES}/${MAX_QUARTER_PASSES})!`,
        'error'
      );
      return;
    }
    await withSync(async () => {
      await issueStudentPass(activeSection.id, activeSection.name, student, teacherEmail);
      showToast(
        `Issued pass to ${student.name} (${student.passesUsed + 1}/${MAX_QUARTER_PASSES})`
      );
    });
  };

  const handleReturnStudent = async (student: StudentDoc) => {
    if (!activeSection) return;
    await withSync(async () => {
      await returnStudentPass(activeSection.id, activeSection.name, student, teacherEmail);
      showToast(`${student.name} returned to class`);
    });
  };

  const handleAdjustPassCount = async (student: StudentDoc, delta: number) => {
    if (!activeSection) return;
    const next = student.passesUsed + delta;
    if (next < 0 || next > LIMITS.MAX_PASSES) return;
    await withSync(async () => {
      await adjustStudentPassCount(activeSection.id, activeSection.name, student, delta, teacherEmail);
    });
  };

  const handleResetQuarterPasses = async () => {
    if (!activeSection) return;
    await withSync(async () => {
      await resetQuarterPasses(activeSection.id, activeSection.name, students, teacherEmail);
      showToast(`Quarter passes reset for ${activeSection.name}!`);
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
        onOpenSpotlight={() => setSpotlightOpen(true)}
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
            onAddStudent={handleAddStudent}
            onBulkImport={handleBulkImport}
            onToggleAttendance={handleToggleAttendance}
            onMarkAllAttendance={handleMarkAllAttendance}
            onDeleteStudent={handleDeleteStudent}
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
            onIssuePass={handleIssuePass}
            onReturnStudent={handleReturnStudent}
            onAdjustPassCount={handleAdjustPassCount}
            onOpenResetModal={() => setResetModalOpen(true)}
          />
        )}
      </main>

      {/* Projector View Overlay */}
      <ProjectorOverlay
        open={projectorOpen}
        section={activeSection}
        students={students}
        spotlightWinner={spotlightWinner}
        onClose={() => setProjectorOpen(false)}
        onOpenSpotlight={() => setSpotlightOpen(true)}
        onOpenGroupRules={() => setProjectorRulesOpen(true)}
        onReshuffle={handleGenerateGroups}
        onMoveStudent={handleMoveStudent}
        onOpenQuickMove={(studentId, currentGroupId) =>
          setQuickMoveTarget({ studentId, currentGroupId })
        }
        onTimerFinished={() => showToast("🔔 Time's Up!")}
      />

      {/* Modals */}
      <SpotlightModal
        open={spotlightOpen}
        section={activeSection}
        students={students}
        onWinnerPicked={(winner) => {
          setSpotlightWinner(winner);
          showToast(`Spotlight: ${winner.studentName}!`);
        }}
        onNotifyError={(msg) => showToast(msg, 'error')}
        onClose={() => setSpotlightOpen(false)}
      />

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
        onConfirm={handleResetQuarterPasses}
        onClose={() => setResetModalOpen(false)}
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
