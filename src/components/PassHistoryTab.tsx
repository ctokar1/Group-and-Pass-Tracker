import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  History,
  Search,
} from 'lucide-react';
import {
  MAX_QUARTER_PASSES,
  type ClassSectionDoc,
  type PassLogDoc,
  type StudentDoc,
} from '../types/classroom';

interface PassHistoryTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  passLogs: PassLogDoc[];
  onReturnStudent: (student: StudentDoc) => Promise<void>;
}

function getLogMillis(log: PassLogDoc): number {
  if (typeof log.takenAt === 'number' && log.takenAt > 0) {
    return log.takenAt;
  }
  if (
    log.createdAt &&
    typeof log.createdAt === 'object' &&
    'toMillis' in log.createdAt
  ) {
    const ms = (log.createdAt as { toMillis: () => number }).toMillis();
    if (log.action === 'returned' && log.durationMinutes > 0) {
      return ms - log.durationMinutes * 60000;
    }
    return ms;
  }
  return Date.now();
}

function getReturnedMillis(log: PassLogDoc): number {
  if (typeof log.returnedAt === 'number' && log.returnedAt > 0) {
    return log.returnedAt;
  }
  if (
    log.createdAt &&
    typeof log.createdAt === 'object' &&
    'toMillis' in log.createdAt
  ) {
    return (log.createdAt as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function getCreatedMillis(log: PassLogDoc): number {
  if (
    log.createdAt &&
    typeof log.createdAt === 'object' &&
    'toMillis' in log.createdAt
  ) {
    return (log.createdAt as { toMillis: () => number }).toMillis();
  }
  return log.takenAt || Date.now();
}

export function formatDurationExact(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

function formatDateOnly(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeOnly(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function toLocalDateKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface TripRow {
  id: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  takenMs: number;
  returnedMs: number | null;
  durationSeconds: number;
  passesUsedAfter: number;
  actorEmail: string;
  isActive: boolean;
  activeStudent?: StudentDoc;
}

export const PassHistoryTab: React.FC<PassHistoryTabProps> = ({
  section,
  students,
  passLogs,
  onReturnStudent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'current' | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'trips' | 'events'>('trips');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tripRows = useMemo<TripRow[]>(() => {
    const activeStudents = students.filter((s) => s.outTimestamp > 0);
    const activeRows: TripRow[] = activeStudents.map((st) => {
      const matchingIssue = passLogs.find(
        (l) =>
          l.studentId === st.id &&
          l.sectionId === st.sectionId &&
          l.action === 'issued'
      );
      return {
        id: `active_${st.id}`,
        studentId: st.id,
        studentName: st.name,
        sectionId: st.sectionId,
        sectionName: section?.name || matchingIssue?.sectionName || 'Current Period',
        takenMs: st.outTimestamp,
        returnedMs: null,
        durationSeconds: Math.max(0, Math.round((nowMs - st.outTimestamp) / 1000)),
        passesUsedAfter: st.passesUsed,
        actorEmail: matchingIssue?.actorEmail || st.updatedBy,
        isActive: true,
        activeStudent: st,
      };
    });

    const completedRows: TripRow[] = passLogs
      .filter((log) => log.action === 'returned')
      .map((log) => {
        const takenMs = getLogMillis(log);
        const returnedMs = getReturnedMillis(log);
        const secs =
          typeof log.durationSeconds === 'number'
            ? log.durationSeconds
            : Math.max(0, Math.round(log.durationMinutes * 60));
        return {
          id: log.id,
          studentId: log.studentId,
          studentName: log.studentName,
          sectionId: log.sectionId,
          sectionName: log.sectionName,
          takenMs,
          returnedMs,
          durationSeconds: secs,
          passesUsedAfter: log.passesUsedAfter,
          actorEmail: log.actorEmail,
          isActive: false,
        };
      });

    return [...activeRows, ...completedRows].sort((a, b) => b.takenMs - a.takenMs);
  }, [students, passLogs, section?.name, nowMs]);

  const queryText = searchQuery.trim().toLowerCase();

  const filteredTrips = useMemo(() => {
    return tripRows.filter((row) => {
      if (periodFilter === 'current' && section && row.sectionId !== section.id) {
        return false;
      }
      if (queryText && !row.studentName.toLowerCase().includes(queryText)) {
        return false;
      }
      if (dateFilter && toLocalDateKey(row.takenMs) !== dateFilter) {
        return false;
      }
      return true;
    });
  }, [tripRows, periodFilter, section, queryText, dateFilter]);

  const filteredEvents = useMemo(() => {
    return passLogs.filter((log) => {
      if (periodFilter === 'current' && section && log.sectionId !== section.id) {
        return false;
      }
      if (queryText && !log.studentName.toLowerCase().includes(queryText)) {
        return false;
      }
      if (dateFilter && toLocalDateKey(getCreatedMillis(log)) !== dateFilter) {
        return false;
      }
      return true;
    });
  }, [passLogs, periodFilter, section, queryText, dateFilter]);

  const completedFiltered = filteredTrips.filter((t) => !t.isActive);
  const totalOutSeconds = filteredTrips.reduce((sum, t) => sum + t.durationSeconds, 0);
  const avgOutSeconds =
    completedFiltered.length > 0
      ? Math.round(
          completedFiltered.reduce((sum, t) => sum + t.durationSeconds, 0) /
            completedFiltered.length
        )
      : 0;
  const activeCount = filteredTrips.filter((t) => t.isActive).length;

  const handleExportHistoryCSV = () => {
    let csv =
      'Date Taken,Time Taken,Time Returned,Time Out,Status,Student Name,Period,Pass Balance,Teacher\n';
    filteredTrips.forEach((row) => {
      const dateStr = formatDateOnly(row.takenMs);
      const timeTakenStr = formatTimeOnly(row.takenMs);
      const timeReturnedStr = row.returnedMs ? formatTimeOnly(row.returnedMs) : 'Still Out';
      const durStr = formatDurationExact(row.durationSeconds);
      const statusStr = row.isActive ? 'Currently Out' : 'Returned';
      csv += `"${dateStr}","${timeTakenStr}","${timeReturnedStr}","${durStr}","${statusStr}","${row.studentName.replace(/"/g, '""')}","${row.sectionName.replace(/"/g, '""')}","${row.passesUsedAfter}/${MAX_QUARTER_PASSES}","${row.actorEmail}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tiger_Pass_History_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-black text-lg text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              Hall Pass History &amp; Time Out Log
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracks exact date taken, departure &amp; return timestamps, and total time each student spent out of class.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportHistoryCSV}
              disabled={filteredTrips.length === 0}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export History CSV
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by student..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400 w-48"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg cursor-pointer"
              >
                Clear Date
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setPeriodFilter('current')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                periodFilter === 'current'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              This Period
            </button>
            <button
              onClick={() => setPeriodFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                periodFilter === 'all'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Periods
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs ml-auto">
            <button
              onClick={() => setViewMode('trips')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'trips'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pass Trips
            </button>
            <button
              onClick={() => setViewMode('events')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'events'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Events
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold block">Passes Logged</span>
          <span className="text-2xl font-black text-white font-mono-tabular mt-1 block">
            {filteredTrips.length}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold block">Currently Out</span>
          <span className="text-2xl font-black text-amber-300 font-mono-tabular mt-1 block">
            {activeCount}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold block">Total Time Out</span>
          <span className="text-2xl font-black text-white font-mono-tabular mt-1 block">
            {formatDurationExact(totalOutSeconds)}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold block">Avg Time Out</span>
          <span className="text-2xl font-black text-emerald-400 font-mono-tabular mt-1 block">
            {formatDurationExact(avgOutSeconds)}
          </span>
        </div>
      </div>

      {/* Main History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        {viewMode === 'trips' ? (
          filteredTrips.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No pass trips recorded yet matching your filters. Issue and return passes in the Hall Passes tab to build history.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 pr-3 font-semibold">Student</th>
                    <th className="py-2.5 px-3 font-semibold">Period</th>
                    <th className="py-2.5 px-3 font-semibold">Date Taken</th>
                    <th className="py-2.5 px-3 font-semibold">Time Taken</th>
                    <th className="py-2.5 px-3 font-semibold">Time Returned</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Time Out</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Pass #</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Teacher / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTrips.map((row) => {
                    const isLong = row.durationSeconds >= 420;
                    return (
                      <tr
                        key={row.id}
                        className={
                          row.isActive
                            ? 'bg-amber-950/20 hover:bg-amber-950/30'
                            : 'hover:bg-slate-950/60'
                        }
                      >
                        <td className="py-3 pr-3 font-bold text-white whitespace-nowrap">
                          {row.studentName}
                        </td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                          {row.sectionName}
                        </td>
                        <td className="py-3 px-3 font-mono-tabular text-slate-300 whitespace-nowrap">
                          {formatDateOnly(row.takenMs)}
                        </td>
                        <td className="py-3 px-3 font-mono-tabular text-slate-200 whitespace-nowrap">
                          {formatTimeOnly(row.takenMs)}
                        </td>
                        <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">
                          {row.returnedMs ? (
                            <span className="text-slate-200">
                              {formatTimeOnly(row.returnedMs)}
                            </span>
                          ) : (
                            <span className="text-amber-300 font-bold">Still Out</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-extrabold ${
                              row.isActive
                                ? isLong
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
                                : isLong
                                ? 'text-rose-300'
                                : 'text-emerald-400'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            {formatDurationExact(row.durationSeconds)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                          {row.passesUsedAfter}/{MAX_QUARTER_PASSES}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          {row.isActive && row.activeStudent ? (
                            <button
                              onClick={() => onReturnStudent(row.activeStudent!)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] rounded-lg cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Return
                            </button>
                          ) : (
                            <span className="text-slate-400">{row.actorEmail}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : filteredEvents.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No pass events recorded yet matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 pr-3 font-semibold">Student</th>
                  <th className="py-2.5 px-3 font-semibold">Period</th>
                  <th className="py-2.5 px-3 font-semibold">Event</th>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Time Out</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Pass Balance</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEvents.map((log) => {
                  const eventMs = getCreatedMillis(log);
                  const secs =
                    typeof log.durationSeconds === 'number'
                      ? log.durationSeconds
                      : log.durationMinutes * 60;
                  return (
                    <tr key={log.id} className="hover:bg-slate-950/60">
                      <td className="py-2.5 pr-3 font-bold text-white whitespace-nowrap">
                        {log.studentName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        {log.sectionName}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
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
                          {log.action === 'returned' && 'Returned to Class'}
                          {log.action === 'adjusted' && 'Adjusted Count'}
                          {log.action === 'reset' && 'Quarter Reset'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular text-slate-300 whitespace-nowrap">
                        {formatDateOnly(eventMs)}
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular text-slate-200 whitespace-nowrap">
                        {formatTimeOnly(eventMs)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-200 whitespace-nowrap">
                        {log.action === 'returned' ? formatDurationExact(secs) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                        {log.passesUsedAfter}/{MAX_QUARTER_PASSES}
                      </td>
                      <td className="py-2.5 pl-3 text-right text-slate-400 whitespace-nowrap">
                        {log.actorEmail}
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
