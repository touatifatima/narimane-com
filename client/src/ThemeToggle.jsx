import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('thread-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191a17' : '#f6f4ef');
    try { localStorage.setItem('thread-theme', theme); } catch {}
  }, [theme]);
  const label = theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre';
  return <button className="icon theme-toggle" type="button" aria-label={label} title={label}
    onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
    {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
  </button>;
}
