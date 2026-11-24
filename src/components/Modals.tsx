import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Lock, Shuffle, X } from 'lucide-react';
import {
  COLOR_DEFINITIONS,
  LIMITS,
  type ClassSectionDoc,
  type StudentDoc,
} from '../types/classroom';
import { formatRuleSummary } from '../lib/grouping';

/* 1. Spotlight Modal */
interface SpotlightModalProps {
  open: boolean;
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  onWinnerPicked: (winner: { studentName: string; groupName: string }) => void;
  onNotifyError: (msg: string) => void;
  onClose: () => void;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  open,
  section,
  students,
  onWinnerPicked,
  onNotifyError,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState('Ready?');
  const [displayGroup, setDisplayGroup] = useState('Click Pick Random Student below');
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (!open) {
      setDisplayName('Ready?');
      setDisplayGroup('Click Pick Random Student below');
      setIsSpinning(false);
    }
  }, [open]);

  if (!open) return null;

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const assigned: Array<{ studentName: string; groupName: string }> = [];
  (section?.groups || []).forEach((g) => {
    g.studentIds.forEach((sid) => {
      const st = studentMap.get(sid);
      if (st) {
        assigned.push({ studentName: st.name, groupName: g.name });
      }
    });
  });

  const handlePick = () => {
    if (assigned.length === 0) {
      onNotifyError('Generate groups first before picking a student!');
      return;
    }
    if (isSpinning) return;
    setIsSpinning(true);
    let count = 0;
    const interval = window.setInterval(() => {
      const rand = assigned[Math.floor(Math.random() * assigned.length)];
      setDisplayName(rand.studentName);
      setDisplayGroup(`Station: ${rand.groupName}`);
      count++;
      if (count >= 20) {
        window.clearInterval(interval);
        const winner = assigned[Math.floor(Math.random() * assigned.length)];
        setDisplayName(winner.studentName);
        setDisplayGroup(`🏆 Winner from ${winner.groupName}!`);
        setIsSpinning(false);
        onWinnerPicked(winner);
      }
    }, 80);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/50 rounded-3xl max-w-lg w-full p-6 space-y-6 text-center">
        <div className="w-16 h-16 bg-amber-400 text-black rounded-2xl mx-auto flex items-center justify-center text-3xl font-black">
          🎯
        </div>
        <div>
          <h3 className="font-black text-2xl text-white">Tiger Student Spotlight</h3>
          <p className="text-xs text-slate-400 mt-1">
            Randomly selecting a student from active color groups.
          </p>
        </div>

        <div className="bg-slate-950 border-2 border-amber-400/80 rounded-2xl py-8 px-4">
          <span className="font-black text-3xl sm:text-4xl text-amber-300 block tracking-tight">
            {displayName}
          </span>
          <span className="text-sm font-bold text-slate-400 block mt-2">{displayGroup}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePick}
            disabled={isSpinning}
            className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-black font-black text-base rounded-xl transition-all cursor-pointer"
          >
            🎲 Pick Random Student
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* 2. Projector Quick Group Rules Modal */
interface ProjectorRulesModalProps {
  open: boolean;
  section: ClassSectionDoc | undefined;
  autoRotateRoles?: boolean;
  onSelectQuickSize: (size: number) => void;
  onSelectQuickCount: (count: number) => void;
  onToggleForceCount: (forced: boolean) => void;
  onToggleAutoRotateRoles?: (enabled: boolean) => void;
  onReshuffleAndClose: () => void;
  onClose: () => void;
}

export const ProjectorRulesModal: React.FC<ProjectorRulesModalProps> = ({
  open,
  section,
  autoRotateRoles = false,
  onSelectQuickSize,
  onSelectQuickCount,
  onToggleForceCount,
  onToggleAutoRotateRoles,
  onReshuffleAndClose,
  onClose,
}) => {
  if (!open) return null;
  const qSize = section?.quickSize ?? 4;
  const qCount = section?.quickCount ?? 0;
  const forceExact = Boolean(section?.forceExactCount);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-black text-xl text-white flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-amber-400" />
              Quick Group Rules (Presentation View)
            </h3>
            <p className="text-xs text-amber-400 font-extrabold mt-1">
              Active Rule: {formatRuleSummary(section)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-extrabold text-amber-300 block">Quick Student Group Size</span>
            <div className="grid grid-cols-5 gap-2">
              {[
                { v: 2, l: 'Pairs (2)' },
                { v: 3, l: 'Trios (3)' },
                { v: 4, l: 'Group of 4' },
                { v: 5, l: 'Group of 5' },
                { v: 6, l: 'Group of 6' },
              ].map((item) => (
                <button
                  key={item.v}
                  onClick={() => onSelectQuickSize(item.v)}
                  className={`py-2 text-xs rounded-xl border transition-all cursor-pointer ${
                    qSize === item.v
                      ? 'bg-amber-400 text-black font-black border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-white font-bold border-slate-700'
                  }`}
                >
                  {item.l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-extrabold text-amber-300 block">Quick Total Group Count</span>
            <div className="grid grid-cols-6 gap-2">
              {[2, 3, 4, 5, 6, 8].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => onSelectQuickCount(cnt)}
                  className={`py-2 text-xs rounded-xl border transition-all cursor-pointer ${
                    qCount === cnt
                      ? 'bg-amber-400 text-black font-black border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-white font-bold border-slate-700'
                  }`}
                >
                  {cnt} Groups
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={forceExact}
              onChange={(e) => onToggleForceCount(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
            />
            <span className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Force Exact Group Count (Strictly cap tables to selected group count)
            </span>
          </label>

          {onToggleAutoRotateRoles && (
            <label className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRotateRoles}
                onChange={(e) => onToggleAutoRotateRoles(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
              />
              <span className="text-xs font-extrabold text-slate-200">
                Assign Classroom Roles on Shuffle (Facilitator, Recorder, Timekeeper…)
              </span>
            </label>
          )}
        </div>

        <button
          onClick={onReshuffleAndClose}
          className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl transition-all cursor-pointer"
        >
          🎲 Reshuffle & Group Now!
        </button>
      </div>
    </div>
  );
};

/* 3. Add Section Modal */
interface AddSectionModalProps {
  open: boolean;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

export const AddSectionModal: React.FC<AddSectionModalProps> = ({ open, onCreate, onClose }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onCreate(trimmed);
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4"
      >
        <h3 className="font-black text-lg text-white">Create New Class Section</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.SECTION_NAME_MAX}
          placeholder="e.g. Period 4 - Algebra II"
          autoFocus
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl cursor-pointer"
          >
            Create Section
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

/* 4. Quick Move Modal */
interface QuickMoveModalProps {
  target: { studentId: string; currentGroupId: string } | null;
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  onExecuteMove: (toGroupId: string) => void;
  onClose: () => void;
}

export const QuickMoveModal: React.FC<QuickMoveModalProps> = ({
  target,
  section,
  students,
  onExecuteMove,
  onClose,
}) => {
  if (!target || !section) return null;
  const student = students.find((s) => s.id === target.studentId);
  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-black text-lg text-white flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-amber-400" />
          Move Student to Group
        </h3>
        <p className="text-sm font-bold text-amber-300">Student: {student.name}</p>
        <div className="grid grid-cols-2 gap-2">
          {section.groups
            .filter((g) => g.id !== target.currentGroupId)
            .map((g, idx) => {
              const colorDef = COLOR_DEFINITIONS[g.colorIndex % COLOR_DEFINITIONS.length] || COLOR_DEFINITIONS[idx % COLOR_DEFINITIONS.length];
              return (
                <button
                  key={g.id}
                  onClick={() => onExecuteMove(g.id)}
                  className="p-3 bg-slate-950 border border-slate-800 hover:border-amber-400 rounded-xl text-xs font-extrabold text-white text-left flex items-center justify-between cursor-pointer"
                >
                  <span>{g.name}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${colorDef.color}`} />
                </button>
              );
            })}
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/* 5. Reset Quarter Passes Modal */
interface ResetPassesModalProps {
  open: boolean;
  sectionName: string;
  maxPasses?: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export const ResetPassesModal: React.FC<ResetPassesModalProps> = ({
  open,
  sectionName,
  maxPasses = 4,
  onConfirm,
  onClose,
}) => {
  const [resetting, setResetting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 text-center">
        <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black">
          🚨
        </div>
        <h3 className="font-black text-xl text-white">Reset Passes for Quarter?</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          This will reset all bathroom pass balances back to{' '}
          <strong className="text-amber-300">{maxPasses} / {maxPasses}</strong> for{' '}
          <span className="font-extrabold text-white">{sectionName}</span>. This action cannot be undone.
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleConfirm}
            disabled={resetting}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl cursor-pointer"
          >
            Confirm Quarter Reset
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
