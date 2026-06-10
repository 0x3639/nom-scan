import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import styles from "./DownloadCsvButton.module.css";

const ROW_CAP = 10000;

interface Props {
  address: string;
  /** Known transaction count, used to warn when the export will be capped. */
  txCount?: number;
}

export function DownloadCsvButton({ address, txCount }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    if (typeof txCount === "number" && txCount > ROW_CAP) {
      const ok = window.confirm(
        `This address has ${txCount.toLocaleString()} transactions. Only the newest ${ROW_CAP.toLocaleString()} will be exported. Continue?`,
      );
      if (!ok) return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`/api/address/${encodeURIComponent(address)}/transactions.csv`);
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/csv")) {
        throw new Error("export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Prefer the filename the Worker already declares in Content-Disposition
      // so the two tiers can't silently desynchronize.
      const disposition = res.headers.get("content-disposition") ?? "";
      const fromHeader = /filename="([^"]+)"/.exec(disposition)?.[1];
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = fromHeader ?? `nomscan-${address.slice(0, 12)}-transactions-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after the download has had a chance to start — synchronous
      // revocation right after click() can abort it in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("idle");
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={() => void download()}
      disabled={status === "loading"}
      aria-label="Download transactions as CSV"
    >
      {status === "loading" ? (
        <Loader2 size={14} aria-hidden className={styles.spin} />
      ) : (
        <Download size={14} aria-hidden />
      )}
      <span aria-live="polite">
        {status === "loading" ? "Preparing…" : status === "error" ? "Try again" : "Download CSV"}
      </span>
    </button>
  );
}
