import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Pencil, Trash2, X } from 'lucide-react';
import {
  MAX_QUARTER_PASSES,
  PASS_DESTINATIONS,
  type PassAction,
  type PassDestination,
  type PassLogDoc,
  type StudentDoc,
} from '../types/classroom';
import {
  formatDurationExact,
  getLogCreatedMillis,
  getLogReturnedMillis,
  getLogTakenMillis,
} from './StudentHistoryModal';

function toLocalDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeInputValue(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function combineLocalDateAndTime(dateStr: string, timeStr: string): number | null {
  if (!dateStr) return null;
  const normalizedTime = timeStr && timeStr.length >= 5 ? (timeStr.length === 5 ? `${timeStr}:00` : timeStr) : '00:00:00';
  const parsed = new Date(`${dateStr}T${normalizedTime}`);
  const ms = parsed.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/* 1. Edit Pass Log Modal */
interface EditPassLogModalProps {
  log: PassLogDoc | null;
  maxPasses?: number;
  liveStudent?: StudentDoc;
  onSave: (
    log: PassLogDoc,
    patch: {
      action: PassAction;
      destination: PassDestination;
      quotaExempt: boolean;
      passesUsedAfter: number;
      takenAt: number;
      returnedAt: number;
      durationSeconds: number;
    },
    alsoUpdateStudent?: {
      sectionId: string;
      studentId: string;
      passesUsed: number;
      outTimestamp: number;
    }
  ) => Promise<void>;
  onDelete: (log: PassLogDoc) => Promise<void>;
  onClose: () => void;
}

export const EditPassLogModal: React.FC<EditPassLogModalProps> = ({
  log,
  maxPasses = MAX_QUARTER_PASSES,
  liveStudent,
  onSave,
  onDelete,
  onClose,
}) => {
  const [action, setAction] = useState<PassAction>('returned');
  const [destination, setDestination] = useState<PassDestination>('Restroom');
  const [quotaExempt, setQuotaExempt] = useState(false);
  const [takenDate, setTakenDate] = useState('');
  const [takenTime, setTakenTime] = useState('');
  const [returnedDate, setReturnedDate] = useState('');
  const [returnedTime, setReturnedTime] = useState('');
  const [durMinutes, setDurMinutes] = useState('0');
  const [durSeconds, setDurSeconds] = useState('0');
  const [passesLeftAfter, setPassesLeftAfter] = useState(maxPasses);
  const [syncLiveStudent, setSyncLiveStudent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!log) return;
    setConfirmDelete(false);
    setSyncLiveStudent(false);
    setAction(log.action);
    setDestination(log.destination || 'Restroom');
    setQuotaExempt(Boolean(log.quotaExempt));

    const takenMs =
      log.action === 'returned'
        ? getLogTakenMillis(log)
        : typeof log.takenAt === 'number' && log.takenAt > 0
        ? log.takenAt
        : getLogCreatedMillis(log);
    const returnedMs =
      log.action === 'returned'
        ? getLogReturnedMillis(log)
        : typeof log.returnedAt === 'number' && log.returnedAt > 0
        ? log.returnedAt
        : takenMs;

    setTakenDate(toLocalDateInputValue(takenMs));
    setTakenTime(toLocalTimeInputValue(takenMs));
    setReturnedDate(toLocalDateInputValue(returnedMs));
    setReturnedTime(toLocalTimeInputValue(returnedMs));

    const totalSecs =
      typeof log.durationSeconds === 'number'
        ? log.durationSeconds
        : Math.max(0, Math.round((log.durationMinutes || 0) * 60));
    setDurMinutes(String(Math.floor(totalSecs / 60)));
    setDurSeconds(String(totalSecs % 60));
    setPassesLeftAfter(Math.max(0, maxPasses - log.passesUsedAfter));
  }, [log, maxPasses]);

  if (!log) return null;

  const recalcDurationFromTimes = (
    tDate: string,
    tTime: string,
    rDate: string,
    rTime: string
  ) => {
    const tMs = combineLocalDateAndTime(tDate, tTime);
    const rMs = combineLocalDateAndTime(rDate, rTime);
    if (tMs !== null && rMs !== null) {
      const diffSecs = Math.max(0, Math.round((rMs - tMs) / 1000));
      setDurMinutes(String(Math.floor(diffSecs / 60)));
      setDurSeconds(String(diffSecs % 60));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const tMs = combineLocalDateAndTime(takenDate, takenTime) ?? getLogTakenMillis(log);
    const rMsRaw =
      action === 'returned'
        ? combineLocalDateAndTime(returnedDate, returnedTime) ?? tMs
        : 0;
    const rMs = action === 'returned' ? Math.max(tMs, rMsRaw) : 0;

    const m = Math.max(0, parseInt(durMinutes, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt(durSeconds, 10) || 0));
    const totalDurationSeconds = action === 'returned' ? m * 60 + s : 0;

    const passesUsedAfter = Math.max(0, Math.min(maxPasses, maxPasses - passesLeftAfter));

    setSaving(true);
    try {
      await onSave(
        log,
        {
          action,
          destination,
          quotaExempt,
          passesUsedAfter,
          takenAt: tMs,
          returnedAt: rMs,
          durationSeconds: totalDurationSeconds,
        },
        syncLiveStudent && liveStudent && log.studentId !== 'ALL'
          ? {
              sectionId: liveStudent.sectionId,
              studentId: liveStudent.id,
              passesUsed: passesUsedAfter,
              outTimestamp: liveStudent.outTimestamp || 0,
            }
          : undefined
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onDelete(log);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewDurationSecs =
    action === 'returned'
      ? (Math.max(0, parseInt(durMinutes, 10) || 0) * 60) +
        Math.max(0, Math.min(59, parseInt(durSeconds, 10) || 0))
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <Pencil className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-base text-white truncate">
                Edit Pass History Entry
              </h3>
              <p className="text-xs text-amber-300 font-bold truncate">
                {log.studentName} · {log.sectionName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
            aria-label="Close edit modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="edit-log-action"
                className="text-xs font-bold text-slate-300 block"
              >
                Event Type
              </label>
              <select
                id="edit-log-action"
                value={action}
                onChange={(e) => setAction(e.target.value as PassAction)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="returned">Returned to Class</option>
                <option value="issued">Issued Pass</option>
                <option value="adjusted">Adjusted Count</option>
                <option value="reset">Quarter Reset</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="edit-log-destination"
                className="text-xs font-bold text-slate-300 block"
              >
                Destination
              </label>
              <select
                id="edit-log-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value as PassDestination)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {PASS_DESTINATIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="edit-log-passes-left"
                className="text-xs font-bold text-slate-300 block"
              >
                Passes Left After Event (of {maxPasses})
              </label>
              <input
                id="edit-log-passes-left"
                type="number"
                min={0}
                max={maxPasses}
                value={passesLeftAfter}
                onChange={(e) =>
                  setPassesLeftAfter(
                    Math.max(0, Math.min(maxPasses, parseInt(e.target.value, 10) || 0))
                  )
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-amber-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quotaExempt}
                  onChange={(e) => setQuotaExempt(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-400 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-200">
                  Quota Exempt (No Ticket Used)
                </span>
              </label>
            </div>
          </div>

          {/* Taken Date & Time */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
            <span className="text-xs font-bold text-slate-300 block">
              Date &amp; Time Taken
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                aria-label="Date taken"
                value={takenDate}
                onChange={(e) => {
                  setTakenDate(e.target.value);
                  if (action === 'returned') {
                    recalcDurationFromTimes(e.target.value, takenTime, returnedDate, returnedTime);
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="time"
                step={1}
                aria-label="Time taken"
                value={takenTime}
                onChange={(e) => {
                  setTakenTime(e.target.value);
                  if (action === 'returned') {
                    recalcDurationFromTimes(takenDate, e.target.value, returnedDate, returnedTime);
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Returned Date & Time + Duration */}
          {action === 'returned' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Date &amp; Time Returned
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label="Date returned"
                    value={returnedDate}
                    onChange={(e) => {
                      setReturnedDate(e.target.value);
                      recalcDurationFromTimes(takenDate, takenTime, e.target.value, returnedTime);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="time"
                    step={1}
                    aria-label="Time returned"
                    value={returnedTime}
                    onChange={(e) => {
                      setReturnedTime(e.target.value);
                      recalcDurationFromTimes(takenDate, takenTime, returnedDate, e.target.value);
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Time Out ({formatDurationExact(previewDurationSecs)})
                </span>
                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    type="number"
                    min={0}
                    max={10080}
                    aria-label="Minutes out"
                    value={durMinutes}
                    onChange={(e) => setDurMinutes(e.target.value)}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-black text-amber-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-slate-400 font-semibold">min</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    aria-label="Seconds out"
                    value={durSeconds}
                    onChange={(e) => setDurSeconds(e.target.value)}
                    className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-black text-amber-300 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-slate-400 font-semibold">sec</span>
                </div>
              </div>
            </div>
          )}

          {liveStudent && log.studentId !== 'ALL' && (
            <label className="flex items-center gap-2.5 bg-slate-950/60 border border-slate-800 rounded-xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={syncLiveStudent}
                onChange={(e) => setSyncLiveStudent(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 focus:ring-amber-400 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-200">
                Also update <strong className="text-amber-300">{liveStudent.name}</strong>&apos;s current pass count to{' '}
                <strong className="text-amber-300">
                  {passesLeftAfter}/{maxPasses} left
                </strong>
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/50 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Entry
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl cursor-pointer"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Keep
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-black text-xs rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

/* 2. Clear Pass History Confirmation Modal */
interface ClearHistoryModalProps {
  open: boolean;
  sectionId?: string;
  sectionName?: string;
  sectionLogCount: number;
  totalLogCount: number;
  onConfirmClear: (scopeSectionId: string | 'ALL') => Promise<void>;
  onClose: () => void;
}

export const ClearHistoryModal: React.FC<ClearHistoryModalProps> = ({
  open,
  sectionId,
  sectionName,
  sectionLogCount,
  totalLogCount,
  onConfirmClear,
  onClose,
}) => {
  const [clearing, setClearing] = useState(false);

  if (!open) return null;

  const handleClear = async (scope: string | 'ALL') => {
    if (clearing) return;
    setClearing(true);
    try {
      await onConfirmClear(scope);
      onClose();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 text-center shadow-2xl"
      >
        <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="font-black text-xl text-white">Clear Pass History?</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          This permanently deletes recorded pass history log entries. Student current quarter pass balances will <strong className="text-amber-300">not</strong> be changed.
        </p>

        <div className="space-y-2 pt-2">
          {sectionId && sectionLogCount > 0 && (
            <button
              type="button"
              onClick={() => void handleClear(sectionId)}
              disabled={clearing}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-black text-xs rounded-xl cursor-pointer"
            >
              Clear {sectionName || 'This Period'} Only ({sectionLogCount} entries)
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleClear('ALL')}
            disabled={clearing || totalLogCount === 0}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs rounded-xl cursor-pointer"
          >
            Clear All Pass History ({totalLogCount} entries)
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={clearing}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
