import React from 'react';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ClassroomTimerControls } from '../hooks/useClassroomTimer';

interface PopoutTimerDisplayProps {
  timer: ClassroomTimerControls;
  sectionName?: string;
  timerSoundEnabled: boolean;
  standalone?: boolean;
  onFloatPip?: () => void;
  onOpenSettings?: () => void;
  onClose: () => void;
}

const PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
  { label: '10m', seconds: 600 },
  { label: '15m', seconds: 900 },
];

export const PopoutTimerDisplay: React.FC<PopoutTimerDisplayProps> = ({
  timer,
  sectionName,
  timerSoundEnabled,
  standalone = false,
  onFloatPip,
  onOpenSettings,
  onClose,
}) => {
  const {
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
    formattedClock,
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
  } = timer;

  const safeTotal = Math.max(1, totalPhaseSeconds);
  const progressRatio = Math.max(0, Math.min(1, secondsRemaining / safeTotal));
  const isZero = secondsRemaining <= 0;
  const isCritical = !isZero && secondsRemaining <= 10;
  const isWarning = !isZero && !isCritical && (secondsRemaining <= 30 || progressRatio <= 0.25);

  const radius = 136;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const ringStrokeClass = timerCompleted
    ? 'stroke-emerald-400'
    : isCritical
    ? 'stroke-rose-500'
    : isWarning
    ? 'stroke-orange-400'
    : 'stroke-amber-400';

  const clockTextClass = timerCompleted
    ? 'text-emerald-300'
    : isCritical
    ? 'text-rose-400'
    : isWarning
    ? 'text-orange-300'
    : 'text-amber-300';

  const auroraBgClass = timerCompleted
    ? 'from-emerald-500/25 via-amber-400/15 to-emerald-500/20'
    : isCritical
    ? 'from-rose-500/35 via-orange-500/20 to-rose-600/25'
    : isWarning
    ? 'from-orange-500/25 via-amber-500/15 to-amber-400/20'
    : 'from-amber-400/20 via-amber-500/10 to-yellow-300/15';

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startPauseTimer();
    }
  };

  return (
    <div
      className={`bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden ${
        standalone ? 'min-h-screen p-4 sm:p-6' : 'w-full h-full p-4 sm:p-8'
      }`}
    >
      {/* Animated Ambient Aurora */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 flex items-center justify-center`}
      >
        <div
          className={`w-[520px] h-[520px] rounded-full bg-gradient-to-tr ${auroraBgClass} blur-3xl ${
            timerRunning || timerCompleted ? 'animate-timer-aurora' : 'opacity-40'
          }`}
        />
      </div>

      {/* Top Controls Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-black text-base sm:text-lg text-white truncate">
              Classroom Activity Timer
            </h2>
            <p className="text-xs text-slate-400 font-semibold truncate flex items-center gap-2">
              <span>{sectionName || 'Live Timer'}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-amber-300">
                {timerSoundEnabled ? (
                  <>
                    <Volume2 className="w-3 h-3" /> Chime On
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3 h-3" /> Muted
                  </>
                )}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Single vs Chained Sequence Toggle */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => switchTimerMode('single')}
              className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition-colors ${
                timerMode === 'single'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Single Timer
            </button>
            <button
              type="button"
              onClick={() => switchTimerMode('chained')}
              className={`px-3 py-1.5 rounded-lg font-extrabold flex items-center gap-1 cursor-pointer transition-colors ${
                timerMode === 'chained'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Sequence
            </button>
          </div>

          {!standalone && onFloatPip && (
            <button
              type="button"
              onClick={onFloatPip}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-extrabold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Pop out into a separate draggable window for another monitor"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Float Window
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer whitespace-nowrap"
            >
              Edit Sequence
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-200 font-extrabold text-xs rounded-xl border border-rose-700/70 flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        </div>
      </div>

      {/* Main Center Stage Clock & Progress Ring */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-4 gap-5 min-h-0">
        {/* Sequence Banner if Chained Mode */}
        {timerMode === 'chained' && (
          <div className="w-full max-w-2xl bg-slate-900/90 border border-amber-400/50 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-black font-black text-xs font-mono-tabular shrink-0">
                Phase {stageIndex + 1}/{stages.length}
              </span>
              <div className="min-w-0">
                <p className="font-black text-base text-white truncate">{activeStage.title}</p>
                {activeStage.instructions && (
                  <p className="text-xs text-slate-300 truncate">{activeStage.instructions}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => stepStage(-1)}
                disabled={stageIndex === 0}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg cursor-pointer"
                aria-label="Previous phase"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {stages.map((st, idx) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => selectStage(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-black font-mono-tabular cursor-pointer transition-colors ${
                    idx === stageIndex
                      ? 'bg-amber-400 text-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title={st.title}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => stepStage(1)}
                disabled={stageIndex >= stages.length - 1}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg cursor-pointer"
                aria-label="Next phase"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Animated Circular Ring + Giant Countdown */}
        <div
          className={`relative flex items-center justify-center ${
            isCritical && timerRunning
              ? 'animate-timer-heartbeat'
              : timerCompleted
              ? 'animate-timer-celebrate'
              : ''
          }`}
        >
          <svg
            className="w-[290px] h-[290px] sm:w-[350px] sm:h-[350px] -rotate-90 drop-shadow-2xl"
            viewBox="0 0 320 320"
            aria-hidden="true"
          >
            {/* Outer subtle halo track */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="rgba(2, 6, 23, 0.72)"
              stroke="currentColor"
              strokeWidth="16"
              className="text-slate-800/80"
            />
            {/* Animated progress arc */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${ringStrokeClass} transition-all duration-700 ease-linear`}
            />
          </svg>

          {/* Center Digital Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            {timerCompleted ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                  <BellRing className="w-3.5 h-3.5" />
                  Time&apos;s Up!
                </span>
                <span className={`font-black text-6xl sm:text-7xl font-mono-tabular ${clockTextClass}`}>
                  00:00
                </span>
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Click Reset or type new time
                </span>
              </div>
            ) : timerRunning || timerMode === 'chained' ? (
              <button
                type="button"
                onClick={startPauseTimer}
                className="flex flex-col items-center gap-1 cursor-pointer group"
                title={timerRunning ? 'Click to Pause' : 'Click to Start'}
              >
                <span
                  className={`font-black text-6xl sm:text-8xl font-mono-tabular tracking-tight transition-transform group-hover:scale-[1.02] ${clockTextClass}`}
                >
                  {formattedClock}
                </span>
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                  {isCritical
                    ? 'Final Seconds!'
                    : timerRunning
                    ? 'Running · Tap to Pause'
                    : 'Paused · Tap to Resume'}
                </span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Pop-out timer minutes"
                    value={minInput}
                    maxLength={3}
                    onChange={(e) => setMinInputValue(e.target.value)}
                    onBlur={blurTypedInputs}
                    onKeyDown={handleInputKeyDown}
                    className={`w-24 sm:w-28 bg-slate-900/90 border-2 border-slate-700 focus:border-amber-400 rounded-2xl py-2 text-center font-black text-5xl sm:text-6xl font-mono-tabular focus:outline-none ${clockTextClass}`}
                  />
                  <span className={`font-black text-5xl sm:text-6xl ${clockTextClass}`}>:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Pop-out timer seconds"
                    value={secInput}
                    maxLength={2}
                    onChange={(e) => setSecInputValue(e.target.value)}
                    onBlur={blurTypedInputs}
                    onKeyDown={handleInputKeyDown}
                    className={`w-20 sm:w-24 bg-slate-900/90 border-2 border-slate-700 focus:border-amber-400 rounded-2xl py-2 text-center font-black text-5xl sm:text-6xl font-mono-tabular focus:outline-none ${clockTextClass}`}
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">
                  Type MM:SS or pick a preset below
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls + Quick Presets */}
      <div className="relative z-10 flex flex-col items-center gap-3 shrink-0">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={startPauseTimer}
            className={`px-6 py-3 rounded-2xl font-black text-sm sm:text-base flex items-center gap-2 cursor-pointer shadow-lg transition-all ${
              timerRunning
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/50'
                : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-black'
            }`}
          >
            {timerRunning ? (
              <>
                <Pause className="w-5 h-5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                {timerCompleted ? 'Start Again' : 'Start Timer'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetTimer}
            className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold text-sm rounded-2xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            type="button"
            onClick={() => adjustSeconds(-60)}
            disabled={secondsRemaining <= 0}
            className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 font-extrabold text-sm rounded-2xl border border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Minus className="w-4 h-4" />
            1m
          </button>

          <button
            type="button"
            onClick={() => adjustSeconds(60)}
            className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-sm rounded-2xl border border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            1m
          </button>

          <button
            type="button"
            onClick={() => adjustSeconds(300)}
            className="px-3.5 py-3 bg-slate-900 hover:bg-slate-800 text-amber-300 font-extrabold text-sm rounded-2xl border border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            5m
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPresetSeconds(preset.seconds)}
              className="px-3 py-1.5 bg-slate-900/90 hover:bg-amber-400 hover:text-black text-slate-300 border border-slate-800 rounded-xl text-xs font-extrabold font-mono-tabular transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
