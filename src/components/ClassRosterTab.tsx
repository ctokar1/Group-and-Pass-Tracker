import React, { useState } from 'react';
import { CheckSquare, FileText, History, Trash2, UserPlus, XSquare } from 'lucide-react';
import { LIMITS, type StudentDoc } from '../types/classroom';

interface ClassRosterTabProps {
  students: StudentDoc[];
  onAddStudent: (name: string) => Promise<void>;
  onBulkImport: (names: string[]) => Promise<void>;
  onToggleAttendance: (studentId: string, present: boolean) => Promise<void>;
  onMarkAllAttendance: (present: boolean) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  onOpenStudentHistory: (student: StudentDoc) => void;
}

export const ClassRosterTab: React.FC<ClassRosterTabProps> = ({
  students,
  onAddStudent,
  onBulkImport,
  onToggleAttendance,
  onMarkAllAttendance,
  onDeleteStudent,
  onOpenStudentHistory,
}) => {
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newStudentName.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAddStudent(trimmed);
      setNewStudentName('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    const names = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (names.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onBulkImport(names);
      setBulkText('');
    } finally {
      setSubmitting(false);
    }
  };

  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const presentCount = students.filter((s) => s.present).length;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left Column: Add & Bulk Import */}
      <div className="space-y-6 md:col-span-1">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-extrabold text-base text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" />
            Add Student to Roster
          </h2>
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              maxLength={LIMITS.STUDENT_NAME_MAX}
              placeholder="First Last Name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
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
          <h2 className="font-extrabold text-base text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            Bulk Import Roster
          </h2>
          <p className="text-xs text-slate-400 font-medium">Paste student names (one per line):</p>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'Jordan Carter\nTaylor Smith\nMorgan Vance\nRiley Davis'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono-tabular text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={handleBulkSubmit}
            disabled={submitting || !bulkText.trim()}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            Import Roster List
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
              Check or uncheck students to mark present or absent.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onMarkAllAttendance(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-extrabold rounded-lg border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Mark All Present
            </button>
            <button
              onClick={() => onMarkAllAttendance(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs font-extrabold rounded-lg border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <XSquare className="w-3.5 h-3.5" />
              Mark All Absent
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/60 flex-1 overflow-y-auto max-h-[520px] pr-2">
          {sortedStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold text-xs">
              No students in this period yet. Add or bulk import students on the left.
            </div>
          ) : (
            sortedStudents.map((st) => (
              <div
                key={st.id}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-950/60 rounded-xl transition-colors"
              >
                <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={st.present}
                    onChange={(e) => onToggleAttendance(st.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-400 focus:ring-amber-400 cursor-pointer"
                  />
                  <span
                    className={`font-bold text-sm truncate ${
                      st.present ? 'text-white' : 'text-slate-500 line-through'
                    }`}
                  >
                    {st.name}
                  </span>
                </label>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-xs font-mono-tabular text-slate-400">
                    {st.passesUsed}/{LIMITS.MAX_PASSES} passes
                  </span>
                  <button
                    onClick={() => onOpenStudentHistory(st)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                    title={`View pass history for ${st.name}`}
                    aria-label={`View pass history for ${st.name}`}
                  >
                    <History className="w-3.5 h-3.5" />
                    History
                  </button>
                  <button
                    onClick={() => onDeleteStudent(st.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title={`Delete ${st.name}`}
                    aria-label={`Delete ${st.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
