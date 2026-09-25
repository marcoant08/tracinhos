export function PenIcon({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 52"
      aria-hidden="true"
      overflow="visible"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(38 20 21)"
      >
        <path d="M20 2.3c5.2 0 6.2 3.2 5.4 6.6-1 4.4-.2 9.2 1 13.4 1 3.4-.6 6.2-3.2 8.2-1.6 1.2-2.6 1.8-3.2 2-.6-.2-1.6-.8-3.2-2-2.6-2-4.2-4.8-3.2-8.2 1.2-4.2 2-9 1-13.4C13.8 5.5 14.8 2.3 20 2.3Z" />
        <path d="M14.8 8.8c3.5.7 6.9.7 10.4 0" />
        <path d="M14.7 10.9c3.5.65 7.1.65 10.6 0" />
        <path d="M14.6 24.2c3.6.75 7.2.75 10.8 0" />
        <path d="M14.8 26.2c3.5.65 6.9.65 10.4 0" />
        <path d="M25.6 7.6 27.2 2.2" />
        <circle cx="27.5" cy="1.6" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="20" cy="33.6" r="1.55" />
        <path d="M20 35.1 15.4 37.6c-1 2 .8 4.6 4.6 8.6 3.8-4 5.6-6.6 4.6-8.6Z" />
        <path d="M20 37.2v7.2" />
        <circle cx="20" cy="38.4" r="0.8" fill="currentColor" />
      </g>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        d="M5 44.8c2.4-1.4 4.8.2 7.2-.8 2.2-.9 4.2.6 6.6-.2"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        d="M21.8 44.2h8.2"
      />
      <circle cx="4.4" cy="45" r="1.2" fill="currentColor" />
    </svg>
  );
}
