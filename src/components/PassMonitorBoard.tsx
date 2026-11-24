import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListOrdered,
  Lock,
  Monitor,
  Plus,
  QrCode,
  Search,
  Tablet,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  MAX_QUARTER_PASSES,
  PASS_DESTINATIONS,
  type ClassSectionDoc,
  type PassDestination,
  type StudentDoc,
} from '../types/classroom';
import { type DeadZoneStatus, formatCountdownMMSS } from '../lib/bellSchedule';
import { formatDurationExact } from './StudentHistoryModal';

interface PassMonitorBoardProps {
  section: ClassSectionDoc | undefined;
  sections?: ClassSectionDoc[];
  students: StudentDoc[];
  standalone?: boolean;
  maxPasses?: number;
  maxConcurrentPasses?: number;
  warnPassAlertMinutes?: number;
  longPassAlertMinutes?: number;
  exemptDestinations?: PassDestination[];
  deadZone?: DeadZoneStatus;
  onSwitchSection?: (sectionId: string) => void;
  onAddToQueue: (studentId: string) => Promise<void>;
  onRemoveFromQueue: (studentId: string) => Promise<void>;
  onMoveQueueUp: (studentId: string) => Promise<void>;
  onClearQueue: () => Promise<void>;
  onIssuePass: (student: StudentDoc, destination: PassDestination) => Promise<void>;
  onReturnStudent: (student: StudentDoc) => Promise<void>;
  onClose?: () => void;
  standaloneUrl?: string;
}

export const PassMonitorBoard: React.FC<PassMonitorBoardProps> = ({
  section,
  sections,
  students,
  standalone = false,
  maxPasses = MAX_QUARTER_PASSES,
  maxConcurrentPasses = 1,
  warnPassAlertMinutes = 5,
  longPassAlertMinutes = 8,
  exemptDestinations = ['Nurse', 'Counselor'],
  deadZone,
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
  const [boardMode, setBoardMode] = useState<'monitor' | 'kiosk'>(
    standalone ? 'kiosk' : 'monitor'
  );
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [kioskDestination, setKioskDestination] = useState<PassDestination>('Restroom');
  const [badgeInput, setBadgeInput] = useState('');
  const [kioskSearch, setKioskSearch] = useState('');
  const [kioskFeedback, setKioskFeedback] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const exemptSet = useMemo(() => new Set(exemptDestinations), [exemptDestinations]);
  const isSelectedExempt = exemptSet.has(kioskDestination);
  const isDeadZoneLocked = Boolean(deadZone?.locked) && !isSelectedExempt;

  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students]
  );

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );

  const currentlyOut = useMemo(
    () =>
      students
        .filter((s) => s.outTimestamp > 0)
        .sort((a, b) => a.outTimestamp - b.outTimestamp),
    [students]
  );
  const atOutLimit =
    maxConcurrentPasses > 0 && currentlyOut.length >= maxConcurrentPasses;
  const slotsOpen =
    maxConcurrentPasses === 0
      ? null
      : Math.max(0, maxConcurrentPasses - currentlyOut.length);

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
      sortedStudents.filter(
        (st) =>
          st.outTimestamp <= 0 &&
          !queuedIdSet.has(st.id) &&
          st.passesUsed < maxPasses
      ),
    [sortedStudents, queuedIdSet, maxPasses]
  );

  useEffect(() => {
    if (
      selectedStudentId &&
      !eligibleToQueue.some((st) => st.id === selectedStudentId)
    ) {
      setSelectedStudentId('');
    }
  }, [eligibleToQueue, selectedStudentId]);

  const showTempFeedback = (msg: string) => {
    setKioskFeedback(msg);
    window.setTimeout(() => {
      setKioskFeedback((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

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

  const handleKioskStudentAction = async (st: StudentDoc) => {
    if (busy) return;
    setBusy(true);
    try {
      if (st.outTimestamp > 0) {
        await onReturnStudent(st);
        showTempFeedback(`Welcome back, ${st.name.split(' ')[0]}!`);
        return;
      }
      if (isDeadZoneLocked) {
        showTempFeedback(
          `Locked during ${deadZone?.reason || 'dead zone'} (${formatCountdownMMSS(
            deadZone?.unlockCountdownSeconds || 0
          )})`
        );
        return;
      }
      if (!isSelectedExempt && st.passesUsed >= maxPasses) {
        showTempFeedback(`${st.name} has 0/${maxPasses} passes remaining.`);
        return;
      }
      if (atOutLimit) {
        if (queuedIdSet.has(st.id)) {
          await onRemoveFromQueue(st.id);
          showTempFeedback(`Removed ${st.name} from line.`);
        } else {
          await onAddToQueue(st.id);
          showTempFeedback(`${st.name} added to line!`);
        }
        return;
      }
      await onIssuePass(st, kioskDestination);
      showTempFeedback(`${st.name} checked out (${kioskDestination}).`);
    } finally {
      setBusy(false);
    }
  };

  const handleBadgeScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = badgeInput.trim().toLowerCase();
    if (!code) return;
    const match = students.find(
      (st) =>
        (st.badgeCode && st.badgeCode.trim().toLowerCase() === code) ||
        st.id.toLowerCase() === code ||
        st.name.toLowerCase() === code
    );
    setBadgeInput('');
    if (!match) {
      showTempFeedback(`No student badge or name matched "${code}".`);
      return;
    }
    await handleKioskStudentAction(match);
  };

  const kioskFilteredStudents = useMemo(() => {
    const q = kioskSearch.trim().toLowerCase();
    if (!q) return sortedStudents;
    return sortedStudents.filter(
      (st) =>
        st.name.toLowerCase().includes(q) ||
        (st.badgeCode && st.badgeCode.toLowerCase().includes(q))
    );
  }, [sortedStudents, kioskSearch]);

  return (
    <div
      className={`bg-slate-950 text-slate-100 flex flex-col ${
        standalone ? 'min-h-screen p-4 sm:p-6' : 'h-full p-4'
      } gap-3.5`}
    >
      {/* Top Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl">{boardMode === 'kiosk' ? '📲' : '🚽'}</span>
          <div className="min-w-0">
            <h2 className="font-black text-base sm:text-lg text-white truncate">
              {boardMode === 'kiosk'
                ? 'Self-Service Door Kiosk & Queue'
                : 'Restroom Status & Next-Up Line'}
            </h2>
            <p className="text-xs text-amber-400 font-bold truncate">
              {section?.name || 'Class Period'} ·{' '}
              {maxConcurrentPasses === 0
                ? 'Unlimited students out at a time'
                : maxConcurrentPasses === 1
                ? '1 student out at a time'
                : `Up to ${maxConcurrentPasses} students out at a time`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Monitor vs Self-Service Door Kiosk Mode Switch */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setBoardMode('monitor')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                boardMode === 'monitor'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Monitor
            </button>
            <button
              type="button"
              onClick={() => setBoardMode('kiosk')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                boardMode === 'kiosk'
                  ? 'bg-amber-400 text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
              Door Kiosk
            </button>
          </div>

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

      {/* Dead Zone Lockout Notice */}
      {deadZone?.locked && (
        <div className="rounded-2xl px-4 py-3 border-2 border-rose-500 bg-rose-950/45 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs font-black text-rose-200">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Dead Zone Active ({deadZone.reason}) — Standard passes paused</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 text-amber-300 font-mono-tabular font-black text-xs">
            Unlocks in {formatCountdownMMSS(deadZone.unlockCountdownSeconds)}
          </span>
        </div>
      )}

      {/* Live Restroom Availability Hero */}
      {currentlyOut.length > 0 && (
        <div className="space-y-2 shrink-0">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              Currently Out ({maxConcurrentPasses === 0 ? `${currentlyOut.length}` : `${currentlyOut.length}/${maxConcurrentPasses}`})
            </span>
            {!atOutLimit && (
              <span className="text-xs font-black text-emerald-400">
                {slotsOpen === null
                  ? 'More slots open'
                  : `${slotsOpen} pass ${slotsOpen === 1 ? 'slot' : 'slots'} open`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-0.5">
            {currentlyOut.map((st) => {
              const elapsedSec = Math.max(0, Math.floor((nowMs - st.outTimestamp) / 1000));
              const critical = elapsedSec >= longPassAlertMinutes * 60;
              const warning = !critical && elapsedSec >= warnPassAlertMinutes * 60;
              return (
                <div
                  key={st.id}
                  className={`rounded-2xl p-3.5 border-2 flex flex-wrap items-center justify-between gap-3 ${
                    critical
                      ? 'bg-rose-950/50 border-rose-500 animate-pulse'
                      : warning
                      ? 'bg-amber-950/50 border-amber-400'
                      : 'bg-amber-950/35 border-amber-400'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            critical ? 'bg-rose-400' : 'bg-amber-400'
                          }`}
                        />
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                            critical ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                        />
                      </span>
                      <span
                        className={`text-[11px] font-black uppercase tracking-wider ${
                          critical ? 'text-rose-300' : 'text-amber-300'
                        }`}
                      >
                        {critical
                          ? `OVERDUE (${longPassAlertMinutes}m+)`
                          : warning
                          ? `Check-In Soon (${warnPassAlertMinutes}m+)`
                          : atOutLimit
                          ? 'Out · Limit Reached'
                          : 'Currently Out'}
                      </span>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-white truncate flex items-center gap-2">
                      <span>{st.name}</span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-300">
                        {st.activeDestination || 'Restroom'}
                      </span>
                    </div>
                    <div
                      className={`text-xs font-extrabold font-mono-tabular flex items-center gap-1.5 ${
                        critical ? 'text-rose-300' : 'text-amber-300'
                      }`}
                    >
                      {critical ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      Out for {formatDurationExact(elapsedSec)}
                    </div>
                  </div>

                  <button
                    onClick={() => void onReturnStudent(st)}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    I&apos;m Back
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!atOutLimit && (
        <div className="rounded-2xl p-4 border-2 border-emerald-500/80 bg-emerald-950/30 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              {currentlyOut.length === 0
                ? 'Pass Available (0 Out)'
                : maxConcurrentPasses === 0
                ? `Pass Available (${currentlyOut.length} Out · Unlimited)`
                : `Pass Slot Open (${currentlyOut.length}/${maxConcurrentPasses} Out)`}
            </span>
            <div className="text-lg sm:text-xl font-black text-white">
              {queuedStudents[0]
                ? `Next Up: ${queuedStudents[0].name}`
                : currentlyOut.length === 0
                ? 'No one is currently out'
                : 'Additional pass slot available'}
            </div>
            <p className="text-xs text-slate-300">
              {boardMode === 'kiosk'
                ? 'Scan your ID badge or tap your name below to check out.'
                : queuedStudents[0]
                ? 'Ready for the next student in line to take a pass.'
                : 'Add your name below to join the line or issue a pass.'}
            </p>
          </div>

          {queuedStudents[0] && !isDeadZoneLocked && (
            <button
              onClick={() => void onIssuePass(queuedStudents[0], kioskDestination)}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-sm rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              Send Next ({queuedStudents[0].name.split(' ')[0]})
            </button>
          )}
        </div>
      )}

      {kioskFeedback && (
        <div className="px-4 py-2.5 rounded-xl bg-amber-400 text-black font-black text-xs text-center shrink-0">
          {kioskFeedback}
        </div>
      )}

      {boardMode === 'kiosk' ? (
        /* SELF-SERVICE STUDENT KIOSK MODE */
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Destination + Badge Scanner + Name Search */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {PASS_DESTINATIONS.map((d) => {
                const active = kioskDestination === d.id;
                const exempt = exemptSet.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setKioskDestination(d.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-colors ${
                      active
                        ? 'bg-amber-400 text-black border-amber-300'
                        : 'bg-slate-950 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {d.shortLabel}
                    {exempt ? ' · No Ticket' : ''}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <form onSubmit={handleBadgeScanSubmit} className="relative flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={badgeInput}
                  onChange={(e) => setBadgeInput(e.target.value)}
                  placeholder="Scan / Type Student Badge ID & Enter..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-mono-tabular font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </form>

              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={kioskSearch}
                  onChange={(e) => setKioskSearch(e.target.value)}
                  placeholder="Tap / Filter student name..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Touch Grid + Compact Line Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex-1 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {kioskFilteredStudents.map((st) => {
                const left = Math.max(0, maxPasses - st.passesUsed);
                const isOut = st.outTimestamp > 0;
                const inQueue = queuedIdSet.has(st.id);
                const isMax = left <= 0 && !isSelectedExempt;
                const disabled = !isOut && (isDeadZoneLocked || (isMax && !atOutLimit));

                return (
                  <button
                    key={st.id}
                    type="button"
                    disabled={busy || disabled}
                    onClick={() => void handleKioskStudentAction(st)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex flex-col justify-between gap-1.5 ${
                      isOut
                        ? 'bg-emerald-500 text-black border-emerald-300 font-black'
                        : inQueue
                        ? 'bg-sky-950/70 border-sky-400/70 text-white'
                        : isMax
                        ? 'bg-rose-950/30 border-rose-500/40 text-slate-400'
                        : 'bg-slate-950 hover:border-amber-400 border-slate-800 text-white'
                    }`}
                  >
                    <span className="font-extrabold text-sm truncate block w-full">
                      {st.name}
                    </span>
                    <div className="flex items-center justify-between text-[11px] font-mono-tabular w-full">
                      <span>
                        {isOut
                          ? 'Tap: Return'
                          : inQueue
                          ? 'In Line'
                          : atOutLimit
                          ? 'Tap: Join Line'
                          : isDeadZoneLocked
                          ? 'Locked'
                          : isMax
                          ? '0 Passes'
                          : `Go (${kioskDestination})`}
                      </span>
                      <span className="font-black">
                        {left}/{maxPasses}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD MONITOR + QUEUE VIEW */
        <>
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
                      {st.name} ({Math.max(0, maxPasses - st.passesUsed)}/{maxPasses} passes left)
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
                  const isMax = st.passesUsed >= maxPasses;
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
                            {Math.max(0, maxPasses - st.passesUsed)}/{maxPasses} passes left
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!atOutLimit && isNext && !isMax && !isDeadZoneLocked && (
                          <button
                            onClick={() => void onIssuePass(st, kioskDestination)}
                            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg cursor-pointer"
                          >
                            Go Now
                          </button>
                        )}
                        {isMax && (
                          <span className="px-2 py-1 bg-rose-950 text-rose-400 text-[11px] font-bold rounded-lg flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            0/{maxPasses}
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
        </>
      )}
    </div>
  );
};
