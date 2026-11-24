import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', label: 'Spin Spotlight Picker', desc: 'Shuffles across tables in Projector View' },
  { key: 'T', label: 'Start / Pause Timer', desc: 'Opens Timer bar and toggles countdown' },
  { key: 'G', label: 'Reshuffle Groups', desc: 'Runs smart shuffle with rules & pairing memory' },
  { key: 'R', label: 'Rotate Table Roles', desc: 'Advances roles without changing student seats' },
  { key: 'P', label: 'Toggle Projector View', desc: 'Opens or exits full-screen projector display' },
  { key: '+ / -', label: 'Scale Projector Text', desc: 'Enlarge or shrink student names & text in Projector View' },
  { key: 'F', label: '10s Fist-to-Five Check', desc: 'Launches quick confidence check in Projector View' },
  { key: '?', label: 'Keyboard Shortcuts', desc: 'Opens or closes this quick reference' },
  { key: 'Esc', label: 'Close Modal / Exit Overlay', desc: 'Dismisses dialogs or active overlays' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                Keyboard &amp; Presenter Clicker Shortcuts
              </h3>
              <p className="text-xs text-slate-400">
                Single-key shortcuts stay disabled whenever typing inside an input field.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 cursor-pointer"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/70">
          {SHORTCUTS.map((sc) => (
            <div key={sc.key} className="py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-extrabold text-xs text-white block">{sc.label}</span>
                <span className="text-[11px] text-slate-400">{sc.desc}</span>
              </div>
              <kbd className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-black text-amber-300 font-mono-tabular shrink-0 min-w-[44px] text-center">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
