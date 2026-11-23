import React from 'react';
import { ArrowLeftRight, Copy, Download, Printer, Shuffle, X } from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  type ClassSectionDoc,
  type GroupEntry,
  type StudentDoc,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';

interface ColorGroupsTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  onGenerateGroups: () => void;
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
  onMoveStudent,
  onRemoveStudentFromGroup,
  onOpenQuickMove,
  onCopyText,
  onExportCSV,
  onPrint,
}) => {
  const presentCount = students.filter((s) => s.present).length;
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const groups: GroupEntry[] = section?.groups || [];

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
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Active Roster:</span>
            <span className="font-extrabold text-amber-300 tabular-nums">{presentCount} Present</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Selected Rule:</span>
            <span className="font-extrabold text-amber-400">{formatRuleSummary(section)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onGenerateGroups}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Shuffle & Group Now!
          </button>
          <button
            onClick={onCopyText}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Copy text format"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Text
          </button>
          <button
            onClick={onExportCSV}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Export CSV file"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={onPrint}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            title="Print groups layout"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Groups Grid */}
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
            const colorDef = COLOR_DEFINITIONS[grp.colorIndex % COLOR_DEFINITIONS.length] || COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length];
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
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full ${colorDef.color} shrink-0`} />
                    <h3 className="font-black text-sm sm:text-base text-white truncate">
                      {grp.name || colorDef.name}
                    </h3>
                  </div>
                  <span className={`text-xs font-black tabular-nums px-2 py-0.5 rounded-lg bg-slate-950 ${colorDef.text} shrink-0`}>
                    {memberStudents.length} Kids
                  </span>
                </div>

                <div className="space-y-2 min-h-[100px] flex-1 flex flex-col justify-start">
                  {memberStudents.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl p-4 text-center">
                      <span className="text-xs font-semibold text-slate-500">Drag students here</span>
                    </div>
                  ) : (
                    memberStudents.map((st) => (
                      <div
                        key={st.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, st.id, grp.id)}
                        className="bg-slate-950 border border-slate-800 hover:border-amber-400/60 rounded-xl p-2.5 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all group"
                      >
                        <span className="font-bold text-xs sm:text-sm text-white truncate pr-2">
                          {st.name}
                        </span>
                        <div className="no-print flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                          <button
                            onClick={() => onOpenQuickMove(st.id, grp.id)}
                            className="p-1 hover:bg-slate-800 rounded text-amber-300 cursor-pointer"
                            title="Move to another group"
                            aria-label={`Move ${st.name}`}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onRemoveStudentFromGroup(grp.id, st.id)}
                            className="p-1 hover:bg-rose-900/50 text-rose-400 rounded cursor-pointer"
                            title="Remove student from group"
                            aria-label={`Remove ${st.name} from group`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
