'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Tablet,
  Laptop,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Users,
  QrCode
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState('');
  const [customName, setCustomName] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential
      });
      window.google.accounts.id.renderButton(
        document.getElementById('googleSignInBtn'),
        { theme: 'outline', size: 'large', width: '100%' }
      );
    }
  }, []);

  const handleGoogleCredential = async (response) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      if (res.ok) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  const handleDemoLogin = async (userId, name) => {
    setLoadingUser(userId || name);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, customName: name })
      });
      if (res.ok) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Demo login error:', err);
    } finally {
      setLoadingUser('');
    }
  };

  const handlePairingSubmit = async (e) => {
    e.preventDefault();
    if (!pairingCode.trim()) return;

    setPairingLoading(true);
    setPairingError('');

    try {
      const res = await fetch('/api/pairing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairingCode.trim() })
      });

      const data = await res.json();
      if (res.ok && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        setPairingError(data.error || 'Invalid pairing code');
      }
    } catch (err) {
      setPairingError('Failed to verify pairing code');
    } finally {
      setPairingLoading(false);
    }
  };

  const isDemoEnabled =
    process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true' ||
    (process.env.NEXT_PUBLIC_ENABLE_DEMO !== 'false' && process.env.NODE_ENV !== 'production');
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/40">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Left Side: Product Branding & Visuals */}
        <div className="p-8 md:p-12 bg-slate-900 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">Collaborative Notebook</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight mb-4">
              Realtime Digital Notebook with Multi-Device Drawing
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Write, sketch, and think with low-latency CRDT synchronization. Turn any iPad or tablet into a live graphics tablet for your PC with a 6-digit code or QR scan.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="p-1.5 rounded-lg bg-slate-800 text-indigo-400">
                  <Tablet className="w-4 h-4" />
                </div>
                <span>Tablet-to-PC live drawing pad pairing</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="p-1.5 rounded-lg bg-slate-800 text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <span>Role-based collaboration (Owner, Editor, Viewer)</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-300">
                <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400">
                  <Layers className="w-4 h-4" />
                </div>
                <span>Multi-page notebook with checkpoint snapshots</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 text-xs text-slate-500">
            Powered by Yjs CRDTs, WebSockets, and Local-First Architecture.
          </div>
        </div>

        {/* Right Side: Auth / Instant Testing Profiles */}
        <div className="p-8 md:p-12 flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Sign in to your notebook</h2>
              <p className="text-xs text-slate-500 mt-1">Select an identity or pair as a drawing device</p>
            </div>

            {/* Google Sign-In Container */}
            <div id="googleSignInBtn" className="w-full"></div>

            {/* Production notice when Google auth is not configured and demo profiles are off */}
            {!googleClientId && !isDemoEnabled && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
                <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>Production Authentication Mode</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Demo profiles are disabled in production. Configure <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> for Google Sign-In, or connect via Tablet PIN pairing below.
                </p>
              </div>
            )}

            {isDemoEnabled && (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full"></div>
                  <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 absolute">
                    Instant Demo Profiles
                  </span>
                </div>

                {/* Quick Demo Profiles (Multi-User Pair Testing) */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('usr_demo_owner')}
                    disabled={Boolean(loadingUser)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        K
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">
                          Keshav (Owner)
                        </div>
                        <div className="text-[11px] text-slate-500">keshav@notebook.local • Full edit & share</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoLogin('usr_demo_editor')}
                    disabled={Boolean(loadingUser)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        A
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                          Alex Rivera (Editor)
                        </div>
                        <div className="text-[11px] text-slate-500">alex@notebook.local • Collaborative drawing</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoLogin('usr_demo_viewer')}
                    disabled={Boolean(loadingUser)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        S
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 group-hover:text-amber-900">
                          Sam Chen (Viewer)
                        </div>
                        <div className="text-[11px] text-slate-500">sam@notebook.local • Read-only observer</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>

                {/* Custom Guest Name */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Or enter custom guest name..."
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => customName.trim() && handleDemoLogin(null, customName.trim())}
                    disabled={!customName.trim() || Boolean(loadingUser)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    Join
                  </button>
                </div>
              </>
            )}

            {/* Tablet Pairing Code Box */}
            <div className="pt-4 border-t border-slate-100">
              <form onSubmit={handlePairingSubmit} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Connect Tablet with 6-Digit PIN</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder="e.g. 748-291"
                    maxLength={10}
                    className="flex-1 px-3 py-2 text-xs font-mono font-bold tracking-widest text-center uppercase rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={pairingLoading || !pairingCode.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    {pairingLoading ? 'Connecting...' : 'Pair Pad'}
                  </button>
                </div>
                {pairingError && <div className="text-[11px] text-rose-500 font-medium">{pairingError}</div>}
              </form>
            </div>
          </div>

          {isDemoEnabled && (
            <div className="pt-6 text-center text-[11px] text-slate-400">
              Open in multiple windows to simulate real-time collaboration.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
