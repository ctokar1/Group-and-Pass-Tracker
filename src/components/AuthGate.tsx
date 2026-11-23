import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { LogIn, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { signInWithGoogleAccount, signOutTeacher } from '../lib/firebase';
import { AUTHORIZED_TEACHER_EMAILS } from '../types/classroom';

interface AuthGateProps {
  authReady: boolean;
  user: User | null;
  isAuthorized: boolean;
}

export const AuthGate: React.FC<AuthGateProps> = ({ authReady, user, isAuthorized }) => {
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGoogleAccount();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in could not be completed.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    await signOutTeacher();
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center mx-auto font-extrabold text-xl">
            🐾
          </div>
          <h1 className="text-lg font-bold text-white">Tiger GroupCraft & Pass Tracker</h1>
          <p className="text-sm text-slate-400">Connecting to Google Sign-In and live classroom database...</p>
        </div>
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Access Restricted</h1>
              <p className="text-xs text-slate-400">CHUH Heights High Shared Pass Tracker</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
            <p className="text-slate-300">
              Signed in as <span className="font-semibold text-white">{user.email || 'Unknown account'}</span>.
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              This classroom tracker is restricted to authorized teachers:{' '}
              <span className="text-amber-300 font-medium">{AUTHORIZED_TEACHER_EMAILS.join(' & ')}</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleSignOut}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              Switch Google Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black text-2xl shrink-0">
            🐾
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Tiger GroupCraft & Pass Tracker
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              CHUH Heights High · Live Classroom Sync
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <p>
            Sign in with your authorized Google account to sync hall passes, class rosters, color groups, and live pass logs across devices in real time.
          </p>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white block">Authorized Google Accounts</span>
              <span className="text-amber-300 font-mono-tabular">c_tokar@chuh.org</span>
              <span className="text-slate-500 mx-1.5">·</span>
              <span className="text-amber-300 font-mono-tabular">J_kravitz@chuh.org</span>
            </div>
          </div>
        </div>

        {authError && (
          <div className="bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs rounded-xl p-3">
            {authError}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-60"
        >
          <LogIn className="w-4 h-4" />
          {signingIn ? 'Opening Google Sign-In...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
};
