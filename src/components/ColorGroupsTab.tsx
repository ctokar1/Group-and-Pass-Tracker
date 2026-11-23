import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Copy,
  Download,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  Shuffle,
  Unlock,
  X,
} from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  type ClassSectionDoc,
  type FloorPlanLayout,
  type GroupEntry,
  type StudentDoc,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';
import { FloorPlanCanvas } from './FloorPlanCanvas';

interface ColorGroupsTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  onGenerateGroups: () => void;
  onRotateRoles: () => void;
  onToggleLockStudent: (groupId: string, studentId: string) => void;
  onAdjustGroupPoints: (groupId: string, delta: number) => void;
  onResetAllGroupPoints: () => void;
  onSaveFloorPlan: (layout: FloorPlanLayout) => Promise<void> | void;
  onApplyFloorPlanToAll: (layout: FloorPlanLayout) => Promise<void> | void;
  onMoveStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  onRemoveStudentFromGroup: (groupId: string, studentId: string) => void;
  onOpenQuickMove: (studentId: string, groupId: string) => void;
  onCopyText: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

export const ColorGroupsTab: React.FC<ColorGroupsTabProps> = ({
  section,
  students,
  onGenerateGroups,
  onRotateRoles,
  onToggleLockStudent,
  onAdjustGroupPoints,
  onResetAllGroupPoints,
  onSaveFloorPlan,
  onApplyFloorPlanToAll,
  onMoveStudent,
  onRemoveStudentFromGroup,
  onOpenQuickMove,
  onCopyText,
  onExportCSV,
  onPrint,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'floorplan'>('grid');

  const presentCount = students.filter((s) => s.present).length;
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const groups: GroupEntry[] = section?.groups || [];
  const hasPoints = groups.some((g) => (g.points ?? 0) !== 0);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    studentId: string,
    fromGroupId: string
  ) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ studentId, fromGroupId }));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toGroupId: string) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { studentId?: string; fromGroupId?: string };
      if (parsed.studentId && parsed.fromGroupId && parsed.fromGroupId !== toGroupId) {
        onMoveStudent(parsed.studentId, parsed.fromGroupId, toGroupId);
      }
    } catch {
      // ignore invalid drag payload
    }
  };

  return (
    <section className="space-y-6">
      {/* Quick Rules & Controls Bar */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Active Roster:</span>
            <span className="font-extrabold text-amber-300 tabular-nums">{presentCount} Present</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Selected Rule:</span>
            <span className="font-extrabold text-amber-400">{formatRuleSummary(section)}</span>
          </div>

          {/* Grid vs 2D Floor Plan Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('floorplan')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'floorplan'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              2D Floor Plan
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGenerateGroups}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Shuffle &amp; Group Now!
          </button>
          <button
            type="button"
            onClick={onRotateRoles}
            disabled={groups.length === 0}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-extrabold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Rotate classroom roles without changing seats"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Rotate Roles
          </button>
          {hasPoints && (
            <button
              type="button"
              onClick={onResetAllGroupPoints}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              title="Reset all table points back to 0"
            >
              Reset Pts
            </button>
          )}
          <button
            type="button"
            onClick={onCopyText}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Copy text format"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Text
          </button>
          <button
            type="button"
            onClick={onExportCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Export CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Print groups layout"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Floor Plan Mode OR Grid View */}
      {viewMode === 'floorplan' ? (
        <FloorPlanCanvas
          section={section}
          students={students}
          onSaveFloorPlan={onSaveFloorPlan}
          onApplyFloorPlanToAll={onApplyFloorPlanToAll}
          onMoveStudent={onMoveStudent}
          onRemoveStudentFromGroup={onRemoveStudentFromGroup}
          onOpenQuickMove={onOpenQuickMove}
          onToggleLockStudent={onToggleLockStudent}
          onAdjustGroupPoints={onAdjustGroupPoints}
        />
      ) : (
        <div className="print-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {groups.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
              <span className="text-4xl block">🎲</span>
              <h3 className="font-extrabold text-white text-base">No Color Groups Generated Yet</h3>
              <p className="text-xs text-slate-400">
                Click &ldquo;Shuffle &amp; Group Now!&rdquo; above to generate seating stations.
              </p>
            </div>
          ) : (
            groups.map((grp, idx) => {
              const colorDef =
                COLOR_DEFINITIONS[grp.colorIndex % COLOR_DEFINITIONS.length] ||
                COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length];
              const lockedSet = new Set(grp.lockedStudentIds || []);
              const points = grp.points ?? 0;
              const memberStudents = grp.studentIds
                .map((sid) => studentMap.get(sid))
                .filter((st): st is StudentDoc => Boolean(st));

              return (
                <div
                  key={grp.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, grp.id)}
                  className={`print-card bg-slate-900 border-2 ${colorDef.border} ${colorDef.bg} rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3 h-3 rounded-full ${colorDef.color} shrink-0`} />
                      <h3 className="font-black text-sm sm:text-base text-white truncate">
                        {grp.name || colorDef.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Table Points Counter */}
                      <div className="no-print flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1 py-0.5 gap-0.5">
                        <button
                          type="button"
                          onClick={() => onAdjustGroupPoints(grp.id, -1)}
                          className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                          title="Subtract 1 point"
                          aria-label={`Subtract 1 point from ${grp.name}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span
                          className={`text-xs font-black font-mono-tabular px-1 ${
                            points > 0
                              ? 'text-emerald-400'
                              : points < 0
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                          title="Table points"
                        >
                          {points > 0 ? `+${points}` : points}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdjustGroupPoints(grp.id, 1)}
                          className="p-0.5 text-slate-400 hover:text-emerald-400 cursor-pointer"
                          title="Award 1 point"
                          aria-label={`Award 1 point to ${grp.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span
                        className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-lg bg-slate-950 ${colorDef.text} shrink-0`}
                      >
                        {memberStudents.length}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 min-h-[100px] flex-1 flex flex-col justify-start">
                    {memberStudents.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">
                        <span className="text-xs font-semibold text-slate-500">
                          Drag students here
                        </span>
                      </div>
                    ) : (
                      memberStudents.map((st) => {
                        const isLocked = lockedSet.has(st.id);
                        const role = grp.roles?.[st.id];
                        return (
                          <div
                            key={st.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, st.id, grp.id)}
                            className={`bg-slate-950 border rounded-xl p-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all group ${
                              isLocked
                                ? 'border-amber-400/70 ring-1 ring-amber-400/20'
                                : 'border-slate-800 hover:border-amber-400/60'
                            }`}
                          >
                            <div className="min-w-0 pr-2 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isLocked && (
                                  <Lock
                                    className="w-3 h-3 text-amber-400 shrink-0"
                                    aria-label="Locked to table"
                                  />
                                )}
                                <span className="font-bold text-xs sm:text-sm text-white truncate">
                                  {st.name}
                                </span>
                              </div>
                              {role && (
                                <span className="text-[11px] font-semibold text-amber-300/90 block truncate mt-0.5">
                                  {role}
                                </span>
                              )}
                            </div>

                            <div className="no-print flex items-center gap-1 opacity-85 group-hover:opacity-100 shrink-0">
                              <button
                                type="button"
                                onClick={() => onToggleLockStudent(grp.id, st.id)}
                                className={`p-1 rounded cursor-pointer transition-colors ${
                                  isLocked
                                    ? 'bg-amber-400/20 text-amber-300 hover:bg-amber-400/30'
                                    : 'hover:bg-slate-800 text-slate-400 hover:text-amber-300'
                                }`}
                                title={
                                  isLocked
                                    ? 'Unlock seat (will shuffle normally)'
                                    : 'Pin/Lock student to this table during reshuffles'
                                }
                                aria-label={
                                  isLocked
                                    ? `Unlock ${st.name} seat`
                                    : `Lock ${st.name} to ${grp.name}`
                                }
                              >
                                {isLocked ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <Unlock className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenQuickMove(st.id, grp.id)}
                                className="p-1 hover:bg-slate-800 rounded text-amber-300 cursor-pointer"
                                title="Move to another group"
                                aria-label={`Move ${st.name}`}
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveStudentFromGroup(grp.id, st.id)}
                                className="p-1 hover:bg-rose-900/50 text-rose-400 rounded cursor-pointer"
                                title="Remove student from group"
                                aria-label={`Remove ${st.name} from group`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};
