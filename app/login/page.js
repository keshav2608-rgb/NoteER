'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
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
import ThemeToggle from '@/components/theme/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [loadingUser, setLoadingUser] = useState('');
  const [customName, setCustomName] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Dynamic Google Auth & Demo config state
  const [googleClientId, setGoogleClientId] = useState(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '');
  const [isDemoEnabled, setIsDemoEnabled] = useState(
    process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true' ||
    (process.env.NEXT_PUBLIC_ENABLE_DEMO !== 'false' && process.env.NODE_ENV !== 'production')
  );
  const [googleRendered, setGoogleRendered] = useState(false);
  const [authError, setAuthError] = useState('');

  const googleBtnRef = useRef(null);

  // Fetch dynamic runtime config from server to prevent build-time inlining issues
  useEffect(() => {
    fetch('/api/auth/config')
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg.googleClientId) {
          setGoogleClientId(cfg.googleClientId);
        }
        if (typeof cfg.isDemoEnabled === 'boolean') {
          setIsDemoEnabled(cfg.isDemoEnabled);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch auth config:', err);
      });
  }, []);

  const getRedirectPath = () => {
    if (typeof window === 'undefined') return '/dashboard';
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || '/dashboard';
  };

  const handleGoogleCredential = async (response) => {
    setAuthError('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (res.ok) {
        router.push(getRedirectPath());
      } else {
        const errorMsg = data.hint
          ? `${data.error} — ${data.hint}`
          : (data.details ? `${data.error} (${data.details})` : (data.error || 'Google authentication failed'));
        setAuthError(errorMsg);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setAuthError('Connection error during sign-in: ' + (err.message || ''));
    }
  };

  const renderGoogleButton = useCallback((clientIdOverride) => {
    const idToUse = clientIdOverride || googleClientId;
    if (!idToUse || !googleBtnRef.current) return false;

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: idToUse,
          callback: handleGoogleCredential
        });

        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          shape: 'rectangular',
          text: 'signin_with'
        });
        setGoogleRendered(true);
        return true;
      } catch (err) {
        console.error('Error rendering Google button:', err);
        return false;
      }
    }
    return false;
  }, [googleClientId]);

  // Robust retry mechanism: polls every 100ms for up to 5s until Google script loads
  useEffect(() => {
    if (!googleClientId) return;

    if (renderGoogleButton(googleClientId)) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (renderGoogleButton(googleClientId) || attempts > 50) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [googleClientId, renderGoogleButton]);

  const handleDemoLogin = async (userId, name) => {
    setLoadingUser(userId || name);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, customName: name })
      });
      if (res.ok) {
        router.push(getRedirectPath());
      } else {
        const data = await res.json();
        setAuthError(data.error || 'Demo login failed');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setAuthError('Demo login connection failed');
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

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/50 dark:from-[#050608] dark:via-[#090b10] dark:to-[#0f111a] text-slate-900 dark:text-slate-100 relative">
      {/* Subtle Ambient Background Mesh Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Floating Theme Toggle */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-40">
        <ThemeToggle />
      </div>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => renderGoogleButton()}
      />

      {/* Double-Bezel Hardware Outer Shell */}
      <div className="max-w-4xl w-full my-auto p-1.5 sm:p-2.5 rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900/5 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5">
        {/* Inner Core Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 rounded-[1.65rem] sm:rounded-[2.15rem] border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-[#0c0e15] overflow-hidden shadow-sm">
          
          {/* Left Side: Editorial Dark Branding & Features */}
          <div className="p-7 sm:p-10 md:p-12 bg-[#090b10] text-white flex flex-col justify-between relative overflow-hidden">
            {/* Ambient Radial Accent */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            
            <div className="relative z-10">
              {/* Monospace Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-indigo-300 font-mono text-[10px] uppercase tracking-[0.2em] mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>REALTIME CRDT STUDIO</span>
              </div>

              {/* Logo / Title */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg tracking-tight text-white">Collaborative Notebook</div>
                  <div className="text-[11px] text-slate-400 font-mono">v1.0 • Canvas + Yjs Engine</div>
                </div>
              </div>

              {/* Headline */}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-snug mb-3">
                Where ideas flow with pen, paper & team sync.
              </h1>

              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-8">
                Infinite digital canvas with ultra-low latency CRDT synchronization. Turn any iPad or tablet into a live graphics tablet with stylus pressure and tilt.
              </p>

              {/* Feature Highlights (Double-Bezel Nested Mini Cards) */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                    <Tablet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">Tablet-to-PC Companion Pad</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Instant pairing via 6-digit code or QR. Zero-config drawing.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">Role-Based Live Collaboration</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Multiplayer strokes, live cursors, and granular permissions.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">Paper Textures & Version Snapshots</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Dotted, Grid, Ruled and Blank styles with instant checkpoints.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Status Monospace Tag */}
            <div className="pt-8 mt-6 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono relative z-10">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Local-First Active
              </span>
              <span>120Hz Latency Tuned</span>
            </div>
          </div>

          {/* Right Side: Auth / Instant Testing Profiles */}
          <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-between bg-white dark:bg-[#0c0e15]">
            <div className="space-y-6">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                  WORKSPACE ACCESS
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Sign in to your notebook
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Select a team profile or connect a companion tablet pad
                </p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium animate-in fade-in">
                  {authError}
                </div>
              )}

              {/* Google Sign-In Container */}
              {googleClientId ? (
                <div className="flex flex-col items-center justify-center w-full min-h-[44px]">
                  {!googleRendered && (
                    <div className="w-full max-w-[320px] h-11 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Connecting to Google...</span>
                    </div>
                  )}
                  <div
                    ref={googleBtnRef}
                    id="googleSignInBtn"
                    className={`w-full flex justify-center ${!googleRendered ? 'hidden' : ''}`}
                  />
                </div>
              ) : !isDemoEnabled ? (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1">
                  <div className="font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span>Production Authentication Mode</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Google Sign-In is awaiting configuration. Set <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your environment variables, or pair a tablet below.
                  </p>
                </div>
              ) : null}

              {isDemoEnabled && (
                <>
                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                    <span className="bg-white dark:bg-[#0c0e15] px-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 absolute">
                      Instant Demo Profiles
                    </span>
                  </div>

                  {/* Quick Demo Profiles (Double-Bezel Button-in-Button Cards) */}
                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('usr_demo_owner')}
                      disabled={Boolean(loadingUser)}
                      className="group p-1 rounded-2xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-all text-left cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#11131b] group-hover:bg-indigo-50/40 dark:group-hover:bg-indigo-950/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            K
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                Keshav
                              </span>
                              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                OWNER
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              keshav@notebook.local • Full edit & share
                            </div>
                          </div>
                        </div>
                        {/* Nested Trailing Icon */}
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoLogin('usr_demo_editor')}
                      disabled={Boolean(loadingUser)}
                      className="group p-1 rounded-2xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] hover:border-emerald-400 dark:hover:border-emerald-500/60 transition-all text-left cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#11131b] group-hover:bg-emerald-50/40 dark:group-hover:bg-emerald-950/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            A
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                Alex Rivera
                              </span>
                              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                                EDITOR
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              alex@notebook.local • Collaborative drawing
                            </div>
                          </div>
                        </div>
                        {/* Nested Trailing Icon */}
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDemoLogin('usr_demo_viewer')}
                      disabled={Boolean(loadingUser)}
                      className="group p-1 rounded-2xl bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] hover:border-amber-400 dark:hover:border-amber-500/60 transition-all text-left cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#11131b] group-hover:bg-amber-50/40 dark:group-hover:bg-amber-950/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            S
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                Sam Chen
                              </span>
                              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                                VIEWER
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              sam@notebook.local • Read-only observer
                            </div>
                          </div>
                        </div>
                        {/* Nested Trailing Icon */}
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Custom Guest Name Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Or enter custom guest name..."
                      className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => customName.trim() && handleDemoLogin(null, customName.trim())}
                      disabled={!customName.trim() || Boolean(loadingUser)}
                      className="px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-xs font-bold disabled:opacity-40 transition-colors cursor-pointer active:scale-95 shadow-sm"
                    >
                      Join
                    </button>
                  </div>
                </>
              )}

              {/* Tablet Pairing Code Box (Hardware Double-Bezel Card) */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <form onSubmit={handlePairingSubmit} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400">
                      <QrCode className="w-3.5 h-3.5" />
                    </div>
                    <span>Connect Tablet with 6-Digit PIN</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value)}
                      placeholder="e.g. 748-291"
                      maxLength={10}
                      className="flex-1 px-3.5 py-2.5 text-xs font-mono font-bold tracking-[0.25em] text-center uppercase rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 bg-slate-50/70 dark:bg-[#11131b] text-slate-900 dark:text-white transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={pairingLoading || !pairingCode.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 transition-all cursor-pointer active:scale-95 shadow-sm shadow-indigo-500/20"
                    >
                      {pairingLoading ? 'Connecting...' : 'Pair Pad'}
                    </button>
                  </div>
                  {pairingError && (
                    <div className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
                      {pairingError}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {isDemoEnabled && (
              <div className="pt-6 text-center text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                Open in multiple windows to simulate real-time collaboration.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
