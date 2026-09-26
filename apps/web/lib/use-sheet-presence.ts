import { useEffect, useState } from "react";

export const SHEET_OUT_MS = 240;

export function useSheetPresence(open: boolean) {
  const [present, setPresent] = useState(open);

  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduce ? 140 : SHEET_OUT_MS;
    const timer = window.setTimeout(() => setPresent(false), wait);
    return () => window.clearTimeout(timer);
  }, [open, present]);

  return { present, leaving: present && !open };
}
