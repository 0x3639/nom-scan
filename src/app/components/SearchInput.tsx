import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search as SearchIcon, X } from "lucide-react";
import { detectQueryType, normalizeAddress, normalizeHash, normalizeMomentum } from "@shared/validate/identifier";
import styles from "./SearchInput.module.css";

interface Props {
  compact?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  enableShortcut?: boolean;
}

export function SearchInput({
  compact = false,
  placeholder = "Search by Address, Hash, or Momentum #",
  autoFocus = false,
  enableShortcut = false,
}: Props) {
  const navigate = useNavigate();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Global "/" focus shortcut.
  useEffect(() => {
    if (!enableShortcut) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut]);

  const hasValue = value.trim().length > 0;

  function clear() {
    setValue("");
    inputRef.current?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    const kind = detectQueryType(q);
    if (kind === "address") {
      navigate(`/address/${normalizeAddress(q)}#portfolios`);
    } else if (kind === "hash") {
      navigate(`/tx/${normalizeHash(q)}`);
    } else if (kind === "momentum") {
      navigate(`/momentum/${normalizeMomentum(q)}`);
    } else if (kind === "ambiguous") {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <form
      role="search"
      className={`${styles.wrap} ${compact ? styles.compact : styles.hero}`}
      onSubmit={submit}
    >
      <label className="visually-hidden" htmlFor={inputId}>Search</label>
      <SearchIcon className={styles.icon} size={compact ? 16 : 20} aria-hidden />
      <input
        id={inputId}
        ref={inputRef}
        className={`${styles.input} mono`}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {hasValue ? (
        <>
          <button
            type="button"
            className={styles.clear}
            onClick={clear}
            aria-label="Clear search"
          >
            <X size={compact ? 16 : 18} aria-hidden />
          </button>
          <button type="submit" className={styles.submit} aria-label="Search">
            <CornerDownLeft size={compact ? 16 : 18} aria-hidden />
          </button>
        </>
      ) : (
        !compact && <kbd className={styles.kbd} aria-hidden>/</kbd>
      )}
    </form>
  );
}
