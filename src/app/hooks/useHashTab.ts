import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Synchronizes one of a known set of tab IDs with the URL hash. Returns the
 * currently-active tab and a setter that updates the hash (replace, so the
 * browser back stack isn't polluted by tab clicks).
 *
 * Direct loads of /address/:addr#transactions work because `useLocation`
 * reflects the URL hash on first render.
 */
export function useHashTab<T extends string>(defaultTab: T, allowed: readonly T[]): [T, (next: T) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const active = useMemo<T>(() => {
    const raw = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    return (allowed as readonly string[]).includes(raw) ? (raw as T) : defaultTab;
  }, [location.hash, allowed, defaultTab]);

  const setTab = useCallback(
    (next: T) => {
      navigate({ hash: `#${next}` }, { replace: true });
    },
    [navigate],
  );

  return [active, setTab];
}
