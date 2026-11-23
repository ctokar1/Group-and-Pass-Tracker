import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Download,
  HeartHandshake,
  Lock,
  School,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { LIMITS, type ClassSectionDoc, type StudentDoc } from '../types/classroom';
import { makePairKey, parsePairKey } from '../lib/grouping';

interface GroupRulesTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  sectionsCount: number;
  autoRotateRoles: boolean;
  avoidRecentPairs: boolean;
  onSelectQuickSize: (size: number) => void;
  onSelectQuickCount: (count: number) => void;
  onToggleForceCount: (forced: boolean) => void;
  onToggleAutoRotateRoles: (enabled: boolean) => void;
  onToggleAvoidRecentPairs: (enabled: boolean) => void;
  onUpdatePairRules: (patch: {
    keepApartPairs?: string[];
    pairTogetherPairs?: string[];
    recentPairKeys?: string[];
  }) => Promise<void>;
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
  students,
  sectionsCount,
  autoRotateRoles,
  avoidRecentPairs,
  onSelectQuickSize,
  onSelectQuickCount,
  onToggleForceCount,
  onToggleAutoRotateRoles,
  onToggleAvoidRecentPairs,
  onUpdatePairRules,
  onGenerateGroups,
  onRenameSection,
  onDeleteSection,
  onExportBackup,
  onImportBackup,
}) => {
  const [renameValue, setRenameValue] = useState('');
  const [studentAId, setStudentAId] = useState('');
  const [studentBId, setStudentBId] = useState('');

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  useEffect(() => {
    if (sortedStudents.length >= 2) {
      if (!studentAId || !studentMap.has(studentAId)) {
        setStudentAId(sortedStudents[0].id);
      }
      if (!studentBId || !studentMap.has(studentBId)) {
        setStudentBId(sortedStudents[1].id);
      }
    }
  }, [sortedStudents, studentAId, studentBId, studentMap]);

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

  const keepApartPairs = section?.keepApartPairs || [];
  const pairTogetherPairs = section?.pairTogetherPairs || [];
  const recentPairCount = section?.recentPairKeys?.length || 0;

  const handleAddRule = async (type: 'apart' | 'together') => {
    if (!studentAId || !studentBId || studentAId === studentBId) return;
    const key = makePairKey(studentAId, studentBId);
    if (type === 'apart') {
      if (keepApartPairs.includes(key)) return;
      await onUpdatePairRules({
        keepApartPairs: [...keepApartPairs, key],
        pairTogetherPairs: pairTogetherPairs.filter((k) => k !== key),
      });
    } else {
      if (pairTogetherPairs.includes(key)) return;
      await onUpdatePairRules({
        pairTogetherPairs: [...pairTogetherPairs, key],
        keepApartPairs: keepApartPairs.filter((k) => k !== key),
      });
    }
  };

  const describePair = (pairKey: string): string => {
    const parsed = parsePairKey(pairKey);
    if (!parsed) return pairKey;
    const nameA = studentMap.get(parsed[0])?.name || 'Former Student';
    const nameB = studentMap.get(parsed[1])?.name || 'Former Student';
    return `${nameA} & ${nameB}`;
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
            Group Rules &amp; Presets
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

        {/* Toggles & Generate */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div className="space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={forceExact}
                onChange={(e) => onToggleForceCount(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                Force Exact Group Count (Strictly cap tables to selected group count)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRotateRoles}
                onChange={(e) => onToggleAutoRotateRoles(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                Auto-Assign Rotating Classroom Roles on Shuffle (Facilitator, Recorder, Timekeeper…)
              </span>
            </label>
          </div>

          <button
            onClick={onGenerateGroups}
            className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            Generate Color Groups
          </button>
        </div>
      </div>

      {/* Pairing Constraints & Smart Memory Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-black text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Pairing Memory &amp; Persistent Constraints
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Prevent back-to-back repeat partners and enforce permanent &ldquo;Keep Apart&rdquo; or &ldquo;Pair Together&rdquo; rules on every shuffle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={avoidRecentPairs}
                onChange={(e) => onToggleAvoidRecentPairs(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">
                Avoid Back-to-Back Repeat Pairs ({recentPairCount} remembered)
              </span>
            </label>
            {recentPairCount > 0 && (
              <button
                type="button"
                onClick={() => void onUpdatePairRules({ recentPairKeys: [] })}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
              >
                Clear Memory
              </button>
            )}
          </div>
        </div>

        {/* Rule Builder Row */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <select
            value={studentAId}
            onChange={(e) => setStudentAId(e.target.value)}
            aria-label="First student for pairing rule"
            disabled={sortedStudents.length < 2}
            className="flex-1 min-w-[160px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {sortedStudents.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <span className="text-xs font-black text-slate-500">&amp;</span>

          <select
            value={studentBId}
            onChange={(e) => setStudentBId(e.target.value)}
            aria-label="Second student for pairing rule"
            disabled={sortedStudents.length < 2}
            className="flex-1 min-w-[160px] bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {sortedStudents.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!studentAId || !studentBId || studentAId === studentBId}
              onClick={() => void handleAddRule('apart')}
              className="px-3.5 py-2 bg-rose-950/70 hover:bg-rose-900 disabled:opacity-40 text-rose-300 font-extrabold text-xs rounded-xl border border-rose-700/50 flex items-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              Keep Apart
            </button>
            <button
              type="button"
              disabled={!studentAId || !studentBId || studentAId === studentBId}
              onClick={() => void handleAddRule('together')}
              className="px-3.5 py-2 bg-emerald-950/70 hover:bg-emerald-900 disabled:opacity-40 text-emerald-300 font-extrabold text-xs rounded-xl border border-emerald-700/50 flex items-center gap-1.5 cursor-pointer"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              Pair Together
            </button>
          </div>
        </div>

        {/* Active Constraints Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-black text-rose-300 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              Keep Apart Rules ({keepApartPairs.length})
            </h3>
            {keepApartPairs.length === 0 ? (
              <p className="text-xs text-slate-500">No separation rules set for this period.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {keepApartPairs.map((pairKey) => (
                  <span
                    key={pairKey}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/60 border border-rose-700/50 rounded-lg text-xs font-bold text-rose-200"
                  >
                    <span>{describePair(pairKey)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdatePairRules({
                          keepApartPairs: keepApartPairs.filter((k) => k !== pairKey),
                        })
                      }
                      className="text-rose-400 hover:text-white cursor-pointer"
                      aria-label={`Remove keep apart rule ${describePair(pairKey)}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5" />
              Pair Together Rules ({pairTogetherPairs.length})
            </h3>
            {pairTogetherPairs.length === 0 ? (
              <p className="text-xs text-slate-500">No buddy pairing rules set for this period.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pairTogetherPairs.map((pairKey) => (
                  <span
                    key={pairKey}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-700/50 rounded-lg text-xs font-bold text-emerald-200"
                  >
                    <span>{describePair(pairKey)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        void onUpdatePairRules({
                          pairTogetherPairs: pairTogetherPairs.filter((k) => k !== pairKey),
                        })
                      }
                      className="text-emerald-400 hover:text-white cursor-pointer"
                      aria-label={`Remove pair together rule ${describePair(pairKey)}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
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
            Cloud Backup Export &amp; Restore
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
