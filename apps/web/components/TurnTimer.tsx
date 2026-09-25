"use client";

import { useEffect, useState } from "react";

export function TurnTimer({
  deadlineAt,
  durationMs,
  size = 96,
  bare = false,
}: {
  deadlineAt: number;
  durationMs: number;
  size?: number;
  bare?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [deadlineAt]);

  const leftMs = Math.max(0, deadlineAt - now);
  const leftSec = Math.ceil(leftMs / 1000);
  const frac = Math.max(0, Math.min(1, leftMs / durationMs));
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className={bare ? "timer timer-bare" : "timer"} style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle className="timer-track" cx="48" cy="48" r={r} />
        <circle
          className="timer-arc"
          cx="48"
          cy="48"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 48 48)"
        />
      </svg>
      {bare ? null : (
        <span className="timer-num">
          {leftSec}
          <small>s</small>
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {leftSec}s
      </span>
    </div>
  );
}
