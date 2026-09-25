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
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M15.2 3.4c.8-.8 2.1-.8 2.9 0l2.5 2.5c.8.8.8 2.1 0 2.9l-1.3 1.3-5.4-5.4 1.3-1.3Zm-2 2 5.4 5.4-8.6 8.6c-.2.2-.5.4-.8.5l-4.2 1.1c-.6.2-1.2-.4-1-1l1.1-4.2c.1-.3.3-.6.5-.8l8.6-8.6Z"
      />
    </svg>
  );
}
