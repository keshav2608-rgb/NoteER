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
    return <div className={`w-10 h-10 shrink-0 ${className}`} />;
  }

  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`icon-btn ${showLabel ? 'w-auto px-3 gap-2' : ''} ${className}`}
    >
      {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
      {showLabel && (
        <span className="text-sm font-medium">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  );
}
