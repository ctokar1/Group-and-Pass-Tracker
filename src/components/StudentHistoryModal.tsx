import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  History,
  User,
  X,
} from 'lucide-react';
import {
  MAX_QUARTER_PASSES,
  type PassLogDoc,
  type StudentDoc,
} from '../types/classroom';

export interface StudentHistoryTarget {
  id: string;
  name: string;
  sectionId?: string;
  sectionName?: string;
  passesUsed?: number;
  outTimestamp?: number;
  liveStudent?: StudentDoc;
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

export function getLogTakenMillis(log: PassLogDoc): number {
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

export function getLogReturnedMillis(log: PassLogDoc): number {
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

export function getLogCreatedMillis(log: PassLogDoc): number {
  if (
    log.createdAt &&
    typeof log.createdAt === 'object' &&
    'toMillis' in log.createdAt
  ) {
    return (log.createdAt as { toMillis: () => number }).toMillis();
  }
  return log.takenAt || Date.now();
}

export function formatDateOnly(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeOnly(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface StudentHistoryModalProps {
  target: StudentHistoryTarget | null;
  passLogs: PassLogDoc[];
  onReturnStudent?: (student: StudentDoc) => Promise<void>;
  onClose: () => void;
}

interface StudentTripItem {
  id: string;
  sectionName: string;
  takenMs: number;
  returnedMs: number | null;
  durationSeconds: number;
  passesUsedAfter: number;
  actorEmail: string;
  isActive: boolean;
}

export const StudentHistoryModal: React.FC<StudentHistoryModalProps> = ({
  target,
  passLogs,
  onReturnStudent,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'trips' | 'events'>('trips');
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    setViewMode('trips');
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', handleKey);
    };
  }, [target, onClose]);

  const studentLogs = useMemo(() => {
    if (!target) return [];
    return passLogs.filter((l) => l.studentId === target.id);
  }, [target, passLogs]);

  const liveStudent = target?.liveStudent;
  const isCurrentlyOut = Boolean(liveStudent && liveStudent.outTimestamp > 0);
  const activeElapsedSeconds =
    isCurrentlyOut && liveStudent
      ? Math.max(0, Math.round((nowMs - liveStudent.outTimestamp) / 1000))
      : 0;

  const trips = useMemo<StudentTripItem[]>(() => {
    if (!target) return [];
    const items: StudentTripItem[] = [];

    if (liveStudent && liveStudent.outTimestamp > 0) {
      const issueLog = studentLogs.find((l) => l.action === 'issued');
      items.push({
        id: `active_${liveStudent.id}`,
        sectionName: target.sectionName || issueLog?.sectionName || 'Current Period',
        takenMs: liveStudent.outTimestamp,
        returnedMs: null,
        durationSeconds: Math.max(
          0,
          Math.round((nowMs - liveStudent.outTimestamp) / 1000)
        ),
        passesUsedAfter: liveStudent.passesUsed,
        actorEmail: issueLog?.actorEmail || liveStudent.updatedBy,
        isActive: true,
      });
    }

    studentLogs
      .filter((l) => l.action === 'returned')
      .forEach((log) => {
        const secs =
          typeof log.durationSeconds === 'number'
            ? log.durationSeconds
            : Math.max(0, Math.round(log.durationMinutes * 60));
        items.push({
          id: log.id,
          sectionName: log.sectionName,
          takenMs: getLogTakenMillis(log),
          returnedMs: getLogReturnedMillis(log),
          durationSeconds: secs,
          passesUsedAfter: log.passesUsedAfter,
          actorEmail: log.actorEmail,
          isActive: false,
        });
      });

    return items.sort((a, b) => b.takenMs - a.takenMs);
  }, [target, liveStudent, studentLogs, nowMs]);

  if (!target) return null;

  const completedTrips = trips.filter((t) => !t.isActive);
  const totalTimeSeconds = trips.reduce((sum, t) => sum + t.durationSeconds, 0);
  const avgTimeSeconds =
    completedTrips.length > 0
      ? Math.round(
          completedTrips.reduce((sum, t) => sum + t.durationSeconds, 0) /
            completedTrips.length
        )
      : 0;
  const longestSeconds = trips.reduce(
    (max, t) => Math.max(max, t.durationSeconds),
    0
  );
  const passesUsedDisplay =
    typeof liveStudent?.passesUsed === 'number'
      ? liveStudent.passesUsed
      : typeof target.passesUsed === 'number'
      ? target.passesUsed
      : studentLogs[0]?.passesUsedAfter ?? 0;

  const displayPeriod =
    target.sectionName || studentLogs[0]?.sectionName || 'Class Period';

  const handleExportStudentCSV = () => {
    let csv =
      'Student Name,Period,Date Taken,Time Taken,Time Returned,Time Out,Status,Pass Balance,Teacher\n';
    trips.forEach((row) => {
      const dateStr = formatDateOnly(row.takenMs);
      const timeTakenStr = formatTimeOnly(row.takenMs);
      const timeReturnedStr = row.returnedMs
        ? formatTimeOnly(row.returnedMs)
        : 'Still Out';
      const durStr = formatDurationExact(row.durationSeconds);
      const statusStr = row.isActive ? 'Currently Out' : 'Returned';
      csv += `"${target.name.replace(/"/g, '""')}","${row.sectionName.replace(/"/g, '""')}","${dateStr}","${timeTakenStr}","${timeReturnedStr}","${durStr}","${statusStr}","${row.passesUsedAfter}/${MAX_QUARTER_PASSES}","${row.actorEmail}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${target.name.replace(/[^a-z0-9]/gi, '_')}_Pass_History_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-xl text-white truncate flex items-center gap-2">
                {target.name}
                {isCurrentlyOut && (
                  <span className="px-2 py-0.5 bg-amber-400 text-black text-[11px] font-black rounded-md font-mono-tabular">
                    OUT {formatDurationExact(activeElapsedSeconds)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Individual Pass History · {displayPeriod}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentlyOut && liveStudent && onReturnStudent && (
              <button
                onClick={() => void onReturnStudent(liveStudent)}
                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Return Now
              </button>
            )}
            <button
              onClick={handleExportStudentCSV}
              disabled={trips.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
              aria-label="Close student history"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Quarter Balance
            </span>
            <span className="text-xl font-black text-amber-300 font-mono-tabular mt-0.5 block">
              {passesUsedDisplay} / {MAX_QUARTER_PASSES}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Trips Recorded
            </span>
            <span className="text-xl font-black text-white font-mono-tabular mt-0.5 block">
              {trips.length}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Total Time Out
            </span>
            <span className="text-xl font-black text-white font-mono-tabular mt-0.5 block">
              {formatDurationExact(totalTimeSeconds)}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Avg / Longest
            </span>
            <span className="text-sm font-black text-emerald-400 font-mono-tabular mt-1.5 block">
              {formatDurationExact(avgTimeSeconds)} avg · {formatDurationExact(longestSeconds)} max
            </span>
          </div>
        </div>

        {/* View Mode Subheader */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <History className="w-4 h-4 text-amber-400" />
            <span>
              {viewMode === 'trips'
                ? 'Showing individual hall pass trips with exact dates and durations'
                : 'Showing every recorded issue, return, adjustment, and reset'}
            </span>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs shrink-0">
            <button
              onClick={() => setViewMode('trips')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'trips'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Trips ({trips.length})
            </button>
            <button
              onClick={() => setViewMode('events')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                viewMode === 'events'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Events ({studentLogs.length})
            </button>
          </div>
        </div>

        {/* Scrollable History Table */}
        <div className="flex-1 overflow-y-auto p-5">
          {viewMode === 'trips' ? (
            trips.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No completed or active pass trips recorded for {target.name} yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 pr-3 font-semibold">Date Taken</th>
                      <th className="py-2.5 px-3 font-semibold">Time Taken</th>
                      <th className="py-2.5 px-3 font-semibold">Time Returned</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Time Out</th>
                      <th className="py-2.5 px-3 font-semibold">Period</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Pass #</th>
                      <th className="py-2.5 pl-3 font-semibold text-right">Teacher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {trips.map((row) => {
                      const isLong = row.durationSeconds >= 420;
                      return (
                        <tr
                          key={row.id}
                          className={
                            row.isActive
                              ? 'bg-amber-950/20'
                              : 'hover:bg-slate-950/60'
                          }
                        >
                          <td className="py-3 pr-3 font-mono-tabular text-slate-200 whitespace-nowrap font-semibold">
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
                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                            {row.sectionName}
                          </td>
                          <td className="py-3 px-3 text-right font-mono-tabular text-slate-300 whitespace-nowrap">
                            {row.passesUsedAfter}/{MAX_QUARTER_PASSES}
                          </td>
                          <td className="py-3 pl-3 text-right text-slate-400 whitespace-nowrap">
                            {row.actorEmail}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : studentLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No pass events recorded for {target.name} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 pr-3 font-semibold">Event</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Time</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Time Out</th>
                    <th className="py-2.5 px-3 font-semibold">Period</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Pass Balance</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Teacher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {studentLogs.map((log) => {
                    const eventMs = getLogCreatedMillis(log);
                    const secs =
                      typeof log.durationSeconds === 'number'
                        ? log.durationSeconds
                        : log.durationMinutes * 60;
                    return (
                      <tr key={log.id} className="hover:bg-slate-950/60">
                        <td className="py-2.5 pr-3 whitespace-nowrap">
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
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                          {log.sectionName}
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
      </div>
    </div>
  );
};
