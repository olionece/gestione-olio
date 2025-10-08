'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'>('light');

  useEffect(() => {
    setMounted(true);
    try {
      const saved = (localStorage.getItem('theme') as 'light'|'dark' | null);
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const t = saved ?? (prefersDark ? 'dark' : 'light');
      setTheme(t);
      document.documentElement.classList.toggle('dark', t === 'dark');
    } catch {}
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try { localStorage.setItem('theme', next); } catch {}
  };

  if (!mounted) return null;
  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm shadow-sm
                 bg-white hover:bg-stone-50 border-stone-200
                 dark:bg-stone-900 dark:hover:bg-stone-800 dark:border-stone-700"
      aria-label="Toggle dark mode"
    >
      {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
