import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  FileText,
  History,
  IdCard,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  XSquare,
} from 'lucide-react';
import {
  LIMITS,
  MAX_QUARTER_PASSES,
  type AttendanceStatus,
  type ClassSectionDoc,
  type StudentDoc,
} from '../types/classroom';
import { parseSmartRosterInput } from '../lib/bellSchedule';

interface ClassRosterTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  maxPasses?: number;
  onAddStudent: (name: string, badgeCode?: string) => Promise<void>;
  onBulkImport: (entries: Array<{ name: string; badgeCode?: string }>) => Promise<void>;
  onSetAttendanceStatus: (studentId: string, status: AttendanceStatus) => Promise<void>;
  onDropTardyIntoSeat: (studentId: string) => Promise<void>;
  onUpdateBadgeCode: (studentId: string, badgeCode: string) => Promise<void>;
  onMarkAllAttendance: (present: boolean) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  onOpenStudentHistory: (student: StudentDoc) => void;
}

export const ClassRosterTab: React.FC<ClassRosterTabProps> = ({
  section,
  students,
  maxPasses = MAX_QUARTER_PASSES,
  onAddStudent,
  onBulkImport,
  onSetAttendanceStatus,
  onDropTardyIntoSeat,
  onUpdateBadgeCode,
  onMarkAllAttendance,
  onDeleteStudent,
  onOpenStudentHistory,
}) => {
  const [newStudentName, setNewStudentName] = useState('');
  const [newBadgeCode, setNewBadgeCode] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeDraft, setBadgeDraft] = useState('');

  const parsedCandidates = useMemo(
    () => (bulkText.trim() ? parseSmartRosterInput(bulkText, students) : []),
    [bulkText, students]
  );
  const readyCandidates = useMemo(
    () => parsedCandidates.filter((c) => !c.isDuplicate),
    [parsedCandidates]
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newStudentName.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAddStudent(trimmed, newBadgeCode.trim());
      setNewStudentName('');
      setNewBadgeCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    if (readyCandidates.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onBulkImport(
        readyCandidates.map((c) => ({ name: c.name, badgeCode: c.badgeCode }))
      );
      setBulkText('');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const presentCount = students.filter((s) => s.present).length;
  const groups = section?.groups || [];
  const seatedIds = useMemo(
    () => new Set(groups.flatMap((g) => g.studentIds)),
    [groups]
  );

  const getStatus = (st: StudentDoc): AttendanceStatus => {
    if (st.attendanceStatus === 'tardy') return 'tardy';
    if (st.attendanceStatus === 'absent' || !st.present) return 'absent';
    return 'present';
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Column: Add & Smart SIS Roster Paste */}
      <div className="space-y-6 md:col-span-1">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-extrabold text-base text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" />
            Add Student to Roster
          </h2>
          <form onSubmit={handleAddSubmit} className="space-y-2.5">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              maxLength={LIMITS.STUDENT_NAME_MAX}
              placeholder="First Last Name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <input
              type="text"
              value={newBadgeCode}
              onChange={(e) => setNewBadgeCode(e.target.value)}
              maxLength={LIMITS.BADGE_CODE_MAX}
              placeholder="Optional Badge / Student ID #"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono-tabular text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={submitting || !newStudentName.trim()}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-extrabold text-sm rounded-xl transition-all cursor-pointer"
            >
              Add Student
            </button>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-extrabold text-base text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Smart SIS Roster Paste
            </h2>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
              Auto-Clean
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Paste raw rows straight from your SIS (<span className="text-slate-200">Last, First</span>, row numbers, emails, or badge IDs). Duplicates are filtered automatically.
          </p>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'1. Carter, Jordan  884210\n2. Smith, Taylor\nMorgan Vance'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono-tabular text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />

          {parsedCandidates.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-emerald-400">
                  {readyCandidates.length} ready to import
                </span>
                {parsedCandidates.length - readyCandidates.length > 0 && (
                  <span className="text-rose-400">
                    {parsedCandidates.length - readyCandidates.length} duplicate skipped
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {parsedCandidates.map((cand, idx) => (
                  <div
                    key={`${cand.name}_${idx}`}
                    className={`flex items-center justify-between text-xs px-2 py-1 rounded-lg ${
                      cand.isDuplicate
                        ? 'bg-rose-950/30 text-slate-500 line-through'
                        : 'bg-slate-900 text-slate-200'
                    }`}
                  >
                    <span className="font-semibold truncate">{cand.name}</span>
                    {cand.badgeCode && (
                      <span className="text-[10px] font-mono-tabular text-amber-300 shrink-0 ml-2">
                        ID: {cand.badgeCode}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleBulkSubmit}
            disabled={submitting || readyCandidates.length === 0}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Import {readyCandidates.length > 0 ? `${readyCandidates.length} Cleaned Students` : 'Roster List'}
          </button>
        </div>
      </div>

      {/* Right Column: Roster List */}
      <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-extrabold text-lg text-white">
              Active Roster{' '}
              <span className="text-xs font-semibold text-slate-400 ml-2 tabular-nums">
                {presentCount} / {students.length} Present
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Set Present, Tardy, or Absent. Tardy students can drop right into an open seat without reshuffling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMarkAllAttendance(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-extrabold rounded-lg border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Mark All Present
            </button>
            <button
              type="button"
              onClick={() => onMarkAllAttendance(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-extrabold rounded-lg border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <XSquare className="w-3.5 h-3.5" />
              Mark All Absent
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/60 flex-1 overflow-y-auto max-h-[560px] pr-2">
          {sortedStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold text-xs">
              No students in this period yet. Add or paste students on the left.
            </div>
          ) : (
            sortedStudents.map((st) => {
              const status = getStatus(st);
              const needsSeat = groups.length > 0 && st.present && !seatedIds.has(st.id);
              const isEditingBadge = editingBadgeId === st.id;

              return (
                <div
                  key={st.id}
                  className="py-3 px-2 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-950/60 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                    {/* 3-State Attendance Pill Toggle */}
                    <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] shrink-0">
                      <button
                        type="button"
                        onClick={() => void onSetAttendanceStatus(st.id, 'present')}
                        className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                          status === 'present'
                            ? 'bg-emerald-500 text-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSetAttendanceStatus(st.id, 'tardy')}
                        className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                          status === 'tardy'
                            ? 'bg-amber-400 text-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Tardy
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSetAttendanceStatus(st.id, 'absent')}
                        className={`px-2 py-1 rounded-md font-bold cursor-pointer transition-colors ${
                          status === 'absent'
                            ? 'bg-rose-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Absent
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span
                        className={`font-bold text-sm truncate block ${
                          status === 'absent'
                            ? 'text-slate-500 line-through'
                            : status === 'tardy'
                            ? 'text-amber-300'
                            : 'text-white'
                        }`}
                      >
                        {st.name}
                      </span>

                      {isEditingBadge ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void onUpdateBadgeCode(st.id, badgeDraft.trim()).then(() =>
                              setEditingBadgeId(null)
                            );
                          }}
                          className="flex items-center gap-1 mt-1"
                        >
                          <input
                            type="text"
                            value={badgeDraft}
                            onChange={(e) => setBadgeDraft(e.target.value)}
                            maxLength={LIMITS.BADGE_CODE_MAX}
                            placeholder="Badge / ID #"
                            autoFocus
                            className="w-28 bg-slate-950 border border-amber-400/70 rounded px-2 py-0.5 text-[11px] font-mono-tabular text-white focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-2 py-0.5 bg-amber-400 text-black font-black text-[10px] rounded cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBadgeId(null)}
                            className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBadgeId(st.id);
                            setBadgeDraft(st.badgeCode || '');
                          }}
                          className="text-[11px] text-slate-400 hover:text-amber-300 font-mono-tabular inline-flex items-center gap-1 cursor-pointer"
                          title="Set or edit Kiosk student ID / badge code"
                        >
                          <IdCard className="w-3 h-3" />
                          {st.badgeCode ? `ID: ${st.badgeCode}` : 'Set Badge ID'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {needsSeat && (
                      <button
                        type="button"
                        onClick={() => void onDropTardyIntoSeat(st.id)}
                        className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        title="Drop late arrival directly into an open table seat without reshuffling"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Seat Now
                      </button>
                    )}
                    <span className="text-xs font-mono-tabular text-slate-400">
                      {Math.max(0, maxPasses - st.passesUsed)}/{maxPasses} passes
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenStudentHistory(st)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                      title={`View pass history for ${st.name}`}
                      aria-label={`View pass history for ${st.name}`}
                    >
                      <History className="w-3.5 h-3.5" />
                      History
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteStudent(st.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title={`Delete ${st.name}`}
                      aria-label={`Delete ${st.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
