import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  type ClassSectionDoc,
  type StudentDoc,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';

interface ProjectorOverlayProps {
  open: boolean;
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  spotlightWinner: { studentName: string; groupName: string } | null;
  onClose: () => void;
  onOpenSpotlight: () => void;
  onOpenGroupRules: () => void;
  onReshuffle: () => void;
  onMoveStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  onOpenQuickMove: (studentId: string, groupId: string) => void;
  onTimerFinished: () => void;
}

export const ProjectorOverlay: React.FC<ProjectorOverlayProps> = ({
  open,
  section,
  students,
  spotlightWinner,
  onClose,
  onOpenSpotlight,
  onOpenGroupRules,
  onReshuffle,
  onMoveStudent,
  onOpenQuickMove,
  onTimerFinished,
}) => {
  const [showTimer, setShowTimer] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          onTimerFinished();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, onTimerFinished]);

  if (!open) return null;

  const groups = section?.groups || [];
  const studentMap = new Map(students.map((s) => [s.id, s]));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const numGroups = groups.length;
  const maxStudents = Math.max(...groups.map((g) => g.studentIds.length), 1);

  let gridLayoutClass = 'grid-cols-1 grid-rows-1';
  let isTwoRows = false;
  if (numGroups === 2) {
    gridLayoutClass = 'grid-cols-2 grid-rows-1';
  } else if (numGroups === 3) {
    gridLayoutClass = 'grid-cols-3 grid-rows-1';
  } else if (numGroups === 4) {
    gridLayoutClass = 'grid-cols-2 grid-rows-2';
    isTwoRows = true;
  } else if (numGroups === 5 || numGroups === 6) {
    gridLayoutClass = 'grid-cols-3 grid-rows-2';
    isTwoRows = true;
  } else if (numGroups >= 7) {
    gridLayoutClass = 'grid-cols-4 grid-rows-2';
    isTwoRows = true;
  }

  let fontClass = 'text-xl sm:text-2xl font-black';
  let itemPadding = 'py-2 px-3';
  let cardPadding = 'p-3 sm:p-4';
  let headerTextClass = 'text-lg sm:text-xl font-black';
  let headerPadding = 'pb-2 mb-2';

  if (isTwoRows) {
    if (maxStudents <= 3) {
      fontClass = 'text-lg sm:text-xl font-extrabold';
      itemPadding = 'py-1.5 px-2.5';
      cardPadding = 'p-3';
      headerTextClass = 'text-base sm:text-lg font-black';
      headerPadding = 'pb-1.5 mb-1.5';
    } else if (maxStudents <= 5) {
      fontClass = 'text-sm sm:text-base font-bold';
      itemPadding = 'py-1 px-2.5';
      cardPadding = 'p-2.5';
      headerTextClass = 'text-sm sm:text-base font-black';
      headerPadding = 'pb-1 mb-1';
    } else if (maxStudents <= 7) {
      fontClass = 'text-xs sm:text-sm font-bold';
      itemPadding = 'py-0.5 px-2';
      cardPadding = 'p-2';
      headerTextClass = 'text-xs sm:text-sm font-black';
      headerPadding = 'pb-1 mb-1';
    } else {
      fontClass = 'text-[11px] sm:text-xs font-bold';
      itemPadding = 'py-0.5 px-1.5';
      cardPadding = 'p-1.5';
      headerTextClass = 'text-xs font-black';
      headerPadding = 'pb-0.5 mb-0.5';
    }
  } else {
    if (maxStudents <= 3) {
      fontClass = 'text-2xl sm:text-4xl font-black';
      itemPadding = 'py-3 px-4';
      cardPadding = 'p-4 sm:p-5';
      headerTextClass = 'text-xl sm:text-2xl font-black';
      headerPadding = 'pb-2.5 mb-2.5';
    } else if (maxStudents <= 5) {
      fontClass = 'text-lg sm:text-2xl font-black';
      itemPadding = 'py-2 px-3.5';
      cardPadding = 'p-3.5 sm:p-4';
      headerTextClass = 'text-lg sm:text-xl font-black';
      headerPadding = 'pb-2 mb-2';
    } else if (maxStudents <= 7) {
      fontClass = 'text-base sm:text-lg font-extrabold';
      itemPadding = 'py-1.5 px-3';
      cardPadding = 'p-3';
      headerTextClass = 'text-base sm:text-lg font-black';
      headerPadding = 'pb-1.5 mb-1.5';
    } else {
      fontClass = 'text-sm sm:text-base font-bold';
      itemPadding = 'py-1 px-2';
      cardPadding = 'p-2.5';
      headerTextClass = 'text-sm sm:text-base font-black';
      headerPadding = 'pb-1 mb-1';
    }
  }

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
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 text-white flex flex-col p-2.5 sm:p-4 overflow-hidden">
      {/* Projector Header */}
      <div className="no-print bg-slate-900/95 border border-slate-800 rounded-2xl px-4 py-2 sm:py-2.5 mb-2 sm:mb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐾</span>
          <div>
            <h2 className="font-extrabold text-lg text-white leading-none">
              {section?.name || 'Class Period'}
            </h2>
            <p className="text-xs text-amber-400 font-bold mt-1">{formatRuleSummary(section)}</p>
          </div>
        </div>

        {/* Classroom Timer Widget */}
        {showTimer && (
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-4 py-1.5 gap-3">
            <span className="font-black text-2xl text-amber-400 font-mono-tabular tracking-wider">
              {formattedClock}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTimerRunning((r) => !r)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg cursor-pointer"
                title={timerRunning ? 'Pause Timer' : 'Start Timer'}
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsRemaining(300);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSecondsRemaining((s) => s + 60)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                +1m
              </button>
              <button
                onClick={() => setSecondsRemaining((s) => s + 300)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                +5m
              </button>
              <button
                onClick={() => setShowTimer(false)}
                className="p-1 text-slate-500 hover:text-slate-300 ml-1 cursor-pointer"
                title="Hide Timer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Projector Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowTimer((v) => !v)}
            className={`px-3.5 py-2 font-extrabold text-xs sm:text-sm rounded-xl border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              showTimer
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Timer className="w-4 h-4" />
            Timer
          </button>
          <button
            onClick={onOpenSpotlight}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-extrabold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Spotlight
          </button>
          <button
            onClick={onReshuffle}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Reshuffle
          </button>
          <button
            onClick={onOpenGroupRules}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Group Rules
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-extrabold text-xs sm:text-sm rounded-xl border border-rose-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
        </div>
      </div>

      {/* Spotlight Winner Banner */}
      {spotlightWinner && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-black text-xl sm:text-2xl py-2 px-4 rounded-xl mb-2 text-center shrink-0">
          🏆 Spotlight Winner: {spotlightWinner.studentName} ({spotlightWinner.groupName})
        </div>
      )}

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden">
          <div className="w-full max-w-lg flex flex-col items-center justify-center p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl">
            <span className="text-6xl mb-4">🎲</span>
            <h3 className="font-black text-2xl text-white">No Groups Active</h3>
            <p className="text-sm text-slate-400 mt-2">
              Click &ldquo;Group Rules&rdquo; or &ldquo;Reshuffle&rdquo; in the header to generate seating stations.
            </p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 grid ${gridLayoutClass} gap-2.5 sm:gap-3.5 min-h-0 overflow-hidden h-full`}>
          {groups.map((grp, idx) => {
            const colorDef = COLOR_DEFINITIONS[grp.colorIndex % COLOR_DEFINITIONS.length] || COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length];
            const memberStudents = grp.studentIds
              .map((sid) => studentMap.get(sid))
              .filter((st): st is StudentDoc => Boolean(st));

            return (
              <div
                key={grp.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, grp.id)}
                className={`bg-slate-900 border-2 ${colorDef.border} ${colorDef.bg} rounded-2xl ${cardPadding} flex flex-col justify-between h-full min-h-0 overflow-hidden`}
              >
                <div className={`flex items-center justify-between border-b-2 border-slate-800/80 ${headerPadding} shrink-0`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-3.5 h-3.5 rounded-full ${colorDef.color} shrink-0`} />
                    <h3 className={`${headerTextClass} text-white tracking-wide truncate`}>
                      {grp.name || colorDef.name}
                    </h3>
                  </div>
                  <span className={`text-xs sm:text-sm font-black px-2.5 py-0.5 rounded-lg bg-slate-950 ${colorDef.text} tabular-nums shrink-0`}>
                    {memberStudents.length}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-evenly gap-1 min-h-0 overflow-hidden">
                  {memberStudents.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800/80 rounded-xl min-h-0">
                      <span className="text-xs font-bold text-slate-600">Empty Station</span>
                    </div>
                  ) : (
                    memberStudents.map((st) => (
                      <div
                        key={st.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, st.id, grp.id)}
                        className={`bg-slate-950 border border-slate-800 rounded-xl ${itemPadding} flex items-center justify-between cursor-grab active:cursor-grabbing min-h-0 overflow-hidden`}
                      >
                        <span className={`${fontClass} text-white leading-tight break-words whitespace-normal tracking-tight min-w-0`}>
                          {st.name}
                        </span>
                        <button
                          onClick={() => onOpenQuickMove(st.id, grp.id)}
                          className="ml-1.5 text-slate-500 hover:text-amber-300 shrink-0 cursor-pointer"
                          title="Move Group"
                          aria-label={`Move ${st.name}`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
