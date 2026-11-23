import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListOrdered,
  Plus,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  LIMITS,
  MAX_QUARTER_PASSES,
  type ClassSectionDoc,
  type StudentDoc,
} from '../types/classroom';
import { formatDurationExact } from './StudentHistoryModal';

interface PassMonitorBoardProps {
  section: ClassSectionDoc | undefined;
  sections?: ClassSectionDoc[];
  students: StudentDoc[];
  standalone?: boolean;
  onSwitchSection?: (sectionId: string) => void;
  onAddToQueue: (studentId: string) => Promise<void>;
  onRemoveFromQueue: (studentId: string) => Promise<void>;
  onMoveQueueUp: (studentId: string) => Promise<void>;
  onClearQueue: () => Promise<void>;
  onIssuePass: (student: StudentDoc) => Promise<void>;
  onReturnStudent: (student: StudentDoc) => Promise<void>;
  onClose?: () => void;
  standaloneUrl?: string;
}

export const PassMonitorBoard: React.FC<PassMonitorBoardProps> = ({
  section,
  sections,
  students,
  standalone = false,
  onSwitchSection,
  onAddToQueue,
  onRemoveFromQueue,
  onMoveQueueUp,
  onClearQueue,
  onIssuePass,
  onReturnStudent,
  onClose,
  standaloneUrl,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  const currentlyOut = useMemo(
    () =>
      students
        .filter((s) => s.outTimestamp > 0)
        .sort((a, b) => a.outTimestamp - b.outTimestamp),
    [students]
  );
  const activeOutStudent = currentlyOut[0] || null;

  const rawQueue = section?.passQueue || [];
  const queuedStudents = useMemo(
    () =>
      rawQueue
        .map((id) => studentMap.get(id))
        .filter((st): st is StudentDoc => Boolean(st && st.outTimestamp <= 0)),
    [rawQueue, studentMap]
  );

  const queuedIdSet = useMemo(
    () => new Set(queuedStudents.map((s) => s.id)),
    [queuedStudents]
  );

  const eligibleToQueue = useMemo(
    () =>
      [...students]
        .filter(
          (st) =>
            st.outTimestamp <= 0 &&
            !queuedIdSet.has(st.id) &&
            st.passesUsed < LIMITS.MAX_PASSES
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [students, queuedIdSet]
  );

  useEffect(() => {
    if (
      selectedStudentId &&
      !eligibleToQueue.some((st) => st.id === selectedStudentId)
    ) {
      setSelectedStudentId('');
    }
  }, [eligibleToQueue, selectedStudentId]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = selectedStudentId || eligibleToQueue[0]?.id;
    if (!targetId || busy) return;
    setBusy(true);
    try {
      await onAddToQueue(targetId);
      setSelectedStudentId('');
    } finally {
      setBusy(false);
    }
  };

  const outElapsedSeconds = activeOutStudent
    ? Math.max(0, Math.floor((nowMs - activeOutStudent.outTimestamp) / 1000))
    : 0;
  const isOverdue = outElapsedSeconds >= 420;

  return (
    <div
      className={`bg-slate-950 text-slate-100 flex flex-col ${
        standalone ? 'min-h-screen p-4 sm:p-6' : 'h-full p-4'
      } gap-4`}
    >
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl">🚽</span>
          <div className="min-w-0">
            <h2 className="font-black text-base sm:text-lg text-white truncate">
              Restroom Status &amp; Next-Up Line
            </h2>
            <p className="text-xs text-amber-400 font-bold truncate">
              {section?.name || 'Class Period'} · Only 1 student out at a time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {standalone && sections && sections.length > 0 && onSwitchSection && (
            <select
              value={section?.id || ''}
              onChange={(e) => onSwitchSection(e.target.value)}
              aria-label="Select class period"
              className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-extrabold rounded-xl px-2.5 py-1.5 cursor-pointer"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          )}
          {standaloneUrl && !standalone && (
            <a
              href={standaloneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Separate Window
            </a>
          )}
          {standalone && (
            <a
              href={window.location.pathname}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 whitespace-nowrap"
            >
              Full App
            </a>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
              aria-label="Close board"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Live Restroom Availability Hero */}
      {activeOutStudent ? (
        <div
          className={`rounded-2xl p-5 border-2 flex flex-wrap items-center justify-between gap-4 shrink-0 ${
            isOverdue
              ? 'bg-rose-950/45 border-rose-500'
              : 'bg-amber-950/40 border-amber-400'
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOverdue ? 'bg-rose-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isOverdue ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  isOverdue ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                Restroom Currently Occupied · Wait Your Turn
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white truncate">
              {activeOutStudent.name}
            </div>
            <div
              className={`text-sm font-extrabold font-mono-tabular flex items-center gap-1.5 ${
                isOverdue ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              Out for {formatDurationExact(outElapsedSeconds)}
            </div>
          </div>

          <button
            onClick={() => void onReturnStudent(activeOutStudent)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark Returned
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-5 border-2 border-emerald-500/80 bg-emerald-950/30 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              Restroom Available (0 Out)
            </span>
            <div className="text-xl sm:text-2xl font-black text-white">
              {queuedStudents[0]
                ? `Next Up: ${queuedStudents[0].name}`
                : 'No one is currently out'}
            </div>
            <p className="text-xs text-slate-300">
              {queuedStudents[0]
                ? 'Ready for the next student in line to take the pass.'
                : 'Add your name below to join the line or request a pass.'}
            </p>
          </div>

          {queuedStudents[0] && (
            <button
              onClick={() => void onIssuePass(queuedStudents[0])}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              Send Next ({queuedStudents[0].name.split(' ')[0]})
            </button>
          )}
        </div>
      )}

      {/* Add to Line Form */}
      <form
        onSubmit={handleJoinSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shrink-0"
      >
        <label
          htmlFor="pass-monitor-queue-select"
          className="text-xs font-extrabold text-amber-300 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Student to Restroom Line (Who&apos;s Next)
        </label>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <select
            id="pass-monitor-queue-select"
            value={selectedStudentId || (eligibleToQueue[0]?.id ?? '')}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            disabled={eligibleToQueue.length === 0}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
          >
            {eligibleToQueue.length === 0 ? (
              <option value="">No eligible students left to add</option>
            ) : (
              eligibleToQueue.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.passesUsed}/{MAX_QUARTER_PASSES} passes used)
                </option>
              ))
            )}
          </select>
          <button
            type="submit"
            disabled={busy || eligibleToQueue.length === 0}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-black text-sm rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add to Line
          </button>
        </div>
      </form>

      {/* Ordered Waiting Line */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
          <h3 className="font-black text-sm text-white flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-amber-400" />
            Waiting Line ({queuedStudents.length})
          </h3>
          {queuedStudents.length > 0 && (
            <button
              onClick={() => void onClearQueue()}
              className="text-xs font-bold text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              Clear Line
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pt-3 space-y-2">
          {queuedStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-semibold">
              The restroom line is empty. Add a student above to reserve who goes next.
            </div>
          ) : (
            queuedStudents.map((st, idx) => {
              const isNext = idx === 0;
              const isMax = st.passesUsed >= LIMITS.MAX_PASSES;
              return (
                <div
                  key={st.id}
                  className={`rounded-xl px-3.5 py-2.5 border flex items-center justify-between gap-3 ${
                    isNext
                      ? 'bg-amber-950/30 border-amber-400/70'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 font-mono-tabular ${
                        isNext
                          ? 'bg-amber-400 text-black'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-extrabold text-sm text-white block truncate">
                        {st.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono-tabular">
                        {isNext ? 'Up Next · ' : ''}
                        {st.passesUsed}/{MAX_QUARTER_PASSES} passes used
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!activeOutStudent && isNext && !isMax && (
                      <button
                        onClick={() => void onIssuePass(st)}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg cursor-pointer"
                      >
                        Go Now
                      </button>
                    )}
                    {isMax && (
                      <span className="px-2 py-1 bg-rose-950 text-rose-400 text-[11px] font-bold rounded-lg flex items-center gap-1">
                        <Ban className="w-3 h-3" />
                        4/4
                      </span>
                    )}
                    {idx > 0 && (
                      <button
                        onClick={() => void onMoveQueueUp(st.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 rounded-lg cursor-pointer"
                        title={`Move ${st.name} up in line`}
                        aria-label={`Move ${st.name} up in line`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => void onRemoveFromQueue(st.id)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg cursor-pointer"
                      title={`Remove ${st.name} from line`}
                      aria-label={`Remove ${st.name} from line`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
