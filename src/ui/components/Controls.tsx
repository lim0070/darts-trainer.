import type { ReactNode } from 'react';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {help && <span className="help">{help}</span>}
      {children}
    </div>
  );
}

export function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="grow">{children}</span>
      <span className="knob" aria-hidden="true" />
    </button>
  );
}

export function Sheet({ children, onClose, className = '' }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className={`overlay ${className}`} onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
