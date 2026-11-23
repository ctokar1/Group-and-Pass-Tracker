import React, { useState } from 'react';
import {
  Download,
  Lock,
  School,
  Shuffle,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import { LIMITS, type ClassSectionDoc } from '../types/classroom';

interface GroupRulesTabProps {
  section: ClassSectionDoc | undefined;
  sectionsCount: number;
  onSelectQuickSize: (size: number) => void;
  onSelectQuickCount: (count: number) => void;
  onToggleForceCount: (forced: boolean) => void;
  onGenerateGroups: () => void;
  onRenameSection: (newName: string) => Promise<void>;
  onDeleteSection: () => Promise<void>;
  onExportBackup: () => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
}

const SIZE_PRESETS = [
  { value: 2, label: 'Pairs (2)' },
  { value: 3, label: 'Trios (3)' },
  { value: 4, label: 'Group of 4' },
  { value: 5, label: 'Group of 5' },
  { value: 6, label: 'Group of 6' },
];

const COUNT_PRESETS = [2, 3, 4, 5, 6, 8];

export const GroupRulesTab: React.FC<GroupRulesTabProps> = ({
  section,
  sectionsCount,
  onSelectQuickSize,
  onSelectQuickCount,
  onToggleForceCount,
  onGenerateGroups,
  onRenameSection,
  onDeleteSection,
  onExportBackup,
  onImportBackup,
}) => {
  const [renameValue, setRenameValue] = useState('');

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    await onRenameSection(trimmed);
    setRenameValue('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onImportBackup(file);
    e.target.value = '';
  };

  const qSize = section?.quickSize ?? 4;
  const qCount = section?.quickCount ?? 0;
  const forceExact = Boolean(section?.forceExactCount);

  return (
    <section className="space-y-6">
      {/* Quick Grouping Presets Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="font-black text-xl text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Group Rules & Presets
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose your group size and total group count. Select both at the same time to enforce group size inside exact station counts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Size Presets */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-extrabold tracking-wide text-amber-300 block">
              Quick Student Group Size
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {SIZE_PRESETS.map((preset) => {
                const active = qSize === preset.value;
                return (
                  <button
                    key={preset.value}
                    onClick={() => onSelectQuickSize(preset.value)}
                    className={`py-2.5 px-2.5 text-xs rounded-xl border transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-black font-black border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-white font-bold border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Count Presets */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-extrabold tracking-wide text-amber-300 block">
              Quick Total Group Count
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {COUNT_PRESETS.map((count) => {
                const active = qCount === count;
                return (
                  <button
                    key={count}
                    onClick={() => onSelectQuickCount(count)}
                    className={`py-2.5 px-2 text-xs rounded-xl border transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-black font-black border-amber-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-white font-bold border-slate-700'
                    }`}
                  >
                    {count} Groups
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Toggle & Generate */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={forceExact}
              onChange={(e) => onToggleForceCount(e.target.checked)}
              className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              Force Exact Group Count (Strictly cap tables to selected group count)
            </span>
          </label>

          <button
            onClick={onGenerateGroups}
            className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Generate Color Groups
          </button>
        </div>
      </div>

      {/* Section & Data Management Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-extrabold text-base text-white flex items-center gap-2">
            <School className="w-4 h-4 text-amber-400" />
            Section Period Management
          </h2>
          <div className="space-y-3">
            <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={LIMITS.SECTION_NAME_MAX}
                placeholder={section ? `Rename "${section.name}"...` : 'Section Name...'}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                disabled={!renameValue.trim()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 whitespace-nowrap cursor-pointer"
              >
                Rename
              </button>
            </form>
            <button
              onClick={onDeleteSection}
              disabled={sectionsCount <= 1}
              className="w-full py-2.5 bg-rose-950/50 hover:bg-rose-900/60 disabled:opacity-40 text-rose-300 font-bold text-xs rounded-xl border border-rose-800/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Current Section
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-extrabold text-base text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-400" />
            Cloud Backup Export & Restore
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Rosters and hall passes sync live between <span className="text-amber-300">c_tokar@chuh.org</span> and{' '}
            <span className="text-amber-300">J_kravitz@chuh.org</span>. Export or restore a JSON snapshot anytime.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onExportBackup}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Backup
            </button>
            <label className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Restore Backup
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
};
