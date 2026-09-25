export function ScoreSquare({ className, size = 13 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 13 13"
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="11.5" height="11.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="0.75" cy="0.75" r="1.75" fill="currentColor" />
      <circle cx="12.25" cy="0.75" r="1.75" fill="currentColor" />
      <circle cx="0.75" cy="12.25" r="1.75" fill="currentColor" />
      <circle cx="12.25" cy="12.25" r="1.75" fill="currentColor" />
    </svg>
  );
}

export function PickerStroke({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="43"
      height="14"
      viewBox="0 0 43 14"
      aria-hidden="true"
    >
      <rect x="5" y="5.5" width="33" height="3" fill="currentColor" />
      <circle cx="5" cy="7" r="3.4" fill="currentColor" />
      <circle cx="38" cy="7" r="3.4" fill="currentColor" />
    </svg>
  );
}

export function ScoreStroke({ className, size = 13 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 13 13"
      aria-hidden="true"
    >
      <rect x="1.75" y="5.75" width="9.5" height="1.5" fill="currentColor" />
      <circle cx="1.75" cy="6.5" r="1.75" fill="currentColor" />
      <circle cx="11.25" cy="6.5" r="1.75" fill="currentColor" />
    </svg>
  );
}
