import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  Clock,
  Lock,
  Palette,
  Plus,
  RotateCcw,
  Settings,
  Sliders,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  DEFAULT_APP_SETTINGS,
  PASS_DESTINATIONS,
  THEME_OPTIONS,
  type ActiveTab,
  type AppSettings,
  type ClassSectionDoc,
  type PassDestination,
  type ThemeId,
  type TimerStageItem,
} from '../types/classroom';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  sections: ClassSectionDoc[];
  sectionsCount: number;
  activeSectionName?: string;
  onPreviewTheme: (theme: ThemeId) => void;
  onSave: (nextSettings: AppSettings) => Promise<void>;
  onApplyGroupingToAllSections: (defaults: {
    quickSize: number;
    quickCount: number;
    forceExactCount: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

type SettingsSubTab = 'themes' | 'passes' | 'bell' | 'timers';

const TAB_CHOICES: Array<{ value: ActiveTab; label: string }> = [
  { value: 'passes', label: '🚽 Hall Passes' },
  { value: 'groups', label: '🎨 Color Groups' },
  { value: 'roster', label: '📋 Class Roster' },
  { value: 'history', label: '📜 Pass History' },
  { value: 'settings', label: '⚙️ Group Rules & Sections' },
];

const SIZE_CHOICES = [
  { value: 0, label: 'Auto' },
  { value: 2, label: 'Pairs (2)' },
  { value: 3, label: 'Trios (3)' },
  { value: 4, label: '4 Kids' },
  { value: 5, label: '5 Kids' },
  { value: 6, label: '6 Kids' },
];

const COUNT_CHOICES = [
  { value: 0, label: 'Auto' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  sections,
  sectionsCount,
  onPreviewTheme,
  onSave,
  onApplyGroupingToAllSections,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<SettingsSubTab>('themes');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [timerMin, setTimerMin] = useState('5');
  const [timerSec, setTimerSec] = useState('00');
  const [saving, setSaving] = useState(false);
  const [applyingGroups, setApplyingGroups] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    const total = Math.max(10, settings.defaultTimerSeconds || 300);
    setTimerMin(String(Math.floor(total / 60)));
    setTimerSec(String(total % 60).padStart(2, '0'));
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreviewTheme(settings.theme);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, settings.theme, onPreviewTheme, onClose]);

  if (!open) return null;

  const computeTotalTimerSeconds = (mStr: string, sStr: string): number => {
    const m = Math.max(0, Math.min(999, parseInt(mStr.replace(/\D/g, ''), 10) || 0));
    const s = Math.max(0, Math.min(59, parseInt(sStr.replace(/\D/g, ''), 10) || 0));
    return Math.max(10, Math.min(59999, m * 60 + s));
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    setDraft((prev) => ({ ...prev, theme: themeId }));
    onPreviewTheme(themeId);
  };

  const handleResetDefaults = () => {
    setDraft(DEFAULT_APP_SETTINGS);
    setTimerMin(String(Math.floor(DEFAULT_APP_SETTINGS.defaultTimerSeconds / 60)));
    setTimerSec(String(DEFAULT_APP_SETTINGS.defaultTimerSeconds % 60).padStart(2, '0'));
    onPreviewTheme(DEFAULT_APP_SETTINGS.theme);
  };

  const handleCancel = () => {
    onPreviewTheme(settings.theme);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const nextSettings: AppSettings = {
        ...draft,
        defaultTimerSeconds: computeTotalTimerSeconds(timerMin, timerSec),
      };
      await onSave(nextSettings);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleApplyGroupsAll = async () => {
    if (applyingGroups) return;
    setApplyingGroups(true);
    try {
      await onApplyGroupingToAllSections({
        quickSize: draft.defaultQuickSize,
        quickCount: draft.defaultQuickCount,
        forceExactCount: draft.defaultForceExactCount,
      });
    } finally {
      setApplyingGroups(false);
    }
  };

  const toggleExemptDestination = (dest: PassDestination) => {
    setDraft((prev) => {
      const current = prev.exemptDestinations || [];
      const exists = current.includes(dest);
      return {
        ...prev,
        exemptDestinations: exists
          ? current.filter((d) => d !== dest)
          : [...current, dest],
      };
    });
  };

  const activeBellProfile =
    draft.bellSchedules.find((p) => p.id === draft.activeScheduleId) ||
    draft.bellSchedules[0];

  const updateScheduleSlot = (
    sectionId: string,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    if (!activeBellProfile) return;
    setDraft((prev) => ({
      ...prev,
      bellSchedules: prev.bellSchedules.map((prof) => {
        if (prof.id !== activeBellProfile.id) return prof;
        const exists = prof.slots.some((sl) => sl.sectionId === sectionId);
        const nextSlots = exists
          ? prof.slots.map((sl) =>
              sl.sectionId === sectionId ? { ...sl, [field]: value } : sl
            )
          : [
              ...prof.slots,
              {
                sectionId,
                startTime: field === 'startTime' ? value : '08:00',
                endTime: field === 'endTime' ? value : '08:50',
              },
            ];
        return { ...prof, slots: nextSlots };
      }),
    }));
  };

  const updateTimerStage = (
    stageId: string,
    patch: Partial<TimerStageItem>
  ) => {
    setDraft((prev) => ({
      ...prev,
      timerStages: prev.timerStages.map((st) =>
        st.id === stageId ? { ...st, ...patch } : st
      ),
    }));
  };

  const addTimerStage = () => {
    setDraft((prev) => ({
      ...prev,
      timerStages: [
        ...prev.timerStages,
        {
          id: `stage_${Date.now()}`,
          title: `Phase ${prev.timerStages.length + 1}`,
          instructions: 'Describe what students should do during this phase.',
          durationSeconds: 180,
        },
      ],
    }));
  };

  const removeTimerStage = (stageId: string) => {
    setDraft((prev) => {
      if (prev.timerStages.length <= 1) return prev;
      return {
        ...prev,
        timerStages: prev.timerStages.filter((s) => s.id !== stageId),
      };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleCancel}
    >
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-white">
                Classroom Settings, Automation &amp; Themes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure themes, overdue pass alerts, bell schedules, and multi-stage timers. Syncs live across devices.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('themes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'themes'
                ? 'bg-amber-400 text-black'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Themes &amp; Defaults
          </button>
          <button
            type="button"
            onClick={() => setSubTab('passes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'passes'
                ? 'bg-amber-400 text-black'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Passes &amp; Alerts
          </button>
          <button
            type="button"
            onClick={() => setSubTab('bell')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'bell'
                ? 'bg-amber-400 text-black'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Bell Schedule &amp; Dead Zones
          </button>
          <button
            type="button"
            onClick={() => setSubTab('timers')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              subTab === 'timers'
                ? 'bg-amber-400 text-black'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            Timer Sequences
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {subTab === 'themes' && (
            <>
              {/* 1. Color Themes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    Color Theme
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Live preview · Applies to Projector &amp; Kiosk Window
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {THEME_OPTIONS.map((t) => {
                    const selected = draft.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTheme(t.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          selected
                            ? 'border-amber-400 bg-slate-950 ring-2 ring-amber-400/40'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl border border-white/15 flex items-center justify-center shrink-0 shadow-inner"
                            style={{ backgroundColor: t.surfaceHex }}
                          >
                            <span
                              className="w-4 h-4 rounded-full shadow"
                              style={{ backgroundColor: t.accentHex }}
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs text-white block truncate">
                              {t.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {t.subtitle}
                            </span>
                          </div>
                        </div>
                        {selected && (
                          <span className="w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. App & Grouping Preferences */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Workspace &amp; Grouping Preferences
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="setting-default-tab"
                      className="text-xs font-bold text-slate-300 block"
                    >
                      Default Starting Tab
                    </label>
                    <select
                      id="setting-default-tab"
                      value={draft.defaultTab}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, defaultTab: e.target.value as ActiveTab }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                    >
                      {TAB_CHOICES.map((tab) => (
                        <option key={tab.value} value={tab.value}>
                          {tab.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="setting-max-passes"
                      className="text-xs font-bold text-slate-300 block"
                    >
                      Quarter Pass Allowance Per Student
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="setting-max-passes"
                        type="number"
                        min={1}
                        max={10}
                        value={draft.maxQuarterPasses}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 4));
                          setDraft((p) => ({ ...p, maxQuarterPasses: val }));
                        }}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-amber-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-[11px] text-slate-400">
                        tickets (1–10 · default 4)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.autoRotateRoles}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, autoRotateRoles: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      Auto-assign rotating classroom roles on every shuffle
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.avoidRecentPairs}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, avoidRecentPairs: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      Use pairing memory to avoid repeat partner pairings back-to-back
                    </span>
                  </label>
                </div>
              </div>

              {/* 3. Default Grouping Rules */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-white">
                      Default Grouping Rules
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Used for new periods, or apply to all {sectionsCount} existing periods at once.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyGroupsAll}
                    disabled={applyingGroups || sectionsCount === 0}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer whitespace-nowrap"
                  >
                    {applyingGroups ? 'Applying...' : 'Apply to All Periods Now'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-300 block">
                      Default Group Size
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SIZE_CHOICES.map((c) => {
                        const active = draft.defaultQuickSize === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setDraft((p) => ({ ...p, defaultQuickSize: c.value }))}
                            className={`py-1.5 px-2 text-xs rounded-lg border transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-400 text-black font-black border-amber-300'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold border-slate-700'
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-300 block">
                      Default Group Count
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {COUNT_CHOICES.map((c) => {
                        const active = draft.defaultQuickCount === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setDraft((p) => ({ ...p, defaultQuickCount: c.value }))}
                            className={`py-1.5 px-2 text-xs rounded-lg border transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-400 text-black font-black border-amber-300'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold border-slate-700'
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={draft.defaultForceExactCount}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, defaultForceExactCount: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Force Exact Group Count by default
                  </span>
                </label>
              </div>
            </>
          )}

          {subTab === 'passes' && (
            <div className="space-y-5">
              {/* Two-stage overdue thresholds */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  Overdue Pass Visual &amp; Audio Alerts
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="setting-warn-mins"
                      className="text-xs font-bold text-amber-300 block"
                    >
                      Stage 1: Amber Warning Threshold (Minutes)
                    </label>
                    <input
                      id="setting-warn-mins"
                      type="number"
                      min={1}
                      max={30}
                      value={draft.warnPassAlertMinutes}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 5));
                        setDraft((p) => ({ ...p, warnPassAlertMinutes: val }));
                      }}
                      className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-amber-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="setting-alert-mins"
                      className="text-xs font-bold text-rose-400 block"
                    >
                      Stage 2: Pulsing Red Critical Alert (Minutes)
                    </label>
                    <input
                      id="setting-alert-mins"
                      type="number"
                      min={1}
                      max={60}
                      value={draft.longPassAlertMinutes}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 8));
                        setDraft((p) => ({ ...p, longPassAlertMinutes: val }));
                      }}
                      className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-rose-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={draft.overdueSoundEnabled}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, overdueSoundEnabled: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    Play subtle alert chime when a student reaches critical overdue threshold
                  </span>
                </label>
              </div>

              {/* Destination Quota Exceptions */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="font-extrabold text-sm text-white">
                  Quota-Exempt Pass Destinations
                </h3>
                <p className="text-xs text-slate-400">
                  Checked destinations log to Pass History with timestamps and duration without deducting from a student&apos;s {draft.maxQuarterPasses}-pass allowance.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {PASS_DESTINATIONS.map((dest) => {
                    const checked = (draft.exemptDestinations || []).includes(dest.id);
                    return (
                      <label
                        key={dest.id}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-950/35 border-emerald-500/60 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExemptDestination(dest.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs font-extrabold">{dest.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {subTab === 'bell' && (
            <div className="space-y-5">
              {/* Auto-Switch & Dead Zone Toggles */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-400" />
                  Automatic Bell-Schedule Period Switching
                </h3>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.autoSwitchPeriod}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, autoSwitchPeriod: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-200">
                      Automatically switch active class period before bell rings
                    </span>
                  </label>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-semibold">Switch</span>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={draft.autoSwitchLeadMinutes}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          autoSwitchLeadMinutes: Math.max(
                            0,
                            Math.min(15, parseInt(e.target.value, 10) || 0)
                          ),
                        }))
                      }
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-black text-amber-300 font-mono-tabular"
                    />
                    <span className="text-slate-400 font-semibold">min before start</span>
                  </div>
                </div>

                {/* Dead Zone Blackout Settings */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.deadZoneEnabled}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, deadZoneEnabled: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      Enable Bell-Schedule &ldquo;Dead Zone&rdquo; Hallway Lockouts
                    </span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-300 font-semibold">Lock First</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={draft.deadZoneStartMinutes}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            deadZoneStartMinutes: Math.max(
                              0,
                              Math.min(30, parseInt(e.target.value, 10) || 0)
                            ),
                          }))
                        }
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-black text-amber-300 font-mono-tabular"
                      />
                      <span className="text-slate-400">min of class</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-300 font-semibold">Lock Last</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={draft.deadZoneEndMinutes}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            deadZoneEndMinutes: Math.max(
                              0,
                              Math.min(30, parseInt(e.target.value, 10) || 0)
                            ),
                          }))
                        }
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-black text-amber-300 font-mono-tabular"
                      />
                      <span className="text-slate-400">min of class</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bell Schedule Profile Editor */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold text-sm text-white">
                    Active Bell Schedule Profile
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {draft.bellSchedules.map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({ ...p, activeScheduleId: prof.id }))
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                          draft.activeScheduleId === prof.id
                            ? 'bg-amber-400 text-black border-amber-300'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {prof.name}
                      </button>
                    ))}
                  </div>
                </div>

                {activeBellProfile && (
                  <div className="divide-y divide-slate-800/70">
                    {sections.map((sec) => {
                      const slot = activeBellProfile.slots.find(
                        (sl) => sl.sectionId === sec.id
                      );
                      return (
                        <div
                          key={sec.id}
                          className="py-2.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <span className="font-bold text-xs text-white">{sec.name}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Start</span>
                            <input
                              type="time"
                              value={slot?.startTime || '08:00'}
                              onChange={(e) =>
                                updateScheduleSlot(sec.id, 'startTime', e.target.value)
                              }
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 font-mono-tabular text-amber-300"
                            />
                            <span className="text-slate-400">End</span>
                            <input
                              type="time"
                              value={slot?.endTime || '08:50'}
                              onChange={(e) =>
                                updateScheduleSlot(sec.id, 'endTime', e.target.value)
                              }
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 font-mono-tabular text-amber-300"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {subTab === 'timers' && (
            <div className="space-y-5">
              {/* Default Countdown Timer */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Default Single Projector Timer
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Initial duration when opening the standard Timer in Projector View.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Default timer minutes"
                      value={timerMin}
                      maxLength={3}
                      onChange={(e) => setTimerMin(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      className="w-10 bg-transparent text-center font-black text-xs text-amber-300 font-mono-tabular focus:outline-none"
                    />
                    <span className="text-amber-400 font-black text-xs">:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Default timer seconds"
                      value={timerSec}
                      maxLength={2}
                      onChange={(e) => setTimerSec(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      onBlur={() => {
                        const s = Math.max(0, Math.min(59, parseInt(timerSec, 10) || 0));
                        setTimerSec(String(s).padStart(2, '0'));
                      }}
                      className="w-9 bg-transparent text-center font-black text-xs text-amber-300 font-mono-tabular focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({ ...p, timerSoundEnabled: !p.timerSoundEnabled }))
                    }
                    className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      draft.timerSoundEnabled
                        ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {draft.timerSoundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        Chime On
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5" />
                        Muted
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Chained Station & Activity Sequence Builder */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <Timer className="w-4 h-4 text-amber-400" />
                      Chained Station &amp; Activity Sequence
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Run multi-phase routines in Projector View. Auto-chimes and advances instructions when each stage finishes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTimerStage}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Phase
                  </button>
                </div>

                <div className="space-y-2.5">
                  {draft.timerStages.map((stage, idx) => {
                    const mins = Math.floor(stage.durationSeconds / 60);
                    const secs = stage.durationSeconds % 60;
                    return (
                      <div
                        key={stage.id}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[11px] font-mono-tabular">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={stage.title}
                            onChange={(e) =>
                              updateTimerStage(stage.id, { title: e.target.value })
                            }
                            placeholder="Phase title..."
                            className="flex-1 min-w-[160px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white"
                          />
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="number"
                              min={0}
                              max={999}
                              aria-label="Phase minutes"
                              value={mins}
                              onChange={(e) => {
                                const nextM = Math.max(0, parseInt(e.target.value, 10) || 0);
                                updateTimerStage(stage.id, {
                                  durationSeconds: Math.max(5, nextM * 60 + secs),
                                });
                              }}
                              className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-center font-black text-amber-300 font-mono-tabular"
                            />
                            <span className="text-slate-400">m</span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              aria-label="Phase seconds"
                              value={secs}
                              onChange={(e) => {
                                const nextS = Math.max(
                                  0,
                                  Math.min(59, parseInt(e.target.value, 10) || 0)
                                );
                                updateTimerStage(stage.id, {
                                  durationSeconds: Math.max(5, mins * 60 + nextS),
                                });
                              }}
                              className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-center font-black text-amber-300 font-mono-tabular"
                            />
                            <span className="text-slate-400">s</span>
                          </div>
                          {draft.timerStages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTimerStage(stage.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                              aria-label={`Remove phase ${stage.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={stage.instructions}
                          onChange={(e) =>
                            updateTimerStage(stage.id, { instructions: e.target.value })
                          }
                          placeholder="Student instructions displayed on projector during this phase..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-black text-xs rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
