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
  Maximize2,
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
  Type,
  Undo2,
  Unlock,
  UserCheck,
  UserX,
  Volume2,
  X,
} from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  type ClassSectionDoc,
  type FloorPlanLayout,
  type StudentDoc,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { NoiseMeterWidget } from './NoiseMeterWidget';
import type { ClassroomTimerControls } from '../hooks/useClassroomTimer';

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
  timerSoundEnabled?: boolean;
  timer: ClassroomTimerControls;
  onOpenPopoutTimer: () => void;
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
  onClearRoles: () => void;
  onRemoveStudentRole: (groupId: string, studentId: string) => void;
  onToggleLockStudent: (groupId: string, studentId: string) => void;
  onAdjustGroupPoints: (groupId: string, delta: number) => void;
  onSaveFloorPlan: (layout: FloorPlanLayout) => Promise<void> | void;
  onMoveStudent: (studentId: string, fromGroupId: string, toGroupId: string) => void;
  onOpenQuickMove: (studentId: string, groupId: string) => void;
  onRemoveAbsentFromGroups: (student: StudentDoc) => Promise<void>;
  onRestorePresentStudent: (student: StudentDoc) => Promise<void>;
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
  timerSoundEnabled = true,
  timer,
  onOpenPopoutTimer,
  onSpotlightWinner,
  onUpdateSpotlightDeck,
  onNotifyError,
  onClose,
  onOpenGroupRules,
  onOpenSettings,
  onOpenShortcuts,
  onReshuffle,
  onRotateRoles,
  onClearRoles,
  onRemoveStudentRole,
  onToggleLockStudent,
  onAdjustGroupPoints,
  onSaveFloorPlan,
  onMoveStudent,
  onOpenQuickMove,
  onRemoveAbsentFromGroups,
  onRestorePresentStudent,
}) => {
  const [projectorLayout, setProjectorLayout] = useState<'grid' | 'floorplan'>('grid');
  const [textScale, setTextScale] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    const saved = Number(window.localStorage.getItem('tiger_projector_scale_v2'));
    return Number.isFinite(saved) && saved >= 1 && saved <= 5 ? Math.round(saved) : 2;
  });
  const [showNoiseMeter, setShowNoiseMeter] = useState(false);
  const [showAbsentPanel, setShowAbsentPanel] = useState(false);

  const [fistOpen, setFistOpen] = useState(false);
  const [fistSeconds, setFistSeconds] = useState(10);

  const [isSpotlighting, setIsSpotlighting] = useState(false);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const isSpotlightingRef = useRef(false);
  const spotlightTimerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(0);
  const lastTimerTriggerRef = useRef<number>(timerToggleTrigger);
  const lastFistTriggerRef = useRef<number>(fistToFiveTrigger);

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridBox, setGridBox] = useState<{ width: number; height: number }>(() =>
    typeof window === 'undefined'
      ? { width: 1200, height: 640 }
      : {
          width: Math.max(320, window.innerWidth - 32),
          height: Math.max(240, window.innerHeight - 130),
        }
  );

  const groupCountForMeasure = section?.groups?.length ?? 0;
  useEffect(() => {
    if (!open || projectorLayout !== 'grid') return;
    const measure = () => {
      const el = gridContainerRef.current;
      if (el && el.clientWidth > 0 && el.clientHeight > 0) {
        const nextW = el.clientWidth;
        const nextH = el.clientHeight;
        setGridBox((prev) =>
          Math.abs(prev.width - nextW) <= 1 && Math.abs(prev.height - nextH) <= 1
            ? prev
            : { width: nextW, height: nextH }
        );
      } else {
        const nextW = Math.max(320, window.innerWidth - 32);
        const nextH = Math.max(240, window.innerHeight - 130);
        setGridBox((prev) =>
          Math.abs(prev.width - nextW) <= 1 && Math.abs(prev.height - nextH) <= 1
            ? prev
            : { width: nextW, height: nextH }
        );
      }
    };

    measure();
    const rafId = window.requestAnimationFrame(measure);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && gridContainerRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(gridContainerRef.current);
    }
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, projectorLayout, groupCountForMeasure]);

  const updateTextScale = useCallback((updater: (prev: number) => number) => {
    setTextScale((prev) => {
      const next = Math.max(1, Math.min(5, updater(prev)));
      try {
        window.localStorage.setItem('tiger_projector_scale_v2', String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleScaleKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        updateTextScale((s) => s + 1);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        updateTextScale((s) => s - 1);
      }
    };
    window.addEventListener('keydown', handleScaleKey);
    return () => window.removeEventListener('keydown', handleScaleKey);
  }, [open, updateTextScale]);

  // Optimistic local Deck state so rapid Spotlight spins or toggles never read stale props
  const [localDeckMode, setLocalDeckMode] = useState<boolean>(
    () => section?.spotlightDeckMode !== false
  );
  const [localCalledIds, setLocalCalledIds] = useState<string[]>(
    () => section?.spotlightCalledIds || []
  );
  const localDeckModeRef = useRef(localDeckMode);
  const localCalledIdsRef = useRef(localCalledIds);

  useEffect(() => {
    const nextMode = section?.spotlightDeckMode !== false;
    localDeckModeRef.current = nextMode;
    setLocalDeckMode(nextMode);
  }, [section?.id, section?.spotlightDeckMode]);

  useEffect(() => {
    const nextCalled = Array.isArray(section?.spotlightCalledIds)
      ? section.spotlightCalledIds
      : [];
    localCalledIdsRef.current = nextCalled;
    setLocalCalledIds(nextCalled);
  }, [section?.id, section?.spotlightCalledIds]);

  const clearSpotlightTimeout = useCallback(() => {
    if (spotlightTimerRef.current !== null) {
      window.clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }
    isSpotlightingRef.current = false;
  }, []);

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

  // Deduplicated assigned students in current groups
  const assignedStudents = useMemo(() => {
    const groups = section?.groups || [];
    const sMap = new Map(students.map((s) => [s.id, s]));
    const seen = new Set<string>();
    const list: Array<{ studentId: string; studentName: string; groupName: string }> = [];
    groups.forEach((g) => {
      g.studentIds.forEach((sid) => {
        if (seen.has(sid)) return;
        const st = sMap.get(sid);
        if (st) {
          seen.add(sid);
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

  const assignedIdSet = useMemo(
    () => new Set(assignedStudents.map((a) => a.studentId)),
    [assignedStudents]
  );

  const activeCalledIds = useMemo(
    () => localCalledIds.filter((id) => assignedIdSet.has(id)),
    [localCalledIds, assignedIdSet]
  );

  const activeCalledIdSet = useMemo(() => new Set(activeCalledIds), [activeCalledIds]);

  const remainingDeckPool = useMemo(
    () => assignedStudents.filter((a) => !activeCalledIdSet.has(a.studentId)),
    [assignedStudents, activeCalledIdSet]
  );

  const runProjectedSpotlight = useCallback(() => {
    if (isSpotlightingRef.current) return;
    clearSpotlightTimeout();
    if (assignedStudents.length === 0) {
      onNotifyError('Generate groups first before picking a student!');
      return;
    }

    const deckActive = localDeckModeRef.current;
    const currentAssignedSet = new Set(assignedStudents.map((a) => a.studentId));
    const currentCalled = localCalledIdsRef.current.filter((id) => currentAssignedSet.has(id));
    const currentCalledSet = new Set(currentCalled);
    const currentRemaining = assignedStudents.filter((a) => !currentCalledSet.has(a.studentId));

    let winnerPool = assignedStudents;
    let resetDeckFirst = false;
    if (deckActive) {
      if (currentRemaining.length > 0) {
        winnerPool = currentRemaining;
      } else {
        resetDeckFirst = true;
        winnerPool = assignedStudents;
      }
    }

    const chosenWinner = winnerPool[Math.floor(Math.random() * winnerPool.length)];
    if (!chosenWinner) return;

    onSpotlightWinner(null);
    isSpotlightingRef.current = true;
    setIsSpotlighting(true);

    const totalSteps = 20;
    let step = 0;
    let prevId: string | null = null;

    const tick = () => {
      step += 1;
      let candidate: (typeof assignedStudents)[number] = chosenWinner;
      if (step < totalSteps) {
        candidate = assignedStudents[Math.floor(Math.random() * assignedStudents.length)] || chosenWinner;
        if (assignedStudents.length > 1 && candidate.studentId === prevId) {
          const alternatives = assignedStudents.filter((a) => a.studentId !== prevId);
          if (alternatives.length > 0) {
            candidate = alternatives[Math.floor(Math.random() * alternatives.length)];
          }
        }
      }
      prevId = candidate.studentId;
      setHighlightedStudentId(candidate.studentId);

      if (step >= totalSteps) {
        isSpotlightingRef.current = false;
        setIsSpotlighting(false);
        spotlightTimerRef.current = null;
        if (localDeckModeRef.current) {
          const baseCalled = resetDeckFirst
            ? []
            : localCalledIdsRef.current.filter((id) => currentAssignedSet.has(id));
          const nextCalled = Array.from(new Set([...baseCalled, candidate.studentId]));
          localCalledIdsRef.current = nextCalled;
          setLocalCalledIds(nextCalled);
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
    clearSpotlightTimeout,
    onNotifyError,
    onSpotlightWinner,
    onUpdateSpotlightDeck,
  ]);

  // Keyboard hotkey triggers passed from App.tsx
  useEffect(() => {
    if (!open) return;
    if (timerToggleTrigger !== lastTimerTriggerRef.current) {
      lastTimerTriggerRef.current = timerToggleTrigger;
      timer.startPauseTimer();
    }
  }, [open, timerToggleTrigger, timer]);

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
  const hasRoles = groups.some((g) => g.roles && Object.keys(g.roles).length > 0);
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const absentStudents = students
    .filter((s) => !s.present)
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeHighlightId = isSpotlighting
    ? highlightedStudentId
    : spotlightWinner?.studentId || null;
  const spotlightActive = isSpotlighting || Boolean(spotlightWinner);

  const zoomFactorMap: Record<number, number> = {
    1: 0.85,
    2: 1.0,
    3: 1.2,
    4: 1.45,
    5: 1.75,
  };
  const scaleLabelMap: Record<number, string> = {
    1: '85%',
    2: 'Fit',
    3: '120%',
    4: '145%',
    5: '175%',
  };
  const zoomFactor = zoomFactorMap[textScale] ?? 1.0;

  const numGroups = groups.length;
  const maxStudents = Math.max(
    ...groups.map((g) => g.studentIds.filter((sid) => studentMap.has(sid)).length),
    1
  );
  const longestNameLen = Math.max(
    12,
    ...groups.flatMap((g) =>
      g.studentIds.map((sid) => studentMap.get(sid)?.name.length ?? 0)
    )
  );

  // Choose grid columns & rows dynamically from container width and group count
  let cols = 1;
  if (numGroups <= 1) {
    cols = 1;
  } else if (numGroups === 2) {
    cols = gridBox.width < 680 ? 1 : 2;
  } else if (numGroups === 3) {
    cols = gridBox.width < 760 ? 1 : 3;
  } else if (numGroups === 4) {
    cols = gridBox.width < 580 ? 1 : 2;
  } else if (numGroups === 5 || numGroups === 6) {
    cols = gridBox.width < 640 ? 1 : gridBox.width < 900 ? 2 : 3;
  } else {
    cols = gridBox.width < 640 ? 1 : gridBox.width < 900 ? 2 : gridBox.width < 1180 ? 3 : 4;
  }
  const rows = Math.max(1, Math.ceil(Math.max(1, numGroups) / cols));

  const gapPx = gridBox.height < 500 || gridBox.width < 760 ? 8 : 12;
  const cardW = Math.max(200, (gridBox.width - gapPx * Math.max(0, cols - 1)) / cols);
  const cardH = Math.max(140, (gridBox.height - gapPx * Math.max(0, rows - 1)) / rows);

  const cardPadY = Math.max(6, Math.min(16, Math.round(cardH * 0.032)));
  const cardPadX = Math.max(8, Math.min(18, Math.round(cardW * 0.035)));
  const headerH = Math.max(26, Math.min(50, Math.round(cardH * 0.14)));
  const headerFontPx = Math.max(13, Math.min(30, Math.round(headerH * 0.48 * zoomFactor)));
  const headerPadBottom = Math.max(4, Math.min(10, Math.round(headerH * 0.16)));
  const headerMarginBottom = Math.max(4, Math.min(10, Math.round(headerH * 0.16)));
  const rowGapPx = Math.max(3, Math.min(8, Math.round(cardH * 0.015)));

  const listAvailH = Math.max(
    40,
    cardH - cardPadY * 2 - headerH - headerMarginBottom - rowGapPx * Math.max(0, maxStudents - 1) - 4
  );
  const slotH = listAvailH / Math.max(1, maxStudents);
  const fitRowPadY = Math.max(2, Math.min(10, Math.round(slotH * 0.11)));
  const fitRowPadX = Math.max(6, Math.min(14, Math.round(cardW * 0.024)));
  const fitInnerH = Math.max(14, slotH - fitRowPadY * 2);

  // Compute max name size that fits both vertically and horizontally without clipping/overlapping
  const fitNameByHeight = hasRoles
    ? Math.max(10, (fitInnerH - 2) / 1.92)
    : Math.max(11, fitInnerH / 1.24);
  const actionButtonsWidth = 68;
  const textAvailW = Math.max(70, cardW - cardPadX * 2 - fitRowPadX * 2 - actionButtonsWidth - 8);
  const effectiveChars = Math.max(12, Math.min(longestNameLen, 22));
  const fitNameByWidth = textAvailW / (effectiveChars * 0.56);
  const fitNameFontPx = Math.max(10, Math.min(48, Math.min(fitNameByHeight, fitNameByWidth)));

  const nameFontPx = Math.max(10, Math.min(64, Math.round(fitNameFontPx * zoomFactor * 10) / 10));
  const roleFontPx = Math.max(9, Math.min(22, Math.round(nameFontPx * 0.56 * 10) / 10));
  const rowPadY = Math.max(2, Math.min(14, Math.round(fitRowPadY * Math.max(0.85, zoomFactor))));
  const rowPadX = Math.max(6, Math.min(16, fitRowPadX));
  const pointsFontPx = Math.max(11, Math.min(18, Math.round(headerFontPx * 0.65)));
  const badgeFontPx = Math.max(11, Math.min(18, Math.round(headerFontPx * 0.68)));
  const iconBtnPx = nameFontPx >= 24 ? 16 : nameFontPx >= 16 ? 14 : 12;
  const isZoomedBeyondFit = zoomFactor > 1.05;

  // Estimate remaining space inside tallest card so rows sit nicely without overflowing
  const estRowHeight =
    rowPadY * 2 + nameFontPx * 1.18 + (hasRoles ? roleFontPx * 1.2 + 2 : 0) + 2;
  const estTotalListH =
    maxStudents * estRowHeight + Math.max(0, maxStudents - 1) * rowGapPx;
  const extraSpacePerGap =
    !isZoomedBeyondFit && listAvailH > estTotalListH
      ? Math.min(14, Math.floor((listAvailH - estTotalListH) / Math.max(1, maxStudents)))
      : 0;
  const computedRowGapPx = rowGapPx + extraSpacePerGap;

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
      timer.startPauseTimer();
    }
  };

  const handleCloseWinner = () => {
    clearSpotlightTimeout();
    setIsSpotlighting(false);
    setHighlightedStudentId(null);
    onSpotlightWinner(null);
  };

  const handleSkipReturnToDeck = () => {
    if (spotlightWinner?.studentId && localDeckModeRef.current) {
      const nextCalled = localCalledIdsRef.current.filter(
        (id) => id !== spotlightWinner.studentId
      );
      localCalledIdsRef.current = nextCalled;
      setLocalCalledIds(nextCalled);
      void onUpdateSpotlightDeck({ spotlightCalledIds: nextCalled });
    }
    handleCloseWinner();
  };

  const handleToggleDeckMode = () => {
    const nextMode = !localDeckModeRef.current;
    localDeckModeRef.current = nextMode;
    setLocalDeckMode(nextMode);
    void onUpdateSpotlightDeck({ spotlightDeckMode: nextMode });
  };

  const handleResetDeck = () => {
    localCalledIdsRef.current = [];
    setLocalCalledIds([]);
    void onUpdateSpotlightDeck({ spotlightCalledIds: [] });
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 text-white flex flex-col p-2.5 sm:p-4 overflow-hidden">
      {/* Projector Header */}
      <div className="no-print bg-slate-900/95 border border-slate-800 rounded-2xl px-4 py-2 sm:py-2.5 mb-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐾</span>
          <div>
            <h2
              className={`font-extrabold text-white leading-none ${
                textScale >= 4 ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'
              }`}
            >
              {section?.name || 'Class Period'}
            </h2>
            <p
              className={`text-amber-400 font-bold mt-1 ${
                textScale >= 4 ? 'text-xs sm:text-sm' : 'text-xs'
              }`}
            >
              {formatRuleSummary(section)}
            </p>
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

          {/* Text Size Scale Control */}
          <div
            className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
            title="Scale student names & text size for back-of-classroom visibility (+ / -)"
          >
            <button
              type="button"
              onClick={() => updateTextScale((s) => s - 1)}
              disabled={textScale <= 1}
              className="px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-35 font-black text-xs cursor-pointer"
              aria-label="Decrease presentation text size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => updateTextScale(() => 2)}
              className="px-2 py-1.5 border-x border-slate-800 text-amber-300 hover:bg-slate-800 text-[11px] font-black font-mono-tabular flex items-center gap-1 cursor-pointer"
              title="Click to reset text size to window Auto-Fit (100%)"
            >
              <Type className="w-3 h-3" />
              {scaleLabelMap[textScale] || 'Fit'}
            </button>
            <button
              type="button"
              onClick={() => updateTextScale((s) => s + 1)}
              disabled={textScale >= 5}
              className="px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-35 font-black text-xs cursor-pointer"
              aria-label="Increase presentation text size"
            >
              A+
            </button>
          </div>
        </div>

        {/* Classroom Timer / Sequence Widget */}
        {timer.showInlineTimer && (
          <div className="flex flex-wrap items-center bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 gap-2">
            {/* Single vs Sequence toggle */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => timer.switchTimerMode('single')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  timer.timerMode === 'single' ? 'bg-amber-400 text-black' : 'text-slate-400'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => timer.switchTimerMode('chained')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  timer.timerMode === 'chained' ? 'bg-amber-400 text-black' : 'text-slate-400'
                }`}
              >
                Sequence
              </button>
            </div>

            {timer.timerRunning || timer.timerMode === 'chained' ? (
              <button
                onClick={timer.startPauseTimer}
                className="font-black text-2xl text-amber-400 font-mono-tabular tracking-wider hover:text-amber-300 cursor-pointer px-1"
                title="Click to start/pause"
              >
                {timer.formattedClock}
              </button>
            ) : (
              <div className="flex items-center gap-1" title="Type minutes and seconds">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Timer minutes"
                  value={timer.minInput}
                  maxLength={3}
                  onChange={(e) => timer.setMinInputValue(e.target.value)}
                  onBlur={timer.blurTypedInputs}
                  onKeyDown={handleTimerKeyDown}
                  className="w-12 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-1 py-0.5 text-center font-black text-xl text-amber-400 font-mono-tabular focus:outline-none"
                />
                <span className="font-black text-xl text-amber-400">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Timer seconds"
                  value={timer.secInput}
                  maxLength={2}
                  onChange={(e) => timer.setSecInputValue(e.target.value)}
                  onBlur={timer.blurTypedInputs}
                  onKeyDown={handleTimerKeyDown}
                  className="w-11 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-1 py-0.5 text-center font-black text-xl text-amber-400 font-mono-tabular focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={timer.startPauseTimer}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg cursor-pointer"
                title={timer.timerRunning ? 'Pause Timer' : 'Start Timer'}
              >
                {timer.timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={timer.resetTimer}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              {timer.timerMode === 'single' && (
                <>
                  <button
                    onClick={() => timer.adjustSeconds(60)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    +1m
                  </button>
                  <button
                    onClick={() => timer.adjustSeconds(300)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    +5m
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onOpenPopoutTimer}
                className="px-2 py-1 bg-amber-400 hover:bg-amber-300 text-black rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
                title="Pop out large animated timer"
              >
                <Maximize2 className="w-3 h-3" />
                Pop Out
              </button>
              <button
                onClick={() => timer.setShowInlineTimer(false)}
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
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
            <button
              onClick={() => timer.setShowInlineTimer((v) => !v)}
              className={`px-3 py-2 font-extrabold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                timer.showInlineTimer
                  ? 'bg-amber-400 text-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              Timer
            </button>
            <button
              type="button"
              onClick={onOpenPopoutTimer}
              className="px-2 py-2 bg-slate-900 hover:bg-slate-700 text-amber-300 border-l border-slate-700 flex items-center gap-1 text-[11px] font-black cursor-pointer"
              title="Pop out large animated timer"
            >
              <Maximize2 className="w-3 h-3" />
              Big
            </button>
          </div>

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
              onClick={handleToggleDeckMode}
              className={`px-2 py-2 text-[11px] font-black border-l border-slate-700 flex items-center gap-1 cursor-pointer ${
                localDeckMode
                  ? 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/70'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
              title={
                localDeckMode
                  ? `Non-Repeating Deck (${remainingDeckPool.length}/${assignedStudents.length} left) — click for Pure Random`
                  : 'Pure Random Mode — click to switch to Non-Repeating Deck'
              }
            >
              <Layers className="w-3 h-3" />
              {localDeckMode ? `Deck ${remainingDeckPool.length}/${assignedStudents.length}` : 'Random'}
            </button>
            {localDeckMode && activeCalledIds.length > 0 && (
              <button
                type="button"
                onClick={handleResetDeck}
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
            title="Assign or rotate table roles without moving seats (R)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {hasRoles ? 'Roles' : 'Assign Roles'}
          </button>
          {hasRoles && (
            <button
              onClick={onClearRoles}
              className="px-2.5 py-2 bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 font-bold text-xs rounded-xl border border-slate-700 hover:border-rose-700/50 flex items-center gap-1 whitespace-nowrap cursor-pointer"
              title="Remove roles from all tables"
            >
              <X className="w-3.5 h-3.5" />
              No Roles
            </button>
          )}

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
      {timer.showInlineTimer && timer.timerMode === 'chained' && (
        <div className="no-print bg-slate-900 border-2 border-amber-400/70 rounded-2xl px-4 py-2.5 mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-black text-xs font-mono-tabular shrink-0">
              Phase {timer.stageIndex + 1}/{timer.stages.length}
            </span>
            <div className="min-w-0">
              <span
                className={`font-black text-white block truncate ${
                  textScale >= 4
                    ? 'text-lg sm:text-2xl'
                    : textScale === 3
                    ? 'text-base sm:text-xl'
                    : 'text-sm sm:text-base'
                }`}
              >
                {timer.activeStage.title}
              </span>
              {timer.activeStage.instructions && (
                <span
                  className={`text-slate-300 block truncate ${
                    textScale >= 4 ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                  }`}
                >
                  {timer.activeStage.instructions}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => timer.stepStage(-1)}
              disabled={timer.stageIndex === 0}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg cursor-pointer"
              title="Previous phase"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => timer.stepStage(1)}
              disabled={timer.stageIndex >= timer.stages.length - 1}
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
        <div
          className={`bg-slate-900 border-2 border-amber-400 text-amber-300 font-black py-2 px-4 rounded-xl mb-2 text-center shrink-0 ${
            textScale >= 4
              ? 'text-2xl sm:text-3xl'
              : textScale >= 2
              ? 'text-xl sm:text-2xl'
              : 'text-lg sm:text-xl'
          }`}
        >
          🎯 Spotlighting across student groups...
        </div>
      )}

      {/* Spotlight Winner Banner with Draw Next, Skip/Return to Deck & Close Options */}
      {!isSpotlighting && spotlightWinner && (
        <div
          className={`bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 text-black font-black py-2.5 px-4 rounded-xl mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg ${
            textScale >= 4
              ? 'text-2xl sm:text-4xl'
              : textScale >= 2
              ? 'text-xl sm:text-3xl'
              : 'text-lg sm:text-2xl'
          }`}
        >
          <span className="hidden lg:inline-block w-44 shrink-0" aria-hidden="true" />
          <span className="text-center truncate flex-1">
            🏆 Spotlight Winner: {spotlightWinner.studentName} ({spotlightWinner.groupName})
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={runProjectedSpotlight}
              className="px-2.5 py-1 bg-black text-amber-300 hover:bg-slate-900 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer"
              title="Draw the next student immediately"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Draw Next
            </button>
            {localDeckMode && (
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
          textScale={textScale}
          activeHighlightId={activeHighlightId}
          spotlightActive={spotlightActive}
          isSpotlighting={isSpotlighting}
          onSaveFloorPlan={onSaveFloorPlan}
          onMoveStudent={onMoveStudent}
          onOpenQuickMove={onOpenQuickMove}
          onToggleLockStudent={onToggleLockStudent}
          onRemoveStudentRole={onRemoveStudentRole}
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
        <div
          ref={gridContainerRef}
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            ...(isZoomedBeyondFit
              ? {}
              : { gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }),
            gap: `${gapPx}px`,
          }}
          className={`flex-1 grid min-h-0 overflow-y-auto pr-0.5 ${
            isZoomedBeyondFit ? 'content-start items-stretch' : 'h-full'
          }`}
        >
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
                style={{ padding: `${cardPadY}px ${cardPadX}px` }}
                className={`bg-slate-900 border-2 ${colorDef.border} ${colorDef.bg} rounded-2xl flex flex-col justify-between ${
                  isZoomedBeyondFit ? 'min-h-0' : 'h-full min-h-0'
                }`}
              >
                <div
                  style={{
                    paddingBottom: `${headerPadBottom}px`,
                    marginBottom: `${headerMarginBottom}px`,
                  }}
                  className="flex items-center justify-between border-b-2 border-slate-800/80 shrink-0 gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full ${colorDef.color} shrink-0`} />
                    <h3
                      style={{ fontSize: `${headerFontPx}px`, lineHeight: 1.15 }}
                      className="font-black text-white tracking-wide truncate"
                    >
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
                        style={{ fontSize: `${pointsFontPx}px` }}
                        className={`font-black font-mono-tabular px-1 ${
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
                      style={{ fontSize: `${badgeFontPx}px` }}
                      className={`font-black px-2 py-0.5 rounded-lg bg-slate-950 ${colorDef.text} tabular-nums shrink-0`}
                    >
                      {memberStudents.length}
                    </span>
                  </div>
                </div>

                <div
                  style={{ gap: `${computedRowGapPx}px` }}
                  className={`flex-1 flex flex-col justify-start min-h-0 ${
                    isZoomedBeyondFit ? '' : 'overflow-y-auto pr-0.5'
                  }`}
                >
                  {memberStudents.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-800/80 rounded-xl min-h-[60px]">
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
                          style={{ padding: `${rowPadY}px ${rowPadX}px` }}
                          className={`rounded-xl shrink-0 flex items-center justify-between cursor-grab active:cursor-grabbing transition-all duration-100 ${
                            isHighlighted
                              ? 'bg-amber-400 text-black border-2 border-yellow-100 ring-2 ring-amber-400/70 shadow-xl z-10'
                              : isDimmed
                              ? 'bg-slate-950/60 border border-slate-800/60 opacity-40'
                              : 'bg-slate-950 border border-slate-800'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span
                              style={{ fontSize: `${nameFontPx}px`, lineHeight: 1.16 }}
                              className={`font-black break-words whitespace-normal tracking-tight flex items-center gap-1.5 ${
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
                                  style={{ width: `${iconBtnPx}px`, height: `${iconBtnPx}px` }}
                                  className={`shrink-0 ${
                                    isHighlighted ? 'text-black' : 'text-amber-400'
                                  }`}
                                />
                              )}
                              <span className="min-w-0">{st.name}</span>
                            </span>
                            {role && (
                              <span
                                style={{ fontSize: `${roleFontPx}px`, lineHeight: 1.2 }}
                                className={`inline-flex items-center gap-1 font-bold mt-0.5 max-w-full ${
                                  isHighlighted ? 'text-black/75' : 'text-amber-300/90'
                                }`}
                              >
                                <span className="truncate">{role}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveStudentRole(grp.id, st.id);
                                  }}
                                  className={`no-print cursor-pointer shrink-0 ${
                                    isHighlighted
                                      ? 'text-black/60 hover:text-black'
                                      : 'text-slate-500 hover:text-rose-400'
                                  }`}
                                  title={`Remove ${role} role`}
                                  aria-label={`Remove ${role} role from ${st.name}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 ml-1.5 shrink-0">
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
                                <Lock style={{ width: `${iconBtnPx}px`, height: `${iconBtnPx}px` }} />
                              ) : (
                                <Unlock style={{ width: `${iconBtnPx}px`, height: `${iconBtnPx}px` }} />
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
                              <ArrowLeftRight style={{ width: `${iconBtnPx}px`, height: `${iconBtnPx}px` }} />
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
                              <UserX style={{ width: `${iconBtnPx}px`, height: `${iconBtnPx}px` }} />
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
