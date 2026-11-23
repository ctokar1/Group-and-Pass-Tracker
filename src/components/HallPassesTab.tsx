import React, { useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  History,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Ticket,
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
  onOpenResetModal: () => void;
  onViewFullHistory: () => void;
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
  onOpenResetModal,
  onViewFullHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Live ticker every 1 second for accurate time-out counters
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const queryText = searchQuery.trim().toLowerCase();
  const sortedRoster = [...students].sort((a, b) => a.name.localeCompare(b.name));
  const filteredRoster = sortedRoster.filter((st) =>
    st.name.toLowerCase().includes(queryText)
  );
  const currentlyOut = sortedRoster.filter((st) => st.outTimestamp > 0);

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
            Students are allowed {MAX_QUARTER_PASSES} passes per quarter. Tiles lock automatically at {MAX_QUARTER_PASSES}/{MAX_QUARTER_PASSES}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 w-52"
            />
          </div>
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
                Students Currently Out of Room
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
                  <button
                    onClick={() => onReturnStudent(st)}
                    className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Return
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

            return (
              <div
                key={st.id}
                className={`bg-slate-900 border rounded-xl p-3 flex flex-col justify-between space-y-2.5 transition-colors ${
                  isOut
                    ? 'border-amber-400 bg-amber-950/20'
                    : isMax
                    ? 'border-rose-500/60 bg-rose-950/20'
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

                {/* Action Button */}
                {isOut ? (
                  <button
                    onClick={() => onReturnStudent(st)}
                    className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 font-mono-tabular cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Return ({formatDurationExact(elapsedSeconds)})
                  </button>
                ) : isMax ? (
                  <button
                    disabled
                    className="w-full py-1.5 bg-rose-950 text-rose-400 border border-rose-500/40 font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-not-allowed"
                  >
                    <Ban className="w-3 h-3" />
                    Limit Reached
                  </button>
                ) : (
                  <button
                    onClick={() => onIssuePass(st)}
                    className="w-full py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-black text-amber-300 font-extrabold text-[11px] rounded-lg border border-amber-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    Issue Pass
                  </button>
                )}
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
                      <td className="py-2 pr-3 font-bold text-white whitespace-nowrap">{log.studentName}</td>
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
