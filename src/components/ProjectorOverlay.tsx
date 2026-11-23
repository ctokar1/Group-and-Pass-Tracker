import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Hand,
  Keyboard,
  Layers,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Timer,
  Undo2,
  Unlock,
  UserCheck,
  UserX,
  Volume2,
  X,
} from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  DEFAULT_TIMER_STAGES,
  type ClassSectionDoc,
  type FloorPlanLayout,
  type StudentDoc,
  type TimerStageItem,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { NoiseMeterWidget } from './NoiseMeterWidget';

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
  timerToggleTrigger?: number;
  fistToFiveTrigger?: number;
  defaultTimerSeconds?: number;
  timerSoundEnabled?: boolean;
  timerStages?: TimerStageItem[];
  onSpotlightWinner: (winner: SpotlightWinnerInfo | null) => void;
  onUpdateSpotlightDeck: (patch: {
    spotlightCalledIds?: string[];
    spotlightDeckMode?: boolean;
  }) => Promise<void> | void;
  onNotifyError: (msg: string) => void;
  onClose: () => void;
  onOpenGroupRules: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onReshuffle: () => void;
  onRotateRoles: () => void;
  onToggleLockStudent: (groupId: string, studentId: string) => void;
  onAdjustGroupPoints: (groupId: string, delta: number) => void;
  onSaveFloorPlan: (layout: FloorPlanLayout) => Promise<void> | void;
  onMoveStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  onOpenQuickMove: (studentId: string, groupId: string) => void;
  onRemoveAbsentFromGroups: (student: StudentDoc) => Promise<void>;
  onRestorePresentStudent: (student: StudentDoc) => Promise<void>;
  onTimerFinished: (phaseTitle?: string) => void;
}

export function playProjectorChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

const FIST_TO_FIVE_SCALE = [
  { num: 5, label: 'Ready to teach it!', color: 'border-emerald-500 text-emerald-300' },
  { num: 4, label: 'Confident & clear', color: 'border-teal-500 text-teal-300' },
  { num: 3, label: 'Getting there', color: 'border-amber-400 text-amber-300' },
  { num: 2, label: 'Need another example', color: 'border-orange-500 text-orange-300' },
  { num: 1, label: 'Need 1-on-1 help', color: 'border-rose-500 text-rose-300' },
];

export const ProjectorOverlay: React.FC<ProjectorOverlayProps> = ({
  open,
  section,
  students,
  spotlightWinner,
  spotlightTrigger,
  timerToggleTrigger = 0,
  fistToFiveTrigger = 0,
  defaultTimerSeconds = 300,
  timerSoundEnabled = true,
  timerStages = DEFAULT_TIMER_STAGES,
  onSpotlightWinner,
  onUpdateSpotlightDeck,
  onNotifyError,
  onClose,
  onOpenGroupRules,
  onOpenSettings,
  onOpenShortcuts,
  onReshuffle,
  onRotateRoles,
  onToggleLockStudent,
  onAdjustGroupPoints,
  onSaveFloorPlan,
  onMoveStudent,
  onOpenQuickMove,
  onRemoveAbsentFromGroups,
  onRestorePresentStudent,
  onTimerFinished,
}) => {
  const [projectorLayout, setProjectorLayout] = useState<'grid' | 'floorplan'>('grid');
  const [showTimer, setShowTimer] = useState(false);
  const [timerMode, setTimerMode] = useState<'single' | 'chained'>('single');
  const [stageIndex, setStageIndex] = useState(0);
  const [showNoiseMeter, setShowNoiseMeter] = useState(false);
  const [showAbsentPanel, setShowAbsentPanel] = useState(false);

  const [fistOpen, setFistOpen] = useState(false);
  const [fistSeconds, setFistSeconds] = useState(10);

  const [secondsRemaining, setSecondsRemaining] = useState(defaultTimerSeconds);
  const [customDurationSeconds, setCustomDurationSeconds] = useState(defaultTimerSeconds);
  const [minInput, setMinInput] = useState(() => String(Math.floor(defaultTimerSeconds / 60)));
  const [secInput, setSecInput] = useState(() =>
    String(defaultTimerSeconds % 60).padStart(2, '0')
  );
  const [timerRunning, setTimerRunning] = useState(false);

  const [isSpotlighting, setIsSpotlighting] = useState(false);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const spotlightTimerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(0);
  const lastTimerTriggerRef = useRef<number>(timerToggleTrigger);
  const lastFistTriggerRef = useRef<number>(fistToFiveTrigger);

  const stages = timerStages.length > 0 ? timerStages : DEFAULT_TIMER_STAGES;
  const activeStage = stages[Math.min(stageIndex, stages.length - 1)] || stages[0];

  const isDeckMode = section?.spotlightDeckMode !== false; // default to Deck Mode ON
  const calledIds = section?.spotlightCalledIds || [];
  const calledIdSet = useMemo(() => new Set(calledIds), [calledIds]);

  const clearSpotlightTimeout = useCallback(() => {
    if (spotlightTimerRef.current !== null) {
      window.clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }
  }, []);

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
    if (!timerRunning && timerMode === 'single') {
      setCustomDurationSeconds(defaultTimerSeconds);
      setSecondsRemaining(defaultTimerSeconds);
      syncInputsFromSeconds(defaultTimerSeconds);
    }
  }, [defaultTimerSeconds, timerMode, syncInputsFromSeconds]);

  // Countdown tick (supports both Single and Chained Sequence)
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerMode === 'chained' && stageIndex + 1 < stages.length) {
            const nextIdx = stageIndex + 1;
            const nextStage = stages[nextIdx];
            setStageIndex(nextIdx);
            syncInputsFromSeconds(nextStage.durationSeconds);
            if (timerSoundEnabled) playProjectorChime();
            onTimerFinished(nextStage.title);
            return nextStage.durationSeconds;
          }
          setTimerRunning(false);
          syncInputsFromSeconds(0);
          if (timerSoundEnabled) playProjectorChime();
          onTimerFinished();
          return 0;
        }
        const next = prev - 1;
        syncInputsFromSeconds(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    timerRunning,
    timerMode,
    stageIndex,
    stages,
    timerSoundEnabled,
    onTimerFinished,
    syncInputsFromSeconds,
  ]);

  // Fist-to-Five 10s countdown
  useEffect(() => {
    if (!fistOpen || fistSeconds <= 0) return;
    const id = window.setInterval(() => {
      setFistSeconds((prev) => {
        if (prev <= 1) {
          if (timerSoundEnabled) playProjectorChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [fistOpen, fistSeconds, timerSoundEnabled]);

  // Assigned students in current groups
  const assignedStudents = useMemo(() => {
    const groups = section?.groups || [];
    const sMap = new Map(students.map((s) => [s.id, s]));
    const list: Array<{ studentId: string; studentName: string; groupName: string }> = [];
    groups.forEach((g) => {
      g.studentIds.forEach((sid) => {
        const st = sMap.get(sid);
        if (st) {
          list.push({
            studentId: st.id,
            studentName: st.name,
            groupName: g.name,
          });
        }
      });
    });
    return list;
  }, [section?.groups, students]);

  const remainingDeckPool = useMemo(
    () => assignedStudents.filter((a) => !calledIdSet.has(a.studentId)),
    [assignedStudents, calledIdSet]
  );

  const runProjectedSpotlight = useCallback(() => {
    clearSpotlightTimeout();
    if (assignedStudents.length === 0) {
      onNotifyError('Generate groups first before picking a student!');
      return;
    }

    // Determine eligible winners based on Deck Mode vs Pure Random
    let winnerPool = assignedStudents;
    let resetDeckFirst = false;
    if (isDeckMode) {
      if (remainingDeckPool.length > 0) {
        winnerPool = remainingDeckPool;
      } else {
        // Deck exhausted: recycle full class automatically
        resetDeckFirst = true;
        winnerPool = assignedStudents;
      }
    }

    const chosenWinner = winnerPool[Math.floor(Math.random() * winnerPool.length)];

    onSpotlightWinner(null);
    setIsSpotlighting(true);

    const totalSteps = 20;
    let step = 0;
    let prevId: string | null = null;

    const tick = () => {
      step += 1;
      let candidate: (typeof assignedStudents)[number];
      if (step >= totalSteps) {
        candidate = chosenWinner;
      } else {
        candidate = assignedStudents[Math.floor(Math.random() * assignedStudents.length)];
        if (assignedStudents.length > 1 && candidate.studentId === prevId) {
          const alternatives = assignedStudents.filter((a) => a.studentId !== prevId);
          candidate = alternatives[Math.floor(Math.random() * alternatives.length)];
        }
      }
      prevId = candidate.studentId;
      setHighlightedStudentId(candidate.studentId);

      if (step >= totalSteps) {
        setIsSpotlighting(false);
        spotlightTimerRef.current = null;
        if (isDeckMode) {
          const baseCalled = resetDeckFirst ? [] : calledIds;
          const nextCalled = Array.from(new Set([...baseCalled, candidate.studentId]));
          void onUpdateSpotlightDeck({ spotlightCalledIds: nextCalled });
        }
        onSpotlightWinner({
          studentId: candidate.studentId,
          studentName: candidate.studentName,
          groupName: candidate.groupName,
        });
        return;
      }

      const progress = step / totalSteps;
      const delay = Math.round(65 + progress * progress * 160);
      spotlightTimerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }, [
    assignedStudents,
    remainingDeckPool,
    isDeckMode,
    calledIds,
    clearSpotlightTimeout,
    onNotifyError,
    onSpotlightWinner,
    onUpdateSpotlightDeck,
  ]);

  const handleStartPauseTimer = useCallback(() => {
    setShowTimer(true);
    if (timerRunning) {
      setTimerRunning(false);
      syncInputsFromSeconds(secondsRemaining);
    } else if (timerMode === 'chained') {
      const dur = secondsRemaining > 0 ? secondsRemaining : activeStage.durationSeconds;
      setSecondsRemaining(dur);
      syncInputsFromSeconds(dur);
      setTimerRunning(true);
    } else {
      const total = applyTypedTimerValues(minInput, secInput, true);
      if (total <= 0) return;
      syncInputsFromSeconds(total);
      setTimerRunning(true);
    }
  }, [
    timerRunning,
    secondsRemaining,
    timerMode,
    activeStage,
    minInput,
    secInput,
    syncInputsFromSeconds,
    applyTypedTimerValues,
  ]);

  // Keyboard hotkey triggers passed from App.tsx
  useEffect(() => {
    if (!open) return;
    if (timerToggleTrigger !== lastTimerTriggerRef.current) {
      lastTimerTriggerRef.current = timerToggleTrigger;
      handleStartPauseTimer();
    }
  }, [open, timerToggleTrigger, handleStartPauseTimer]);

  useEffect(() => {
    if (!open) return;
    if (fistToFiveTrigger !== lastFistTriggerRef.current) {
      lastFistTriggerRef.current = fistToFiveTrigger;
      setFistSeconds(10);
      setFistOpen(true);
    }
  }, [open, fistToFiveTrigger]);

  // Trigger projected spotlight automatically when opened via HeaderBar Spotlight button or Space hotkey
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

  const handleSkipReturnToDeck = () => {
    if (spotlightWinner?.studentId && isDeckMode) {
      const nextCalled = calledIds.filter((id) => id !== spotlightWinner.studentId);
      void onUpdateSpotlightDeck({ spotlightCalledIds: nextCalled });
    }
    handleCloseWinner();
  };

  const handleSwitchTimerMode = (mode: 'single' | 'chained') => {
    setTimerRunning(false);
    setTimerMode(mode);
    if (mode === 'chained') {
      setStageIndex(0);
      const first = stages[0];
      setSecondsRemaining(first.durationSeconds);
      syncInputsFromSeconds(first.durationSeconds);
    } else {
      setSecondsRemaining(defaultTimerSeconds);
      syncInputsFromSeconds(defaultTimerSeconds);
    }
  };

  const handleStepStage = (delta: number) => {
    const nextIdx = Math.max(0, Math.min(stages.length - 1, stageIndex + delta));
    setTimerRunning(false);
    setStageIndex(nextIdx);
    const st = stages[nextIdx];
    setSecondsRemaining(st.durationSeconds);
    syncInputsFromSeconds(st.durationSeconds);
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 text-white flex flex-col p-2.5 sm:p-4 overflow-hidden">
      {/* Projector Header */}
      <div className="no-print bg-slate-900/95 border border-slate-800 rounded-2xl px-4 py-2 sm:py-2.5 mb-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐾</span>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-white leading-none">
              {section?.name || 'Class Period'}
            </h2>
            <p className="text-xs text-amber-400 font-bold mt-1">{formatRuleSummary(section)}</p>
          </div>

          {/* Grid vs 2D Floor Plan Toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-xl ml-1">
            <button
              type="button"
              onClick={() => setProjectorLayout('grid')}
              className={`px-2 py-1 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer ${
                projectorLayout === 'grid'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setProjectorLayout('floorplan')}
              className={`px-2 py-1 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer ${
                projectorLayout === 'floorplan'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="2D Spatial Classroom Map"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Room Map
            </button>
          </div>
        </div>

        {/* Classroom Timer / Sequence Widget */}
        {showTimer && (
          <div className="flex flex-wrap items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 gap-2">
            {/* Single vs Sequence toggle */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => handleSwitchTimerMode('single')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  timerMode === 'single' ? 'bg-amber-400 text-black' : 'text-slate-400'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTimerMode('chained')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  timerMode === 'chained' ? 'bg-amber-400 text-black' : 'text-slate-400'
                }`}
              >
                Sequence
              </button>
            </div>

            {timerRunning || timerMode === 'chained' ? (
              <button
                onClick={handleStartPauseTimer}
                className="font-black text-2xl text-amber-400 font-mono-tabular tracking-wider hover:text-amber-300 cursor-pointer px-1"
                title="Click to start/pause"
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
                  const resetTo =
                    timerMode === 'chained'
                      ? activeStage.durationSeconds
                      : customDurationSeconds > 0
                      ? customDurationSeconds
                      : defaultTimerSeconds;
                  setSecondsRemaining(resetTo);
                  syncInputsFromSeconds(resetTo);
                }}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {timerMode === 'single' && (
                <>
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
                </>
              )}
              <button
                onClick={() => setShowTimer(false)}
                className="p-1 text-slate-500 hover:text-slate-300 ml-0.5 cursor-pointer"
                title="Hide Timer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Projector Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowTimer((v) => !v)}
            className={`px-3 py-2 font-extrabold text-xs rounded-xl border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              showTimer
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            Timer
          </button>

          {/* Spotlight + Deck Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={runProjectedSpotlight}
              disabled={isSpotlighting}
              className={`px-3 py-2 font-extrabold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                isSpotlighting
                  ? 'bg-amber-400 text-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isSpotlighting ? 'Picking...' : 'Spotlight'}
            </button>
            <button
              type="button"
              onClick={() => void onUpdateSpotlightDeck({ spotlightDeckMode: !isDeckMode })}
              className={`px-2 py-2 text-[11px] font-black border-l border-slate-700 flex items-center gap-1 cursor-pointer ${
                isDeckMode
                  ? 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/70'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title={
                isDeckMode
                  ? `Non-Repeating Deck (${remainingDeckPool.length}/${assignedStudents.length} left) — click for Pure Random`
                  : 'Pure Random Mode — click to switch to Non-Repeating Deck'
              }
            >
              <Layers className="w-3 h-3" />
              {isDeckMode ? `Deck ${remainingDeckPool.length}/${assignedStudents.length}` : 'Random'}
            </button>
            {isDeckMode && calledIds.length > 0 && (
              <button
                type="button"
                onClick={() => void onUpdateSpotlightDeck({ spotlightCalledIds: [] })}
                className="px-2 py-2 text-[11px] font-bold text-slate-400 hover:text-amber-300 border-l border-slate-700 cursor-pointer"
                title="Reset Spotlight deck"
              >
                ↺
              </button>
            )}
          </div>

          <button
            onClick={onReshuffle}
            className="px-3 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Reshuffle
          </button>

          <button
            onClick={onRotateRoles}
            disabled={groups.length === 0}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-extrabold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            title="Rotate table roles without moving seats (R)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Roles
          </button>

          <button
            onClick={() => setShowNoiseMeter((v) => !v)}
            className={`px-3 py-2 font-extrabold text-xs rounded-xl border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              showNoiseMeter
                ? 'bg-emerald-500 text-black border-emerald-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Classroom Microphone Noise Meter"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Noise
          </button>

          <button
            onClick={() => {
              setFistSeconds(10);
              setFistOpen((v) => !v);
            }}
            className={`px-3 py-2 font-extrabold text-xs rounded-xl border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              fistOpen
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="10-second Fist-to-Five comprehension check (F)"
          >
            <Hand className="w-3.5 h-3.5" />
            Fist-to-5
          </button>

          {absentStudents.length > 0 && (
            <button
              onClick={() => setShowAbsentPanel((v) => !v)}
              className={`px-2.5 py-2 font-extrabold text-xs rounded-xl border flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                showAbsentPanel
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-slate-700'
              }`}
              title="View absent students removed from groups"
            >
              <UserX className="w-3.5 h-3.5" />
              {absentStudents.length}
            </button>
          )}

          <button
            onClick={onOpenGroupRules}
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 whitespace-nowrap cursor-pointer"
          >
            Rules
          </button>
          <button
            onClick={onOpenShortcuts}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
            title="Keyboard & Clicker Shortcuts (?)"
            aria-label="Open keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
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
            className="px-3 py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-extrabold text-xs rounded-xl border border-rose-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Exit
          </button>
        </div>
      </div>

      {/* Chained Timer Phase Banner */}
      {showTimer && timerMode === 'chained' && (
        <div className="no-print bg-slate-900 border-2 border-amber-400/70 rounded-2xl px-4 py-2.5 mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-black text-xs font-mono-tabular shrink-0">
              Phase {stageIndex + 1}/{stages.length}
            </span>
            <div className="min-w-0">
              <span className="font-black text-sm sm:text-base text-white block truncate">
                {activeStage.title}
              </span>
              {activeStage.instructions && (
                <span className="text-xs text-slate-300 block truncate">
                  {activeStage.instructions}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleStepStage(-1)}
              disabled={stageIndex === 0}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg cursor-pointer"
              title="Previous phase"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStepStage(1)}
              disabled={stageIndex >= stages.length - 1}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg cursor-pointer"
              title="Next phase"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-lg border border-slate-700 cursor-pointer"
            >
              Edit Sequence
            </button>
          </div>
        </div>
      )}

      {/* Optional Noise Meter Gauge */}
      {showNoiseMeter && <NoiseMeterWidget onClose={() => setShowNoiseMeter(false)} />}

      {/* Absent Students Panel */}
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

      {/* Spotlight Winner Banner with Skip/Return to Deck & Close Options */}
      {!isSpotlighting && spotlightWinner && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-black text-lg sm:text-2xl py-2 px-4 rounded-xl mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
          <span className="hidden sm:inline-block w-36 shrink-0" aria-hidden="true" />
          <span className="text-center truncate flex-1">
            🏆 Spotlight Winner: {spotlightWinner.studentName} ({spotlightWinner.groupName})
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isDeckMode && (
              <button
                onClick={handleSkipReturnToDeck}
                className="px-2.5 py-1 bg-black/15 hover:bg-black/25 text-black rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
                title="Skip winner & return their card back to the uncalled deck"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Return to Deck
              </button>
            )}
            <button
              onClick={handleCloseWinner}
              className="px-2.5 py-1 bg-black/15 hover:bg-black/25 text-black rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
              title="Close Spotlight Winner"
              aria-label="Close Spotlight Winner"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content: 2D Spatial Floor Plan OR Groups Grid */}
      {projectorLayout === 'floorplan' ? (
        <FloorPlanCanvas
          section={section}
          students={students}
          projectorMode
          activeHighlightId={activeHighlightId}
          spotlightActive={spotlightActive}
          isSpotlighting={isSpotlighting}
          onSaveFloorPlan={onSaveFloorPlan}
          onMoveStudent={onMoveStudent}
          onOpenQuickMove={onOpenQuickMove}
          onToggleLockStudent={onToggleLockStudent}
          onAdjustGroupPoints={onAdjustGroupPoints}
          onRemoveAbsentFromGroups={onRemoveAbsentFromGroups}
        />
      ) : groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden">
          <div className="w-full max-w-lg flex flex-col items-center justify-center p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl">
            <span className="text-6xl mb-4">🎲</span>
            <h3 className="font-black text-2xl text-white">No Groups Active</h3>
            <p className="text-sm text-slate-400 mt-2">
              Click &ldquo;Rules&rdquo; or &ldquo;Reshuffle&rdquo; in the header to generate seating stations.
            </p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 grid ${gridLayoutClass} gap-2.5 sm:gap-3.5 min-h-0 overflow-hidden h-full`}>
          {groups.map((grp, idx) => {
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
                className={`bg-slate-900 border-2 ${colorDef.border} ${colorDef.bg} rounded-2xl ${cardPadding} flex flex-col justify-between h-full min-h-0 overflow-hidden`}
              >
                <div
                  className={`flex items-center justify-between border-b-2 border-slate-800/80 ${headerPadding} shrink-0 gap-2`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3.5 h-3.5 rounded-full ${colorDef.color} shrink-0`} />
                    <h3 className={`${headerTextClass} text-white tracking-wide truncate`}>
                      {grp.name || colorDef.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-1 py-0.5 gap-0.5">
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
                      className={`text-xs sm:text-sm font-black px-2 py-0.5 rounded-lg bg-slate-950 ${colorDef.text} tabular-nums shrink-0`}
                    >
                      {memberStudents.length}
                    </span>
                  </div>
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
                      const isLocked = lockedSet.has(st.id);
                      const role = grp.roles?.[st.id];
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
                          <div className="min-w-0 flex-1">
                            <span
                              className={`${fontClass} leading-tight break-words whitespace-normal tracking-tight flex items-center gap-1.5 ${
                                isHighlighted ? 'text-black' : 'text-white'
                              }`}
                            >
                              {isHighlighted && (
                                <span className="shrink-0">
                                  {isSpotlighting ? '🎯' : '🏆'}
                                </span>
                              )}
                              {isLocked && (
                                <Lock
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isHighlighted ? 'text-black' : 'text-amber-400'
                                  }`}
                                />
                              )}
                              <span>{st.name}</span>
                            </span>
                            {role && (
                              <span
                                className={`text-[11px] font-bold block truncate ${
                                  isHighlighted ? 'text-black/75' : 'text-amber-300/90'
                                }`}
                              >
                                {role}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-1.5 shrink-0">
                            <button
                              onClick={() => onToggleLockStudent(grp.id, st.id)}
                              className={`p-1 rounded cursor-pointer ${
                                isLocked
                                  ? 'text-amber-400'
                                  : isHighlighted
                                  ? 'text-black/70 hover:text-black'
                                  : 'text-slate-500 hover:text-amber-300'
                              }`}
                              title={isLocked ? 'Unlock seat' : 'Pin student to this table'}
                              aria-label={isLocked ? `Unlock ${st.name}` : `Lock ${st.name}`}
                            >
                              {isLocked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
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

      {/* 10-Second Fist-to-Five Pulse Check Overlay */}
      {fistOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFistOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-center"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center shrink-0">
                  <Hand className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-2xl text-white">Fist-to-Five Check</h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Hold up fingers on your chest to show how confident you feel right now!
                  </p>
                </div>
              </div>

              <div className="px-4 py-2 rounded-2xl bg-slate-950 border-2 border-amber-400 font-black text-3xl text-amber-300 font-mono-tabular">
                {fistSeconds}s
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {FIST_TO_FIVE_SCALE.map((item) => (
                <div
                  key={item.num}
                  className={`bg-slate-950 border-2 ${item.color} rounded-2xl p-3 flex flex-col items-center justify-center gap-1`}
                >
                  <span className="text-3xl font-black font-mono-tabular">{item.num}</span>
                  <span className="text-xs font-extrabold leading-snug text-white">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFistSeconds(10)}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl cursor-pointer"
              >
                Restart 10s
              </button>
              <button
                type="button"
                onClick={() => setFistOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                Close Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
