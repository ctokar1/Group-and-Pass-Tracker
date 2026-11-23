import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Lock,
  Palette,
  RotateCcw,
  Settings,
  Sliders,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  DEFAULT_APP_SETTINGS,
  THEME_OPTIONS,
  type ActiveTab,
  type AppSettings,
  type ThemeId,
} from '../types/classroom';

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
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
  sectionsCount,
  onPreviewTheme,
  onSave,
  onApplyGroupingToAllSections,
  onClose,
}) => {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleCancel}
    >
      <form
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-white">
                Classroom Settings &amp; Color Themes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize color themes, default starting tab, pass limits, projector timer, and grouping defaults. Syncs across devices.
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 1. Color Themes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                Color Theme
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Live preview · Applies to Projector &amp; Pop-Out Window
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

          {/* 2. Default Hall Pass & App Preferences */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Default Classroom Settings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Default Starting Tab */}
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

              {/* Default Quarter Pass Allowance */}
              <div className="space-y-1.5">
                <label
                  htmlFor="setting-max-passes"
                  className="text-xs font-bold text-slate-300 block"
                >
                  Default Quarter Passes Per Student
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

              {/* Long-Out Alert Threshold */}
              <div className="space-y-1.5">
                <label
                  htmlFor="setting-alert-mins"
                  className="text-xs font-bold text-slate-300 block"
                >
                  Long Restroom Trip Alert (Minutes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="setting-alert-mins"
                    type="number"
                    min={1}
                    max={60}
                    value={draft.longPassAlertMinutes}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 7));
                      setDraft((p) => ({ ...p, longPassAlertMinutes: val }));
                    }}
                    className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-amber-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-[11px] text-slate-400">
                    min before warning red
                  </span>
                </div>
              </div>

              {/* Default Projector Timer + Sound */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Default Projector Timer &amp; Sound
                </span>
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
            </div>
          </div>

          {/* 3. Default Group Rules for New / All Periods */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-white">
                  Default Grouping Rules
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Used automatically when creating new periods, or apply to all {sectionsCount} existing periods at once.
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
