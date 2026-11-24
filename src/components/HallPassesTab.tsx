import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Ban,
  CheckCircle2,
  Clock,
  History,
  ListOrdered,
  Lock,
  MapPin,
  Minus,
  PictureInPicture2,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Ticket,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  MAX_QUARTER_PASSES,
  PASS_DESTINATIONS,
  type ClassSectionDoc,
  type PassDestination,
  type PassLogDoc,
  type StudentDoc,
} from '../types/classroom';
import { type DeadZoneStatus, formatCountdownMMSS } from '../lib/bellSchedule';
import { formatDurationExact } from './PassHistoryTab';

interface HallPassesTabProps {
  section: ClassSectionDoc | undefined;
  students: StudentDoc[];
  passLogs: PassLogDoc[];
  maxPasses?: number;
  maxConcurrentPasses?: number;
  warnPassAlertMinutes?: number;
  longPassAlertMinutes?: number;
  exemptDestinations?: PassDestination[];
  deadZone?: DeadZoneStatus;
  onIssuePass: (student: StudentDoc, destination: PassDestination) => Promise<void>;
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
  maxPasses = MAX_QUARTER_PASSES,
  maxConcurrentPasses = 1,
  warnPassAlertMinutes = 5,
  longPassAlertMinutes = 8,
  exemptDestinations = ['Nurse', 'Counselor'],
  deadZone,
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
  const [selectedDestination, setSelectedDestination] = useState<PassDestination>('Restroom');
  const [deadZoneOverride, setDeadZoneOverride] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [queuePickerId, setQueuePickerId] = useState('');

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const exemptSet = useMemo(() => new Set(exemptDestinations), [exemptDestinations]);
  const isSelectedExempt = exemptSet.has(selectedDestination);
  const isDeadZoneLocked = Boolean(deadZone?.locked) && !deadZoneOverride && !isSelectedExempt;

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
  const atOutLimit =
    maxConcurrentPasses > 0 && currentlyOut.length >= maxConcurrentPasses;
  const limitSummaryText =
    maxConcurrentPasses === 0
      ? 'Unlimited students out at a time'
      : maxConcurrentPasses === 1
      ? '1 student allowed out at a time'
      : `Up to ${maxConcurrentPasses} students out at a time`;

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
          st.passesUsed < maxPasses
      ),
    [sortedRoster, queuedIndexMap, maxPasses]
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-black text-lg text-white flex items-center gap-2">
              <span>🚽</span> Quarter Hall Pass &amp; Queue Tracker
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-amber-300">{limitSummaryText}</strong> · {maxPasses} passes/quarter · Alerts at{' '}
              <span className="text-amber-300 font-bold">{warnPassAlertMinutes}m</span> &amp;{' '}
              <span className="text-rose-400 font-bold">{longPassAlertMinutes}m</span>.
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
              title="Open pop-out Restroom Status, Queue & Door Kiosk window"
            >
              <PictureInPicture2 className="w-3.5 h-3.5" />
              Pop Out / Kiosk Window
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

        {/* Destination Tag Selector */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 mr-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              Pass Destination:
            </span>
            {PASS_DESTINATIONS.map((dest) => {
              const active = selectedDestination === dest.id;
              const exempt = exemptSet.has(dest.id);
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setSelectedDestination(dest.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-700'
                  }`}
                >
                  <span>{dest.label}</span>
                  {exempt && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                        active
                          ? 'bg-black/15 text-black'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      No Ticket
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {isSelectedExempt && (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {selectedDestination} logs to history without deducting a ticket
            </span>
          )}
        </div>
      </div>

      {/* Bell-Schedule Dead Zone Lockout Banner */}
      {deadZone?.locked && (
        <div
          className={`rounded-2xl p-4 border-2 flex flex-wrap items-center justify-between gap-3 ${
            deadZoneOverride
              ? 'bg-slate-900 border-amber-500/50'
              : 'bg-rose-950/45 border-rose-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                deadZoneOverride
                  ? 'bg-amber-400/20 text-amber-300'
                  : 'bg-rose-500/25 text-rose-300'
              }`}
            >
              {deadZoneOverride ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span>
                  {deadZoneOverride
                    ? 'Dead Zone Lockout Overridden by Teacher'
                    : `Hallway Dead Zone Active — ${deadZone.reason}`}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-950 text-amber-300 font-mono-tabular text-xs border border-slate-800">
                  Unlocks in {formatCountdownMMSS(deadZone.unlockCountdownSeconds)}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {deadZone.windowLabel}. Standard passes are paused (Nurse/Counselor remain available).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDeadZoneOverride((v) => !v)}
            className={`px-3.5 py-2 rounded-xl font-black text-xs border cursor-pointer transition-colors ${
              deadZoneOverride
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-amber-400 hover:bg-amber-300 text-black border-amber-300'
            }`}
          >
            {deadZoneOverride ? 'Re-Enable Lockout' : 'Teacher Override'}
          </button>
        </div>
      )}

      {/* Currently Out Live Banner (Two-Stage Visual Alerts) */}
      {currentlyOut.length > 0 && (
        <div className="bg-amber-950/35 border-2 border-amber-500/75 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <h3 className="font-black text-sm text-amber-300 tracking-wide">
                {currentlyOut.length === 1
                  ? 'Student Currently Out of Room'
                  : `${currentlyOut.length} Students Currently Out of Room`}{' '}
                ({maxConcurrentPasses === 0
                  ? 'Unlimited Limit'
                  : atOutLimit
                  ? `${currentlyOut.length}/${maxConcurrentPasses} Limit Reached`
                  : `${currentlyOut.length}/${maxConcurrentPasses} Slots Used`})
              </h3>
            </div>
            <span className="px-2.5 py-0.5 bg-amber-400 text-black font-black text-xs rounded-lg font-mono-tabular">
              {maxConcurrentPasses === 0
                ? `${currentlyOut.length} Out`
                : `${currentlyOut.length}/${maxConcurrentPasses} Out`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {currentlyOut.map((st) => {
              const elapsedSeconds = Math.max(0, Math.floor((nowMs - st.outTimestamp) / 1000));
              const isCritical = elapsedSeconds >= longPassAlertMinutes * 60;
              const isWarning = !isCritical && elapsedSeconds >= warnPassAlertMinutes * 60;
              const destLabel = st.activeDestination || 'Restroom';

              return (
                <div
                  key={st.id}
                  className={`bg-slate-900 border-2 rounded-xl p-3 flex items-center justify-between gap-2 ${
                    isCritical
                      ? 'border-rose-500 bg-rose-950/30 animate-pulse'
                      : isWarning
                      ? 'border-amber-400 bg-amber-950/25'
                      : 'border-amber-400/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-black text-xs text-white truncate">{st.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 shrink-0">
                        {destLabel}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-extrabold font-mono-tabular flex items-center gap-1 mt-1 ${
                        isCritical
                          ? 'text-rose-400'
                          : isWarning
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                      ) : (
                        <Clock className="w-3 h-3 shrink-0" />
                      )}
                      {isCritical ? 'OVERDUE · ' : isWarning ? 'Check Soon · ' : 'Out '}
                      {formatDurationExact(elapsedSeconds)}
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
            {!atOutLimit && queuedStudents[0] && (
              <span className="text-xs font-bold text-emerald-400">
                · Open slot ready for {queuedStudents[0].name}
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
                eligibleToQueue.map((st) => {
                  const left = Math.max(0, maxPasses - st.passesUsed);
                  return (
                    <option key={st.id} value={st.id}>
                      {st.name} ({left}/{maxPasses} left)
                    </option>
                  );
                })
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
                {!atOutLimit && idx === 0 && !isDeadZoneLocked && (st.passesUsed < maxPasses || isSelectedExempt) && (
                  <button
                    onClick={() => void onIssuePass(st, selectedDestination)}
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
            const passesRemaining = Math.max(0, maxPasses - st.passesUsed);
            const isMax = passesRemaining <= 0;
            const isOut = st.outTimestamp > 0;
            const elapsedSeconds = isOut ? Math.max(0, Math.floor((nowMs - st.outTimestamp) / 1000)) : 0;
            const isCritical = isOut && elapsedSeconds >= longPassAlertMinutes * 60;
            const queueIndex = queuedIndexMap.get(st.id);
            const isInLine = typeof queueIndex === 'number';
            const canExemptOverrideMax = isSelectedExempt && !isOut;

            return (
              <div
                key={st.id}
                className={`bg-slate-900 border rounded-xl p-3 flex flex-col justify-between space-y-2.5 transition-colors ${
                  isCritical
                    ? 'border-rose-500 bg-rose-950/25'
                    : isOut
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
                      onClick={() => onAdjustPassCount(st, 1)}
                      disabled={passesRemaining <= 0}
                      className="w-5 h-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 rounded flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                      title="Remove 1 pass"
                      aria-label={`Remove 1 pass for ${st.name}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onAdjustPassCount(st, -1)}
                      disabled={passesRemaining >= maxPasses}
                      className="w-5 h-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-300 rounded flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                      title="Restore 1 pass"
                      aria-label={`Restore 1 pass for ${st.name}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Ticket Visuals + Counter */}
                <div className="flex items-center justify-between border-t border-b border-slate-800/80 py-1.5 px-0.5 min-h-[30px]">
                  <div
                    className="flex items-center gap-0.5 flex-wrap"
                    aria-label={`${passesRemaining} of ${maxPasses} passes remaining`}
                  >
                    {passesRemaining === 0 ? (
                      <span className="text-[11px] font-semibold text-rose-400/90">
                        No passes left
                      </span>
                    ) : (
                      Array.from({ length: passesRemaining }, (_, idx) => (
                        <span
                          key={idx}
                          className="text-xs"
                          title="Pass Available"
                        >
                          🎟️
                        </span>
                      ))
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-black font-mono-tabular ${
                      isMax ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {passesRemaining}/{maxPasses}
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
                  ) : isMax && !canExemptOverrideMax ? (
                    <button
                      disabled
                      className="flex-1 py-1.5 bg-rose-950 text-rose-400 border border-rose-500/40 font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-not-allowed min-w-0"
                    >
                      <Ban className="w-3 h-3 shrink-0" />
                      <span className="truncate">Limit Reached</span>
                    </button>
                  ) : isDeadZoneLocked ? (
                    <button
                      disabled
                      className="flex-1 py-1.5 bg-slate-800/70 text-rose-300 border border-rose-500/30 font-extrabold text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-not-allowed font-mono-tabular min-w-0"
                      title="Locked during bell-schedule dead zone"
                    >
                      <Lock className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {formatCountdownMMSS(deadZone?.unlockCountdownSeconds || 0)}
                      </span>
                    </button>
                  ) : atOutLimit ? (
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
                        title={`Max ${maxConcurrentPasses} out at a time — add to restroom line`}
                      >
                        <ListOrdered className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Add to Line</span>
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => onIssuePass(st, selectedDestination)}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-black text-amber-300 font-extrabold text-[11px] rounded-lg border border-amber-500/30 flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0"
                    >
                      <Ticket className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {isInLine ? `Go (#${queueIndex! + 1})` : selectedDestination}
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
                  <th className="py-2 px-3 font-semibold">Destination</th>
                  <th className="py-2 px-3 font-semibold">Action &amp; Time Out</th>
                  <th className="py-2 px-3 font-semibold text-right">Passes Left</th>
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
                  const passesLeftAfter = Math.max(0, maxPasses - log.passesUsedAfter);
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
                        <span className="text-slate-200 font-semibold">
                          {log.destination || 'Restroom'}
                        </span>
                        {log.quotaExempt && (
                          <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Exempt
                          </span>
                        )}
                      </td>
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
                        {passesLeftAfter}/{maxPasses}
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
