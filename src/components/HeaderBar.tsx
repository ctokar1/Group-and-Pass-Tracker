import React from 'react';
import {
  Cloud,
  Keyboard,
  LogOut,
  Monitor,
  PictureInPicture2,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { ActiveTab, ClassSectionDoc } from '../types/classroom';

interface HeaderBarProps {
  sections: ClassSectionDoc[];
  activeSectionId: string;
  teacherEmail: string;
  syncing: boolean;
  activeTab: ActiveTab;
  currentlyOutCount: number;
  currentBellSlotLabel?: string | null;
  onSwitchSection: (sectionId: string) => void;
  onOpenAddSection: () => void;
  onOpenProjector: () => void;
  onOpenSpotlight: () => void;
  onOpenPassPopout: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onSignOut: () => void;
  onSwitchTab: (tab: ActiveTab) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  sections,
  activeSectionId,
  teacherEmail,
  syncing,
  activeTab,
  currentlyOutCount,
  currentBellSlotLabel,
  onSwitchSection,
  onOpenAddSection,
  onOpenProjector,
  onOpenSpotlight,
  onOpenPassPopout,
  onOpenSettings,
  onOpenShortcuts,
  onSignOut,
  onSwitchTab,
}) => {
  const tabs: Array<{ id: ActiveTab; label: string; emoji: string }> = [
    { id: 'groups', label: 'Color Groups', emoji: '🎨' },
    { id: 'roster', label: 'Class Roster', emoji: '📋' },
    { id: 'settings', label: 'Group Rules & Sections', emoji: '🧩' },
    { id: 'passes', label: 'Hall Passes', emoji: '🚽' },
    { id: 'history', label: 'Pass History', emoji: '📜' },
  ];

  return (
    <>
      <header className="no-print bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 flex items-center justify-center text-black font-black text-xl">
              🐾
            </div>
            <div>
              <h1 className="font-extrabold text-lg sm:text-xl text-white tracking-tight leading-none whitespace-nowrap">
                Tiger GroupCraft
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-1 whitespace-nowrap">
                CHUH Heights High · Live Pass &amp; Station Sync
                {currentBellSlotLabel && (
                  <span className="ml-2 text-amber-300 font-mono-tabular">
                    · Bell {currentBellSlotLabel}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Class Section Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <label htmlFor="headerSectionSelect" className="text-xs font-bold text-slate-400 px-2.5 whitespace-nowrap">
              Period:
            </label>
            <select
              id="headerSectionSelect"
              value={activeSectionId}
              onChange={(e) => onSwitchSection(e.target.value)}
              className="bg-slate-900 text-amber-300 text-xs sm:text-sm font-extrabold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400 border border-slate-700 max-w-[220px] truncate cursor-pointer"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
            <button
              onClick={onOpenAddSection}
              className="ml-1 p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Add New Class Period"
              aria-label="Add New Class Period"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Actions & Google Sync Identity */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5"
              title={`Signed in as ${teacherEmail} · Synced live to Google Cloud`}
            >
              <Cloud className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span className="font-semibold text-emerald-400 whitespace-nowrap">
                {syncing ? 'Syncing...' : 'Cloud Synced'}
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-300 font-medium truncate max-w-[150px]">{teacherEmail}</span>
              <button
                onClick={onSignOut}
                className="ml-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Sign out of Google account"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onOpenProjector}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              Projector View
            </button>
            <button
              onClick={onOpenSpotlight}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Spotlight
            </button>
            <button
              onClick={onOpenPassPopout}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              title="Pop out Restroom Status, Queue & Door Kiosk window"
            >
              <PictureInPicture2 className="w-4 h-4" />
              Pass Window
            </button>
            <button
              onClick={onOpenShortcuts}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer"
              title="Keyboard & Presenter Clicker Shortcuts (?)"
              aria-label="Open keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 hover:text-white rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer"
              title="Classroom Settings & Color Themes"
              aria-label="Open Settings and Color Themes"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="no-print bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-[65px] z-20">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSwitchTab(tab.id)}
                className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-amber-400 text-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {tab.id === 'passes' && currentlyOutCount > 0 && (
                  <span
                    className={`font-mono-tabular text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-black/15 text-black' : 'bg-amber-400/20 text-amber-300'
                    }`}
                  >
                    {currentlyOutCount} out
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
