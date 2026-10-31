// Small inline icons (stroke = currentColor).
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const BackIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const UndoIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M9 7H5V3" />
    <path d="M5 7a8 8 0 1 1-1.5 7" />
  </svg>
);

export const BackspaceIcon = () => (
  <svg {...base} aria-hidden="true">
    <path d="M8 5h12v14H8l-5-7z" />
    <path d="M12 9l5 6M17 9l-5 6" />
  </svg>
);

export const GearIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </svg>
);

export const PadIcon = () => (
  <svg {...base} aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" />
  </svg>
);

export const TargetIcon = () => (
  <svg {...base} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

/** Cricket mark symbols: one slash, a cross, a circled cross. */
export function Mark({ n }: { n: number }) {
  if (n <= 0) return <span aria-label="no marks" />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-label={`${n} marks`}>
      <path d="M6 18L18 6" />
      {n >= 2 && <path d="M6 6l12 12" />}
      {n >= 3 && <circle cx="12" cy="12" r="10" strokeWidth="2.2" />}
    </svg>
  );
}
