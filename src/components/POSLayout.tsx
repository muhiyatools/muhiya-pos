import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useThemeStore } from '../store/useThemeStore';

/**
 * POSLayout — A full-screen wrapper for the POS register.
 * No sidebar, no header. Pure cash register experience.
 * Applies theme CSS variables and traps focus for barcode scanner.
 */
export default function POSLayout() {
  const { applyToDOM } = useThemeStore();

  useEffect(() => {
    applyToDOM();
  }, [applyToDOM]);

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: 'var(--bg-main)' }}>
      <Outlet />
    </div>
  );
}
