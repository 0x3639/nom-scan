import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { detectQueryType, normalizeHash } from "@shared/validate/identifier";
import styles from "./SearchInput.module.css";

interface Props {
  compact?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchInput({ compact = false, placeholder = "Search by Address or Hash", autoFocus = false }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Global "/" focus shortcut.
  useEffect(() => {
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
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    const kind = detectQueryType(q);
    if (kind === "address") {
      navigate(`/address/${q}#portfolios`);
    } else if (kind === "hash") {
      navigate(`/tx/${normalizeHash(q)}`);
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
      <label className="visually-hidden" htmlFor="pfscan-search">Search</label>
      <SearchIcon className={styles.icon} size={compact ? 16 : 20} aria-hidden />
      <input
        id="pfscan-search"
        ref={inputRef}
        className={`${styles.input} mono`}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {!compact && (
        <kbd className={styles.kbd} aria-hidden>/</kbd>
      )}
      <button type="submit" className={styles.submit}>
        Search
      </button>
    </form>
  );
}
