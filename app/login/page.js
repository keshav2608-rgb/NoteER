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
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40 text-slate-900 dark:text-slate-100 relative">
      {/* Floating Theme Toggle (top-right) */}
      <div className="fixed top-4 right-4 z-40">
        <ThemeToggle />
      </div>

      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => renderGoogleButton()}
      />

      <div className="max-w-4xl w-full my-auto my-6 grid grid-cols-1 md:grid-cols-2 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        
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
        <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-between bg-white dark:bg-slate-900">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign in to your notebook</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select an identity or pair as a drawing device</p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {authError}
              </div>
            )}

            {/* Google Sign-In Container */}
            {googleClientId ? (
              <div className="flex flex-col items-center justify-center w-full min-h-[44px]">
                {!googleRendered && (
                  <div className="w-full max-w-[320px] h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting to Google...</span>
                  </div>
                )}
                <div
                  ref={googleBtnRef}
                  id="googleSignInBtn"
                  className={`w-full flex justify-center ${!googleRendered ? 'hidden' : ''}`}
                ></div>
              </div>
            ) : !isDemoEnabled ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1">
                <div className="font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Production Authentication Mode</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Google Sign-In is awaiting configuration. Set <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in your Vercel Environment Variables, or connect via Tablet PIN pairing below.
                </p>
              </div>
            ) : null}

            {isDemoEnabled && (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
                  <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 absolute">
                    Instant Demo Profiles
                  </span>
                </div>

                {/* Quick Demo Profiles (Multi-User Pair Testing) */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('usr_demo_owner')}
                    disabled={Boolean(loadingUser)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-slate-800/80 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        K
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-900 dark:group-hover:text-indigo-400">
                          Keshav (Owner)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">keshav@notebook.local • Full edit & share</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoLogin('usr_demo_editor')}
                    disabled={Boolean(loadingUser)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-slate-800/80 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        A
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-900 dark:group-hover:text-emerald-400">
                          Alex Rivera (Editor)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">alex@notebook.local • Collaborative drawing</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDemoLogin('usr_demo_viewer')}
                    disabled={Boolean(loadingUser)}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-slate-800/80 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        S
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-900 dark:group-hover:text-amber-400">
                          Sam Chen (Viewer)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">sam@notebook.local • Read-only observer</div>
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
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => customName.trim() && handleDemoLogin(null, customName.trim())}
                    disabled={!customName.trim() || Boolean(loadingUser)}
                    className="px-3 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    Join
                  </button>
                </div>
              </>
            )}

            {/* Tablet Pairing Code Box */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <form onSubmit={handlePairingSubmit} className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Connect Tablet with 6-Digit PIN</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value)}
                    placeholder="e.g. 748-291"
                    maxLength={10}
                    className="flex-1 px-3 py-2 text-xs font-mono font-bold tracking-widest text-center uppercase rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={pairingLoading || !pairingCode.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
                  >
                    {pairingLoading ? 'Connecting...' : 'Pair Pad'}
                  </button>
                </div>
                {pairingError && <div className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{pairingError}</div>}
              </form>
            </div>
          </div>

          {isDemoEnabled && (
            <div className="pt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Open in multiple windows to simulate real-time collaboration.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
