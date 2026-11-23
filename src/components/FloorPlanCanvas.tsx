import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  CopyCheck,
  GripVertical,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Unlock,
  UserX,
  X,
} from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  createDefaultFloorPlan,
  DEFAULT_TABLE_COORDS,
  type ClassSectionDoc,
  type FloorPlanLayout,
  type GroupEntry,
  type StudentDoc,
  type WhiteboardEdge,
} from '../types/classroom';
import { sanitizeFloorPlan } from '../lib/classroomService';

interface FloorPlanCanvasProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  projectorMode?: boolean;
  activeHighlightId?: string | null;
  spotlightActive?: boolean;
  isSpotlighting?: boolean;
  onSaveFloorPlan: (layout: FloorPlanLayout) => Promise<void> | void;
  onApplyFloorPlanToAll?: (layout: FloorPlanLayout) => Promise<void> | void;
  onMoveStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  onRemoveStudentFromGroup?: (groupId: string, studentId: string) => void;
  onOpenQuickMove: (studentId: string, groupId: string) => void;
  onToggleLockStudent: (groupId: string, studentId: string) => void;
  onAdjustGroupPoints: (groupId: string, delta: number) => void;
  onRemoveAbsentFromGroups?: (student: StudentDoc) => Promise<void>;
}

const WHITEBOARD_EDGES: Array<{ id: WhiteboardEdge; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];

export const FloorPlanCanvas: React.FC<FloorPlanCanvasProps> = ({
  section,
  students,
  projectorMode = false,
  activeHighlightId = null,
  spotlightActive = false,
  isSpotlighting = false,
  onSaveFloorPlan,
  onApplyFloorPlanToAll,
  onMoveStudent,
  onRemoveStudentFromGroup,
  onOpenQuickMove,
  onToggleLockStudent,
  onAdjustGroupPoints,
  onRemoveAbsentFromGroups,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draftPlan, setDraftPlan] = useState<FloorPlanLayout>(() =>
    sanitizeFloorPlan(section?.floorPlan)
  );
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragStateRef = useRef<{
    target: 'teacher' | string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const latestPlanRef = useRef<FloorPlanLayout>(draftPlan);

  useEffect(() => {
    if (!draggingKey) {
      const next = sanitizeFloorPlan(section?.floorPlan);
      setDraftPlan(next);
      latestPlanRef.current = next;
    }
  }, [section?.floorPlan, draggingKey]);

  useEffect(() => {
    if (!draggingKey) return;

    const handlePointerMove = (e: PointerEvent) => {
      const st = dragStateRef.current;
      const box = containerRef.current?.getBoundingClientRect();
      if (!st || !box || box.width <= 0 || box.height <= 0) return;

      const dxPct = ((e.clientX - st.startClientX) / box.width) * 100;
      const dyPct = ((e.clientY - st.startClientY) / box.height) * 100;
      const nextX = Math.max(8, Math.min(92, Math.round((st.origX + dxPct) * 10) / 10));
      const nextY = Math.max(10, Math.min(90, Math.round((st.origY + dyPct) * 10) / 10));

      setDraftPlan((prev) => {
        const updated: FloorPlanLayout =
          st.target === 'teacher'
            ? { ...prev, teacherDesk: { x: nextX, y: nextY } }
            : {
                ...prev,
                tables: {
                  ...prev.tables,
                  [st.target]: { x: nextX, y: nextY },
                },
              };
        latestPlanRef.current = updated;
        return updated;
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDraggingKey(null);
      void onSaveFloorPlan(latestPlanRef.current);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingKey, onSaveFloorPlan]);

  const startDragItem = (
    e: React.PointerEvent,
    target: 'teacher' | string,
    origX: number,
    origY: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current = {
      target,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX,
      origY,
    };
    setDraggingKey(target);
  };

  const handleStudentDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    studentId: string,
    fromGroupId: string
  ) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ studentId, fromGroupId }));
  };

  const handleStudentDrop = (e: React.DragEvent<HTMLDivElement>, toGroupId: string) => {
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

  const groups: GroupEntry[] = section?.groups || [];
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const whiteboardClasses = (() => {
    switch (draftPlan.whiteboardEdge) {
      case 'bottom':
        return 'bottom-2 left-1/2 -translate-x-1/2 w-[55%] h-7 flex-row';
      case 'left':
        return 'left-2 top-1/2 -translate-y-1/2 w-7 h-[55%] flex-col';
      case 'right':
        return 'right-2 top-1/2 -translate-y-1/2 w-7 h-[55%] flex-col';
      case 'top':
      default:
        return 'top-2 left-1/2 -translate-x-1/2 w-[55%] h-7 flex-row';
    }
  })();

  const isVerticalBoard =
    draftPlan.whiteboardEdge === 'left' || draftPlan.whiteboardEdge === 'right';

  return (
    <div className={projectorMode ? 'flex-1 flex flex-col min-h-0 gap-2' : 'space-y-3'}>
      {/* Floor Plan Controls Bar */}
      {!projectorMode && (
        <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-extrabold text-amber-300">Front Whiteboard Wall:</span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
              {WHITEBOARD_EDGES.map((edge) => (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => {
                    const next = { ...draftPlan, whiteboardEdge: edge.id };
                    setDraftPlan(next);
                    latestPlanRef.current = next;
                    void onSaveFloorPlan(next);
                  }}
                  className={`px-2.5 py-1 rounded-md font-bold text-xs cursor-pointer transition-colors ${
                    draftPlan.whiteboardEdge === edge.id
                      ? 'bg-amber-400 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {edge.label}
                </button>
              ))}
            </div>
            <span className="text-slate-400 hidden sm:inline">
              · Drag table handles &amp; Teacher Desk to match your classroom
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const def = createDefaultFloorPlan();
                setDraftPlan(def);
                latestPlanRef.current = def;
                void onSaveFloorPlan(def);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Layout
            </button>
            {onApplyFloorPlanToAll && (
              <button
                type="button"
                onClick={() => void onApplyFloorPlanToAll(draftPlan)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                title="Copy this room arrangement to all class periods"
              >
                <CopyCheck className="w-3.5 h-3.5" />
                Apply to All Periods
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive 2D Classroom Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-2xl border-2 border-slate-800 bg-slate-950 overflow-hidden select-none ${
          projectorMode ? 'flex-1 min-h-0' : 'min-h-[600px] sm:min-h-[660px]'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.14) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      >
        {/* Front Whiteboard Indicator */}
        <div
          className={`absolute z-10 rounded-lg bg-slate-800/95 border border-amber-400/50 flex items-center justify-center shadow-lg pointer-events-none ${whiteboardClasses}`}
        >
          <span
            className={`text-[11px] font-black uppercase tracking-widest text-amber-300 whitespace-nowrap ${
              isVerticalBoard ? '-rotate-90' : ''
            }`}
          >
            Front Whiteboard
          </span>
        </div>

        {/* Draggable Teacher Desk */}
        <div
          onPointerDown={(e) =>
            startDragItem(e, 'teacher', draftPlan.teacherDesk.x, draftPlan.teacherDesk.y)
          }
          style={{
            left: `${draftPlan.teacherDesk.x}%`,
            top: `${draftPlan.teacherDesk.y}%`,
          }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 px-3 py-1.5 rounded-xl border-2 bg-slate-900/95 border-amber-500/60 shadow-xl flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
            draggingKey === 'teacher' ? 'ring-2 ring-amber-400 z-30' : ''
          }`}
          title="Drag Teacher Desk anywhere in room"
        >
          <GripVertical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 whitespace-nowrap">
            Teacher Desk
          </span>
        </div>

        {/* Empty State */}
        {groups.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 text-center max-w-sm">
              <span className="text-4xl block mb-2">🗺️</span>
              <h3 className="font-black text-base text-white">No Tables Generated Yet</h3>
              <p className="text-xs text-slate-400 mt-1">
                Click &ldquo;Shuffle &amp; Group Now!&rdquo; to populate colored stations onto your classroom floor plan.
              </p>
            </div>
          </div>
        ) : (
          groups.map((grp, idx) => {
            const colorDef =
              COLOR_DEFINITIONS[grp.colorIndex % COLOR_DEFINITIONS.length] ||
              COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length];
            const fallbackCoord = DEFAULT_TABLE_COORDS[idx % DEFAULT_TABLE_COORDS.length];
            const pos = draftPlan.tables[grp.id] || fallbackCoord;
            const lockedSet = new Set(grp.lockedStudentIds || []);
            const points = grp.points ?? 0;
            const memberStudents = grp.studentIds
              .map((sid) => studentMap.get(sid))
              .filter((st): st is StudentDoc => Boolean(st));

            return (
              <div
                key={grp.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleStudentDrop(e, grp.id)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-[235px] sm:w-[265px] rounded-2xl border-2 ${colorDef.border} bg-slate-900/95 shadow-2xl p-2.5 flex flex-col gap-2 transition-shadow ${
                  draggingKey === grp.id ? 'z-30 ring-4 ring-amber-400/50' : 'z-20'
                }`}
              >
                {/* Table Header (Pointer Drag Handle + Points) */}
                <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-1.5">
                  <div
                    onPointerDown={(e) => startDragItem(e, grp.id, pos.x, pos.y)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 cursor-grab active:cursor-grabbing"
                    title="Drag table to reposition in classroom"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className={`w-2.5 h-2.5 rounded-full ${colorDef.color} shrink-0`} />
                    <h4 className="font-black text-xs sm:text-sm text-white truncate">
                      {grp.name || colorDef.name}
                    </h4>
                  </div>

                  {/* Table Points & Count */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1 py-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => onAdjustGroupPoints(grp.id, -1)}
                        className="p-0.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                        title="Subtract 1 table point"
                        aria-label={`Subtract 1 point from ${grp.name}`}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span
                        className={`text-[11px] font-black font-mono-tabular px-1 ${
                          points > 0
                            ? 'text-emerald-400'
                            : points < 0
                            ? 'text-rose-400'
                            : 'text-slate-300'
                        }`}
                        title="Table Points"
                      >
                        {points > 0 ? `+${points}` : points}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAdjustGroupPoints(grp.id, 1)}
                        className="p-0.5 text-slate-400 hover:text-emerald-400 cursor-pointer"
                        title="Award 1 table point"
                        aria-label={`Award 1 point to ${grp.name}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Student Chips */}
                <div className="space-y-1 max-h-[175px] overflow-y-auto pr-0.5">
                  {memberStudents.length === 0 ? (
                    <div className="py-3 text-center border border-dashed border-slate-800 rounded-xl text-[11px] text-slate-500 font-semibold">
                      Drop student here
                    </div>
                  ) : (
                    memberStudents.map((st) => {
                      const isLocked = lockedSet.has(st.id);
                      const role = grp.roles?.[st.id];
                      const isHighlighted = activeHighlightId === st.id;
                      const isDimmed = spotlightActive && !isHighlighted;
                      return (
                        <div
                          key={st.id}
                          draggable
                          onDragStart={(e) => handleStudentDragStart(e, st.id, grp.id)}
                          className={`rounded-xl px-2 py-1.5 flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing transition-all ${
                            isHighlighted
                              ? 'bg-amber-400 text-black border border-yellow-100 ring-2 ring-amber-300 shadow-lg'
                              : isDimmed
                              ? 'bg-slate-950/60 border border-slate-800/60 opacity-40'
                              : 'bg-slate-950 border border-slate-800 hover:border-amber-400/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 min-w-0">
                              {isHighlighted && (
                                <span className="text-xs shrink-0">
                                  {isSpotlighting ? '🎯' : '🏆'}
                                </span>
                              )}
                              {isLocked && (
                                <Lock
                                  className={`w-3 h-3 shrink-0 ${
                                    isHighlighted ? 'text-black' : 'text-amber-400'
                                  }`}
                                />
                              )}
                              <span
                                className={`font-extrabold truncate ${
                                  projectorMode ? 'text-xs sm:text-sm' : 'text-xs'
                                } ${isHighlighted ? 'text-black' : 'text-white'}`}
                              >
                                {st.name}
                              </span>
                            </div>
                            {role && (
                              <span
                                className={`text-[10px] font-bold block truncate ${
                                  isHighlighted ? 'text-black/75' : 'text-amber-300/90'
                                }`}
                              >
                                {role}
                              </span>
                            )}
                          </div>

                          <div className="no-print flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleLockStudent(grp.id, st.id)}
                              className={`p-1 rounded cursor-pointer ${
                                isLocked
                                  ? 'text-amber-400 bg-amber-400/15'
                                  : isHighlighted
                                  ? 'text-black/70 hover:text-black'
                                  : 'text-slate-500 hover:text-amber-300'
                              }`}
                              title={isLocked ? 'Unlock student seat' : 'Lock student to this table'}
                              aria-label={isLocked ? `Unlock ${st.name}` : `Lock ${st.name}`}
                            >
                              {isLocked ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Unlock className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenQuickMove(st.id, grp.id)}
                              className={`p-1 rounded cursor-pointer ${
                                isHighlighted
                                  ? 'text-black/70 hover:text-black'
                                  : 'text-slate-500 hover:text-amber-300'
                              }`}
                              title="Move group"
                              aria-label={`Move ${st.name}`}
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                            </button>
                            {projectorMode && onRemoveAbsentFromGroups ? (
                              <button
                                type="button"
                                onClick={() => void onRemoveAbsentFromGroups(st)}
                                className={`p-1 rounded cursor-pointer ${
                                  isHighlighted
                                    ? 'text-black/70 hover:text-rose-800'
                                    : 'text-slate-500 hover:text-rose-400'
                                }`}
                                title={`Mark ${st.name} absent`}
                                aria-label={`Mark ${st.name} absent`}
                              >
                                <UserX className="w-3 h-3" />
                              </button>
                            ) : (
                              onRemoveStudentFromGroup && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveStudentFromGroup(grp.id, st.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                                  title="Remove from table"
                                  aria-label={`Remove ${st.name}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )
                            )}
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
    </div>
  );
};
