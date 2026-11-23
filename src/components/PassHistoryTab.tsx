import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  History,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import {
  MAX_QUARTER_PASSES,
  type ClassSectionDoc,
  type PassLogDoc,
  type StudentDoc,
} from '../types/classroom';
import {
  formatDateOnly,
  formatDurationExact,
  formatTimeOnly,
  getLogCreatedMillis,
  getLogReturnedMillis,
  getLogTakenMillis,
  type StudentHistoryTarget,
} from './StudentHistoryModal';

export { formatDurationExact };

interface PassHistoryTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  passLogs: PassLogDoc[];
  maxPasses?: number;
  longPassAlertMinutes?: number;
  onReturnStudent: (student: StudentDoc) => Promise<void>;
  onOpenStudentHistory: (target: StudentHistoryTarget) => void;
  onEditLog: (log: PassLogDoc) => void;
  onDeleteLog: (log: PassLogDoc) => void;
  onOpenClearHistory: () => void;
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
  sourceLog?: PassLogDoc;
}

interface StudentSummaryRow {
  studentId: string;
  studentName: string;
  sectionId: string;
  sectionName: string;
  passesUsed: number;
  tripsCount: number;
  completedCount: number;
  totalSeconds: number;
  avgSeconds: number;
  lastTakenMs: number | null;
  isActive: boolean;
  activeDurationSeconds: number;
  activeStudent?: StudentDoc;
}

export const PassHistoryTab: React.FC<PassHistoryTabProps> = ({
  section,
  students,
  passLogs,
  maxPasses = MAX_QUARTER_PASSES,
  longPassAlertMinutes = 7,
  onReturnStudent,
  onOpenStudentHistory,
  onEditLog,
  onDeleteLog,
  onOpenClearHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'current' | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'trips' | 'students' | 'events'>('trips');
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
        const takenMs = getLogTakenMillis(log);
        const returnedMs = getLogReturnedMillis(log);
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
          sourceLog: log,
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
      if (dateFilter && toLocalDateKey(getLogCreatedMillis(log)) !== dateFilter) {
        return false;
      }
      return true;
    });
  }, [passLogs, periodFilter, section, queryText, dateFilter]);

  const studentSummaryRows = useMemo<StudentSummaryRow[]>(() => {
    const map = new Map<string, StudentSummaryRow>();

    // Seed with all students from current roster
    students.forEach((st) => {
      const isOut = st.outTimestamp > 0;
      const activeDur = isOut
        ? Math.max(0, Math.round((nowMs - st.outTimestamp) / 1000))
        : 0;
      map.set(st.id, {
        studentId: st.id,
        studentName: st.name,
        sectionId: st.sectionId,
        sectionName: section?.name || 'Current Period',
        passesUsed: st.passesUsed,
        tripsCount: isOut ? 1 : 0,
        completedCount: 0,
        totalSeconds: activeDur,
        avgSeconds: 0,
        lastTakenMs: isOut ? st.outTimestamp : null,
        isActive: isOut,
        activeDurationSeconds: activeDur,
        activeStudent: st,
      });
    });

    // Aggregate passLogs matching period & date filters
    passLogs.forEach((log) => {
      if (periodFilter === 'current' && section && log.sectionId !== section.id) {
        return;
      }
      const eventMs =
        log.action === 'returned' ? getLogTakenMillis(log) : getLogCreatedMillis(log);
      if (dateFilter && toLocalDateKey(eventMs) !== dateFilter) {
        return;
      }

      let entry = map.get(log.studentId);
      if (!entry) {
        entry = {
          studentId: log.studentId,
          studentName: log.studentName,
          sectionId: log.sectionId,
          sectionName: log.sectionName,
          passesUsed: log.passesUsedAfter,
          tripsCount: 0,
          completedCount: 0,
          totalSeconds: 0,
          avgSeconds: 0,
          lastTakenMs: null,
          isActive: false,
          activeDurationSeconds: 0,
        };
        map.set(log.studentId, entry);
      }

      if (log.action === 'returned') {
        const secs =
          typeof log.durationSeconds === 'number'
            ? log.durationSeconds
            : Math.max(0, Math.round(log.durationMinutes * 60));
        entry.tripsCount += 1;
        entry.completedCount += 1;
        entry.totalSeconds += secs;
        if (entry.lastTakenMs === null || eventMs > entry.lastTakenMs) {
          entry.lastTakenMs = eventMs;
        }
      } else if (log.action === 'issued') {
        if (entry.lastTakenMs === null || eventMs > entry.lastTakenMs) {
          entry.lastTakenMs = eventMs;
        }
      }
    });

    const rows = Array.from(map.values())
      .map((r) => ({
        ...r,
        avgSeconds:
          r.completedCount > 0
            ? Math.round(
                (r.totalSeconds - r.activeDurationSeconds) / r.completedCount
              )
            : 0,
      }))
      .filter((r) => {
        if (periodFilter === 'current' && section && r.sectionId !== section.id) {
          return false;
        }
        if (queryText && !r.studentName.toLowerCase().includes(queryText)) {
          return false;
        }
        if (dateFilter && r.lastTakenMs === null) {
          return false;
        }
        return true;
      });

    return rows.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (b.tripsCount !== a.tripsCount) return b.tripsCount - a.tripsCount;
      return a.studentName.localeCompare(b.studentName);
    });
  }, [students, passLogs, section, periodFilter, dateFilter, queryText, nowMs]);

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
    let csv = '';
    if (viewMode === 'students') {
      csv =
        'Student Name,Period,Status,Passes Left,Trips Logged,Total Time Out,Avg Time Out,Last Date Taken,Last Time Taken\n';
      studentSummaryRows.forEach((row) => {
        const statusStr = row.isActive ? 'Currently Out' : 'In Class';
        const lastDateStr = row.lastTakenMs ? formatDateOnly(row.lastTakenMs) : '—';
        const lastTimeStr = row.lastTakenMs ? formatTimeOnly(row.lastTakenMs) : '—';
        const passesLeft = Math.max(0, maxPasses - row.passesUsed);
        csv += `"${row.studentName.replace(/"/g, '""')}","${row.sectionName.replace(
          /"/g,
          '""'
        )}","${statusStr}","${passesLeft}/${maxPasses}",${
          row.tripsCount
        },"${formatDurationExact(row.totalSeconds)}","${formatDurationExact(
          row.avgSeconds
        )}","${lastDateStr}","${lastTimeStr}"\n`;
      });
    } else {
      csv =
        'Date Taken,Time Taken,Time Returned,Time Out,Status,Student Name,Period,Passes Left,Teacher\n';
      filteredTrips.forEach((row) => {
        const dateStr = formatDateOnly(row.takenMs);
        const timeTakenStr = formatTimeOnly(row.takenMs);
        const timeReturnedStr = row.returnedMs ? formatTimeOnly(row.returnedMs) : 'Still Out';
        const durStr = formatDurationExact(row.durationSeconds);
        const statusStr = row.isActive ? 'Currently Out' : 'Returned';
        const passesLeftAfter = Math.max(0, maxPasses - row.passesUsedAfter);
        csv += `"${dateStr}","${timeTakenStr}","${timeReturnedStr}","${durStr}","${statusStr}","${row.studentName.replace(
          /"/g,
          '""'
        )}","${row.sectionName.replace(/"/g, '""')}","${
          passesLeftAfter
        }/${maxPasses}","${row.actorEmail}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tiger_Pass_History_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openStudentById = (
    id: string,
    name: string,
    sectionId: string,
    sectionName: string,
    passesUsed?: number,
    activeStudent?: StudentDoc
  ) => {
    const matchedLive = activeStudent || students.find((s) => s.id === id);
    onOpenStudentHistory({
      id,
      name,
      sectionId,
      sectionName,
      passesUsed: matchedLive?.passesUsed ?? passesUsed,
      outTimestamp: matchedLive?.outTimestamp,
      liveStudent: matchedLive,
    });
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
              Tracks exact date taken, departure &amp; return timestamps, total time out, and individual student pass history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportHistoryCSV}
              disabled={
                viewMode === 'students'
                  ? studentSummaryRows.length === 0
                  : filteredTrips.length === 0
              }
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export History CSV
            </button>
            <button
              onClick={onOpenClearHistory}
              disabled={passLogs.length === 0}
              className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 disabled:opacity-40 text-rose-300 font-bold text-xs rounded-xl border border-rose-800/60 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Pass History
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
              onClick={() => setViewMode('students')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                viewMode === 'students'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              By Student
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
                    <th className="py-2.5 px-3 font-semibold text-right">Passes Left</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Teacher / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredTrips.map((row) => {
                    const isLong = row.durationSeconds >= longPassAlertMinutes * 60;
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
                          <button
                            onClick={() =>
                              openStudentById(
                                row.studentId,
                                row.studentName,
                                row.sectionId,
                                row.sectionName,
                                row.passesUsedAfter,
                                row.activeStudent
                              )
                            }
                            className="hover:text-amber-300 hover:underline inline-flex items-center gap-1.5 cursor-pointer text-left"
                            title={`View individual history for ${row.studentName}`}
                          >
                            <span>{row.studentName}</span>
                            <History className="w-3 h-3 text-slate-500" />
                          </button>
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
                          {Math.max(0, maxPasses - row.passesUsedAfter)}/{maxPasses}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {row.isActive && row.activeStudent ? (
                              <button
                                onClick={() => void onReturnStudent(row.activeStudent!)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] rounded-lg cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Return
                              </button>
                            ) : (
                              <span className="text-slate-400 mr-1">{row.actorEmail}</span>
                            )}
                            {row.sourceLog && (
                              <>
                                <button
                                  onClick={() => onEditLog(row.sourceLog!)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] rounded-lg border border-slate-700 cursor-pointer"
                                  title="Edit this pass entry"
                                  aria-label={`Edit pass entry for ${row.studentName}`}
                                >
                                  <Pencil className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => onDeleteLog(row.sourceLog!)}
                                  className="p-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 cursor-pointer"
                                  title="Delete this pass entry"
                                  aria-label={`Delete pass entry for ${row.studentName}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() =>
                                openStudentById(
                                  row.studentId,
                                  row.studentName,
                                  row.sectionId,
                                  row.sectionName,
                                  row.passesUsedAfter,
                                  row.activeStudent
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] rounded-lg border border-slate-700 cursor-pointer"
                              title={`View ${row.studentName}'s history`}
                            >
                              <History className="w-3 h-3" />
                              History
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : viewMode === 'students' ? (
          studentSummaryRows.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No students match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 pr-3 font-semibold">Student</th>
                    <th className="py-2.5 px-3 font-semibold">Period</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Passes Left</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Trips</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total Time Out</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Avg Time Out</th>
                    <th className="py-2.5 px-3 font-semibold">Last Pass Taken</th>
                    <th className="py-2.5 pl-3 font-semibold text-right">Individual Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {studentSummaryRows.map((row) => (
                    <tr
                      key={`${row.sectionId}_${row.studentId}`}
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
                      <td className="py-3 px-3 whitespace-nowrap">
                        {row.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-black font-black text-[11px] rounded-md font-mono-tabular">
                            Out {formatDurationExact(row.activeDurationSeconds)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">In Class</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-slate-200 whitespace-nowrap">
                        {Math.max(0, maxPasses - row.passesUsed)}/{maxPasses}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular font-bold text-white whitespace-nowrap">
                        {row.tripsCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular font-extrabold text-amber-300 whitespace-nowrap">
                        {formatDurationExact(row.totalSeconds)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-emerald-400 whitespace-nowrap">
                        {row.completedCount > 0
                          ? formatDurationExact(row.avgSeconds)
                          : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono-tabular text-slate-300 whitespace-nowrap">
                        {row.lastTakenMs
                          ? `${formatDateOnly(row.lastTakenMs)} · ${formatTimeOnly(
                              row.lastTakenMs
                            )}`
                          : 'No passes yet'}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            openStudentById(
                              row.studentId,
                              row.studentName,
                              row.sectionId,
                              row.sectionName,
                              row.passesUsed,
                              row.activeStudent
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-black text-amber-300 font-extrabold text-[11px] rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          View History
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  <th className="py-2.5 px-3 font-semibold text-right">Passes Left</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Teacher / History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEvents.map((log) => {
                  const eventMs = getLogCreatedMillis(log);
                  const secs =
                    typeof log.durationSeconds === 'number'
                      ? log.durationSeconds
                      : log.durationMinutes * 60;
                  return (
                    <tr key={log.id} className="hover:bg-slate-950/60">
                      <td className="py-2.5 pr-3 font-bold text-white whitespace-nowrap">
                        <button
                          onClick={() =>
                            openStudentById(
                              log.studentId,
                              log.studentName,
                              log.sectionId,
                              log.sectionName,
                              log.passesUsedAfter
                            )
                          }
                          className="hover:text-amber-300 hover:underline inline-flex items-center gap-1.5 cursor-pointer text-left"
                        >
                          <span>{log.studentName}</span>
                          <History className="w-3 h-3 text-slate-500" />
                        </button>
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
                        {Math.max(0, maxPasses - log.passesUsedAfter)}/{maxPasses}
                      </td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-slate-400 mr-1">{log.actorEmail}</span>
                          <button
                            onClick={() => onEditLog(log)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] rounded-lg border border-slate-700 cursor-pointer"
                            title="Edit event"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteLog(log)}
                            className="p-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 cursor-pointer"
                            title="Delete event"
                            aria-label="Delete event"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              openStudentById(
                                log.studentId,
                                log.studentName,
                                log.sectionId,
                                log.sectionName,
                                log.passesUsedAfter
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[11px] rounded-lg border border-slate-700 cursor-pointer"
                          >
                            <History className="w-3 h-3" />
                            History
                          </button>
                        </div>
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
