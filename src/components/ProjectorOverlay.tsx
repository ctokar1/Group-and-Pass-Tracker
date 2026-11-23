import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Timer,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  type ClassSectionDoc,
  type StudentDoc,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';

export interface SpotlightWinnerInfo {
  studentId?: string;
  studentName: string;
  groupName: string;
}

interface ProjectorOverlayProps {
  open: boolean;
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  spotlightWinner: SpotlightWinnerInfo | null;
  spotlightTrigger: number;
  defaultTimerSeconds?: number;
  timerSoundEnabled?: boolean;
  onSpotlightWinner: (winner: SpotlightWinnerInfo | null) => void;
  onNotifyError: (msg: string) => void;
  onClose: () => void;
  onOpenGroupRules: () => void;
  onOpenSettings: () => void;
  onReshuffle: () => void;
  onMoveStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  onOpenQuickMove: (studentId: string, groupId: string) => void;
  onRemoveAbsentFromGroups: (student: StudentDoc) => Promise<void>;
  onRestorePresentStudent: (student: StudentDoc) => Promise<void>;
  onTimerFinished: () => void;
}

function playTimerChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [880, 1174.66];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.48);
    });
  } catch {
    // ignore Web Audio failures if blocked
  }
}

export const ProjectorOverlay: React.FC<ProjectorOverlayProps> = ({
  open,
  section,
  students,
  spotlightWinner,
  spotlightTrigger,
  defaultTimerSeconds = 300,
  timerSoundEnabled = true,
  onSpotlightWinner,
  onNotifyError,
  onClose,
  onOpenGroupRules,
  onOpenSettings,
  onReshuffle,
  onMoveStudent,
  onOpenQuickMove,
  onRemoveAbsentFromGroups,
  onRestorePresentStudent,
  onTimerFinished,
}) => {
  const [showTimer, setShowTimer] = useState(false);
  const [showAbsentPanel, setShowAbsentPanel] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(defaultTimerSeconds);
  const [customDurationSeconds, setCustomDurationSeconds] = useState(defaultTimerSeconds);
  const [minInput, setMinInput] = useState(() => String(Math.floor(defaultTimerSeconds / 60)));
  const [secInput, setSecInput] = useState(() => String(defaultTimerSeconds % 60).padStart(2, '0'));
  const [timerRunning, setTimerRunning] = useState(false);

  const [isSpotlighting, setIsSpotlighting] = useState(false);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const spotlightTimerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(0);

  const clearSpotlightTimeout = useCallback(() => {
    if (spotlightTimerRef.current !== null) {
      window.clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }
  }, []);

  // Sync minInput / secInput whenever secondsRemaining changes while paused or resetting
  const syncInputsFromSeconds = useCallback((totalSecs: number) => {
    const safe = Math.max(0, Math.floor(totalSecs));
    setMinInput(String(Math.floor(safe / 60)));
    setSecInput(String(safe % 60).padStart(2, '0'));
  }, []);

  const parseTypedTotalSeconds = useCallback((mRaw: string, sRaw: string): number => {
    const m = Math.max(0, Math.min(999, parseInt(mRaw.replace(/\D/g, ''), 10) || 0));
    const s = Math.max(0, Math.min(5999, parseInt(sRaw.replace(/\D/g, ''), 10) || 0));
    return m * 60 + s;
  }, []);

  const applyTypedTimerValues = useCallback(
    (mRaw: string, sRaw: string, updateCustomBase = true) => {
      const total = parseTypedTotalSeconds(mRaw, sRaw);
      setSecondsRemaining(total);
      if (updateCustomBase && total > 0) {
        setCustomDurationSeconds(total);
      }
      return total;
    },
    [parseTypedTotalSeconds]
  );

  useEffect(() => {
    if (!timerRunning) {
      setCustomDurationSeconds(defaultTimerSeconds);
      setSecondsRemaining(defaultTimerSeconds);
      syncInputsFromSeconds(defaultTimerSeconds);
    }
  }, [defaultTimerSeconds, syncInputsFromSeconds]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          syncInputsFromSeconds(0);
          if (timerSoundEnabled) playTimerChime();
          onTimerFinished();
          return 0;
        }
        const next = prev - 1;
        syncInputsFromSeconds(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, timerSoundEnabled, onTimerFinished, syncInputsFromSeconds]);

  const runProjectedSpotlight = useCallback(() => {
    clearSpotlightTimeout();
    const groups = section?.groups || [];
    const sMap = new Map(students.map((s) => [s.id, s]));
    const assigned: Array<{ studentId: string; studentName: string; groupName: string }> = [];
    groups.forEach((g) => {
      g.studentIds.forEach((sid) => {
        const st = sMap.get(sid);
        if (st) {
          assigned.push({
            studentId: st.id,
            studentName: st.name,
            groupName: g.name,
          });
        }
      });
    });

    if (assigned.length === 0) {
      onNotifyError('Generate groups first before picking a student!');
      return;
    }

    onSpotlightWinner(null);
    setIsSpotlighting(true);

    const totalSteps = 20;
    let step = 0;
    let prevId: string | null = null;

    const tick = () => {
      step += 1;
      let candidate = assigned[Math.floor(Math.random() * assigned.length)];
      if (assigned.length > 1 && candidate.studentId === prevId) {
        const alternatives = assigned.filter((a) => a.studentId !== prevId);
        candidate = alternatives[Math.floor(Math.random() * alternatives.length)];
      }
      prevId = candidate.studentId;
      setHighlightedStudentId(candidate.studentId);

      if (step >= totalSteps) {
        setIsSpotlighting(false);
        spotlightTimerRef.current = null;
        onSpotlightWinner({
          studentId: candidate.studentId,
          studentName: candidate.studentName,
          groupName: candidate.groupName,
        });
        return;
      }

      // Smooth deceleration from 65ms up to 220ms
      const progress = step / totalSteps;
      const delay = Math.round(65 + progress * progress * 160);
      spotlightTimerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }, [section, students, clearSpotlightTimeout, onNotifyError, onSpotlightWinner]);

  // Trigger projected spotlight automatically when opened via HeaderBar Spotlight button
  useEffect(() => {
    if (!open) {
      clearSpotlightTimeout();
      setIsSpotlighting(false);
      setHighlightedStudentId(null);
      return;
    }
    if (spotlightTrigger > 0 && spotlightTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = spotlightTrigger;
      runProjectedSpotlight();
    }
  }, [open, spotlightTrigger, clearSpotlightTimeout, runProjectedSpotlight]);

  useEffect(() => {
    return () => clearSpotlightTimeout();
  }, [clearSpotlightTimeout]);

  if (!open) return null;

  const groups = section?.groups || [];
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const absentStudents = students
    .filter((s) => !s.present)
    .sort((a, b) => a.name.localeCompare(b.name));

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const activeHighlightId = isSpotlighting
    ? highlightedStudentId
    : spotlightWinner?.studentId || null;
  const spotlightActive = isSpotlighting || Boolean(spotlightWinner);

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

  const handleStartPauseTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
      syncInputsFromSeconds(secondsRemaining);
    } else {
      const total = applyTypedTimerValues(minInput, secInput, true);
      if (total <= 0) return;
      syncInputsFromSeconds(total);
      setTimerRunning(true);
    }
  };

  const handleTimerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleStartPauseTimer();
    }
  };

  const handleCloseWinner = () => {
    clearSpotlightTimeout();
    setIsSpotlighting(false);
    setHighlightedStudentId(null);
    onSpotlightWinner(null);
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

        {/* Classroom Timer Widget (Typeable Any Value) */}
        {showTimer && (
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 gap-2.5">
            {timerRunning ? (
              <button
                onClick={() => {
                  setTimerRunning(false);
                  syncInputsFromSeconds(secondsRemaining);
                }}
                className="font-black text-2xl text-amber-400 font-mono-tabular tracking-wider hover:text-amber-300 cursor-pointer px-1"
                title="Click to pause and edit time"
              >
                {formattedClock}
              </button>
            ) : (
              <div className="flex items-center gap-1" title="Type minutes and seconds">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Timer minutes"
                  value={minInput}
                  maxLength={3}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setMinInput(cleaned);
                    applyTypedTimerValues(cleaned, secInput, true);
                  }}
                  onBlur={() => {
                    const total = applyTypedTimerValues(minInput, secInput, true);
                    syncInputsFromSeconds(total);
                  }}
                  onKeyDown={handleTimerKeyDown}
                  className="w-12 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-1 py-0.5 text-center font-black text-xl text-amber-400 font-mono-tabular focus:outline-none"
                />
                <span className="font-black text-xl text-amber-400">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Timer seconds"
                  value={secInput}
                  maxLength={2}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 2);
                    setSecInput(cleaned);
                    applyTypedTimerValues(minInput, cleaned, true);
                  }}
                  onBlur={() => {
                    const total = applyTypedTimerValues(minInput, secInput, true);
                    syncInputsFromSeconds(total);
                  }}
                  onKeyDown={handleTimerKeyDown}
                  className="w-11 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-1 py-0.5 text-center font-black text-xl text-amber-400 font-mono-tabular focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={handleStartPauseTimer}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg cursor-pointer"
                title={timerRunning ? 'Pause Timer' : 'Start Timer'}
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  setTimerRunning(false);
                  const resetTo = customDurationSeconds > 0 ? customDurationSeconds : defaultTimerSeconds;
                  setSecondsRemaining(resetTo);
                  syncInputsFromSeconds(resetTo);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const next = secondsRemaining + 60;
                  setSecondsRemaining(next);
                  if (!timerRunning) {
                    setCustomDurationSeconds(next);
                    syncInputsFromSeconds(next);
                  }
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                +1m
              </button>
              <button
                onClick={() => {
                  const next = secondsRemaining + 300;
                  setSecondsRemaining(next);
                  if (!timerRunning) {
                    setCustomDurationSeconds(next);
                    syncInputsFromSeconds(next);
                  }
                }}
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
            onClick={runProjectedSpotlight}
            disabled={isSpotlighting}
            className={`px-3.5 py-2 font-extrabold text-xs sm:text-sm rounded-xl border flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60 ${
              isSpotlighting
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {isSpotlighting ? 'Shuffling...' : 'Spotlight'}
          </button>
          <button
            onClick={onReshuffle}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Reshuffle
          </button>
          {absentStudents.length > 0 && (
            <button
              onClick={() => setShowAbsentPanel((v) => !v)}
              className={`px-3 py-2 font-extrabold text-xs sm:text-sm rounded-xl border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                showAbsentPanel
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-slate-700'
              }`}
              title="View absent students removed from groups"
            >
              <UserX className="w-4 h-4" />
              Absent ({absentStudents.length})
            </button>
          )}
          <button
            onClick={onOpenGroupRules}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs sm:text-sm rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-4 h-4 text-amber-400" />
            Group Rules
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 cursor-pointer"
            title="Settings & Color Themes"
            aria-label="Open Settings and Color Themes"
          >
            <Settings className="w-4 h-4" />
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

      {/* Absent Students Panel (Restore Present if someone walks in or was clicked by mistake) */}
      {showAbsentPanel && absentStudents.length > 0 && (
        <div className="no-print bg-slate-900 border border-rose-500/40 rounded-2xl px-4 py-3 mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-rose-300 flex items-center gap-1.5 mr-1">
              <UserX className="w-3.5 h-3.5" />
              Absent / Removed ({absentStudents.length}):
            </span>
            {absentStudents.map((st) => (
              <button
                key={st.id}
                onClick={() => void onRestorePresentStudent(st)}
                className="px-2.5 py-1 bg-slate-950 hover:bg-emerald-950/60 border border-slate-700 hover:border-emerald-500/60 rounded-lg text-xs font-bold text-slate-200 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer transition-colors"
                title={`Mark ${st.name} present again`}
              >
                <span>{st.name}</span>
                <UserCheck className="w-3 h-3 text-emerald-400" />
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400">
            Click a student to mark present, then click Reshuffle to include them.
          </span>
        </div>
      )}

      {/* Live Shuffling Banner */}
      {isSpotlighting && (
        <div className="bg-slate-900 border-2 border-amber-400 text-amber-300 font-black text-lg sm:text-xl py-2 px-4 rounded-xl mb-2 text-center shrink-0">
          🎯 Spotlighting across student groups...
        </div>
      )}

      {/* Spotlight Winner Banner with Close Option */}
      {!isSpotlighting && spotlightWinner && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-black text-lg sm:text-2xl py-2 px-4 rounded-xl mb-2 flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <span className="w-8 shrink-0" aria-hidden="true" />
          <span className="text-center truncate">
            🏆 Spotlight Winner: {spotlightWinner.studentName} ({spotlightWinner.groupName})
          </span>
          <button
            onClick={handleCloseWinner}
            className="px-2.5 py-1 bg-black/15 hover:bg-black/25 text-black rounded-lg text-xs font-black flex items-center gap-1 shrink-0 cursor-pointer"
            title="Close Spotlight Winner"
            aria-label="Close Spotlight Winner"
          >
            <X className="w-4 h-4" />
            Close
          </button>
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
                    memberStudents.map((st) => {
                      const isHighlighted = activeHighlightId === st.id;
                      const isDimmed = spotlightActive && !isHighlighted;
                      return (
                        <div
                          key={st.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, st.id, grp.id)}
                          className={`rounded-xl ${itemPadding} flex items-center justify-between cursor-grab active:cursor-grabbing min-h-0 overflow-hidden transition-all duration-100 ${
                            isHighlighted
                              ? 'bg-amber-400 text-black border-2 border-yellow-100 ring-4 ring-amber-400/60 scale-[1.02] shadow-xl z-10'
                              : isDimmed
                              ? 'bg-slate-950/60 border border-slate-800/60 opacity-40'
                              : 'bg-slate-950 border border-slate-800'
                          }`}
                        >
                          <span
                            className={`${fontClass} leading-tight break-words whitespace-normal tracking-tight min-w-0 flex items-center gap-1.5 ${
                              isHighlighted ? 'text-black' : 'text-white'
                            }`}
                          >
                            {isHighlighted && (
                              <span className="shrink-0">
                                {isSpotlighting ? '🎯' : '🏆'}
                              </span>
                            )}
                            <span>{st.name}</span>
                          </span>
                          <div className="flex items-center gap-1 ml-1.5 shrink-0">
                            <button
                              onClick={() => onOpenQuickMove(st.id, grp.id)}
                              className={`p-1 rounded cursor-pointer ${
                                isHighlighted
                                  ? 'text-black/70 hover:text-black'
                                  : 'text-slate-500 hover:text-amber-300'
                              }`}
                              title="Move Group"
                              aria-label={`Move ${st.name}`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => void onRemoveAbsentFromGroups(st)}
                              className={`p-1 rounded cursor-pointer ${
                                isHighlighted
                                  ? 'text-black/70 hover:text-rose-800'
                                  : 'text-slate-500 hover:text-rose-400'
                              }`}
                              title={`Mark ${st.name} absent & remove from groups`}
                              aria-label={`Mark ${st.name} absent and remove from groups`}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
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
