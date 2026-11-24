import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TIMER_STAGES, type TimerStageItem } from '../types/classroom';
import { playProjectorChime } from '../components/ProjectorOverlay';

interface UseClassroomTimerOptions {
  defaultTimerSeconds: number;
  timerSoundEnabled: boolean;
  timerStages: TimerStageItem[];
  onTimerFinished: (phaseTitle?: string) => void;
}

export interface ClassroomTimerControls {
  timerMode: 'single' | 'chained';
  stageIndex: number;
  stages: TimerStageItem[];
  activeStage: TimerStageItem;
  secondsRemaining: number;
  totalPhaseSeconds: number;
  minInput: string;
  secInput: string;
  timerRunning: boolean;
  timerCompleted: boolean;
  showInlineTimer: boolean;
  formattedClock: string;
  setShowInlineTimer: React.Dispatch<React.SetStateAction<boolean>>;
  setMinInputValue: (raw: string) => void;
  setSecInputValue: (raw: string) => void;
  blurTypedInputs: () => void;
  startPauseTimer: () => void;
  resetTimer: () => void;
  adjustSeconds: (delta: number) => void;
  applyPresetSeconds: (seconds: number) => void;
  switchTimerMode: (mode: 'single' | 'chained') => void;
  stepStage: (delta: number) => void;
  selectStage: (index: number) => void;
}

export function useClassroomTimer({
  defaultTimerSeconds,
  timerSoundEnabled,
  timerStages,
  onTimerFinished,
}: UseClassroomTimerOptions): ClassroomTimerControls {
  const safeDefault = Math.max(10, Math.floor(defaultTimerSeconds || 300));
  const stages = timerStages.length > 0 ? timerStages : DEFAULT_TIMER_STAGES;

  const [showInlineTimer, setShowInlineTimer] = useState(false);
  const [timerMode, setTimerMode] = useState<'single' | 'chained'>('single');
  const [stageIndex, setStageIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(safeDefault);
  const [customDurationSeconds, setCustomDurationSeconds] = useState(safeDefault);
  const [totalPhaseSeconds, setTotalPhaseSeconds] = useState(safeDefault);
  const [minInput, setMinInput] = useState(() => String(Math.floor(safeDefault / 60)));
  const [secInput, setSecInput] = useState(() =>
    String(safeDefault % 60).padStart(2, '0')
  );
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);

  const prevDefaultRef = useRef(safeDefault);
  const activeStage = stages[Math.min(stageIndex, stages.length - 1)] || stages[0];

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
      setTimerCompleted(false);
      if (updateCustomBase && total > 0) {
        setCustomDurationSeconds(total);
        setTotalPhaseSeconds(total);
      }
      return total;
    },
    [parseTypedTotalSeconds]
  );

  // Sync only when Workspace Settings defaultTimerSeconds changes while idle
  useEffect(() => {
    if (prevDefaultRef.current !== safeDefault) {
      prevDefaultRef.current = safeDefault;
      if (!timerRunning && timerMode === 'single') {
        setCustomDurationSeconds(safeDefault);
        setTotalPhaseSeconds(safeDefault);
        setSecondsRemaining(safeDefault);
        setTimerCompleted(false);
        syncInputsFromSeconds(safeDefault);
      }
    }
  }, [safeDefault, timerRunning, timerMode, syncInputsFromSeconds]);

  // Clamp stageIndex if stages shrink in Settings
  useEffect(() => {
    if (stageIndex >= stages.length) {
      setStageIndex(Math.max(0, stages.length - 1));
    }
  }, [stageIndex, stages.length]);

  // 1s Countdown Interval
  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerMode === 'chained' && stageIndex + 1 < stages.length) {
            const nextIdx = stageIndex + 1;
            const nextStage = stages[nextIdx];
            setStageIndex(nextIdx);
            setTotalPhaseSeconds(nextStage.durationSeconds);
            setTimerCompleted(false);
            syncInputsFromSeconds(nextStage.durationSeconds);
            if (timerSoundEnabled) playProjectorChime();
            onTimerFinished(nextStage.title);
            return nextStage.durationSeconds;
          }
          setTimerRunning(false);
          setTimerCompleted(true);
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

  const setMinInputValue = useCallback(
    (raw: string) => {
      const cleaned = raw.replace(/\D/g, '').slice(0, 3);
      setMinInput(cleaned);
      applyTypedTimerValues(cleaned, secInput, true);
    },
    [secInput, applyTypedTimerValues]
  );

  const setSecInputValue = useCallback(
    (raw: string) => {
      const cleaned = raw.replace(/\D/g, '').slice(0, 2);
      setSecInput(cleaned);
      applyTypedTimerValues(minInput, cleaned, true);
    },
    [minInput, applyTypedTimerValues]
  );

  const blurTypedInputs = useCallback(() => {
    const total = applyTypedTimerValues(minInput, secInput, true);
    syncInputsFromSeconds(total);
  }, [minInput, secInput, applyTypedTimerValues, syncInputsFromSeconds]);

  const startPauseTimer = useCallback(() => {
    setShowInlineTimer(true);
    setTimerCompleted(false);
    if (timerRunning) {
      setTimerRunning(false);
      syncInputsFromSeconds(secondsRemaining);
    } else if (timerMode === 'chained') {
      const dur = secondsRemaining > 0 ? secondsRemaining : activeStage.durationSeconds;
      if (secondsRemaining <= 0) {
        setTotalPhaseSeconds(activeStage.durationSeconds);
      }
      setSecondsRemaining(dur);
      syncInputsFromSeconds(dur);
      setTimerRunning(true);
    } else {
      const total = applyTypedTimerValues(minInput, secInput, true);
      if (total <= 0) {
        const fallback = customDurationSeconds > 0 ? customDurationSeconds : safeDefault;
        setSecondsRemaining(fallback);
        setTotalPhaseSeconds(fallback);
        syncInputsFromSeconds(fallback);
        setTimerRunning(true);
        return;
      }
      syncInputsFromSeconds(total);
      if (total > totalPhaseSeconds || secondsRemaining <= 0) {
        setTotalPhaseSeconds(total);
      }
      setTimerRunning(true);
    }
  }, [
    timerRunning,
    secondsRemaining,
    timerMode,
    activeStage,
    minInput,
    secInput,
    customDurationSeconds,
    safeDefault,
    totalPhaseSeconds,
    syncInputsFromSeconds,
    applyTypedTimerValues,
  ]);

  const resetTimer = useCallback(() => {
    setTimerRunning(false);
    setTimerCompleted(false);
    const resetTo =
      timerMode === 'chained'
        ? activeStage.durationSeconds
        : customDurationSeconds > 0
        ? customDurationSeconds
        : safeDefault;
    setSecondsRemaining(resetTo);
    setTotalPhaseSeconds(resetTo);
    syncInputsFromSeconds(resetTo);
  }, [timerMode, activeStage, customDurationSeconds, safeDefault, syncInputsFromSeconds]);

  const adjustSeconds = useCallback(
    (delta: number) => {
      setTimerCompleted(false);
      setSecondsRemaining((prev) => {
        const next = Math.max(0, Math.min(59999, prev + delta));
        if (!timerRunning && next > 0) {
          setCustomDurationSeconds(next);
          setTotalPhaseSeconds(next);
        } else if (next > totalPhaseSeconds) {
          setTotalPhaseSeconds(next);
        }
        syncInputsFromSeconds(next);
        return next;
      });
    },
    [timerRunning, totalPhaseSeconds, syncInputsFromSeconds]
  );

  const applyPresetSeconds = useCallback(
    (seconds: number) => {
      const safe = Math.max(5, Math.min(59999, Math.round(seconds)));
      setTimerRunning(false);
      setTimerMode('single');
      setTimerCompleted(false);
      setCustomDurationSeconds(safe);
      setTotalPhaseSeconds(safe);
      setSecondsRemaining(safe);
      syncInputsFromSeconds(safe);
    },
    [syncInputsFromSeconds]
  );

  const switchTimerMode = useCallback(
    (mode: 'single' | 'chained') => {
      setTimerRunning(false);
      setTimerCompleted(false);
      setTimerMode(mode);
      if (mode === 'chained') {
        setStageIndex(0);
        const first = stages[0];
        setSecondsRemaining(first.durationSeconds);
        setTotalPhaseSeconds(first.durationSeconds);
        syncInputsFromSeconds(first.durationSeconds);
      } else {
        const target = customDurationSeconds > 0 ? customDurationSeconds : safeDefault;
        setSecondsRemaining(target);
        setTotalPhaseSeconds(target);
        syncInputsFromSeconds(target);
      }
    },
    [stages, customDurationSeconds, safeDefault, syncInputsFromSeconds]
  );

  const selectStage = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(stages.length - 1, index));
      setTimerRunning(false);
      setTimerCompleted(false);
      setTimerMode('chained');
      setStageIndex(clamped);
      const st = stages[clamped];
      setSecondsRemaining(st.durationSeconds);
      setTotalPhaseSeconds(st.durationSeconds);
      syncInputsFromSeconds(st.durationSeconds);
    },
    [stages, syncInputsFromSeconds]
  );

  const stepStage = useCallback(
    (delta: number) => {
      selectStage(stageIndex + delta);
    },
    [stageIndex, selectStage]
  );

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedClock = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return {
    timerMode,
    stageIndex,
    stages,
    activeStage,
    secondsRemaining,
    totalPhaseSeconds,
    minInput,
    secInput,
    timerRunning,
    timerCompleted,
    showInlineTimer,
    formattedClock,
    setShowInlineTimer,
    setMinInputValue,
    setSecInputValue,
    blurTypedInputs,
    startPauseTimer,
    resetTimer,
    adjustSeconds,
    applyPresetSeconds,
    switchTimerMode,
    stepStage,
    selectStage,
  };
}
