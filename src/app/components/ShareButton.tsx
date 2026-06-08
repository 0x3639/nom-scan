import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import styles from "./ShareButton.module.css";

/**
 * Icon-only "copy link to this page" button for the top nav. Copies the
 * current URL to the clipboard and briefly confirms with a checkmark +
 * "Copied!" tooltip so a user can share a tx / address / momentum easily.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts / older browsers without the
        // async Clipboard API.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access may be blocked; fail silently rather than throw.
    }
  }, []);

  return (
    <button
      type="button"
      className={styles.share}
      onClick={copy}
      aria-label={copied ? "Link copied to clipboard" : "Copy link to this page"}
      title={copied ? "Copied!" : "Copy link"}
      data-copied={copied || undefined}
    >
      {copied ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />}
      <span className={styles.tooltip} role="status" aria-live="polite">
        {copied ? "Copied!" : ""}
      </span>
    </button>
  );
}
