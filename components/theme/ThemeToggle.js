'use client';
import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useNotebookStore } from '@/lib/store/useNotebookStore';

export function getInitialTheme() {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem('notebook_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function applyTheme(isDark) {
  if (typeof window === 'undefined') return;
  try {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('notebook_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('notebook_theme', 'light');
    }
  } catch (err) {
    console.error('Failed to apply theme:', err);
  }
}

export default function ThemeToggle({ className = '', showLabel = false }) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const { setDarkMode } = useNotebookStore();

  useEffect(() => {
    setMounted(true);
    const dark = getInitialTheme();
    setIsDark(dark);
    applyTheme(dark);
    setDarkMode(dark);
  }, [setDarkMode]);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    setDarkMode(next);
  };

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl border border-transparent ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`relative inline-flex items-center justify-center gap-2 p-2 rounded-xl border transition-all duration-200 ${
        isDark
          ? 'bg-slate-800/90 border-slate-700/80 text-amber-400 hover:bg-slate-800 hover:text-amber-300 shadow-sm'
          : 'bg-white/90 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-xs'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
