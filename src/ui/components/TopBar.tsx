import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { BackIcon } from './Icons';

export function TopBar({ title, sub, back = '/', right }: { title: ReactNode; sub?: ReactNode; back?: string | null; right?: ReactNode }) {
  const [, navigate] = useLocation();
  return (
    <header className="topbar">
      {back !== null && (
        <button className="iconbtn" aria-label="Back" onClick={() => navigate(back)}>
          <BackIcon />
        </button>
      )}
      <h1>
        {title}
        {sub && <span className="sub">{sub}</span>}
      </h1>
      {right}
    </header>
  );
}
