import { useCallback, useEffect, useRef, useState } from "react";

export function useCopy(timeoutMs = 1500): { copied: boolean; copy: (text: string) => Promise<boolean> } {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear any pending hide-timer on unmount so it can't setState afterwards.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.top = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          // execCommand reports failure via its return value, not an exception —
          // don't flash "Copied" when nothing was copied.
          if (!ok) return false;
        }
        setCopied(true);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), timeoutMs);
        return true;
      } catch {
        return false;
      }
    },
    [timeoutMs],
  );

  return { copied, copy };
}
