'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { ArrowRight, Tablet, Users, PenLine } from 'lucide-react';
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
    const target = params.get('redirect') || '';
    // Only allow same-site paths; reject absolute and protocol-relative URLs
    if (target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) {
      return target;
    }
    return '/dashboard';
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
    <div className="min-h-[100dvh] w-full bg-desk text-ink lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => renderGoogleButton()}
      />

      <div className="fixed z-40 right-3 sm:right-5" style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <ThemeToggle />
      </div>

      {/* A notebook page lying on the desk */}
      <section className="relative px-4 pt-14 pb-6 sm:px-8 sm:pt-16 lg:p-10 lg:flex lg:items-center lg:justify-center">
        <div className="relative w-full max-w-xl mx-auto lg:-rotate-[1.2deg]">
          <div className="relative canvas-bg-dotted rounded-[4px] shadow-float border border-rule pl-12 sm:pl-16 pr-6 sm:pr-10 py-8 sm:py-12 overflow-hidden">
            {/* binding holes */}
            <div className="absolute left-3 sm:left-4 inset-y-6 flex flex-col justify-between" aria-hidden="true">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="block w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-desk shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)]" />
              ))}
            </div>
            {/* margin line */}
            <div className="absolute inset-y-0 left-9 sm:left-12 w-px bg-correction/40" aria-hidden="true" />

            <p className="font-hand font-bold text-[1.6rem] leading-none text-ink">notebook</p>

            <h1 className="font-hand text-[2.5rem] sm:text-[3.4rem] leading-[0.98] mt-6 sm:mt-10 text-ink">
              Sketch it out,
              <br />
              together.
            </h1>

            {/* the one animated moment: a pen underline drawing itself */}
            <svg viewBox="0 0 320 24" className="w-56 sm:w-72 h-5 mt-1 text-ballpoint" fill="none" aria-hidden="true">
              <path
                d="M3 15 C 50 6, 95 20, 140 12 S 230 4, 316 13"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="pen-stroke"
              />
            </svg>

            <p className="mt-6 sm:mt-8 text-[15px] sm:text-base leading-relaxed text-ink/80 max-w-[34ch]">
              A shared notebook with real paper. Write and draw from your computer, or pair a tablet and use it as your pen.
            </p>

            <ul className="hidden sm:flex flex-col gap-2.5 mt-8 text-[15px] text-ink/80">
              <li className="flex items-center gap-3">
                <Tablet className="w-[18px] h-[18px] text-pencil shrink-0" />
                Pair a tablet with a six-digit code
              </li>
              <li className="flex items-center gap-3">
                <Users className="w-[18px] h-[18px] text-pencil shrink-0" />
                See everyone&rsquo;s strokes as they draw
              </li>
              <li className="flex items-center gap-3">
                <PenLine className="w-[18px] h-[18px] text-pencil shrink-0" />
                Dotted, grid, ruled or blank pages
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Sign in */}
      <section
        className="px-4 sm:px-8 lg:py-10 flex lg:items-center justify-center"
        style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-[420px]">
          <h2 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight">Sign in</h2>
          <p className="text-[15px] text-pencil mt-1">Pick up where you left off.</p>

          {authError && (
            <div className="mt-5 p-3 rounded-ctl border border-correction/40 bg-correction/[0.07] text-correction text-sm" role="alert">
              {authError}
            </div>
          )}

          {/* Google */}
          {googleClientId ? (
            <div className="mt-6 flex flex-col items-center w-full min-h-[44px]">
              {!googleRendered && (
                <div className="w-full h-11 rounded-ctl border border-rule bg-paper flex items-center justify-center gap-2 text-sm text-pencil">
                  <span className="w-4 h-4 border-2 border-rule border-t-ballpoint rounded-full animate-spin" />
                  Loading Google sign-in…
                </div>
              )}
              <div
                ref={googleBtnRef}
                id="googleSignInBtn"
                className={`w-full flex justify-center ${!googleRendered ? 'hidden' : ''}`}
              />
            </div>
          ) : !isDemoEnabled ? (
            <div className="mt-6 p-4 rounded-ctl border border-rule bg-paper text-sm leading-relaxed">
              <p className="font-semibold">Google sign-in isn&rsquo;t set up yet</p>
              <p className="text-pencil mt-1">
                Set <code className="px-1 py-0.5 rounded bg-paper-2 text-[13px]">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> on the server to turn it on. You can still pair a tablet below.
              </p>
            </div>
          ) : null}

          {isDemoEnabled && (
            <div className="mt-7">
              <p className="text-sm font-semibold">Try it with a sample account</p>
              <ul className="mt-2.5 panel shadow-none divide-y divide-rule overflow-hidden">
                {DEMO_PROFILES.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin(p.id)}
                      disabled={Boolean(loadingUser)}
                      className="group w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-paper-2 transition-colors disabled:opacity-60"
                    >
                      <span className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shrink-0 ${p.color}`}>
                        {p.initial}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-semibold leading-tight">
                          {p.name}
                          <span className="ml-2 font-normal text-pencil">{p.role}</span>
                        </span>
                        <span className="block text-[13px] text-pencil">
                          {loadingUser === p.id ? 'Signing in…' : p.hint}
                        </span>
                      </span>
                      <ArrowRight className="w-4 h-4 text-pencil group-hover:text-ink transition-colors" />
                    </button>
                  </li>
                ))}
              </ul>

              <form
                className="flex gap-2 mt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customName.trim()) handleDemoLogin(null, customName.trim());
                }}
              >
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Or join as a guest: your name"
                  aria-label="Guest name"
                  className="field"
                />
                <button
                  type="submit"
                  disabled={!customName.trim() || Boolean(loadingUser)}
                  className="btn btn-ink shrink-0"
                >
                  {loadingUser && loadingUser === customName.trim() ? 'Joining…' : 'Join'}
                </button>
              </form>
            </div>
          )}

          {/* Pair a tablet */}
          <form onSubmit={handlePairingSubmit} className="mt-8 pt-6 border-t border-rule">
            <label htmlFor="login-pair" className="text-sm font-semibold flex items-center gap-2">
              <Tablet className="w-4 h-4 text-pencil" />
              Using a tablet as a pen?
            </label>
            <p className="text-[13px] text-pencil mt-1">
              Type the code shown on your computer. No sign-in needed.
            </p>
            <div className="flex gap-2 mt-3">
              <input
                id="login-pair"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value)}
                placeholder="748-291"
                maxLength={10}
                className="field text-center text-base font-semibold tabular-nums tracking-[0.15em]"
              />
              <button
                type="submit"
                disabled={pairingLoading || !pairingCode.trim()}
                className="btn btn-primary shrink-0"
              >
                {pairingLoading ? 'Pairing…' : 'Pair tablet'}
              </button>
            </div>
            {pairingError && (
              <p className="text-[13px] text-correction mt-2" role="alert">{pairingError}</p>
            )}
          </form>

          {isDemoEnabled && (
            <p className="mt-8 text-[13px] text-pencil">
              Tip: open two browser windows with different accounts to watch changes sync live.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

const DEMO_PROFILES = [
  { id: 'usr_demo_owner', initial: 'K', name: 'Keshav', role: 'Owner', hint: 'Can edit and share', color: 'bg-ballpoint text-ballpoint-fg' },
  { id: 'usr_demo_editor', initial: 'A', name: 'Alex Rivera', role: 'Editor', hint: 'Can draw and write', color: 'bg-ok text-paper' },
  { id: 'usr_demo_viewer', initial: 'S', name: 'Sam Chen', role: 'Viewer', hint: 'Can only look', color: 'bg-highlight text-highlight-fg' }
];
