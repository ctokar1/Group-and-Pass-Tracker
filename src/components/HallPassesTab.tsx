import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUp,
  Ban,
  CheckCircle2,
  Clock,
  History,
  ListOrdered,
  Minus,
  PictureInPicture2,
  Plus,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
} from 'lucide-react';
import {
  LIMITS,
  MAX_QUARTER_PASSES,
  type ClassSectionDoc,
  type PassLogDoc,
  type StudentDoc,
} from '../types/classroom';

import { formatDurationExact } from './PassHistoryTab';

interface HallPassesTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  passLogs: PassLogDoc[];
  onIssuePass: (student: StudentDoc) => Promise<void>;
  onReturnStudent: (student: StudentDoc) => Promise<void>;
  onAdjustPassCount: (student: StudentDoc, delta: number) => Promise<void>;
  onAddToQueue: (studentId: string) => Promise<void>;
  onRemoveFromQueue: (studentId: string) => Promise<void>;
  onMoveQueueUp: (studentId: string) => Promise<void>;
  onClearQueue: () => Promise<void>;
  onOpenPassPopout: () => void;
  onOpenResetModal: () => void;
  onViewFullHistory: () => void;
  onOpenStudentHistory: (student: StudentDoc) => void;
}

function formatLogDateTime(log: PassLogDoc): string {
  const ms =
    log.action === 'issued' && typeof log.takenAt === 'number' && log.takenAt > 0
      ? log.takenAt
      : log.action === 'returned' && typeof log.returnedAt === 'number' && log.returnedAt > 0
      ? log.returnedAt
      : log.createdAt && typeof log.createdAt === 'object' && 'toMillis' in log.createdAt
      ? (log.createdAt as { toMillis: () => number }).toMillis()
      : Date.now();
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const HallPassesTab: React.FC<HallPassesTabProps> = ({
  section,
  students,
  passLogs,
  onIssuePass,
  onReturnStudent,
  onAdjustPassCount,
  onAddToQueue,
  onRemoveFromQueue,
  onMoveQueueUp,
  onClearQueue,
  onOpenPassPopout,
  onOpenResetModal,
  onViewFullHistory,
  onOpenStudentHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [queuePickerId, setQueuePickerId] = useState('');

  // Live ticker every 1 second for accurate time-out counters
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const queryText = searchQuery.trim().toLowerCase();
  const sortedRoster = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );
  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );
  const filteredRoster = sortedRoster.filter((st) =>
    st.name.toLowerCase().includes(queryText)
  );
  const currentlyOut = sortedRoster.filter((st) => st.outTimestamp > 0);
  const someoneOut = currentlyOut.length > 0;

  const queuedStudents = useMemo(
    () =>
      (section?.passQueue || [])
        .map((id) => studentMap.get(id))
        .filter((st): st is StudentDoc => Boolean(st && st.outTimestamp <= 0)),
    [section?.passQueue, studentMap]
  );
  const queuedIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    queuedStudents.forEach((st, idx) => map.set(st.id, idx));
    return map;
  }, [queuedStudents]);

  const eligibleToQueue = useMemo(
    () =>
      sortedRoster.filter(
        (st) =>
          st.outTimestamp <= 0 &&
          !queuedIndexMap.has(st.id) &&
          st.passesUsed < LIMITS.MAX_PASSES
      ),
    [sortedRoster, queuedIndexMap]
  );

  useEffect(() => {
    if (
      queuePickerId &&
      !eligibleToQueue.some((st) => st.id === queuePickerId)
    ) {
      setQueuePickerId('');
    }
  }, [eligibleToQueue, queuePickerId]);

  const visibleLogs = showAllLogs
    ? passLogs
    : passLogs.filter((l) => !section || l.sectionId === section.id);

  return (
    <section className="space-y-6">
      {/* Hall Pass Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-lg text-white flex items-center gap-2">
            <span>🚽</span> Quarter Bathroom Pass Tracker
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Only <strong className="text-amber-300">1 student</strong> allowed out at a time · Students receive {MAX_QUARTER_PASSES} passes per quarter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 w-48"
            />
          </div>
          <button
            onClick={onOpenPassPopout}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
            title="Open pop-out Restroom Status & Line window to drag onto another monitor"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
            Pop Out Restroom Window
          </button>
          <button
            onClick={onOpenResetModal}
            className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All for Quarter
          </button>
        </div>
      </div>

      {/* Currently Out Live Banner */}
      {currentlyOut.length > 0 && (
        <div className="bg-amber-950/35 border-2 border-amber-500/75 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <h3 className="font-black text-sm text-amber-300 tracking-wide">
                Student Currently Out of Room (1 Out Limit Active)
              </h3>
            </div>
            <span className="px-2.5 py-0.5 bg-amber-400 text-black font-black text-xs rounded-lg font-mono-tabular">
              {currentlyOut.length} Out
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {currentlyOut.map((st) => {
              const elapsedSeconds = Math.max(0, Math.floor((nowMs - st.outTimestamp) / 1000));
              const isOverdue = elapsedSeconds >= 420;
              return (
                <div
                  key={st.id}
                  className={`bg-slate-900 border rounded-xl p-3 flex items-center justify-between gap-2 ${
                    isOverdue ? 'border-rose-500/80' : 'border-amber-400/80'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-black text-xs text-white block truncate">{st.name}</span>
                    <span
                      className={`text-[11px] font-bold font-mono-tabular flex items-center gap-1 mt-0.5 ${
                        isOverdue ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      <Clock className="w-3 h-3 shrink-0" />
                      Out {formatDurationExact(elapsedSeconds)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onOpenStudentHistory(st)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 rounded-lg border border-slate-700 cursor-pointer"
                      title={`View pass history for ${st.name}`}
                      aria-label={`View pass history for ${st.name}`}
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onReturnStudent(st)}
                      className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Return
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Who's Next Restroom Queue Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm text-white">
              Restroom Line — Who&apos;s Next ({queuedStudents.length})
            </h3>
            {!someoneOut && queuedStudents[0] && (
              <span className="text-xs font-bold text-emerald-400">
                · Ready for {queuedStudents[0].name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={queuePickerId || (eligibleToQueue[0]?.id ?? '')}
              onChange={(e) => setQueuePickerId(e.target.value)}
              disabled={eligibleToQueue.length === 0}
              aria-label="Select student to add to restroom line"
              className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40"
            >
              {eligibleToQueue.length === 0 ? (
                <option value="">No eligible students left</option>
              ) : (
                eligibleToQueue.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.passesUsed}/{MAX_QUARTER_PASSES})
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => {
                const targetId = queuePickerId || eligibleToQueue[0]?.id;
                if (targetId) {
                  void onAddToQueue(targetId);
                  setQueuePickerId('');
                }
              }}
              disabled={eligibleToQueue.length === 0}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Line
            </button>
            {queuedStudents.length > 0 && (
              <button
                onClick={() => void onClearQueue()}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
              >
                Clear Line
              </button>
            )}
          </div>
        </div>

        {queuedStudents.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {queuedStudents.map((st, idx) => (
              <div
                key={st.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                  idx === 0
                    ? 'bg-amber-950/35 border-amber-400/70'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <span
                  className={`px-1.5 py-0.5 rounded font-black text-[11px] font-mono-tabular ${
                    idx === 0
                      ? 'bg-amber-400 text-black'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  #{idx + 1}
                </span>
                <span className="font-bold text-white">{st.name}</span>
                {!someoneOut && idx === 0 && st.passesUsed < LIMITS.MAX_PASSES && (
                  <button
                    onClick={() => void onIssuePass(st)}
                    className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] rounded-md cursor-pointer"
                  >
                    Send Next
                  </button>
                )}
                {idx > 0 && (
                  <button
                    onClick={() => void onMoveQueueUp(st.id)}
                    className="text-slate-400 hover:text-amber-300 cursor-pointer"
                    title={`Move ${st.name} up`}
                    aria-label={`Move ${st.name} up`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void onRemoveFromQueue(st.id)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  title={`Remove ${st.name} from line`}
                  aria-label={`Remove ${st.name} from line`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alphabetical Pass Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filteredRoster.length === 0 ? (
          <div className="col-span-full py-10 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500 font-bold text-xs">
            No matching students found in {section?.name || 'this period'}.
          </div>
        ) : (
          filteredRoster.map((st) => {
            const isMax = st.passesUsed >= LIMITS.MAX_PASSES;
            const isOut = st.outTimestamp > 0;
            const elapsedSeconds = isOut ? Math.max(0, Math.floor((nowMs - st.outTimestamp) / 1000)) : 0;
            const queueIndex = queuedIndexMap.get(st.id);
            const isInLine = typeof queueIndex === 'number';

            return (
              <div
                key={st.id}
                className={`bg-slate-900 border rounded-xl p-3 flex flex-col justify-between space-y-2.5 transition-colors ${
                  isOut
                    ? 'border-amber-400 bg-amber-950/20'
                    : isMax
                    ? 'border-rose-500/60 bg-rose-950/20'
                    : isInLine
                    ? 'border-sky-500/60 bg-sky-950/15'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Name & +/- Controls */}
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-extrabold text-xs text-white truncate" title={st.name}>
                    {st.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAdjustPassCount(st, -1)}
                      disabled={st.passesUsed <= 0}
                      className="w-5 h-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 rounded flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                      title="Decrease pass count"
                      aria-label={`Decrease pass count for ${st.name}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onAdjustPassCount(st, 1)}
                      disabled={st.passesUsed >= LIMITS.MAX_PASSES}
                      className="w-5 h-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 rounded flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                      title="Increase pass count"
                      aria-label={`Increase pass count for ${st.name}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Ticket Visuals + Counter */}
                <div className="flex items-center justify-between border-t border-b border-slate-800/80 py-1.5 px-0.5">
                  <div className="flex items-center gap-0.5" aria-label={`${st.passesUsed} of ${MAX_QUARTER_PASSES} passes used`}>
                    {Array.from({ length: MAX_QUARTER_PASSES }, (_, idx) => {
                      const used = idx + 1 <= st.passesUsed;
                      return (
                        <span
                          key={idx}
                          className={`text-xs ${used ? 'opacity-100' : 'opacity-25 text-slate-500'}`}
                          title={used ? 'Pass Used' : 'Pass Available'}
                        >
                          {used ? '🎟️' : '⚪'}
                        </span>
                      );
                    })}
                  </div>
                  <span
                    className={`text-[11px] font-black font-mono-tabular ${
                      isMax ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {st.passesUsed}/{MAX_QUARTER_PASSES}
                  </span>
                </div>

                {/* Action Button + Individual History Button */}
                <div className="flex items-center gap-1.5">
                  {isOut ? (
                    <button
                      onClick={() => onReturnStudent(st)}
                      className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 font-mono-tabular cursor-pointer min-w-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Return ({formatDurationExact(elapsedSeconds)})</span>
                    </button>
                  ) : isMax ? (
                    <button
                      disabled
                      className="flex-1 py-1.5 bg-rose-950 text-rose-400 border border-rose-500/40 font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-not-allowed min-w-0"
                    >
                      <Ban className="w-3 h-3 shrink-0" />
                      <span className="truncate">Limit Reached</span>
                    </button>
                  ) : someoneOut ? (
                    isInLine ? (
                      <button
                        onClick={() => void onRemoveFromQueue(st.id)}
                        className="flex-1 py-1.5 bg-sky-950/70 hover:bg-rose-950/60 text-sky-300 hover:text-rose-300 border border-sky-500/50 font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0"
                        title="Click to remove from restroom line"
                      >
                        <ListOrdered className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">In Line (#{queueIndex! + 1})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => void onAddToQueue(st.id)}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-black text-amber-300 font-extrabold text-[11px] rounded-lg border border-amber-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0"
                        title="Only 1 student out at a time — add to restroom line"
                      >
                        <ListOrdered className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Add to Line</span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => onIssuePass(st)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-black text-amber-300 font-extrabold text-[11px] rounded-lg border border-amber-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0"
                    >
                      <Ticket className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {isInLine ? `Go (#${queueIndex! + 1})` : 'Issue Pass'}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => onOpenStudentHistory(st)}
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title={`View pass history for ${st.name}`}
                    aria-label={`View pass history for ${st.name}`}
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Shared Pass History Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm text-white">
              Live Pass Activity Log
            </h3>
            <span className="text-xs text-slate-400">
              · Synced across c_tokar@chuh.org &amp; J_kravitz@chuh.org
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <button
                onClick={() => setShowAllLogs(false)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  !showAllLogs ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                This Period
              </button>
              <button
                onClick={() => setShowAllLogs(true)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  showAllLogs ? 'bg-amber-400 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Periods
              </button>
            </div>
            <button
              onClick={onViewFullHistory}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-lg border border-slate-700 whitespace-nowrap cursor-pointer"
            >
              Full History →
            </button>
          </div>
        </div>

        {visibleLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No hall pass events recorded yet. Issued, returned, and adjusted passes appear here in real time.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Student</th>
                  <th className="py-2 px-3 font-semibold">Period</th>
                  <th className="py-2 px-3 font-semibold">Action &amp; Time Out</th>
                  <th className="py-2 px-3 font-semibold text-right">Pass Balance</th>
                  <th className="py-2 px-3 font-semibold">Teacher</th>
                  <th className="py-2 pl-3 font-semibold text-right">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {visibleLogs.slice(0, 30).map((log) => {
                  const secs =
                    typeof log.durationSeconds === 'number'
                      ? log.durationSeconds
                      : log.durationMinutes * 60;
                  return (
                    <tr key={log.id} className="hover:bg-slate-950/60">
                      <td className="py-2 pr-3 font-bold text-white whitespace-nowrap">
                        <button
                          onClick={() => {
                            const match = students.find((s) => s.id === log.studentId);
                            if (match) {
                              onOpenStudentHistory(match);
                            } else {
                              onViewFullHistory();
                            }
                          }}
                          className="hover:text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer text-left"
                          title={`View pass history for ${log.studentName}`}
                        >
                          <span>{log.studentName}</span>
                          <History className="w-3 h-3 text-slate-500" />
                        </button>
                      </td>
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.sectionName}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            log.action === 'issued'
                              ? 'text-amber-300'
                              : log.action === 'returned'
                              ? 'text-emerald-400'
                              : log.action === 'reset'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {log.action === 'issued' && 'Issued Pass'}
                          {log.action === 'returned' &&
                            `Returned (${formatDurationExact(secs)} out)`}
                          {log.action === 'adjusted' && 'Adjusted Count'}
                          {log.action === 'reset' && 'Quarter Reset'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-slate-200 whitespace-nowrap">
                        {log.passesUsedAfter}/{MAX_QUARTER_PASSES}
                      </td>
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.actorEmail}</td>
                      <td className="py-2 pl-3 text-right font-mono-tabular text-slate-400 whitespace-nowrap">
                        {formatLogDateTime(log)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
